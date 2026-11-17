/** Listing filters live in the URL (?sort=&page=&stock=1&q=) so every view can be shared and indexed. */

export const SORTS = {
  new: "-createdAt",
  "price-asc": "basePrice",
  "price-desc": "-basePrice",
  name: "name",
} as const;
export type SortKey = keyof typeof SORTS;

export const PAGE_SIZE = 12;

export interface ListingParams {
  sort: SortKey;
  page: number;
  inStock: boolean;
  q: string;
}

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseListing(raw: Raw): ListingParams {
  const sort = first(raw.sort);
  const page = Number.parseInt(first(raw.page), 10);
  return {
    sort: sort in SORTS ? (sort as SortKey) : "new",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
    inStock: first(raw.stock) === "1",
    q: first(raw.q).trim().slice(0, 100),
  };
}

/** "?sort=price-asc&page=2" (defaults are left out so URLs stay clean). */
export function listingQuery(p: Partial<ListingParams>): string {
  const out = new URLSearchParams();
  if (p.q) out.set("q", p.q);
  if (p.sort && p.sort !== "new") out.set("sort", p.sort);
  if (p.inStock) out.set("stock", "1");
  if (p.page && p.page > 1) out.set("page", String(p.page));
  const s = out.toString();
  return s ? `?${s}` : "";
}
