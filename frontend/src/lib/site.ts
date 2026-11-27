/** Brand facts used across metadata, JSON-LD and the UI. */
export const site = {
  name: "UNZUR",
  nameAr: "أنظر",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  title: "UNZUR أنظر — Creative Decor cool Lighting",
  description:
    "UNZUR designs sculptural furniture and lighting shaped by architecture and imagination. Shop chairs, tables, shelves and lamps made to be looked at.",
  descriptionAr:
    "أنظر: قطع أثاث وإضاءة متجرّدة في الفن، تستلهم أشكالها من العمارة والهندسة والخيال.",
  taglineAr: "انظر أو كُفّ عن النظر",
  locale: "en_US",
  /** Every spelling people type when they look for the brand (search engines match these). */
  alternateNames: ["أنظر", "انظر", "Unzur", "أنظر UNZUR", "UNZUR Egypt", "Unzor", "Anzur", "Onzur", "انضر", "أنضر", "انزور"],
  /** Official profiles, so search engines tie them to the site (Organization.sameAs). */
  sameAs: ["https://www.instagram.com/unzur.eg"],
  /** Public business defaults (overridden by Dashboard → Store settings when set). */
  email: "contact@unzur.net",
  phone: "+20 109 210 6797",
  currency: "EGP",
  address: {
    locality: "Cairo",
    region: "Cairo",
    country: "EG",
    countryName: "Egypt",
  },
  keywords: [
    "UNZUR",
    "أنظر",
    "انظر",
    "انظر أثاث",
    "UNZUR furniture",
    "furniture Egypt",
    "designer furniture",
    "sculptural furniture",
    "lighting",
    "lamps",
    "أثاث",
    "إضاءة",
    "أثاث مودرن مصر",
    "furniture Cairo",
    "lighting Egypt",
    "modern furniture Egypt",
    "handmade furniture Egypt",
    "metal furniture",
    "lamps Egypt",
    "home decor Egypt",
    "ديكور",
    "ديكور مودرن",
    "كراسي",
    "ترابيزات",
    "أباجورة",
    "إضاءة مودرن",
    "أثاث معدن",
    "أثاث القاهرة",
  ],
} as const;

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/+$/, "");

/**
 * Where the server itself reaches the API. In production the browser calls
 * the API through this site (/api/v1 is proxied, see next.config.mjs) so the
 * session cookies stay first-party; server code skips that hop and goes to
 * API_ORIGIN directly. Without API_ORIGIN both use NEXT_PUBLIC_API_URL.
 */
export const serverApiUrl = process.env.API_ORIGIN
  ? `${process.env.API_ORIGIN.replace(/\/+$/, "")}/api/v1`
  : apiUrl;
