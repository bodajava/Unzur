import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ToInt } from '../../../common/decorators/index.js';
import { GRANULARITIES, type Granularity } from '../../../models/analytics-sql.js';

/** ?fromDate=&toDate= (ISO). Default: the last 30 days. */
@InputType('AnalyticsRangeInput')
export class AnalyticsRangeDto {
  @Field(() => Date, { nullable: true }) @IsOptional() @Type(() => Date) @IsDate() fromDate?: Date;
  @Field(() => Date, { nullable: true }) @IsOptional() @Type(() => Date) @IsDate() toDate?: Date;
}

/** 8.2 */
@InputType('SalesTrendInput')
export class SalesTrendDto extends AnalyticsRangeDto {
  /** day | week | month */
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(GRANULARITIES) granularity?: Granularity;
}

export const PERFORMANCE_SORTS = ['revenue', 'unitsSold', 'conversionRate', 'views', 'refunds'] as const;
export type PerformanceSort = (typeof PERFORMANCE_SORTS)[number];

/** 8.3 */
@InputType('ProductsPerformanceInput')
export class ProductsPerformanceDto extends AnalyticsRangeDto {
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(PERFORMANCE_SORTS) sortBy?: PerformanceSort;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
  @Field(() => Int, { nullable: true }) @IsOptional() @ToInt() @IsInt() @Min(1) @Max(100) limit?: number;
}
