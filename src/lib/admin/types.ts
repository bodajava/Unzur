import type { OrderEvent, OrderItem, OrderStatus, PageQuery, PaymentMethod, PaymentStatus, UserRole } from "@/lib/api/types";

/** Shapes from the admin endpoints (money in piasters). */

export const STAFF_ROLES: UserRole[] = ["STAFF", "ADMIN", "SUPER_ADMIN"];
export const ADMIN_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

export interface DateRange {
  fromDate?: string;
  toDate?: string;
}

export interface Overview {
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  guestOrdersCount: number;
  conversionRate: number;
  visitors: number;
  pendingOrdersCount: number;
  /** Change vs the previous period of the same length (%), null when there's nothing to compare. */
  deltas: { revenue: number | null; orders: number | null; averageOrderValue: number | null; customers: number | null };
}

export type Granularity = "day" | "week" | "month";

export interface TrendPoint {
  period: string;
  revenue: number;
  ordersCount: number;
  averageOrderValue: number;
}

export interface ProductPerformance {
  productId: string;
  name: string;
  slug: string;
  isActive: boolean;
  viewsCount: number;
  unitsSold: number;
  conversionRate: number;
  revenue: number;
  costPrice: number | null;
  currentPrice: number;
  estimatedProfit: number;
  averageRating: number | null;
  reviewCount: number;
  refundCount: number;
  cancellationCount: number;
  stock: number;
  lowStockThreshold: number;
}

export interface Insight {
  severity: "HIGH" | "MEDIUM" | "INFO";
  category: string;
  title: string;
  description: string;
  productId: string | null;
  metricValue: number;
}

export interface LowStockItem {
  type: "PRODUCT" | "VARIANT";
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  slug: string;
  stock: number;
  threshold: number;
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  giftCardAmount: number;
  loyaltyDiscount: number;
  totalAmount: number;
  couponCode: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  guestId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: Record<string, string | null | undefined>;
  itemCount: number;
}

export interface AdminPayment {
  id: string;
  provider: string;
  status: string;
  amountPiasters: number;
  refundedPiasters: number;
  currency: string;
  paymobTransactionId: string | null;
  createdAt: string;
}

export interface AdminOrderEvent extends OrderEvent {
  changedBy: { id: string; firstName: string; lastName: string; role: UserRole } | null;
}

export interface AdminOrder extends AdminOrderRow {
  notes: string | null;
  cancelOrRefundReason: string | null;
  items: OrderItem[];
  payments: AdminPayment[];
  statusHistory: AdminOrderEvent[];
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null } | null;
}

export interface OrderListQuery extends PageQuery, DateRange {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
}

/** Manual status moves the API allows (refund has its own action). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};
export const REFUNDABLE: OrderStatus[] = ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"];
