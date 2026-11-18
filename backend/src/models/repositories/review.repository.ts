import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { ReviewEntity } from '../schemas/review.schema.js';
import { BaseRepository } from './base.repository.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import {
  ADMIN_REVIEW_INCLUDE,
  PUBLIC_REVIEW_SELECT,
  type AdminReviewRow,
  type PublicReviewRow,
  type RatingBreakdown,
  type RatingSummary,
} from '../schemas/review.schema.js';

@Injectable()
export class ReviewRepository extends BaseRepository<
  ReviewEntity,
  Prisma.ReviewWhereInput,
  Prisma.ReviewWhereUniqueInput,
  Prisma.ReviewUncheckedCreateInput,
  Prisma.ReviewUncheckedUpdateInput,
  Prisma.ReviewOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.review;
  }

  /** Average rating (1 decimal) and count of approved reviews. */
  async ratingSummary(productId: string): Promise<RatingSummary> {
    const agg = await this.db.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const avg = agg._avg.rating;
    return {
      averageRating: avg === null ? null : Math.round(avg * 10) / 10,
      reviewCount: agg._count._all,
    };
  }

  /** Approved reviews per star (5..1), zeros included. */
  async breakdown(productId: string): Promise<RatingBreakdown[]> {
    const groups = await this.db.review.groupBy({
      by: ['rating'],
      where: { productId, isApproved: true },
      _count: { _all: true },
    });
    const byStars = new Map(groups.map((g) => [g.rating, g._count._all]));
    return [5, 4, 3, 2, 1].map((stars) => ({ stars, count: byStars.get(stars) ?? 0 }));
  }

  async paginateApproved(productId: string, page: number, limit: number): Promise<Paginated<PublicReviewRow>> {
    const where = { productId, isApproved: true };
    const [items, total] = await Promise.all([
      this.db.review.findMany({
        where,
        select: PUBLIC_REVIEW_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.review.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  /** Pending first, newest first. */
  async paginateAdmin(where: Prisma.ReviewWhereInput, page: number, limit: number): Promise<Paginated<AdminReviewRow>> {
    const [items, total] = await Promise.all([
      this.db.review.findMany({
        where,
        include: ADMIN_REVIEW_INCLUDE,
        orderBy: [{ isApproved: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.review.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  async existsForUser(userId: string, productId: string): Promise<boolean> {
    return !!(await this.db.review.findUnique({ where: { userId_productId: { userId, productId } }, select: { id: true } }));
  }

  /** Recent ratings and comments (approved and pending) for AI diagnostics. */
  feedbackForProduct(productId: string, take: number) {
    return this.db.review.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { rating: true, title: true, comment: true, isApproved: true, createdAt: true },
    });
  }
}
