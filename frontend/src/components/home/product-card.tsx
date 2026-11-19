"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { fmt, formatPrice, isFallback, localized, plural } from "@/i18n/format";
import { Stars } from "@/components/product/review-section";
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
  const name = localized(lang, product.name, product.nameAr);
  const short = localized(lang, product.shortDescription, product.shortDescriptionAr);
  const { price, was, from } = cardPrice(product);
  const priceText = formatPrice(price, lang);

  return (
    <article className="group">
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
          <span
            lang={isFallback(lang, product.category.nameAr) ? "en" : undefined}
            className="eyebrow absolute start-3 top-3 rounded-full bg-canvas/85 px-2.5 py-1 text-[0.65rem] backdrop-blur"
          >
            {localized(lang, product.category.name, product.category.nameAr)}
          </span>
        </div>
      </Link>
      {/* The title link is the one announced; the photo above repeats it for the mouse. */}
      <Link href={url} className="mt-4 block focus-visible:outline-offset-4">
        <h3 lang={isFallback(lang, product.nameAr) ? "en" : undefined} className="display text-[clamp(1.15rem,1.6vw,1.5rem)]">
          {name}
        </h3>
        {short && (
          <p lang={isFallback(lang, product.shortDescriptionAr) ? "en" : undefined} dir="auto" className="mt-1 truncate text-sm text-muted rtl:text-right">
            {short}
          </p>
        )}
      </Link>
      {/* Reviews: stars and count (or an invite to write one), straight to the product's reviews. */}
      <Link href={`${url}#reviews`} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
        {product.rating ? (
          <>
            <Stars value={product.rating.average} size="size-3.5" label={fmt(t.reviews.outOf, { rating: product.rating.average.toFixed(1) })} />
            <span className="tabular-nums">
              {product.rating.average.toFixed(1)} · {plural(lang, t.reviews.count, product.rating.count)}
            </span>
          </>
        ) : (
          <span>☆ {t.reviews.write}</span>
        )}
      </Link>
      <QuickAdd
        product={product}
        price={
          <p className="flex items-baseline gap-2 text-sm tabular-nums">
            <span>{from ? fmt(t.productPage.from, { price: priceText }) : priceText}</span>
            {was !== null && (
              <span className="text-muted line-through">
                <span className="sr-only">{t.product.was} </span>
                {formatPrice(was, lang)}
              </span>
            )}
          </p>
        }
      />
    </article>
  );
}
