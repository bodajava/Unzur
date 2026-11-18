import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymobGatewayClient } from './paymob/paymob-gateway.client.js';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymobGatewayClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
