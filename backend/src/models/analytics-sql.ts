import { Prisma } from '../generated/prisma/client.js';

/** Orders that count as sales (paid or committed, not cancelled/refunded/unpaid). */
export const SOLD_STATUSES = ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const;
export const SOLD_SQL = Prisma.raw(`('CONFIRMED','PREPARING','SHIPPED','DELIVERED')`);

/** One customer = their user id, or their lowercased email when they ordered as a guest. */
export const IDENTITY_SQL = Prisma.raw('COALESCE(o.user_id::text, lower(o.customer_email))');

/** Cancellations caused by the payment timeout job are not customer feedback. */
export const PAYMENT_TIMEOUT_REASON = 'PAYMENT_TIMEOUT';

/** BigInt/Decimal/null from raw SQL -> number. */
export const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));

export type Granularity = 'day' | 'week' | 'month';
export const GRANULARITIES: readonly Granularity[] = ['day', 'week', 'month'];

/** Business time zone for date buckets. */
export const STORE_TZ = 'Africa/Cairo';
