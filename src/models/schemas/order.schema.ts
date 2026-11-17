import type { Order, Prisma } from '../../generated/prisma/client.js';

export type { Order };

/** Row shape returned by default queries. */
export type OrderEntity = Order;

const ORDER_ITEM_SELECT = {
  id: true,
  productId: true,
  variantId: true,
  productName: true,
  variantName: true,
  priceAtPurchase: true,
  imageUrl: true,
  quantity: true,
} as const satisfies Prisma.OrderItemSelect;

const HISTORY_SELECT = {
  id: true,
  fromStatus: true,
  toStatus: true,
  note: true,
  createdAt: true,
} as const satisfies Prisma.OrderStatusHistorySelect;

/** Money/status fields shared by every order view. */
const ORDER_CORE_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  subtotal: true,
  shippingCost: true,
  discountAmount: true,
  giftCardAmount: true,
  loyaltyDiscount: true,
  totalAmount: true,
  couponCode: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.OrderSelect;

/**
 * What a customer sees (my-orders, tracking, checkout result). Only the
 * delivery area of the address; no internal ids of other people.
 */
export const ORDER_CUSTOMER_SELECT = {
  ...ORDER_CORE_SELECT,
  customerName: true,
  shippingAddress: true,
  notes: true,
  cancelOrRefundReason: true,
  items: { select: ORDER_ITEM_SELECT, orderBy: { createdAt: 'asc' } },
  statusHistory: { select: HISTORY_SELECT, orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.OrderSelect;

export type OrderCustomerRow = Prisma.OrderGetPayload<{ select: typeof ORDER_CUSTOMER_SELECT }>;

/** Admin list row. */
export const ORDER_ADMIN_LIST_SELECT = {
  ...ORDER_CORE_SELECT,
  userId: true,
  guestId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  shippingAddress: true,
  _count: { select: { items: true } },
} as const satisfies Prisma.OrderSelect;

export type OrderAdminListRow = Prisma.OrderGetPayload<{ select: typeof ORDER_ADMIN_LIST_SELECT }>;

/** Admin detail: everything incl. payments, history with who changed it. */
export const ORDER_ADMIN_DETAIL_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { createdAt: 'asc' } },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    include: { changedBy: { select: { id: true, firstName: true, lastName: true, role: true } } },
  },
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
  shippingZone: { select: { id: true, governorate: true, nameAr: true } },
  couponUsage: { select: { couponId: true, discountApplied: true } },
} as const satisfies Prisma.OrderInclude;

export type OrderAdminDetailRow = Prisma.OrderGetPayload<{ include: typeof ORDER_ADMIN_DETAIL_INCLUDE }>;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

export const ORDER_SORT_FIELDS = ['createdAt', 'totalAmount', 'status', 'orderNumber'] as const;

/** Stored as orders.shipping_address (JSON). */
export interface ShippingAddress {
  governorate: string;
  city: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
}
