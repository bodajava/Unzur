"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { formatPrice, plural } from "@/i18n/format";
import { useAdminProducts } from "@/lib/admin/api";
import type { AdminProduct, AdminProductQuery } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { useCategories } from "@/lib/api/hooks";
import { PageTitle, Skeleton } from "./ui";

type Show = "all" | "visible" | "hidden" | "deleted";
const PAGE_SIZE = 20;

function readQuery(sp: URLSearchParams): { query: AdminProductQuery; show: Show } {
  const show = (["all", "visible", "hidden", "deleted"] as const).find((s) => s === sp.get("show")) ?? "all";
  const page = Number(sp.get("page"));
  return {
    show,
    query: {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      limit: PAGE_SIZE,
      sort: "-createdAt",
      search: sp.get("q")?.trim() || undefined,
      category: sp.get("category") || undefined,
      isActive: show === "visible" ? true : show === "hidden" ? false : undefined,
      includeDeleted: show === "deleted" ? true : undefined,
    },
  };
}

function Thumb({ p }: { p: AdminProduct }) {
  const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
  return (
    <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas/70">
      {img ? (
        <Image src={img.url} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <span lang="en" className="display text-xs text-soft">
          {p.name.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function StockCell({ p }: { p: AdminProduct }) {
  const { lang, t } = useI18n();
  const s = p.stockStats;
  return (
    <span className="tabular-nums">
      {s.totalStock}
      {s.isOutOfStock ? (
        <span className="ms-2 text-xs font-semibold text-[#b02a26] dark:text-[#ff8f8a]">{t.admin.products.soldOut}</span>
      ) : s.isLowStock ? (
        <span className="ms-2 text-xs font-semibold text-[#a87900] dark:text-[#ffd45c]">{t.admin.products.lowStock}</span>
      ) : null}
      {p.variants.length > 0 && <span className="block text-xs text-muted">{plural(lang, t.admin.products.versions, p.variants.length)}</span>}
    </span>
  );
}

function State({ p }: { p: AdminProduct }) {
  const { t } = useI18n();
  const tp = t.admin.products;
  if (p.deletedAt) return <span className="rounded-full bg-ink/8 px-2.5 py-1 text-xs text-muted">{tp.deleted}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          p.isActive ? "bg-[#1f9d55]/14 text-[#16773f] dark:text-[#7ee2a8]" : "bg-ink/8 text-muted"
        }`}
      >
        {p.isActive ? tp.visible : tp.hidden}
      </span>
      {p.isFeatured && <span className="rounded-full bg-blue/12 px-2.5 py-1 text-xs text-blue dark:text-[#a3b3ff]">{tp.featured}</span>}
    </span>
  );
}

export function ProductsList() {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const { query, show } = readQuery(new URLSearchParams(sp?.toString()));
  const products = useAdminProducts(query);
  const categories = useCategories();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(sp?.get("q") ?? "");
  const uid = useId();
  const tp = t.admin.products;

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp?.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (search.trim() === (sp?.get("q") ?? "")) return;
    const timer = setTimeout(() => set({ q: search.trim() || undefined }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [search]);

  const data = products.data;
  // "Deleted" lists everything incl. deleted; show only the deleted ones there.
  const items = data ? (show === "deleted" ? data.items.filter((p) => p.deletedAt) : data.items) : [];
  const flatCategories = (categories.data ?? []).flatMap((c) => [c, ...c.children]);
  const priceText = (p: AdminProduct) => formatPrice(p.salePrice ?? p.basePrice, lang);

  return (
    <div>
      <PageTitle
        aside={
          <Link href={href("/admin/products/new")} className="rounded-full bg-blue px-6 py-3 text-sm font-semibold text-haze hover:bg-blue-deep">
            + {tp.add}
          </Link>
        }
      >
        {tp.title}
      </PageTitle>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-ink/20 p-1" role="radiogroup" aria-label={tp.show}>
          {(["all", "visible", "hidden", "deleted"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={show === s}
              onClick={() => set({ show: s === "all" ? undefined : s })}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${show === s ? "bg-ink text-canvas" : "hover:bg-ink/8"}`}
            >
              {tp[s]}
            </button>
          ))}
        </div>
        <label htmlFor={`${uid}-q`} className="sr-only">{tp.searchLabel}</label>
        <input
          id={`${uid}-q`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tp.search}
          className="min-w-[14rem] flex-1 rounded-full border border-ink/20 bg-transparent px-4 py-2 text-sm placeholder:text-ink/40 hover:border-ink/50 focus:border-ink focus:outline-none"
        />
        <select
          aria-label={tp.col.category}
          value={query.category ?? ""}
          onChange={(e) => set({ category: e.target.value || undefined })}
          className="rounded-full border border-ink/20 bg-transparent py-2 ps-3.5 pe-8 text-sm hover:border-ink/50 focus:border-ink focus:outline-none"
        >
          <option value="" className="bg-canvas">{tp.anyCategory}</option>
          {flatCategories.map((c) => (
            <option key={c.id} value={c.slug} className="bg-canvas">{c.name}</option>
          ))}
        </select>
        {data && <span className="eyebrow ms-auto text-muted">{plural(lang, tp.count, show === "deleted" ? items.length : data.meta.total)}</span>}
      </div>

      {products.isError && <p className="mb-6 text-sm text-[#d1342f]">{errorMessage(products.error, t)}</p>}

      <div className={`transition-opacity ${pending || products.isFetching ? "opacity-60" : ""}`}>
        {!data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl bg-panel px-6 py-16 text-center text-muted">{query.search || query.category || show !== "all" ? tp.empty : tp.none}</p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl bg-panel md:block dark:ring-1 dark:ring-white/8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-xs text-muted">
                    {[tp.col.product, tp.col.category, tp.col.price, tp.col.stock, tp.col.state].map((h, i) => (
                      <th key={h} scope="col" className={`px-5 py-3.5 font-semibold ${i === 2 || i === 3 ? "text-end" : "text-start"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {items.map((p) => (
                    <tr key={p.id} className="cursor-pointer transition-colors hover:bg-ink/[0.04]" onClick={() => router.push(href(`/admin/products/${p.id}`))}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb p={p} />
                          <div className="min-w-0">
                            <Link href={href(`/admin/products/${p.id}`)} lang="en" className="block truncate font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                              {p.name}
                            </Link>
                            <span dir="ltr" className="text-xs text-muted">{p.sku ?? "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td lang="en" className="px-5 py-3 text-muted">{p.category.name}</td>
                      <td className="px-5 py-3 text-end whitespace-nowrap tabular-nums">
                        {priceText(p)}
                        {p.salePrice !== null && <span className="block text-xs text-muted line-through">{formatPrice(p.basePrice, lang)}</span>}
                      </td>
                      <td className="px-5 py-3 text-end"><StockCell p={p} /></td>
                      <td className="px-5 py-3"><State p={p} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-3 md:hidden">
              {items.map((p) => (
                <li key={p.id}>
                  <Link href={href(`/admin/products/${p.id}`)} className="flex items-center gap-3 rounded-2xl bg-panel p-3 dark:ring-1 dark:ring-white/8">
                    <Thumb p={p} />
                    <div className="min-w-0 flex-1">
                      <p lang="en" className="truncate font-semibold">{p.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                        <span className="tabular-nums">{priceText(p)}</span>
                        <StockCell p={p} />
                      </div>
                      <div className="mt-2">
                        <State p={p} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {data.meta.totalPages > 1 && (
              <nav aria-label={t.shop.pagination} className="mt-8 flex items-center justify-between">
                <button type="button" disabled={!data.meta.hasPrevPage} onClick={() => set({ page: String(data.meta.page - 1) })} className="rounded-full border border-ink/25 px-5 py-2 text-sm disabled:opacity-30">{t.shop.prev}</button>
                <span className="text-sm text-muted tabular-nums">{data.meta.page} / {data.meta.totalPages}</span>
                <button type="button" disabled={!data.meta.hasNextPage} onClick={() => set({ page: String(data.meta.page + 1) })} className="rounded-full border border-ink/25 px-5 py-2 text-sm disabled:opacity-30">{t.shop.next}</button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
