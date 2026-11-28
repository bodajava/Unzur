import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LoyaltyType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../common/enums/index.js';
import { AppEvents, OrderCreatedEvent } from '../../common/events/index.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { normalizePhone } from '../../common/utilities/phone.js';
import type { DbClient } from '../../models/prisma.service.js';
import { isUniqueViolation } from '../../models/prisma-errors.js';
import { CartItemRepository } from '../../models/repositories/cart-item.repository.js';
import { CartRepository } from '../../models/repositories/cart.repository.js';
import { CouponUsageRepository } from '../../models/repositories/coupon-usage.repository.js';
import { CouponRepository } from '../../models/repositories/coupon.repository.js';
import { GiftCardRepository } from '../../models/repositories/gift-card.repository.js';
import { LoyaltyTransactionRepository } from '../../models/repositories/loyalty-transaction.repository.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { UserRepository } from '../../models/repositories/user.repository.js';
import type { CartDetailItemRow, CartOwner } from '../../models/schemas/cart.schema.js';
import type { CouponEntity } from '../../models/schemas/coupon.schema.js';
import type { GiftCardEntity } from '../../models/schemas/gift-card.schema.js';
import type { ShippingAddress } from '../../models/schemas/order.schema.js';
import { priceCartLines } from '../cart/cart-pricing.js';
import { CouponEvaluator } from '../coupons/coupon-evaluator.service.js';
import { giftCardProblem, normalizeGiftCardCode } from '../gift-cards/gift-card-rules.js';
import { PaymentsService } from '../payments/payments.service.js';
import { SettingKey, SETTING_DEFAULTS } from '../settings/setting-rules.js';
import { SettingsService } from '../settings/settings.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import type { CheckoutDto } from './dto/index.js';
import type { CheckoutResultModel } from './entities/order.model.js';
import { computeTotals, generateOrderNumber, type Totals } from './order-rules.js';

const ONLINE = [PaymentMethod.PAYMOB_CARD, PaymentMethod.PAYMOB_WALLET] as PaymentMethod[];
/** Waiting for row locks under load is fine; a stuck checkout is not. */
const CHECKOUT_TX = { maxWait: 10_000, timeout: 20_000 };
const ORDER_NUMBER_ATTEMPTS = 3;

/** Sums quantities per key (a product may appear on several cart lines). */
function sumBy(lines: CartDetailItemRow[], key: (l: CartDetailItemRow) => string | null) {
  const totals = new Map<string, { quantity: number; name: string }>();
  for (const line of lines) {
    const k = key(line);
    if (!k) continue;
    const name = line.variant ? `${line.product.name} (${line.variant.name})` : line.product.name;
    const cur = totals.get(k);
    totals.set(k, { quantity: (cur?.quantity ?? 0) + line.quantity, name });
  }
  return totals;
}

/**
 * 4.1 / 1.10 checkout. Everything that changes stock or money happens in one
 * transaction after locking the product and variant rows (ids sorted), so two
 * buyers of the last unit cannot both succeed.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly carts: CartRepository,
    private readonly cartItems: CartItemRepository,
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
    private readonly orders: OrderRepository,
    private readonly coupons: CouponRepository,
    private readonly couponUsages: CouponUsageRepository,
    private readonly giftCards: GiftCardRepository,
    private readonly users: UserRepository,
    private readonly loyalty: LoyaltyTransactionRepository,
    private readonly tx: TransactionManager,
    private readonly couponEvaluator: CouponEvaluator,
    private readonly shipping: ShippingService,
    private readonly settings: SettingsService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  async checkout(dto: CheckoutDto, actor: Actor): Promise<CheckoutResultModel> {
    const owner: CartOwner | null = actor.userId
      ? { userId: actor.userId }
      : actor.guestId
        ? { guestId: actor.guestId }
        : null;
    if (!owner) throw new BadRequestException('Your cart is empty');
    if (dto.redeemLoyaltyPoints && !actor.userId) {
      throw new BadRequestException('Log in to use loyalty points');
    }
    const pointValue = dto.redeemLoyaltyPoints
      ? await this.settings.getInt(SettingKey.LOYALTY_POINT_VALUE, SETTING_DEFAULTS[SettingKey.LOYALTY_POINT_VALUE])
      : 1;

    let lastError: unknown;
    for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt++) {
      try {
        const placed = await this.tx.run((tx) => this.placeOrder(tx, dto, actor, owner, pointValue), CHECKOUT_TX);
        return await this.afterCommit(placed.orderId, placed.totals.loyaltyPointsUsed);
      } catch (error) {
        // Only an order-number collision is retried (everything was rolled back).
        if (!isUniqueViolation(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  private async placeOrder(tx: DbClient, dto: CheckoutDto, actor: Actor, owner: CartOwner, pointValue: number) {
    const cartRepo = this.carts.withTx(tx);
    const preview = await cartRepo.findByOwner(owner);
    if (!preview) throw new BadRequestException('Your cart is empty');

    // 1. Lock rows (products first, then variants; ids ascending in both).
    const cartLines = await this.cartItems.withTx(tx).find({ cartId: preview.id });
    if (!cartLines.length) throw new BadRequestException('Your cart is empty');
    const lockedProducts = await this.products.withTx(tx).lockForUpdate(cartLines.map((l) => l.productId));
    const lockedVariants = await this.variants
      .withTx(tx)
      .lockForUpdate(cartLines.map((l) => l.variantId).filter((id): id is string => !!id));

    // Read the cart again under the locks: prices and stock are now final.
    const cart = await cartRepo.findDetailByOwner(owner);
    // A parallel checkout of the same cart may have emptied it while we waited.
    if (!cart?.items.length) throw new BadRequestException('Your cart is empty');
    const priced = priceCartLines(cart.items);
    const unavailable = priced.lines.find((l) => !l.isAvailable);
    if (unavailable) {
      throw new BadRequestException(`"${unavailable.product.name}" is no longer available. Remove it to continue.`);
    }

    // 2. Live stock check on the locked rows.
    const productStock = new Map(lockedProducts.map((p) => [p.id, p]));
    const variantStock = new Map(lockedVariants.map((v) => [v.id, v]));
    const productNeeds = sumBy(cart.items, (l) => (l.variantId ? null : l.productId));
    const variantNeeds = sumBy(cart.items, (l) => l.variantId);
    for (const [id, need] of productNeeds) {
      const row = productStock.get(id);
      if (!row || row.stock < need.quantity) throw this.soldOut(need.name, row?.stock ?? 0);
    }
    for (const [id, need] of variantNeeds) {
      const row = variantStock.get(id);
      if (!row || !row.is_active || row.stock < need.quantity) throw this.soldOut(need.name, row?.stock ?? 0);
    }

    // Prices, shipping, coupon, gift card, points.
    const subtotal = priced.subtotal;
    const rate = await this.shipping.rate(dto.governorate, subtotal).catch((error: unknown) => {
      if (error instanceof NotFoundException) throw new BadRequestException(error.message);
      throw error;
    });

    const couponCode = dto.couponCode ?? cart.couponCode ?? undefined;
    let coupon: CouponEntity | null = null;
    let couponDiscount = 0;
    if (couponCode) {
      const result = await this.couponEvaluator.evaluate(couponCode, subtotal, {
        userId: actor.userId,
        guestId: actor.userId ? undefined : actor.guestId,
        email: dto.customerEmail,
      });
      if (!result.ok) throw new BadRequestException(`Coupon ${couponCode.toUpperCase()}: ${result.reason}`);
      coupon = result.coupon;
      couponDiscount = result.discountAmount;
    }

    let giftCard: GiftCardEntity | null = null;
    if (dto.giftCardCode) {
      giftCard = await this.giftCards.withTx(tx).findByCode(normalizeGiftCardCode(dto.giftCardCode));
      const problem = giftCardProblem(giftCard);
      if (problem) throw new BadRequestException(problem);
    }

    if (dto.redeemLoyaltyPoints) {
      const available = await this.users.withTx(tx).loyaltyPoints(actor.userId!);
      if (dto.redeemLoyaltyPoints > available) {
        throw new BadRequestException(`You have ${available} loyalty points`);
      }
    }

    const totals: Totals = computeTotals({
      subtotal,
      couponDiscount,
      shippingFee: rate.fee,
      pointsRequested: dto.redeemLoyaltyPoints ?? 0,
      pointValue,
      giftCardBalance: giftCard?.currentBalance ?? 0,
    });

    // 3. Take the stock (conditional decrements: never below 0).
    for (const [id, need] of productNeeds) {
      if (!(await this.products.withTx(tx).decrementStock(id, need.quantity))) throw this.soldOut(need.name, 0);
    }
    for (const [id, need] of variantNeeds) {
      if (!(await this.variants.withTx(tx).decrementStock(id, need.quantity))) throw this.soldOut(need.name, 0);
    }

    // 4-6. Order, item snapshots, first history entry.
    const online = ONLINE.includes(dto.paymentMethod);
    const nothingToPay = totals.totalAmount === 0;
    const status = online && !nothingToPay ? OrderStatus.PENDING_PAYMENT : OrderStatus.CONFIRMED;
    const paymentStatus = nothingToPay
      ? PaymentStatus.PAID
      : online
        ? PaymentStatus.PENDING
        : PaymentStatus.UNPAID;
    const address: ShippingAddress = {
      governorate: rate.governorate,
      city: dto.city,
      street: dto.street,
      ...(dto.building ? { building: dto.building } : {}),
      ...(dto.floor ? { floor: dto.floor } : {}),
      ...(dto.apartment ? { apartment: dto.apartment } : {}),
    };

    const order = await this.orders.withTx(tx).create({
      orderNumber: generateOrderNumber(),
      userId: actor.userId ?? null,
      guestId: actor.userId ? null : (actor.guestId ?? null),
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: normalizePhone(dto.customerPhone),
      shippingAddress: { ...address },
      shippingZoneId: rate.zoneId,
      subtotal: totals.subtotal,
      shippingCost: totals.shippingCost,
      discountAmount: totals.discountAmount,
      giftCardAmount: totals.giftCardAmount,
      giftCardId: totals.giftCardAmount > 0 ? giftCard!.id : null,
      loyaltyDiscount: totals.loyaltyDiscount,
      totalAmount: totals.totalAmount,
      paymentMethod: dto.paymentMethod,
      paymentStatus,
      status,
      couponCode: coupon?.code ?? null,
      notes: dto.notes ?? null,
      items: {
        create: priced.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          productName: line.product.name,
          variantName: line.variant?.name ?? null,
          productNameAr: line.product.nameAr ?? null,
          variantNameAr: line.variant?.nameAr ?? null,
          priceAtPurchase: line.unitPrice,
          imageUrl: line.product.primaryImage?.url ?? null,
          choice: line.choice ?? null,
          quantity: line.quantity,
        })),
      },
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: status,
          note: status === OrderStatus.PENDING_PAYMENT ? 'Order placed, waiting for payment' : 'Order placed',
          changedById: actor.userId ?? null,
        },
      },
    });

    // 7. Coupon usage (global limit enforced atomically).
    if (coupon) {
      if (!(await this.coupons.withTx(tx).incrementUsage(coupon.id))) {
        throw new ConflictException(`Coupon ${coupon.code} has reached its usage limit`);
      }
      // The UPDATE above holds the coupon row lock until commit, so two checkouts
      // by the same customer run this one at a time: the second sees the first's
      // usage here and is refused (the per-customer check before the transaction
      // can't see an order that is still being placed).
      const used = await this.couponUsages.withTx(tx).countForRedeemer(coupon.id, {
        userId: actor.userId,
        guestId: actor.userId ? undefined : actor.guestId,
        email: dto.customerEmail,
      });
      if (used >= coupon.perUserLimit) {
        throw new ConflictException(`Coupon ${coupon.code}: You have already used this coupon`);
      }
      await this.couponUsages.withTx(tx).create({
        couponId: coupon.id,
        orderId: order.id,
        userId: actor.userId ?? null,
        guestId: actor.userId ? null : (actor.guestId ?? null),
        customerEmail: dto.customerEmail,
        discountApplied: totals.discountAmount,
      });
    }

    // 8. Gift card balance.
    if (giftCard && totals.giftCardAmount > 0) {
      if (!(await this.giftCards.withTx(tx).debit(giftCard.id, totals.giftCardAmount))) {
        throw new ConflictException('The gift card balance changed. Please try again.');
      }
    }

    // 9. Loyalty points.
    if (totals.loyaltyPointsUsed > 0) {
      if (!(await this.users.withTx(tx).debitLoyalty(actor.userId!, totals.loyaltyPointsUsed))) {
        throw new ConflictException('Your loyalty points changed. Please try again.');
      }
      await this.loyalty.withTx(tx).create({
        userId: actor.userId!,
        orderId: order.id,
        points: -totals.loyaltyPointsUsed,
        type: LoyaltyType.REDEEMED_DISCOUNT,
        description: `Redeemed on order ${order.orderNumber}`,
      });
    }

    // 10. Empty the cart.
    await this.cartItems.withTx(tx).deleteMany({ cartId: cart.id });
    await cartRepo.updateById(cart.id, { couponCode: null });

    return { orderId: order.id, totals };
  }

  private async afterCommit(orderId: string, loyaltyPointsUsed: number): Promise<CheckoutResultModel> {
    const order = (await this.orders.findById(orderId))!;
    this.events.emit(
      AppEvents.ORDER_CREATED,
      new OrderCreatedEvent(order.id, order.orderNumber, order.customerEmail),
    );

    let payment: CheckoutResultModel['payment'] = null;
    let paymentError: string | null = null;
    if (order.status === OrderStatus.PENDING_PAYMENT) {
      try {
        payment = await this.payments.initiateForOrder(order);
      } catch (error) {
        // The order stands; the customer can retry via POST /payments/paymob/initiate.
        paymentError = (error as Error).message;
        this.logger.warn(`Payment start failed for ${order.orderNumber}: ${paymentError}`);
      }
    }
    const view = (await this.orders.findCustomerView(orderId))!;
    return { order: view, payment, paymentError, loyaltyPointsUsed };
  }

  private soldOut(name: string, left: number): ConflictException {
    return new ConflictException(
      left > 0 ? `Only ${left} left of "${name}"` : `"${name}" is sold out`,
    );
  }
}
