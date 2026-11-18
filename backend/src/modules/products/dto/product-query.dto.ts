import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ToBoolean, ToInt, Trim } from '../../../common/decorators/index.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { MAX_PRICE } from './create-product.dto.js';

/** GET /products?page=1&limit=20&sort=-createdAt&search=&category=&brand=&minPrice=&maxPrice=&isFeatured=&inStock= */
@InputType('ProductsFilter')
export class ProductQueryDto extends PaginationQueryDto {
  /** Category id or slug (includes its sub-categories). */
  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  category?: string;

  /** Brand id or slug. */
  @Field({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  brand?: string;

  /** Piasters, compared with the price the customer pays (salePrice ?? basePrice). */
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  minPrice?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  maxPrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isFeatured?: boolean;

  /** true: product or one of its active variants has stock. false: nothing in stock. */
  @Field({ nullable: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  inStock?: boolean;
}

/** GET /products/admin/all: same filters plus hidden and deleted products. */
export class AdminProductQueryDto extends ProductQueryDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
