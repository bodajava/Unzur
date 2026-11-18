import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsPhone, OptionalNotNull, ToNullableString, Trim } from '../../../common/decorators/index.js';

/** 10.4 POST /addresses */
@InputType('CreateAddressInput')
export class CreateAddressDto {
  /** e.g. "Home", "Work", "البيت" */
  @Field() @Trim() @IsString() @Length(1, 40) label: string;
  @Field() @Trim() @IsString() @Length(2, 100) fullName: string;
  @Field() @Trim() @IsPhone() phone: string;
  @Field() @Trim() @IsString() @Length(2, 60) governorate: string;
  @Field() @Trim() @IsString() @Length(2, 80) city: string;
  @Field() @Trim() @IsString() @Length(2, 200) street: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(50) building?: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(20) floor?: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(20) apartment?: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(500) notes?: string;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isDefault?: boolean;
}

/** 10.5 PATCH /addresses/:id. Optional text fields accept null to clear. */
@InputType('UpdateAddressInput')
export class UpdateAddressDto {
  @Field({ nullable: true }) @OptionalNotNull() @Trim() @IsString() @Length(1, 40) label?: string;
  @Field({ nullable: true }) @OptionalNotNull() @Trim() @IsString() @Length(2, 100) fullName?: string;
  @Field({ nullable: true }) @OptionalNotNull() @Trim() @IsPhone() phone?: string;
  @Field({ nullable: true }) @OptionalNotNull() @Trim() @IsString() @Length(2, 60) governorate?: string;
  @Field({ nullable: true }) @OptionalNotNull() @Trim() @IsString() @Length(2, 80) city?: string;
  @Field({ nullable: true }) @OptionalNotNull() @Trim() @IsString() @Length(2, 200) street?: string;
  @Field(() => String, { nullable: true }) @IsOptional() @ToNullableString() @IsString() @MaxLength(50) building?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @ToNullableString() @IsString() @MaxLength(20) floor?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @ToNullableString() @IsString() @MaxLength(20) apartment?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @ToNullableString() @IsString() @MaxLength(500) notes?: string | null;
  /** true makes it the default (false is ignored: pick another default instead). */
  @Field({ nullable: true }) @OptionalNotNull() @IsBoolean() isDefault?: boolean;
}
