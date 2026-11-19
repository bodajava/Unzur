import { describe, expect, it, vi } from 'vitest';
import { wheelConfigError, type WheelConfig } from '../settings/wheel-config.js';
import { WheelService } from './wheel.service.js';

const config = (over: Partial<WheelConfig> = {}): WheelConfig => ({
  enabled: true,
  campaignId: 'nov',
  startsAt: null,
  endsAt: null,
  delaySeconds: 5,
  couponDays: 7,
  minOrder: 0,
  segments: [
    { label: '10% off', labelAr: 'خصم 10%', type: 'PERCENTAGE', value: 10, weight: 1 },
    { label: 'Try again', labelAr: 'حظ أوفر', type: 'NONE', value: 0, weight: 0 },
  ],
  winners: [{ email: 'vip@example.com', segment: 1 }],
  ...over,
});

function setup(c: WheelConfig | null) {
  const store = new Map<string, unknown>();
  const redis = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
    setIfAbsent: vi.fn(async (k: string, v: unknown) => (store.has(k) ? false : (store.set(k, v), true))),
    del: vi.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
  };
  const coupons = { issueSingleUse: vi.fn(async () => ({})) };
  const settings = { getJson: vi.fn(async () => c) };
  const random = { hex: vi.fn(() => 'abc123') };
  const email = { sendCouponEmail: vi.fn(async () => undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new WheelService(settings as any, redis as any, coupons as any, random as any, email as any);
  return { service, coupons, email };
}

describe('WheelService', () => {
  it('hides odds and chosen winners from the storefront', async () => {
    const { service } = setup(config());
    const pub = await service.publicWheel();
    expect(pub.active).toBe(true);
    expect(JSON.stringify(pub)).not.toContain('weight');
    expect(JSON.stringify(pub)).not.toContain('vip@example.com');
  });

  it('is inactive outside its dates', async () => {
    const { service } = setup(config({ endsAt: '2000-01-01T00:00:00Z' }));
    expect(await service.publicWheel()).toEqual({ active: false });
  });

  it('lands by weight and issues a single-use coupon once per email', async () => {
    const { service, coupons, email } = setup(config());
    const first = await service.spin('Someone@Example.com');
    expect(first).toMatchObject({ segment: 0, code: 'SPIN-ABC123', repeat: false });
    expect(coupons.issueSingleUse).toHaveBeenCalledWith(expect.objectContaining({ discountValue: 10 }));
    expect(email.sendCouponEmail).toHaveBeenCalledOnce();
    const again = await service.spin('someone@example.com');
    expect(again).toMatchObject({ segment: 0, code: 'SPIN-ABC123', repeat: true });
    expect(coupons.issueSingleUse).toHaveBeenCalledOnce();
  });

  it('sends a chosen email to its chosen segment', async () => {
    const { service, coupons } = setup(config());
    expect(await service.spin('VIP@example.com')).toMatchObject({ segment: 1, code: null });
    expect(coupons.issueSingleUse).not.toHaveBeenCalled();
  });
});

describe('wheelConfigError', () => {
  it('accepts a valid config and rejects broken ones', () => {
    expect(wheelConfigError(config())).toBeNull();
    expect(wheelConfigError(config({ segments: config().segments.map((s) => ({ ...s, weight: 0 })) }))).toMatch(/weight/);
    expect(wheelConfigError(config({ winners: [{ email: 'x@y.z', segment: 9 }] }))).toMatch(/segment/);
  });
});
