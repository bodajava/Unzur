import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('ImageRef')
export class ImageRefModel {
  @Field(() => ID) id: string;
  @Field() url: string;
  @Field(() => String, { nullable: true }) altText: string | null;
}
