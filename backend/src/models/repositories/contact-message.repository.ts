import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { ContactMessageEntity } from '../schemas/contact-message.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class ContactMessageRepository extends BaseRepository<
  ContactMessageEntity,
  Prisma.ContactMessageWhereInput,
  Prisma.ContactMessageWhereUniqueInput,
  Prisma.ContactMessageUncheckedCreateInput,
  Prisma.ContactMessageUncheckedUpdateInput,
  Prisma.ContactMessageOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.contactMessage;
  }

  /** Unread first, newest first. */
  async paginateInbox(where: Prisma.ContactMessageWhereInput, page: number, limit: number): Promise<Paginated<ContactMessageEntity>> {
    const [items, total] = await Promise.all([
      this.db.contactMessage.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.contactMessage.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }
}
