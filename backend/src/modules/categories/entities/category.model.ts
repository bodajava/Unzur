import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Category')
export class CategoryModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() slug: string;
  @Field(() => String, { nullable: true }) description: string | null;
  @Field(() => String, { nullable: true }) descriptionAr: string | null;
  @Field(() => String, { nullable: true }) imageUrl: string | null;
  @Field(() => ID, { nullable: true }) parentId: string | null;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

@ObjectType('CategoryNode')
export class CategoryNodeModel extends CategoryModel {
  @Field(() => [CategoryNodeModel]) children: CategoryNodeModel[];
}

@ObjectType('CategoryRef')
export class CategoryRefModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() slug: string;
}

@ObjectType('CategoryDetail')
export class CategoryDetailModel extends CategoryModel {
  @Field(() => CategoryRefModel, { nullable: true }) parent: CategoryRefModel | null;
  @Field(() => [CategoryModel]) children: CategoryModel[];
}
