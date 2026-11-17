"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "@/lib/api/client";
import { setSession } from "@/lib/api/session";
import { qk } from "@/lib/api/hooks";
import type { AuthResult, Paginated } from "@/lib/api/types";
import type {
  AdminOrder,
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
};

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
