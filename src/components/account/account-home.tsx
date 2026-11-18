"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import { rememberOrder } from "@/components/checkout/last-order";
import { ProductCard } from "@/components/home/product-card";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, formatPrice, localized, plural } from "@/i18n/format";
import { errorMessage } from "@/lib/api/errors";
import { useLogout, useMyOrders, useToggleWishlist, useUpdateProfile, useWishlist } from "@/lib/api/hooks";
import type { User } from "@/lib/api/types";
import { PushToggle } from "@/components/notifications/push-toggle";

type Tab = "orders" | "wishlist" | "profile";

/** The signed-in customer's corner: orders with their status, saved pieces, profile. */
export function AccountHome({ user }: { user: User }) {
  const { t } = useI18n();
  const ta = t.account;
  const [tab, setTab] = useState<Tab>("orders");
  const logout = useLogout();
  const router = useRouter();
  const { href } = useI18n();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">{ta.title}</p>
          <h1 className="display mt-2 text-[clamp(2.2rem,5vw,4rem)]">{fmt(ta.hello, { name: user.firstName })}</h1>
          <p lang="en" dir="ltr" className="mt-2 text-sm text-muted rtl:text-right">
            {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSettled: () => router.replace(href("/account")) })}
          disabled={logout.isPending}
          className="nav-link text-sm disabled:opacity-50"
        >
          {ta.signOut}
        </button>
      </div>

      <div role="tablist" aria-label={ta.title} className="mt-10 flex gap-1 overflow-x-auto border-b border-ink/15">
        {(["orders", "wishlist", "profile"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            aria-controls={`account-${k}`}
            onClick={() => setTab(k)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition-colors ${tab === k ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink"}`}
          >
            {ta.tabs[k]}
          </button>
        ))}
      </div>

      <div id={`account-${tab}`} role="tabpanel" className="pt-8">
        {tab === "orders" && <Orders email={user.email} />}
        {tab === "wishlist" && <Wishlist />}
        {tab === "profile" && <Profile user={user} />}
      </div>
    </div>
  );
}

function Orders({ email }: { email: string }) {
  const { lang, t, href } = useI18n();
  const ta = t.account;
  const [page, setPage] = useState(1);
  const orders = useMyOrders({ page, limit: 10 });
  const router = useRouter();

  if (orders.isError) return <p className="text-sm text-[#d1342f]">{errorMessage(orders.error, t)}</p>;
  if (!orders.data) return <div className="h-48 animate-pulse rounded-2xl bg-panel" />;
  if (!orders.data.items.length) {
    return (
      <div className="rounded-2xl bg-panel px-6 py-14 text-center">
        <p className="text-muted">{ta.ordersEmpty}</p>
        <Link href={href("/shop")} className="mt-5 inline-block rounded-full bg-blue px-6 py-3 text-sm font-semibold text-haze hover:bg-blue-deep">
          {ta.shopNow}
        </Link>
      </div>
    );
  }
  const open = (orderNumber: string) => {
    // The tracking page loads the order with the contact kept for this tab.
    rememberOrder(orderNumber, email);
    router.push(`${href("/track")}?orderNumber=${encodeURIComponent(orderNumber)}`);
  };
  const { meta } = orders.data;
  return (
    <div>
      <ul className="divide-y divide-ink/10 rounded-2xl bg-panel px-5 dark:ring-1 dark:ring-white/8">
        {orders.data.items.map((o) => {
          const count = o.items.reduce((s, i) => s + i.quantity, 0);
          return (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
              <div className="min-w-0">
                <p lang="en" className="font-mono text-sm">
                  {o.orderNumber}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDate(o.createdAt, lang)} · {plural(lang, ta.pieces, count)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={o.status} />
                <span className="text-sm font-semibold tabular-nums">{formatPrice(o.totalAmount, lang)}</span>
                <button type="button" onClick={() => open(o.orderNumber)} className="nav-link text-sm">
                  {ta.details} {t.common.arrow}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <button type="button" disabled={!meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="nav-link disabled:opacity-40">
            ‹
          </button>
          <span className="tabular-nums">
            {meta.page} / {meta.totalPages}
          </span>
          <button type="button" disabled={!meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="nav-link disabled:opacity-40">
            ›
          </button>
        </div>
      )}
    </div>
  );
}

function Wishlist() {
  const { lang, t, href } = useI18n();
  const ta = t.account;
  const list = useWishlist({ limit: 48 });
  const toggle = useToggleWishlist();
  if (list.isError) return <p className="text-sm text-[#d1342f]">{errorMessage(list.error, t)}</p>;
  if (!list.data) return <div className="h-48 animate-pulse rounded-2xl bg-panel" />;
  if (!list.data.items.length) {
    return (
      <div className="rounded-2xl bg-panel px-6 py-14 text-center">
        <p className="text-muted">{ta.wishlistEmpty}</p>
        <Link href={href("/shop")} className="mt-5 inline-block rounded-full bg-blue px-6 py-3 text-sm font-semibold text-haze hover:bg-blue-deep">
          {ta.shopNow}
        </Link>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {list.data.items.map((w) => (
        <li key={w.id}>
          {w.isAvailable ? (
            <ProductCard product={w.product} sizes="(min-width: 1024px) 25vw, 50vw" />
          ) : (
            <p className="rounded-2xl bg-panel p-6 text-sm text-muted">
              <span>{localized(lang, w.product.name, w.product.nameAr)}</span> · {ta.unavailable}
            </p>
          )}
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ productId: w.productId, saved: true })}
            className="nav-link mt-2 text-xs text-muted disabled:opacity-50"
          >
            {ta.remove}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Profile({ user }: { user: User }) {
  const { t } = useI18n();
  const ta = t.account;
  const update = useUpdateProfile();
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "" });
  const id = useId();
  const field =
    "mt-2 w-full rounded-xl border border-ink/25 bg-transparent px-4 py-3 hover:border-ink/50 focus:border-ink focus:outline-none";
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <form
        className="max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() || undefined });
        }}
      >
        {(["firstName", "lastName", "phone"] as const).map((k, i) => (
          <div key={k} className={i ? "mt-5" : ""}>
            <label htmlFor={`${id}-${k}`} className="text-sm font-semibold">
              {ta[k]}
            </label>
            <input
              id={`${id}-${k}`}
              type={k === "phone" ? "tel" : "text"}
              dir={k === "phone" ? "ltr" : "auto"}
              autoComplete={k === "firstName" ? "given-name" : k === "lastName" ? "family-name" : "tel"}
              required={k === "firstName"}
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className={`${field} rtl:text-right`}
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={update.isPending}
          className="mt-8 rounded-full bg-blue px-6 py-3 text-sm font-semibold text-haze hover:bg-blue-deep disabled:opacity-60"
        >
          {update.isPending ? ta.saving : ta.save}
        </button>
        <p role="status" className="mt-3 min-h-5 text-sm">
          {update.isSuccess && ta.saved}
          {update.isError && <span className="text-[#d1342f]">{errorMessage(update.error, t)}</span>}
        </p>
      </form>
      <div>
        <h2 className="text-sm font-semibold">{ta.notifications}</h2>
        <PushToggle audience="customer" />
      </div>
    </div>
  );
}
