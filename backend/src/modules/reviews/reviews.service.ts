import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { isUniqueViolation } from '../../models/prisma-errors.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { ReviewRepository } from '../../models/repositories/review.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { AdminReviewRow, PublicReviewRow, ReviewEntity } from '../../models/schemas/review.schema.js';
import { SettingKey } from '../settings/setting-rules.js';
import { SettingsService } from '../settings/settings.service.js';
import type { AdminReviewQueryDto, CreateReviewDto } from './dto/index.js';
import type { ProductReviewsModel, PublicReviewModel } from './entities/review.model.js';

export const NOT_PURCHASED = 'You can only review products you have purchased and received';

const reviewerName = (u: { firstName: string; lastName: string }) =>
  `${u.firstName}${u.lastName ? ` ${u.lastName.trim().charAt(0)}.` : ''}`;

function toPublic(row: PublicReviewRow): PublicReviewModel {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    reviewerName: reviewerName(row.user),
    verifiedPurchase: row.orderId !== null,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly products: ProductRepository,
    private readonly orders: OrderRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly settings: SettingsService,
  ) {}

  /** 12.1 */
  async forProduct(productId: string, page: number, limit: number): Promise<ProductReviewsModel> {
    if (!(await this.products.findPublicById(productId))) throw new NotFoundException('Product not found');
    const [list, summary, breakdown] = await Promise.all([
      this.reviews.paginateApproved(productId, page, limit),
      this.reviews.ratingSummary(productId),
      this.reviews.breakdown(productId),
    ]);
    return {
      items: list.items.map(toPublic),
      meta: list.meta,
      ratingSummary: { averageRating: summary.averageRating, totalReviews: summary.reviewCount, breakdown },
    };
  }

  /** 12.2 Verified buyers only, one review per product. */
  async create(userId: string, productId: string, dto: CreateReviewDto): Promise<ReviewEntity> {
    if (!(await this.products.findPublicById(productId))) throw new NotFoundException('Product not found');
    const order = await this.orders.findDeliveredWithProduct(userId, productId);
    if (!order) throw new ForbiddenException(NOT_PURCHASED);
    if (await this.reviews.existsForUser(userId, productId)) {
      throw new ConflictException('You already reviewed this product');
    }
    const autoApprove = await this.settings.getBool(SettingKey.AUTO_APPROVE_REVIEWS, false);
    try {
      return await this.reviews.create({
        productId,
        userId,
        orderId: order.id,
        rating: dto.rating,
        title: dto.title ?? null,
        comment: dto.comment ?? null,
        isApproved: autoApprove,
      });
    } catch (error) {
      // Double submit: the unique (user, product) index caught it.
      if (isUniqueViolation(error)) throw new ConflictException('You already reviewed this product');
      throw error;
    }
  }

  /** 12.3 */
  adminList(query: AdminReviewQueryDto): Promise<Paginated<AdminReviewRow>> {
    const search = query.search?.trim();
    return this.reviews.paginateAdmin(
      {
        ...(query.isApproved === undefined ? {} : { isApproved: query.isApproved }),
        ...(search
          ? {
              OR: [
                { comment: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      query.page,
      query.limit,
    );
  }

  /** 12.4 Approve (publish) or hide. */
  async moderate(id: string, isApproved: boolean, audit: AuditContext): Promise<ReviewEntity> {
    const review = await this.reviews.findById(id);
    if (!review) throw new NotFoundException('Review not found');
    return this.tx.run(async (tx) => {
      const updated = await this.reviews.withTx(tx).updateById(id, { isApproved });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: isApproved ? 'REVIEW_APPROVED' : 'REVIEW_HIDDEN',
        entityType: 'Review',
        entityId: id,
        oldValues: { isApproved: review.isApproved },
        newValues: { isApproved },
      });
      return updated;
    });
  }
}
