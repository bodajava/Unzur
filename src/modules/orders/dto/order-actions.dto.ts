import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../../common/decorators/index.js';
import { OrderStatus } from '../../../common/enums/index.js';
import { MAX_PRICE } from '../../products/dto/create-product.dto.js';

/** 4.6 PATCH /orders/:id/status */
export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** 4.7 PATCH /orders/:id/refund */
export class RefundOrderDto {
  /** Why: kept on the order for the admin AI analyst. */
  @Trim()
  @IsString()
  @Length(3, 500)
  reason: string;

  /** Online payments: amount to send back (default: all of it). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE)
  amountPiasters?: number;

  /** Put items back in stock (default true). */
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}

/** 14.1 POST /orders/:id/cancel. Guests send contact (email/phone). */
@InputType('CancelOrderInput')
export class CancelOrderDto {
  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 254)
  contact?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
