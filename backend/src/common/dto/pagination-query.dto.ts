import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { PaginationMeta } from '../interfaces/api-response.interface.js';
import { Regex } from '../utilities/regex/regex.js';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** ?page=1&limit=20&sort=-createdAt&search=...  (also a GraphQL input base) */
@InputType({ isAbstract: true })
export class PaginationQueryDto {
  @Field(() => Int, { nullable: true, defaultValue: DEFAULT_PAGE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @Field(() => Int, { nullable: true, defaultValue: DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @Field({ nullable: true, description: 'Comma-separated fields, "-" = descending' })
  /** Comma-separated fields, "-" prefix = descending. e.g. "-createdAt,name" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(Regex.SORT, {
    message: 'sort must look like "field" or "-field,other"',
  })
  sort?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}


export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export type SortOrder = 'asc' | 'desc';

/**
 * Converts "-createdAt,name" into Prisma orderBy:
 * [{ createdAt: 'desc' }, { name: 'asc' }].
 * Fields not in allowedFields are ignored (prevents sorting on hidden columns).
 */
export function parseSortParam<T extends string>(
  sort: string | undefined,
  allowedFields: readonly T[],
  fallback: Partial<Record<T, SortOrder>>[] = [],
): Partial<Record<T, SortOrder>>[] {
  if (!sort) return fallback;
  const allowed = new Set<string>(allowedFields);
  const result: Partial<Record<T, SortOrder>>[] = [];

  for (const token of sort.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const desc = trimmed.startsWith('-');
    const field = desc ? trimmed.slice(1) : trimmed;
    if (allowed.has(field)) {
      result.push({ [field]: desc ? 'desc' : 'asc' } as Partial<
        Record<T, SortOrder>
      >);
    }
  }
  return result.length ? result : fallback;
}
