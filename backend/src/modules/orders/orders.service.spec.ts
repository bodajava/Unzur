import { OrderStatus, UserRole } from '../../common/enums/index.js';
import { contactMatches, normalizePhone } from '../../common/utilities/phone.js';
import { visualWords } from './invoice/bidi-text.js';
import { canAccessOrder } from './order-access.js';
import { canTransition, computeTotals, generateOrderNumber, pointsEarned } from './order-rules.js';

describe('computeTotals (piasters)', () => {
  it('applies coupon, then points on goods, then shipping, then the gift card', () => {
    expect(
      computeTotals({ subtotal: 50_000, couponDiscount: 5_000, shippingFee: 6_000, pointsRequested: 100, pointValue: 10, giftCardBalance: 2_000 }),
    ).toEqual({
      subtotal: 50_000,
      discountAmount: 5_000,
      loyaltyPointsUsed: 100,
      loyaltyDiscount: 1_000,
      shippingCost: 6_000,
      giftCardAmount: 2_000,
      totalAmount: 48_000,
    });
  });

  it('caps points at the goods value and lets a gift card cover shipping, never below 0', () => {
    const t = computeTotals({ subtotal: 1_000, couponDiscount: 0, shippingFee: 500, pointsRequested: 1_000, pointValue: 10, giftCardBalance: 99_999 });
    expect(t).toMatchObject({ loyaltyPointsUsed: 100, loyaltyDiscount: 1_000, giftCardAmount: 500, totalAmount: 0 });
    expect(computeTotals({ subtotal: 100, couponDiscount: 500, shippingFee: 0, pointsRequested: 0, pointValue: 10, giftCardBalance: 0 }).totalAmount).toBe(0);
  });
});

describe('order rules', () => {
  it('follows the status machine', () => {
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(false);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.SHIPPED)).toBe(false);
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toBe(false);
  });

  it('earns 1 point per 10 EGP of goods and makes readable order numbers', () => {
    expect(pointsEarned({ totalAmount: 25_999, shippingCost: 6_000 }, 1_000)).toBe(19);
    expect(generateOrderNumber(new Date('2026-11-17T00:00:00Z'))).toMatch(/^ORD-20261117-[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe('order access by contact', () => {
  const order = { userId: 'u1', customerEmail: 'Buyer@Test.com', customerPhone: '01001234567' };

  it('normalizes Egyptian phone formats', () => {
    expect(normalizePhone('+20 100 123 4567')).toBe('01001234567');
    expect(normalizePhone('00201001234567')).toBe('01001234567');
    expect(contactMatches('buyer@test.com', order)).toBe(true);
    expect(contactMatches('+201001234567', order)).toBe(true);
    expect(contactMatches('01001234568', order)).toBe(false);
  });

  it('allows owner, staff and matching contact only', () => {
    expect(canAccessOrder(order, { id: 'u1', email: 'x', role: UserRole.CUSTOMER }, undefined)).toBe(true);
    expect(canAccessOrder(order, { id: 'u2', email: 'x', role: UserRole.CUSTOMER }, undefined)).toBe(false);
    expect(canAccessOrder(order, { id: 's', email: 'x', role: UserRole.STAFF }, undefined)).toBe(true);
    expect(canAccessOrder(order, undefined, 'BUYER@test.com')).toBe(true);
    expect(canAccessOrder(order, undefined, '')).toBe(false);
  });
});

describe('invoice bidi word order', () => {
  it('keeps English lines as-is and reverses Arabic word order', () => {
    expect(visualWords('Ethiopian Yirgacheffe - 1kg')).toEqual(['Ethiopian', 'Yirgacheffe', '-', '1kg']);
    expect(visualWords('قهوة عربية - 250 جرام')).toEqual(['جرام', '250', '-', 'عربية', 'قهوة']);
    expect(visualWords('Total / الإجمالي')).toEqual(['Total', '/', 'الإجمالي']);
    expect(visualWords('شارع النيل 12, Bldg 5')).toEqual(['Bldg', '5', '12,', 'النيل', 'شارع']);
  });
});
