import type { Cart, Prisma } from '../../generated/prisma/client.js';
import { PRODUCT_IMAGE_ORDER } from './product.schema.js';

export type { Cart };

/** Row shape returned by default queries. */
export type CartEntity = Cart;

export type CartWithItems = Prisma.CartGetPayload<{ include: { items: true } }>;

/**
 * Cart with what pricing and availability need. Product fields are the
 * public ones (no costPrice); isActive/deletedAt are read only to flag
 * unavailable lines and are not sent as-is.
 */
export const CART_DETAIL_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true,
          basePrice: true,
          salePrice: true,
          stock: true,
          isActive: true,
          deletedAt: true,
          // All photos (a product has at most a few): a colour's own photo is shown for its line.
          images: {
            select: { id: true, url: true, altText: true },
            orderBy: PRODUCT_IMAGE_ORDER,
          },
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          sku: true,
          price: true,
          salePrice: true,
          stock: true,
          isActive: true,
          attributes: true,
        },
      },
    },
  },
} as const satisfies Prisma.CartInclude;

export type CartDetailRow = Prisma.CartGetPayload<{ include: typeof CART_DETAIL_INCLUDE }>;
export type CartDetailItemRow = CartDetailRow['items'][number];

/** Who owns a cart: a user, or else a guest. */
export interface CartOwner {
  userId?: string;
  guestId?: string;
}
