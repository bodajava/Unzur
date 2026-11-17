import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail, ToBoolean } from '../../../common/decorators/index.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

/** 7.1 POST /newsletter/subscribe */
@InputType('SubscribeInput')
export class SubscribeDto {
  @Field() @NormalizeEmail() @IsEmail() @MaxLength(254) email: string;
}

/** 7.2 GET /newsletter/subscribers?isActive=&search= */
export class SubscriberQueryDto extends PaginationQueryDto {
  @IsOptional() @ToBoolean() @IsBoolean() isActive?: boolean;
}

/**
 * POST /newsletter/unsubscribe: { token } as JSON, or the RFC 8058 one-click
 * form post (List-Unsubscribe=One-Click) with the token in the URL.
 */
export class UnsubscribeDto {
  @IsOptional() @IsString() @MaxLength(600) token?: string;
  @IsOptional() @IsIn(['One-Click']) 'List-Unsubscribe'?: string;
}

export class UnsubscribeQueryDto {
  @IsOptional() @IsString() @MaxLength(600) token?: string;
}
