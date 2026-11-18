import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { Audit, CurrentUser, Public, RateLimit, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { GiftCardManagementService } from './gift-card-management.service.js';
import { GiftCardQueryDto, IssueGiftCardDto, PurchaseGiftCardDto, RedeemGiftCardDto, UpdateGiftCardDto } from './dto/index.js';
import { GiftCardsService } from './gift-cards.service.js';

/** Limits gift-card code guessing. */
export const GIFT_CARD_CHECK_LIMIT = { limit: 10, windowSeconds: 60 };

@Controller('gift-cards')
export class GiftCardsController {
  constructor(
    private readonly giftCards: GiftCardsService,
    private readonly management: GiftCardManagementService,
  ) {}

  /** 18.1 Buy a gift card: returns a Paymob checkout URL; the code is emailed after payment. */
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Post()
  @ResponseMessage('Complete the payment to send the gift card')
  purchase(@CurrentUser('id') userId: string, @Body() dto: PurchaseGiftCardDto) {
    return this.management.purchase(userId, dto);
  }

  /** Gift cards I bought (codes visible once paid). */
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.management.mine(userId);
  }

  /** 18.2 Validate a code and show its balance (does not spend it). */
  @Public()
  @RateLimit(GIFT_CARD_CHECK_LIMIT)
  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  redeem(@Body() dto: RedeemGiftCardDto) {
    return this.giftCards.preview(dto.code);
  }
}

/** 18.3 */
@Controller('admin/gift-cards')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminGiftCardsController {
  constructor(private readonly management: GiftCardManagementService) {}

  @Get()
  list(@Query() query: GiftCardQueryDto) {
    return this.management.list(query);
  }

  @Post()
  @ResponseMessage('Gift card issued')
  issue(@Body() dto: IssueGiftCardDto, @Audit() audit: AuditContext) {
    return this.management.issue(dto, audit);
  }

  @Patch(':id')
  @ResponseMessage('Gift card updated')
  update(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateGiftCardDto, @Audit() audit: AuditContext) {
    return this.management.update(id, dto, audit);
  }
}
