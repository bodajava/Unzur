import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runInBackground } from '../../common/utilities/background.js';
import { RedisService } from '../../common/utilities/caching/redis.service.js';
import { EmailService } from '../../common/utilities/email/email.service.js';
import { CartRepository } from '../../models/repositories/cart.repository.js';
import { GiftCardRepository } from '../../models/repositories/gift-card.repository.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { StockNotificationRepository } from '../../models/repositories/stock-notification.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { OrdersService } from '../orders/orders.service.js';
import { SETTING_DEFAULTS, SettingKey } from '../settings/setting-rules.js';
import { SettingsService } from '../settings/settings.service.js';

const MINUTE = 60_000;
const BATCH = 100;
export const REMINDER_TTL_SEC = 7 * 24 * 60 * 60;

/**
 * 20.1–20.3 background jobs. Each run takes a Redis lock first so only one
 * server instance does the work per tick. DISABLE_CRON=true turns the
 * schedules off (tests call the process* methods directly).
 */
export const AUTOMATION_JOBS = ['expire-unpaid', 'back-in-stock', 'abandoned-carts'] as const;
export type AutomationJob = (typeof AUTOMATION_JOBS)[number];

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private readonly disabled: boolean;
  private readonly frontendUrl: string;

  constructor(
    private readonly orders: OrderRepository,
    private readonly ordersService: OrdersService,
    private readonly giftCards: GiftCardRepository,
    private readonly carts: CartRepository,
    private readonly stockNotifications: StockNotificationRepository,
    private readonly tx: TransactionManager,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    config: ConfigService,
  ) {
    this.disabled = config.get<string>('DISABLE_CRON') === 'true';
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
  }

  // ───────────── schedules ─────────────

  @Cron(CronExpression.EVERY_HOUR, { name: 'abandoned-carts' })
  abandonedCartsJob() {
    return this.locked('abandoned-carts', 50 * 60, () => this.processAbandonedCarts());
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'expire-unpaid' })
  expireUnpaidJob() {
    return this.locked('expire-unpaid', 9 * 60, () => this.processExpiredUnpaidOrders());
  }

  @Cron('0 */15 * * * *', { name: 'back-in-stock' }) // every 15 minutes
  backInStockJob() {
    return this.locked('back-in-stock', 14 * 60, () => this.processBackInStockNotifications());
  }

  // ───────────── 20.2 ─────────────

  /** Cancels unpaid online orders past the timeout and removes unpaid gift card purchases. */
  async processExpiredUnpaidOrders(now = new Date()): Promise<{ ordersExpired: number; giftCardsRemoved: number }> {
    const [orderMinutes, cardMinutes] = await Promise.all([
      this.setting(SettingKey.UNPAID_ORDER_EXPIRY_MINUTES),
      this.setting(SettingKey.UNPAID_GIFT_CARD_EXPIRY_MINUTES),
    ]);
    let ordersExpired = 0;
    for (const order of await this.orders.findExpiredPending(new Date(now.getTime() - orderMinutes * MINUTE), BATCH)) {
      try {
        if (await this.ordersService.expireUnpaid(order)) ordersExpired++;
      } catch (error) {
        this.logger.error(`Could not expire ${order.orderNumber}: ${(error as Error).message}`);
      }
    }
    let giftCardsRemoved = 0;
    for (const card of await this.giftCards.findAbandonedUnpaid(new Date(now.getTime() - cardMinutes * MINUTE), BATCH)) {
      try {
        await this.tx.run((tx) => this.giftCards.withTx(tx).deleteUnpaid(card.id));
        giftCardsRemoved++;
      } catch (error) {
        this.logger.error(`Could not remove unpaid gift card ${card.id}: ${(error as Error).message}`);
      }
    }
    if (ordersExpired || giftCardsRemoved) {
      this.logger.log(`Expired ${ordersExpired} unpaid orders, removed ${giftCardsRemoved} unpaid gift cards`);
    }
    return { ordersExpired, giftCardsRemoved };
  }

  // ───────────── 20.3 ─────────────

  /** Emails people who asked to be told when a product/variant is back. */
  async processBackInStockNotifications(): Promise<{ notified: number }> {
    const ready = await this.stockNotifications.findReady(BATCH * 2);
    if (!ready.length) return { notified: 0 };
    // Claim first (notifiedAt), then email in the background: a crash can lose an
    // email but never sends the same one twice.
    const notified = await this.stockNotifications.markNotified(ready.map((r) => r.id));
    for (const r of ready) {
      runInBackground('back-in-stock-email', () =>
        this.email.sendBackInStock(r.email, {
          productName: r.product.name,
          variantName: r.variant?.name,
          url: `${this.frontendUrl}/products/${encodeURIComponent(r.product.slug)}`,
        }),
      );
    }
    return { notified };
  }

  // ───────────── 20.1 ─────────────

  /** Reminds logged-in customers about carts untouched for abandoned_cart_hours (once per 7 days). */
  async processAbandonedCarts(now = new Date()): Promise<{ reminded: number; skipped: number }> {
    const hours = await this.setting(SettingKey.ABANDONED_CART_HOURS);
    const carts = await this.carts.findAbandoned(new Date(now.getTime() - hours * 60 * MINUTE), BATCH);
    let reminded = 0;
    let skipped = 0;
    for (const cart of carts) {
      if (!(await this.redis.setIfAbsent(`abandoned_reminded:${cart.cartId}`, 1, REMINDER_TTL_SEC))) {
        skipped++;
        continue;
      }
      const detail = await this.carts.findDetailByOwner({ userId: cart.userId });
      const items = (detail?.items ?? [])
        .filter((i) => i.product.isActive && !i.product.deletedAt)
        .map((i) => ({ name: i.variant ? `${i.product.name} (${i.variant.name})` : i.product.name, quantity: i.quantity }));
      if (!items.length) {
        skipped++;
        continue;
      }
      runInBackground('abandoned-cart-email', () =>
        this.email.sendAbandonedCart(cart.email, { firstName: cart.firstName, items, cartUrl: `${this.frontendUrl}/cart` }),
      );
      reminded++;
    }
    return { reminded, skipped };
  }

  // ───────────── internals ─────────────

  private setting(key: keyof typeof SETTING_DEFAULTS): Promise<number> {
    return this.settings.getInt(key, SETTING_DEFAULTS[key]);
  }

  /**
   * Runs one job now, for an external scheduler (Hostinger cron hitting
   * POST /automation/run/:job). Same Redis lock as the in-process schedule, so
   * the two never overlap; DISABLE_CRON only turns off the in-process timers.
   */
  async runNow(job: AutomationJob): Promise<{ job: AutomationJob; ran: boolean }> {
    const jobs: Record<AutomationJob, [number, () => Promise<unknown>]> = {
      'expire-unpaid': [9 * 60, () => this.processExpiredUnpaidOrders()],
      'back-in-stock': [14 * 60, () => this.processBackInStockNotifications()],
      'abandoned-carts': [50 * 60, () => this.processAbandonedCarts()],
    };
    const [ttl, work] = jobs[job];
    return { job, ran: await this.withLock(job, ttl, work) };
  }

  /** Runs `job` only if this instance gets the lock (lock:cron:<name>, expires on its own). */
  private async locked(name: string, ttlSeconds: number, job: () => Promise<unknown>): Promise<void> {
    if (this.disabled) return;
    await this.withLock(name, ttlSeconds, job);
  }

  private async withLock(name: string, ttlSeconds: number, job: () => Promise<unknown>): Promise<boolean> {
    try {
      if (!(await this.redis.setIfAbsent(`lock:cron:${name}`, 1, ttlSeconds))) return false;
    } catch (error) {
      // No Redis, no lock: skip rather than risk double processing.
      this.logger.warn(`Skipping ${name}: lock unavailable (${(error as Error).message})`);
      return false;
    }
    try {
      await job();
      return true;
    } catch (error) {
      this.logger.error(`Job ${name} failed: ${(error as Error).message}`);
      return false;
    }
  }
}
