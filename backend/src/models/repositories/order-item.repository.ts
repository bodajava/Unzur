import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { OrderItemEntity } from '../schemas/order-item.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class OrderItemRepository extends BaseRepository<
  OrderItemEntity,
  Prisma.OrderItemWhereInput,
  Prisma.OrderItemWhereUniqueInput,
  Prisma.OrderItemUncheckedCreateInput,
  Prisma.OrderItemUncheckedUpdateInput,
  Prisma.OrderItemOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.orderItem;
  }

  async existsForVariant(variantId: string): Promise<boolean> {
    const row = await this.db.orderItem.findFirst({ where: { variantId }, select: { id: true } });
    return !!row;
  }
}
