import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsPhone, NormalizeEmail, Trim } from '../../../common/decorators/index.js';
import { PaymentMethod } from '../../../graphql/enums.js';

export const CHECKOUT_METHODS = [PaymentMethod.COD, PaymentMethod.PAYMOB_CARD, PaymentMethod.PAYMOB_WALLET] as const;

/** 4.1 POST /orders/checkout  ·  1.10 POST /auth/guest/checkout  ·  GraphQL checkout(input) */
@InputType('CheckoutInput')
export class CheckoutDto {
  @Field()
  @Trim()
  @IsString()
  @Length(2, 100)
  customerName: string;

  @Field()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  customerEmail: string;

  @Field()
  @Trim()
  @IsPhone()
  customerPhone: string;

  @Field()
  @Trim()
  @IsString()
  @Length(2, 60)
  governorate: string;

  @Field()
  @Trim()
  @IsString()
  @Length(2, 80)
  city: string;

  @Field()
  @Trim()
  @IsString()
  @Length(2, 200)
  street: string;

  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  building?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  floor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  apartment?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** COD | PAYMOB_CARD | PAYMOB_WALLET */
  @Field(() => PaymentMethod)
  @IsIn(CHECKOUT_METHODS)
  paymentMethod: PaymentMethod;

  /** Overrides the coupon saved on the cart. */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  couponCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  giftCardCode?: string;

  /** Logged-in customers only. */
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  redeemLoyaltyPoints?: number;
}
