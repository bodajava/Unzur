"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { fmt, formatPrice } from "@/i18n/format";
import type { ProductCard as Product } from "@/lib/api/types";
import { QuickAdd } from "./quick-add";

/** Initials stand in for a missing photo, set in the display face. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

/** Price shown on a card: products with versions start "From" the cheapest one. */
function cardPrice(product: Product) {
  const versions = product.variants ?? [];
  if (!versions.length) {
    return { price: product.salePrice ?? product.basePrice, was: product.salePrice !== null ? product.basePrice : null, from: false };
  }
  const prices = versions.map((v) => v.salePrice ?? v.price);
  const min = Math.min(...prices);
  return { price: min, was: null, from: new Set(prices).size > 1 };
}

export function ProductCard({
  product,
  priority = false,
  sizes = "(min-width: 1024px) 26vw, 78vw",
}: {
  product: Product;
  priority?: boolean;
  sizes?: string;
}) {
  const { lang, t, href } = useI18n();
  const url = href(`/products/${product.slug}`);
  const { price, was, from } = cardPrice(product);
  const priceText = formatPrice(price, lang);

  return (
    <article className="group/card group">
      <div className="relative">
        {/* The photo is a second link to the same page; the title link is the one announced. */}
        <Link href={url} tabIndex={-1} aria-hidden className="block">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-panel dark:ring-1 dark:ring-white/8">
            {product.primaryImage ? (
              <Image
                src={product.primaryImage.url}
                alt=""
                fill
                priority={priority}
                sizes={sizes}
                className="object-cover transition-transform duration-[1.2s] ease-float group-hover:scale-[1.04]"
              />
            ) : (
              <div
                lang="en"
                className="display absolute inset-0 grid place-items-center text-[clamp(3rem,9vw,8rem)] text-soft transition-transform duration-[1.2s] ease-float group-hover:scale-[1.06]"
              >
                {initials(product.name)}
              </div>
            )}
            <span lang="en" className="eyebrow absolute start-3 top-3 rounded-full bg-canvas/85 px-2.5 py-1 text-[0.65rem] backdrop-blur">
              {product.category.name}
            </span>
          </div>
        </Link>
        <QuickAdd product={product} />
      </div>
      <Link href={url} className="block focus-visible:outline-offset-4">
        <h3 lang="en" className="display mt-4 text-[clamp(1.15rem,1.6vw,1.5rem)]">
          {product.name}
        </h3>
        <p className="mt-1.5 flex items-baseline gap-2 text-sm tabular-nums">
          <span>{from ? fmt(t.productPage.from, { price: priceText }) : priceText}</span>
          {was !== null && (
            <span className="text-muted line-through">
              <span className="sr-only">{t.product.was} </span>
              {formatPrice(was, lang)}
            </span>
          )}
        </p>
      </Link>
    </article>
  );
}
