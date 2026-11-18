import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { LoyaltyTransactionEntity } from '../schemas/loyalty-transaction.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class LoyaltyTransactionRepository extends BaseRepository<
  LoyaltyTransactionEntity,
  Prisma.LoyaltyTransactionWhereInput,
  Prisma.LoyaltyTransactionWhereUniqueInput,
  Prisma.LoyaltyTransactionUncheckedCreateInput,
  Prisma.LoyaltyTransactionUncheckedUpdateInput,
  Prisma.LoyaltyTransactionOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.loyaltyTransaction;
  }

  /** Net points of one type booked against an order (redeemed are negative). */
  async sumForOrder(orderId: string, type: LoyaltyTransactionEntity['type']): Promise<number> {
    const agg = await this.db.loyaltyTransaction.aggregate({
      where: { orderId, type },
      _sum: { points: true },
    });
    return agg._sum.points ?? 0;
  }
}
