import type { RecentlyViewed } from '../../generated/prisma/client.js';

export type { RecentlyViewed };

/** Row shape returned by default queries. */
export type RecentlyViewedEntity = RecentlyViewed;

/** Who a recently-viewed list belongs to: a user, or else a guest. */
export interface ViewerRef {
  userId?: string;
  guestId?: string;
}
