import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  Audit,
  CurrentUser,
  Public,
  RateLimit,
  ResponseMessage,
  Roles,
} from '../../common/decorators/index.js';
import { PaymentMethod, UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { AuthUser } from '../../common/interfaces/auth.interface.js';
import { InitiatePaymentDto, OrderContactQueryDto, RefundPaymentDto } from './dto/index.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Payment methods the checkout can offer right now (online ones only when Paymob is set up for them). */
  @Public()
  @Get('methods')
  methods() {
    return {
      methods: [
        PaymentMethod.COD,
        ...([PaymentMethod.PAYMOB_CARD, PaymentMethod.PAYMOB_WALLET] as const).filter((m) => this.payments.isOnlinePaymentAvailable(m)),
      ],
    };
  }

  /** 5.1 Start (or retry) an online payment for a PENDING_PAYMENT order. */
  @Public()
  @RateLimit({ limit: 10, windowSeconds: 60 })
  @Post('paymob/initiate')
  @ResponseMessage('Redirect the customer to checkoutUrl')
  initiate(@Body() dto: InitiatePaymentDto, @CurrentUser() user?: AuthUser) {
    return this.payments.initiate(dto, user);
  }

  /**
   * 5.2 Paymob "transaction processed" callback. Authenticated by the HMAC
   * query param only (401 when missing or wrong). 200 for duplicates.
   */
  @Public()
  @Post('paymob/webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Query('hmac') hmac: unknown, @Body() body: unknown) {
    return this.payments.handleWebhook(hmac, body);
  }

  /** 5.3 Browser redirect after paying -> frontend result page. Does not change payment state. */
  @Public()
  @Get('paymob/callback')
  async callback(@Query() query: Record<string, unknown>, @Res() res: Response) {
    res.redirect(HttpStatus.FOUND, await this.payments.callbackRedirectUrl(query));
  }

  /** 5.4 By order id or order number. Guests pass ?contact=<email|phone>. */
  @Public()
  @RateLimit({ limit: 30, windowSeconds: 60 })
  @Get('order/:orderReference')
  status(
    @Param('orderReference') reference: string,
    @Query() query: OrderContactQueryDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.payments.statusForOrder(reference, user, query.contact);
  }

  /** 5.5 */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('paymob/refund')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Refund sent to Paymob')
  refund(@Body() dto: RefundPaymentDto, @Audit() audit: AuditContext) {
    return this.payments.refundFromRequest(dto, audit);
  }
}
