import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'newsletter-unsubscribe:v1:';

/**
 * Signed one-click unsubscribe tokens: base64url(email).hmac (HMAC-SHA256 with
 * ENCRYPTION_KEY). They do not expire, so links in old emails keep working.
 */
@Injectable()
export class NewsletterTokenService {
  private readonly secret: string;
  private readonly backendUrl: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('ENCRYPTION_KEY');
    this.backendUrl = (config.get<string>('APP_BACKEND_URL') || config.get<string>('APP_URL') || '').replace(/\/+$/, '');
  }

  sign(email: string): string {
    const normalized = email.trim().toLowerCase();
    return `${Buffer.from(normalized).toString('base64url')}.${this.mac(normalized)}`;
  }

  /** The email inside a valid token, else null. */
  verify(token: unknown): string | null {
    if (typeof token !== 'string' || token.length > 600) return null;
    const [payload, mac] = token.split('.');
    if (!payload || !mac || !/^[0-9a-f]{64}$/.test(mac)) return null;
    const email = Buffer.from(payload, 'base64url').toString('utf8');
    const expected = Buffer.from(this.mac(email), 'hex');
    const actual = Buffer.from(mac, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? email : null;
  }

  /** Link for emails (GET unsubscribes and redirects to the frontend). */
  unsubscribeUrl(email: string): string {
    return `${this.backendUrl}/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(this.sign(email))}`;
  }

  private mac(email: string): string {
    return createHmac('sha256', this.secret).update(PURPOSE + email).digest('hex');
  }
}
