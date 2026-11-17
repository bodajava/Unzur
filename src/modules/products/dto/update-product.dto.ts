import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsLessThanField,
  OptionalNotNull,
  ToBoolean,
  ToInt,
  ToNullableString,
  ToStringArray,
  Trim,
} from '../../../common/decorators/index.js';
import { Regex } from '../../../common/utilities/regex/regex.js';
import { MAX_PRICE, MAX_STOCK } from './create-product.dto.js';

/**
 * PATCH (multipart or JSON): send only what changes. New files in `images`
 * are appended. salePrice / costPrice / sku / shortDescription / brandId
 * accept "null" to clear.
 */
export class UpdateProductDto {
  @OptionalNotNull()
  @Trim()
  @IsString()
  @Length(2, 200)
  name?: string;

  /** Explicit slug. Without it, the slug is regenerated when the name changes. */
  @OptionalNotNull()
  @Trim()
  @MaxLength(120)
  @Matches(Regex.SLUG, { message: 'slug may only contain lowercase letters, digits and dashes' })
  slug?: string;

  @IsOptional()
  @ToNullableString()
  @IsString()
  @Length(1, 64)
  sku?: string | null;

  @OptionalNotNull()
  @IsString()
  @Length(1, 20000)
  description?: string;

  @IsOptional()
  @ToNullableString()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @OptionalNotNull()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  basePrice?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  @IsLessThanField('basePrice')
  salePrice?: number | null;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  costPrice?: number | null;

  @OptionalNotNull()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock?: number;

  @OptionalNotNull()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  lowStockThreshold?: number;

  @OptionalNotNull()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  @OptionalNotNull()
  @ToBoolean()
  @IsBoolean()
  isFeatured?: boolean;

  @OptionalNotNull()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @ToNullableString()
  @IsUUID('4')
  brandId?: string | null;

  /** Existing image ids to delete. */
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  removeImageIds?: string[];

  /** Existing image to show first. */
  @IsOptional()
  @IsUUID('4')
  primaryImageId?: string;

  /** Existing image ids in display order (sortOrder = position). */
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  imageOrder?: string[];
}
