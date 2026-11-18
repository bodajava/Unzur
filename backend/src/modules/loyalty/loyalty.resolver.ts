import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, RateLimit } from '../../common/decorators/index.js';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../../common/dto/pagination-query.dto.js';
import { ApplyReferralDto, RedeemPointsDto } from './dto/index.js';
import {
  LoyaltyRedemptionModel,
  LoyaltySummaryModel,
  ReferralAppliedModel,
  ReferralSummaryModel,
} from './entities/loyalty.model.js';
import { LoyaltyService } from './loyalty.service.js';
import { ReferralsService } from './referrals.service.js';

const clamp = (n: number | undefined, fallback: number, max: number) => Math.min(Math.max(Math.trunc(n ?? fallback), 1), max);

@Resolver(() => LoyaltySummaryModel)
export class LoyaltyResolver {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly referrals: ReferralsService,
  ) {}

  @Query(() => LoyaltySummaryModel, { description: '17.1' })
  myLoyalty(
    @CurrentUser('id') userId: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.loyalty.summary(userId, clamp(page, 1, 1_000_000), clamp(limit, DEFAULT_LIMIT, MAX_LIMIT));
  }

  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Mutation(() => LoyaltyRedemptionModel, { description: '17.2 Points -> single-use coupon' })
  redeemLoyaltyPoints(@CurrentUser('id') userId: string, @Args('input') input: RedeemPointsDto) {
    return this.loyalty.redeem(userId, input.points);
  }

  @Query(() => ReferralSummaryModel, { description: '17.3' })
  myReferrals(@CurrentUser('id') userId: string) {
    return this.referrals.me(userId);
  }

  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Mutation(() => ReferralAppliedModel, { description: '17.4' })
  applyReferralCode(@CurrentUser('id') userId: string, @Args('input') input: ApplyReferralDto) {
    return this.referrals.apply(userId, input.code);
  }
}
