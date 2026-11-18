import type { Prisma } from '../../generated/prisma/client.js';
import type { ProductQueryDto } from './dto/index.js';

/**
 * Prisma filters for price / featured / stock. Category, brand and search
 * are resolved by the service (they need lookups) and passed in.
 */
export function buildProductWhere(
  query: ProductQueryDto,
  resolved: { categoryIds?: string[]; brandId?: string; ids?: string[] },
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (resolved.categoryIds) and.push({ categoryId: { in: resolved.categoryIds } });
  if (resolved.brandId) and.push({ brandId: resolved.brandId });
  if (resolved.ids) and.push({ id: { in: resolved.ids } });
  if (query.isFeatured !== undefined) and.push({ isFeatured: query.isFeatured });

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    // Price the customer pays: salePrice when set, otherwise basePrice.
    const range = { gte: query.minPrice, lte: query.maxPrice };
    and.push({ OR: [{ salePrice: null, basePrice: range }, { salePrice: range }] });
  }

  const variantInStock = { some: { isActive: true, stock: { gt: 0 } } };
  if (query.inStock === true) {
    and.push({ OR: [{ stock: { gt: 0 } }, { variants: variantInStock }] });
  } else if (query.inStock === false) {
    and.push({ stock: { lte: 0 }, variants: { none: { isActive: true, stock: { gt: 0 } } } });
  }

  return and.length ? { AND: and } : {};
}
