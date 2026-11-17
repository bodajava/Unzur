import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsPhone, OptionalNotNull, ToNullableString, Trim } from '../../../common/decorators/index.js';
import { PASSWORD_MAX, PASSWORD_MIN } from './register.dto.js';

/** 10.1 PATCH /auth/me  ·  GraphQL updateProfile. phone: null removes it. */
@InputType('UpdateProfileInput')
export class UpdateProfileDto {
  @Field({ nullable: true })
  @OptionalNotNull()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  @Field({ nullable: true })
  @OptionalNotNull()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ToNullableString()
  @IsPhone()
  phone?: string | null;
}

/** 10.2 PATCH /auth/change-password */
export class ChangePasswordDto {
  @IsString()
  @MaxLength(PASSWORD_MAX)
  currentPassword: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  newPassword: string;
}
