import { Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module.js';
import { CartController } from './cart.controller.js';
import { CartResolver } from './cart.resolver.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [CouponsModule],
  controllers: [CartController],
  providers: [CartService, CartResolver],
  exports: [CartService],
})
export class CartModule {}
