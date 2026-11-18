import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { ProductImageEntity } from '../schemas/product-image.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class ProductImageRepository extends BaseRepository<
  ProductImageEntity,
  Prisma.ProductImageWhereInput,
  Prisma.ProductImageWhereUniqueInput,
  Prisma.ProductImageUncheckedCreateInput,
  Prisma.ProductImageUncheckedUpdateInput,
  Prisma.ProductImageOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.productImage;
  }

  findByProduct(productId: string): Promise<ProductImageEntity[]> {
    return this.db.productImage.findMany({
      where: { productId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  createMany(data: Prisma.ProductImageCreateManyInput[]): Promise<{ count: number }> {
    return this.db.productImage.createMany({ data });
  }
}
