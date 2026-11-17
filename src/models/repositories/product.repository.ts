import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { num, PAYMENT_TIMEOUT_REASON, SOLD_SQL } from '../analytics-sql.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import type { DbClient } from '../prisma.service.js';
import {
  PRODUCT_ADMIN_SELECT,
  PRODUCT_CARD_SELECT,
  PRODUCT_DETAIL_SELECT,
  PRODUCT_SUGGEST_SELECT,
  PUBLIC_PRODUCT_WHERE,
  type ProductAdminRow,
  type ProductCardRow,
  type ProductDetailRow,
  type ProductEntity,
  type ProductSuggestRow,
} from '../schemas/product.schema.js';
import { BaseRepository } from './base.repository.js';

type OrderBy = Prisma.ProductOrderByWithRelationInput;

/** Keeps rows in the same order as `ids` (raw queries return ranked ids). */
function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is T => !!r);
}

@Injectable()
export class ProductRepository extends BaseRepository<
  ProductEntity,
  Prisma.ProductWhereInput,
  Prisma.ProductWhereUniqueInput,
  Prisma.ProductUncheckedCreateInput,
  Prisma.ProductUncheckedUpdateInput,
  OrderBy
> {
  protected delegate(db: DbClient) {
    return db.product;
  }

  // ───────────── Public reads (never select costPrice / deletedAt) ─────────────

  async paginateCards(
    where: Prisma.ProductWhereInput,
    page: number,
    limit: number,
    orderBy: OrderBy[],
  ): Promise<Paginated<ProductCardRow>> {
    const fullWhere = { AND: [PUBLIC_PRODUCT_WHERE, where] };
    const [items, total] = await Promise.all([
      this.db.product.findMany({
        where: fullWhere,
        select: PRODUCT_CARD_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.product.count({ where: fullWhere }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  findPublicBySlug(slug: string): Promise<ProductDetailRow | null> {
    return this.db.product.findFirst({
      where: { slug, ...PUBLIC_PRODUCT_WHERE },
      select: PRODUCT_DETAIL_SELECT,
    });
  }

  findPublicById(id: string) {
    return this.db.product.findFirst({
      where: { id, ...PUBLIC_PRODUCT_WHERE },
      select: { id: true, categoryId: true, stock: true },
    });
  }

  /** Active cards for the given ids, in the same order as `ids`. */
  async findCardsByIds(ids: string[]): Promise<ProductCardRow[]> {
    if (!ids.length) return [];
    const rows = await this.db.product.findMany({
      where: { id: { in: ids }, ...PUBLIC_PRODUCT_WHERE },
      select: PRODUCT_CARD_SELECT,
    });
    return orderByIds(rows, ids);
  }

  /** Ids of active products matching `where`. */
  async findPublicIds(where: Prisma.ProductWhereInput, take: number): Promise<string[]> {
    const rows = await this.db.product.findMany({
      where: { AND: [PUBLIC_PRODUCT_WHERE, where] },
      select: { id: true },
      take,
    });
    return rows.map((r) => r.id);
  }

  findCards(where: Prisma.ProductWhereInput, take: number, orderBy: OrderBy[]): Promise<ProductCardRow[]> {
    return this.db.product.findMany({
      where: { AND: [PUBLIC_PRODUCT_WHERE, where] },
      select: PRODUCT_CARD_SELECT,
      orderBy,
      take,
    });
  }

  /** Other active products in the same category (newest, featured first). */
  findRelated(productId: string, categoryId: string, take: number): Promise<ProductCardRow[]> {
    return this.findCards({ categoryId, id: { not: productId } }, take, [
      { isFeatured: 'desc' },
      { createdAt: 'desc' },
    ]);
  }

  // ───────────── Full-text search (tsvector, 'simple' config) ─────────────

  /**
   * Ids of active products matching a prefix tsquery and/or a partial name
   * match, best rank first. `tsQuery` must come from toPrefixTsQuery() (letters
   * and digits only); values are bound parameters, never interpolated.
   */
  async searchIds(tsQuery: string | null, likePattern: string, limit: number): Promise<string[]> {
    const rows = tsQuery
      ? await this.db.$queryRaw<{ id: string }[]>`
          SELECT p.id
          FROM products p
          WHERE p.is_active = true
            AND p.deleted_at IS NULL
            AND (p.search_vector @@ to_tsquery('simple', ${tsQuery}) OR p.name ILIKE ${likePattern})
          ORDER BY ts_rank(p.search_vector, to_tsquery('simple', ${tsQuery})) DESC,
                   p.is_featured DESC, p.created_at DESC
          LIMIT ${limit}`
      : await this.db.$queryRaw<{ id: string }[]>`
          SELECT p.id
          FROM products p
          WHERE p.is_active = true
            AND p.deleted_at IS NULL
            AND p.name ILIKE ${likePattern}
          ORDER BY p.is_featured DESC, p.created_at DESC
          LIMIT ${limit}`;
    return rows.map((r) => r.id);
  }

  async suggest(tsQuery: string | null, likePattern: string, limit: number): Promise<ProductSuggestRow[]> {
    const ids = await this.searchIds(tsQuery, likePattern, limit);
    if (!ids.length) return [];
    const rows = await this.db.product.findMany({
      where: { id: { in: ids } },
      select: PRODUCT_SUGGEST_SELECT,
    });
    return orderByIds(rows, ids);
  }

  /**
   * "Customers also bought": products sharing orders with `productId`,
   * most shared orders first. Cancelled/refunded orders are ignored.
   */
  async findCoPurchasedIds(productId: string, limit: number): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      SELECT other.product_id AS id
      FROM order_items mine
      JOIN orders o ON o.id = mine.order_id
        AND o.status NOT IN ('CANCELLED', 'REFUNDED')
      JOIN order_items other ON other.order_id = mine.order_id
        AND other.product_id <> mine.product_id
      JOIN products p ON p.id = other.product_id
        AND p.is_active = true AND p.deleted_at IS NULL
      WHERE mine.product_id = ${productId}::uuid
      GROUP BY other.product_id
      ORDER BY COUNT(DISTINCT other.order_id) DESC, MAX(o.created_at) DESC
      LIMIT ${limit}`;
    return rows.map((r) => r.id);
  }

  // ───────────── Admin ─────────────

  async paginateAdmin(
    where: Prisma.ProductWhereInput,
    page: number,
    limit: number,
    orderBy: OrderBy[],
  ): Promise<Paginated<ProductAdminRow>> {
    const [items, total] = await Promise.all([
      this.db.product.findMany({
        where,
        select: PRODUCT_ADMIN_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.product.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  findAdminById(id: string): Promise<ProductAdminRow | null> {
    return this.db.product.findUnique({ where: { id }, select: PRODUCT_ADMIN_SELECT });
  }

  /** Not soft-deleted (may be inactive). */
  findLiveById(id: string): Promise<ProductEntity | null> {
    return this.db.product.findFirst({ where: { id, deletedAt: null } });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const row = await this.db.product.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!row;
  }

  async countLiveInCategory(categoryId: string): Promise<number> {
    return this.db.product.count({ where: { categoryId, deletedAt: null } });
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
      { id: string; name: string; stock: number; is_active: boolean; deleted_at: Date | null }[]
    >`
      SELECT id, name, stock, is_active, deleted_at
      FROM products
      WHERE id IN (${Prisma.join(sorted.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id
      FOR UPDATE`;
  }

  /** Decrements only when enough stock is left (never below 0). */
  async decrementStock(id: string, quantity: number): Promise<boolean> {
    const { count } = await this.db.product.updateMany({
      where: { id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    return count === 1;
  }

  async incrementStock(id: string, quantity: number): Promise<void> {
    await this.db.product.update({ where: { id }, data: { stock: { increment: quantity } } });
  }

  // ───────── Analytics (8.3 / 8.5 / 9.x / 19.x) ─────────

  /**
   * Per-product performance in [from, to). views from product_views; units and
   * revenue from sales; refunds/cancellations from closed orders (payment
   * timeouts excluded); rating from approved reviews. Money in piasters.
   */
  async performance(opts: {
    from: Date;
    to: Date;
    sortBy: 'revenue' | 'unitsSold' | 'conversionRate' | 'views' | 'refunds';
    desc: boolean;
    limit: number;
    productIds?: string[];
  }) {
    const sort = Prisma.raw(
      { revenue: 'revenue', unitsSold: 'units', conversionRate: 'conversion', views: 'views', refunds: 'refunds' }[opts.sortBy],
    );
    const dir = Prisma.raw(opts.desc ? 'DESC' : 'ASC');
    const only = opts.productIds?.length
      ? Prisma.sql`AND p.id IN (${Prisma.join(opts.productIds.map((id) => Prisma.sql`${id}::uuid`))})`
      : Prisma.empty;
    const rows = await this.db.$queryRaw<Record<string, unknown>[]>`
      WITH v AS (
        SELECT product_id, COUNT(*) AS views FROM product_views
        WHERE created_at >= ${opts.from} AND created_at < ${opts.to} GROUP BY product_id
      ), s AS (
        SELECT oi.product_id, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.price_at_purchase) AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status IN ${SOLD_SQL} AND o.created_at >= ${opts.from} AND o.created_at < ${opts.to}
        GROUP BY oi.product_id
      ), r AS (
        SELECT oi.product_id,
               COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'REFUNDED') AS refunds,
               COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'CANCELLED') AS cancellations
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status IN ('REFUNDED', 'CANCELLED')
          AND COALESCE(o.cancel_or_refund_reason, '') <> ${PAYMENT_TIMEOUT_REASON}
          AND o.created_at >= ${opts.from} AND o.created_at < ${opts.to}
        GROUP BY oi.product_id
      ), rv AS (
        SELECT product_id, AVG(rating) AS avg_rating, COUNT(*) AS reviews
        FROM reviews WHERE is_approved GROUP BY product_id
      ), var AS (
        SELECT product_id, SUM(stock) FILTER (WHERE is_active) AS variant_stock FROM product_variants GROUP BY product_id
      )
      SELECT p.id, p.name, p.slug, p.is_active, p.stock + COALESCE(var.variant_stock, 0) AS stock,
             p.low_stock_threshold, p.base_price, p.sale_price, p.cost_price,
             COALESCE(v.views, 0) AS views, COALESCE(s.units, 0) AS units, COALESCE(s.revenue, 0) AS revenue,
             COALESCE(r.refunds, 0) AS refunds, COALESCE(r.cancellations, 0) AS cancellations,
             rv.avg_rating, COALESCE(rv.reviews, 0) AS reviews,
             CASE WHEN COALESCE(v.views, 0) > 0 THEN COALESCE(s.units, 0)::float / v.views ELSE 0 END AS conversion
      FROM products p
      LEFT JOIN v ON v.product_id = p.id
      LEFT JOIN s ON s.product_id = p.id
      LEFT JOIN r ON r.product_id = p.id
      LEFT JOIN rv ON rv.product_id = p.id
      LEFT JOIN var ON var.product_id = p.id
      WHERE p.deleted_at IS NULL ${only}
      ORDER BY ${sort} ${dir}, p.name
      LIMIT ${opts.limit}`;
    return rows.map((r) => {
      const unitsSold = num(r.units);
      const revenue = num(r.revenue);
      const costPrice = r.cost_price === null ? null : num(r.cost_price);
      return {
        productId: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
        isActive: Boolean(r.is_active),
        viewsCount: num(r.views),
        unitsSold,
        conversionRate: Math.round(num(r.conversion) * 10_000) / 10_000,
        revenue,
        costPrice,
        currentPrice: r.sale_price === null ? num(r.base_price) : num(r.sale_price),
        estimatedProfit: costPrice === null ? null : revenue - unitsSold * costPrice,
        averageRating: r.avg_rating === null ? null : Math.round(num(r.avg_rating) * 10) / 10,
        reviewCount: num(r.reviews),
        refundCount: num(r.refunds),
        cancellationCount: num(r.cancellations),
        stock: num(r.stock),
        lowStockThreshold: num(r.low_stock_threshold),
      };
    });
  }

  /**
   * 19.1 Active products (without active variants) and active variants whose
   * stock is at or below the product's threshold. Lowest stock first.
   */
  async lowStock(limit: number) {
    const rows = await this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM (
        SELECT 'PRODUCT' AS type, p.id AS product_id, NULL::uuid AS variant_id, p.name, NULL AS variant_name,
               p.sku, p.slug, p.stock, p.low_stock_threshold AS threshold
        FROM products p
        WHERE p.deleted_at IS NULL AND p.is_active AND p.stock <= p.low_stock_threshold
          AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active)
        UNION ALL
        SELECT 'VARIANT', p.id, v.id, p.name, v.name, v.sku, p.slug, v.stock, p.low_stock_threshold
        FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE p.deleted_at IS NULL AND p.is_active AND v.is_active AND v.stock <= p.low_stock_threshold
      ) t
      ORDER BY stock ASC, name
      LIMIT ${limit}`;
    return rows.map((r) => ({
      type: String(r.type) as 'PRODUCT' | 'VARIANT',
      productId: String(r.product_id),
      variantId: (r.variant_id as string | null) ?? null,
      name: String(r.name),
      variantName: (r.variant_name as string | null) ?? null,
      sku: (r.sku as string | null) ?? null,
      slug: String(r.slug),
      stock: num(r.stock),
      threshold: num(r.threshold),
    }));
  }

  /** Keyset batches for CSV export (admin: includes costPrice). */
  exportBatch(afterId: string | undefined, take: number) {
    return this.db.product.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
      take,
      ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
      select: {
        id: true, name: true, slug: true, sku: true, basePrice: true, salePrice: true, costPrice: true,
        stock: true, lowStockThreshold: true, isActive: true, isFeatured: true, createdAt: true,
        category: { select: { name: true } }, brand: { select: { name: true } },
        variants: { select: { stock: true, isActive: true } },
      },
    });
  }

  /** Public, minimal product facts for the shopping assistant (no costPrice). */
  findAssistantFacts(ids: string[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.db.product.findMany({
      where: { id: { in: ids }, ...PUBLIC_PRODUCT_WHERE },
      select: {
        id: true, name: true, slug: true, shortDescription: true, basePrice: true, salePrice: true, stock: true,
        category: { select: { name: true } }, brand: { select: { name: true } },
        variants: { where: { isActive: true }, select: { name: true, price: true, salePrice: true, stock: true } },
      },
    });
  }
}
