import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { CartItemEntity } from '../schemas/cart-item.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class CartItemRepository extends BaseRepository<
  CartItemEntity,
  Prisma.CartItemWhereInput,
  Prisma.CartItemWhereUniqueInput,
  Prisma.CartItemUncheckedCreateInput,
  Prisma.CartItemUncheckedUpdateInput,
  Prisma.CartItemOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.cartItem;
  }

  /**
   * The line for (cart, product, variant). variantId null matches "no variant"
   * (IS NULL), the same rule as the NULLS NOT DISTINCT unique index, so this
   * finds the row that a second insert would collide with.
   */
  findLine(cartId: string, productId: string, variantId: string | null): Promise<CartItemEntity | null> {
    return this.db.cartItem.findFirst({ where: { cartId, productId, variantId } });
  }

  incrementQuantity(id: string, by: number): Promise<CartItemEntity> {
    return this.db.cartItem.update({ where: { id }, data: { quantity: { increment: by } } });
  }

  moveToCart(id: string, cartId: string): Promise<CartItemEntity> {
    return this.db.cartItem.update({ where: { id }, data: { cartId } });
  }

  /** Locks the line (FOR UPDATE) so concurrent adds to the same line serialize. Use inside a transaction. */
  async lockLine(cartId: string, productId: string, variantId: string | null): Promise<CartItemEntity | null> {
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      SELECT id FROM cart_items
      WHERE cart_id = ${cartId}::uuid
        AND product_id = ${productId}::uuid
        AND variant_id IS NOT DISTINCT FROM ${variantId}::uuid
      FOR UPDATE`;
    return rows[0] ? this.db.cartItem.findUnique({ where: { id: rows[0].id } }) : null;
  }

  /** The item only if it is in this cart (ownership check). */
  findInCart(id: string, cartId: string): Promise<CartItemEntity | null> {
    return this.db.cartItem.findFirst({ where: { id, cartId } });
  }
}
