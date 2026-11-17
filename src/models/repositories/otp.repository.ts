import { Injectable } from '@nestjs/common';
import type { Otp, Prisma } from '../../generated/prisma/client.js';
import type { OtpType } from '../../generated/prisma/enums.js';
import type { DbClient } from '../prisma.service.js';
import type { OtpEntity } from '../schemas/otp.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class OtpRepository extends BaseRepository<
  OtpEntity,
  Prisma.OtpWhereInput,
  Prisma.OtpWhereUniqueInput,
  Prisma.OtpUncheckedCreateInput,
  Prisma.OtpUncheckedUpdateInput,
  Prisma.OtpOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.otp;
  }

  /** Marks every unused code of this type as used (a new one replaces them). */
  async invalidateActive(email: string, type: OtpType): Promise<number> {
    const { count } = await this.db.otp.updateMany({
      where: { email, type, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count;
  }

  /** Latest unused, unexpired code incl. codeHash (opt-in). */
  findLatestActiveWithHash(email: string, type: OtpType): Promise<Otp | null> {
    return this.db.otp.findFirst({
      where: { email, type, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      omit: { codeHash: false },
    });
  }

  /** Atomic consume. Returns false if it was used concurrently. */
  async consume(id: string): Promise<boolean> {
    const { count } = await this.db.otp.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1;
  }
}
