import type { PublicSettings } from "@/lib/api/types";

/** The store's public contact details, set in Dashboard → Store (empty ones are hidden). */
export interface ContactInfo {
  email: string | null;
  phone: string | null;
  /** tel: and wa.me links, from the same number */
  tel: string | null;
  whatsapp: string | null;
  instagram: string | null;
  /** "@unzur" */
  instagramHandle: string | null;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function contactInfo(settings: PublicSettings): ContactInfo {
  const email = str(settings.contact_email);
  const phone = str(settings.whatsapp_number);
  const digits = phone?.replace(/[^\d+]/g, "") ?? null;
  // wa.me wants the international number without "+": 010… (Egypt) → 2010…
  const intl = digits ? digits.replace(/^\+/, "").replace(/^0(?=1)/, "20") : null;
  const instagram = str(settings.instagram_url);
  const handle = instagram?.match(/instagram\.com\/([A-Za-z0-9._]+)/)?.[1] ?? null;
  return {
    email,
    phone,
    tel: digits ? `tel:${digits}` : null,
    whatsapp: intl ? `https://wa.me/${intl}` : null,
    instagram,
    instagramHandle: handle ? `@${handle}` : null,
  };
}
