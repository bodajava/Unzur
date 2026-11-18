import type { WishlistItem } from '../../generated/prisma/client.js';

export type { WishlistItem };

/** Row shape returned by default queries. */
export type WishlistItemEntity = WishlistItem;

import type { Prisma } from '../../generated/prisma/client.js';
import { PRODUCT_CARD_SELECT } from './product.schema.js';

/** Wishlist row with the public product card (no costPrice). */
export const WISHLIST_ITEM_SELECT = {
  id: true,
  productId: true,
  createdAt: true,
  product: { select: { ...PRODUCT_CARD_SELECT, isActive: true, deletedAt: true } },
} as const satisfies Prisma.WishlistItemSelect;

export type WishlistItemRow = Prisma.WishlistItemGetPayload<{ select: typeof WISHLIST_ITEM_SELECT }>;
