import type { CouponUsage } from '../../generated/prisma/client.js';

export type { CouponUsage };

/** Row shape returned by default queries. */
export type CouponUsageEntity = CouponUsage;

/** Identity a coupon's per-user limit is counted against. */
export interface CouponRedeemer {
  userId?: string;
  guestId?: string;
  email?: string;
}
