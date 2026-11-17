"use client";

import Link from "next/link";
import { useId } from "react";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import { useListingNavigate } from "./listing-shell";
import { listingQuery, SORTS, type ListingParams, type SortKey } from "./query";

interface Props {
  basePath: string;
  params: ListingParams;
  total: number;
  categories: { slug: string; name: string }[];
  /** Slug of the category being shown (undefined on /shop and /search). */
  activeCategory?: string;
  /** Hide the category chips (search). */
  hideCategories?: boolean;
}

export function ListingToolbar({ basePath, params, total, categories, activeCategory, hideCategories }: Props) {
  const { lang, t, href } = useI18n();
  const navigate = useListingNavigate();
  const sortId = useId();
  const go = (next: Partial<ListingParams>) =>
    navigate(`${href(basePath)}${listingQuery({ ...params, page: 1, ...next })}`);

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm transition-colors duration-300 ${
      active ? "border-ink bg-ink text-canvas" : "border-ink/25 hover:border-ink"
    }`;
  // Keep sort / stock when switching category.
  const keep = listingQuery({ sort: params.sort, inStock: params.inStock });

  return (
    <div className="flex flex-col gap-5 border-y border-ink/15 py-5 lg:flex-row lg:items-center lg:justify-between">
      {!hideCategories && (
        <nav aria-label={t.shop.filters} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:pb-0">
          <Link href={`${href("/shop")}${keep}`} className={`shrink-0 ${chip(!activeCategory)}`} aria-current={!activeCategory ? "page" : undefined}>
            {t.shop.all}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`${href(`/category/${c.slug}`)}${keep}`}
              lang="en"
              className={`shrink-0 ${chip(activeCategory === c.slug)}`}
              aria-current={activeCategory === c.slug ? "page" : undefined}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm lg:ms-auto">
        <p className="eyebrow text-muted" aria-live="polite">
          {plural(lang, t.shop.results, total)}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={params.inStock}
            onChange={(e) => go({ inStock: e.target.checked })}
            className="size-4 accent-[var(--color-ink)]"
          />
          {t.shop.inStock}
        </label>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-muted">
            {t.shop.sortLabel}
          </label>
          <select
            id={sortId}
            value={params.sort}
            onChange={(e) => go({ sort: e.target.value as SortKey })}
            className="rounded-full border border-ink/25 bg-transparent py-1.5 ps-3 pe-8 hover:border-ink focus-visible:border-ink"
          >
            {(Object.keys(SORTS) as SortKey[]).map((key) => (
              <option key={key} value={key} className="bg-canvas text-ink">
                {t.shop.sort[key === "price-asc" ? "priceAsc" : key === "price-desc" ? "priceDesc" : key]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
