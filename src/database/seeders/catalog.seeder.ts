import { Injectable, Logger } from '@nestjs/common';
import { BrandRepository } from '../../models/repositories/brand.repository.js';
import { CategoryRepository } from '../../models/repositories/category.repository.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';
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
    private readonly variants: ProductVariantRepository,
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
        // Arabic copy added later: fill it in, never overwrite what staff wrote.
        if (!existing.nameAr && !existing.descriptionAr) {
          await this.categories.updateById(existing.id, { nameAr: c.nameAr, descriptionAr: c.descriptionAr });
        }
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
      const existing = await this.products.findUnique({ slug: p.slug });
      if (existing) {
        skipped++;
        await this.backfillArabic(existing.id, existing.nameAr, p, variants);
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

  /** Sample products seeded before the Arabic copy existed get it, unless staff already wrote some. */
  private async backfillArabic(
    id: string,
    currentNameAr: string | null,
    p: { nameAr?: string; shortDescriptionAr?: string; descriptionAr?: string },
    variants: { sku: string; nameAr?: string }[],
  ): Promise<void> {
    if (currentNameAr || !p.nameAr) return;
    await this.products.updateById(id, { nameAr: p.nameAr, shortDescriptionAr: p.shortDescriptionAr, descriptionAr: p.descriptionAr });
    for (const v of variants) {
      if (v.nameAr) await this.variants.updateMany({ sku: v.sku, nameAr: null }, { nameAr: v.nameAr });
    }
  }
}
