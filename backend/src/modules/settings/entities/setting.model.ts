import { Field, ID, ObjectType } from '@nestjs/graphql';
import { JSONScalar } from '../../../graphql/scalars/json.scalar.js';

@ObjectType('StoreSetting')
export class StoreSettingModel {
  @Field(() => ID) id: string;
  @Field() key: string;
  @Field(() => JSONScalar, { nullable: true }) value: unknown;
  @Field() isPublic: boolean;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}
