import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ToBoolean, ToInt, Trim } from '../../../common/decorators/index.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

/** 12.2 POST /products/:id/reviews */
@InputType('CreateReviewInput')
export class CreateReviewDto {
  /** ToInt: also sent as multipart form text when photos are attached. */
  @Field(() => Int) @ToInt() @IsInt() @Min(1) @Max(5) rating: number;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(120) title?: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(2000) comment?: string;
}

/** 12.3 GET /admin/reviews?isApproved= */
export class AdminReviewQueryDto extends PaginationQueryDto {
  @IsOptional() @ToBoolean() @IsBoolean() isApproved?: boolean;
}

/** 12.4 PATCH /admin/reviews/:id */
export class ModerateReviewDto {
  @IsBoolean() isApproved: boolean;
}
