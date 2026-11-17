import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Audit, CurrentUser, Public, RateLimit, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { AdminReviewQueryDto, CreateReviewDto, ModerateReviewDto } from './dto/index.js';
import { ReviewsService } from './reviews.service.js';

const STAFF = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] as const;

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** 12.1 */
  @Public()
  @Get('products/:id/reviews')
  list(@Param('id', ParseIdPipe) productId: string, @Query() query: PaginationQueryDto) {
    return this.reviews.forProduct(productId, query.page, query.limit);
  }

  /** 12.2 */
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Post('products/:id/reviews')
  @ResponseMessage('Thanks! Your review will appear after approval.')
  create(@CurrentUser('id') userId: string, @Param('id', ParseIdPipe) productId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(userId, productId, dto);
  }

  /** 12.3 Pending first. */
  @Roles(...STAFF)
  @Get('admin/reviews')
  adminList(@Query() query: AdminReviewQueryDto) {
    return this.reviews.adminList(query);
  }

  /** 12.4 */
  @Roles(...STAFF)
  @Patch('admin/reviews/:id')
  @ResponseMessage('Review updated')
  moderate(@Param('id', ParseIdPipe) id: string, @Body() dto: ModerateReviewDto, @Audit() audit: AuditContext) {
    return this.reviews.moderate(id, dto.isApproved, audit);
  }
}
