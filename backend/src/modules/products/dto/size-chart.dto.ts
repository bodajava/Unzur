import { plainToInstance, Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Length, MaxLength, ValidateNested } from 'class-validator';
import { ToBoolean, Trim } from '../../../common/decorators/index.js';

export const MAX_SIZE_CHART_OPTIONS = 2;

export class SizeChartOptionDto {
  /** What the customer picks, e.g. "عربي", "English", "Small". */
  @Trim()
  @IsString()
  @Length(1, 30)
  label!: string;

  /** "new:0" / "new:1" = the uploaded file at that position; otherwise a photo URL already on this chart. */
  @IsString()
  @MaxLength(1000)
  image!: string;
}

/**
 * PUT /products/:id/size-chart (multipart): `enabled`, `title`, `options`
 * (JSON array of { label, image }) and up to 2 new files in `images`.
 */
export class SaveSizeChartDto {
  @ToBoolean()
  @IsBoolean()
  enabled!: boolean;

  /** The button's name on the product page (default "Size chart"). */
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  title?: string;

  @Transform(({ value }: { value: unknown }) => {
    let list = value;
    if (typeof value === 'string') {
      try {
        list = JSON.parse(value);
      } catch {
        return value;
      }
    }
    return Array.isArray(list) ? plainToInstance(SizeChartOptionDto, list as object[]) : list;
  })
  @IsArray()
  @ArrayMaxSize(MAX_SIZE_CHART_OPTIONS)
  @ValidateNested({ each: true })
  options!: SizeChartOptionDto[];
}
