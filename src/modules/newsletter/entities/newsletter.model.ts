import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('NewsletterSubscription')
export class NewsletterSubscriptionModel {
  @Field() email: string;
  @Field() subscribed: boolean;
  /** CREATED | REACTIVATED | ALREADY_SUBSCRIBED */
  @Field() result: string;
}
