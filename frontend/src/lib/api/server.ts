import { cacheLife, cacheTag } from "next/cache";
import { serverApiUrl as apiUrl } from "@/lib/site";
import type {
  ApiEnvelope,
  Brand,
  CategoryNode,
  Paginated,
  ProductCard,
  ProductDetail,
  ProductQuery,
  PublicSettings,
  ReviewPage,
} from "./types";

/**
 * Server-side reads for public pages. Results are cached (Cache Components)
 * so pages are prerendered with real data, which is what search engines see.
 * If the API is down, an empty result is kept for one minute only (RETRY).
 * Shorter lifetimes would turn the data into a request-time "dynamic hole".
 */
const RETRY = { stale: 60, revalidate: 60, expire: 300 } as const;

class NotFoundError extends Error {}

/**
 * True while `next build` prerenders pages. If the API can't be reached then
 * (first deploy, DNS or TLS not ready yet), a single page must not fail the
 * whole build: it is rendered empty and refreshed within a minute (RETRY).
 */
const building = process.env.NEXT_PHASE === "phase-production-build";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, { headers: { accept: "application/json" } });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return ((await res.json()) as ApiEnvelope<T>).data;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") out.set(k, String(v));
  const str = out.toString();
  return str ? `?${str}` : "";
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

/** One product page (by slug). null when it doesn't exist, so the page can call notFound(). */
export async function getProduct(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheTag("products", `product:${slug}`);
  try {
    const data = await get<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
    cacheLife("minutes");
    return data;
  } catch (error) {
    cacheLife(RETRY);
    if (error instanceof NotFoundError || building) return null;
    throw error;
  }
}

/** Product grid for shop / category pages. */
export async function getProducts(params: ProductQuery = {}): Promise<Paginated<ProductCard>> {
  "use cache";
  cacheTag("products");
  try {
    const data = await get<Paginated<ProductCard>>(`/products${query({ ...params })}`);
    cacheLife("minutes");
    return data;
  } catch {
    cacheLife(RETRY);
    const limit = params.limit ?? 20;
    return {
      items: [],
      meta: { total: 0, page: params.page ?? 1, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
    };
  }
}

/** One category (by slug). null when it doesn't exist. */
export async function getCategory(slug: string): Promise<CategoryNode | null> {
  "use cache";
  cacheTag("categories");
  try {
    const data = await get<CategoryNode>(`/categories/${encodeURIComponent(slug)}`);
    cacheLife("hours");
    return data;
  } catch (error) {
    cacheLife(RETRY);
    if (error instanceof NotFoundError || building) return null;
    throw error;
  }
}

export async function getBrands(): Promise<Brand[]> {
  "use cache";
  cacheTag("brands");
  try {
    const data = await get<Brand[]>("/brands");
    cacheLife("hours");
    return data;
  } catch {
    cacheLife(RETRY);
    return [];
  }
}

/** First page of approved reviews (for the product page and its JSON-LD rating). */
export async function getProductReviews(productId: string): Promise<ReviewPage | null> {
  "use cache";
  cacheTag("reviews", `reviews:${productId}`);
  try {
    const data = await get<ReviewPage>(`/products/${encodeURIComponent(productId)}/reviews?limit=10`);
    cacheLife("minutes");
    return data;
  } catch {
    cacheLife(RETRY);
    return null;
  }
}

export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheTag("settings");
  try {
    const data = await get<PublicSettings>("/settings/public");
    cacheLife("hours");
    return data;
  } catch {
    cacheLife(RETRY);
    return {};
  }
}
