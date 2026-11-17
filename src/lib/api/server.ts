import { cacheLife, cacheTag } from "next/cache";
import { apiUrl } from "@/lib/site";
import type { ApiEnvelope, CategoryNode, Paginated, ProductCard } from "./types";

/**
 * Server-side reads for public pages. Results are cached (Cache Components)
 * so pages are prerendered with real data, which is what search engines see.
 * If the API is down, an empty result is kept for one minute only (RETRY).
 * Shorter lifetimes would turn the data into a request-time "dynamic hole".
 */
const RETRY = { stale: 60, revalidate: 60, expire: 300 } as const;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return ((await res.json()) as ApiEnvelope<T>).data;
}

export async function getCategories(): Promise<CategoryNode[]> {
  "use cache";
  cacheTag("categories");
  try {
    const data = await get<CategoryNode[]>("/categories");
    cacheLife("hours");
    return data;
  } catch {
    cacheLife(RETRY);
    return [];
  }
}

/** Best sellers for the home page: featured pieces, newest first (falls back to newest). */
export async function getBestSellers(limit = 8): Promise<ProductCard[]> {
  "use cache";
  cacheTag("products");
  try {
    const featured = await get<Paginated<ProductCard>>(`/products?isFeatured=true&limit=${limit}&sort=-createdAt`);
    const items = featured.items.length
      ? featured.items
      : (await get<Paginated<ProductCard>>(`/products?limit=${limit}&sort=-createdAt`)).items;
    cacheLife("minutes");
    return items;
  } catch {
    cacheLife(RETRY);
    return [];
  }
}

/** Every public product slug (sitemap). */
export async function getAllProductSlugs(): Promise<{ slug: string; createdAt: string }[]> {
  "use cache";
  cacheTag("products");
  try {
    const out: { slug: string; createdAt: string }[] = [];
    for (let page = 1; page <= 50; page++) {
      const res = await get<Paginated<ProductCard>>(`/products?page=${page}&limit=100`);
      out.push(...res.items.map((p) => ({ slug: p.slug, createdAt: p.createdAt })));
      if (!res.meta.hasNextPage) break;
    }
    cacheLife("hours");
    return out;
  } catch {
    cacheLife(RETRY);
    return [];
  }
}
