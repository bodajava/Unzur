import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Push/in-app notifications.
 * Firebase Cloud Messaging is optional: set FIREBASE_PROJECT_ID (+ credentials)
 * and add a FCM sender here. Without it, notifications are logged.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly firebaseEnabled: boolean;

  constructor(config: ConfigService) {
    this.firebaseEnabled = !!config.get<string>('FIREBASE_PROJECT_ID');
  }

  get isPushEnabled(): boolean {
    return this.firebaseEnabled;
  }

  async notifyUser(userId: string, notification: PushNotification): Promise<void> {
    if (!this.firebaseEnabled) {
      this.logger.log(`[notify] user=${userId} "${notification.title}"`);
      return;
    }
    // FCM sender goes here once Firebase credentials are provided.
    this.logger.warn('Firebase configured but FCM sender not installed yet');
  }

  async notifyAdmins(notification: PushNotification): Promise<void> {
    this.logger.log(`[notify] admins "${notification.title}"`);
  }
}
