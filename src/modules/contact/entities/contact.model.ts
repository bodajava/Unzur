import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('ContactMessageReceipt')
export class ContactMessageReceiptModel {
  @Field(() => ID) id: string;
  @Field() received: boolean;
}
