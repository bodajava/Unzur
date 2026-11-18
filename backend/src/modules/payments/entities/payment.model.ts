import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/** Public view of a payment attempt (no raw gateway payload). */
@ObjectType('Payment')
export class PaymentModel {
  @Field(() => ID) id: string;
  @Field() provider: string;
  @Field() status: string;
  @Field(() => Int) amountPiasters: number;
  @Field(() => Int) refundedPiasters: number;
  @Field() currency: string;
  @Field(() => String, { nullable: true }) paymobTransactionId: string | null;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

@ObjectType('PaymentSession')
export class PaymentSessionModel {
  @Field(() => ID) paymentId: string;
  @Field() intentionId: string;
  /** Send the browser here (Paymob Unified Checkout). */
  @Field() checkoutUrl: string;
}
