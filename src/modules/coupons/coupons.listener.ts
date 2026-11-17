import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvents, CouponCampaignEvent } from '../../common/events/index.js';
import { runInBackground } from '../../common/utilities/background.js';
import { NewsletterTokenService } from '../../common/services/security/newsletter-token.service.js';
import { EmailService } from '../../common/utilities/email/email.service.js';

/** Sends coupon campaign emails one by one, after the request has returned. */
@Injectable()
export class CouponsListener {
  private readonly logger = new Logger(CouponsListener.name);

  constructor(
    private readonly email: EmailService,
    private readonly tokens: NewsletterTokenService,
  ) {}

  @OnEvent(AppEvents.COUPON_CAMPAIGN_REQUESTED)
  onCampaign(event: CouponCampaignEvent): void {
    runInBackground(`coupon-campaign:${event.code}`, async () => {
      let sent = 0;
      for (const recipient of event.recipients) {
        try {
          await this.email.sendCouponEmail(recipient.email, {
            firstName: recipient.firstName,
            code: event.code,
            discount: event.discountLabel,
            expiresAt: event.expiresAt,
            note: event.note,
            unsubscribeUrl: event.newsletter ? this.tokens.unsubscribeUrl(recipient.email) : undefined,
          });
          sent++;
        } catch (error) {
          // One bad address must not stop the rest.
          this.logger.warn(`Coupon email to ${recipient.email} failed: ${(error as Error).message}`);
        }
      }
      this.logger.log(`Coupon ${event.code}: ${sent}/${event.recipients.length} emails sent`);
    });
  }
}
