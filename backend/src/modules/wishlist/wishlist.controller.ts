import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/index.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { AddToWishlistDto } from './dto/index.js';
import { WishlistService } from './wishlist.service.js';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  /** 11.1 */
  @Get()
  list(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.wishlist.list(userId, query.page, query.limit);
  }

  /** 11.2 201 when added, 200 when it was already there. */
  @Post()
  async add(
    @CurrentUser('id') userId: string,
    @Body() dto: AddToWishlistDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.wishlist.add(userId, dto.productId);
    if (!result.changed) res.status(200);
    return result;
  }

  /** 11.3 */
  @Delete(':productId')
  remove(@CurrentUser('id') userId: string, @Param('productId', ParseIdPipe) productId: string) {
    return this.wishlist.remove(userId, productId);
  }
}
