import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import {
  OptionalNotNull,
  ToBoolean,
  ToNullableString,
  Trim,
} from '../../../common/decorators/index.js';
import { Regex } from '../../../common/utilities/regex/regex.js';

/** PATCH: send only what changes. description accepts null to clear. */
export class UpdateBrandDto {
  @OptionalNotNull()
  @Trim()
  @IsString()
  @Length(1, 120)
  name?: string;

  @OptionalNotNull()
  @Trim()
  @MaxLength(120)
  @Matches(Regex.SLUG, { message: 'slug may only contain lowercase letters, digits and dashes' })
  slug?: string;

  @IsOptional()
  @ToNullableString()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @OptionalNotNull()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
