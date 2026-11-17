import type { GiftCard, Prisma } from '../../generated/prisma/client.js';

export type { GiftCard };

/** Row shape returned by default queries. */
export type GiftCardEntity = GiftCard;

/** Card + who bought it + payment state + how many orders used it. */
export const GIFT_CARD_ADMIN_INCLUDE = {
  purchasedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  payments: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
  _count: { select: { orders: true } },
} as const satisfies Prisma.GiftCardInclude;

export type GiftCardAdminRow = Prisma.GiftCardGetPayload<{ include: typeof GIFT_CARD_ADMIN_INCLUDE }>;
