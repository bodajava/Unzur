import { Module } from '@nestjs/common';
import { AdminToolsController } from './admin-tools.controller.js';
import { AdminToolsResolver } from './admin-tools.resolver.js';
import { AdminToolsService } from './admin-tools.service.js';

/** 19.x */
@Module({
  controllers: [AdminToolsController],
  providers: [AdminToolsService, AdminToolsResolver],
})
export class AdminToolsModule {}
