export class NewsletterSubscribedEvent {
  constructor(readonly email: string) {}
}

export class ContactMessageReceivedEvent {
  constructor(readonly messageId: string) {}
}

/** Admin-issued gift card that should be emailed (18.3). */
export class GiftCardIssuedEvent {
  constructor(readonly giftCardId: string) {}
}
