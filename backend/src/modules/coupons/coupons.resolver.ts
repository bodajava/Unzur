import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Audit, CurrentActor, CurrentUser, Public, RateLimit, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { COUPON_VALIDATE_LIMIT } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';
import { CouponQueryDto, CreateCouponDto, SendCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/index.js';
import {
  CouponCampaignModel,
  CouponModel,
  CouponPageModel,
  CouponRemovalModel,
  CouponValidationModel,
} from './entities/coupon.model.js';

const WRITERS = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;

@Resolver(() => CouponModel)
export class CouponsResolver {
  constructor(private readonly service: CouponsService) {}

  @Public()
  @RateLimit(COUPON_VALIDATE_LIMIT)
  @Mutation(() => CouponValidationModel, { description: '6.1 Validate (and optionally apply) a coupon' })
  validateCoupon(
    @Args('input') input: ValidateCouponDto,
    @CurrentActor() actor: Actor,
    @CurrentUser('email') email?: string,
  ) {
    return this.service.validate(input, actor, email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Query(() => CouponPageModel, { description: '6.2 Admin: coupons with usage stats' })
  coupons(@Args('filter', { nullable: true }) filter?: CouponQueryDto) {
    return this.service.list(filter ?? new CouponQueryDto());
  }

  @Roles(...WRITERS)
  @Mutation(() => CouponModel, { description: '6.3' })
  createCoupon(@Args('input') input: CreateCouponDto, @Audit() audit: AuditContext) {
    return this.service.create(input, audit);
  }

  @Roles(...WRITERS)
  @Mutation(() => CouponModel, { description: '6.3' })
  updateCoupon(
    @Args('id', { type: () => ID }, ParseIdPipe) id: string,
    @Args('input') input: UpdateCouponDto,
    @Audit() audit: AuditContext,
  ) {
    return this.service.update(id, input, audit);
  }

  @Roles(...WRITERS)
  @Mutation(() => CouponRemovalModel, { description: '6.3' })
  deleteCoupon(@Args('id', { type: () => ID }, ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.service.remove(id, audit);
  }

  @Roles(...WRITERS)
  @Mutation(() => CouponCampaignModel, { description: '6.4 Email the coupon in the background' })
  sendCouponToBuyers(@Args('input') input: SendCouponDto, @Audit() audit: AuditContext) {
    return this.service.sendToBuyers(input, audit);
  }
}
