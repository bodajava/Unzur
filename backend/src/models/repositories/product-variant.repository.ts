import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { ProductVariantEntity } from '../schemas/product-variant.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class ProductVariantRepository extends BaseRepository<
  ProductVariantEntity,
  Prisma.ProductVariantWhereInput,
  Prisma.ProductVariantWhereUniqueInput,
  Prisma.ProductVariantUncheckedCreateInput,
  Prisma.ProductVariantUncheckedUpdateInput,
  Prisma.ProductVariantOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.productVariant;
  }

  findByIdWithProduct(id: string) {
    return this.db.productVariant.findUnique({
      where: { id },
      include: { product: { select: { id: true, deletedAt: true } } },
    });
  }

  /** Any active variant of the product with stock left. */
  async hasStock(productId: string): Promise<boolean> {
    const row = await this.db.productVariant.findFirst({
      where: { productId, isActive: true, stock: { gt: 0 } },
      select: { id: true },
    });
    return !!row;
  }

  /** Of the given products, the ones with an active variant in stock (one query for a whole list). */
  async productIdsWithStock(productIds: string[]): Promise<Set<string>> {
    if (!productIds.length) return new Set();
    const rows = await this.db.productVariant.findMany({
      where: { productId: { in: productIds }, isActive: true, stock: { gt: 0 } },
      select: { productId: true },
      distinct: ['productId'],
    });
    return new Set(rows.map((r) => r.productId));
  }

  /**
   * SELECT ... FOR UPDATE on the given rows, in ascending id order. Every
   * caller locks products before variants and always in id order, so two
   * checkouts touching the same rows queue up instead of deadlocking.
   * Must run inside a transaction.
   */
  lockForUpdate(ids: string[]) {
    const sorted = [...new Set(ids)].sort();
    if (!sorted.length) return Promise.resolve([]);
    return this.db.$queryRaw<
      { id: string; product_id: string; name: string; stock: number; is_active: boolean }[]
    >`
      SELECT id, product_id, name, stock, is_active
      FROM product_variants
      WHERE id IN (${Prisma.join(sorted.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id
      FOR UPDATE`;
  }

  async decrementStock(id: string, quantity: number): Promise<boolean> {
    const { count } = await this.db.productVariant.updateMany({
      where: { id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    return count === 1;
  }

  async incrementStock(id: string, quantity: number): Promise<void> {
    await this.db.productVariant.update({ where: { id }, data: { stock: { increment: quantity } } });
  }
}
