import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PaginationMetaModel } from '../../../graphql/models/pagination.model.js';

@ObjectType('LoyaltyEntry')
export class LoyaltyEntryModel {
  @Field(() => ID) id: string;
  /** positive = earned, negative = spent */
  @Field(() => Int) points: number;
  @Field() type: string;
  @Field(() => String, { nullable: true }) description: string | null;
  @Field(() => ID, { nullable: true }) orderId: string | null;
  @Field() createdAt: Date;
}

@ObjectType('LoyaltySummary')
export class LoyaltySummaryModel {
  @Field(() => Int) points: number;
  /** What the points are worth now, in piasters */
  @Field(() => Int) valuePiasters: number;
  @Field(() => Int) pointValuePiasters: number;
  @Field(() => Int) minRedeemPoints: number;
  @Field(() => [LoyaltyEntryModel]) history: LoyaltyEntryModel[];
  @Field(() => PaginationMetaModel) meta: PaginationMetaModel;
}

@ObjectType('LoyaltyRedemption')
export class LoyaltyRedemptionModel {
  /** Single-use FIXED_AMOUNT coupon */
  @Field() couponCode: string;
  @Field(() => Int) discountValue: number;
  @Field() expiresAt: Date;
  @Field(() => Int) pointsRedeemed: number;
  @Field(() => Int) remainingPoints: number;
}

@ObjectType('ReferralEntry')
export class ReferralEntryModel {
  @Field(() => ID) id: string;
  /** "Mona A." (never the email) */
  @Field() name: string;
  @Field() rewarded: boolean;
  @Field() joinedAt: Date;
}

@ObjectType('ReferralSummary')
export class ReferralSummaryModel {
  @Field() referralCode: string;
  @Field(() => Int) totalReferrals: number;
  @Field(() => Int) rewardedReferrals: number;
  @Field(() => Int) bonusPoints: number;
  @Field() canApplyCode: boolean;
  @Field(() => [ReferralEntryModel]) referrals: ReferralEntryModel[];
}

@ObjectType('ReferralApplied')
export class ReferralAppliedModel {
  @Field() applied: boolean;
  @Field(() => Int) bonusPoints: number;
  @Field(() => Int) yourPoints: number;
}
