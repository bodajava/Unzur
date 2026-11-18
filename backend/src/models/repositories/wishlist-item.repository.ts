import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { DbClient } from '../prisma.service.js';
import {
  WISHLIST_ITEM_SELECT,
  type WishlistItemEntity,
  type WishlistItemRow,
} from '../schemas/wishlist-item.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class WishlistItemRepository extends BaseRepository<
  WishlistItemEntity,
  Prisma.WishlistItemWhereInput,
  Prisma.WishlistItemWhereUniqueInput,
  Prisma.WishlistItemUncheckedCreateInput,
  Prisma.WishlistItemUncheckedUpdateInput,
  Prisma.WishlistItemOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.wishlistItem;
  }

  async paginateForUser(userId: string, page: number, limit: number): Promise<Paginated<WishlistItemRow>> {
    // Deleted products disappear from the list; hidden ones stay (shown as unavailable).
    const where = { userId, product: { deletedAt: null } };
    const [items, total] = await Promise.all([
      this.db.wishlistItem.findMany({
        where,
        select: WISHLIST_ITEM_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.wishlistItem.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  /** Idempotent add. Returns true when a new row was created. */
  async add(userId: string, productId: string): Promise<boolean> {
    const existing = await this.db.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
    if (existing) return false;
    await this.db.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return true;
  }

  async remove(userId: string, productId: string): Promise<boolean> {
    const { count } = await this.db.wishlistItem.deleteMany({ where: { userId, productId } });
    return count > 0;
  }
}
