"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatDate, formatDateTime, formatPrice } from "@/i18n/format";
import { useAdminOrders, useCustomer } from "@/lib/admin/api";
import { errorMessage } from "@/lib/api/errors";
import { OrderStatusBadge, PaymentStatusText } from "./status-badge";
import { Panel, Skeleton } from "./ui";

/**
 * One customer at a glance (like Shopify's customer page): who they are, what
 * they spent, how to reach them, and every order with its status.
 */
export function CustomerDetail({ identifier }: { identifier: string }) {
  const { lang, t, href } = useI18n();
  const tc = t.admin.customer;
  const customer = useCustomer(identifier);
  const [page, setPage] = useState(1);
  const orders = useAdminOrders({ customer: identifier, page, limit: 10, sort: "-createdAt" });
  const c = customer.data;

  if (customer.isError) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">{customer.error && "status" in customer.error && customer.error.status === 404 ? tc.notFound : errorMessage(customer.error, t)}</p>
        <Link href={href("/admin/customers")} className="nav-link mt-6 inline-block text-sm">
          {t.common.arrow} {tc.back}
        </Link>
      </div>
    );
  }

  const phone = c?.phone?.replace(/[^\d+]/g, "");
  const whatsapp = phone ? `https://wa.me/${phone.replace(/^\+/, "").replace(/^0/, "20")}` : null;

  return (
    <div>
      <Link href={href("/admin/customers")} className="nav-link text-sm text-muted">
        <span className="inline-block rtl:rotate-180">←</span> {tc.back}
      </Link>

      {!c ? (
        <Skeleton className="mt-6 h-40" />
      ) : (
        <>
          <div className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 lang="en" dir="auto" className="display text-[clamp(2rem,5vw,3.6rem)]">
                {c.name || c.email}
              </h1>
              <p className="mt-2 text-sm text-muted">
                <span className={`me-2 rounded-full px-2 py-0.5 text-xs ${c.isRegistered ? "bg-blue/10 text-blue dark:text-[#a3b3ff]" : "bg-ink/8"}`}>
                  {c.isRegistered ? t.admin.customers.registered : t.admin.customers.guest}
                </span>
                {tc.since} {formatDate(c.firstSeenAt, lang)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              // Every order (any status), like the list below; spend counts completed sales only.
              [tc.orders, String(orders.data?.meta.total ?? c.ordersCount)],
              [tc.spent, formatPrice(c.totalSpent, lang)],
              [tc.aov, formatPrice(c.ordersCount ? Math.round(c.totalSpent / c.ordersCount) : 0, lang)],
              [tc.last, c.lastOrderAt ? formatDate(c.lastOrderAt, lang) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-panel p-5 dark:ring-1 dark:ring-white/8">
                <p className="eyebrow text-muted">{label}</p>
                <p className="mt-3 text-[clamp(1.3rem,2.2vw,1.8rem)] font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Panel
          title={tc.ordersTitle}
          action={
            <Link href={`${href("/admin/orders")}?customer=${encodeURIComponent(identifier)}`} className="nav-link text-xs">
              {tc.allOrders} {t.common.arrow}
            </Link>
          }
        >
          {!orders.data ? (
            <Skeleton className="h-48" />
          ) : orders.data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{tc.noOrders}</p>
          ) : (
            <>
              <ul className="divide-y divide-ink/8">
                {orders.data.items.map((o) => (
                  <li key={o.id}>
                    <Link href={href(`/admin/orders/${o.id}`)} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 hover:bg-ink/[0.03]">
                      <span className="min-w-0">
                        <span dir="ltr" className="block font-mono text-sm font-semibold">
                          {o.orderNumber}
                        </span>
                        <span className="block text-xs text-muted">
                          {formatDateTime(o.createdAt, lang)} · {t.paymentMethod[o.paymentMethod]} · <PaymentStatusText status={o.paymentStatus} />
                        </span>
                      </span>
                      <span className="flex items-center gap-4">
                        <OrderStatusBadge status={o.status} />
                        <span className="w-28 text-end font-semibold tabular-nums">{formatPrice(o.totalAmount, lang)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {orders.data.meta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                  <button type="button" disabled={!orders.data.meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="nav-link disabled:opacity-30">
                    {t.shop.prev}
                  </button>
                  <span className="text-muted tabular-nums">
                    {orders.data.meta.page} / {orders.data.meta.totalPages}
                  </span>
                  <button type="button" disabled={!orders.data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="nav-link disabled:opacity-30">
                    {t.shop.next}
                  </button>
                </div>
              )}
            </>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title={tc.contact}>
            {!c ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="space-y-3 text-sm">
                <p dir="ltr" className="break-all rtl:text-right">
                  {c.email}
                </p>
                {c.phone && (
                  <p dir="ltr" className="rtl:text-right">
                    {c.phone}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href={`mailto:${c.email}`} className="rounded-full border border-ink/20 px-3.5 py-1.5 text-xs font-semibold hover:border-ink">
                    {tc.email}
                  </a>
                  {phone && (
                    <a href={`tel:${phone}`} className="rounded-full border border-ink/20 px-3.5 py-1.5 text-xs font-semibold hover:border-ink">
                      {tc.call}
                    </a>
                  )}
                  {whatsapp && (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-full border border-ink/20 px-3.5 py-1.5 text-xs font-semibold hover:border-ink">
                      {tc.whatsapp}
                    </a>
                  )}
                </div>
                {c.isRegistered ? (
                  <p className="pt-2 text-xs text-muted">
                    {tc.points}: <span className="font-semibold text-ink tabular-nums">{c.loyaltyPoints}</span>
                  </p>
                ) : (
                  <p className="pt-2 text-xs text-muted">{tc.guestNote}</p>
                )}
              </div>
            )}
          </Panel>

          {c?.isRegistered && (
            <Panel title={tc.addresses}>
              {c.addresses.length === 0 ? (
                <p className="text-sm text-muted">{tc.noAddresses}</p>
              ) : (
                <ul className="space-y-4 text-sm">
                  {c.addresses.map((a) => (
                    <li key={a.id}>
                      <p className="font-semibold">
                        {a.label}
                        {a.isDefault && <span className="ms-2 rounded-full bg-ink/8 px-2 py-0.5 text-[0.65rem] font-normal">{tc.default}</span>}
                      </p>
                      <p className="text-muted">
                        {[a.street, a.building && `#${a.building}`, a.floor, a.apartment].filter(Boolean).join(", ")}
                        <br />
                        {a.city}, {a.governorate}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/** Unwraps the route params on the client (the page renders inside <Suspense>). */
export function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CustomerDetail identifier={decodeURIComponent(id)} />;
}
