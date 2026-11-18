import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizePhone } from '../../common/utilities/phone.js';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const TIMEOUT_MS = 10_000;

export interface WhatsAppSendResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

/** Status values from Meta delivery receipts. */
interface WhatsAppStatus {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string }[];
}

const mask = (phone?: string) => (phone ? `***${phone.slice(-4)}` : '?');

/**
 * 20.4 WhatsApp Cloud API. Order updates use an approved template (business
 * messages outside the 24h customer window must be templates). Without
 * WHATSAPP_ACCESS_TOKEN every send is a logged no-op.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly template: string;
  private readonly templateLang: string;
  private readonly verifyToken: string;
  private readonly appSecret: string;

  constructor(config: ConfigService) {
    this.token = config.get<string>('WHATSAPP_ACCESS_TOKEN') ?? '';
    this.phoneNumberId = config.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    this.template = config.get<string>('WHATSAPP_ORDER_TEMPLATE') || 'order_status_update';
    this.templateLang = config.get<string>('WHATSAPP_TEMPLATE_LANG') || 'ar';
    this.verifyToken = config.get<string>('WHATSAPP_VERIFY_TOKEN') ?? '';
    this.appSecret = config.get<string>('WHATSAPP_APP_SECRET') ?? '';
  }

  get isConfigured(): boolean {
    return !!(this.token && this.phoneNumberId);
  }

  /** Egyptian 01XXXXXXXXX -> 201XXXXXXXXX (WhatsApp wants country code, no +). */
  static toWhatsAppNumber(phone: string): string {
    const local = normalizePhone(phone);
    return /^01\d{9}$/.test(local) ? `2${local}` : local;
  }

  /** Never throws: a failed WhatsApp message must not break order processing. */
  async sendOrderStatusUpdate(phone: string, orderNumber: string, status: string): Promise<WhatsAppSendResult> {
    const to = WhatsAppService.toWhatsAppNumber(phone);
    if (!this.isConfigured) {
      this.logger.log(`[WhatsApp off] ${orderNumber} -> ${status} for ${mask(to)}`);
      return { sent: false, reason: 'not_configured' };
    }
    try {
      const res = await fetch(`${GRAPH_URL}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: this.template,
            language: { code: this.templateLang },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: orderNumber }, { type: 'text', text: status }] },
            ],
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      if (!res.ok) {
        this.logger.warn(`WhatsApp send failed (${res.status}) for ${orderNumber}: ${data.error?.message ?? ''}`);
        return { sent: false, reason: `http_${res.status}` };
      }
      return { sent: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
      this.logger.warn(`WhatsApp unreachable for ${orderNumber}: ${(error as Error).message}`);
      return { sent: false, reason: 'unreachable' };
    }
  }

  /** Meta webhook verification: returns hub.challenge when the token matches. */
  verifySubscription(mode: unknown, token: unknown, challenge: unknown): string | null {
    if (mode !== 'subscribe' || typeof token !== 'string' || typeof challenge !== 'string' || !this.verifyToken) return null;
    const a = Buffer.from(token);
    const b = Buffer.from(this.verifyToken);
    return a.length === b.length && timingSafeEqual(a, b) ? challenge : null;
  }

  /**
   * X-Hub-Signature-256: "sha256=" + HMAC-SHA256(app secret, raw body).
   * Skipped (true) only when WHATSAPP_APP_SECRET is not set.
   */
  verifySignature(rawBody: Buffer | undefined, header: unknown): boolean {
    if (!this.appSecret) return true;
    if (!rawBody || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
    const expected = Buffer.from(createHmac('sha256', this.appSecret).update(rawBody).digest('hex'), 'hex');
    const actual = Buffer.from(header.slice('sha256='.length), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /** Logs delivery/read receipts. Returns how many statuses were seen. */
  handleEvent(body: unknown): { statuses: number } {
    const entries = (body as { entry?: { changes?: { value?: { statuses?: WhatsAppStatus[] } }[] }[] })?.entry ?? [];
    let statuses = 0;
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        for (const s of change.value?.statuses ?? []) {
          statuses++;
          const error = s.errors?.[0];
          this.logger.log(
            `WhatsApp ${s.id ?? '?'} -> ${s.status ?? '?'} (${mask(s.recipient_id)})${error ? ` error ${error.code}: ${error.title}` : ''}`,
          );
        }
      }
    }
    return { statuses };
  }
}
