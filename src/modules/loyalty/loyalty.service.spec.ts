import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { generateGiftCardCode } from '../gift-cards/gift-card-management.service.js';
import { RedeemPointsDto } from './dto/index.js';
import { ReferralsService } from './referrals.service.js';

function referrals(user: Record<string, unknown>, orders = 0, referrer: unknown = { id: 'r1', isActive: true }) {
  const users = {
    findById: vi.fn().mockResolvedValue({ id: 'u1', referralCode: 'MINE1', referredById: null, ...user }),
    findByReferralCode: vi.fn().mockResolvedValue(referrer),
  };
  const svc = new ReferralsService(
    users as never,
    {} as never,
    { countForUser: vi.fn().mockResolvedValue(orders) } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return svc;
}

describe('ReferralsService.apply', () => {
  it('rejects own code, a second code, accounts with orders and unknown codes', async () => {
    await expect(referrals({}).apply('u1', 'MINE1')).rejects.toThrow('You cannot use your own referral code');
    await expect(referrals({ referredById: 'x' }).apply('u1', 'OTHER')).rejects.toThrow('already used');
    await expect(referrals({}, 2).apply('u1', 'OTHER')).rejects.toThrow('before your first order');
    await expect(referrals({}, 0, null).apply('u1', 'OTHER')).rejects.toThrow(BadRequestException);
  });
});

describe('loyalty + gift card codes', () => {
  it('needs at least 100 points to redeem', async () => {
    expect(await validate(plainToInstance(RedeemPointsDto, { points: 99 }))).toHaveLength(1);
    expect(await validate(plainToInstance(RedeemPointsDto, { points: 100 }))).toHaveLength(0);
  });

  it('makes GC-XXXX-XXXX-XXXX codes', () => {
    const codes = new Set(Array.from({ length: 200 }, generateGiftCardCode));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^GC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
});
