"use client";

import { api, apiBlob, qs } from "./client";
import { clearSession, forgetGuestId, rememberGuestId, setSession } from "./session";
import type {
  AddToCartInput,
  Address,
  AddressInput,
  AuthResult,
  AuthTokens,
  Brand,
  Cart,
  CategoryNode,
  CheckoutInput,
  CheckoutResult,
  ContactInput,
  CouponValidation,
  CreateReviewInput,
  CustomerChatInput,
  CustomerChatResult,
  GiftCard,
  GiftCardPreview,
  GiftCardPurchase,
  GiftCardPurchaseInput,
  GuestSession,
  InitiatePaymentInput,
  LoyaltyRedemption,
  LoyaltySummary,
  Order,
  OrderEvent,
  OrderPaymentStatus,
  OrderStatus,
  PageQuery,
  Paginated,
  PaymentSession,
  ProductCard,
  ProductDetail,
  ProductQuery,
  PaymentMethod,
  PublicSettings,
  Recommendation,
  ReferralApplied,
  ReferralSummary,
  RegisterInput,
  RegisterResult,
  Review,
  ReviewPage,
  ShippingRate,
  SubscribeResult,
  Suggestion,
  UpdateProfileInput,
  User,
  ValidateCouponInput,
  WishlistItem,
  WishlistToggle,
} from "./types";

/*
 * Every storefront endpoint of the UNZUR API, one function each.
 * Numbers in comments are the API spec sections. Admin endpoints live with
 * the dashboard, not here.
 */

const enc = encodeURIComponent;

// ───────────────────────── 1 · auth & session ─────────────────────────

export const authApi = {
  /** 1.1 Creates the account; a 6-digit code is emailed. */
  register: (input: RegisterInput) => api<RegisterResult>("/auth/register", { method: "POST", json: input, anonymous: true }),

  /** 1.2 Confirms the email and signs in. */
  verifyOtp: async (email: string, code: string) => {
    const result = await api<AuthResult>("/auth/verify-otp", { method: "POST", json: { email, code }, anonymous: true });
    setSession(result);
    return result;
  },

  /** 1.3 Signs in (the guest cart is merged into the account). */
  login: async (email: string, password: string) => {
    const result = await api<AuthResult>("/auth/login", { method: "POST", json: { email, password }, anonymous: true });
    setSession(result);
    return result;
  },

  /** 1.5 Always "ok" (does not reveal whether the email exists). */
  forgotPassword: (email: string) => api<Record<string, never>>("/auth/forgot-password", { method: "POST", json: { email }, anonymous: true }),

  /** 1.6 Sets a new password with the emailed code. All sessions are signed out. */
  resetPassword: async (email: string, code: string, newPassword: string) => {
    const result = await api<Record<string, never>>("/auth/reset-password", {
      method: "POST",
      json: { email, code, newPassword },
      anonymous: true,
    });
    clearSession();
    return result;
  },

  /** 1.7 Signs out here and forgets the guest cart id. */
  logout: async () => {
    try {
      await api<Record<string, never>>("/auth/logout", { method: "POST", json: {} });
    } finally {
      clearSession();
      forgetGuestId();
    }
  },

  /** 1.8 */
  me: () => api<User>("/auth/me"),

  /** 10.1 */
  updateMe: (input: UpdateProfileInput) => api<User>("/auth/me", { method: "PATCH", json: input }),

  /** 10.2 Other sessions are signed out; this one gets fresh tokens. */
  changePassword: async (currentPassword: string, newPassword: string) => {
    const tokens = await api<AuthTokens>("/auth/change-password", { method: "PATCH", json: { currentPassword, newPassword } });
    setSession(tokens);
    return tokens;
  },

  /** 1.9 Makes sure this browser has a guest id (cart before sign-in). */
  guestSession: async () => {
    const session = await api<GuestSession>("/auth/guest/session", { method: "POST", json: {} });
    rememberGuestId(session.guestId);
    return session;
  },
};

// ───────────────────────── 2 · catalog & discovery ─────────────────────────

export const catalogApi = {
  /** 2.x Product list with filters. */
  products: (query: ProductQuery = {}) => api<Paginated<ProductCard>>(`/products${qs({ ...query })}`),
  /** 2.x Product page (by slug). Also records "recently viewed" for this visitor. */
  product: (slug: string) => api<ProductDetail>(`/products/${enc(slug)}`),
  /** 16.x */
  recentlyViewed: () => api<ProductCard[]>("/products/recently-viewed"),
  /** 16.x "You may also like". */
  recommendations: (productId: string) => api<Recommendation[]>(`/products/${enc(productId)}/recommendations`),
  /** 16.x Email me when it's back in stock. */
  notifyMe: (productId: string, email: string, variantId?: string) =>
    api<unknown>(`/products/${enc(productId)}/notify-me`, { method: "POST", json: { email, variantId } }),
  categories: () => api<CategoryNode[]>("/categories"),
  category: (slug: string) => api<CategoryNode>(`/categories/${enc(slug)}`),
  brands: () => api<Brand[]>("/brands"),
  brand: (slugOrId: string) => api<Brand>(`/brands/${enc(slugOrId)}`),
  /** 16.1 Search-as-you-type (2+ letters). */
  suggest: (q: string) => api<Suggestion[]>(`/search/suggest${qs({ q })}`),
};

// ───────────────────────── 12 · reviews ─────────────────────────

export const reviewsApi = {
  /** 12.1 Approved reviews + rating summary. */
  list: (productId: string, query: PageQuery = {}) => api<ReviewPage>(`/products/${enc(productId)}/reviews${qs({ ...query })}`),
  /** 12.2 Signed-in customers; shown after moderation. */
  create: (productId: string, input: CreateReviewInput) =>
    api<Review>(`/products/${enc(productId)}/reviews`, { method: "POST", json: input }),
};

// ───────────────────────── 3 · cart ─────────────────────────

const keepGuest = (cart: Cart) => {
  rememberGuestId(cart.guestId);
  return cart;
};

export const cartApi = {
  /** 3.1 */
  get: () => api<Cart>("/cart").then(keepGuest),
  /** 3.2 */
  add: (input: AddToCartInput) => api<Cart>("/cart/items", { method: "POST", json: input }).then(keepGuest),
  /** 3.3 quantity 0 removes the line. */
  update: (itemId: string, quantity: number) =>
    api<Cart>(`/cart/items/${enc(itemId)}`, { method: "PATCH", json: { quantity } }).then(keepGuest),
  /** 3.4 */
  remove: (itemId: string) => api<Cart>(`/cart/items/${enc(itemId)}`, { method: "DELETE" }).then(keepGuest),
  /** 6.x Puts a coupon on the cart (validates it first). */
  applyCoupon: (code: string) =>
    api<CouponValidation>("/coupons/validate", { method: "POST", json: { code, applyToCart: true } }),
  /** 3.x */
  removeCoupon: () => api<Cart>("/cart/coupon", { method: "DELETE" }).then(keepGuest),
  /** 3.5 */
  clear: () => api<Cart>("/cart", { method: "DELETE" }).then(keepGuest),
};

// ───────────────────────── 4 · 5 · 6 · 15 · 18 · checkout ─────────────────────────

export const checkoutApi = {
  /** Which payment methods the store accepts right now. */
  paymentMethods: () => api<{ methods: PaymentMethod[] }>("/payments/methods", { anonymous: true }),
  /** 15.1 Delivery fee for a governorate (free above the store threshold). */
  shippingRate: (governorate: string, cartSubtotal?: number) =>
    api<ShippingRate>(`/shipping/rates${qs({ governorate, cartSubtotal })}`),
  /** 6.4 Checks a coupon without applying it. */
  validateCoupon: (input: ValidateCouponInput) => api<CouponValidation>("/coupons/validate", { method: "POST", json: input }),
  /** 18.2 Gift card balance (does not spend it). */
  giftCardBalance: (code: string) => api<GiftCardPreview>("/gift-cards/redeem", { method: "POST", json: { code } }),
  /**
   * 4.1 Places the order from the current cart (guest or signed in). For card /
   * wallet, send the visitor to result.payment.checkoutUrl.
   */
  placeOrder: (input: CheckoutInput) => api<CheckoutResult>("/orders/checkout", { method: "POST", json: input }),
  /** 5.1 A new payment link for an unpaid online order ("pay again"). */
  startPayment: (input: InitiatePaymentInput) =>
    api<PaymentSession>("/payments/paymob/initiate", { method: "POST", json: input }),
  /** 5.4 Payment state after returning from Paymob (?contact= for guests). */
  paymentStatus: (orderIdOrNumber: string, contact?: string) =>
    api<OrderPaymentStatus>(`/payments/order/${enc(orderIdOrNumber)}${qs({ contact })}`),
  /** Store settings the admin made public (free-shipping threshold, contact info…). */
  settings: () => api<PublicSettings>("/settings/public"),
};

// ───────────────────────── 4 · 14 · orders ─────────────────────────

export const ordersApi = {
  /** 4.3 Signed-in customer's orders. */
  mine: (query: PageQuery & { status?: OrderStatus } = {}) => api<Paginated<Order>>(`/orders/my-orders${qs({ ...query })}`),
  /** 4.x Track without an account: order number + the email or phone used. */
  track: (orderNumber: string, contact: string) => api<Order>(`/orders/track/${enc(orderNumber)}${qs({ contact })}`),
  /** 14.2 Status timeline. */
  timeline: (orderId: string, contact?: string) => api<OrderEvent[]>(`/orders/${enc(orderId)}/timeline${qs({ contact })}`),
  /** 14.1 Customer cancel (before shipping). Guests pass contact. */
  cancel: (orderId: string, body: { contact?: string; reason?: string } = {}) =>
    api<Order>(`/orders/${enc(orderId)}/cancel`, { method: "POST", json: body }),
  /** 14.3 Invoice PDF as a Blob (use URL.createObjectURL to show / download it). */
  invoice: (orderId: string, contact?: string) => apiBlob(`/orders/${enc(orderId)}/invoice${qs({ contact })}`),
};

// ───────────────────────── 10 · 11 · 17 · 18 · account ─────────────────────────

export const accountApi = {
  // 10.3–10.7 addresses
  addresses: () => api<Address[]>("/addresses"),
  addAddress: (input: AddressInput) => api<Address>("/addresses", { method: "POST", json: input }),
  updateAddress: (id: string, input: Partial<AddressInput>) => api<Address>(`/addresses/${enc(id)}`, { method: "PATCH", json: input }),
  setDefaultAddress: (id: string) => api<Address>(`/addresses/${enc(id)}/default`, { method: "PATCH", json: {} }),
  removeAddress: (id: string) => api<{ id: string; deleted: boolean }>(`/addresses/${enc(id)}`, { method: "DELETE" }),

  // 11.x wishlist
  wishlist: (query: PageQuery = {}) => api<Paginated<WishlistItem>>(`/wishlist${qs({ ...query })}`),
  addToWishlist: (productId: string) => api<WishlistToggle>("/wishlist", { method: "POST", json: { productId } }),
  removeFromWishlist: (productId: string) => api<WishlistToggle>(`/wishlist/${enc(productId)}`, { method: "DELETE" }),

  // 17.x loyalty & referrals
  loyalty: (query: PageQuery = {}) => api<LoyaltySummary>(`/loyalty/points${qs({ ...query })}`),
  /** Turns points into a one-time coupon code. */
  redeemPoints: (points: number) => api<LoyaltyRedemption>("/loyalty/redeem", { method: "POST", json: { points } }),
  referrals: () => api<ReferralSummary>("/referrals/me"),
  applyReferral: (code: string) => api<ReferralApplied>("/referrals/apply", { method: "POST", json: { code } }),

  // 18.1 gift cards
  myGiftCards: () => api<GiftCard[]>("/gift-cards/mine"),
  /** Returns a Paymob link; the code is emailed after payment. */
  buyGiftCard: (input: GiftCardPurchaseInput) => api<GiftCardPurchase>("/gift-cards", { method: "POST", json: input }),
};

// ───────────────────────── 7 · 9 · support ─────────────────────────

export const supportApi = {
  /** 7.1 */
  subscribe: (email: string) => api<SubscribeResult>("/newsletter/subscribe", { method: "POST", json: { email } }),
  /** 7.3 One-click unsubscribe from an email link token. */
  unsubscribe: (token: string) => api<unknown>("/newsletter/unsubscribe", { method: "POST", json: { token } }),
  /** 7.4 */
  contact: (input: ContactInput) => api<unknown>("/contact", { method: "POST", json: input }),
  /** 9.1 Shopping assistant: answers + product suggestions. */
  chat: (input: CustomerChatInput) => api<CustomerChatResult>("/ai/customer/chat", { method: "POST", json: input }),
};
