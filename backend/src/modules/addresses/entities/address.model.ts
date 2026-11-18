import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Address')
export class AddressModel {
  @Field(() => ID) id: string;
  @Field() label: string;
  @Field() fullName: string;
  @Field() phone: string;
  @Field() governorate: string;
  @Field() city: string;
  @Field() street: string;
  @Field(() => String, { nullable: true }) building: string | null;
  @Field(() => String, { nullable: true }) floor: string | null;
  @Field(() => String, { nullable: true }) apartment: string | null;
  @Field(() => String, { nullable: true }) notes: string | null;
  @Field() isDefault: boolean;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}
