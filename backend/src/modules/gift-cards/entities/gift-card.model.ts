import { Field, Int, ObjectType } from '@nestjs/graphql';

/** Checkout preview. currentBalance in piasters. */
@ObjectType('GiftCardPreview')
export class GiftCardPreviewModel {
  @Field() code: string;
  @Field() isValid: boolean;
  @Field(() => Int) currentBalance: number;
  @Field(() => Date, { nullable: true }) expiresAt: Date | null;
  @Field(() => String, { nullable: true }) message: string | null;
}
