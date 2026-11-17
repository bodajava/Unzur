import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvents, UserEmailVerifiedEvent } from '../../common/events/index.js';
import { runInBackground } from '../../common/utilities/background.js';
import { ReferralsService } from './referrals.service.js';

/** Rewards referral codes used at sign-up once the email is verified. */
@Injectable()
export class LoyaltyListener {
  constructor(private readonly referrals: ReferralsService) {}

  @OnEvent(AppEvents.USER_EMAIL_VERIFIED)
  onVerified(event: UserEmailVerifiedEvent): void {
    runInBackground('referral-reward', () => this.referrals.rewardOnVerification(event.userId));
  }
}
