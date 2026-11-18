import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Public, RateLimit } from '../../common/decorators/index.js';
import { RedeemGiftCardDto } from './dto/index.js';
import { GiftCardPreviewModel } from './entities/gift-card.model.js';
import { GIFT_CARD_CHECK_LIMIT } from './gift-cards.controller.js';
import { GiftCardsService } from './gift-cards.service.js';

@Resolver(() => GiftCardPreviewModel)
export class GiftCardsResolver {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Public()
  @RateLimit(GIFT_CARD_CHECK_LIMIT)
  @Mutation(() => GiftCardPreviewModel, { description: '18.2 Check a gift card before checkout' })
  redeemGiftCard(@Args('input') input: RedeemGiftCardDto) {
    return this.giftCards.preview(input.code);
  }
}
