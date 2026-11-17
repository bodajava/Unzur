import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminShippingZonesController, ShippingController } from './shipping.controller.js';
import { ShippingResolver } from './shipping.resolver.js';
import { ShippingService } from './shipping.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [ShippingController, AdminShippingZonesController],
  providers: [ShippingService, ShippingResolver],
  exports: [ShippingService],
})
export class ShippingModule {}
