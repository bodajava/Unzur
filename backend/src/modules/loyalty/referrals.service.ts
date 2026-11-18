import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LoyaltyType } from '../../common/enums/index.js';
import type { DbClient } from '../../models/prisma.service.js';
import { isUniqueViolation } from '../../models/prisma-errors.js';
import { LoyaltyTransactionRepository } from '../../models/repositories/loyalty-transaction.repository.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { ReferralRepository } from '../../models/repositories/referral.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { UserRepository } from '../../models/repositories/user.repository.js';
import { SETTING_DEFAULTS, SettingKey } from '../settings/setting-rules.js';
import { SettingsService } from '../settings/settings.service.js';
import type { ReferralAppliedModel, ReferralSummaryModel } from './entities/loyalty.model.js';

const maskName = (u: { firstName: string; lastName: string }) =>
  `${u.firstName}${u.lastName ? ` ${u.lastName.trim().charAt(0)}.` : ''}`;

@Injectable()
export class ReferralsService {
  constructor(
    private readonly users: UserRepository,
    private readonly referrals: ReferralRepository,
    private readonly orders: OrderRepository,
    private readonly loyalty: LoyaltyTransactionRepository,
    private readonly tx: TransactionManager,
    private readonly settings: SettingsService,
  ) {}

  private bonus(): Promise<number> {
    return this.settings.getInt(SettingKey.REFERRAL_BONUS_POINTS, SETTING_DEFAULTS[SettingKey.REFERRAL_BONUS_POINTS]);
  }

  /** 17.3 Referred people are shown as "First L." only. */
  async me(userId: string): Promise<ReferralSummaryModel> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const [rows, bonusPoints, orderCount] = await Promise.all([
      this.referrals.findForReferrer(userId),
      this.bonus(),
      this.orders.countForUser(userId),
    ]);
    return {
      referralCode: user.referralCode,
      totalReferrals: rows.length,
      rewardedReferrals: rows.filter((r) => r.rewardGranted).length,
      bonusPoints,
      canApplyCode: user.referredById === null && orderCount === 0,
      referrals: rows.map((r) => ({
        id: r.id,
        name: maskName(r.referredUser),
        rewarded: r.rewardGranted,
        joinedAt: r.createdAt,
      })),
    };
  }

  /** 17.4 Once per account, before the first order, never your own code. */
  async apply(userId: string, code: string): Promise<ReferralAppliedModel> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.referralCode === code) throw new BadRequestException('You cannot use your own referral code');
    if (user.referredById) throw new BadRequestException('You already used a referral code');
    if ((await this.orders.countForUser(userId)) > 0) {
      throw new BadRequestException('Referral codes can only be used before your first order');
    }
    const referrer = await this.users.findByReferralCode(code);
    if (!referrer?.isActive) throw new BadRequestException('Invalid referral code');

    const bonusPoints = await this.bonus();
    try {
      await this.tx.run(async (tx) => {
        if (!(await this.users.withTx(tx).setReferrerIfNone(userId, referrer.id))) {
          throw new ConflictException('You already used a referral code');
        }
        const referral = await this.referrals.withTx(tx).create({
          referrerId: referrer.id,
          referredUserId: userId,
          codeUsed: code,
        });
        await this.grant(tx, referral.id, referrer.id, userId, bonusPoints);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('You already used a referral code');
      throw error;
    }
    return { applied: true, bonusPoints, yourPoints: await this.users.loyaltyPoints(userId) };
  }

  /**
   * Codes given at registration (1.1) are rewarded once the new user
   * verifies their email (called from the USER_EMAIL_VERIFIED listener).
   */
  async rewardOnVerification(userId: string): Promise<boolean> {
    const referral = await this.referrals.findByReferred(userId);
    if (!referral || referral.rewardGranted) return false;
    const bonusPoints = await this.bonus();
    return this.tx.run((tx) => this.grant(tx, referral.id, referral.referrerId, userId, bonusPoints));
  }

  /** Both sides get the bonus; the referral is marked rewarded exactly once. */
  private async grant(tx: DbClient, referralId: string, referrerId: string, referredId: string, points: number) {
    if (points <= 0) return false;
    if (!(await this.referrals.withTx(tx).markRewarded(referralId))) return false;
    for (const [id, description] of [
      [referrerId, 'Referral bonus: a friend joined with your code'],
      [referredId, 'Welcome bonus: joined with a referral code'],
    ] as const) {
      await this.users.withTx(tx).adjustLoyalty(id, points);
      await this.loyalty.withTx(tx).create({ userId: id, points, type: LoyaltyType.REFERRAL_BONUS, description });
    }
    return true;
  }
}
