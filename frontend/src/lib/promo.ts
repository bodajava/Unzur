import type { Locale } from "@/i18n/config";

/** Scrolling text bars, edited in Dashboard → Marketing (settings marquee_top / marquee_bottom). */
export interface MarqueeSetting {
  enabled: boolean;
  items: { en: string; ar: string }[];
}

export type WheelPrizeType = "PERCENTAGE" | "FIXED_AMOUNT" | "NONE";

/** Prize wheel, private setting spin_wheel (mirrors backend wheel-config.ts). */
export interface WheelConfig {
  enabled: boolean;
  campaignId: string;
  startsAt: string | null;
  endsAt: string | null;
  delaySeconds: number;
  couponDays: number;
  /** piasters */
  minOrder: number;
  segments: { label: string; labelAr: string; type: WheelPrizeType; value: number; weight: number }[];
  winners: { email: string; segment: number }[];
}

/** What GET /wheel tells the storefront. */
export interface PublicWheel {
  active: boolean;
  campaignId?: string;
  delaySeconds?: number;
  segments?: { label: string; labelAr: string; type: WheelPrizeType; value: number }[];
}

export interface SpinResult {
  segment: number;
  code: string | null;
  expiresAt: string | null;
  repeat: boolean;
}

function isMarquee(v: unknown): v is MarqueeSetting {
  const m = v as MarqueeSetting | null;
  return !!m && typeof m.enabled === "boolean" && Array.isArray(m.items);
}

/**
 * The lines a marquee shows in this language: the dashboard's text when set,
 * else the fallback; null when the dashboard turned it off.
 */
export function marqueeLines(setting: unknown, lang: Locale, fallback: readonly string[]): string[] | null {
  if (!isMarquee(setting)) return [...fallback];
  if (!setting.enabled) return null;
  const lines = setting.items.map((i) => (lang === "ar" ? i.ar : i.en).trim()).filter(Boolean);
  return lines.length ? lines : null;
}

export const newCampaignId = () => `w${Date.now().toString(36)}`;

export const DEFAULT_WHEEL: WheelConfig = {
  enabled: false,
  campaignId: "w1",
  startsAt: null,
  endsAt: null,
  delaySeconds: 8,
  couponDays: 7,
  minOrder: 0,
  segments: [
    { label: "5% off", labelAr: "خصم 5%", type: "PERCENTAGE", value: 5, weight: 40 },
    { label: "Try again", labelAr: "حظ أوفر", type: "NONE", value: 0, weight: 30 },
    { label: "10% off", labelAr: "خصم 10%", type: "PERCENTAGE", value: 10, weight: 20 },
    { label: "EGP 200 off", labelAr: "خصم 200 ج.م", type: "FIXED_AMOUNT", value: 20000, weight: 8 },
    { label: "15% off", labelAr: "خصم 15%", type: "PERCENTAGE", value: 15, weight: 2 },
    { label: "Try again", labelAr: "حظ أوفر", type: "NONE", value: 0, weight: 0 },
  ],
  winners: [],
};
