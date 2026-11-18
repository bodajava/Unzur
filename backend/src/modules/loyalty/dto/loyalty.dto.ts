import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export const MIN_REDEEM_POINTS = 100;

/** 17.2 POST /loyalty/redeem */
@InputType('RedeemPointsInput')
export class RedeemPointsDto {
  @Field(() => Int)
  @IsInt()
  @Min(MIN_REDEEM_POINTS, { message: `You can redeem at least ${MIN_REDEEM_POINTS} points` })
  @Max(1_000_000)
  points: number;
}

/** 17.4 POST /referrals/apply */
@InputType('ApplyReferralInput')
export class ApplyReferralDto {
  @Field()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9]{4,32}$/, { message: 'Invalid referral code' })
  code: string;
}
