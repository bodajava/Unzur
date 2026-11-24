import { site } from "@/lib/site";

const PRIVATE = ["/account", "/cart", "/checkout", "/search", "/admin"];

/**
 * robots.txt served via a Route Handler so we can emit the Content-Signal
 * directive alongside standard crawl rules and the sitemap declaration.
 */
export function GET() {
  const lines = [
    "User-Agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    "Allow: /",
    ...PRIVATE.map((p) => `Disallow: /*${p}`),
    "",
    `Host: ${site.url}`,
    `Sitemap: ${site.url}/sitemap.xml`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
