import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvents } from '../../common/events/event-names.js';
import { RedisService } from '../../common/utilities/caching/redis.service.js';
import type { OpsAlertEvent } from '../monitoring/error-alerts.listener.js';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const TIMEOUT_MS = 20_000;
/** Paid AI calls allowed per day (Africa/Cairo) unless AI_DAILY_LIMIT says otherwise. */
export const DEFAULT_AI_DAILY_LIMIT = 500;

/** Today's date in Cairo (YYYY-MM-DD): the budget resets at local midnight. */
const cairoDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now);

/**
 * Any OpenAI-compatible /chat/completions endpoint (AI_BASE_URL, AI_MODEL,
 * AI_API_KEY). Returns null when not configured or on any failure, so callers
 * fall back to the data-based answer; it never throws to the user.
 *
 * Spend guard: at most AI_DAILY_LIMIT paid calls a day (counted in Redis).
 * Past it, answers come from the data-based fallback for the rest of the day.
 * The team is emailed at 80% and at 100% (AppEvents.OPS_ALERT).
 */
@Injectable()
export class AiGatewayClient {
  private readonly logger = new Logger(AiGatewayClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dailyLimit: number;

  constructor(
    config: ConfigService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly events?: EventEmitter2,
  ) {
    this.apiKey = config.get<string>('AI_API_KEY') ?? '';
    this.baseUrl = (config.get<string>('AI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.model = config.get<string>('AI_MODEL') || 'gpt-4o-mini';
    const limit = Number(config.get<string>('AI_DAILY_LIMIT'));
    this.dailyLimit = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_AI_DAILY_LIMIT;
  }

  /**
   * Counts one paid call against today's budget. False once the budget is used up.
   * Without Redis the call is allowed (the per-IP rate limits still apply).
   */
  async withinBudget(now = new Date()): Promise<boolean> {
    if (!this.redis) return true;
    try {
      const day = cairoDay(now);
      const key = `ai:calls:${day}`;
      const used = await this.redis.incr(key);
      if (used === 1) await this.redis.expire(key, 2 * 86_400);
      const warnAt = Math.ceil(this.dailyLimit * 0.8);
      if (used === warnAt || used === this.dailyLimit + 1) {
        const over = used > this.dailyLimit;
        const alert: OpsAlertEvent = {
          title: over ? `AI budget used up for ${day}` : `AI budget 80% used for ${day}`,
          details: over
            ? `${this.dailyLimit} AI calls were made today (AI_DAILY_LIMIT). The assistant now answers from store data only until midnight (Cairo).`
            : `${used} of ${this.dailyLimit} AI calls used today (AI_DAILY_LIMIT). Check for unusual traffic if this is unexpected.`,
          at: now.toISOString(),
        };
        this.events?.emit(AppEvents.OPS_ALERT, alert);
      }
      return used <= this.dailyLimit;
    } catch (error) {
      this.logger.warn(`AI budget check skipped: ${(error as Error).message}`);
      return true;
    }
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(messages: ChatTurn[], maxTokens = 700): Promise<string | null> {
    if (!this.apiKey) return null;
    if (!(await this.withinBudget())) return null;
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, temperature: 0.2, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`AI provider returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
        return null;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text || null;
    } catch (error) {
      this.logger.warn(`AI provider unreachable: ${(error as Error).message}`);
      return null;
    }
  }
}
