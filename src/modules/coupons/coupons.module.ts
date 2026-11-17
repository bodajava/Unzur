import { Module } from '@nestjs/common';
import { CouponEvaluator } from './coupon-evaluator.service.js';
import { CouponsController } from './coupons.controller.js';
import { CouponsListener } from './coupons.listener.js';
import { CouponsResolver } from './coupons.resolver.js';
import { CouponsService } from './coupons.service.js';

@Module({
  controllers: [CouponsController],
  providers: [CouponsService, CouponEvaluator, CouponsResolver, CouponsListener],
  exports: [CouponEvaluator],
})
export class CouponsModule {}
