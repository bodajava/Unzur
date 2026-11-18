"use client";

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "@/lib/api/client";
import { setSession } from "@/lib/api/session";
import { qk } from "@/lib/api/hooks";
import type { AuthResult, PageQuery, Paginated } from "@/lib/api/types";
import type {
  AdminGiftCard,
  Coupon,
  CouponInput,
  CouponTarget,
  CustomerEntry,
  CustomerDetail,
  ContactMessage,
  AdminBrand,
  AdminCategory,
  ShippingZone,
  ShippingZoneInput,
  StoreSetting,
  AdminProduct,
  AdminProductQuery,
  AdminOrder,
  VariantInput,
  AdminOrderRow,
  Breakdown,
  CustomerAnalytics,
  DateRange,
  Granularity,
  PerformanceSort,
  Insight,
  LowStockItem,
  OrderListQuery,
  Overview,
  ProductPerformance,
  TrendPoint,
} from "./types";
import type { OrderStatus } from "@/lib/api/types";

const enc = encodeURIComponent;

/** Admin endpoints (staff/admin roles; the API checks every call). */
export const adminApi = {
  /** 1.11 Staff sign-in (customers are refused). */
  login: async (email: string, password: string) => {
    const result = await api<AuthResult>("/auth/admin/login", { method: "POST", json: { email, password }, anonymous: true });
    setSession(result);
    return result;
  },
  overview: (range: DateRange) => api<Overview>(`/admin/analytics/overview${qs({ ...range })}`),
  salesTrend: (range: DateRange & { granularity?: Granularity }) => api<TrendPoint[]>(`/admin/analytics/sales-trend${qs({ ...range })}`),
  productsPerformance: (q: DateRange & { sortBy?: string; order?: "asc" | "desc"; limit?: number }) =>
    api<ProductPerformance[]>(`/admin/analytics/products-performance${qs({ ...q })}`),
  insights: () => api<Insight[]>("/admin/analytics/insights"),
  breakdown: (range: DateRange) => api<Breakdown>(`/admin/analytics/breakdown${qs({ ...range })}`),
  customerAnalytics: (range: DateRange) => api<CustomerAnalytics>(`/admin/analytics/customers${qs({ ...range })}`),
  lowStock: () => api<LowStockItem[]>("/admin/inventory/low-stock"),

  orders: (q: OrderListQuery) => api<Paginated<AdminOrderRow>>(`/orders${qs({ ...q })}`),
  order: (id: string) => api<AdminOrder>(`/orders/${enc(id)}`),
  setStatus: (id: string, status: OrderStatus, note?: string) =>
    api<AdminOrder>(`/orders/${enc(id)}/status`, { method: "PATCH", json: { status, note: note || undefined } }),
  refund: (id: string, body: { reason: string; amountPiasters?: number; restock?: boolean }) =>
    api<AdminOrder>(`/orders/${enc(id)}/refund`, { method: "PATCH", json: body }),

  products: (q: AdminProductQuery) => api<Paginated<AdminProduct>>(`/products/admin/all${qs({ ...q })}`),
  product: (id: string) => api<AdminProduct>(`/products/admin/${enc(id)}`),
  /** multipart: fields + `images` files. */
  createProduct: (form: FormData) => api<AdminProduct>("/products", { method: "POST", form }),
  updateProduct: (id: string, form: FormData) => api<AdminProduct>(`/products/${enc(id)}`, { method: "PATCH", form }),
  deleteProduct: (id: string) => api<{ id: string; deleted: true }>(`/products/${enc(id)}`, { method: "DELETE" }),
  addVariant: (productId: string, v: VariantInput) => api<unknown>(`/products/${enc(productId)}/variants`, { method: "POST", json: v }),
  updateVariant: (id: string, v: Partial<VariantInput>) => api<unknown>(`/variants/${enc(id)}`, { method: "PATCH", json: v }),
  deleteVariant: (id: string) => api<unknown>(`/variants/${enc(id)}`, { method: "DELETE" }),
};

/**
 * Ask the storefront to drop its cached copies (shop, product pages) so a
 * change shows right away. Best effort: pages also refresh on their own.
 */
export async function refreshStore(tags: string[]) {
  try {
    const { getAccessToken } = await import("@/lib/api/session");
    const token = await getAccessToken();
    if (!token) return;
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ tags }),
    });
  } catch {
    /* the cache expires by itself within minutes */
  }
}

export const akq = {
  overview: (r: DateRange) => ["admin", "overview", r] as const,
  trend: (r: DateRange, g: Granularity) => ["admin", "trend", r, g] as const,
  performance: (r: DateRange) => ["admin", "performance", r] as const,
  performanceBy: (r: DateRange, sort: PerformanceSort, order: "asc" | "desc") => ["admin", "performance", r, sort, order] as const,
  breakdown: (r: DateRange) => ["admin", "breakdown", r] as const,
  customers: (r: DateRange) => ["admin", "customer-analytics", r] as const,
  insights: ["admin", "insights"] as const,
  lowStock: ["admin", "low-stock"] as const,
  orders: (q: OrderListQuery) => ["admin", "orders", q] as const,
  order: (id: string) => ["admin", "order", id] as const,
};

export function useAdminLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => adminApi.login(email, password),
    onSuccess: (result) => client.setQueryData(qk.me, result.user),
  });
}

export const useOverview = (range: DateRange) =>
  useQuery({ queryKey: akq.overview(range), queryFn: () => adminApi.overview(range), placeholderData: keepPreviousData });

export const useSalesTrend = (range: DateRange, granularity: Granularity) =>
  useQuery({
    queryKey: akq.trend(range, granularity),
    queryFn: () => adminApi.salesTrend({ ...range, granularity }),
    placeholderData: keepPreviousData,
  });

export const useTopProducts = (range: DateRange) =>
  useQuery({
    queryKey: akq.performance(range),
    queryFn: () => adminApi.productsPerformance({ ...range, sortBy: "revenue", order: "desc", limit: 6 }),
    placeholderData: keepPreviousData,
  });

export const useProductPerformance = (range: DateRange, sortBy: PerformanceSort, order: "asc" | "desc") =>
  useQuery({
    queryKey: akq.performanceBy(range, sortBy, order),
    queryFn: () => adminApi.productsPerformance({ ...range, sortBy, order, limit: 50 }),
    placeholderData: keepPreviousData,
  });

export const useBreakdown = (range: DateRange) =>
  useQuery({ queryKey: akq.breakdown(range), queryFn: () => adminApi.breakdown(range), placeholderData: keepPreviousData });

export const useCustomerAnalytics = (range: DateRange) =>
  useQuery({ queryKey: akq.customers(range), queryFn: () => adminApi.customerAnalytics(range), placeholderData: keepPreviousData });

/** Moves any order one step (used by the overview queue). */
export function useQuickStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => adminApi.setStatus(id, status),
    onSuccess: (order) => {
      client.setQueryData(akq.order(order.id), order);
      void client.invalidateQueries({ queryKey: ["admin", "orders"] });
      void client.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
}

export const useInsights = () => useQuery({ queryKey: akq.insights, queryFn: adminApi.insights, staleTime: 5 * 60_000 });
export const useLowStock = () => useQuery({ queryKey: akq.lowStock, queryFn: adminApi.lowStock });

export const useAdminOrders = (q: OrderListQuery) =>
  useQuery({ queryKey: akq.orders(q), queryFn: () => adminApi.orders(q), placeholderData: keepPreviousData });

export const useAdminOrder = (id: string) => useQuery({ queryKey: akq.order(id), queryFn: () => adminApi.order(id) });

function useOrderMutation<V>(id: string, fn: (v: V) => Promise<AdminOrder>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      client.setQueryData(akq.order(id), order);
      void client.invalidateQueries({ queryKey: ["admin", "orders"] });
      void client.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
}

export const useSetOrderStatus = (id: string) =>
  useOrderMutation(id, ({ status, note }: { status: OrderStatus; note?: string }) => adminApi.setStatus(id, status, note));

export const useRefundOrder = (id: string) =>
  useOrderMutation(id, (body: { reason: string; amountPiasters?: number; restock?: boolean }) => adminApi.refund(id, body));

// ───────────────────────── products ─────────────────────────

export const pkq = {
  list: (q: AdminProductQuery) => ["admin", "products", q] as const,
  one: (id: string) => ["admin", "product", id] as const,
};

export const useAdminProducts = (q: AdminProductQuery) =>
  useQuery({ queryKey: pkq.list(q), queryFn: () => adminApi.products(q), placeholderData: keepPreviousData });

export const useAdminProduct = (id: string | undefined) =>
  useQuery({ queryKey: pkq.one(id ?? ""), queryFn: () => adminApi.product(id!), enabled: !!id });

function useProductChange<V, R>(fn: (v: V) => Promise<R>, productId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      const product = result as Partial<AdminProduct> | undefined;
      const id = productId ?? product?.id;
      void client.invalidateQueries({ queryKey: ["admin", "products"] });
      if (id) void client.invalidateQueries({ queryKey: pkq.one(id) });
      void client.invalidateQueries({ queryKey: ["admin", "low-stock"] });
      void refreshStore(["products", ...(product?.slug ? [`product:${product.slug}`] : [])]);
    },
  });
}

export const useCreateProduct = () => useProductChange((form: FormData) => adminApi.createProduct(form));
export const useUpdateProduct = (id: string) => useProductChange((form: FormData) => adminApi.updateProduct(id, form), id);
export const useDeleteProduct = (id: string) => useProductChange(() => adminApi.deleteProduct(id), id);
export const useAddVariant = (productId: string) =>
  useProductChange((v: VariantInput) => adminApi.addVariant(productId, v), productId);
export const useUpdateVariant = (productId: string) =>
  useProductChange(({ id, v }: { id: string; v: Partial<VariantInput> }) => adminApi.updateVariant(id, v), productId);
export const useDeleteVariant = (productId: string) =>
  useProductChange((id: string) => adminApi.deleteVariant(id), productId);

// ───────────────────────── catalog & store ─────────────────────────

export type Taxonomy = "categories" | "brands";

export const catalogApi = {
  list: <T,>(kind: Taxonomy) => api<T[]>(`/${kind}/admin/all`),
  /** multipart: fields + optional image (`image` for categories, `logo` for brands). */
  create: (kind: Taxonomy, form: FormData) => api<unknown>(`/${kind}`, { method: "POST", form }),
  update: (kind: Taxonomy, id: string, form: FormData) => api<unknown>(`/${kind}/${enc(id)}`, { method: "PATCH", form }),
  remove: (kind: Taxonomy, id: string) => api<unknown>(`/${kind}/${enc(id)}`, { method: "DELETE" }),
  zones: () => api<ShippingZone[]>("/admin/shipping-zones"),
  addZone: (z: ShippingZoneInput) => api<ShippingZone>("/admin/shipping-zones", { method: "POST", json: z }),
  updateZone: (id: string, z: Partial<ShippingZoneInput>) => api<ShippingZone>(`/admin/shipping-zones/${enc(id)}`, { method: "PATCH", json: z }),
  removeZone: (id: string) => api<unknown>(`/admin/shipping-zones/${enc(id)}`, { method: "DELETE" }),
  settings: () => api<StoreSetting[]>("/admin/settings"),
  saveSettings: (settings: { key: string; value: unknown; isPublic?: boolean }[]) =>
    api<StoreSetting[]>("/admin/settings", { method: "PATCH", json: { settings } }),
};

export const useTaxonomy = <T extends AdminCategory | AdminBrand>(kind: Taxonomy) =>
  useQuery({ queryKey: ["admin", kind], queryFn: () => catalogApi.list<T>(kind) });

export function useTaxonomyChange<V>(kind: Taxonomy, fn: (v: V) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", kind] });
      void client.invalidateQueries({ queryKey: [kind] });
      void client.invalidateQueries({ queryKey: ["admin", "products"] });
      void refreshStore([kind, "products"]);
    },
  });
}

export const useZones = () => useQuery({ queryKey: ["admin", "zones"], queryFn: catalogApi.zones });

export function useZoneChange<V>(fn: (v: V) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "zones"] }) });
}

export const useStoreSettings = () => useQuery({ queryKey: ["admin", "settings"], queryFn: catalogApi.settings });

export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: catalogApi.saveSettings,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "settings"] });
      void client.invalidateQueries({ queryKey: ["settings"] });
      void refreshStore(["settings"]);
    },
  });
}

// ───────────────────────── customers & marketing ─────────────────────────

export const marketingApi = {
  customers: (q: PageQuery) => api<Paginated<CustomerEntry>>(`/admin/customers${qs({ ...q })}`),
  customer: (identifier: string) => api<CustomerDetail>(`/admin/customers/${enc(identifier)}`),
  messages: (q: PageQuery & { isRead?: boolean }) => api<Paginated<ContactMessage>>(`/contact/messages${qs({ ...q })}`),
  updateMessage: (id: string, body: { isRead?: boolean; replied?: boolean }) =>
    api<ContactMessage>(`/contact/messages/${enc(id)}`, { method: "PATCH", json: body }),
  deleteMessage: (id: string) => api<unknown>(`/contact/messages/${enc(id)}`, { method: "DELETE" }),
  coupons: (q: PageQuery & { status?: string }) => api<Paginated<Coupon>>(`/coupons${qs({ ...q })}`),
  createCoupon: (c: CouponInput) => api<Coupon>("/coupons", { method: "POST", json: c }),
  updateCoupon: (id: string, c: Partial<CouponInput>) => api<Coupon>(`/coupons/${enc(id)}`, { method: "PATCH", json: c }),
  removeCoupon: (id: string) =>
    api<{ id: string; deleted: boolean; deactivated: boolean; reason: string | null }>(`/coupons/${enc(id)}`, { method: "DELETE" }),
  sendCoupon: (body: { couponId: string; target: CouponTarget; emails?: string[]; message?: string }) =>
    api<{ code: string; target: string; recipients: number; queued: boolean }>("/coupons/send-to-buyers", { method: "POST", json: body }),
  giftCards: (q: PageQuery & { isActive?: boolean }) => api<Paginated<AdminGiftCard>>(`/admin/gift-cards${qs({ ...q })}`),
  issueGiftCard: (body: { amountPiasters: number; recipientEmail?: string; message?: string; expiresAt?: string }) =>
    api<AdminGiftCard>("/admin/gift-cards", { method: "POST", json: body }),
  updateGiftCard: (id: string, body: { isActive?: boolean; expiresAt?: string }) =>
    api<AdminGiftCard>(`/admin/gift-cards/${enc(id)}`, { method: "PATCH", json: body }),
};

export const useCustomers = (q: PageQuery) =>
  useQuery({ queryKey: ["admin", "customers", q], queryFn: () => marketingApi.customers(q), placeholderData: keepPreviousData });

export const useCoupons = (q: PageQuery & { status?: string }) =>
  useQuery({ queryKey: ["admin", "coupons", q], queryFn: () => marketingApi.coupons(q), placeholderData: keepPreviousData });

export const useGiftCards = (q: PageQuery & { isActive?: boolean }) =>
  useQuery({ queryKey: ["admin", "gift-cards", q], queryFn: () => marketingApi.giftCards(q), placeholderData: keepPreviousData });

export function useMarketingChange<V, R>(area: "coupons" | "gift-cards", fn: (v: V) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries({ queryKey: ["admin", area] }) });
}

export const useCustomer = (identifier: string) =>
  useQuery({ queryKey: ["admin", "customer", identifier], queryFn: () => marketingApi.customer(identifier), retry: false });

export const useMessages = (q: PageQuery & { isRead?: boolean }) =>
  useQuery({ queryKey: ["admin", "messages", q], queryFn: () => marketingApi.messages(q), placeholderData: keepPreviousData });

export function useMessageChange<V>(fn: (v: V) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "messages"] }) });
}

/** How many orders sit in each status right now (for the tabs). One tiny request per status. */
export function useOrderCounts(statuses: readonly OrderStatus[], customer?: string) {
  const results = useQueries({
    queries: [undefined, ...statuses].map((status) => ({
      queryKey: akq.orders({ status, customer, limit: 1, page: 1 }),
      queryFn: () => adminApi.orders({ status, customer, limit: 1, page: 1 }),
      staleTime: 30_000,
    })),
  });
  return Object.fromEntries([undefined, ...statuses].map((s, i) => [s ?? "all", results[i].data?.meta.total])) as Record<string, number | undefined>;
}
