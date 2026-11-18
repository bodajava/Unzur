import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import { GIFT_CARD_ADMIN_INCLUDE, type GiftCardAdminRow, type GiftCardEntity } from '../schemas/gift-card.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class GiftCardRepository extends BaseRepository<
  GiftCardEntity,
  Prisma.GiftCardWhereInput,
  Prisma.GiftCardWhereUniqueInput,
  Prisma.GiftCardUncheckedCreateInput,
  Prisma.GiftCardUncheckedUpdateInput,
  Prisma.GiftCardOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.giftCard;
  }

  findByCode(code: string): Promise<GiftCardEntity | null> {
    return this.db.giftCard.findUnique({ where: { code } });
  }

  /** Takes `amount` off the balance only if it is still there. False = balance changed meanwhile. */
  async debit(id: string, amount: number): Promise<boolean> {
    const { count } = await this.db.giftCard.updateMany({
      where: { id, isActive: true, currentBalance: { gte: amount } },
      data: { currentBalance: { decrement: amount } },
    });
    return count === 1;
  }

  async credit(id: string, amount: number): Promise<void> {
    await this.db.giftCard.update({ where: { id }, data: { currentBalance: { increment: amount } } });
  }

  /** Activates a purchased card once (false if it was already active). */
  async activateIfPending(id: string): Promise<boolean> {
    const { count } = await this.db.giftCard.updateMany({ where: { id, isActive: false }, data: { isActive: true } });
    return count === 1;
  }

  async paginateAdmin(where: Prisma.GiftCardWhereInput, page: number, limit: number): Promise<Paginated<GiftCardAdminRow>> {
    const [items, total] = await Promise.all([
      this.db.giftCard.findMany({
        where,
        include: GIFT_CARD_ADMIN_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.giftCard.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  findAdminById(id: string): Promise<GiftCardAdminRow | null> {
    return this.db.giftCard.findUnique({ where: { id }, include: GIFT_CARD_ADMIN_INCLUDE });
  }

  findPurchasedBy(userId: string): Promise<GiftCardAdminRow[]> {
    return this.db.giftCard.findMany({
      where: { purchasedById: userId },
      include: GIFT_CARD_ADMIN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 20.2 Purchased cards never paid (no captured payment) created before `cutoff`. */
  findAbandonedUnpaid(cutoff: Date, take: number): Promise<GiftCardEntity[]> {
    return this.db.giftCard.findMany({
      where: {
        isActive: false,
        purchasedById: { not: null },
        createdAt: { lt: cutoff },
        payments: { none: { status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } },
      },
      take,
    });
  }

  /** Deletes an unpaid card and its failed/pending payment attempts (call in a transaction). */
  async deleteUnpaid(id: string): Promise<void> {
    await this.db.payment.deleteMany({ where: { giftCardId: id, status: { in: ['PENDING', 'FAILED'] } } });
    await this.db.giftCard.delete({ where: { id } });
  }
}
