import { Injectable } from '@nestjs/common';
import { GiftCardRepository } from '../../models/repositories/gift-card.repository.js';
import type { GiftCardPreviewModel } from './entities/gift-card.model.js';
import { giftCardProblem, normalizeGiftCardCode } from './gift-card-rules.js';

@Injectable()
export class GiftCardsService {
  constructor(private readonly giftCards: GiftCardRepository) {}

  /**
   * 18.2 Read-only check for the checkout page. The balance is only taken at
   * checkout (4.1), inside the order transaction.
   */
  async preview(rawCode: string): Promise<GiftCardPreviewModel> {
    const code = normalizeGiftCardCode(rawCode);
    const card = await this.giftCards.findByCode(code);
    const problem = giftCardProblem(card);
    // Unknown/disabled cards reveal nothing (no balance, no expiry).
    if (!card?.isActive) {
      return { code, isValid: false, currentBalance: 0, expiresAt: null, message: problem };
    }
    return {
      code,
      isValid: problem === null,
      currentBalance: card.currentBalance,
      expiresAt: card.expiresAt,
      message: problem,
    };
  }
}
