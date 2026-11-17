import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { PaymentMethod } from '../../../common/enums/index.js';
import { Trim } from '../../../common/decorators/index.js';
import { MAX_PRICE } from '../../products/dto/create-product.dto.js';

export const ONLINE_METHODS = [PaymentMethod.PAYMOB_CARD, PaymentMethod.PAYMOB_WALLET] as const;
export type OnlineMethod = (typeof ONLINE_METHODS)[number];

/** 5.1 POST /payments/paymob/initiate (retry or switch card <-> wallet) */
export class InitiatePaymentDto {
  @IsUUID('4')
  orderId: string;

  @IsOptional()
  @IsIn(ONLINE_METHODS)
  paymentMethod?: OnlineMethod;

  /** Order email or phone, required for guests. */
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 254)
  contact?: string;
}

/** 5.4 GET /payments/order/:orderReference?contact= */
export class OrderContactQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 254)
  contact?: string;
}

/** 5.5 POST /payments/paymob/refund */
export class RefundPaymentDto {
  @IsUUID('4')
  orderId: string;

  /** Defaults to everything not refunded yet. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE)
  amountPiasters?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
