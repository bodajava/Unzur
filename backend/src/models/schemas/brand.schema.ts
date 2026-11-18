import type { Brand, Prisma } from '../../generated/prisma/client.js';

export type { Brand };

/** Row shape returned by default queries. */
export type BrandEntity = Brand;

export const PUBLIC_BRAND_WHERE = {
  isActive: true,
  deletedAt: null,
} as const satisfies Prisma.BrandWhereInput;

/** PUBLIC brand shape (no deletedAt). */
export const BRAND_PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.BrandSelect;

export type BrandPublic = Prisma.BrandGetPayload<{ select: typeof BRAND_PUBLIC_SELECT }>;
