import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * Only pages that exist are listed. Category and product URLs join this list
 * when those pages are built (getAllProductSlugs is ready in lib/api/server).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: site.url, changeFrequency: "daily", priority: 1 }];
}
