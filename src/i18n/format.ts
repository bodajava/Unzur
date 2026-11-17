import { intlLocale, type Locale } from "./config";

/** A message with plural forms (Arabic uses zero/one/two/few/many/other). */
export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Fills {name} placeholders: fmt("Cart: {count}", { count: 2 }) -> "Cart: 2". */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}

/** Picks the right plural form for `count` and fills {count}. */
export function plural(lang: Locale, forms: Plural, count: number, vars: Record<string, string | number> = {}) {
  const rule = new Intl.PluralRules(intlLocale[lang]).select(count);
  return fmt(forms[rule] ?? forms.other, { count, ...vars });
}

const money: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat(intlLocale.en, { maximumFractionDigits: 2 }),
  ar: new Intl.NumberFormat(intlLocale.ar, { maximumFractionDigits: 2 }),
};

/** Piasters -> "2,999 EGP" / "2,999 ج.م" */
export function formatPrice(piasters: number, lang: Locale = "en"): string {
  const amount = money[lang].format(piasters / 100);
  return lang === "ar" ? `${amount} ج.م` : `${amount} EGP`;
}

/** ISO date -> "17 Nov 2026" / "١٧ نوفمبر ٢٠٢٦" (Western digits). Cairo time. */
export function formatDate(iso: string, lang: Locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Cairo",
  }).format(new Date(iso));
}

/** ISO date -> "18 Nov 2026, 14:05" (Cairo time). */
export function formatDateTime(iso: string, lang: Locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Cairo",
  }).format(new Date(iso));
}
