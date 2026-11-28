import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { Trim } from '../../../common/decorators/index.js';

export const MAX_LINE_QUANTITY = 100;

/** 3.2 POST /cart/items  ·  GraphQL addToCart(input) */
@InputType('AddToCartInput')
export class AddCartItemDto {
  @Field(() => ID)
  @IsUUID('4')
  productId: string;

  /** Required when the product has active variants. */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  variantId?: string;

  /** Required when the product has a size chart: one of its choice names (e.g. "عربي"). */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 30)
  choice?: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity: number;
}

/** 3.3 PATCH /cart/items/:itemId  ·  GraphQL updateCartItem. 0 removes the line. */
@InputType('UpdateCartItemInput')
export class UpdateCartItemDto {
  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(MAX_LINE_QUANTITY)
  quantity: number;
}
