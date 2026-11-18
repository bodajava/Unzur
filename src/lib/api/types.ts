/**
 * Shapes returned by the UNZUR API (backend /api/v1). Money is always in
 * piasters (100 = 1 EGP). Dates are ISO strings.
 */

// ───────────────────────── envelope & paging ─────────────────────────

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
  errors?: unknown;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/** ?page=&limit=&sort=&search= ("-field" sorts descending). */
export interface PageQuery {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

// ───────────────────────── enums ─────────────────────────

export type OrderStatus = "PENDING_PAYMENT" | "CONFIRMED" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type PaymentMethod = "COD" | "PAYMOB_CARD" | "PAYMOB_WALLET";
export type OnlinePaymentMethod = Exclude<PaymentMethod, "COD">;
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN" | "SUPER_ADMIN";

// ───────────────────────── catalog ─────────────────────────

export interface ImageRef {
  id: string;
  url: string;
  altText: string | null;
}

export interface BrandRef {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface CategoryRef {
  id: string;
  name: string;
  /** Arabic name (optional): pages in Arabic use it, falling back to `name`. */
  nameAr?: string | null;
  slug: string;
}

export interface ProductCard {
  id: string;
  name: string;
  /** Arabic name (optional): pages in Arabic use it, falling back to `name`. */
  nameAr?: string | null;
  slug: string;
  shortDescription: string | null;
  shortDescriptionAr?: string | null;
  basePrice: number;
  salePrice: number | null;
  stock: number;
  isFeatured: boolean;
  createdAt: string;
  category: CategoryRef;
  brand: BrandRef | null;
  primaryImage: ImageRef | null;
  /** Active versions (empty when the product has none). */
  variants: CardVariant[];
}

export interface CardVariant {
  id: string;
  name: string;
  /** Arabic name (optional): pages in Arabic use it, falling back to `name`. */
  nameAr?: string | null;
  price: number;
  salePrice: number | null;
  stock: number;
}

export interface ProductImage extends ImageRef {
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  /** Arabic name (optional): pages in Arabic use it, falling back to `name`. */
  nameAr?: string | null;
  sku: string;
  price: number;
  salePrice: number | null;
  stock: number;
  attributes: Record<string, unknown> | null;
}

export interface ProductDetail extends Omit<ProductCard, "primaryImage" | "variants"> {
  sku: string;
  description: string | null;
  descriptionAr?: string | null;
  categoryId: string;
  brandId: string | null;
  updatedAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
  averageRating: number | null;
  reviewCount: number;
  relatedProducts: ProductCard[];
}

export interface Recommendation extends ProductCard {
  reason: string;
}

/** GET /products?category=&brand=&minPrice=&maxPrice=&isFeatured=&inStock= */
export interface ProductQuery extends PageQuery {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  inStock?: boolean;
}

export interface CategoryNode {
  id: string;
  name: string;
  /** Arabic name (optional): pages in Arabic use it, falling back to `name`. */
  nameAr?: string | null;
  slug: string;
  description: string | null;
  descriptionAr?: string | null;
  imageUrl: string | null;
  parentId: string | null;
  children: CategoryNode[];
}

export interface Brand extends BrandRef {
  description?: string | null;
}

export interface Suggestion {
  id: string;
  name: string;
  /** Arabic name (optional): pages in Arabic use it, falling back to `name`. */
  nameAr?: string | null;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  primaryImage: ImageRef | null;
}

// ───────────────────────── reviews ─────────────────────────

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  /** "First L." style name chosen by the API. */
  reviewerName: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface ReviewPage extends Paginated<Review> {
  ratingSummary: {
    averageRating: number | null;
    totalReviews: number;
    breakdown: { stars: number; count: number }[];
  };
}

export interface CreateReviewInput {
  rating: number;
  title?: string;
  comment?: string;
}

// ───────────────────────── cart ─────────────────────────

export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  product: { id: string; name: string; nameAr?: string | null; slug: string; primaryImage: ImageRef | null };
  variant: { id: string; name: string; nameAr?: string | null; sku: string; attributes: unknown } | null;
  unitPrice: number;
  originalUnitPrice: number;
  lineTotal: number;
  availableStock: number;
  isAvailable: boolean;
  inStock: boolean;
  hasEnoughStock: boolean;
}

export interface AppliedCoupon {
  code: string;
  valid: boolean;
  discountType: DiscountType | null;
  discountValue: number | null;
  discountAmount: number;
  message: string | null;
}

export interface Cart {
  id: string | null;
  guestId: string | null;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  coupon: AppliedCoupon | null;
  discountAmount: number;
  estimatedTotal: number;
  canCheckout: boolean;
  issues: string[];
}

export interface AddToCartInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

// ───────────────────────── checkout & orders ─────────────────────────

export interface ShippingRate {
  zoneId: string;
  governorate: string;
  nameAr: string | null;
  /** What the customer pays (0 when free shipping applies). */
  fee: number;
  originalFee: number;
  isFreeShipping: boolean;
  freeShippingThreshold: number | null;
  /** How much more to spend for free shipping (null when there is no threshold). */
  amountToFreeShipping: number | null;
  estimatedDays: string;
}

export interface CouponValidation {
  valid: boolean;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  subtotal: number;
  discountAmount: number;
  totalAfterDiscount: number;
  appliedToCart: boolean;
}

export interface ValidateCouponInput {
  code: string;
  cartSubtotal?: number;
  email?: string;
  /** true also attaches the coupon to the current cart. */
  applyToCart?: boolean;
}

export interface GiftCardPreview {
  code: string;
  isValid: boolean;
  currentBalance: number;
  expiresAt: string | null;
  message: string | null;
}

export interface CheckoutInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  governorate: string;
  city: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  giftCardCode?: string;
  redeemLoyaltyPoints?: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  productNameAr?: string | null;
  variantNameAr?: string | null;
  priceAtPurchase: number;
  imageUrl: string | null;
  quantity: number;
}

export interface OrderEvent {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
}

/** Customer views (tracking, my orders) only include the delivery area. */
export interface ShippingAddress {
  governorate: string;
  city: string;
  street?: string;
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  [extra: string]: unknown;
}

export interface Order {
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
  customerName: string;
  shippingAddress: ShippingAddress;
  notes: string | null;
  cancelOrRefundReason: string | null;
  items: OrderItem[];
  statusHistory: OrderEvent[];
}

export interface PaymentSession {
  paymentId: string;
  intentionId: string;
  /** Send the visitor here to pay (Paymob hosted checkout). */
  checkoutUrl: string;
}

export interface CheckoutResult {
  order: Order;
  /** Present for card / wallet orders. */
  payment: PaymentSession | null;
  /** The order exists but the payment link could not be created; offer "pay again". */
  paymentError: string | null;
  loyaltyPointsUsed: number;
}

export interface Payment {
  id: string;
  provider: string;
  status: string;
  amountPiasters: number;
  refundedPiasters: number;
  currency: string;
  paymobTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderPaymentStatus {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  payments: Payment[];
}

export interface InitiatePaymentInput {
  orderId: string;
  paymentMethod?: OnlinePaymentMethod;
  /** Guests prove the order is theirs with its email or phone. */
  contact?: string;
}

// ───────────────────────── account ─────────────────────────

export interface User {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  loyaltyPoints: number;
  referralCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  tokenType: "Bearer";
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResult extends AuthTokens {
  user: User;
}

export interface RegisterResult {
  user: User;
  requiresEmailVerification: true;
}

export interface GuestSession {
  guestId: string;
  [extra: string]: unknown;
}

export interface RegisterInput {
  email: string;
  password: string;
  /** Optional: the API derives a name from the email. */
  firstName?: string;
  lastName?: string;
  phone?: string;
  referralCode?: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  /** null removes the phone number. */
  phone?: string | null;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AddressInput = Pick<Address, "label" | "fullName" | "phone" | "governorate" | "city" | "street"> &
  Partial<Pick<Address, "building" | "floor" | "apartment" | "notes">> & { isDefault?: boolean };

export interface WishlistItem {
  id: string;
  productId: string;
  addedAt: string;
  product: ProductCard;
  /** false when the product was hidden or deleted after it was saved. */
  isAvailable: boolean;
  inStock: boolean;
}

export interface WishlistToggle {
  productId: string;
  inWishlist: boolean;
  /** false when it was already in (or already out of) the wishlist. */
  changed: boolean;
}

export interface LoyaltyEntry {
  id: string;
  points: number;
  type: string;
  description: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface LoyaltySummary {
  points: number;
  valuePiasters: number;
  pointValuePiasters: number;
  minRedeemPoints: number;
  history: LoyaltyEntry[];
  meta: PaginationMeta;
}

export interface LoyaltyRedemption {
  couponCode: string;
  discountValue: number;
  expiresAt: string;
  pointsRedeemed: number;
  remainingPoints: number;
}

export interface ReferralSummary {
  referralCode: string;
  totalReferrals: number;
  rewardedReferrals: number;
  bonusPoints: number;
  canApplyCode: boolean;
  referrals: { id: string; name: string; rewarded: boolean; joinedAt: string }[];
}

export interface ReferralApplied {
  applied: boolean;
  bonusPoints: number;
  yourPoints: number;
}

export interface GiftCard {
  id: string;
  code: string | null;
  initialBalance: number;
  currentBalance: number;
  recipientEmail: string | null;
  message: string | null;
  expiresAt: string | null;
  isActive: boolean;
  source: "PURCHASE" | "ADMIN";
  paymentStatus: string | null;
  usedPiasters: number;
  ordersCount: number;
  createdAt: string;
  [extra: string]: unknown;
}

export interface GiftCardPurchaseInput {
  amountPiasters: number;
  recipientEmail?: string;
  message?: string;
  paymentMethod?: OnlinePaymentMethod;
}

export interface GiftCardPurchase {
  giftCard: {
    id: string;
    amountPiasters: number;
    recipientEmail: string | null;
    expiresAt: string | null;
    status: "PENDING_PAYMENT";
  };
  payment: PaymentSession | null;
}

// ───────────────────────── store, support, AI ─────────────────────────

/** GET /settings/public: whatever the admin chose to expose (key -> value). */
export type PublicSettings = Record<string, unknown>;

export interface SubscribeResult {
  email: string;
  subscribed: boolean;
  result: "CREATED" | "REACTIVATED" | "ALREADY_SUBSCRIBED";
}

export interface ContactInput {
  /** Optional: the API uses the email's name part. */
  name?: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CustomerChatInput {
  message: string;
  history?: ChatMessage[];
  productId?: string;
}

export interface CustomerChatResult {
  reply: string;
  recommendedProducts: ProductCard[];
  source: string;
}
