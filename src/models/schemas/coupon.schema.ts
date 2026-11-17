import type { Coupon, Prisma } from '../../generated/prisma/client.js';

export type { Coupon };

/** Row shape returned by default queries. */
export type CouponEntity = Coupon;

export type CouponWithUsageCount = Prisma.CouponGetPayload<{
  include: { _count: { select: { usages: true } } };
}>;

export const COUPON_SORT_FIELDS = ['createdAt', 'code', 'expiresAt', 'startsAt', 'usedCount'] as const;
