"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "@/lib/api/client";
import { setSession } from "@/lib/api/session";
import { qk } from "@/lib/api/hooks";
import type { AuthResult, Paginated } from "@/lib/api/types";
import type {
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
  DateRange,
  Granularity,
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
