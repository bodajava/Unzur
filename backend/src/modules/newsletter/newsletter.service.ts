import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvents, NewsletterSubscribedEvent } from '../../common/events/index.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { MxValidatorService } from '../../common/services/mx/mx-validator.service.js';
import { NewsletterTokenService } from '../../common/services/security/newsletter-token.service.js';
import { isUniqueViolation } from '../../models/prisma-errors.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { SubscriberRepository } from '../../models/repositories/subscriber.repository.js';
import type { SubscriberEntity } from '../../models/schemas/subscriber.schema.js';
import type { SubscriberQueryDto } from './dto/index.js';
import type { NewsletterSubscriptionModel } from './entities/newsletter.model.js';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly subscribers: SubscriberRepository,
    private readonly mx: MxValidatorService,
    private readonly auditLogs: AuditLogRepository,
    private readonly events: EventEmitter2,
    private readonly tokens: NewsletterTokenService,
  ) {}

  /** 7.1 Idempotent; reactivates; welcome email only for new/returning subscribers. */
  async subscribe(email: string): Promise<NewsletterSubscriptionModel> {
    const existing = await this.subscribers.findByEmail(email);
    if (existing?.isActive) return { email, subscribed: true, result: 'ALREADY_SUBSCRIBED' };

    if ((await this.mx.check(email)) === 'invalid') {
      throw new BadRequestException('This email domain cannot receive email');
    }
    let result: string;
    if (existing) {
      await this.subscribers.updateById(existing.id, { isActive: true });
      result = 'REACTIVATED';
    } else {
      try {
        await this.subscribers.create({ email });
      } catch (error) {
        // Two submits at once: the other one created it.
        if (isUniqueViolation(error)) return { email, subscribed: true, result: 'ALREADY_SUBSCRIBED' };
        throw error;
      }
      result = 'CREATED';
    }
    this.events.emit(AppEvents.NEWSLETTER_SUBSCRIBED, new NewsletterSubscribedEvent(email));
    return { email, subscribed: true, result };
  }

  /**
   * Signed one-click unsubscribe. Same answer whether or not the address was
   * subscribed (the token already proves who it is for).
   */
  async unsubscribe(token: string | undefined): Promise<{ unsubscribed: true }> {
    const email = this.tokens.verify(token);
    if (!email) throw new BadRequestException('This unsubscribe link is invalid');
    const subscriber = await this.subscribers.findByEmail(email);
    if (subscriber?.isActive) await this.subscribers.updateById(subscriber.id, { isActive: false });
    return { unsubscribed: true };
  }

  /** 7.2 */
  list(query: SubscriberQueryDto): Promise<Paginated<SubscriberEntity>> {
    const search = query.search?.trim().toLowerCase();
    return this.subscribers.paginateAdmin(
      {
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
        ...(search ? { email: { contains: search } } : {}),
      },
      query.page,
      query.limit,
    );
  }

  /** 7.3 Deletes the row (the address can subscribe again later). */
  async remove(id: string, audit: AuditContext): Promise<{ id: string; deleted: true }> {
    const subscriber = await this.subscribers.findById(id);
    if (!subscriber) throw new NotFoundException('Subscriber not found');
    await this.subscribers.delete({ id });
    await this.auditLogs.record({
      ...audit,
      action: 'SUBSCRIBER_DELETED',
      entityType: 'Subscriber',
      entityId: id,
      oldValues: { email: subscriber.email, isActive: subscriber.isActive },
    });
    return { id, deleted: true };
  }
}
