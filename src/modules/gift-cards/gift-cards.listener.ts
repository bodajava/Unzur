import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvents, GiftCardIssuedEvent, GiftCardPurchasedEvent } from '../../common/events/index.js';
import { runInBackground } from '../../common/utilities/background.js';
import { EmailService } from '../../common/utilities/email/email.service.js';
import { GiftCardRepository } from '../../models/repositories/gift-card.repository.js';
import { UserRepository } from '../../models/repositories/user.repository.js';

/** Emails the code once a card is paid (18.1) or issued by an admin (18.3). */
@Injectable()
export class GiftCardsListener {
  constructor(
    private readonly email: EmailService,
    private readonly giftCards: GiftCardRepository,
    private readonly users: UserRepository,
  ) {}

  @OnEvent(AppEvents.GIFT_CARD_PURCHASED)
  onPurchased(event: GiftCardPurchasedEvent): void {
    this.send(event.giftCardId);
  }

  @OnEvent(AppEvents.GIFT_CARD_ISSUED)
  onIssued(event: GiftCardIssuedEvent): void {
    this.send(event.giftCardId);
  }

  private send(giftCardId: string): void {
    runInBackground('gift-card-email', async () => {
      const card = await this.giftCards.findById(giftCardId);
      if (!card?.isActive) return;
      const buyer = card.purchasedById ? await this.users.findById(card.purchasedById) : null;
      const to = card.recipientEmail ?? buyer?.email;
      if (!to) return;
      await this.email.sendGiftCardEmail(to, {
        code: card.code,
        amountPiasters: card.initialBalance,
        expiresAt: card.expiresAt,
        message: card.message,
        fromName: buyer && to !== buyer.email ? buyer.firstName : null,
      });
    });
  }
}
