import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvents } from '../../common/events/event-names.js';
import type { ServerErrorEvent } from '../../common/filters/http-exception.filter.js';
import { runInBackground } from '../../common/utilities/background.js';
import { RedisService } from '../../common/utilities/caching/redis.service.js';
import { EmailService } from '../../common/utilities/email/email.service.js';
import { escapeHtml } from '../../common/utilities/emails/escape-html.js';

/** The same error (route + message) is reported at most once per this many seconds. */
export const SAME_ERROR_SECONDS = 30 * 60;
/** At most this many alert emails per hour, whatever happens. */
export const MAX_ALERTS_PER_HOUR = 20;

/** Something the team must act on that isn't a crash (spend limit, payment to refund). */
export interface OpsAlertEvent {
  title: string;
  details: string;
  at: string;
}

/** One key per kind of error: ids, numbers and query strings removed so repeats group together. */
export function errorSignature(e: Pick<ServerErrorEvent, 'where' | 'message'>): string {
  const where = e.where
    .replace(/\?.*$/, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\d+/g, ':n');
  const message = e.message.split('\n')[0].replace(/\d+/g, ':n').slice(0, 200);
  return createHash('sha1').update(`${where}|${message}`).digest('hex').slice(0, 16);
}

/**
 * Error tracking without a third-party service: every unexpected 500 is
 * emailed to ALERTS_EMAIL (else ORDERS_EMAIL, else SUPER_ADMIN_EMAIL) with the
 * route, message and stack. Throttled through Redis so an outage can't flood
 * the inbox; without Redis nothing is sent (better silent than spamming).
 */
@Injectable()
export class ErrorAlertsListener {
  private readonly logger = new Logger(ErrorAlertsListener.name);
  private readonly to: string | undefined;

  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
  ) {
    this.to =
      config.get<string>('ALERTS_EMAIL')?.trim() ||
      config.get<string>('ORDERS_EMAIL')?.trim() ||
      config.get<string>('SUPER_ADMIN_EMAIL')?.trim() ||
      undefined;
  }

  @OnEvent(AppEvents.SERVER_ERROR)
  onServerError(event: ServerErrorEvent): void {
    if (!this.to || process.env.NODE_ENV === 'test') return;
    const to = this.to;
    runInBackground('error-alert', async () => {
      if (!(await this.shouldSend(event))) return;
      await this.email.sendGenericEmail(to, `⚠️ Server error: ${event.where}`.slice(0, 150), this.render(event));
    });
  }

  @OnEvent(AppEvents.OPS_ALERT)
  onOpsAlert(event: OpsAlertEvent): void {
    if (!this.to || process.env.NODE_ENV === 'test') return;
    const to = this.to;
    runInBackground('ops-alert', async () => {
      // Exact title as the key: two different orders must both be reported.
      const key = createHash('sha1').update(`ops|${event.title}`).digest('hex').slice(0, 16);
      if (!(await this.shouldSend({ where: 'ops', message: event.title, at: event.at }, key))) return;
      const html = `<div style="font-family:system-ui,sans-serif;color:#1c2340">
<h2 style="margin:0 0 12px">${escapeHtml(event.title)}</h2>
<p>${escapeHtml(event.details)}</p>
<p style="color:#6b7080;font-size:12px">${escapeHtml(event.at)} (UTC)</p>
</div>`;
      await this.email.sendGenericEmail(to, `🔔 ${event.title}`.slice(0, 150), html);
    });
  }

  /** True when this error wasn't reported recently and the hourly cap isn't reached. */
  async shouldSend(event: Pick<ServerErrorEvent, 'where' | 'message' | 'at'>, key = errorSignature(event)): Promise<boolean> {
    try {
      const fresh = await this.redis.setIfAbsent(`alert:error:${key}`, 1, SAME_ERROR_SECONDS);
      if (!fresh) return false;
      const hourKey = `alert:error:hour:${event.at.slice(0, 13)}`;
      const sent = await this.redis.incr(hourKey);
      if (sent === 1) await this.redis.expire(hourKey, 3600);
      return sent <= MAX_ALERTS_PER_HOUR;
    } catch (error) {
      this.logger.warn(`Error alert skipped (no Redis): ${(error as Error).message}`);
      return false;
    }
  }

  private render(e: ServerErrorEvent): string {
    const stack = (e.stack ?? '').split('\n').slice(0, 15).join('\n');
    return `<div style="font-family:system-ui,sans-serif;color:#1c2340">
<h2 style="margin:0 0 12px">Server error on the store</h2>
<p><b>Where:</b> ${escapeHtml(e.where)}<br><b>When:</b> ${escapeHtml(e.at)} (UTC)</p>
<p><b>Message:</b> ${escapeHtml(e.message)}</p>
<pre style="background:#f3f4f7;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap">${escapeHtml(stack)}</pre>
<p style="color:#6b7080;font-size:12px">The same error is reported at most once every ${SAME_ERROR_SECONDS / 60} minutes. Details are in the server logs.</p>
</div>`;
  }
}
