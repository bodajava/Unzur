import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OptionalNotNull, ToInt, ToNullableString, Trim } from '../../../common/decorators/index.js';
import { MAX_PRICE } from '../../products/dto/create-product.dto.js';

/** "2-3", "1", "3-5 days" */
const DAYS_PATTERN = /^[0-9]{1,2}(-[0-9]{1,2})?( [a-zA-Z؀-ۿ ]{1,20})?$/;
const DAYS_MESSAGE = 'estimatedDays must look like "2" or "2-3"';

/** 15.1 GET /shipping/rates?governorate=&cartSubtotal= */
export class ShippingRateQueryDto {
  @Trim()
  @IsString()
  @Length(2, 60)
  governorate: string;

  /** Piasters; when given, free shipping is decided against the threshold. */
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  cartSubtotal?: number;
}

/** 15.2 POST /admin/shipping-zones. fee in piasters. */
@InputType('CreateShippingZoneInput')
export class CreateShippingZoneDto {
  /** English key, e.g. "Cairo" (unique, case-insensitive) */
  @Field()
  @Trim()
  @IsString()
  @Length(2, 60)
  governorate: string;

  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  nameAr?: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  fee: number;

  @Field()
  @Trim()
  @IsString()
  @Matches(DAYS_PATTERN, { message: DAYS_MESSAGE })
  estimatedDays: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** 15.2 PATCH /admin/shipping-zones/:id */
@InputType('UpdateShippingZoneInput')
export class UpdateShippingZoneDto {
  @Field({ nullable: true })
  @OptionalNotNull()
  @Trim()
  @IsString()
  @Length(2, 60)
  governorate?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ToNullableString()
  @IsString()
  @MaxLength(60)
  nameAr?: string | null;

  @Field(() => Int, { nullable: true })
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  fee?: number;

  @Field({ nullable: true })
  @OptionalNotNull()
  @Trim()
  @IsString()
  @Matches(DAYS_PATTERN, { message: DAYS_MESSAGE })
  estimatedDays?: string;

  @Field({ nullable: true })
  @OptionalNotNull()
  @IsBoolean()
  isActive?: boolean;
}
