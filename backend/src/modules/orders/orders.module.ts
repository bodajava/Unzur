import { Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ShippingModule } from '../shipping/shipping.module.js';
import { WhatsAppModule } from '../whatsapp/whatsapp.module.js';
import { CheckoutService } from './checkout.service.js';
import { OrderClaimsService } from './order-claims.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersListener } from './orders.listener.js';
import { OrdersResolver } from './orders.resolver.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [CouponsModule, ShippingModule, SettingsModule, PaymentsModule, WhatsAppModule],
  controllers: [OrdersController],
  providers: [OrdersService, CheckoutService, OrderClaimsService, OrdersResolver, OrdersListener],
  exports: [OrdersService, CheckoutService, OrderClaimsService],
})
export class OrdersModule {}
