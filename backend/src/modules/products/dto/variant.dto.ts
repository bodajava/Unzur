import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min, MaxLength } from 'class-validator';
import {
  IsLessThanField,
  OptionalNotNull,
  ToBoolean,
  ToInt,
  ToNullableString,
  Trim,
} from '../../../common/decorators/index.js';
import { MAX_PRICE, MAX_STOCK } from './create-product.dto.js';

/** POST /products/:id/variants. Money in piasters. */
export class CreateVariantDto {
  @Trim()
  @IsString()
  @Length(1, 120)
  name: string;

  /** Arabic (optional; the English field is the fallback). Send "" to clear. */
  @IsOptional()
  @ToNullableString()
  @IsString()
  @MaxLength(120)
  nameAr?: string | null;

  @Trim()
  @IsString()
  @Length(1, 64)
  sku: string;

  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  @IsLessThanField('price')
  salePrice?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock?: number;

  /** e.g. { "weight": "500g", "roast": "dark" } */
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

/** PATCH /variants/:id. salePrice / attributes accept null to clear. */
export class UpdateVariantDto {
  @OptionalNotNull()
  @Trim()
  @IsString()
  @Length(1, 120)
  name?: string;

  /** Arabic (optional; the English field is the fallback). Send "" to clear. */
  @IsOptional()
  @ToNullableString()
  @IsString()
  @MaxLength(120)
  nameAr?: string | null;

  @OptionalNotNull()
  @Trim()
  @IsString()
  @Length(1, 64)
  sku?: string;

  @OptionalNotNull()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  @IsLessThanField('price')
  salePrice?: number | null;

  @OptionalNotNull()
  @ToInt()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown> | null;

  @OptionalNotNull()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
