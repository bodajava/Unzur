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
  nameAr: string | null;
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

/** One slice of the breakdown (money in piasters). `units` is only filled for categories. */
export interface BreakdownRow {
  key: string;
  orders: number;
  units: number;
  revenue: number;
}

export interface Breakdown {
  /** Every order in the period, any status (keys are OrderStatus). */
  byStatus: BreakdownRow[];
  /** Sales only from here on. Keys: PaymentMethod / governorate (English) / category name / weekday 0-6, Sunday = 0. */
  byPaymentMethod: BreakdownRow[];
  byGovernorate: BreakdownRow[];
  byCategory: BreakdownRow[];
  byWeekday: BreakdownRow[];
}

export interface TopCustomer {
  identifier: string;
  name: string;
  email: string;
  isRegistered: boolean;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string;
}

export interface CustomerAnalytics {
  newVsReturning: { newCount: number; returningCount: number };
  /** 0–1 */
  repeatPurchaseRate: number;
  topCustomers: TopCustomer[];
}

export type PerformanceSort = "revenue" | "unitsSold" | "conversionRate" | "views" | "refunds";

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
  nameAr: string | null;
  variantNameAr: string | null;
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
  /** One customer's orders: user id, or a guest's email. */
  customer?: string;
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

// ───────────────────────── products ─────────────────────────

export interface AdminImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface AdminVariant {
  id: string;
  name: string;
  nameAr: string | null;
  sku: string;
  price: number;
  salePrice: number | null;
  stock: number;
  attributes: Record<string, unknown> | null;
  isActive: boolean;
}

export interface AdminProduct {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  sku: string | null;
  description: string;
  shortDescription: string | null;
  shortDescriptionAr: string | null;
  descriptionAr: string | null;
  basePrice: number;
  salePrice: number | null;
  costPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string;
  brandId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; nameAr?: string | null; slug: string };
  brand: { id: string; name: string; slug: string; logoUrl: string | null } | null;
  images: AdminImage[];
  variants: AdminVariant[];
  stockStats: {
    productStock: number;
    variantStock: number;
    totalStock: number;
    activeVariants: number;
    isLowStock: boolean;
    isOutOfStock: boolean;
  };
}

export interface AdminProductQuery extends PageQuery {
  category?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  inStock?: boolean;
}

export interface VariantInput {
  name: string;
  nameAr?: string | null;
  sku: string;
  price: number;
  salePrice?: number | null;
  stock?: number;
  isActive?: boolean;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 10;

// ───────────────────────── catalog & store ─────────────────────────

export interface AdminCategory {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  description: string | null;
  descriptionAr: string | null;
  imageUrl: string | null;
  parentId: string | null;
  isActive: boolean;
  productCount: number;
}

export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  productCount: number;
}

export interface ShippingZone {
  id: string;
  governorate: string;
  nameAr: string | null;
  fee: number;
  estimatedDays: string;
  isActive: boolean;
}

export interface ShippingZoneInput {
  governorate: string;
  nameAr?: string | null;
  fee: number;
  estimatedDays: string;
  isActive?: boolean;
}

export interface StoreSetting {
  key: string;
  value: unknown;
  isPublic: boolean;
}

// ───────────────────────── customers & marketing ─────────────────────────

export interface CustomerEntry {
  /** User id, or the email for guest buyers. */
  identifier: string;
  name: string;
  email: string;
  phone: string | null;
  isRegistered: boolean;
  loyaltyPoints: number;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  firstSeenAt: string;
}

export interface CustomerDetail extends CustomerEntry {
  addresses: {
    id: string;
    label: string;
    fullName: string;
    phone: string;
    governorate: string;
    city: string;
    street: string;
    building: string | null;
    floor: string | null;
    apartment: string | null;
    isDefault: boolean;
  }[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  isRead: boolean;
  repliedAt: string | null;
  createdAt: string;
}

export type CouponStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE" | "EXHAUSTED";

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  /** 1-100 for PERCENTAGE, piasters for FIXED_AMOUNT. */
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  status: CouponStatus;
  createdAt: string;
}

export interface CouponInput {
  code: string;
  description?: string | null;
  discountType: Coupon["discountType"];
  discountValue: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number;
  startsAt: string;
  expiresAt: string;
  isActive?: boolean;
}

export type CouponTarget = "ALL_CUSTOMERS" | "SUBSCRIBERS" | "SPECIFIC_EMAILS";

export interface AdminGiftCard {
  id: string;
  code: string | null;
  initialBalance: number;
  currentBalance: number;
  usedPiasters: number;
  recipientEmail: string | null;
  message: string | null;
  expiresAt: string | null;
  isActive: boolean;
  source: "PURCHASE" | "ADMIN";
  paymentStatus: string | null;
  ordersCount: number;
  createdAt: string;
  purchasedBy: { id: string; email: string; firstName: string; lastName: string } | null;
}
