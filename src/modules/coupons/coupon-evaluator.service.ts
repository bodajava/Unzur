import { Injectable } from '@nestjs/common';
import { CouponUsageRepository } from '../../models/repositories/coupon-usage.repository.js';
import { CouponRepository } from '../../models/repositories/coupon.repository.js';
import type { CouponRedeemer } from '../../models/schemas/coupon-usage.schema.js';
import type { CouponEntity } from '../../models/schemas/coupon.schema.js';
import { calculateDiscount, normalizeCouponCode } from './coupon-rules.js';

export type CouponEvaluation =
  | { ok: true; coupon: CouponEntity; discountAmount: number }
  | { ok: false; reason: string; coupon?: CouponEntity };

/**
 * Checks a coupon against a subtotal and a customer. Shared by
 * POST /coupons/validate and the live cart total (3.1), and later checkout.
 */
@Injectable()
export class CouponEvaluator {
  constructor(
    private readonly coupons: CouponRepository,
    private readonly usages: CouponUsageRepository,
  ) {}

  async evaluate(
    rawCode: string,
    subtotal: number,
    who: CouponRedeemer,
    now = new Date(),
  ): Promise<CouponEvaluation> {
    const coupon = await this.coupons.findByCode(normalizeCouponCode(rawCode));
    // Unknown and disabled codes look the same (no code enumeration).
    if (!coupon?.isActive) return { ok: false, reason: 'Invalid coupon code' };
    if (coupon.startsAt > now) return { ok: false, coupon, reason: 'This coupon is not active yet' };
    if (coupon.expiresAt < now) return { ok: false, coupon, reason: 'This coupon has expired' };
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { ok: false, coupon, reason: 'This coupon has reached its usage limit' };
    }
    if ((await this.usages.countForRedeemer(coupon.id, who)) >= coupon.perUserLimit) {
      return { ok: false, coupon, reason: 'You have already used this coupon' };
    }
    if (subtotal < coupon.minOrderAmount) {
      return {
        ok: false,
        coupon,
        reason: `Minimum order amount for this coupon is ${coupon.minOrderAmount} piasters`,
      };
    }
    return { ok: true, coupon, discountAmount: calculateDiscount(coupon, subtotal) };
  }
}
