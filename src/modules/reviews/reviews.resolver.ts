import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, Public, RateLimit } from '../../common/decorators/index.js';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../../common/dto/pagination-query.dto.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { CreateReviewDto } from './dto/index.js';
import { ProductReviewsModel, SubmittedReviewModel } from './entities/review.model.js';
import { ReviewsService } from './reviews.service.js';

const clamp = (n: number | undefined, fallback: number, max: number) => Math.min(Math.max(Math.trunc(n ?? fallback), 1), max);

@Resolver(() => ProductReviewsModel)
export class ReviewsResolver {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Query(() => ProductReviewsModel, { description: '12.1 Approved reviews + rating summary' })
  productReviews(
    @Args('productId', { type: () => ID }, ParseIdPipe) productId: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.reviews.forProduct(productId, clamp(page, 1, 1_000_000), clamp(limit, DEFAULT_LIMIT, MAX_LIMIT));
  }

  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Mutation(() => SubmittedReviewModel, { description: '12.2 Verified buyers only' })
  createReview(
    @CurrentUser('id') userId: string,
    @Args('productId', { type: () => ID }, ParseIdPipe) productId: string,
    @Args('input') input: CreateReviewDto,
  ) {
    return this.reviews.create(userId, productId, input);
  }
}
