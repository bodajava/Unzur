import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { createMulterMemoryOptions } from '../../common/utilities/multer/multer.config.js';
import { Audit, CurrentUser, Public, RateLimit, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { AdminReviewQueryDto, CreateReviewDto, ModerateReviewDto } from './dto/index.js';
import { MAX_REVIEW_IMAGES, ReviewsService } from './reviews.service.js';

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

  /** 12.2 JSON, or multipart/form-data with up to 4 photos in `images`. */
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Post('products/:id/reviews')
  @UseInterceptors(FilesInterceptor('images', MAX_REVIEW_IMAGES, createMulterMemoryOptions({ maxFiles: MAX_REVIEW_IMAGES })))
  @ResponseMessage('Thanks for your review!')
  create(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIdPipe) productId: string,
    @Body() dto: CreateReviewDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.reviews.create(userId, productId, dto, files ?? []);
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
