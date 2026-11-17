import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { Type } from '@nestjs/common';

@ObjectType('PaginationMeta')
export class PaginationMetaModel {
  @Field(() => Int) total: number;
  @Field(() => Int) page: number;
  @Field(() => Int) limit: number;
  @Field(() => Int) totalPages: number;
  @Field() hasNextPage: boolean;
  @Field() hasPrevPage: boolean;
}

/**
 * Base for paginated results:
 *   @ObjectType('ProductPage') class ProductPageModel extends Paginated(ProductCardModel) {}
 */
export function Paginated<T>(item: Type<T>) {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedType {
    @Field(() => [item]) items: T[];
    @Field(() => PaginationMetaModel) meta: PaginationMetaModel;
  }
  return PaginatedType;
}
