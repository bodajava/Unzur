import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { parseSortParam } from '../../common/dto/pagination-query.dto.js';
import { LoyaltyType, OrderStatus, PaymentMethod, PaymentStatus } from '../../common/enums/index.js';
import { AppEvents, OrderStatusChangedEvent } from '../../common/events/index.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { AuthUser } from '../../common/interfaces/auth.interface.js';
import { normalizePhone } from '../../common/utilities/phone.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../../models/prisma.service.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { CouponUsageRepository } from '../../models/repositories/coupon-usage.repository.js';
import { CouponRepository } from '../../models/repositories/coupon.repository.js';
import { GiftCardRepository } from '../../models/repositories/gift-card.repository.js';
import { LoyaltyTransactionRepository } from '../../models/repositories/loyalty-transaction.repository.js';
import { OrderStatusHistoryRepository } from '../../models/repositories/order-status-history.repository.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { PaymentRepository } from '../../models/repositories/payment.repository.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { UserRepository } from '../../models/repositories/user.repository.js';
import {
  ORDER_SORT_FIELDS,
  type OrderCustomerRow,
  type OrderEntity,
  type OrderWithItems,
  type ShippingAddress,
} from '../../models/schemas/order.schema.js';
import { PAYMENT_TIMEOUT_REASON } from '../../models/analytics-sql.js';
import { PaymentsService, toPaymentModel } from '../payments/payments.service.js';
import { SettingKey, SETTING_DEFAULTS } from '../settings/setting-rules.js';
import { SettingsService } from '../settings/settings.service.js';
import type { CancelOrderDto, OrderQueryDto, RefundOrderDto, UpdateOrderStatusDto } from './dto/index.js';
import type {
  AdminOrderDetailModel,
  AdminOrderListItemModel,
  CustomerOrderModel,
  OrderEventModel,
} from './entities/order.model.js';
import { canAccessOrder } from './order-access.js';
import {
  CANCELLABLE_STATUSES,
  canTransition,
  pointsEarned,
  REFUNDABLE_STATUSES,
} from './order-rules.js';

const ENTITY = 'Order';

interface Changer {
  userId?: string;
  audit?: AuditContext;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly history: OrderStatusHistoryRepository,
    private readonly payments: PaymentRepository,
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
    private readonly giftCards: GiftCardRepository,
    private readonly coupons: CouponRepository,
    private readonly couponUsages: CouponUsageRepository,
    private readonly users: UserRepository,
    private readonly loyalty: LoyaltyTransactionRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly settings: SettingsService,
    private readonly paymentsService: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  // ───────────── 4.2 Track (guest) ─────────────

  async track(orderNumber: string, contact: string): Promise<CustomerOrderModel> {
    const order = await this.orders.findByNumber(orderNumber.trim().toUpperCase());
    // Same 404 for "no such order" and "wrong contact": numbers cannot be probed.
    if (!order || !canAccessOrder(order, undefined, contact)) throw new NotFoundException('Order not found');
    const view = (await this.orders.findCustomerView(order.id))!;
    const address = view.shippingAddress as unknown as ShippingAddress;
    // Tracking shows the delivery area only, never the street address.
    return { ...view, shippingAddress: { governorate: address.governorate, city: address.city } };
  }

  // ───────────── 4.3 My orders ─────────────

  myOrders(userId: string, page: number, limit: number): Promise<Paginated<OrderCustomerRow>> {
    return this.orders.paginateForCustomer({ userId }, page, limit);
  }

  // ───────────── 4.4 / 4.5 Admin ─────────────

  async adminList(query: OrderQueryDto): Promise<Paginated<AdminOrderListItemModel>> {
    const and: Prisma.OrderWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.paymentStatus) and.push({ paymentStatus: query.paymentStatus });
    if (query.paymentMethod) and.push({ paymentMethod: query.paymentMethod });
    if (query.fromDate || query.toDate) {
      and.push({ createdAt: { gte: query.fromDate, lte: query.toDate } });
    }
    const search = query.search?.trim();
    if (search) {
      const phone = normalizePhone(search);
      and.push({
        OR: [
          { orderNumber: { contains: search.toUpperCase() } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
          ...(phone.length >= 4 ? [{ customerPhone: { contains: phone } }] : []),
        ],
      });
    }
    const orderBy = parseSortParam(query.sort, ORDER_SORT_FIELDS, [{ createdAt: 'desc' }]);
    const page = await this.orders.paginateAdmin({ AND: and }, query.page, query.limit, orderBy);
    return {
      items: page.items.map(({ _count, ...row }) => ({ ...row, itemCount: _count.items })),
      meta: page.meta,
    };
  }

  async adminDetail(id: string): Promise<AdminOrderDetailModel> {
    const order = await this.orders.findAdminDetail(id);
    if (!order) throw new NotFoundException('Order not found');
    const { items, payments, statusHistory, user, ...rest } = order;
    return {
      ...rest,
      items,
      payments: payments.map(toPaymentModel),
      statusHistory,
      user,
      itemCount: items.length,
    };
  }

  // ───────────── 14.3 Timeline ─────────────

  async timeline(id: string, user: AuthUser | undefined, contact?: string): Promise<OrderEventModel[]> {
    await this.accessible(id, user, contact);
    return this.history.findByOrder(id);
  }

  /** Order with items for the invoice (14.2), after the access check. */
  async forInvoice(id: string, user: AuthUser | undefined, contact?: string): Promise<OrderWithItems> {
    await this.accessible(id, user, contact);
    return (await this.orders.findWithItems(id))!;
  }

  // ───────────── 4.6 Status ─────────────

  async changeStatus(id: string, dto: UpdateOrderStatusDto, audit: AuditContext): Promise<AdminOrderDetailModel> {
    const order = await this.getOrder(id);
    if (dto.status === order.status) throw new BadRequestException(`The order is already ${order.status}`);
    if (dto.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Use PATCH /orders/:id/refund to refund an order');
    }
    if (!canTransition(order.status, dto.status)) {
      throw new BadRequestException(`Cannot change an order from ${order.status} to ${dto.status}`);
    }
    if (dto.status === OrderStatus.CANCELLED) {
      await this.cancelInternal(order, dto.note ?? 'Cancelled by the store', { userId: audit.actorId, audit });
      return this.adminDetail(id);
    }

    const earnRate = await this.settings.getInt(
      SettingKey.LOYALTY_EARN_RATE,
      SETTING_DEFAULTS[SettingKey.LOYALTY_EARN_RATE],
    );
    await this.tx.run(async (tx) => {
      const delivered = dto.status === OrderStatus.DELIVERED;
      const moved = await this.orders.withTx(tx).updateIfStatus(id, [order.status], {
        status: dto.status,
        // Cash is collected on delivery.
        ...(delivered && order.paymentMethod === PaymentMethod.COD ? { paymentStatus: PaymentStatus.PAID } : {}),
      });
      if (!moved) throw new ConflictException('The order changed meanwhile. Reload and try again.');

      await this.history.withTx(tx).create({
        orderId: id,
        fromStatus: order.status,
        toStatus: dto.status,
        note: dto.note ?? null,
        changedById: audit.actorId,
      });
      if (delivered && order.userId) {
        const points = pointsEarned(order, earnRate);
        if (points > 0) {
          await this.users.withTx(tx).adjustLoyalty(order.userId, points);
          await this.loyalty.withTx(tx).create({
            userId: order.userId,
            orderId: id,
            points,
            type: LoyaltyType.EARNED_PURCHASE,
            description: `Earned on order ${order.orderNumber}`,
          });
        }
      }
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'ORDER_STATUS_CHANGED',
        entityType: ENTITY,
        entityId: id,
        oldValues: { status: order.status },
        newValues: { status: dto.status, note: dto.note },
      });
    });
    this.events.emit(AppEvents.ORDER_STATUS_CHANGED, new OrderStatusChangedEvent(id, order.status, dto.status));
    return this.adminDetail(id);
  }

  // ───────────── 14.1 Cancel (customer) ─────────────

  async cancelByCustomer(id: string, dto: CancelOrderDto, user: AuthUser | undefined): Promise<CustomerOrderModel> {
    const order = await this.getOrder(id);
    // Customers may only cancel their own order (staff use 4.6).
    const owner = user && order.userId === user.id;
    if (!owner && !(dto.contact && canAccessOrder(order, undefined, dto.contact))) {
      throw new NotFoundException('Order not found');
    }
    await this.cancelInternal(order, dto.reason ?? 'Cancelled by the customer', { userId: user?.id });
    return (await this.orders.findCustomerView(id))!;
  }

  // ───────────── 4.7 Refund ─────────────

  async refund(id: string, dto: RefundOrderDto, audit: AuditContext): Promise<AdminOrderDetailModel> {
    const order = await this.orders.findWithItems(id);
    if (!order) throw new NotFoundException('Order not found');
    if (!REFUNDABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(`Cannot refund an order that is ${order.status}`);
    }

    // Money first: if Paymob refuses, nothing changes on our side.
    const payment = await this.payments.findRefundable(id);
    if (payment) {
      await this.paymentsService.refundPayment(order, payment, dto.amountPiasters, audit, dto.reason);
    } else if (dto.amountPiasters) {
      throw new BadRequestException('Partial amounts apply to online payments only');
    }

    await this.tx.run(async (tx) => {
      const moved = await this.orders.withTx(tx).updateIfStatus(id, [order.status], {
        status: OrderStatus.REFUNDED,
        cancelOrRefundReason: dto.reason,
        // Cash orders: the money is returned outside the system.
        ...(!payment && order.paymentStatus === PaymentStatus.PAID ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
      });
      if (!moved) throw new ConflictException('The order changed meanwhile. Reload and try again.');
      await this.restoreSideEffects(tx, order, { restock: dto.restock !== false, releaseCoupon: false });
      // Points earned for this order are taken back.
      const earned = await this.loyalty.withTx(tx).sumForOrder(id, LoyaltyType.EARNED_PURCHASE);
      if (order.userId && earned > 0) {
        await this.users.withTx(tx).adjustLoyalty(order.userId, -earned);
        await this.loyalty.withTx(tx).create({
          userId: order.userId,
          orderId: id,
          points: -earned,
          type: LoyaltyType.EARNED_PURCHASE,
          description: `Reversed: order ${order.orderNumber} refunded`,
        });
      }
      await this.history.withTx(tx).create({
        orderId: id,
        fromStatus: order.status,
        toStatus: OrderStatus.REFUNDED,
        note: dto.reason,
        changedById: audit.actorId,
      });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'ORDER_REFUNDED',
        entityType: ENTITY,
        entityId: id,
        oldValues: { status: order.status, paymentStatus: order.paymentStatus },
        newValues: { reason: dto.reason, amountPiasters: dto.amountPiasters, restock: dto.restock !== false },
      });
    });
    this.events.emit(AppEvents.ORDER_STATUS_CHANGED, new OrderStatusChangedEvent(id, order.status, OrderStatus.REFUNDED));
    return this.adminDetail(id);
  }

  // ───────────── Internals ─────────────

  /** Cancel before shipping: stock, gift card, points and coupon use are given back. */
  /**
   * 20.2 Cancels an order still waiting for payment after the timeout and
   * gives back stock, gift card balance, points and coupon use. Returns false
   * (no change) if it was paid or changed meanwhile.
   */
  async expireUnpaid(order: OrderEntity): Promise<boolean> {
    if (order.status !== OrderStatus.PENDING_PAYMENT || order.paymentStatus === PaymentStatus.PAID) return false;
    try {
      await this.cancelInternal(order, PAYMENT_TIMEOUT_REASON, {}, [OrderStatus.PENDING_PAYMENT]);
      return true;
    } catch (error) {
      if (error instanceof ConflictException) return false; // paid/changed while we were working
      throw error;
    }
  }

  private async cancelInternal(
    order: OrderEntity,
    reason: string,
    by: Changer,
    from: OrderStatus[] = CANCELLABLE_STATUSES,
  ): Promise<void> {
    if (!from.includes(order.status)) {
      throw new BadRequestException(`An order that is ${order.status} cannot be cancelled`);
    }
    if (order.paymentStatus === PaymentStatus.PAID && order.totalAmount > 0 && order.paymentMethod !== PaymentMethod.COD) {
      throw new BadRequestException('This order is already paid. Please ask us for a refund instead.');
    }
    const full = (await this.orders.findWithItems(order.id))!;

    await this.tx.run(async (tx) => {
      const moved = await this.orders.withTx(tx).updateIfStatus(order.id, from, {
        status: OrderStatus.CANCELLED,
        cancelOrRefundReason: reason,
        ...(order.paymentStatus === PaymentStatus.PENDING ? { paymentStatus: PaymentStatus.UNPAID } : {}),
      });
      if (!moved) throw new ConflictException('The order changed meanwhile. Reload and try again.');
      await this.restoreSideEffects(tx, full, { restock: true, releaseCoupon: true });
      await this.history.withTx(tx).create({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELLED,
        note: reason,
        changedById: by.userId ?? null,
      });
      if (by.audit) {
        await this.auditLogs.withTx(tx).record({
          ...by.audit,
          action: 'ORDER_CANCELLED',
          entityType: ENTITY,
          entityId: order.id,
          oldValues: { status: order.status },
          newValues: { status: OrderStatus.CANCELLED, reason },
        });
      }
    });
    this.events.emit(
      AppEvents.ORDER_STATUS_CHANGED,
      new OrderStatusChangedEvent(order.id, order.status, OrderStatus.CANCELLED),
    );
  }

  /**
   * Gives back what checkout took. Rows are locked in the same order as at
   * checkout (products, then variants, ids ascending) to avoid deadlocks.
   */
  private async restoreSideEffects(
    tx: DbClient,
    order: OrderWithItems,
    opts: { restock: boolean; releaseCoupon: boolean },
  ): Promise<void> {
    if (opts.restock) {
      const variantItems = order.items.filter((i) => i.variantId);
      const productItems = order.items.filter((i) => !i.variantId);
      await this.products.withTx(tx).lockForUpdate(order.items.map((i) => i.productId));
      await this.variants.withTx(tx).lockForUpdate(variantItems.map((i) => i.variantId!));
      for (const item of [...productItems].sort((a, b) => a.productId.localeCompare(b.productId))) {
        await this.products.withTx(tx).incrementStock(item.productId, item.quantity);
      }
      for (const item of [...variantItems].sort((a, b) => a.variantId!.localeCompare(b.variantId!))) {
        await this.variants.withTx(tx).incrementStock(item.variantId!, item.quantity);
      }
    }
    if (order.giftCardId && order.giftCardAmount > 0) {
      await this.giftCards.withTx(tx).credit(order.giftCardId, order.giftCardAmount);
    }
    const redeemed = -(await this.loyalty.withTx(tx).sumForOrder(order.id, LoyaltyType.REDEEMED_DISCOUNT));
    if (order.userId && redeemed > 0) {
      await this.users.withTx(tx).adjustLoyalty(order.userId, redeemed);
      await this.loyalty.withTx(tx).create({
        userId: order.userId,
        orderId: order.id,
        points: redeemed,
        type: LoyaltyType.REDEEMED_DISCOUNT,
        description: `Returned: order ${order.orderNumber} ${opts.releaseCoupon ? 'cancelled' : 'refunded'}`,
      });
    }
    if (opts.releaseCoupon) {
      const usage = await this.couponUsages.withTx(tx).findOne({ orderId: order.id });
      if (usage) {
        await this.couponUsages.withTx(tx).delete({ id: usage.id });
        await this.coupons.withTx(tx).decrementUsage(usage.couponId);
      }
    }
  }

  private async getOrder(id: string): Promise<OrderEntity> {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async accessible(id: string, user: AuthUser | undefined, contact?: string): Promise<OrderEntity> {
    const order = await this.orders.findById(id);
    if (!order || !canAccessOrder(order, user, contact)) throw new NotFoundException('Order not found');
    return order;
  }
}
