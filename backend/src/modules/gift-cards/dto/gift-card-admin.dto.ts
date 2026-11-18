import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { NormalizeEmail, ToBoolean, Trim } from '../../../common/decorators/index.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { PaymentMethod } from '../../../common/enums/index.js';

export const MIN_GIFT_CARD = 5_000; // 50 EGP
export const MAX_GIFT_CARD = 1_000_000; // 10,000 EGP

/** 18.1 POST /gift-cards (customer purchase, paid online) */
export class PurchaseGiftCardDto {
  @IsInt()
  @Min(MIN_GIFT_CARD, { message: 'The minimum gift card is 50 EGP (5000 piasters)' })
  @Max(MAX_GIFT_CARD)
  amountPiasters: number;

  /** Defaults to the buyer's own email. */
  @IsOptional() @NormalizeEmail() @IsEmail() @MaxLength(254) recipientEmail?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(300) message?: string;
  @IsOptional() @IsIn([PaymentMethod.PAYMOB_CARD, PaymentMethod.PAYMOB_WALLET])
  paymentMethod?: typeof PaymentMethod.PAYMOB_CARD | typeof PaymentMethod.PAYMOB_WALLET;
}

/** 18.3 POST /admin/gift-cards (issued for free, active at once) */
export class IssueGiftCardDto {
  @IsInt() @Min(100) @Max(MAX_GIFT_CARD) amountPiasters: number;
  /** When set, the code is emailed to this address. */
  @IsOptional() @NormalizeEmail() @IsEmail() @MaxLength(254) recipientEmail?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(300) message?: string;
  @IsOptional() @Type(() => Date) @IsDate() expiresAt?: Date;
}

/** 18.3 PATCH /admin/gift-cards/:id */
export class UpdateGiftCardDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() expiresAt?: Date;
}

/** 18.3 GET /admin/gift-cards?isActive=&search= */
export class GiftCardQueryDto extends PaginationQueryDto {
  @IsOptional() @ToBoolean() @IsBoolean() isActive?: boolean;
}
