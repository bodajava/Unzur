import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ToBoolean, ToNullableString, Trim } from '../../../common/decorators/index.js';
import { Regex } from '../../../common/utilities/regex/regex.js';

/** JSON or multipart (optional `logo` file). */
export class CreateBrandDto {
  @Trim()
  @IsString()
  @Length(1, 120)
  name: string;

  /** Optional; generated from name when missing. */
  @IsOptional()
  @Trim()
  @MaxLength(120)
  @Matches(Regex.SLUG, { message: 'slug may only contain lowercase letters, digits and dashes' })
  slug?: string;

  @IsOptional()
  @ToNullableString()
  @IsString()
  @MaxLength(2000)
  description?: string | null;


  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
