import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  type RawBodyRequest,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/index.js';
import type { AppRequest } from '../../common/interfaces/request.interface.js';
import { WhatsAppService } from './whatsapp.service.js';

/** 20.4 Meta WhatsApp webhook. */
@Public()
@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  /** Subscription check: answers with the raw hub.challenge (plain text). */
  @Get()
  verify(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const challenge = this.whatsapp.verifySubscription(query['hub.mode'], query['hub.verify_token'], query['hub.challenge']);
    if (challenge === null) {
      res.status(HttpStatus.FORBIDDEN).type('text/plain').send('Forbidden');
      return;
    }
    res.status(HttpStatus.OK).type('text/plain').send(challenge);
  }

  /** Delivery/read receipts. Signed with X-Hub-Signature-256 when WHATSAPP_APP_SECRET is set. */
  @Post()
  @HttpCode(HttpStatus.OK)
  receive(
    @Req() req: RawBodyRequest<AppRequest>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    if (!this.whatsapp.verifySignature(req.rawBody, signature)) throw new UnauthorizedException('Invalid signature');
    return { received: true, ...this.whatsapp.handleEvent(body) };
  }
}
