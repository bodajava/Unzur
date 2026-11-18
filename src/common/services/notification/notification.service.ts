import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { PushDeviceRepository } from '../../../models/repositories/push-device.repository.js';

/** What a notification says. `url` is a storefront path ("/ar/track?…") opened on click. */
export interface PushNotification {
  title: string;
  body: string;
  url?: string;
  /** Same tag = the newer notification replaces the older one (e.g. per order). */
  tag?: string;
}

/** Builds the message in the device's language. */
export type PushBuilder = (lang: 'ar' | 'en') => PushNotification;

/** FCM error codes meaning the token is gone for good (uninstalled, revoked, expired). */
const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Push notifications through Firebase Cloud Messaging (web push).
 * Enabled when FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY
 * are set (a service account from Firebase console → Project settings → Service
 * accounts). Without them, notifications are only logged.
 *
 * Messages are data-only: the storefront's service worker (/push-sw.js) shows
 * them, so title, body and link look the same in every browser.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly messaging: Messaging | null;
  private readonly frontendUrl: string;

  constructor(
    config: ConfigService,
    private readonly devices: PushDeviceRepository,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
    const projectId = config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
    // .env files keep the key on one line with literal "\n".
    const privateKey = config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      this.messaging = null;
      this.logger.log('Push notifications off (set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
      return;
    }
    const app: App = getApps().length ? getApp() : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
    this.messaging = getMessaging(app);
  }

  get isPushEnabled(): boolean {
    return this.messaging !== null;
  }

  /** Every staff browser that turned notifications on. */
  async notifyStaff(build: PushBuilder): Promise<void> {
    await this.send(await this.devices.staffTokens(), build, 'staff');
  }

  /** The browsers of whoever placed an order (their account and/or the guest session). */
  async notifyCustomer(who: { userId: string | null; guestId: string | null }, build: PushBuilder): Promise<void> {
    await this.send(await this.devices.customerTokens(who), build, 'customer');
  }

  private async send(devices: { token: string; lang: string }[], build: PushBuilder, audience: string): Promise<void> {
    if (!devices.length) return;
    if (!this.messaging) {
      this.logger.log(`[push off] ${audience} ×${devices.length}: "${build('en').title}"`);
      return;
    }
    const dead: string[] = [];
    for (const lang of ['ar', 'en'] as const) {
      const tokens = devices.filter((d) => (d.lang === 'en' ? 'en' : 'ar') === lang).map((d) => d.token);
      if (!tokens.length) continue;
      const n = build(lang);
      const url = n.url ? (n.url.startsWith('http') ? n.url : `${this.frontendUrl}${n.url}`) : this.frontendUrl;
      // FCM accepts at most 500 tokens per call.
      for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        const res = await this.messaging.sendEachForMulticast({
          tokens: batch,
          data: { title: n.title, body: n.body, url, tag: n.tag ?? '', lang },
          webpush: { headers: { Urgency: 'high', TTL: String(24 * 3600) } },
        });
        res.responses.forEach((r, k) => {
          if (!r.success && r.error && DEAD_TOKEN.has(r.error.code)) dead.push(batch[k]);
        });
        if (res.failureCount) this.logger.warn(`push ${audience}: ${res.failureCount}/${batch.length} failed`);
      }
    }
    if (dead.length) await this.devices.removeTokens(dead);
  }
}
