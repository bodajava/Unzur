"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { ApiError } from "./client";
import { accountApi, authApi, cartApi, catalogApi, checkoutApi, ordersApi, reviewsApi, supportApi } from "./endpoints";
import { hasSessionFlag, onSessionChange } from "./session";
import type {
  AddToCartInput,
  AddressInput,
  Cart,
  CheckoutInput,
  ContactInput,
  CreateReviewInput,
  CustomerChatInput,
  GiftCardPurchaseInput,
  InitiatePaymentInput,
  OrderStatus,
  PageQuery,
  ProductQuery,
  RegisterInput,
  UpdateProfileInput,
  User,
  ValidateCouponInput,
} from "./types";

/** Query keys in one place, so mutations know what to refresh. */
export const qk = {
  me: ["me"] as const,
  cart: ["cart"] as const,
  products: (q: ProductQuery) => ["products", q] as const,
  product: (slug: string) => ["product", slug] as const,
  recentlyViewed: ["recently-viewed"] as const,
  recommendations: (id: string) => ["recommendations", id] as const,
  categories: ["categories"] as const,
  brands: ["brands"] as const,
  suggest: (q: string) => ["suggest", q] as const,
  reviews: (id: string, q: PageQuery) => ["reviews", id, q] as const,
  shipping: (gov: string, subtotal?: number) => ["shipping", gov, subtotal] as const,
  settings: ["settings"] as const,
  orders: (q: PageQuery) => ["orders", q] as const,
  order: (number: string) => ["order", number] as const,
  timeline: (id: string) => ["timeline", id] as const,
  payment: (ref: string) => ["payment", ref] as const,
  addresses: ["addresses"] as const,
  wishlist: (q: PageQuery) => ["wishlist", q] as const,
  loyalty: (q: PageQuery) => ["loyalty", q] as const,
  referrals: ["referrals"] as const,
  giftCards: ["gift-cards"] as const,
};

/** Data that belongs to the signed-in person (dropped on sign-out). */
const PRIVATE_KEYS = [qk.me, qk.cart, qk.addresses, ["wishlist"], qk.referrals, qk.giftCards, ["orders"], ["loyalty"]];

function resetPrivate(client: QueryClient) {
  for (const key of PRIVATE_KEYS) client.removeQueries({ queryKey: key });
  void client.invalidateQueries({ queryKey: qk.cart });
}

const noRetryOn4xx = (failures: number, error: unknown) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2;

// ───────────────────────── session ─────────────────────────

const subscribeFlag = (cb: () => void) => onSessionChange(() => cb());

/**
 * Who is here. status: "loading" while a stored session is being restored,
 * "authenticated" with a user, or "guest".
 */
export function useSession() {
  const client = useQueryClient();
  const flagged = useSyncExternalStore(subscribeFlag, hasSessionFlag, () => false);
  const me = useQuery({
    queryKey: qk.me,
    queryFn: authApi.me,
    enabled: flagged,
    staleTime: 5 * 60_000,
    retry: noRetryOn4xx,
  });

  // Signed out in another tab, or the refresh token expired: drop private data.
  useEffect(() => onSessionChange((signedIn) => !signedIn && resetPrivate(client)), [client]);

  const user: User | undefined = flagged ? me.data : undefined;
  const status = !flagged ? "guest" : me.isPending ? "loading" : user ? "authenticated" : "guest";
  return { user, status, isSignedIn: status === "authenticated" } as const;
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.login(email, password),
    onSuccess: (result) => {
      client.setQueryData(qk.me, result.user);
      // The guest cart was merged into the account.
      void client.invalidateQueries({ queryKey: qk.cart });
      void client.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });
}

export function useRegister() {
  return useMutation({ mutationFn: (input: RegisterInput) => authApi.register(input) });
}

export function useVerifyOtp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => authApi.verifyOtp(email, code),
    onSuccess: (result) => {
      client.setQueryData(qk.me, result.user);
      void client.invalidateQueries({ queryKey: qk.cart });
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ email, code, newPassword }: { email: string; code: string; newPassword: string }) =>
      authApi.resetPassword(email, code, newPassword),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({ mutationFn: authApi.logout, onSettled: () => resetPrivate(client) });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => authApi.updateMe(input),
    onSuccess: (user) => client.setQueryData(qk.me, user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(currentPassword, newPassword),
  });
}

// ───────────────────────── catalog ─────────────────────────

export function useProducts(query: ProductQuery = {}) {
  return useQuery({
    queryKey: qk.products(query),
    queryFn: () => catalogApi.products(query),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: qk.product(slug ?? ""),
    queryFn: () => catalogApi.product(slug!),
    enabled: !!slug,
    staleTime: 60_000,
    retry: noRetryOn4xx,
  });
}

export function useRecentlyViewed() {
  return useQuery({ queryKey: qk.recentlyViewed, queryFn: catalogApi.recentlyViewed, staleTime: 60_000 });
}

export function useRecommendations(productId: string | undefined) {
  return useQuery({
    queryKey: qk.recommendations(productId ?? ""),
    queryFn: () => catalogApi.recommendations(productId!),
    enabled: !!productId,
    staleTime: 5 * 60_000,
  });
}

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: catalogApi.categories, staleTime: 60 * 60_000 });
}

export function useBrands() {
  return useQuery({ queryKey: qk.brands, queryFn: catalogApi.brands, staleTime: 60 * 60_000 });
}

/** 16.1 Search-as-you-type. */
export function useSearchSuggest(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: qk.suggest(query),
    queryFn: () => catalogApi.suggest(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useNotifyMe() {
  return useMutation({
    mutationFn: ({ productId, email, variantId }: { productId: string; email: string; variantId?: string }) =>
      catalogApi.notifyMe(productId, email, variantId),
  });
}

export function useReviews(productId: string | undefined, query: PageQuery = {}) {
  return useQuery({
    queryKey: qk.reviews(productId ?? "", query),
    queryFn: () => reviewsApi.list(productId!, query),
    enabled: !!productId,
    placeholderData: keepPreviousData,
  });
}

export function useCreateReview(productId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => reviewsApi.create(productId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["reviews", productId] }),
  });
}

// ───────────────────────── cart ─────────────────────────

/** The full cart (guest or signed in). The header badge reads itemCount from it. */
export function useCart() {
  return useQuery({ queryKey: qk.cart, queryFn: cartApi.get, staleTime: 30_000, retry: 1 });
}

/** Kept for the header: same query as useCart. */
export const useCartSummary = useCart;

function useCartMutation<V>(fn: (vars: V) => Promise<Cart>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => client.setQueryData(qk.cart, cart),
  });
}

export function useAddToCart() {
  return useCartMutation((input: AddToCartInput) => cartApi.add(input));
}

/** quantity 0 removes the line. */
export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.update(itemId, quantity));
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => cartApi.remove(itemId));
}

export function useClearCart() {
  return useCartMutation(() => cartApi.clear());
}

export function useRemoveCoupon() {
  return useCartMutation(() => cartApi.removeCoupon());
}

export function useApplyCoupon() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.cart }),
  });
}

// ───────────────────────── checkout ─────────────────────────

export function useShippingRate(governorate: string | undefined, cartSubtotal?: number) {
  return useQuery({
    queryKey: qk.shipping(governorate ?? "", cartSubtotal),
    queryFn: () => checkoutApi.shippingRate(governorate!, cartSubtotal),
    enabled: !!governorate,
    staleTime: 5 * 60_000,
    retry: noRetryOn4xx,
  });
}

export function usePaymentMethods() {
  return useQuery({ queryKey: ["payment-methods"], queryFn: checkoutApi.paymentMethods, staleTime: 10 * 60_000 });
}

export function useStoreSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: checkoutApi.settings, staleTime: 10 * 60_000 });
}

export function useValidateCoupon() {
  return useMutation({ mutationFn: (input: ValidateCouponInput) => checkoutApi.validateCoupon(input) });
}

export function useGiftCardBalance() {
  return useMutation({ mutationFn: (code: string) => checkoutApi.giftCardBalance(code) });
}

/**
 * Places the order. On success the cart is emptied; for card / wallet send
 * the visitor to result.payment.checkoutUrl.
 */
export function usePlaceOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) => checkoutApi.placeOrder(input),
    onSuccess: (result) => {
      client.setQueryData(qk.order(result.order.orderNumber), result.order);
      void client.invalidateQueries({ queryKey: qk.cart });
      void client.invalidateQueries({ queryKey: ["orders"] });
      void client.invalidateQueries({ queryKey: qk.me }); // loyalty points
    },
  });
}

export function useStartPayment() {
  return useMutation({ mutationFn: (input: InitiatePaymentInput) => checkoutApi.startPayment(input) });
}

/** Polls until the payment settles (after returning from Paymob). */
export function usePaymentStatus(orderRef: string | undefined, contact?: string) {
  return useQuery({
    queryKey: qk.payment(orderRef ?? ""),
    queryFn: () => checkoutApi.paymentStatus(orderRef!, contact),
    enabled: !!orderRef,
    retry: noRetryOn4xx,
    refetchInterval: (q) => (q.state.data?.paymentStatus === "PENDING" || q.state.data?.paymentStatus === "UNPAID" ? 3000 : false),
  });
}

// ───────────────────────── orders ─────────────────────────

export function useMyOrders(query: PageQuery & { status?: OrderStatus } = {}) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: qk.orders(query),
    queryFn: () => ordersApi.mine(query),
    enabled: isSignedIn,
    placeholderData: keepPreviousData,
  });
}

export function useTrackOrder(orderNumber: string | undefined, contact: string | undefined) {
  return useQuery({
    queryKey: qk.order(orderNumber ?? ""),
    queryFn: () => ordersApi.track(orderNumber!, contact!),
    enabled: !!orderNumber && !!contact,
    retry: noRetryOn4xx,
  });
}

export function useOrderTimeline(orderId: string | undefined, contact?: string) {
  return useQuery({
    queryKey: qk.timeline(orderId ?? ""),
    queryFn: () => ordersApi.timeline(orderId!, contact),
    enabled: !!orderId,
  });
}

export function useCancelOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, contact, reason }: { orderId: string; contact?: string; reason?: string }) =>
      ordersApi.cancel(orderId, { contact, reason }),
    onSuccess: (order) => {
      client.setQueryData(qk.order(order.orderNumber), order);
      void client.invalidateQueries({ queryKey: ["orders"] });
      void client.invalidateQueries({ queryKey: qk.timeline(order.id) });
    },
  });
}

/** Downloads the invoice PDF and opens it in a new tab. */
export function useDownloadInvoice() {
  return useMutation({
    mutationFn: async ({ orderId, contact, filename }: { orderId: string; contact?: string; filename?: string }) => {
      const blob = await ordersApi.invoice(orderId, contact);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `invoice-${orderId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
  });
}

// ───────────────────────── account ─────────────────────────

export function useAddresses() {
  const { isSignedIn } = useSession();
  return useQuery({ queryKey: qk.addresses, queryFn: accountApi.addresses, enabled: isSignedIn });
}

export function useSaveAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AddressInput | Partial<AddressInput> }) =>
      id ? accountApi.updateAddress(id, input) : accountApi.addAddress(input as AddressInput),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.addresses }),
  });
}

export function useSetDefaultAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountApi.setDefaultAddress(id),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.addresses }),
  });
}

export function useRemoveAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountApi.removeAddress(id),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.addresses }),
  });
}

export function useWishlist(query: PageQuery = {}) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: qk.wishlist(query),
    queryFn: () => accountApi.wishlist(query),
    enabled: isSignedIn,
    placeholderData: keepPreviousData,
  });
}

/** Adds or removes a product from the wishlist. */
export function useToggleWishlist() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, saved }: { productId: string; saved: boolean }) =>
      saved ? accountApi.removeFromWishlist(productId) : accountApi.addToWishlist(productId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["wishlist"] }),
  });
}

export function useLoyalty(query: PageQuery = {}) {
  const { isSignedIn } = useSession();
  return useQuery({ queryKey: qk.loyalty(query), queryFn: () => accountApi.loyalty(query), enabled: isSignedIn });
}

export function useRedeemPoints() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (points: number) => accountApi.redeemPoints(points),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["loyalty"] });
      void client.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useReferrals() {
  const { isSignedIn } = useSession();
  return useQuery({ queryKey: qk.referrals, queryFn: accountApi.referrals, enabled: isSignedIn });
}

export function useApplyReferral() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => accountApi.applyReferral(code),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.referrals });
      void client.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useMyGiftCards() {
  const { isSignedIn } = useSession();
  return useQuery({ queryKey: qk.giftCards, queryFn: accountApi.myGiftCards, enabled: isSignedIn });
}

/** Returns a Paymob link in result.payment.checkoutUrl. */
export function useBuyGiftCard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: GiftCardPurchaseInput) => accountApi.buyGiftCard(input),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.giftCards }),
  });
}

// ───────────────────────── support ─────────────────────────

/** 7.1 Newsletter. */
export function useSubscribe() {
  return useMutation({ mutationFn: (email: string) => supportApi.subscribe(email) });
}

export function useUnsubscribe() {
  return useMutation({ mutationFn: (token: string) => supportApi.unsubscribe(token) });
}

export function useContact() {
  return useMutation({ mutationFn: (input: ContactInput) => supportApi.contact(input) });
}

export function useShopAssistant() {
  return useMutation({ mutationFn: (input: CustomerChatInput) => supportApi.chat(input) });
}
