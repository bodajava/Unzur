import { Regex } from '../../common/utilities/regex/regex.js';

/** Well-known keys and their checks. Unknown keys accept any JSON. */
export const SettingKey = {
  FREE_SHIPPING_THRESHOLD: 'free_shipping_threshold',
  WHATSAPP_NUMBER: 'whatsapp_number',
  STORE_NAME: 'store_name',
  CURRENCY: 'currency',
  /** Value of one loyalty point when redeemed, in piasters (default 10 = 0.10 EGP) */
  LOYALTY_POINT_VALUE: 'loyalty_point_value_piasters',
  /** Piasters spent per point earned on delivery (default 1000 = 1 point per 10 EGP) */
  LOYALTY_EARN_RATE: 'loyalty_earn_piasters_per_point',
  /** Publish reviews without moderation (default false) */
  AUTO_APPROVE_REVIEWS: 'auto_approve_reviews',
  /** Points given to both sides of a referral (default 50, 0 disables) */
  REFERRAL_BONUS_POINTS: 'referral_bonus_points',
  /** Where contact-form notifications go (falls back to SMTP_USER) */
  ADMIN_EMAIL: 'admin_email',
  /** 20.1 Hours a cart must sit untouched before a reminder (default 24) */
  ABANDONED_CART_HOURS: 'abandoned_cart_hours',
  /** 20.2 Minutes before an unpaid online order is cancelled (default 30) */
  UNPAID_ORDER_EXPIRY_MINUTES: 'unpaid_order_expiry_minutes',
  /** 20.2 Minutes before an unpaid purchased gift card is removed (default 60) */
  UNPAID_GIFT_CARD_EXPIRY_MINUTES: 'unpaid_gift_card_expiry_minutes',
} as const;

export const SETTING_DEFAULTS = {
  [SettingKey.LOYALTY_POINT_VALUE]: 10,
  [SettingKey.LOYALTY_EARN_RATE]: 1000,
  [SettingKey.REFERRAL_BONUS_POINTS]: 50,
  [SettingKey.ABANDONED_CART_HOURS]: 24,
  [SettingKey.UNPAID_ORDER_EXPIRY_MINUTES]: 30,
  [SettingKey.UNPAID_GIFT_CARD_EXPIRY_MINUTES]: 60,
} as const;

const positiveInt = (v: unknown) =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 1_000_000 ? null : 'must be a positive integer';

const RULES: Record<string, (value: unknown) => string | null> = {
  /** piasters; null disables free shipping */
  [SettingKey.FREE_SHIPPING_THRESHOLD]: (v) =>
    v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 2_000_000_000)
      ? null
      : 'must be a non-negative integer in piasters, or null',
  [SettingKey.WHATSAPP_NUMBER]: (v) =>
    typeof v === 'string' && Regex.PHONE.test(v.replace(/[\s-]/g, '')) ? null : 'must be a phone number',
  [SettingKey.STORE_NAME]: (v) =>
    typeof v === 'string' && v.trim().length >= 1 && v.length <= 100 ? null : 'must be 1-100 characters',
  [SettingKey.LOYALTY_POINT_VALUE]: positiveInt,
  [SettingKey.LOYALTY_EARN_RATE]: positiveInt,
  [SettingKey.ABANDONED_CART_HOURS]: positiveInt,
  [SettingKey.UNPAID_ORDER_EXPIRY_MINUTES]: positiveInt,
  [SettingKey.UNPAID_GIFT_CARD_EXPIRY_MINUTES]: positiveInt,
  [SettingKey.AUTO_APPROVE_REVIEWS]: (v) => (typeof v === 'boolean' ? null : 'must be true or false'),
  [SettingKey.REFERRAL_BONUS_POINTS]: (v) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100_000 ? null : 'must be an integer >= 0',
  [SettingKey.ADMIN_EMAIL]: (v) =>
    typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : 'must be an email address',
  [SettingKey.CURRENCY]: (v) => (typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? null : 'must be a 3-letter code like EGP'),
};

/** Error message for a bad value, or null when it is fine. */
export function settingValueError(key: string, value: unknown): string | null {
  if (value === undefined) return 'value is required';
  const rule = RULES[key];
  const error = rule ? rule(value) : null;
  if (error) return `${key} ${error}`;
  return JSON.stringify(value).length > 10_000 ? `${key} is too large` : null;
}
