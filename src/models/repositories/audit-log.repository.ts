import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import type { AuditLogEntity } from '../schemas/audit-log.schema.js';
import { BaseRepository } from './base.repository.js';

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
}

/** Dates and other non-JSON values become plain JSON. */
const toJson = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);

@Injectable()
export class AuditLogRepository extends BaseRepository<
  AuditLogEntity,
  Prisma.AuditLogWhereInput,
  Prisma.AuditLogWhereUniqueInput,
  Prisma.AuditLogUncheckedCreateInput,
  Prisma.AuditLogUncheckedUpdateInput,
  Prisma.AuditLogOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.auditLog;
  }

  record(entry: AuditEntry): Promise<AuditLogEntity> {
    return this.db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValues: toJson(entry.oldValues),
        newValues: toJson(entry.newValues),
        ipAddress: entry.ipAddress,
      },
    });
  }

  /** 19.2 Newest first, with who did it. */
  async paginateAdmin(where: Prisma.AuditLogWhereInput, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
      }),
      this.db.auditLog.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }
}
