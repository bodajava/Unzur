import { Module } from '@nestjs/common';
import { ErrorAlertsListener } from './error-alerts.listener.js';

/** Error tracking: emails the team about unexpected server errors (see ErrorAlertsListener). */
@Module({
  providers: [ErrorAlertsListener],
})
export class MonitoringModule {}
