import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import {
  BRAND_PUBLIC_SELECT,
  PUBLIC_BRAND_WHERE,
  type BrandEntity,
  type BrandPublic,
} from '../schemas/brand.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class BrandRepository extends BaseRepository<
  BrandEntity,
  Prisma.BrandWhereInput,
  Prisma.BrandWhereUniqueInput,
  Prisma.BrandUncheckedCreateInput,
  Prisma.BrandUncheckedUpdateInput,
  Prisma.BrandOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.brand;
  }

  /** Dashboard: every live row (hidden ones too) with its live product count. */
  findAllForAdmin() {
    return this.db.brand.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      orderBy: { name: 'asc' },
    });
  }

  findAllPublic(): Promise<BrandPublic[]> {
    return this.db.brand.findMany({
      where: PUBLIC_BRAND_WHERE,
      select: BRAND_PUBLIC_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  findPublicByIdOrSlug(idOrSlug: string, isId: boolean): Promise<BrandPublic | null> {
    return this.db.brand.findFirst({
      where: { ...(isId ? { id: idOrSlug } : { slug: idOrSlug }), ...PUBLIC_BRAND_WHERE },
      select: BRAND_PUBLIC_SELECT,
    });
  }

  /** Not soft-deleted (may be inactive). */
  findLiveById(id: string): Promise<BrandEntity | null> {
    return this.db.brand.findFirst({ where: { id, deletedAt: null } });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const row = await this.db.brand.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!row;
  }
}
