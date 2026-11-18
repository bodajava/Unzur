import type { GiftCardEntity } from '../../models/schemas/gift-card.schema.js';

export const normalizeGiftCardCode = (code: string): string => code.trim().toUpperCase();

/** Why a gift card cannot be used now, or null when it can. */
export function giftCardProblem(card: GiftCardEntity | null, now = new Date()): string | null {
  if (!card?.isActive) return 'Invalid gift card code';
  if (card.expiresAt && card.expiresAt < now) return 'This gift card has expired';
  if (card.currentBalance <= 0) return 'This gift card has no balance left';
  return null;
}
