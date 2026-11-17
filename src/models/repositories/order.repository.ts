import { Injectable } from '@nestjs/common';
import { type OrderStatus, Prisma } from '../../generated/prisma/client.js';
import { type Granularity, GRANULARITIES, IDENTITY_SQL, num, PAYMENT_TIMEOUT_REASON, SOLD_SQL, STORE_TZ } from '../analytics-sql.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { DbClient } from '../prisma.service.js';
import {
  ORDER_ADMIN_DETAIL_INCLUDE,
  ORDER_ADMIN_LIST_SELECT,
  ORDER_CUSTOMER_SELECT,
  type OrderAdminDetailRow,
  type OrderAdminListRow,
  type OrderCustomerRow,
  type OrderEntity,
  type OrderWithItems,
} from '../schemas/order.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class OrderRepository extends BaseRepository<
  OrderEntity,
  Prisma.OrderWhereInput,
  Prisma.OrderWhereUniqueInput,
  Prisma.OrderUncheckedCreateInput,
  Prisma.OrderUncheckedUpdateInput,
  Prisma.OrderOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.order;
  }

  /** Links unowned (guest) orders matching any condition to the user. */
  async assignGuestOrdersToUser(userId: string, match: Prisma.OrderWhereInput[]): Promise<number> {
    if (!match.length) return 0;
    const { count } = await this.db.order.updateMany({
      where: { userId: null, OR: match },
      data: { userId },
    });
    return count;
  }

  findByNumber(orderNumber: string): Promise<OrderEntity | null> {
    return this.db.order.findUnique({ where: { orderNumber } });
  }

  findCustomerView(id: string): Promise<OrderCustomerRow | null> {
    return this.db.order.findUnique({ where: { id }, select: ORDER_CUSTOMER_SELECT });
  }

  findAdminDetail(id: string): Promise<OrderAdminDetailRow | null> {
    return this.db.order.findUnique({ where: { id }, include: ORDER_ADMIN_DETAIL_INCLUDE });
  }

  findWithItems(id: string): Promise<OrderWithItems | null> {
    return this.db.order.findUnique({ where: { id }, include: { items: true } });
  }

  async paginateForCustomer(
    where: Prisma.OrderWhereInput,
    page: number,
    limit: number,
  ): Promise<Paginated<OrderCustomerRow>> {
    const [items, total] = await Promise.all([
      this.db.order.findMany({
        where,
        select: ORDER_CUSTOMER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.order.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  async paginateAdmin(
    where: Prisma.OrderWhereInput,
    page: number,
    limit: number,
    orderBy: Prisma.OrderOrderByWithRelationInput[],
  ): Promise<Paginated<OrderAdminListRow>> {
    const [items, total] = await Promise.all([
      this.db.order.findMany({
        where,
        select: ORDER_ADMIN_LIST_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.order.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  /**
   * Compare-and-set on status: updates only while the order is still in one
   * of `from`. Returns false when another request changed it first.
   */
  async updateIfStatus(
    id: string,
    from: OrderStatus[],
    data: Prisma.OrderUncheckedUpdateManyInput,
  ): Promise<boolean> {
    const { count } = await this.db.order.updateMany({ where: { id, status: { in: from } }, data });
    return count === 1;
  }

  /** A DELIVERED order of this user that contains the product (verified purchase). */
  findDeliveredWithProduct(userId: string, productId: string): Promise<{ id: string } | null> {
    return this.db.order.findFirst({
      where: { userId, status: 'DELIVERED', items: { some: { productId } } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  countForUser(userId: string): Promise<number> {
    return this.db.order.count({ where: { userId } });
  }

  // ───────── Analytics (8.x). All amounts in piasters. ─────────

  async salesSummary(from: Date, to: Date) {
    const [row] = await this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT COALESCE(SUM(o.total_amount), 0) AS revenue,
             COUNT(*) AS orders,
             COUNT(*) FILTER (WHERE o.user_id IS NULL) AS guest_orders,
             COUNT(DISTINCT ${IDENTITY_SQL}) AS customers
      FROM orders o
      WHERE o.status IN ${SOLD_SQL} AND o.created_at >= ${from} AND o.created_at < ${to}`;
    return {
      revenue: num(row.revenue),
      orders: num(row.orders),
      guestOrders: num(row.guest_orders),
      customers: num(row.customers),
    };
  }

  /** Customers who bought in [from, to): first-ever purchase in the period = new, else returning. */
  async customerSplit(from: Date, to: Date) {
    const [row] = await this.db.$queryRaw<Record<string, unknown>[]>`
      WITH period AS (
        SELECT DISTINCT ${IDENTITY_SQL} AS id FROM orders o
        WHERE o.status IN ${SOLD_SQL} AND o.created_at >= ${from} AND o.created_at < ${to}
      ), firsts AS (
        SELECT ${IDENTITY_SQL} AS id, MIN(o.created_at) AS first_at FROM orders o
        WHERE o.status IN ${SOLD_SQL} GROUP BY 1
      )
      SELECT COUNT(*) FILTER (WHERE f.first_at >= ${from}) AS new_count,
             COUNT(*) FILTER (WHERE f.first_at < ${from}) AS returning_count
      FROM period p JOIN firsts f ON f.id = p.id`;
    return { newCount: num(row.new_count), returningCount: num(row.returning_count) };
  }

  /** Revenue and order count per day/week/month (empty buckets included), Cairo time. */
  async salesTrend(from: Date, to: Date, granularity: Granularity) {
    const g = Prisma.raw(`'${GRANULARITIES.includes(granularity) ? granularity : 'day'}'`);
    const tz = Prisma.raw(`'${STORE_TZ}'`);
    const rows = await this.db.$queryRaw<Record<string, unknown>[]>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${g}, ${from}::timestamptz AT TIME ZONE ${tz}),
          date_trunc(${g}, (${to}::timestamptz - interval '1 millisecond') AT TIME ZONE ${tz}),
          ('1 ' || ${g})::interval
        ) AS period
      )
      SELECT to_char(b.period, 'YYYY-MM-DD') AS period,
             COALESCE(SUM(o.total_amount), 0) AS revenue,
             COUNT(o.id) AS orders
      FROM buckets b
      LEFT JOIN orders o
        ON date_trunc(${g}, o.created_at AT TIME ZONE ${tz}) = b.period
       AND o.status IN ${SOLD_SQL}
       AND o.created_at >= ${from} AND o.created_at < ${to}
      GROUP BY b.period
      ORDER BY b.period`;
    return rows.map((r) => ({ period: String(r.period), revenue: num(r.revenue), ordersCount: num(r.orders) }));
  }

  /** Share of customers (all time) with 2+ purchases. */
  async repeatCustomers() {
    const [row] = await this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT COUNT(*) FILTER (WHERE n >= 2) AS repeaters, COUNT(*) AS total
      FROM (SELECT ${IDENTITY_SQL} AS id, COUNT(*) AS n FROM orders o WHERE o.status IN ${SOLD_SQL} GROUP BY 1) t`;
    return { repeaters: num(row.repeaters), total: num(row.total) };
  }

  async topCustomers(limit: number) {
    const rows = await this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT ${IDENTITY_SQL} AS identifier,
             (array_agg(o.customer_name ORDER BY o.created_at DESC))[1] AS name,
             (array_agg(lower(o.customer_email) ORDER BY o.created_at DESC))[1] AS email,
             bool_or(o.user_id IS NOT NULL) AS is_registered,
             COUNT(*) AS orders, SUM(o.total_amount) AS spent, MAX(o.created_at) AS last_order_at
      FROM orders o WHERE o.status IN ${SOLD_SQL}
      GROUP BY 1 ORDER BY spent DESC LIMIT ${limit}`;
    return rows.map((r) => ({
      identifier: String(r.identifier),
      name: String(r.name),
      email: String(r.email),
      isRegistered: Boolean(r.is_registered),
      ordersCount: num(r.orders),
      totalSpent: num(r.spent),
      lastOrderAt: r.last_order_at as Date,
    }));
  }

  /** Who bought a product (sales only) in [from, to). */
  async buyersOfProduct(productId: string, from: Date, to: Date) {
    const [row] = await this.db.$queryRaw<Record<string, unknown>[]>`
      WITH sales AS (
        SELECT o.id, o.user_id, ${IDENTITY_SQL} AS identity, oi.quantity
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = ${productId}::uuid AND o.status IN ${SOLD_SQL}
          AND o.created_at >= ${from} AND o.created_at < ${to}
      )
      SELECT COUNT(DISTINCT identity) AS buyers,
             COUNT(DISTINCT user_id) AS registered,
             COUNT(DISTINCT identity) FILTER (WHERE user_id IS NULL) AS guests,
             COALESCE(SUM(quantity), 0) AS units,
             COUNT(DISTINCT id) AS orders,
             (SELECT COUNT(*) FROM (SELECT identity FROM sales GROUP BY identity HAVING COUNT(DISTINCT id) > 1) r) AS repeat_buyers
      FROM sales`;
    return {
      buyers: num(row.buyers),
      registeredBuyers: num(row.registered),
      guestBuyers: num(row.guests),
      unitsSold: num(row.units),
      orders: num(row.orders),
      repeatBuyers: num(row.repeat_buyers),
    };
  }

  /** Most common cancel/refund reasons for orders containing the product. */
  async reasonsForProduct(productId: string, limit = 5) {
    const rows = await this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT o.status, o.cancel_or_refund_reason AS reason, COUNT(DISTINCT o.id) AS n
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE oi.product_id = ${productId}::uuid
        AND o.status IN ('CANCELLED', 'REFUNDED')
        AND o.cancel_or_refund_reason IS NOT NULL
        AND o.cancel_or_refund_reason <> ${PAYMENT_TIMEOUT_REASON}
      GROUP BY 1, 2 ORDER BY n DESC LIMIT ${limit}`;
    return rows.map((r) => ({ status: String(r.status), reason: String(r.reason), count: num(r.n) }));
  }

  /** PENDING_PAYMENT orders created before `cutoff` (20.2). */
  findExpiredPending(cutoff: Date, take: number): Promise<OrderEntity[]> {
    return this.db.order.findMany({
      where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  recentForAdmin(take: number): Promise<OrderAdminListRow[]> {
    return this.db.order.findMany({ select: ORDER_ADMIN_LIST_SELECT, orderBy: { createdAt: 'desc' }, take });
  }

  /** Keyset batches for CSV export (19.3). */
  exportBatch(afterId: string | undefined, take: number) {
    return this.db.order.findMany({
      orderBy: { id: 'asc' },
      take,
      ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
      select: {
        id: true, orderNumber: true, createdAt: true, status: true, paymentStatus: true, paymentMethod: true,
        customerName: true, customerEmail: true, customerPhone: true, shippingAddress: true,
        subtotal: true, discountAmount: true, loyaltyDiscount: true, giftCardAmount: true, shippingCost: true,
        totalAmount: true, couponCode: true, cancelOrRefundReason: true, _count: { select: { items: true } },
      },
    });
  }

  /**
   * 19.4 Customer directory: registered customers (with or without orders)
   * plus guest emails that never registered. Sales only for spend/counts.
   */
  async customerDirectory(opts: { search?: string; sort: string; desc: boolean; page: number; limit: number }) {
    const sortColumn = Prisma.raw(
      { totalSpent: 'total_spent', ordersCount: 'orders_count', lastOrderAt: 'last_order_at', name: 'name' }[opts.sort] ??
        'total_spent',
    );
    const direction = Prisma.raw(opts.desc ? 'DESC NULLS LAST' : 'ASC NULLS LAST');
    const like = opts.search ? `%${opts.search.replace(/[\\%_]/g, '\\$&')}%` : null;
    const base = Prisma.sql`
      WITH sold AS (SELECT * FROM orders o WHERE o.status IN ${SOLD_SQL}),
      registered AS (
        SELECT u.id::text AS identifier, trim(u.first_name || ' ' || u.last_name) AS name, u.email, u.phone,
               true AS is_registered, u.loyalty_points, COUNT(s.id) AS orders_count,
               COALESCE(SUM(s.total_amount), 0) AS total_spent, MAX(s.created_at) AS last_order_at, u.created_at
        FROM users u LEFT JOIN sold s ON s.user_id = u.id
        WHERE u.role = 'CUSTOMER'
        GROUP BY u.id
      ),
      guests AS (
        SELECT lower(s.customer_email) AS identifier,
               (array_agg(s.customer_name ORDER BY s.created_at DESC))[1] AS name,
               lower(s.customer_email) AS email,
               (array_agg(s.customer_phone ORDER BY s.created_at DESC))[1] AS phone,
               false AS is_registered, 0 AS loyalty_points, COUNT(*) AS orders_count,
               SUM(s.total_amount) AS total_spent, MAX(s.created_at) AS last_order_at, MIN(s.created_at) AS created_at
        FROM sold s
        WHERE s.user_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(s.customer_email))
        GROUP BY lower(s.customer_email)
      ),
      everyone AS (SELECT * FROM registered UNION ALL SELECT * FROM guests)
      SELECT * FROM everyone
      WHERE ${like}::text IS NULL OR name ILIKE ${like} OR email ILIKE ${like} OR phone ILIKE ${like}`;
    const [rows, [count]] = await Promise.all([
      this.db.$queryRaw<Record<string, unknown>[]>`${base}
        ORDER BY ${sortColumn} ${direction}, identifier
        LIMIT ${opts.limit} OFFSET ${(opts.page - 1) * opts.limit}`,
      this.db.$queryRaw<Record<string, unknown>[]>`SELECT COUNT(*) AS n FROM (${base}) c`,
    ]);
    return {
      items: rows.map((r) => ({
        identifier: String(r.identifier),
        name: typeof r.name === 'string' ? r.name : '',
        email: String(r.email),
        phone: (r.phone as string | null) ?? null,
        isRegistered: Boolean(r.is_registered),
        loyaltyPoints: num(r.loyalty_points),
        ordersCount: num(r.orders_count),
        totalSpent: num(r.total_spent),
        lastOrderAt: (r.last_order_at as Date | null) ?? null,
        firstSeenAt: r.created_at as Date,
      })),
      total: num(count.n),
    };
  }
}
