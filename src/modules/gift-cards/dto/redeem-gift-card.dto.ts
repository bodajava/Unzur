import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { normalizeGiftCardCode } from '../gift-card-rules.js';

/** 18.2 POST /gift-cards/redeem */
@InputType('RedeemGiftCardInput')
export class RedeemGiftCardDto {
  @Field()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeGiftCardCode(value) : value))
  @IsString()
  @Matches(/^[A-Z0-9-]{4,40}$/, { message: 'Invalid gift card code' })
  code: string;
}
