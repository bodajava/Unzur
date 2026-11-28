"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFlyingAdd } from "@/components/cart/use-flying-add";
import { preloadChoices, useChoiceSheet } from "@/components/product/choice-sheet";
import { useI18n } from "@/i18n/client";
import { fmt, isFallback, localized } from "@/i18n/format";
import { errorMessage } from "@/lib/api/errors";
import type { ProductCard } from "@/lib/api/types";
import { colorOf } from "@/lib/colors";

/**
 * The card's footer: a hairline, then the price on one side and
 * "+ Add to cart" on the other. Simple products go straight to the cart;
 * products with versions open a row of versions under it first. Products
 * with a size chart then ask which one (e.g. Arabic or English). The photo
 * flies to the cart and the cart opens.
 */
export function QuickAdd({ product, price }: { product: ProductCard; price: ReactNode }) {
  const { lang, t } = useI18n();
  const name = product.name;
  const { add, run } = useFlyingAdd();
  const [choosing, setChoosing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  /** The version picked before the size-chart question. */
  const pendingVariant = useRef<string | undefined>(undefined);
  const chart = product.sizeChart?.options.length ? product.sizeChart : null;
  const choice = useChoiceSheet(chart, (label, url, photo) =>
    run({ productId: product.id, variantId: pendingVariant.current, quantity: 1, choice: label }, photo, url, () => setChoosing(false)),
  );
  const versions = product.variants ?? [];
  const soldOut = versions.length ? versions.every((v) => v.stock <= 0) : product.stock <= 0;

  const addLine = (variantId: string | undefined, button: Element) => {
    add.reset();
    if (chart) {
      pendingVariant.current = variantId;
      return choice.ask(button);
    }
    const photo = root.current?.closest("article")?.querySelector("[data-card-photo]") ?? button;
    run({ productId: product.id, variantId, quantity: 1 }, photo, null, () => setChoosing(false));
  };

  const action =
    "eyebrow relative shrink-0 whitespace-nowrap py-1 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-[var(--o)] after:scale-x-0 after:bg-current after:transition-transform after:duration-500 after:ease-float [--o:right] hover:after:origin-[var(--o)] hover:after:scale-x-100 focus-visible:after:scale-x-100 rtl:[--o:left] disabled:opacity-50";

  return (
    <div ref={root} className="@container mt-3 border-t border-ink/15 pt-3">
      {choice.sheet}
      {/* Side by side on a roomy card; price over the action on a narrow one (two-up on phones). */}
      <div className="flex flex-col items-start gap-1 @[15rem]:flex-row @[15rem]:items-center @[15rem]:justify-between @[15rem]:gap-3">
        {price}
        {soldOut ? (
          <span className="eyebrow shrink-0 text-muted">{t.productPage.outOfStock}</span>
        ) : (
          <button
            type="button"
            disabled={add.isPending}
            onPointerEnter={() => preloadChoices(chart)}
            onFocus={() => preloadChoices(chart)}
            onClick={(e) => (versions.length ? setChoosing((v) => !v) : addLine(undefined, e.currentTarget))}
            aria-label={versions.length ? fmt(t.product.chooseFor, { name }) : fmt(t.product.addNamed, { name })}
            aria-expanded={versions.length ? choosing : undefined}
            className={action}
          >
            {add.isPending ? t.productPage.adding : `+ ${t.productPage.addToCart}`}
          </button>
        )}
      </div>

      {choosing && (
        <div role="group" aria-label={fmt(t.product.chooseFor, { name })} className="mt-3 flex flex-wrap gap-1.5">
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              lang={isFallback(lang, v.nameAr) ? "en" : undefined}
              disabled={v.stock <= 0 || add.isPending}
              onClick={(e) => addLine(v.id, e.currentTarget)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/25 px-3 py-1.5 text-xs transition-colors hover:border-ink hover:bg-ink hover:text-canvas disabled:pointer-events-none disabled:line-through disabled:opacity-40"
            >
              {colorOf(v.attributes) && (
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full border border-current/30"
                  style={{ backgroundColor: colorOf(v.attributes) }}
                />
              )}
              {localized(lang, v.name, v.nameAr)}
            </button>
          ))}
        </div>
      )}
      {add.isError && <p className="mt-2 text-xs text-[#d1342f]">{errorMessage(add.error, t)}</p>}
    </div>
  );
}
