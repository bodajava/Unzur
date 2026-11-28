import type { Prisma, Product } from '../../generated/prisma/client.js';

export type { Product };

/** Row shape returned by default queries (includes costPrice: admin/internal only). */
export type ProductEntity = Product;

/** Note: searchVector (tsvector) is maintained by a DB trigger and is not readable via Prisma. */

/** Primary image first, then by sortOrder. */
export const PRODUCT_IMAGE_ORDER = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
] as const satisfies Prisma.ProductImageOrderByWithRelationInput[];

const PRIMARY_IMAGE = {
  select: { id: true, url: true, altText: true },
  orderBy: PRODUCT_IMAGE_ORDER,
  take: 1,
} as const;

const CATEGORY_REF = { select: { id: true, name: true, nameAr: true, slug: true } } as const;
const BRAND_REF = { select: { id: true, name: true, slug: true, logoUrl: true } } as const;

/** Only active, non-deleted products are ever shown publicly. */
export const PUBLIC_PRODUCT_WHERE = {
  isActive: true,
  deletedAt: null,
} as const satisfies Prisma.ProductWhereInput;

/**
 * Lightweight card for lists. PUBLIC: never add costPrice or deletedAt here.
 */
export const PRODUCT_CARD_SELECT = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  shortDescription: true,
  shortDescriptionAr: true,
  basePrice: true,
  salePrice: true,
  stock: true,
  isFeatured: true,
  /** Raw JSON: toCard passes on only an enabled chart (quick add asks for the choice). */
  sizeChart: true,
  createdAt: true,
  category: CATEGORY_REF,
  brand: BRAND_REF,
  images: PRIMARY_IMAGE,
  /** Active versions, so a list can add to cart (or ask which version) without opening the product. */
  variants: {
    where: { isActive: true },
    select: { id: true, name: true, nameAr: true, price: true, salePrice: true, stock: true, attributes: true },
    orderBy: { price: 'asc' },
  },
} as const satisfies Prisma.ProductSelect;

export type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_CARD_SELECT }>;

/** Search-as-you-type result: as small as possible. PUBLIC. */
export const PRODUCT_SUGGEST_SELECT = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  basePrice: true,
  salePrice: true,
  images: PRIMARY_IMAGE,
} as const satisfies Prisma.ProductSelect;

export type ProductSuggestRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SUGGEST_SELECT }>;

/** Full product page. PUBLIC: never add costPrice or deletedAt here. */
export const PRODUCT_DETAIL_SELECT = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  sku: true,
  description: true,
  descriptionAr: true,
  shortDescription: true,
  shortDescriptionAr: true,
  basePrice: true,
  salePrice: true,
  stock: true,
  isFeatured: true,
  /** Raw JSON: the service passes on only an enabled chart (publicSizeChart). */
  sizeChart: true,
  categoryId: true,
  brandId: true,
  createdAt: true,
  updatedAt: true,
  category: CATEGORY_REF,
  brand: BRAND_REF,
  images: {
    select: { id: true, url: true, altText: true, sortOrder: true, isPrimary: true },
    orderBy: PRODUCT_IMAGE_ORDER,
  },
  variants: {
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      nameAr: true,
      sku: true,
      price: true,
      salePrice: true,
      stock: true,
      attributes: true,
    },
    orderBy: { price: 'asc' },
  },
} as const satisfies Prisma.ProductSelect;

export type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_DETAIL_SELECT }>;

/** Admin view: everything, including costPrice, deletedAt and hidden variants. */
export const PRODUCT_ADMIN_SELECT = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  sku: true,
  description: true,
  descriptionAr: true,
  shortDescription: true,
  shortDescriptionAr: true,
  basePrice: true,
  salePrice: true,
  costPrice: true,
  stock: true,
  lowStockThreshold: true,
  isActive: true,
  isFeatured: true,
  sizeChart: true,
  categoryId: true,
  brandId: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  category: CATEGORY_REF,
  brand: BRAND_REF,
  images: {
    select: { id: true, url: true, altText: true, sortOrder: true, isPrimary: true },
    orderBy: PRODUCT_IMAGE_ORDER,
  },
  variants: {
    select: {
      id: true,
      name: true,
      nameAr: true,
      sku: true,
      price: true,
      salePrice: true,
      stock: true,
      attributes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} as const satisfies Prisma.ProductSelect;

export type ProductAdminRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_ADMIN_SELECT }>;

/** Fields a product search can sort by (?sort=-createdAt,basePrice). */
export const PRODUCT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'basePrice',
  'salePrice',
] as const;

export const PRODUCT_ADMIN_SORT_FIELDS = [...PRODUCT_SORT_FIELDS, 'stock'] as const;
