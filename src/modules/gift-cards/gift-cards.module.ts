import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { GiftCardManagementService } from './gift-card-management.service.js';
import { AdminGiftCardsController, GiftCardsController } from './gift-cards.controller.js';
import { GiftCardsListener } from './gift-cards.listener.js';
import { GiftCardsResolver } from './gift-cards.resolver.js';
import { GiftCardsService } from './gift-cards.service.js';

@Module({
  imports: [PaymentsModule],
  controllers: [GiftCardsController, AdminGiftCardsController],
  providers: [GiftCardsService, GiftCardManagementService, GiftCardsResolver, GiftCardsListener],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
