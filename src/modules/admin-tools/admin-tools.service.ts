import { NotFoundException, Injectable } from '@nestjs/common';
import { buildPaginationMeta, parseSortParam } from '../../common/dto/pagination-query.dto.js';
import type { CsvValue } from '../../common/utilities/csv.js';
import { csvStream } from '../../common/utilities/csv.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { AddressRepository } from '../../models/repositories/address.repository.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import type { ShippingAddress } from '../../models/schemas/order.schema.js';
import { type AuditLogQueryDto, CUSTOMER_SORTS, type CustomerDirectoryQueryDto, type ExportType } from './dto/index.js';

const BATCH = 500;
const egp = (piasters: number | null | undefined) => (piasters === null || piasters === undefined ? null : piasters / 100);

/** 19.1–19.4 */
@Injectable()
export class AdminToolsService {
  constructor(
    private readonly products: ProductRepository,
    private readonly orders: OrderRepository,
    private readonly audit: AuditLogRepository,
    private readonly addresses: AddressRepository,
  ) {}

  /** 19.1 */
  lowStock(limit = 100) {
    return this.products.lowStock(limit);
  }

  /** 19.2 */
  auditLogs(query: AuditLogQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action.toUpperCase() } : {}),
      ...(query.fromDate || query.toDate ? { createdAt: { gte: query.fromDate, lte: query.toDate } } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { entityType: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search } },
              { actor: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    return this.audit.paginateAdmin(where, query.page, query.limit);
  }

  /** 19.4 */
  async customers(query: CustomerDirectoryQueryDto) {
    const [sort] = parseSortParam(query.sort, CUSTOMER_SORTS, [{ totalSpent: 'desc' }]);
    const [field, direction] = Object.entries(sort)[0];
    const { items, total } = await this.orders.customerDirectory({
      search: query.search?.trim() || undefined,
      sort: field,
      desc: direction === 'desc',
      page: query.page,
      limit: query.limit,
    });
    return { items, meta: buildPaginationMeta(total, query.page, query.limit) };
  }

  /** One customer (user id, or a guest's email) with their saved addresses. */
  async customer(identifier: string) {
    const key = identifier.includes('@') ? identifier.trim().toLowerCase() : identifier.trim();
    const { items } = await this.orders.customerDirectory({ identifier: key, sort: 'totalSpent', desc: true, page: 1, limit: 1 });
    const entry = items[0];
    if (!entry) throw new NotFoundException('Customer not found');
    const addresses = entry.isRegistered ? await this.addresses.find({ userId: entry.identifier }, { orderBy: { isDefault: 'desc' } }) : [];
    return { ...entry, addresses };
  }

  /** 19.3 CSV (UTF-8 BOM). Rows are read in batches while streaming. */
  export(type: ExportType) {
    if (type === 'orders') return csvStream(ORDER_HEADER, this.orderRows());
    if (type === 'products') return csvStream(PRODUCT_HEADER, this.productRows());
    return csvStream(CUSTOMER_HEADER, this.customerRows());
  }

  private async *orderRows(): AsyncIterable<CsvValue[]> {
    for (let after: string | undefined, batch; (batch = await this.orders.exportBatch(after, BATCH)).length; after = batch.at(-1)!.id) {
      for (const o of batch) {
        const a = o.shippingAddress as unknown as ShippingAddress;
        yield [
          o.orderNumber, o.createdAt, o.status, o.paymentStatus, o.paymentMethod, o.customerName, o.customerEmail,
          o.customerPhone, a?.governorate, a?.city, a?.street, o._count.items, egp(o.subtotal), egp(o.discountAmount),
          egp(o.loyaltyDiscount), egp(o.giftCardAmount), egp(o.shippingCost), egp(o.totalAmount), o.couponCode,
          o.cancelOrRefundReason,
        ];
      }
      if (batch.length < BATCH) return;
    }
  }

  private async *productRows(): AsyncIterable<CsvValue[]> {
    for (let after: string | undefined, batch; (batch = await this.products.exportBatch(after, BATCH)).length; after = batch.at(-1)!.id) {
      for (const p of batch) {
        const variantStock = p.variants.filter((v) => v.isActive).reduce((s, v) => s + v.stock, 0);
        yield [
          p.name, p.slug, p.sku, p.category.name, p.brand?.name, egp(p.basePrice), egp(p.salePrice), egp(p.costPrice),
          p.stock + variantStock, p.lowStockThreshold, p.isActive, p.isFeatured, p.createdAt,
        ];
      }
      if (batch.length < BATCH) return;
    }
  }

  private async *customerRows(): AsyncIterable<CsvValue[]> {
    for (let page = 1; ; page++) {
      const { items } = await this.orders.customerDirectory({ sort: 'totalSpent', desc: true, page, limit: BATCH });
      for (const c of items) {
        yield [c.name, c.email, c.phone, c.isRegistered ? 'registered' : 'guest', c.ordersCount, egp(c.totalSpent), c.loyaltyPoints, c.lastOrderAt, c.firstSeenAt];
      }
      if (items.length < BATCH) return;
    }
  }
}

const ORDER_HEADER = [
  'order_number', 'created_at', 'status', 'payment_status', 'payment_method', 'customer_name', 'customer_email',
  'customer_phone', 'governorate', 'city', 'street', 'items', 'subtotal_egp', 'discount_egp', 'loyalty_discount_egp',
  'gift_card_egp', 'shipping_egp', 'total_egp', 'coupon_code', 'cancel_or_refund_reason',
];
const PRODUCT_HEADER = [
  'name', 'slug', 'sku', 'category', 'brand', 'base_price_egp', 'sale_price_egp', 'cost_price_egp', 'stock',
  'low_stock_threshold', 'active', 'featured', 'created_at',
];
const CUSTOMER_HEADER = [
  'name', 'email', 'phone', 'type', 'orders', 'total_spent_egp', 'loyalty_points', 'last_order_at', 'first_seen_at',
];
