import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DiscountType } from '../../common/enums/index.js';
import { CouponEvaluator } from './coupon-evaluator.service.js';
import { calculateDiscount, couponShapeError, couponStatus } from './coupon-rules.js';
import { CreateCouponDto } from './dto/index.js';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-17T12:00:00Z');

function coupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    code: 'SAVE10',
    description: null,
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: null,
    usageLimit: null,
    perUserLimit: 1,
    usedCount: 0,
    startsAt: new Date(now.getTime() - DAY),
    expiresAt: new Date(now.getTime() + DAY),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as never;
}

function evaluator(row: unknown, usedByCustomer = 0) {
  const coupons = { findByCode: vi.fn().mockResolvedValue(row) };
  const usages = { countForRedeemer: vi.fn().mockResolvedValue(usedByCustomer) };
  return { svc: new CouponEvaluator(coupons as never, usages as never), coupons, usages };
}

describe('coupon discount math (piasters)', () => {
  it('floors percentages and applies the cap', () => {
    expect(calculateDiscount(coupon({ discountValue: 15 }), 999)).toBe(149);
    expect(calculateDiscount(coupon({ discountValue: 10, maxDiscountAmount: 500 }), 10_000)).toBe(500);
  });

  it('never discounts more than the subtotal', () => {
    expect(calculateDiscount(coupon({ discountType: DiscountType.FIXED_AMOUNT, discountValue: 2000 }), 1500)).toBe(1500);
    expect(calculateDiscount(coupon({ discountValue: 100 }), 0)).toBe(0);
  });

  it('derives status and validates shape', () => {
    expect(couponStatus(coupon({ expiresAt: new Date(now.getTime() - 1) }), now)).toBe('EXPIRED');
    expect(couponStatus(coupon({ usageLimit: 3, usedCount: 3 }), now)).toBe('EXHAUSTED');
    expect(
      couponShapeError({ discountType: DiscountType.PERCENTAGE, discountValue: 101, startsAt: now, expiresAt: new Date(now.getTime() + DAY) }),
    ).toMatch(/between 1 and 100/);
    expect(couponShapeError({ discountType: DiscountType.FIXED_AMOUNT, discountValue: 5000, startsAt: now, expiresAt: now })).toMatch(/after/);
  });
});

describe('CouponEvaluator', () => {
  it('normalizes the code and returns the discount', async () => {
    const { svc, coupons } = evaluator(coupon());
    await expect(svc.evaluate(' save10 ', 5000, {}, now)).resolves.toMatchObject({ ok: true, discountAmount: 500 });
    expect(coupons.findByCode).toHaveBeenCalledWith('SAVE10');
  });

  it('rejects unknown/inactive, expired, minimum and per-customer limits', async () => {
    expect(await evaluator(null).svc.evaluate('X', 1, {}, now)).toMatchObject({ ok: false, reason: 'Invalid coupon code' });
    expect(await evaluator(coupon({ isActive: false })).svc.evaluate('X', 1, {}, now)).toMatchObject({ reason: 'Invalid coupon code' });
    expect(await evaluator(coupon({ expiresAt: new Date(now.getTime() - 1) })).svc.evaluate('X', 1, {}, now)).toMatchObject({ reason: 'This coupon has expired' });
    expect(await evaluator(coupon({ minOrderAmount: 1000 })).svc.evaluate('X', 999, {}, now)).toMatchObject({ ok: false });
    const limited = evaluator(coupon(), 1);
    expect(await limited.svc.evaluate('X', 5000, { userId: 'u1', email: 'a@b.com' }, now)).toMatchObject({ reason: 'You have already used this coupon' });
    expect(limited.usages.countForRedeemer).toHaveBeenCalledWith('c1', { userId: 'u1', email: 'a@b.com' });
  });
});

describe('CreateCouponDto', () => {
  const base = {
    code: ' welcome-10 ',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startsAt: '2026-11-01T00:00:00Z',
    expiresAt: '2026-12-01T00:00:00Z',
  };

  it('uppercases the code and parses dates', async () => {
    const dto = plainToInstance(CreateCouponDto, base);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.code).toBe('WELCOME-10');
    expect(dto.startsAt).toBeInstanceOf(Date);
  });

  it('rejects a percentage above 100 but allows large fixed amounts', async () => {
    const pct = await validate(plainToInstance(CreateCouponDto, { ...base, discountValue: 101 }));
    expect(pct.map((e) => e.property)).toEqual(['discountValue']);
    const fixed = await validate(plainToInstance(CreateCouponDto, { ...base, discountType: 'FIXED_AMOUNT', discountValue: 50_000 }));
    expect(fixed).toHaveLength(0);
  });
});
