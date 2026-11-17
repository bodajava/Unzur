import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { SubscriberEntity } from '../schemas/subscriber.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class SubscriberRepository extends BaseRepository<
  SubscriberEntity,
  Prisma.SubscriberWhereInput,
  Prisma.SubscriberWhereUniqueInput,
  Prisma.SubscriberUncheckedCreateInput,
  Prisma.SubscriberUncheckedUpdateInput,
  Prisma.SubscriberOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.subscriber;
  }

  async findActiveEmails(): Promise<string[]> {
    const rows = await this.db.subscriber.findMany({ where: { isActive: true }, select: { email: true } });
    return rows.map((r) => r.email);
  }

  findByEmail(email: string): Promise<SubscriberEntity | null> {
    return this.db.subscriber.findUnique({ where: { email } });
  }

  async paginateAdmin(where: Prisma.SubscriberWhereInput, page: number, limit: number): Promise<Paginated<SubscriberEntity>> {
    const [items, total] = await Promise.all([
      this.db.subscriber.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.db.subscriber.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }
}
