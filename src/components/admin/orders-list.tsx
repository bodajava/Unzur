"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { formatDateTime, formatPrice, plural } from "@/i18n/format";
import { useAdminOrders } from "@/lib/admin/api";
import type { OrderListQuery } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/api/types";
import { OrderStatusBadge, PaymentStatusText } from "./status-badge";
import { PageTitle, Skeleton } from "./ui";

const STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
const METHODS: PaymentMethod[] = ["COD", "PAYMOB_CARD", "PAYMOB_WALLET"];
const PAGE_SIZE = 20;

/** Filters live in the URL so a filtered list can be bookmarked or shared with the team. */
function readQuery(sp: URLSearchParams): OrderListQuery {
  const pick = <T extends string>(key: string, allowed: readonly T[]) => {
    const v = sp.get(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
  };
  const page = Number(sp.get("page"));
  const day = (key: string, end = false) => {
    const v = sp.get(key);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${end ? "23:59:59" : "00:00:00"}+02:00` : undefined;
  };
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: PAGE_SIZE,
    sort: "-createdAt",
    search: sp.get("q")?.trim() || undefined,
    status: pick("status", STATUSES),
    paymentStatus: pick("payment", PAYMENT_STATUSES),
    paymentMethod: pick("method", METHODS),
    fromDate: day("from"),
    toDate: day("to", true),
  };
}

export function OrdersList() {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const query = readQuery(new URLSearchParams(sp?.toString()));
  const orders = useAdminOrders(query);
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(sp?.get("q") ?? "");
  const uid = useId();
  const to = t.admin.orders;

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp?.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const current = sp?.get("q") ?? "";
    if (search.trim() === current) return;
    const timer = setTimeout(() => set({ q: search.trim() || undefined }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [search]);

  const select =
    "rounded-full border border-ink/20 bg-transparent py-2 ps-3.5 pe-8 text-sm hover:border-ink/50 focus:border-ink focus:outline-none";
  const data = orders.data;
  const filtered = !!(query.search || query.status || query.paymentStatus || query.paymentMethod || query.fromDate || query.toDate);

  return (
    <div>
      <PageTitle aside={data && <p className="eyebrow text-muted">{plural(lang, to.count, data.meta.total)}</p>}>{to.title}</PageTitle>

      {/* Status tabs */}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label={to.col.status}>
        {[undefined, ...STATUSES].map((s) => (
          <button
            key={s ?? "all"}
            type="button"
            role="tab"
            aria-selected={query.status === s}
            onClick={() => set({ status: s })}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
              query.status === s ? "border-ink bg-ink text-canvas" : "border-ink/20 hover:border-ink/60"
            }`}
          >
            {s ? t.orderStatus[s] : to.allStatuses}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor={`${uid}-q`} className="sr-only">
          {to.searchLabel}
        </label>
        <input
          id={`${uid}-q`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={to.search}
          className="min-w-[16rem] flex-1 rounded-full border border-ink/20 bg-transparent px-4 py-2 text-sm placeholder:text-ink/40 hover:border-ink/50 focus:border-ink focus:outline-none"
        />
        <select aria-label={to.col.payment} value={query.paymentStatus ?? ""} onChange={(e) => set({ payment: e.target.value || undefined })} className={select}>
          <option value="" className="bg-canvas">{to.anyPayment}</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-canvas">{t.paymentStatus[s]}</option>
          ))}
        </select>
        <select aria-label={t.order.payment} value={query.paymentMethod ?? ""} onChange={(e) => set({ method: e.target.value || undefined })} className={select}>
          <option value="" className="bg-canvas">{to.anyMethod}</option>
          {METHODS.map((m) => (
            <option key={m} value={m} className="bg-canvas">{t.paymentMethod[m]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{to.from}</span>
          <input type="date" value={sp?.get("from") ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} className={`${select} pe-3`} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{to.to}</span>
          <input type="date" value={sp?.get("to") ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} className={`${select} pe-3`} />
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              start(() => router.replace(pathname, { scroll: false }));
            }}
            className="nav-link text-sm"
          >
            {to.clear}
          </button>
        )}
      </div>

      {orders.isError && <p className="mb-6 text-sm text-[#d1342f]">{errorMessage(orders.error, t)}</p>}

      <div className={`transition-opacity ${pending || orders.isFetching ? "opacity-60" : ""}`}>
        {!data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <p className="rounded-2xl bg-panel px-6 py-16 text-center text-muted">{filtered ? to.empty : to.none}</p>
        ) : (
          <>
            {/* Wide screens: a table */}
            <div className="hidden overflow-hidden rounded-2xl bg-panel lg:block dark:ring-1 dark:ring-white/8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-start text-xs text-muted">
                    {[to.col.order, to.col.date, to.col.customer, to.col.items, to.col.total, to.col.payment, to.col.status].map((h, i) => (
                      <th key={h} scope="col" className={`px-5 py-3.5 font-semibold ${i === 3 || i === 4 ? "text-end" : "text-start"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {data.items.map((o) => (
                    <tr key={o.id} className="cursor-pointer transition-colors hover:bg-ink/[0.04]" onClick={() => router.push(href(`/admin/orders/${o.id}`))}>
                      <td className="px-5 py-3.5">
                        <Link href={href(`/admin/orders/${o.id}`)} dir="ltr" className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-muted">{formatDateTime(o.createdAt, lang)}</td>
                      <td className="max-w-[16rem] px-5 py-3.5">
                        <span className="block truncate font-semibold">{o.customerName}</span>
                        <span dir="ltr" className="block truncate text-xs text-muted rtl:text-right">
                          {o.customerEmail}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-end tabular-nums">{o.itemCount}</td>
                      <td className="px-5 py-3.5 text-end font-semibold whitespace-nowrap tabular-nums">{formatPrice(o.totalAmount, lang)}</td>
                      <td className="px-5 py-3.5">
                        <span className="block text-xs">{t.paymentMethod[o.paymentMethod]}</span>
                        <PaymentStatusText status={o.paymentStatus} />
                      </td>
                      <td className="px-5 py-3.5">
                        <OrderStatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phones and tablets: cards */}
            <ul className="space-y-3 lg:hidden">
              {data.items.map((o) => (
                <li key={o.id}>
                  <Link href={href(`/admin/orders/${o.id}`)} className="block rounded-2xl bg-panel p-4 dark:ring-1 dark:ring-white/8">
                    <div className="flex items-start justify-between gap-3">
                      <span dir="ltr" className="font-semibold">
                        {o.orderNumber}
                      </span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="mt-2 text-sm">{o.customerName}</p>
                    <div className="mt-2 flex items-end justify-between gap-3 text-xs text-muted">
                      <span>
                        {formatDateTime(o.createdAt, lang)} · {t.paymentMethod[o.paymentMethod]} · <PaymentStatusText status={o.paymentStatus} />
                      </span>
                      <span className="text-sm font-semibold text-ink tabular-nums">{formatPrice(o.totalAmount, lang)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {data.meta.totalPages > 1 && (
              <nav aria-label={t.shop.pagination} className="mt-8 flex items-center justify-between">
                <button type="button" disabled={!data.meta.hasPrevPage} onClick={() => set({ page: String(data.meta.page - 1) })} className="rounded-full border border-ink/25 px-5 py-2 text-sm disabled:opacity-30">
                  {t.shop.prev}
                </button>
                <span className="text-sm text-muted tabular-nums">
                  {data.meta.page} / {data.meta.totalPages}
                </span>
                <button type="button" disabled={!data.meta.hasNextPage} onClick={() => set({ page: String(data.meta.page + 1) })} className="rounded-full border border-ink/25 px-5 py-2 text-sm disabled:opacity-30">
                  {t.shop.next}
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
