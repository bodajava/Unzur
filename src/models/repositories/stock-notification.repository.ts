import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { StockNotificationEntity } from '../schemas/stock-notification.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class StockNotificationRepository extends BaseRepository<
  StockNotificationEntity,
  Prisma.StockNotificationWhereInput,
  Prisma.StockNotificationWhereUniqueInput,
  Prisma.StockNotificationUncheckedCreateInput,
  Prisma.StockNotificationUncheckedUpdateInput,
  Prisma.StockNotificationOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.stockNotification;
  }

  /** A request for this email + product/variant that was not sent yet. */
  findPending(email: string, productId: string, variantId: string | null) {
    return this.db.stockNotification.findFirst({
      where: { email, productId, variantId, notifiedAt: null },
    });
  }

  /** 20.3 Requests not sent yet whose product (or chosen variant) is back in stock. */
  findReady(take: number) {
    const live = { isActive: true, deletedAt: null };
    return this.db.stockNotification.findMany({
      where: {
        notifiedAt: null,
        OR: [
          { variantId: null, product: { ...live, stock: { gt: 0 } } },
          { variant: { isActive: true, stock: { gt: 0 } }, product: live },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take,
      select: {
        id: true,
        email: true,
        product: { select: { name: true, slug: true } },
        variant: { select: { name: true } },
      },
    });
  }

  /** Claims rows still pending; returns how many this call marked. */
  async markNotified(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const { count } = await this.db.stockNotification.updateMany({
      where: { id: { in: ids }, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    return count;
  }
}
