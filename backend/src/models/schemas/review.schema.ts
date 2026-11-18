import type { Prisma, Review } from '../../generated/prisma/client.js';

export type { Review };

/** Row shape returned by default queries. */
export type ReviewEntity = Review;

export interface RatingSummary {
  averageRating: number | null;
  reviewCount: number;
}

export interface RatingBreakdown {
  stars: number;
  count: number;
}

/** Public review: reviewer first name + last initial only. */
export const PUBLIC_REVIEW_SELECT = {
  id: true,
  rating: true,
  title: true,
  comment: true,
  orderId: true,
  createdAt: true,
  user: { select: { firstName: true, lastName: true } },
} as const satisfies Prisma.ReviewSelect;

export type PublicReviewRow = Prisma.ReviewGetPayload<{ select: typeof PUBLIC_REVIEW_SELECT }>;

export const ADMIN_REVIEW_INCLUDE = {
  product: { select: { id: true, name: true, slug: true } },
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const satisfies Prisma.ReviewInclude;

export type AdminReviewRow = Prisma.ReviewGetPayload<{ include: typeof ADMIN_REVIEW_INCLUDE }>;
