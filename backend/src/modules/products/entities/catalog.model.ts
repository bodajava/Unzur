import { Field, ID, Int, ObjectType, Float } from '@nestjs/graphql';
import { ImageRefModel } from '../../../graphql/models/image.model.js';
import { Paginated } from '../../../graphql/models/pagination.model.js';
import { JSONScalar } from '../../../graphql/scalars/json.scalar.js';
import { BrandRefModel } from '../../brands/entities/brand.model.js';
import { CategoryRefModel } from '../../categories/entities/category.model.js';

/** PUBLIC catalog types: no costPrice, no deletedAt. Money in piasters. */

@ObjectType('CardVariant')
export class CardVariantModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field(() => Int) price: number;
  @Field(() => Int, { nullable: true }) salePrice: number | null;
  @Field(() => Int) stock: number;
  /** Free attributes; `color` ("#rrggbb") is the version's swatch. */
  @Field(() => JSONScalar, { nullable: true }) attributes: unknown;
}

@ObjectType('ProductCard')
export class ProductCardModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() slug: string;
  @Field(() => String, { nullable: true }) shortDescription: string | null;
  @Field(() => String, { nullable: true }) shortDescriptionAr: string | null;
  @Field(() => Int) basePrice: number;
  @Field(() => Int, { nullable: true }) salePrice: number | null;
  @Field(() => Int) stock: number;
  @Field() isFeatured: boolean;
  @Field() createdAt: Date;
  @Field(() => CategoryRefModel) category: CategoryRefModel;
  @Field(() => BrandRefModel, { nullable: true }) brand: BrandRefModel | null;
  @Field(() => ImageRefModel, { nullable: true }) primaryImage: ImageRefModel | null;
  @Field(() => [CardVariantModel]) variants: CardVariantModel[];
}

@ObjectType('ProductPage')
export class ProductPageModel extends Paginated(ProductCardModel) {}

@ObjectType('ProductImage')
export class ProductImageModel extends ImageRefModel {
  @Field(() => Int) sortOrder: number;
  @Field() isPrimary: boolean;
}

@ObjectType('ProductVariant')
export class ProductVariantModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() sku: string;
  @Field(() => Int) price: number;
  @Field(() => Int, { nullable: true }) salePrice: number | null;
  @Field(() => Int) stock: number;
  @Field(() => JSONScalar, { nullable: true }) attributes: unknown;
}

@ObjectType('ProductDetail')
export class ProductDetailModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() slug: string;
  @Field(() => String, { nullable: true }) sku: string | null;
  @Field() description: string;
  @Field(() => String, { nullable: true }) descriptionAr: string | null;
  @Field(() => String, { nullable: true }) shortDescription: string | null;
  @Field(() => String, { nullable: true }) shortDescriptionAr: string | null;
  @Field(() => Int) basePrice: number;
  @Field(() => Int, { nullable: true }) salePrice: number | null;
  @Field(() => Int) stock: number;
  @Field() isFeatured: boolean;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
  @Field(() => CategoryRefModel) category: CategoryRefModel;
  @Field(() => BrandRefModel, { nullable: true }) brand: BrandRefModel | null;
  @Field(() => [ProductImageModel]) images: ProductImageModel[];
  @Field(() => [ProductVariantModel]) variants: ProductVariantModel[];
  @Field(() => Float, { nullable: true }) averageRating: number | null;
  @Field(() => Int) reviewCount: number;
  @Field(() => [ProductCardModel]) relatedProducts: ProductCardModel[];
}

@ObjectType('ProductSuggestion')
export class ProductSuggestionModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() slug: string;
  @Field(() => Int) basePrice: number;
  @Field(() => Int, { nullable: true }) salePrice: number | null;
  @Field(() => ImageRefModel, { nullable: true }) primaryImage: ImageRefModel | null;
}
