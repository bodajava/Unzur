import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import {
  CATEGORY_PUBLIC_SELECT,
  PUBLIC_CATEGORY_WHERE,
  type CategoryEntity,
  type CategoryPublic,
} from '../schemas/category.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class CategoryRepository extends BaseRepository<
  CategoryEntity,
  Prisma.CategoryWhereInput,
  Prisma.CategoryWhereUniqueInput,
  Prisma.CategoryUncheckedCreateInput,
  Prisma.CategoryUncheckedUpdateInput,
  Prisma.CategoryOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.category;
  }

  findAllPublic(): Promise<CategoryPublic[]> {
    return this.db.category.findMany({
      where: PUBLIC_CATEGORY_WHERE,
      select: CATEGORY_PUBLIC_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  findPublicBySlug(slug: string): Promise<CategoryPublic | null> {
    return this.db.category.findFirst({
      where: { slug, ...PUBLIC_CATEGORY_WHERE },
      select: CATEGORY_PUBLIC_SELECT,
    });
  }

  findPublicByIdOrSlug(idOrSlug: string, isId: boolean): Promise<CategoryPublic | null> {
    return this.db.category.findFirst({
      where: { ...(isId ? { id: idOrSlug } : { slug: idOrSlug }), ...PUBLIC_CATEGORY_WHERE },
      select: CATEGORY_PUBLIC_SELECT,
    });
  }

  /** Not soft-deleted (may be inactive). */
  findLiveById(id: string): Promise<CategoryEntity | null> {
    return this.db.category.findFirst({ where: { id, deletedAt: null } });
  }

  /** parentId of every non-deleted category, for tree/cycle checks. */
  findLiveParentLinks(): Promise<{ id: string; parentId: string | null }[]> {
    return this.db.category.findMany({
      where: { deletedAt: null },
      select: { id: true, parentId: true },
    });
  }

  countLiveChildren(id: string): Promise<number> {
    return this.db.category.count({ where: { parentId: id, deletedAt: null } });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const row = await this.db.category.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!row;
  }
}
