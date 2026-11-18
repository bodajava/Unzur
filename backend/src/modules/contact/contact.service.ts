import { nameFromEmail } from '../auth/auth.service.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvents, ContactMessageReceivedEvent } from '../../common/events/index.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { normalizePhone } from '../../common/utilities/phone.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { ContactMessageRepository } from '../../models/repositories/contact-message.repository.js';
import type { ContactMessageEntity } from '../../models/schemas/contact-message.schema.js';
import type { ContactQueryDto, CreateContactMessageDto, UpdateContactMessageDto } from './dto/index.js';
import type { ContactMessageReceiptModel } from './entities/contact.model.js';

@Injectable()
export class ContactService {
  constructor(
    private readonly messages: ContactMessageRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly events: EventEmitter2,
  ) {}

  /** 7.4 Saved, then the admin is emailed in the background. */
  async create(dto: CreateContactMessageDto): Promise<ContactMessageReceiptModel> {
    const message = await this.messages.create({
      name: dto.name || nameFromEmail(dto.email),
      email: dto.email,
      phone: dto.phone ? normalizePhone(dto.phone) : null,
      subject: dto.subject ?? null,
      message: dto.message,
    });
    this.events.emit(AppEvents.CONTACT_MESSAGE_RECEIVED, new ContactMessageReceivedEvent(message.id));
    return { id: message.id, received: true };
  }

  /** 7.5 */
  inbox(query: ContactQueryDto): Promise<Paginated<ContactMessageEntity>> {
    const search = query.search?.trim();
    return this.messages.paginateInbox(
      {
        ...(query.isRead === undefined ? {} : { isRead: query.isRead }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { message: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      query.page,
      query.limit,
    );
  }

  /** 7.6 */
  async update(id: string, dto: UpdateContactMessageDto): Promise<ContactMessageEntity> {
    if (dto.isRead === undefined && dto.replied === undefined) {
      throw new BadRequestException('Send isRead and/or replied');
    }
    if (!(await this.messages.findById(id))) throw new NotFoundException('Message not found');
    return this.messages.updateById(id, {
      ...(dto.isRead === undefined ? {} : { isRead: dto.isRead }),
      ...(dto.replied === true ? { repliedAt: new Date(), isRead: true } : {}),
      ...(dto.replied === false ? { repliedAt: null } : {}),
    });
  }

  /** 7.7 */
  async remove(id: string, audit: AuditContext): Promise<{ id: string; deleted: true }> {
    const message = await this.messages.findById(id);
    if (!message) throw new NotFoundException('Message not found');
    await this.messages.delete({ id });
    await this.auditLogs.record({
      ...audit,
      action: 'CONTACT_MESSAGE_DELETED',
      entityType: 'ContactMessage',
      entityId: id,
      oldValues: { email: message.email, subject: message.subject },
    });
    return { id, deleted: true };
  }
}
