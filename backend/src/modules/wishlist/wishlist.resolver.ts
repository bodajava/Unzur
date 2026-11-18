import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../common/decorators/index.js';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../../common/dto/pagination-query.dto.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { WishlistChangeModel, WishlistItemModel, WishlistPageModel } from './entities/wishlist.model.js';
import { WishlistService } from './wishlist.service.js';

const clamp = (n: number | undefined, fallback: number, max: number) => Math.min(Math.max(Math.trunc(n ?? fallback), 1), max);

@Resolver(() => WishlistItemModel)
export class WishlistResolver {
  constructor(private readonly wishlist: WishlistService) {}

  @Query(() => WishlistPageModel, { description: '11.1' })
  myWishlist(
    @CurrentUser('id') userId: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.wishlist.list(userId, clamp(page, 1, 1_000_000), clamp(limit, DEFAULT_LIMIT, MAX_LIMIT));
  }

  @Mutation(() => WishlistChangeModel, { description: '11.2' })
  addToWishlist(@CurrentUser('id') userId: string, @Args('productId', { type: () => ID }, ParseIdPipe) productId: string) {
    return this.wishlist.add(userId, productId);
  }

  @Mutation(() => WishlistChangeModel, { description: '11.3' })
  removeFromWishlist(
    @CurrentUser('id') userId: string,
    @Args('productId', { type: () => ID }, ParseIdPipe) productId: string,
  ) {
    return this.wishlist.remove(userId, productId);
  }
}
