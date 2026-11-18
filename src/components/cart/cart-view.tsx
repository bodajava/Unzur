"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatPrice, isFallback, localized, plural } from "@/i18n/format";
import { errorMessage } from "@/lib/api/errors";
import { useApplyCoupon, useCart, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from "@/lib/api/hooks";
import type { CartLine } from "@/lib/api/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function Line({ line, onNavigate }: { line: CartLine; onNavigate?: () => void }) {
  const { lang, t, href } = useI18n();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const busy = update.isPending || remove.isPending;
  const max = Math.max(1, Math.min(line.availableStock, 100));
  const problem = !line.isAvailable
    ? t.cart.unavailable
    : !line.hasEnoughStock
      ? fmt(t.cart.stockLeft, { count: line.availableStock })
      : null;
  const error = update.error ?? remove.error;
  const name = localized(lang, line.product.name, line.product.nameAr);

  return (
    <li className={`flex gap-4 py-5 transition-opacity ${busy ? "opacity-50" : ""}`}>
      <Link
        href={href(`/products/${line.product.slug}`)}
        onClick={onNavigate}
        className="relative block aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-lg bg-panel sm:w-24"
      >
        {line.product.primaryImage ? (
          <Image src={line.product.primaryImage.url} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <span aria-hidden lang="en" className="display absolute inset-0 grid place-items-center text-2xl text-soft">
            {initials(line.product.name)}
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={href(`/products/${line.product.slug}`)}
              onClick={onNavigate}
              lang={isFallback(lang, line.product.nameAr) ? "en" : undefined}
              className="display block truncate text-lg hover:opacity-70"
            >
              {name}
            </Link>
            {line.variant && (
              <p lang={isFallback(lang, line.variant.nameAr) ? "en" : undefined} className="mt-0.5 text-sm text-muted">
                {localized(lang, line.variant.name, line.variant.nameAr)}
              </p>
            )}
          </div>
          <p className="shrink-0 text-sm tabular-nums">{formatPrice(line.lineTotal, lang)}</p>
        </div>
        {problem && <p className="mt-1 text-xs font-semibold text-[#d1342f]">{problem}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <div className="inline-flex items-center rounded-full border border-ink/25" role="group" aria-label={fmt(t.cart.quantityLabel, { name })}>
            <button
              type="button"
              aria-label={t.productPage.less}
              disabled={busy}
              onClick={() => update.mutate({ itemId: line.id, quantity: line.quantity - 1 })}
              className="grid size-9 place-items-center rounded-full hover:bg-ink/8 disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-6 text-center text-sm tabular-nums" aria-live="polite">
              {line.quantity}
            </span>
            <button
              type="button"
              aria-label={t.productPage.more}
              disabled={busy || line.quantity >= max}
              onClick={() => update.mutate({ itemId: line.id, quantity: line.quantity + 1 })}
              className="grid size-9 place-items-center rounded-full hover:bg-ink/8 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => remove.mutate(line.id)}
            aria-label={fmt(t.cart.removeLabel, { name })}
            className="nav-link text-sm text-muted"
          >
            {t.cart.remove}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-[#d1342f]">{errorMessage(error, t)}</p>}
      </div>
    </li>
  );
}

function Coupon({ applied }: { applied: string | null }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();
  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{fmt(t.cart.couponApplied, { code: applied })}</span>
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="nav-link text-muted">
          {t.cart.removeCoupon}
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) apply.mutate(code.trim(), { onSuccess: () => setCode("") });
      }}
    >
      <div className="flex items-center gap-3 border-b border-ink/40 pb-1.5 focus-within:border-ink">
        <label className="sr-only" htmlFor="cart-coupon">
          {t.cart.coupon}
        </label>
        <input
          id="cart-coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t.cart.coupon}
          autoComplete="off"
          className="w-full bg-transparent text-sm uppercase placeholder:normal-case placeholder:text-ink/40 focus:outline-none"
        />
        <button type="submit" disabled={apply.isPending || !code.trim()} className="nav-link shrink-0 text-sm disabled:opacity-40">
          {apply.isPending ? t.cart.applying : t.cart.apply}
        </button>
      </div>
      {apply.isError && <p className="mt-2 text-xs text-[#d1342f]">{errorMessage(apply.error, t)}</p>}
    </form>
  );
}

/** Cart contents + totals. Used by the drawer and the /cart page. */
export function CartView({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const { lang, t, href } = useI18n();
  const { data: cart, isPending, isError, error } = useCart();

  if (isPending) {
    return (
      <div role="status" aria-label={t.shop.loading} className="space-y-4 py-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="aspect-[4/5] w-20 animate-pulse rounded-lg bg-panel" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-2/3 animate-pulse rounded bg-panel" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-panel" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (isError) return <p className="py-10 text-muted">{errorMessage(error, t)}</p>;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">{t.cart.empty}</p>
        <Link href={href("/shop")} onClick={onNavigate} className="mt-6 inline-flex rounded-full border-2 border-ink px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-canvas">
          {t.cart.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <div className={compact ? "flex h-full flex-col" : "grid gap-12 lg:grid-cols-[1fr_24rem]"}>
      <div className={compact ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""} data-lenis-prevent>
        <p className="eyebrow text-muted">{plural(lang, t.cart.items, cart.itemCount)}</p>
        <ul className="divide-y divide-ink/12">
          {cart.items.map((line) => (
            <Line key={line.id} line={line} onNavigate={onNavigate} />
          ))}
        </ul>
      </div>

      <div className={compact ? "border-t border-ink/15 pt-5" : "self-start rounded-2xl bg-panel p-6 lg:sticky lg:top-32"}>
        <Coupon applied={cart.coupon?.valid ? cart.coupon.code : null} />
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t.cart.subtotal}</dt>
            <dd className="tabular-nums">{formatPrice(cart.subtotal, lang)}</dd>
          </div>
          {cart.discountAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">{t.cart.discount}</dt>
              <dd className="tabular-nums">−{formatPrice(cart.discountAmount, lang)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-ink/15 pt-3 text-base font-semibold">
            <dt>{t.cart.total}</dt>
            <dd className="tabular-nums">{formatPrice(cart.estimatedTotal, lang)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">{t.cart.shippingNote}</p>
        {!cart.canCheckout && <p className="mt-3 text-xs font-semibold text-[#d1342f]">{t.cart.fixIssues}</p>}
        <Link
          href={href("/checkout")}
          onClick={onNavigate}
          aria-disabled={!cart.canCheckout}
          className={`mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-blue px-6 py-3.5 font-semibold text-haze transition-colors hover:bg-blue-deep ${
            cart.canCheckout ? "" : "pointer-events-none opacity-40"
          }`}
        >
          {t.cart.checkout}
          <span aria-hidden>{t.common.arrow}</span>
        </Link>
      </div>
    </div>
  );
}
