import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PRODUCT_CARD_SELECT,
  PRODUCT_DETAIL_SELECT,
  PRODUCT_SUGGEST_SELECT,
} from '../../models/schemas/product.schema.js';
import { CreateProductDto, ProductQueryDto } from './dto/index.js';
import { withStockStats } from './entities/product.entity.js';
import { buildProductWhere } from './product-filters.js';
import { ProductsService } from './products.service.js';

const CATEGORY_ID = '8d1b6c1e-1f4a-4a5e-9a8e-2b0f1c3d4e5f';

function setup() {
  const products = {
    findLiveById: vi.fn().mockResolvedValue({
      id: 'p1',
      name: 'Coffee',
      slug: 'coffee',
      basePrice: 10000,
      salePrice: 8000,
      categoryId: CATEGORY_ID,
      brandId: null,
    }),
    slugExists: vi.fn().mockResolvedValue(false),
    withTx: vi.fn(),
  };
  const categories = { findLiveById: vi.fn().mockResolvedValue({ id: CATEGORY_ID }) };
  const images = { findByProduct: vi.fn().mockResolvedValue([]) };
  const storage = {
    uploadFiles: vi.fn().mockResolvedValue([{ key: 'products/x.png', url: 'http://x/uploads/products/x.png' }]),
    deleteFiles: vi.fn().mockResolvedValue(undefined),
  };
  const tx = { run: vi.fn().mockRejectedValue(new Error('db down')) };
  const service = new ProductsService(
    products as never,
    images as never,
    categories as never,
    {} as never,
    {} as never,
    {} as never,
    tx as never,
    storage as never,
    {} as never,
    {} as never, // versions (stock sync)
  );
  return { service, products, storage, tx };
}

const audit = { actorId: 'admin' };
const file = { mimetype: 'image/png', buffer: Buffer.from('x') } as Express.Multer.File;

describe('ProductsService', () => {
  it('deletes uploaded images when the database transaction fails', async () => {
    const { service, storage } = setup();
    await expect(
      service.create(
        { name: 'Coffee', description: 'd', basePrice: 100, categoryId: CATEGORY_ID },
        [file],
        audit,
      ),
    ).rejects.toThrow('db down');
    expect(storage.deleteFiles).toHaveBeenCalledWith(['products/x.png']);
  });

  it('checks salePrice against the stored basePrice on PATCH', async () => {
    const { service, tx } = setup();
    // stored salePrice 8000, new basePrice 7000 -> invalid
    await expect(service.update('p1', { basePrice: 7000 }, [], audit)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.run).not.toHaveBeenCalled();
  });

  it('never selects costPrice or deletedAt in public shapes', () => {
    for (const select of [PRODUCT_CARD_SELECT, PRODUCT_DETAIL_SELECT, PRODUCT_SUGGEST_SELECT]) {
      expect(select).not.toHaveProperty('costPrice');
      expect(select).not.toHaveProperty('deletedAt');
    }
  });
});

describe('CreateProductDto (multipart strings)', () => {
  const base = { name: 'Coffee', description: 'd', categoryId: CATEGORY_ID };

  it('converts numbers and booleans', async () => {
    const dto = plainToInstance(CreateProductDto, {
      ...base,
      basePrice: '18500',
      salePrice: '15000',
      isFeatured: 'true',
      isActive: 'false',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ basePrice: 18500, salePrice: 15000, isFeatured: true, isActive: false });
  });

  it('rejects salePrice >= basePrice, negatives, decimals and junk booleans', async () => {
    const errors = await validate(
      plainToInstance(CreateProductDto, {
        ...base,
        basePrice: '100',
        salePrice: '100',
        costPrice: '-1',
        stock: '1.5',
        isFeatured: 'yes',
      }),
    );
    expect(errors.map((e) => e.property).sort()).toEqual(['costPrice', 'isFeatured', 'salePrice', 'stock']);
  });
});

describe('buildProductWhere', () => {
  it('filters on the price the customer pays and on stock', () => {
    const query = plainToInstance(ProductQueryDto, { minPrice: '100', maxPrice: '500', inStock: 'true' });
    expect(buildProductWhere(query, {})).toEqual({
      AND: [
        {
          OR: [
            { salePrice: null, basePrice: { gte: 100, lte: 500 } },
            { salePrice: { gte: 100, lte: 500 } },
          ],
        },
        { OR: [{ stock: { gt: 0 } }, { variants: { some: { isActive: true, stock: { gt: 0 } } } }] },
      ],
    });
  });
});

describe('withStockStats', () => {
  it('sums active variant stock only', () => {
    const stats = withStockStats({
      stock: 2,
      lowStockThreshold: 5,
      variants: [
        { isActive: true, stock: 1 },
        { isActive: false, stock: 50 },
      ],
    } as never).stockStats;
    expect(stats).toMatchObject({ variantStock: 1, totalStock: 3, isLowStock: true, isOutOfStock: false });
  });
});
