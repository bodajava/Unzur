"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, formatPrice, plural } from "@/i18n/format";
import { useCustomers } from "@/lib/admin/api";
import { errorMessage } from "@/lib/api/errors";
import { PageTitle, Skeleton } from "./ui";

/** Everyone who bought something (with or without an account), biggest spenders first. */
export function CustomersList() {
  const { lang, t, href } = useI18n();
  const tc = t.admin.customers;
  const uid = useId();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const customers = useCustomers({ page, limit: 25, search: query || undefined });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const data = customers.data;
  const ordersLink = (email: string) => `${href("/admin/orders")}?q=${encodeURIComponent(email)}`;

  return (
    <div>
      <PageTitle aside={data && <p className="eyebrow text-muted">{plural(lang, tc.count, data.meta.total)}</p>}>{tc.title}</PageTitle>
      <label htmlFor={`${uid}-q`} className="sr-only">{tc.searchLabel}</label>
      <input
        id={`${uid}-q`}
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tc.search}
        className="mb-6 w-full max-w-md rounded-full border border-ink/20 bg-transparent px-4 py-2 text-sm placeholder:text-ink/40 hover:border-ink/50 focus:border-ink focus:outline-none"
      />
      {customers.isError && <p className="mb-6 text-sm text-[#d1342f]">{errorMessage(customers.error, t)}</p>}
      <div className={`transition-opacity ${customers.isFetching ? "opacity-60" : ""}`}>
        {!data ? (
          <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : data.items.length === 0 ? (
          <p className="rounded-2xl bg-panel px-6 py-16 text-center text-muted">{query ? tc.empty : tc.none}</p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl bg-panel md:block dark:ring-1 dark:ring-white/8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-xs text-muted">
                    {[tc.col.customer, tc.col.orders, tc.col.spent, tc.col.last, tc.col.points, ""].map((h, i) => (
                      <th key={i} scope="col" className={`px-5 py-3.5 font-semibold ${i > 0 && i < 3 ? "text-end" : "text-start"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {data.items.map((c) => (
                    <tr key={c.identifier}>
                      <td className="px-5 py-3">
                        <span className="font-semibold">{c.name}</span>
                        <span className={`ms-2 rounded-full px-2 py-0.5 text-[0.65rem] ${c.isRegistered ? "bg-blue/10 text-blue dark:text-[#a3b3ff]" : "bg-ink/8 text-muted"}`}>
                          {c.isRegistered ? tc.registered : tc.guest}
                        </span>
                        <span dir="ltr" className="block text-xs text-muted rtl:text-right">
                          {c.email}
                          {c.phone && ` · ${c.phone}`}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-end tabular-nums">{c.ordersCount}</td>
                      <td className="px-5 py-3 text-end font-semibold whitespace-nowrap tabular-nums">{formatPrice(c.totalSpent, lang)}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted">
                        {c.lastOrderAt ? formatDate(c.lastOrderAt, lang) : "—"}
                        <span className="block text-xs">{fmt(tc.since, { date: formatDate(c.firstSeenAt, lang) })}</span>
                      </td>
                      <td className="px-5 py-3 tabular-nums">{c.isRegistered ? c.loyaltyPoints : "—"}</td>
                      <td className="px-5 py-3 text-end">
                        <Link href={ordersLink(c.email)} className="nav-link text-sm">{tc.viewOrders}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-3 md:hidden">
              {data.items.map((c) => (
                <li key={c.identifier} className="rounded-2xl bg-panel p-4 dark:ring-1 dark:ring-white/8">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{c.name}</p>
                      <p dir="ltr" className="truncate text-xs text-muted rtl:text-right">{c.email}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatPrice(c.totalSpent, lang)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>{c.isRegistered ? tc.registered : tc.guest} · {c.ordersCount} {tc.col.orders}</span>
                    <Link href={ordersLink(c.email)} className="nav-link">{tc.viewOrders}</Link>
                  </div>
                </li>
              ))}
            </ul>
            {data.meta.totalPages > 1 && (
              <nav aria-label={t.shop.pagination} className="mt-8 flex items-center justify-between">
                <button type="button" disabled={!data.meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-ink/25 px-5 py-2 text-sm disabled:opacity-30">{t.shop.prev}</button>
                <span className="text-sm text-muted tabular-nums">{data.meta.page} / {data.meta.totalPages}</span>
                <button type="button" disabled={!data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-ink/25 px-5 py-2 text-sm disabled:opacity-30">{t.shop.next}</button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
