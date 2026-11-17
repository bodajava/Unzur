import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ShippingRate')
export class ShippingRateModel {
  @Field(() => ID) zoneId: string;
  @Field() governorate: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  /** What the customer pays (0 when free) */
  @Field(() => Int) fee: number;
  @Field(() => Int) originalFee: number;
  @Field() isFreeShipping: boolean;
  /** null when free shipping is not configured */
  @Field(() => Int, { nullable: true }) freeShippingThreshold: number | null;
  /** How much more to add for free shipping (null when unknown or not configured) */
  @Field(() => Int, { nullable: true }) amountToFreeShipping: number | null;
  @Field() estimatedDays: string;
}

@ObjectType('ShippingZone')
export class ShippingZoneModel {
  @Field(() => ID) id: string;
  @Field() governorate: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field(() => Int) fee: number;
  @Field() estimatedDays: string;
  @Field() isActive: boolean;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}
