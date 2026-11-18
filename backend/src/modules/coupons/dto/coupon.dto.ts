import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { NormalizeEmail, OptionalNotNull, ToNullableString } from '../../../common/decorators/index.js';
import { Transform } from 'class-transformer';
import { MAX_PRICE } from '../../products/dto/create-product.dto.js';
import { DiscountType } from '../../../graphql/enums.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { COUPON_CODE_PATTERN, normalizeCouponCode } from '../coupon-rules.js';

const NormalizeCode = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeCouponCode(value) : value));
const CODE_MESSAGE = 'code must be 3-32 letters, digits, "-" or "_"';

/** 6.1 POST /coupons/validate  ·  GraphQL validateCoupon(input) */
@InputType('ValidateCouponInput')
export class ValidateCouponDto {
  @Field()
  @NormalizeCode()
  @IsString()
  @Matches(COUPON_CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;

  /** Piasters. When omitted, the caller's cart subtotal is used. */
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  cartSubtotal?: number;

  /** Guest checkout email, so per-customer limits also count past orders by email. */
  @Field({ nullable: true })
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  /** Also save the code on the caller's cart. */
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  applyToCart?: boolean;
}

/** 6.3 POST /coupons  ·  GraphQL createCoupon(input). Money in piasters. */
@InputType('CreateCouponInput')
export class CreateCouponDto {
  @Field()
  @NormalizeCode()
  @IsString()
  @Matches(COUPON_CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Field(() => DiscountType)
  @IsEnum(DiscountType)
  discountType: DiscountType;

  /** 1-100 for PERCENTAGE; piasters for FIXED_AMOUNT. */
  @Field(() => Int)
  @IsInt()
  @Min(1)
  @ValidateIf((o: CreateCouponDto) => o.discountType === DiscountType.PERCENTAGE)
  @Max(100, { message: 'A percentage discount must be between 1 and 100' })
  discountValue: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  minOrderAmount?: number;

  /** Cap for PERCENTAGE coupons. */
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE)
  maxDiscountAmount?: number;

  /** Total uses across all customers; empty = unlimited. */
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  perUserLimit?: number;

  @Field(() => Date)
  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @Field(() => Date)
  @Type(() => Date)
  @IsDate()
  expiresAt: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** 6.3 PATCH /coupons/:id. Nullable fields accept null to clear. */
@InputType('UpdateCouponInput')
export class UpdateCouponDto {
  @Field({ nullable: true })
  @OptionalNotNull()
  @NormalizeCode()
  @IsString()
  @Matches(COUPON_CODE_PATTERN, { message: CODE_MESSAGE })
  code?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ToNullableString()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @Field(() => DiscountType, { nullable: true })
  @OptionalNotNull()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @Field(() => Int, { nullable: true })
  @OptionalNotNull()
  @IsInt()
  @Min(1)
  discountValue?: number;

  @Field(() => Int, { nullable: true })
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  minOrderAmount?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE)
  maxDiscountAmount?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @Field(() => Int, { nullable: true })
  @OptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(1000)
  perUserLimit?: number;

  @Field(() => Date, { nullable: true })
  @OptionalNotNull()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @Field(() => Date, { nullable: true })
  @OptionalNotNull()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @Field({ nullable: true })
  @OptionalNotNull()
  @IsBoolean()
  isActive?: boolean;
}

export const COUPON_TARGETS = ['ALL_CUSTOMERS', 'SUBSCRIBERS', 'SPECIFIC_EMAILS'] as const;
export type CouponTarget = (typeof COUPON_TARGETS)[number];

/** 6.4 POST /coupons/send-to-buyers */
@InputType('SendCouponInput')
export class SendCouponDto {
  @Field(() => ID)
  @IsUUID('4')
  couponId: string;

  /** ALL_CUSTOMERS | SUBSCRIBERS | SPECIFIC_EMAILS */
  @Field(() => String)
  @IsIn(COUPON_TARGETS)
  target: CouponTarget;

  @Field(() => [String], { nullable: true })
  @ValidateIf((o: SendCouponDto) => o.target === 'SPECIFIC_EMAILS')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsEmail({}, { each: true })
  emails?: string[];

  /** Optional note shown above the code. */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

/** 6.2 GET /coupons?page=&limit=&sort=&search=&status= */
@InputType('CouponsFilter')
export class CouponQueryDto extends PaginationQueryDto {
  @Field(() => String, { nullable: true, description: 'ACTIVE | SCHEDULED | EXPIRED | INACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'SCHEDULED', 'EXPIRED', 'INACTIVE'])
  status?: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';
}
