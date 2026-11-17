import { IsBoolean, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import {
  OptionalNotNull,
  ToBoolean,
  ToNullableString,
  Trim,
} from '../../../common/decorators/index.js';
import { Regex } from '../../../common/utilities/regex/regex.js';

/** PATCH: send only what changes. parentId/description accept null to clear. */
export class UpdateCategoryDto {
  @OptionalNotNull()
  @Trim()
  @IsString()
  @Length(2, 120)
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

  @IsOptional()
  @ToNullableString()
  @IsUUID('4')
  parentId?: string | null;

  @OptionalNotNull()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
