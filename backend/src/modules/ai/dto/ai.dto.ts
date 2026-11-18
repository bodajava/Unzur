import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';
import { Trim } from '../../../common/decorators/index.js';

@InputType('ChatMessageInput')
export class ChatMessageDto {
  /** user | assistant (system messages are never accepted from clients) */
  @Field() @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @Field() @IsString() @Length(1, 2000) content: string;
}

/** 9.1 POST /ai/customer/chat */
@InputType('CustomerChatInput')
export class CustomerChatDto {
  @Field() @Trim() @IsString() @Length(1, 1000) message: string;
  @Field(() => [ChatMessageDto], { nullable: true })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') productId?: string;
}

export const ADVISOR_FOCUS = ['OVERALL', 'PRODUCT_DIAGNOSTICS', 'CUSTOMERS', 'INVENTORY'] as const;
export type AdvisorFocus = (typeof ADVISOR_FOCUS)[number];

/** 9.2 POST /admin/ai/advisor */
@InputType('AdvisorInput')
export class AdvisorDto {
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @Length(1, 1000) question?: string;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') productId?: string;
  /** OVERALL | PRODUCT_DIAGNOSTICS | CUSTOMERS | INVENTORY (default: PRODUCT_DIAGNOSTICS with productId, else OVERALL) */
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(ADVISOR_FOCUS) focus?: AdvisorFocus;
}

/** 9.3 POST /admin/ai/chat */
@InputType('AdminChatInput')
export class AdminChatDto {
  @Field() @Trim() @IsString() @Length(1, 2000) message: string;
  @Field(() => [ChatMessageDto], { nullable: true })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}
