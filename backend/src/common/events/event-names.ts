/** All in-app event names. Listeners live in the feature modules. */
export const AppEvents = {
  AUTH_OTP_REQUESTED: 'auth.otp.requested',
  USER_REGISTERED: 'user.registered',
  USER_EMAIL_VERIFIED: 'user.email_verified',
  STAFF_CREATED: 'staff.created',
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  COUPON_CAMPAIGN_REQUESTED: 'coupon.campaign_requested',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  GIFT_CARD_PURCHASED: 'gift_card.purchased',
  GIFT_CARD_ISSUED: 'gift_card.issued',
  NEWSLETTER_SUBSCRIBED: 'newsletter.subscribed',
  CONTACT_MESSAGE_RECEIVED: 'contact.message_received',
  /** An unexpected server error (500) was answered; payload: ServerErrorEvent. */
  SERVER_ERROR: 'server.error',
  /** Something the team must act on (spend limit, late payment to refund); payload: OpsAlertEvent. */
  OPS_ALERT: 'ops.alert',
} as const;

export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];
