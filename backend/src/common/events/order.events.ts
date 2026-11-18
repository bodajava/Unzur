import type { OrderStatus } from '../enums/prisma.enums.js';

export class OrderCreatedEvent {
  constructor(
    readonly orderId: string,
    readonly orderNumber: string,
    readonly customerEmail: string,
  ) {}
}

export class OrderStatusChangedEvent {
  constructor(
    readonly orderId: string,
    readonly from: OrderStatus | null,
    readonly to: OrderStatus,
  ) {}
}

/** Paymob confirmed the payment (webhook). */
export class PaymentSucceededEvent {
  constructor(
    readonly orderId: string,
    readonly amountPiasters: number,
  ) {}
}

/** A purchased gift card was paid and activated (18.1). */
export class GiftCardPurchasedEvent {
  constructor(readonly giftCardId: string) {}
}
