import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';

import {
  CART_DETAIL_INCLUDE,
  type CartDetailRow,
  type CartEntity,
  type CartOwner,
  type CartWithItems,
} from '../schemas/cart.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class CartRepository extends BaseRepository<
  CartEntity,
  Prisma.CartWhereInput,
  Prisma.CartWhereUniqueInput,
  Prisma.CartUncheckedCreateInput,
  Prisma.CartUncheckedUpdateInput,
  Prisma.CartOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.cart;
  }

  findByGuestIdWithItems(guestId: string): Promise<CartWithItems | null> {
    return this.db.cart.findUnique({ where: { guestId }, include: { items: true } });
  }

  findByUserId(userId: string): Promise<CartEntity | null> {
    return this.db.cart.findUnique({ where: { userId } });
  }

  findByUserIdWithItems(userId: string): Promise<CartWithItems | null> {
    return this.db.cart.findUnique({ where: { userId }, include: { items: true } });
  }

  private ownerWhere(owner: CartOwner): Prisma.CartWhereUniqueInput {
    if (owner.userId) return { userId: owner.userId };
    if (owner.guestId) return { guestId: owner.guestId };
    throw new Error('Cart owner needs a userId or guestId');
  }

  findDetailByOwner(owner: CartOwner): Promise<CartDetailRow | null> {
    return this.db.cart.findUnique({ where: this.ownerWhere(owner), include: CART_DETAIL_INCLUDE });
  }

  findByOwner(owner: CartOwner): Promise<CartEntity | null> {
    return this.db.cart.findUnique({ where: this.ownerWhere(owner) });
  }

  /**
   * Get or create the owner's cart. Upsert on the unique userId/guestId,
   * so two concurrent first adds cannot create two carts.
   */
  upsertForOwner(owner: CartOwner): Promise<CartEntity> {
    return this.db.cart.upsert({
      where: this.ownerWhere(owner),
      create: owner.userId ? { userId: owner.userId } : { guestId: owner.guestId },
      update: {},
    });
  }

  /**
   * 20.1 Carts of active, verified customers whose last item change is older
   * than `cutoff` (cart rows are not touched when items change).
   */
  async findAbandoned(cutoff: Date, take: number) {
    const rows = await this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT c.id AS cart_id, u.id AS user_id, u.email, u.first_name, MAX(ci.updated_at) AS last_activity
      FROM carts c
      JOIN users u ON u.id = c.user_id AND u.is_active AND u.is_email_verified
      JOIN cart_items ci ON ci.cart_id = c.id
      GROUP BY c.id, u.id
      HAVING MAX(ci.updated_at) < ${cutoff}
      ORDER BY last_activity ASC
      LIMIT ${take}`;
    return rows.map((r) => ({
      cartId: String(r.cart_id),
      userId: String(r.user_id),
      email: String(r.email),
      firstName: String(r.first_name),
    }));
  }
}
