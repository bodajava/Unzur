import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { JSONScalar } from '../../../graphql/scalars/json.scalar.js';

export const SETTING_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

@InputType('SettingInput')
export class SettingInputDto {
  @Field()
  @IsString()
  @Matches(SETTING_KEY_PATTERN, { message: 'key must be snake_case (a-z, 0-9, _), 2-64 chars' })
  key: string;

  /** Any JSON value (known keys are type-checked by the service). */
  @Field(() => JSONScalar, { nullable: true })
  @Allow()
  value: unknown;

  /** Visible on GET /settings/public. Unchanged when omitted on an existing key. */
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/** 15.4 PATCH /admin/settings  { "settings": [{ key, value, isPublic? }] } */
@InputType('UpdateSettingsInput')
export class UpdateSettingsDto {
  @Field(() => [SettingInputDto])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SettingInputDto)
  settings: SettingInputDto[];
}
