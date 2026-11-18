import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AutomationController } from './automation.controller.js';
import { AutomationService } from './automation.service.js';

/** 20.1–20.3 scheduled jobs (ScheduleModule.forRoot() is in AppModule). */
@Module({
  imports: [OrdersModule, SettingsModule],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
