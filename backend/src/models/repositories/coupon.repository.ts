import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { CouponEntity, CouponWithUsageCount } from '../schemas/coupon.schema.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class CouponRepository extends BaseRepository<
  CouponEntity,
  Prisma.CouponWhereInput,
  Prisma.CouponWhereUniqueInput,
  Prisma.CouponUncheckedCreateInput,
  Prisma.CouponUncheckedUpdateInput,
  Prisma.CouponOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.coupon;
  }

  findByCode(code: string): Promise<CouponEntity | null> {
    return this.db.coupon.findUnique({ where: { code } });
  }

  async paginateWithUsage(
    where: Prisma.CouponWhereInput,
    page: number,
    limit: number,
    orderBy: Prisma.CouponOrderByWithRelationInput[],
  ): Promise<Paginated<CouponWithUsageCount>> {
    const [items, total] = await Promise.all([
      this.db.coupon.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { usages: true } } },
      }),
      this.db.coupon.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  /** usedCount + 1 unless the global limit is reached (atomic). False = limit reached. */
  async incrementUsage(id: string): Promise<boolean> {
    const count = await this.db.$executeRaw`
      UPDATE coupons SET used_count = used_count + 1, updated_at = now()
      WHERE id = ${id}::uuid AND (usage_limit IS NULL OR used_count < usage_limit)`;
    return count === 1;
  }

  async decrementUsage(id: string): Promise<void> {
    await this.db.$executeRaw`
      UPDATE coupons SET used_count = GREATEST(used_count - 1, 0), updated_at = now()
      WHERE id = ${id}::uuid`;
  }
}
