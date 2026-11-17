"use client";

import { useState } from "react";
import { useCartDrawer } from "@/components/cart/cart-drawer-context";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { errorMessage } from "@/lib/api/errors";
import { useAddToCart } from "@/lib/api/hooks";
import type { ProductCard } from "@/lib/api/types";

/**
 * "Add to cart" on a product card. One tap for simple products; products with
 * versions open a small chooser on the card first. Always visible over the
 * bottom of the photo, so nobody has to open the product to buy it.
 */
export function QuickAdd({ product }: { product: ProductCard }) {
  const { t } = useI18n();
  const { openCart } = useCartDrawer();
  const add = useAddToCart();
  const [choosing, setChoosing] = useState(false);
  const versions = product.variants ?? [];
  const soldOut = versions.length ? versions.every((v) => v.stock <= 0) : product.stock <= 0;

  const addLine = (variantId?: string) =>
    add.mutate(
      { productId: product.id, variantId, quantity: 1 },
      {
        onSuccess: () => {
          setChoosing(false);
          openCart();
        },
      },
    );

  if (soldOut) return null;

  return (
    <div className="absolute inset-x-3 bottom-3 z-10">
      {choosing ? (
        <div
          role="group"
          aria-label={fmt(t.product.chooseFor, { name: product.name })}
          className="rounded-2xl bg-canvas/90 p-2.5 shadow-[0_10px_30px_-12px_rgba(10,20,90,0.45)] backdrop-blur-md dark:ring-1 dark:ring-white/10"
        >
          <div className="flex flex-wrap gap-1.5">
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                lang="en"
                disabled={v.stock <= 0 || add.isPending}
                onClick={() => addLine(v.id)}
                className="rounded-full border border-ink/25 px-3 py-1.5 text-xs transition-colors hover:border-ink hover:bg-ink hover:text-canvas disabled:pointer-events-none disabled:line-through disabled:opacity-40"
              >
                {v.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setChoosing(false);
                add.reset();
              }}
              aria-label={t.common.close}
              className="ms-auto grid size-7 place-items-center rounded-full text-sm hover:bg-ink/10"
            >
              ×
            </button>
          </div>
          {add.isError && <p className="mt-1.5 text-[0.7rem] text-[#d1342f]">{errorMessage(add.error, t)}</p>}
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={add.isPending}
            onClick={() => (versions.length ? setChoosing(true) : addLine())}
            aria-label={versions.length ? fmt(t.product.chooseFor, { name: product.name }) : fmt(t.product.addNamed, { name: product.name })}
            aria-expanded={versions.length ? choosing : undefined}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-canvas/85 py-2.5 text-sm font-semibold text-ink shadow-[0_10px_30px_-12px_rgba(10,20,90,0.45)] backdrop-blur-md transition-colors hover:bg-blue hover:text-haze disabled:opacity-60 dark:ring-1 dark:ring-white/10"
          >
            <span aria-hidden className="text-base leading-none">
              +
            </span>
            {add.isPending ? t.productPage.adding : t.productPage.addToCart}
          </button>
          {add.isError && (
            <p className="mt-1.5 rounded-full bg-canvas/90 px-3 py-1 text-center text-[0.7rem] text-[#d1342f]">
              {errorMessage(add.error, t)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
