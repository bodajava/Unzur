import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvents, NewsletterSubscribedEvent } from '../../common/events/index.js';
import { runInBackground } from '../../common/utilities/background.js';
import { NewsletterTokenService } from '../../common/services/security/newsletter-token.service.js';
import { EmailService } from '../../common/utilities/email/email.service.js';

@Injectable()
export class NewsletterListener {
  constructor(
    private readonly email: EmailService,
    private readonly tokens: NewsletterTokenService,
  ) {}

  @OnEvent(AppEvents.NEWSLETTER_SUBSCRIBED)
  onSubscribed(event: NewsletterSubscribedEvent): void {
    runInBackground('newsletter-welcome', () =>
      this.email.sendNewsletterWelcome(event.email, this.tokens.unsubscribeUrl(event.email)),
    );
  }
}
