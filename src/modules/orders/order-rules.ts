import { randomInt } from 'node:crypto';
import { OrderStatus } from '../../common/enums/index.js';

/** Allowed manual moves (4.6). REFUNDED goes through 4.7, CANCELLED restores stock. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

/** Before shipping only (14.1). */
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
];

/** A refund (4.7) can close any order that was placed and not already closed. */
export const REFUNDABLE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  ORDER_TRANSITIONS[from].includes(to);

/** No 0/O/1/I so numbers read well over the phone. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** ORD-20261117-7KQ2MX (date in Cairo time is close enough; uses UTC). */
export function generateOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `ORD-${date}-${suffix}`;
}

export interface TotalsInput {
  subtotal: number;
  couponDiscount: number;
  shippingFee: number;
  /** Points the customer asked to use (already checked against their balance) */
  pointsRequested: number;
  /** Piasters per point */
  pointValue: number;
  giftCardBalance: number;
}

export interface Totals {
  subtotal: number;
  discountAmount: number;
  loyaltyPointsUsed: number;
  loyaltyDiscount: number;
  shippingCost: number;
  giftCardAmount: number;
  totalAmount: number;
}

/**
 * All in piasters. Order: coupon, then loyalty points (on goods only, never
 * more than what is left), then shipping, then the gift card covers what
 * remains (shipping included). Nothing goes below 0.
 */
export function computeTotals(i: TotalsInput): Totals {
  const discountAmount = Math.min(Math.max(i.couponDiscount, 0), i.subtotal);
  const goods = i.subtotal - discountAmount;
  const loyaltyPointsUsed = Math.min(i.pointsRequested, Math.floor(goods / i.pointValue));
  const loyaltyDiscount = loyaltyPointsUsed * i.pointValue;
  const beforeGiftCard = goods - loyaltyDiscount + i.shippingFee;
  const giftCardAmount = Math.min(i.giftCardBalance, beforeGiftCard);
  return {
    subtotal: i.subtotal,
    discountAmount,
    loyaltyPointsUsed,
    loyaltyDiscount,
    shippingCost: i.shippingFee,
    giftCardAmount,
    totalAmount: beforeGiftCard - giftCardAmount,
  };
}

/** Points earned on delivery: 1 per `earnRate` piasters of goods paid (shipping excluded). */
export function pointsEarned(order: { totalAmount: number; shippingCost: number }, earnRate: number): number {
  return Math.max(0, Math.floor((order.totalAmount - order.shippingCost) / earnRate));
}
