import { Injectable, Logger } from '@nestjs/common';
import { BrandRepository } from '../../models/repositories/brand.repository.js';
import { CategoryRepository } from '../../models/repositories/category.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { CATALOG_SEED } from './catalog.data.js';

/** Insert-only: rows whose slug already exists are left untouched. */
@Injectable()
export class CatalogSeeder {
  private readonly logger = new Logger(CatalogSeeder.name);

  constructor(
    private readonly categories: CategoryRepository,
    private readonly brands: BrandRepository,
    private readonly products: ProductRepository,
  ) {}

  async run(): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;
    const categoryIds = new Map<string, string>();
    const brandIds = new Map<string, string>();

    for (const c of CATALOG_SEED.categories) {
      const existing = await this.categories.findUnique({ slug: c.slug });
      if (existing) {
        skipped++;
        categoryIds.set(c.slug, existing.id);
        continue;
      }
      categoryIds.set(c.slug, (await this.categories.create(c)).id);
      inserted++;
    }

    for (const b of CATALOG_SEED.brands) {
      const existing = await this.brands.findUnique({ slug: b.slug });
      if (existing) {
        skipped++;
        brandIds.set(b.slug, existing.id);
        continue;
      }
      brandIds.set(b.slug, (await this.brands.create(b)).id);
      inserted++;
    }

    for (const { category, brand, variants, ...p } of CATALOG_SEED.products) {
      if (await this.products.exists({ slug: p.slug })) {
        skipped++;
        continue;
      }
      await this.products.create({
        ...p,
        categoryId: categoryIds.get(category)!,
        brandId: brand ? brandIds.get(brand) : null,
        variants: variants.length ? { create: variants } : undefined,
      });
      inserted++;
    }

    this.logger.log(`Catalog seed: ${inserted} inserted, ${skipped} already present`);
    return { inserted, skipped };
  }
}
