import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { LoyaltyController, ReferralsController } from './loyalty.controller.js';
import { LoyaltyListener } from './loyalty.listener.js';
import { LoyaltyResolver } from './loyalty.resolver.js';
import { LoyaltyService } from './loyalty.service.js';
import { ReferralsService } from './referrals.service.js';

/** 17.x loyalty points and referrals. */
@Module({
  imports: [SettingsModule],
  controllers: [LoyaltyController, ReferralsController],
  providers: [LoyaltyService, ReferralsService, LoyaltyResolver, LoyaltyListener],
})
export class LoyaltyModule {}
