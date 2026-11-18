/** Languages the storefront speaks. Every page lives under /en/… or /ar/…. */
export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Remembers an explicit language choice so "/" opens it next time. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (value: string | undefined | null): value is Locale =>
  !!value && (locales as readonly string[]).includes(value);

export const dirOf = (lang: Locale) => (lang === "ar" ? "rtl" : "ltr");

/** Open Graph locale codes. */
export const ogLocale: Record<Locale, string> = { en: "en_US", ar: "ar_EG" };

/** Intl locale for numbers and dates (Arabic keeps Western digits, as Egyptian shops do). */
export const intlLocale: Record<Locale, string> = { en: "en-EG", ar: "ar-EG-u-nu-latn" };

/**
 * Prefixes an app path with the language: ("ar", "/cart") -> "/ar/cart",
 * ("en", "/") -> "/en", ("en", "/#pieces") -> "/en#pieces".
 */
export function localePath(lang: Locale, path = "/"): string {
  if (path === "/" || path === "") return `/${lang}`;
  if (path.startsWith("/#") || path.startsWith("/?")) return `/${lang}${path.slice(1)}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The same page in another language: "/en/products/x" -> "/ar/products/x". */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join("/").replace(/\/$/, "") || `/${to}`;
}

/** Canonical + hreflang links for a page that exists in both languages. */
export function alternatesFor(lang: Locale, path = "/") {
  return {
    canonical: localePath(lang, path),
    languages: {
      en: localePath("en", path),
      ar: localePath("ar", path),
      "x-default": localePath(defaultLocale, path),
    },
  };
}
