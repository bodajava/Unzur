import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const TIMEOUT_MS = 20_000;

/**
 * Any OpenAI-compatible /chat/completions endpoint (AI_BASE_URL, AI_MODEL,
 * AI_API_KEY). Returns null when not configured or on any failure, so callers
 * fall back to the data-based answer; it never throws to the user.
 */
@Injectable()
export class AiGatewayClient {
  private readonly logger = new Logger(AiGatewayClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('AI_API_KEY') ?? '';
    this.baseUrl = (config.get<string>('AI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.model = config.get<string>('AI_MODEL') || 'gpt-4o-mini';
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(messages: ChatTurn[], maxTokens = 700): Promise<string | null> {
    if (!this.apiKey) return null;
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
