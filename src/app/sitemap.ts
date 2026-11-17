import type { MetadataRoute } from "next";
import { localePath, locales } from "@/i18n/config";
import { site } from "@/lib/site";

/** Pages that exist, in both languages, each pointing at its translation (hreflang). */
const PAGES: { path: string; changeFrequency: "daily" | "weekly"; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) =>
    locales.map((lang) => ({
      url: `${site.url}${localePath(lang, page.path)}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${site.url}${localePath(l, page.path)}`])),
      },
    })),
  );
}
