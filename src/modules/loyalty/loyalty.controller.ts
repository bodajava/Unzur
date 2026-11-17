import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser, RateLimit, ResponseMessage } from '../../common/decorators/index.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ApplyReferralDto, RedeemPointsDto } from './dto/index.js';
import { LoyaltyService } from './loyalty.service.js';
import { ReferralsService } from './referrals.service.js';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  /** 17.1 */
  @Get('points')
  points(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.loyalty.summary(userId, query.page, query.limit);
  }

  /** 17.2 */
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Post('redeem')
  @ResponseMessage('Points converted to a coupon')
  redeem(@CurrentUser('id') userId: string, @Body() dto: RedeemPointsDto) {
    return this.loyalty.redeem(userId, dto.points);
  }
}

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  /** 17.3 */
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.referrals.me(userId);
  }

  /** 17.4 */
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Referral code applied')
  apply(@CurrentUser('id') userId: string, @Body() dto: ApplyReferralDto) {
    return this.referrals.apply(userId, dto.code);
  }
}
