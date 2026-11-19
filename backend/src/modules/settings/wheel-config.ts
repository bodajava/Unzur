/**
 * Prize wheel config, stored in the private `spin_wheel` setting.
 * Money values are piasters (like every price); percentages are 1-100.
 */
export type WheelPrizeType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'NONE';

export interface WheelSegment {
  /** Shown on the wheel */
  label: string;
  labelAr: string;
  type: WheelPrizeType;
  /** Percent (1-100) or piasters; 0 for NONE */
  value: number;
  /** Relative chance (0 = never lands here by luck) */
  weight: number;
}

export interface WheelConfig {
  enabled: boolean;
  /** Changing it starts a fresh round: everyone can spin again. */
  campaignId: string;
  /** ISO dates; null = no limit */
  startsAt: string | null;
  endsAt: string | null;
  /** Seconds on the site before the wheel pops up */
  delaySeconds: number;
  /** Days a won coupon stays valid */
  couponDays: number;
  /** Minimum order for won coupons, piasters */
  minOrder: number;
  segments: WheelSegment[];
  /** Chosen results: this email always lands on this segment */
  winners: { email: string; segment: number }[];
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TYPES: WheelPrizeType[] = ['PERCENTAGE', 'FIXED_AMOUNT', 'NONE'];
const isDate = (v: unknown) => v === null || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));
const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

export function wheelConfigError(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'must be an object';
  const c = v as Partial<WheelConfig>;
  if (typeof c.enabled !== 'boolean') return 'enabled must be true or false';
  if (typeof c.campaignId !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(c.campaignId)) return 'campaignId is invalid';
  if (!isDate(c.startsAt) || !isDate(c.endsAt)) return 'startsAt/endsAt must be dates or null';
  if (!int(c.delaySeconds, 0, 600)) return 'delaySeconds must be 0-600';
  if (!int(c.couponDays, 1, 365)) return 'couponDays must be 1-365';
  if (!int(c.minOrder, 0, 2_000_000_000)) return 'minOrder must be piasters >= 0';
  if (!Array.isArray(c.segments) || c.segments.length < 2 || c.segments.length > 12) return 'needs 2-12 segments';
  for (const s of c.segments) {
    if (!s || typeof s.label !== 'string' || !s.label.trim() || s.label.length > 30) return 'each segment needs a label (1-30)';
    if (typeof s.labelAr !== 'string' || !s.labelAr.trim() || s.labelAr.length > 30) return 'each segment needs an Arabic label (1-30)';
    if (!TYPES.includes(s.type as WheelPrizeType)) return 'segment type must be PERCENTAGE, FIXED_AMOUNT or NONE';
    if (s.type === 'PERCENTAGE' && !int(s.value, 1, 100)) return 'a percentage must be 1-100';
    if (s.type === 'FIXED_AMOUNT' && !int(s.value, 100, 100_000_000)) return 'a fixed amount must be at least 1 EGP';
    if (!int(s.weight, 0, 1000)) return 'weight must be 0-1000';
  }
  if (!c.segments.some((s) => s.weight > 0)) return 'at least one segment needs a weight above 0';
  if (!Array.isArray(c.winners) || c.winners.length > 500) return 'winners must be a list (max 500)';
  for (const w of c.winners) {
    if (!w || typeof w.email !== 'string' || !EMAIL.test(w.email)) return 'each winner needs a valid email';
    if (!int(w.segment, 0, c.segments.length - 1)) return 'each winner needs an existing segment';
  }
  return null;
}

/** True when the wheel should show right now. */
export function wheelIsLive(c: WheelConfig | null, now = new Date()): c is WheelConfig {
  if (!c?.enabled) return false;
  if (c.startsAt && now < new Date(c.startsAt)) return false;
  if (c.endsAt && now > new Date(c.endsAt)) return false;
  return true;
}
