import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { RecentlyViewedEntity } from '../schemas/recently-viewed.schema.js';
import { BaseRepository } from './base.repository.js';
import type { ViewerRef } from '../schemas/recently-viewed.schema.js';

@Injectable()
export class RecentlyViewedRepository extends BaseRepository<
  RecentlyViewedEntity,
  Prisma.RecentlyViewedWhereInput,
  Prisma.RecentlyViewedWhereUniqueInput,
  Prisma.RecentlyViewedUncheckedCreateInput,
  Prisma.RecentlyViewedUncheckedUpdateInput,
  Prisma.RecentlyViewedOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.recentlyViewed;
  }

  private viewerWhere(viewer: ViewerRef): Prisma.RecentlyViewedWhereInput {
    return viewer.userId ? { userId: viewer.userId } : { guestId: viewer.guestId, userId: null };
  }

  /** One row per viewer + product: bump viewedAt, or insert. */
  async touch(productId: string, viewer: ViewerRef): Promise<void> {
    const updated = await this.db.recentlyViewed.updateMany({
      where: { productId, ...this.viewerWhere(viewer) },
      data: { viewedAt: new Date() },
    });
    if (updated.count === 0) {
      await this.db.recentlyViewed.create({
        data: { productId, userId: viewer.userId, guestId: viewer.userId ? undefined : viewer.guestId },
      });
    }
  }

  /** Product ids, most recent first (active products only). */
  async findRecentProductIds(viewer: ViewerRef, take: number): Promise<string[]> {
    const rows = await this.db.recentlyViewed.findMany({
      where: {
        ...this.viewerWhere(viewer),
        product: { isActive: true, deletedAt: null },
      },
      select: { productId: true },
      orderBy: { viewedAt: 'desc' },
      // over-fetch a little in case a race created duplicates
      take: take * 2,
    });
    return [...new Set(rows.map((r) => r.productId))].slice(0, take);
  }
}
