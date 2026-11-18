import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { CouponUsageEntity } from '../schemas/coupon-usage.schema.js';
import { BaseRepository } from './base.repository.js';
import type { CouponRedeemer } from '../schemas/coupon-usage.schema.js';

@Injectable()
export class CouponUsageRepository extends BaseRepository<
  CouponUsageEntity,
  Prisma.CouponUsageWhereInput,
  Prisma.CouponUsageWhereUniqueInput,
  Prisma.CouponUsageUncheckedCreateInput,
  Prisma.CouponUsageUncheckedUpdateInput,
  Prisma.CouponUsageOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.couponUsage;
  }

  /** Times this person used the coupon (by user id, guest id or email). */
  countForRedeemer(couponId: string, who: CouponRedeemer): Promise<number> {
    const or: Prisma.CouponUsageWhereInput[] = [];
    if (who.userId) or.push({ userId: who.userId });
    if (who.guestId) or.push({ guestId: who.guestId });
    if (who.email) or.push({ customerEmail: { equals: who.email, mode: 'insensitive' } });
    if (!or.length) return Promise.resolve(0);
    return this.db.couponUsage.count({ where: { couponId, OR: or } });
  }
}
