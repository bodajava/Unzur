import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller.js';
import { WishlistResolver } from './wishlist.resolver.js';
import { WishlistService } from './wishlist.service.js';

@Module({
  controllers: [WishlistController],
  providers: [WishlistService, WishlistResolver],
})
export class WishlistModule {}
