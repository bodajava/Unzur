import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Lang, OtpType } from '../../common/enums/index.js';
import { AppEvents, OtpRequestedEvent } from '../../common/events/index.js';
import { runInBackground } from '../../common/utilities/background.js';
import { EmailService } from '../../common/utilities/email/email.service.js';

/** Auth side effects. Requests never wait for emails. */
@Injectable()
export class AuthListener {
  constructor(private readonly email: EmailService) {}

  @OnEvent(AppEvents.AUTH_OTP_REQUESTED)
  onOtpRequested(event: OtpRequestedEvent): void {
    const lang = event.lang === Lang.AR ? Lang.AR : Lang.EN;
    runInBackground(`otp-email:${event.type}`, () =>
      event.type === OtpType.EMAIL_VERIFICATION
        ? this.email.sendVerificationOtp(event.email, event.firstName, event.code, lang)
        : this.email.sendPasswordResetOtp(event.email, event.firstName, event.code, lang),
    );
  }
}
