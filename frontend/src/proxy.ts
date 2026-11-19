import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";

/** Picks a language from the saved choice, then the browser's Accept-Language. */
function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const header = request.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { base: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.base))?.base as Locale | undefined ?? defaultLocale;
}

/** The storefront speaks English (with Arabic touches); the dashboard (/en/admin, /ar/admin) keeps both. */
const STORE_LOCALE: Locale = "en";

/**
 * Every page lives under /en or /ar. Storefront pages are always /en: an
 * /ar storefront link (old bookmarks, search results) moves there for good.
 * Paths without a language go to /en, or to the visitor's language for /admin.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first, second] = pathname.split("/");
  const isAdmin = (first === "admin") || (locales.some((l) => l === first) && second === "admin");

  if (locales.some((l) => l === first)) {
    if (first === STORE_LOCALE || isAdmin) return;
    const url = request.nextUrl.clone();
    url.pathname = `/${STORE_LOCALE}${pathname.slice(first.length + 1)}`;
    return NextResponse.redirect(url, 308);
  }

  const url = request.nextUrl.clone();
  const lang = isAdmin ? preferredLocale(request) : STORE_LOCALE;
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, files with an extension (icons, robots.txt, sitemap.xml…) and the generated apple icon.
  matcher: ["/((?!_next|api|apple-icon|opengraph-image|.*\\..*).*)"],
};
