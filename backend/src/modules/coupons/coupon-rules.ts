import { randomInt } from 'node:crypto';
import { DiscountType } from '../../common/enums/index.js';
import type { CouponEntity } from '../../models/schemas/coupon.schema.js';

export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

export const normalizeCouponCode = (code: string): string => code.trim().toUpperCase();

/**
 * Discount in piasters, never more than the subtotal.
 *  PERCENTAGE:   floor(subtotal * value / 100), capped at maxDiscountAmount
 *  FIXED_AMOUNT: min(value, subtotal)
 */
export function calculateDiscount(
  coupon: Pick<CouponEntity, 'discountType' | 'discountValue' | 'maxDiscountAmount'>,
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;
  if (coupon.discountType === DiscountType.PERCENTAGE) {
    let discount = Math.floor((subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount !== null) discount = Math.min(discount, coupon.maxDiscountAmount);
    return Math.min(discount, subtotal);
  }
  return Math.min(coupon.discountValue, subtotal);
}

export type CouponStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE' | 'EXHAUSTED';

export function couponStatus(coupon: CouponEntity, now = new Date()): CouponStatus {
  if (!coupon.isActive) return 'INACTIVE';
  if (coupon.expiresAt < now) return 'EXPIRED';
  if (coupon.startsAt > now) return 'SCHEDULED';
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 'EXHAUSTED';
  return 'ACTIVE';
}

/** Rules that need both fields; used on create and on the merged PATCH result. */
export function couponShapeError(c: {
  discountType: DiscountType;
  discountValue: number;
  startsAt: Date;
  expiresAt: Date;
}): string | null {
  if (c.discountType === DiscountType.PERCENTAGE && (c.discountValue < 1 || c.discountValue > 100)) {
    return 'A percentage discount must be between 1 and 100';
  }
  if (c.expiresAt <= c.startsAt) return 'expiresAt must be after startsAt';
  return null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Random code from an unambiguous alphabet: randomCode('PTS-', [8]) -> "PTS-7KQ2MXA9". */
export function randomCode(prefix: string, groups: number[], separator = '-'): string {
  return (
    prefix +
    groups
      .map((n) => Array.from({ length: n }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''))
      .join(separator)
  );
}
