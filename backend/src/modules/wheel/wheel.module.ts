import { Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { WheelController } from './wheel.controller.js';
import { WheelService } from './wheel.service.js';

/** Prize wheel: visitors spin once per round and win a single-use coupon. */
@Module({
  imports: [CouponsModule, SettingsModule],
  controllers: [WheelController],
  providers: [WheelService],
})
export class WheelModule {}
