import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsPhone, NormalizeEmail, ToBoolean, Trim } from '../../../common/decorators/index.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

/** 7.4 POST /contact */
@InputType('ContactMessageInput')
export class CreateContactMessageDto {
  @Field() @Trim() @IsString() @Length(2, 100) name: string;
  @Field() @NormalizeEmail() @IsEmail() @MaxLength(254) email: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsPhone() phone?: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(150) subject?: string;
  @Field() @Trim() @IsString() @Length(5, 5000) message: string;
}

/** 7.5 GET /contact/messages?isRead=&search= */
export class ContactQueryDto extends PaginationQueryDto {
  @IsOptional() @ToBoolean() @IsBoolean() isRead?: boolean;
}

/** 7.6 PATCH /contact/messages/:id */
export class UpdateContactMessageDto {
  @IsOptional() @IsBoolean() isRead?: boolean;
  /** true sets repliedAt = now (and marks it read); false clears it. */
  @IsOptional() @IsBoolean() replied?: boolean;
}
