import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsListener } from './notifications.listener.js';

/** Push notifications: browsers register here; store events become messages. */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsListener],
})
export class NotificationsModule {}
