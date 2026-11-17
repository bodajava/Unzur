import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvents, ContactMessageReceivedEvent } from '../../common/events/index.js';
import { runInBackground } from '../../common/utilities/background.js';
import { EmailService } from '../../common/utilities/email/email.service.js';
import { ContactMessageRepository } from '../../models/repositories/contact-message.repository.js';
import { SettingKey } from '../settings/setting-rules.js';
import { SettingsService } from '../settings/settings.service.js';

/** Emails the store admin about a new contact message. */
@Injectable()
export class ContactListener {
  private readonly logger = new Logger(ContactListener.name);

  constructor(
    private readonly email: EmailService,
    private readonly messages: ContactMessageRepository,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent(AppEvents.CONTACT_MESSAGE_RECEIVED)
  onMessage(event: ContactMessageReceivedEvent): void {
    runInBackground('contact-notification', async () => {
      const to = (await this.settings.getString(SettingKey.ADMIN_EMAIL)) ?? this.config.get<string>('SMTP_USER');
      if (!to) {
        this.logger.warn('No admin_email setting or SMTP_USER: contact notification not sent');
        return;
      }
      const message = await this.messages.findById(event.messageId);
      if (message) await this.email.sendContactNotification(to, message);
    });
  }
}
