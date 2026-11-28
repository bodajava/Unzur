#!/usr/bin/env node
/**
 * Clears test activity from the store before launch.
 *
 * KEEPS: products (photos, versions, prices, stock, descriptions), categories,
 *        brands, coupons (use counts reset to 0), gift cards, the prize wheel,
 *        the scrolling text and all store settings, delivery zones,
 *        newsletter subscribers, and every staff/admin account.
 * DELETES: all orders (items, history, payments, coupon uses), customer
 *        accounts (addresses, carts, wishlists, points, referrals, reviews,
 *        devices), guest carts, product views, back-in-stock requests,
 *        contact messages, and the audit log.
 *
 *   RESET_DATABASE_URL="postgresql://…" npm run reset:launch            # dry run: counts only
 *   RESET_DATABASE_URL="postgresql://…" npm run reset:launch -- --apply # backup, confirm, delete
 *
 * With --apply a full backup is written to backups/ first (scripts/db-backup.sh);
 * if the backup fails nothing is deleted. Everything runs in one transaction.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const raw = process.env.RESET_DATABASE_URL;
if (!raw) {
  console.error('Set RESET_DATABASE_URL to the database to clear (it is never read from .env on purpose).');
  process.exit(1);
}
const url = raw.split('?')[0];
const host = new URL(url).hostname;

/** [label, SQL that deletes it, SQL that counts it] in a foreign-key-safe order. */
const STEPS = [
  ['Order payments', `DELETE FROM payments WHERE order_id IS NOT NULL`, `SELECT count(*) FROM payments WHERE order_id IS NOT NULL`],
  ['Orders (+ items, history, coupon uses)', `DELETE FROM orders`, `SELECT count(*) FROM orders`],
  ['Reviews', `DELETE FROM reviews`, `SELECT count(*) FROM reviews`],
  ['Customer accounts (+ addresses, carts, wishlists, points, referrals, devices)', `DELETE FROM users WHERE role = 'CUSTOMER'`, `SELECT count(*) FROM users WHERE role = 'CUSTOMER'`],
  ['Guest carts', `DELETE FROM carts`, `SELECT count(*) FROM carts`],
  ['Loyalty history left over', `DELETE FROM loyalty_transactions`, `SELECT count(*) FROM loyalty_transactions`],
  ['Referrals left over', `DELETE FROM referrals`, `SELECT count(*) FROM referrals`],
  ['Product views (analytics)', `DELETE FROM product_views`, `SELECT count(*) FROM product_views`],
  ['Recently viewed', `DELETE FROM recently_viewed`, `SELECT count(*) FROM recently_viewed`],
  ['Back-in-stock requests', `DELETE FROM stock_notifications`, `SELECT count(*) FROM stock_notifications`],
  ['Contact messages', `DELETE FROM contact_messages`, `SELECT count(*) FROM contact_messages`],
  ['One-time codes', `DELETE FROM otps`, `SELECT count(*) FROM otps`],
  ['Audit log', `DELETE FROM audit_logs`, `SELECT count(*) FROM audit_logs`],
];

const KEPT = [
  ['Products', `SELECT count(*) FROM products WHERE deleted_at IS NULL`],
  ['Product versions', `SELECT count(*) FROM product_variants`],
  ['Product photos', `SELECT count(*) FROM product_images`],
  ['Categories', `SELECT count(*) FROM categories`],
  ['Brands', `SELECT count(*) FROM brands`],
  ['Coupons (use counts reset to 0)', `SELECT count(*) FROM coupons`],
  ['Gift cards', `SELECT count(*) FROM gift_cards`],
  ['Store settings (wheel, scrolling text, …)', `SELECT count(*) FROM settings`],
  ['Delivery zones', `SELECT count(*) FROM shipping_zones`],
  ['Newsletter subscribers', `SELECT count(*) FROM subscribers`],
  ['Staff / admin accounts', `SELECT count(*) FROM users WHERE role <> 'CUSTOMER'`],
];

const db = new pg.Client({ connectionString: url });
await db.connect();
const count = async (sql) => Number((await db.query(sql)).rows[0].count);

console.log(`\nDatabase on ${host}\n\nWILL BE DELETED:`);
for (const [label, , sql] of STEPS) console.log(`  ${String(await count(sql)).padStart(7)}  ${label}`);
console.log('\nKEPT:');
for (const [label, sql] of KEPT) console.log(`  ${String(await count(sql)).padStart(7)}  ${label}`);

if (!apply) {
  console.log('\nDry run: nothing was changed. Add --apply to back up and delete.\n');
  await db.end();
  process.exit(0);
}

console.log('\nBacking up first…');
const backup = spawnSync('bash', ['scripts/db-backup.sh'], {
  stdio: 'inherit',
  env: { ...process.env, BACKUP_DATABASE_URL: raw, KEEP: '30' },
});
if (backup.status !== 0) {
  console.error('Backup failed: nothing was deleted.');
  await db.end();
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const answer = (await rl.question(`\nThis permanently deletes the rows above on ${host}. Type the host name to continue: `)).trim();
rl.close();
if (answer !== host) {
  console.log('Cancelled: nothing was deleted.');
  await db.end();
  process.exit(1);
}

try {
  await db.query('BEGIN');
  for (const [label, sql] of STEPS) {
    const res = await db.query(sql);
    console.log(`  deleted ${String(res.rowCount).padStart(7)}  ${label}`);
  }
  const reset = await db.query(`UPDATE coupons SET used_count = 0 WHERE used_count <> 0`);
  console.log(`  reset   ${String(reset.rowCount).padStart(7)}  coupon use counts`);
  await db.query('COMMIT');
  console.log('\nDone. The store is clear; products and marketing are untouched.\n');
} catch (error) {
  await db.query('ROLLBACK');
  console.error(`\nSomething failed, everything was rolled back (nothing deleted): ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await db.end();
}
