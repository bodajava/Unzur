import { Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { WishlistItemRepository } from '../../models/repositories/wishlist-item.repository.js';
import { toCard } from '../products/entities/product.entity.js';
import type { WishlistChangeModel, WishlistItemModel } from './entities/wishlist.model.js';

@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlist: WishlistItemRepository,
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
  ) {}

  /** 11.1 */
  async list(userId: string, page: number, limit: number): Promise<Paginated<WishlistItemModel>> {
    const result = await this.wishlist.paginateForUser(userId, page, limit);
    const items = await Promise.all(
      result.items.map(async (row) => {
        const { isActive, deletedAt: _deletedAt, ...card } = row.product;
        const inStock = card.stock > 0 || (await this.variants.hasStock(row.productId));
        return {
          id: row.id,
          productId: row.productId,
          addedAt: row.createdAt,
          product: toCard(card),
          isAvailable: isActive,
          inStock: isActive && inStock,
        };
      }),
    );
    return { items, meta: result.meta };
  }

  /** 11.2 Idempotent. */
  async add(userId: string, productId: string): Promise<WishlistChangeModel> {
    if (!(await this.products.findPublicById(productId))) throw new NotFoundException('Product not found');
    const changed = await this.wishlist.add(userId, productId);
    return { productId, inWishlist: true, changed };
  }

  /** 11.3 Idempotent. */
  async remove(userId: string, productId: string): Promise<WishlistChangeModel> {
    const changed = await this.wishlist.remove(userId, productId);
    return { productId, inWishlist: false, changed };
  }
}
