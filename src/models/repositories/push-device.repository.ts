import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { PushDeviceEntity } from '../schemas/push-device.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class PushDeviceRepository extends BaseRepository<
  PushDeviceEntity,
  Prisma.PushDeviceWhereInput,
  Prisma.PushDeviceWhereUniqueInput,
  Prisma.PushDeviceUncheckedCreateInput,
  Prisma.PushDeviceUncheckedUpdateInput,
  Prisma.PushDeviceOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.pushDevice;
  }

  /** One row per browser token: re-registering moves it to the current person. */
  register(data: { token: string; userId: string | null; guestId: string | null; isStaff: boolean; lang: string }) {
    return this.db.pushDevice.upsert({ where: { token: data.token }, create: data, update: data });
  }

  /** Tokens of every staff browser (store alerts). */
  staffTokens(): Promise<{ token: string; lang: string }[]> {
    return this.db.pushDevice.findMany({ where: { isStaff: true }, select: { token: true, lang: true } });
  }

  /** Tokens of the person who placed an order: their account, or the guest session they used. */
  customerTokens(who: { userId: string | null; guestId: string | null }): Promise<{ token: string; lang: string }[]> {
    const or: Prisma.PushDeviceWhereInput[] = [];
    if (who.userId) or.push({ userId: who.userId });
    if (who.guestId) or.push({ guestId: who.guestId });
    if (!or.length) return Promise.resolve([]);
    return this.db.pushDevice.findMany({ where: { isStaff: false, OR: or }, select: { token: true, lang: true } });
  }

  async removeTokens(tokens: string[]): Promise<number> {
    if (!tokens.length) return 0;
    return this.deleteMany({ token: { in: tokens } });
  }
}
