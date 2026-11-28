"use client";

import { useId, useState } from "react";
import { useCartDrawer } from "@/components/cart/cart-drawer-context";
import { useI18n } from "@/i18n/client";
import { fmt, formatPrice, isFallback, localized } from "@/i18n/format";
import { errorMessage } from "@/lib/api/errors";
import { useAddToCart, useNotifyMe } from "@/lib/api/hooks";
import type { ProductDetail } from "@/lib/api/types";
import { colorOf, isLight } from "@/lib/colors";

const MAX_PER_LINE = 100;

function NotifyMe({ productId, variantId }: { productId: string; variantId?: string }) {
  const { t } = useI18n();
  const id = useId();
  const [email, setEmail] = useState("");
  const notify = useNotifyMe();
  const result = notify.data as { subscribed?: boolean; alreadySubscribed?: boolean } | undefined;
  return (
    <form
      className="mt-6 rounded-2xl bg-panel p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) notify.mutate({ productId, variantId, email: email.trim() });
      }}
      noValidate
    >
      <label htmlFor={id} className="text-sm font-semibold">
        {t.productPage.notifyTitle}
      </label>
      <div className="mt-3 flex items-center gap-3 border-b-2 border-ink pb-1.5">
        <input
          id={id}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.productPage.notifyLabel}
          className="w-full bg-transparent text-sm placeholder:text-ink/40 focus:outline-none"
        />
        <button type="submit" disabled={notify.isPending} className="nav-link shrink-0 text-sm disabled:opacity-50">
          {t.productPage.notifySubmit}
        </button>
      </div>
      <p role="status" className="mt-2 min-h-4 text-xs text-muted">
        {notify.isSuccess && (result?.alreadySubscribed ? t.productPage.notifyAlready : t.productPage.notifyDone)}
        {notify.isError && errorMessage(notify.error, t)}
      </p>
    </form>
  );
}

/** Price, version, quantity and "Add to cart" (or "Email me" when it's out of stock). */
export function PurchasePanel({ product }: { product: ProductDetail }) {
  const { lang, t } = useI18n();
  const { openCart } = useCartDrawer();
  const add = useAddToCart();
  const groupId = useId();

  const variants = product.variants;
  const [variantId, setVariantId] = useState<string | undefined>(
    () => (variants.find((v) => v.stock > 0) ?? variants[0])?.id,
  );
  const variant = variants.find((v) => v.id === variantId);
  // Every version has a colour: show colour circles instead of name buttons.
  const swatches = variants.length > 0 && variants.every((v) => colorOf(v.attributes));
  const [qty, setQty] = useState(1);

  const price = variant ? (variant.salePrice ?? variant.price) : (product.salePrice ?? product.basePrice);
  const compareAt = variant
    ? variant.salePrice !== null
      ? variant.price
      : null
    : product.salePrice !== null
      ? product.basePrice
      : null;
  const stock = variant ? variant.stock : product.stock;
  const max = Math.max(1, Math.min(stock, MAX_PER_LINE));
  const soldOut = stock <= 0;

  const choose = (id: string) => {
    setVariantId(id);
    setQty(1);
    add.reset();
  };

  return (
    <div>
      <p className="flex items-baseline gap-3 text-2xl tabular-nums">
        <span>{formatPrice(price, lang)}</span>
        {compareAt !== null && (
          <span className="text-base text-muted line-through">
            <span className="sr-only">{t.product.was} </span>
            {formatPrice(compareAt, lang)}
          </span>
        )}
      </p>

      {variants.length > 0 && (
        <fieldset className="mt-8">
          <legend id={groupId} className="eyebrow text-muted">
            {t.productPage.choose}
            {/* With colour circles the name isn't on the button: say which one is picked. */}
            {swatches && variant && (
              <span lang={isFallback(lang, variant.nameAr) ? "en" : undefined} className="ms-2 normal-case tracking-normal text-ink">
                {localized(lang, variant.name, variant.nameAr)}
              </span>
            )}
          </legend>
          <div role="radiogroup" aria-labelledby={groupId} className={`mt-3 flex flex-wrap ${swatches ? "gap-3" : "gap-2"}`}>
            {variants.map((v) => {
              const selected = v.id === variantId;
              const color = colorOf(v.attributes);
              const name = localized(lang, v.name, v.nameAr);
              if (swatches) {
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={v.stock <= 0 ? `${name} · ${t.productPage.outOfStock}` : name}
                    title={name}
                    onClick={() => choose(v.id)}
                    className={`relative size-10 rounded-full transition-transform hover:scale-110 ${
                      selected ? "ring-2 ring-ink ring-offset-2 ring-offset-canvas" : ""
                    } ${isLight(color) ? "border border-ink/25" : ""} ${v.stock <= 0 ? "opacity-45" : ""}`}
                    style={{ backgroundColor: color }}
                  >
                    {/* Sold out: a diagonal line across the circle. */}
                    {v.stock <= 0 && (
                      <span aria-hidden="true" className="absolute inset-0 m-auto h-px w-[130%] -translate-x-[11%] rotate-45 bg-ink" />
                    )}
                  </button>
                );
              }
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  lang={isFallback(lang, v.nameAr) ? "en" : undefined}
                  onClick={() => choose(v.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm transition-colors ${
                    selected ? "border-ink bg-ink text-canvas" : "border-ink/25 hover:border-ink"
                  } ${v.stock <= 0 ? "line-through decoration-1" : ""}`}
                >
                  {color && (
                    <span aria-hidden="true" className="size-3.5 rounded-full border border-current/30" style={{ backgroundColor: color }} />
                  )}
                  {name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <p className={`mt-6 text-sm ${soldOut ? "text-muted" : ""}`} aria-live="polite">
        {soldOut
          ? t.productPage.outOfStock
          : stock <= 5
            ? fmt(t.productPage.lowStock, { count: stock })
            : t.productPage.inStock}
      </p>

      {soldOut ? (
        <NotifyMe productId={product.id} variantId={variant?.id} />
      ) : (
        <div className="mt-4 flex flex-wrap items-stretch gap-3">
          <div className="inline-flex items-center rounded-full border border-ink/25" role="group" aria-label={t.productPage.quantity}>
            <button
              type="button"
              aria-label={t.productPage.less}
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid size-12 place-items-center rounded-full text-lg hover:bg-ink/8 disabled:opacity-35"
            >
              −
            </button>
            <span className="min-w-8 text-center tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              aria-label={t.productPage.more}
              disabled={qty >= max}
              onClick={() => setQty((q) => Math.min(max, q + 1))}
              className="grid size-12 place-items-center rounded-full text-lg hover:bg-ink/8 disabled:opacity-35"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={add.isPending}
            onClick={() =>
              add.mutate({ productId: product.id, variantId: variant?.id, quantity: qty }, { onSuccess: () => openCart() })
            }
            className="flex min-w-[12rem] flex-1 items-center justify-center gap-3 rounded-full bg-blue px-8 py-3.5 font-semibold text-haze transition-colors hover:bg-blue-deep disabled:opacity-60 dark:shadow-[0_0_40px_-8px_rgba(27,68,255,0.7)]"
          >
            {add.isPending ? t.productPage.adding : t.productPage.addToCart}
          </button>
        </div>
      )}
      <p role="status" className="mt-3 min-h-5 text-sm">
        {add.isSuccess && t.productPage.added}
        {add.isError && <span className="text-[#d1342f]">{errorMessage(add.error, t)}</span>}
      </p>
    </div>
  );
}
