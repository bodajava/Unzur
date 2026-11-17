import { Field, ID, ObjectType } from '@nestjs/graphql';

/** Generic result for delete-style mutations. */
@ObjectType('DeleteResult')
export class DeleteResultModel {
  @Field(() => ID) id: string;
  @Field() deleted: boolean;
  @Field({ nullable: true }) deactivated?: boolean;
  @Field({ nullable: true }) reason?: string;
}
