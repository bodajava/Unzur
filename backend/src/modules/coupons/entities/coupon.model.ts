import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { DiscountType } from '../../../graphql/enums.js';
import { Paginated } from '../../../graphql/models/pagination.model.js';
import type { CouponStatus } from '../coupon-rules.js';

@ObjectType('CouponValidation')
export class CouponValidationModel {
  @Field() valid: boolean;
  @Field() code: string;
  @Field(() => DiscountType) discountType: DiscountType;
  @Field(() => Int) discountValue: number;
  @Field(() => Int, { nullable: true }) maxDiscountAmount: number | null;
  @Field(() => Int) subtotal: number;
  @Field(() => Int) discountAmount: number;
  @Field(() => Int) totalAfterDiscount: number;
  @Field() appliedToCart: boolean;
}

@ObjectType('CouponUsageStats')
export class CouponUsageStatsModel {
  @Field(() => Int) usedCount: number;
  @Field(() => Int) orders: number;
  /** null = unlimited */
  @Field(() => Int, { nullable: true }) remaining: number | null;
}

@ObjectType('Coupon')
export class CouponModel {
  @Field(() => ID) id: string;
  @Field() code: string;
  @Field(() => String, { nullable: true }) description: string | null;
  @Field(() => DiscountType) discountType: DiscountType;
  @Field(() => Int) discountValue: number;
  @Field(() => Int) minOrderAmount: number;
  @Field(() => Int, { nullable: true }) maxDiscountAmount: number | null;
  @Field(() => Int, { nullable: true }) usageLimit: number | null;
  @Field(() => Int) perUserLimit: number;
  @Field(() => Int) usedCount: number;
  @Field() startsAt: Date;
  @Field() expiresAt: Date;
  @Field() isActive: boolean;
  /** ACTIVE | SCHEDULED | EXPIRED | INACTIVE | EXHAUSTED */
  @Field(() => String) status: CouponStatus;
  @Field(() => CouponUsageStatsModel) stats: CouponUsageStatsModel;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

@ObjectType('CouponPage')
export class CouponPageModel extends Paginated(CouponModel) {}

@ObjectType('CouponCampaign')
export class CouponCampaignModel {
  @Field() code: string;
  @Field(() => String) target: string;
  @Field(() => Int) recipients: number;
  @Field() queued: boolean;
}

@ObjectType('CouponRemoval')
export class CouponRemovalModel {
  @Field(() => ID) id: string;
  @Field() deleted: boolean;
  @Field() deactivated: boolean;
  @Field(() => String, { nullable: true }) reason: string | null;
}
