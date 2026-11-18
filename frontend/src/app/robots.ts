import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const PRIVATE = ["/account", "/cart", "/checkout", "/search", "/admin"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE.map((p) => `/*${p}`) }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
