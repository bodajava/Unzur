import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { isUUID } from 'class-validator';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../../common/enums/index.js';
import {
  AppEvents,
  GiftCardPurchasedEvent,
  OrderStatusChangedEvent,
  PaymentSucceededEvent,
} from '../../common/events/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { AuthUser } from '../../common/interfaces/auth.interface.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { isUniqueViolation } from '../../models/prisma-errors.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { GiftCardRepository } from '../../models/repositories/gift-card.repository.js';
import { OrderStatusHistoryRepository } from '../../models/repositories/order-status-history.repository.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { PaymentRepository } from '../../models/repositories/payment.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { OrderEntity, ShippingAddress } from '../../models/schemas/order.schema.js';
import type { GiftCardEntity } from '../../models/schemas/gift-card.schema.js';
import type { PaymentEntity } from '../../models/schemas/payment.schema.js';
import { canAccessOrder } from '../orders/order-access.js';
import type { InitiatePaymentDto, OnlineMethod, RefundPaymentDto } from './dto/index.js';
import type { PaymentModel, PaymentSessionModel } from './entities/payment.model.js';
import { PaymobGatewayClient } from './paymob/paymob-gateway.client.js';
import { callbackHmacMessage, transactionHmacMessage, verifyPaymobHmac } from './paymob/paymob-hmac.js';

const TERMINAL: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
  PaymentStatus.PARTIALLY_REFUNDED,
];
const ORDER_NUMBER_PATTERN = /^ORD-\d{8}-[A-Z0-9]{6}$/;

/** Fields of Paymob's transaction object we read (all optional: untrusted input). */
interface PaymobTransaction {
  id?: number | string;
  amount_cents?: number | string;
  success?: boolean;
  pending?: boolean;
  error_occured?: boolean;
  special_reference?: string;
  merchant_order_id?: string;
  order?: { id?: number | string; merchant_order_id?: string };
}

type PaymentTarget =
  | { kind: 'order'; order: OrderEntity; payment: PaymentEntity | null }
  | { kind: 'giftCard'; payment: PaymentEntity; giftCard: GiftCardEntity };

export interface WebhookResult {
  received: true;
  duplicate?: boolean;
  ignored?: string;
  status?: PaymentStatus;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly hmacSecret: string;
  private readonly backendUrl: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentRepository,
    private readonly history: OrderStatusHistoryRepository,
    private readonly giftCards: GiftCardRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly gateway: PaymobGatewayClient,
    private readonly events: EventEmitter2,
    config: ConfigService,
  ) {
    this.hmacSecret = config.get<string>('PAYMOB_HMAC_SECRET') ?? '';
    this.backendUrl = (config.get<string>('APP_BACKEND_URL') || config.get<string>('APP_URL') || '').replace(/\/+$/, '');
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
  }

  // ───────────── 5.1 Initiate ─────────────

  async initiate(dto: InitiatePaymentDto, user: AuthUser | undefined): Promise<PaymentSessionModel> {
    const order = await this.orders.findById(dto.orderId);
    if (!order || !canAccessOrder(order, user, dto.contact)) throw new NotFoundException('Order not found');
    return this.initiateForOrder(order, dto.paymentMethod);
  }

  /**
   * Creates a Paymob intention for a PENDING_PAYMENT order. The payment row is
   * created first; its id is the intention's special_reference, so retries
   * get a fresh, unique reference.
   */
  async initiateForOrder(order: OrderEntity, method?: OnlineMethod): Promise<PaymentSessionModel> {
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('This order is not waiting for payment');
    }
    if (order.totalAmount <= 0) throw new BadRequestException('Nothing to pay for this order');
    const paymentMethod = method ?? order.paymentMethod;
    if (paymentMethod === PaymentMethod.COD) {
      throw new BadRequestException('Choose card or wallet to pay online');
    }
    if (paymentMethod !== order.paymentMethod) {
      await this.orders.updateById(order.id, { paymentMethod });
    }

    const payment = await this.payments.create({
      orderId: order.id,
      amountPiasters: order.totalAmount,
      status: PaymentStatus.PENDING,
    });
    try {
      const intention = await this.gateway.createIntention({
        amountPiasters: order.totalAmount,
        method: paymentMethod,
        reference: payment.id,
        description: `Order ${order.orderNumber}`,
        billing: this.billingData(order),
        notificationUrl: `${this.backendUrl}/api/v1/payments/paymob/webhook`,
        redirectionUrl: `${this.backendUrl}/api/v1/payments/paymob/callback`,
      });
      await this.payments.updateById(payment.id, {
        intentionId: intention.intentionId,
        paymobOrderId: intention.paymobOrderId,
      });
      return { paymentId: payment.id, intentionId: intention.intentionId, checkoutUrl: intention.checkoutUrl };
    } catch (error) {
      await this.payments.updateById(payment.id, { status: PaymentStatus.FAILED });
      throw error;
    }
  }

  // ───────────── 5.2 Webhook (server-to-server, the ONLY way to mark PAID) ─────────────

  async handleWebhook(hmac: unknown, body: unknown): Promise<WebhookResult> {
    const payload = (body ?? {}) as { type?: string; obj?: PaymobTransaction };
    const obj = payload.obj;
    if (!obj || !verifyPaymobHmac(transactionHmacMessage(obj), hmac, this.hmacSecret)) {
      throw new UnauthorizedException('Invalid HMAC');
    }
    if (payload.type && payload.type !== 'TRANSACTION') return { received: true, ignored: 'not a transaction' };
    if (obj.id === undefined) return { received: true, ignored: 'missing transaction id' };

    const transactionId = String(obj.id);
    const seen = await this.payments.findByTransactionId(transactionId);
    if (seen && TERMINAL.includes(seen.status)) return { received: true, duplicate: true };

    const target = await this.findTarget(obj);
    if (!target) {
      this.logger.warn(`Paymob webhook for unknown order (tx ${transactionId})`);
      return { received: true, ignored: 'unknown order' };
    }
    if (target.kind === 'giftCard') return this.settleGiftCard(target, obj, transactionId, payload);
    const { order, payment } = target;

    if (Number(obj.amount_cents) !== order.totalAmount) {
      this.logger.warn(
        `Paymob amount mismatch for ${order.orderNumber}: got ${String(obj.amount_cents)}, expected ${order.totalAmount}`,
      );
      throw new BadRequestException('Amount does not match the order total');
    }
    if (obj.pending === true) {
      if (payment) await this.payments.updateById(payment.id, { rawWebhookPayload: payload as Prisma.InputJsonValue });
      return { received: true, ignored: 'pending', status: PaymentStatus.PENDING };
    }

    const succeeded = obj.success === true && obj.error_occured !== true;
    const status = succeeded ? PaymentStatus.PAID : PaymentStatus.FAILED;
    let confirmed = false;
    try {
      confirmed = await this.tx.run(async (tx) => {
        const data = {
          status,
          paymobTransactionId: transactionId,
          rawWebhookPayload: payload as Prisma.InputJsonValue,
          ...(obj.order?.id !== undefined && !payment?.paymobOrderId ? { paymobOrderId: String(obj.order.id) } : {}),
        };
        // A payment attempt already closed by another transaction gets its own row.
        if (payment && payment.status === PaymentStatus.PENDING) {
          await this.payments.withTx(tx).updateById(payment.id, data);
        } else {
          await this.payments.withTx(tx).create({ ...data, orderId: order.id, amountPiasters: order.totalAmount });
        }

        if (!succeeded) {
          await this.orders.withTx(tx).updateIfStatus(order.id, [OrderStatus.PENDING_PAYMENT], {
            paymentStatus: PaymentStatus.FAILED,
          });
          return false;
        }
        const moved = await this.orders.withTx(tx).updateIfStatus(order.id, [OrderStatus.PENDING_PAYMENT], {
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
        });
        if (moved) {
          await this.history.withTx(tx).create({
            orderId: order.id,
            fromStatus: OrderStatus.PENDING_PAYMENT,
            toStatus: OrderStatus.CONFIRMED,
            note: 'Paid online (Paymob)',
          });
        } else {
          // e.g. paid after the customer cancelled: keep the status, record the money.
          await this.orders.withTx(tx).updateById(order.id, { paymentStatus: PaymentStatus.PAID });
          this.logger.warn(`Order ${order.orderNumber} was paid while ${order.status}: needs a manual refund`);
        }
        return moved;
      });
    } catch (error) {
      // Two deliveries of the same transaction raced: the other one won.
      if (isUniqueViolation(error)) return { received: true, duplicate: true };
      throw error;
    }

    if (succeeded) {
      this.events.emit(AppEvents.PAYMENT_SUCCEEDED, new PaymentSucceededEvent(order.id, order.totalAmount));
      if (confirmed) {
        this.events.emit(
          AppEvents.ORDER_STATUS_CHANGED,
          new OrderStatusChangedEvent(order.id, OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED),
        );
      }
    }
    return { received: true, status };
  }

  // ───────────── 18.1 Gift card purchase ─────────────

  isOnlinePaymentAvailable(method: OnlineMethod): boolean {
    return this.gateway.isConfigured(method);
  }

  /** Paymob session for an inactive, unpaid gift card. Activated by the webhook only. */
  async initiateForGiftCard(
    giftCard: GiftCardEntity,
    buyer: { email: string; firstName: string; lastName: string; phone: string | null },
    method: OnlineMethod = PaymentMethod.PAYMOB_CARD,
  ): Promise<PaymentSessionModel> {
    const payment = await this.payments.create({
      giftCardId: giftCard.id,
      amountPiasters: giftCard.initialBalance,
      status: PaymentStatus.PENDING,
    });
    try {
      const na = (v?: string | null) => (v && v.trim() ? v.trim() : 'NA');
      const intention = await this.gateway.createIntention({
        amountPiasters: giftCard.initialBalance,
        method,
        reference: payment.id,
        description: 'Gift card',
        billing: {
          first_name: na(buyer.firstName),
          last_name: na(buyer.lastName),
          email: buyer.email,
          phone_number: na(buyer.phone),
          apartment: 'NA',
          floor: 'NA',
          street: 'NA',
          building: 'NA',
          city: 'NA',
          state: 'NA',
          country: 'EG',
        },
        notificationUrl: `${this.backendUrl}/api/v1/payments/paymob/webhook`,
        redirectionUrl: `${this.backendUrl}/api/v1/payments/paymob/callback`,
      });
      await this.payments.updateById(payment.id, {
        intentionId: intention.intentionId,
        paymobOrderId: intention.paymobOrderId,
      });
      return { paymentId: payment.id, intentionId: intention.intentionId, checkoutUrl: intention.checkoutUrl };
    } catch (error) {
      await this.payments.updateById(payment.id, { status: PaymentStatus.FAILED });
      throw error;
    }
  }

  private async settleGiftCard(
    target: Extract<PaymentTarget, { kind: 'giftCard' }>,
    obj: PaymobTransaction,
    transactionId: string,
    payload: unknown,
  ): Promise<WebhookResult> {
    const { payment, giftCard } = target;
    if (Number(obj.amount_cents) !== payment.amountPiasters) {
      this.logger.warn(`Paymob amount mismatch for gift card payment ${payment.id}`);
      throw new BadRequestException('Amount does not match the gift card value');
    }
    if (obj.pending === true) return { received: true, ignored: 'pending', status: PaymentStatus.PENDING };
    const succeeded = obj.success === true && obj.error_occured !== true;
    const status = succeeded ? PaymentStatus.PAID : PaymentStatus.FAILED;
    let activated = false;
    try {
      activated = await this.tx.run(async (tx) => {
        await this.payments.withTx(tx).updateById(payment.id, {
          status,
          paymobTransactionId: transactionId,
          rawWebhookPayload: payload as Prisma.InputJsonValue,
        });
        return succeeded ? this.giftCards.withTx(tx).activateIfPending(giftCard.id) : false;
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { received: true, duplicate: true };
      throw error;
    }
    if (activated) this.events.emit(AppEvents.GIFT_CARD_PURCHASED, new GiftCardPurchasedEvent(giftCard.id));
    return { received: true, status };
  }

  // ───────────── 5.3 Browser redirect (never trusted for payment state) ─────────────

  async callbackRedirectUrl(query: Record<string, unknown>): Promise<string> {
    const target = `${this.frontendUrl}/checkout/result`;
    if (!verifyPaymobHmac(callbackHmacMessage(query), query.hmac, this.hmacSecret)) {
      return `${target}?status=invalid`;
    }
    const found = await this.findTarget({
      merchant_order_id: typeof query.merchant_order_id === 'string' ? query.merchant_order_id : undefined,
      order: { id: typeof query.order === 'string' ? query.order : undefined },
    });
    const params = new URLSearchParams({
      ...(found?.kind === 'order' ? { orderNumber: found.order.orderNumber } : {}),
      ...(found?.kind === 'giftCard' ? { giftCardPayment: found.payment.id } : {}),
      success: String(query.success === 'true' && query.pending !== 'true'),
      pending: String(query.pending === 'true'),
    });
    return `${target}?${params.toString()}`;
  }

  // ───────────── 5.4 Status ─────────────

  async statusForOrder(reference: string, user: AuthUser | undefined, contact: string | undefined) {
    const order = isUUID(reference)
      ? await this.orders.findById(reference)
      : await this.orders.findByNumber(reference.toUpperCase());
    if (!order || !canAccessOrder(order, user, contact)) throw new NotFoundException('Order not found');
    const payments = await this.payments.findForOrder(order.id);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      payments: payments.map(toPaymentModel),
    };
  }

  // ───────────── 5.5 Refund ─────────────

  async refundFromRequest(dto: RefundPaymentDto, audit: AuditContext): Promise<PaymentModel> {
    const order = await this.orders.findById(dto.orderId);
    if (!order) throw new NotFoundException('Order not found');
    const payment = await this.payments.findRefundable(order.id);
    if (!payment) throw new BadRequestException('This order has no captured online payment');
    return this.refundPayment(order, payment, dto.amountPiasters, audit, dto.reason);
  }

  /** Paymob refund first, then our records. Used by 5.5 and by order refunds (4.7). */
  async refundPayment(
    order: OrderEntity,
    payment: PaymentEntity,
    amount: number | undefined,
    audit: AuditContext,
    reason?: string,
  ): Promise<PaymentModel> {
    const refundable = payment.amountPiasters - payment.refundedPiasters;
    const value = amount ?? refundable;
    if (value <= 0 || value > refundable) {
      throw new BadRequestException(`You can refund at most ${refundable} piasters`);
    }
    const gatewayResponse = await this.gateway.refund(payment.paymobTransactionId!, value);

    const refunded = payment.refundedPiasters + value;
    const status = refunded >= payment.amountPiasters ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    const updated = await this.tx.run(async (tx) => {
      const row = await this.payments.withTx(tx).updateById(payment.id, { refundedPiasters: refunded, status });
      await this.orders.withTx(tx).updateById(order.id, { paymentStatus: status });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'PAYMENT_REFUNDED',
        entityType: 'Payment',
        entityId: payment.id,
        oldValues: { status: payment.status, refundedPiasters: payment.refundedPiasters },
        newValues: { status, refundedPiasters: refunded, amount: value, reason, gatewayResponse },
      });
      return row;
    });
    return toPaymentModel(updated);
  }

  // ───────────── Internals ─────────────

  /** What a Paymob transaction/redirect is about: an order, or a gift card purchase. */
  private async findTarget(obj: PaymobTransaction): Promise<PaymentTarget | null> {
    const reference = obj.special_reference ?? obj.merchant_order_id ?? obj.order?.merchant_order_id;
    let payment: PaymentEntity | null = null;
    if (reference && isUUID(reference)) payment = await this.payments.findById(reference);
    if (!payment && obj.order?.id !== undefined) payment = await this.payments.findByPaymobOrderId(String(obj.order.id));

    if (payment?.giftCardId) {
      const giftCard = await this.giftCards.findById(payment.giftCardId);
      return giftCard ? { kind: 'giftCard', payment, giftCard } : null;
    }
    let order = payment?.orderId ? await this.orders.findById(payment.orderId) : null;
    if (!order && reference && ORDER_NUMBER_PATTERN.test(reference)) {
      order = await this.orders.findByNumber(reference);
      if (order) payment = await this.payments.findLatestPending(order.id);
    }
    return order ? { kind: 'order', order, payment } : null;
  }

  private billingData(order: OrderEntity) {
    const address = order.shippingAddress as unknown as ShippingAddress;
    const [first, ...rest] = order.customerName.trim().split(/\s+/);
    const na = (v?: string) => (v && v.trim() ? v.trim() : 'NA');
    return {
      first_name: na(first),
      last_name: na(rest.join(' ')),
      email: order.customerEmail,
      phone_number: order.customerPhone,
      apartment: na(address.apartment),
      floor: na(address.floor),
      street: na(address.street),
      building: na(address.building),
      city: na(address.city),
      state: na(address.governorate),
      country: 'EG',
    };
  }
}

export function toPaymentModel(p: PaymentEntity): PaymentModel {
  return {
    id: p.id,
    provider: p.provider,
    status: p.status,
    amountPiasters: p.amountPiasters,
    refundedPiasters: p.refundedPiasters,
    currency: p.currency,
    paymobTransactionId: p.paymobTransactionId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
