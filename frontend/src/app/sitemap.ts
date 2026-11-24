import type { MetadataRoute } from "next";
import { localePath } from "@/i18n/config";
import { getAllProductSlugs, getCategories } from "@/lib/api/server";
import { site } from "@/lib/site";

type Entry = {
  path: string;
  changeFrequency: "daily" | "weekly";
  priority: number;
  lastModified?: string;
};

/** Every public page in both languages, each pointing at its translation (hreflang). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getAllProductSlugs()]);
  const pages: Entry[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/shop", changeFrequency: "daily", priority: 0.9 },
    { path: "/about", changeFrequency: "weekly", priority: 0.7 },
    { path: "/contact", changeFrequency: "weekly", priority: 0.5 },
    { path: "/track", changeFrequency: "weekly", priority: 0.3 },
    ...["returns", "shipping", "privacy", "terms"].map((s) => ({ path: `/legal/${s}`, changeFrequency: "weekly" as const, priority: 0.3 })),
    ...categories
      .flatMap((c) => [c, ...c.children])
      .map((c) => ({ path: `/category/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({
      path: `/products/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      lastModified: p.createdAt,
    })),
  ];

  // The storefront is served in English (/ar storefront URLs redirect to /en).
  return pages.map((page) => ({
    url: `${site.url}${localePath("en", page.path)}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
    ...(page.lastModified ? { lastModified: page.lastModified } : {}),
  }));
}
