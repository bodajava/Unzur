import type { Category, Prisma } from '../../generated/prisma/client.js';

export type { Category };

/** Row shape returned by default queries. */
export type CategoryEntity = Category;

export const PUBLIC_CATEGORY_WHERE = {
  isActive: true,
  deletedAt: null,
} as const satisfies Prisma.CategoryWhereInput;

/** PUBLIC category shape (no deletedAt). */
export const CATEGORY_PUBLIC_SELECT = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  description: true,
  descriptionAr: true,
  imageUrl: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.CategorySelect;

export type CategoryPublic = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_PUBLIC_SELECT }>;

export type CategoryNode = CategoryPublic & { children: CategoryNode[] };
