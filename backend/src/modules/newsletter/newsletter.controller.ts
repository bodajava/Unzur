import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Audit, Public, RateLimit, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { SubscribeDto, SubscriberQueryDto, UnsubscribeDto, UnsubscribeQueryDto } from './dto/index.js';
import { NewsletterService } from './newsletter.service.js';

export const SUBSCRIBE_LIMIT = { limit: 5, windowSeconds: 3600 };
const UNSUBSCRIBE_LIMIT = { limit: 30, windowSeconds: 3600 };

@Controller('newsletter')
export class NewsletterController {
  private readonly frontendUrl: string;

  constructor(
    private readonly newsletter: NewsletterService,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
  }

  /** 7.1 */
  @Public()
  @RateLimit(SUBSCRIBE_LIMIT)
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Subscribed')
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletter.subscribe(dto.email);
  }

  /** One-click link from emails: unsubscribes, then shows the frontend result page. */
  @Public()
  @RateLimit(UNSUBSCRIBE_LIMIT)
  @Get('unsubscribe')
  async unsubscribeLink(@Query() query: UnsubscribeQueryDto, @Res() res: Response) {
    let status = 'success';
    try {
      await this.newsletter.unsubscribe(query.token);
    } catch {
      status = 'invalid';
    }
    res.redirect(HttpStatus.FOUND, `${this.frontendUrl}/newsletter/unsubscribed?status=${status}`);
  }

  /** JSON / RFC 8058 one-click POST (token in body or in the link). */
  @Public()
  @RateLimit(UNSUBSCRIBE_LIMIT)
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('You have been unsubscribed')
  unsubscribe(@Body() dto: UnsubscribeDto, @Query() query: UnsubscribeQueryDto) {
    return this.newsletter.unsubscribe(dto.token ?? query.token);
  }

  /** 7.2 */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Get('subscribers')
  list(@Query() query: SubscriberQueryDto) {
    return this.newsletter.list(query);
  }

  /** 7.3 */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete('subscribers/:id')
  @ResponseMessage('Subscriber removed')
  remove(@Param('id', ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.newsletter.remove(id, audit);
  }
}
