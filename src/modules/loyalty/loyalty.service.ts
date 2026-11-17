import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscountType, LoyaltyType } from '../../common/enums/index.js';
import { isUniqueViolation } from '../../models/prisma-errors.js';
import { CouponRepository } from '../../models/repositories/coupon.repository.js';
import { LoyaltyTransactionRepository } from '../../models/repositories/loyalty-transaction.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { UserRepository } from '../../models/repositories/user.repository.js';
import { randomCode } from '../coupons/coupon-rules.js';
import { SETTING_DEFAULTS, SettingKey } from '../settings/setting-rules.js';
import { SettingsService } from '../settings/settings.service.js';
import { MIN_REDEEM_POINTS } from './dto/index.js';
import type { LoyaltyRedemptionModel, LoyaltySummaryModel } from './entities/loyalty.model.js';

const REWARD_COUPON_DAYS = 30;
const CODE_ATTEMPTS = 3;

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly users: UserRepository,
    private readonly loyalty: LoyaltyTransactionRepository,
    private readonly coupons: CouponRepository,
    private readonly tx: TransactionManager,
    private readonly settings: SettingsService,
  ) {}

  private pointValue(): Promise<number> {
    return this.settings.getInt(SettingKey.LOYALTY_POINT_VALUE, SETTING_DEFAULTS[SettingKey.LOYALTY_POINT_VALUE]);
  }

  /** 17.1 */
  async summary(userId: string, page: number, limit: number): Promise<LoyaltySummaryModel> {
    const [points, pointValuePiasters, history] = await Promise.all([
      this.users.loyaltyPoints(userId),
      this.pointValue(),
      this.loyalty.paginate({ userId }, { page, limit, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      points,
      valuePiasters: points * pointValuePiasters,
      pointValuePiasters,
      minRedeemPoints: MIN_REDEEM_POINTS,
      history: history.items,
      meta: history.meta,
    };
  }

  /**
   * 17.2 Points -> single-use FIXED_AMOUNT coupon, in one transaction:
   * points debited (only if still there), history row, coupon created.
   */
  async redeem(userId: string, points: number): Promise<LoyaltyRedemptionModel> {
    const value = points * (await this.pointValue());
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REWARD_COUPON_DAYS * 24 * 60 * 60 * 1000);

    for (let attempt = 1; ; attempt++) {
      const code = randomCode('PTS-', [8]);
      try {
        return await this.tx.run(async (tx) => {
          if (!(await this.users.withTx(tx).debitLoyalty(userId, points))) {
            const have = await this.users.withTx(tx).loyaltyPoints(userId);
            throw new BadRequestException(`You have ${have} points`);
          }
          await this.coupons.withTx(tx).create({
            code,
            description: `Loyalty reward (${points} points)`,
            discountType: DiscountType.FIXED_AMOUNT,
            discountValue: value,
            minOrderAmount: 0,
            usageLimit: 1,
            perUserLimit: 1,
            startsAt: now,
            expiresAt,
          });
          await this.loyalty.withTx(tx).create({
            userId,
            points: -points,
            type: LoyaltyType.REDEEMED_DISCOUNT,
            description: `Converted to coupon ${code}`,
          });
          return {
            couponCode: code,
            discountValue: value,
            expiresAt,
            pointsRedeemed: points,
            remainingPoints: await this.users.withTx(tx).loyaltyPoints(userId),
          };
        });
      } catch (error) {
        // Code collision: everything rolled back, try a new code.
        if (isUniqueViolation(error) && attempt < CODE_ATTEMPTS) continue;
        throw error;
      }
    }
  }
}

