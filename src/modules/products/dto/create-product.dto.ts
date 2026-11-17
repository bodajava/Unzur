import {
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
  ToBoolean,
  ToInt,
  Trim,
} from '../../../common/decorators/index.js';
import { Regex } from '../../../common/utilities/regex/regex.js';

/** Upper bound for money values in piasters (20,000,000 EGP; fits in a 32-bit Int). */
export const MAX_PRICE = 2_000_000_000;
export const MAX_STOCK = 1_000_000;

/**
 * multipart/form-data: every field is a string on the wire, so numbers and
 * booleans are converted first. Images come in the `images` file field.
 * Money is in piasters (100 = 1 EGP).
 */
export class CreateProductDto {
  @Trim()
  @IsString()
  @Length(2, 200)
  name: string;

  /** Optional; generated from name when missing. */
  @IsOptional()
  @Trim()
  @MaxLength(120)
  @Matches(Regex.SLUG, { message: 'slug may only contain lowercase letters, digits and dashes' })
  slug?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 64)
  sku?: string;

  @IsString()
  @Length(1, 20000)
  description: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  basePrice: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  @IsLessThanField('basePrice')
  salePrice?: number;

  /** Admin-only; never returned by public endpoints. */
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  costPrice?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  lowStockThreshold?: number;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isFeatured?: boolean;

  @IsUUID('4')
  categoryId: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;
}
