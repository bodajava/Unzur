import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { fmt } from "@/i18n/format";
import { getCategories, getProducts } from "@/lib/api/server";
import { ListingShell } from "./listing-shell";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-grid";
import { PAGE_SIZE, parseListing, SORTS } from "./query";
import { ListingToolbar } from "./toolbar";

interface Props {
  lang: Locale;
  t: Dictionary;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  /** App path of this listing: "/shop", "/category/furniture", "/search". */
  basePath: string;
  category?: string;
  search?: boolean;
}

/** Toolbar + grid + pagination for one listing. Reads the URL, so render it inside <Suspense>. */
export async function ProductListing({ lang, t, searchParams, basePath, category, search }: Props) {
  const params = parseListing(await searchParams);
  if (search && !params.q) {
    return <p className="border-t border-ink/15 pt-10 text-muted">{t.shop.searchPrompt}</p>;
  }

  const [result, categories] = await Promise.all([
    getProducts({
      page: params.page,
      limit: PAGE_SIZE,
      sort: SORTS[params.sort],
      category,
      search: params.q || undefined,
      inStock: params.inStock || undefined,
    }),
    getCategories(),
  ]);
  const href = localePath(lang, basePath);

  return (
    <ListingShell
      toolbar={
        <ListingToolbar
          basePath={basePath}
          params={params}
          total={result.meta.total}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          activeCategory={category}
          hideCategories={search}
        />
      }
    >
      <div className="mt-10">
        {result.items.length ? (
          <ProductGrid products={result.items} />
        ) : (
          <div className="py-16 text-center">
            <p className="text-muted">{search ? fmt(t.shop.searchEmpty, { q: params.q }) : t.shop.empty}</p>
            <Link href={localePath(lang, "/shop")} className="nav-link mt-6 inline-block">
              {search ? t.shop.title : t.shop.clear}
            </Link>
          </div>
        )}
        <Pagination href={href} params={params} totalPages={result.meta.totalPages} t={t} />
      </div>
    </ListingShell>
  );
}
