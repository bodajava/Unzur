import { Module } from '@nestjs/common';
import { AdminSettingsController, SettingsController } from './settings.controller.js';
import { SettingsResolver } from './settings.resolver.js';
import { SettingsService } from './settings.service.js';

@Module({
  controllers: [SettingsController, AdminSettingsController],
  providers: [SettingsService, SettingsResolver],
  exports: [SettingsService],
})
export class SettingsModule {}
