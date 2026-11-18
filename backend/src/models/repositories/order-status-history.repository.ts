import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { OrderStatusHistoryEntity } from '../schemas/order-status-history.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class OrderStatusHistoryRepository extends BaseRepository<
  OrderStatusHistoryEntity,
  Prisma.OrderStatusHistoryWhereInput,
  Prisma.OrderStatusHistoryWhereUniqueInput,
  Prisma.OrderStatusHistoryUncheckedCreateInput,
  Prisma.OrderStatusHistoryUncheckedUpdateInput,
  Prisma.OrderStatusHistoryOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.orderStatusHistory;
  }

  findByOrder(orderId: string): Promise<OrderStatusHistoryEntity[]> {
    return this.db.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
  }
}
