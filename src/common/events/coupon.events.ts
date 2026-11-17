export interface CouponCampaignRecipient {
  email: string;
  firstName?: string;
}

/** 6.4: promotional coupon email to many recipients (sent in the background). */
export class CouponCampaignEvent {
  constructor(
    readonly code: string,
    readonly discountLabel: { ar: string; en: string },
    readonly expiresAt: Date,
    readonly recipients: CouponCampaignRecipient[],
    readonly note?: string,
    /** Sent to newsletter subscribers: add an unsubscribe link */
    readonly newsletter = false,
  ) {}
}
