import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import { num, SOLD_SQL } from '../analytics-sql.js';
import type { ProductViewEntity } from '../schemas/product-view.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class ProductViewRepository extends BaseRepository<
  ProductViewEntity,
  Prisma.ProductViewWhereInput,
  Prisma.ProductViewWhereUniqueInput,
  Prisma.ProductViewUncheckedCreateInput,
  Prisma.ProductViewUncheckedUpdateInput,
  Prisma.ProductViewOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.productView;
  }

  /** Distinct visitors (user, else guest) and anonymous views in [from, to). */
  async visitors(from: Date, to: Date) {
    const [row] = await this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT COUNT(DISTINCT COALESCE(user_id::text, guest_id)) AS visitors,
             COUNT(*) FILTER (WHERE user_id IS NULL AND guest_id IS NULL) AS anonymous_views
      FROM product_views WHERE created_at >= ${from} AND created_at < ${to}`;
    return { visitors: num(row.visitors), anonymousViews: num(row.anonymous_views) };
  }

  /**
   * Who viewed a product in [from, to), and how many of the identified
   * viewers went on to buy it (matched by user id, or guest id on the order).
   */
  async viewersOfProduct(productId: string, from: Date, to: Date) {
    const [row] = await this.db.$queryRaw<Record<string, unknown>[]>`
      WITH v AS (
        SELECT user_id, guest_id FROM product_views
        WHERE product_id = ${productId}::uuid AND created_at >= ${from} AND created_at < ${to}
      ), buyers AS (
        SELECT DISTINCT o.user_id, o.guest_id
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = ${productId}::uuid AND o.status IN ${SOLD_SQL} AND o.created_at >= ${from}
      )
      SELECT COUNT(*) AS views,
             COUNT(DISTINCT COALESCE(user_id::text, guest_id)) AS unique_viewers,
             COUNT(DISTINCT user_id) AS registered_viewers,
             COUNT(DISTINCT guest_id) FILTER (WHERE user_id IS NULL) AS guest_viewers,
             COUNT(*) FILTER (WHERE user_id IS NULL AND guest_id IS NULL) AS anonymous_views,
             (SELECT COUNT(DISTINCT COALESCE(v2.user_id::text, v2.guest_id)) FROM v v2
               WHERE EXISTS (SELECT 1 FROM buyers b WHERE (v2.user_id IS NOT NULL AND b.user_id = v2.user_id)
                                                    OR (v2.guest_id IS NOT NULL AND b.guest_id = v2.guest_id))) AS viewers_who_bought
      FROM v`;
    return {
      views: num(row.views),
      uniqueViewers: num(row.unique_viewers),
      registeredViewers: num(row.registered_viewers),
      guestViewers: num(row.guest_viewers),
      anonymousViews: num(row.anonymous_views),
      viewersWhoBought: num(row.viewers_who_bought),
    };
  }
}
