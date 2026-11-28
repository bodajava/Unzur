import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

/** Settings key that records a finished launch reset (it never runs twice on one database). */
export const LAUNCH_RESET_KEY = 'launch_reset';

/** Tables copied to the launch_backup schema before anything is deleted (restorable by hand). */
const BACKED_UP = [
  'payments', 'orders', 'order_items', 'order_status_history', 'coupon_usages', 'coupons',
  'reviews', 'users', 'addresses', 'carts', 'cart_items', 'wishlist_items', 'loyalty_transactions',
  'referrals', 'push_devices', 'refresh_tokens', 'recently_viewed', 'product_views',
  'stock_notifications', 'contact_messages', 'otps', 'audit_logs',
] as const;

/** [label, statement] in a foreign-key-safe order. */
const DELETES: [string, string][] = [
  ['orderPayments', `DELETE FROM payments WHERE order_id IS NOT NULL`],
  ['orders', `DELETE FROM orders`],
  ['reviews', `DELETE FROM reviews`],
  ['customers', `DELETE FROM users WHERE role = 'CUSTOMER'`],
  ['carts', `DELETE FROM carts`],
  ['loyalty', `DELETE FROM loyalty_transactions`],
  ['referrals', `DELETE FROM referrals`],
  ['productViews', `DELETE FROM product_views`],
  ['recentlyViewed', `DELETE FROM recently_viewed`],
  ['stockRequests', `DELETE FROM stock_notifications`],
  ['messages', `DELETE FROM contact_messages`],
  ['codes', `DELETE FROM otps`],
  ['auditLog', `DELETE FROM audit_logs`],
  ['couponUseCounts', `UPDATE coupons SET used_count = 0 WHERE used_count <> 0`],
];

export type LaunchResetResult = { ran: false; reason: string } | { ran: true; counts: Record<string, number> };

@Injectable()
export class LaunchResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clears test activity once: orders, customers and their data, reviews,
   * analytics, messages, codes and the audit log. Products, categories,
   * brands, coupons, gift cards, settings (wheel, scrolling text), delivery
   * zones, subscribers and staff accounts stay. One transaction under an
   * advisory lock, so two starting servers can't both run it.
   */
  async runOnce(resetId: string): Promise<LaunchResetResult> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('${LAUNCH_RESET_KEY}'))`);
        const done = await tx.$queryRawUnsafe<{ value: { id?: string } }[]>(
          `SELECT value FROM settings WHERE key = $1`,
          LAUNCH_RESET_KEY,
        );
        if (done.length) return { ran: false, reason: `already done (${done[0].value?.id ?? '?'})` } as const;

        await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS launch_backup`);
        for (const table of BACKED_UP) {
          await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS launch_backup.${table}`);
          await tx.$executeRawUnsafe(`CREATE TABLE launch_backup.${table} AS SELECT * FROM public.${table}`);
        }

        const counts: Record<string, number> = {};
        for (const [label, sql] of DELETES) counts[label] = await tx.$executeRawUnsafe(sql);

        await tx.$executeRawUnsafe(
          `INSERT INTO settings (id, key, value, is_public, updated_at) VALUES (gen_random_uuid(), $1, $2::jsonb, false, now())`,
          LAUNCH_RESET_KEY,
          JSON.stringify({ id: resetId, at: new Date().toISOString(), counts, backupSchema: 'launch_backup' }),
        );
        return { ran: true, counts } as const;
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  }
}
