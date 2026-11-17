import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ToInt, Trim } from '../../../common/decorators/index.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

/** 19.1 */
export class LowStockQueryDto {
  @IsOptional() @ToInt() @IsInt() @Min(1) @Max(500) limit?: number;
}

/** 19.2 GET /admin/audit-logs */
@InputType('AuditLogFilter')
export class AuditLogQueryDto extends PaginationQueryDto {
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') actorId?: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(60) entityType?: string;
  @Field({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(60) action?: string;
  @Field(() => Date, { nullable: true }) @IsOptional() @Type(() => Date) @IsDate() fromDate?: Date;
  @Field(() => Date, { nullable: true }) @IsOptional() @Type(() => Date) @IsDate() toDate?: Date;
}

export const EXPORT_TYPES = ['orders', 'products', 'customers'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

/** 19.3 */
export class ExportQueryDto {
  @IsIn(EXPORT_TYPES) type: ExportType;
}

/** 19.4 GET /admin/customers?search=&sort=-totalSpent */
@InputType('CustomerDirectoryFilter')
export class CustomerDirectoryQueryDto extends PaginationQueryDto {}

export const CUSTOMER_SORTS = ['totalSpent', 'ordersCount', 'lastOrderAt', 'name'] as const;
