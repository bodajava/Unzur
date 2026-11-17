import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AiGatewayClient } from './ai-gateway.client.js';
import { AiController } from './ai.controller.js';
import { AiResolver } from './ai.resolver.js';
import { AiService } from './ai.service.js';
import { StoreIntelligenceService } from './store-intelligence.service.js';

@Module({
  imports: [AnalyticsModule, SettingsModule],
  controllers: [AiController],
  providers: [AiService, StoreIntelligenceService, AiGatewayClient, AiResolver],
})
export class AiModule {}
