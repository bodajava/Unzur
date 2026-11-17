import { Injectable } from '@nestjs/common';
import { type DbClient, PrismaService } from '../prisma.service.js';

/**
 * Runs several repository calls atomically:
 *   await this.tx.run(async (tx) => {
 *     const user = await this.users.withTx(tx).create(...);
 *     await this.referrals.withTx(tx).create(...);
 *   });
 */
@Injectable()
export class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  /** `options` raises Prisma's 2s/5s defaults for work that may wait on row locks. */
  run<T>(fn: (tx: DbClient) => Promise<T>, options?: { maxWait?: number; timeout?: number }): Promise<T> {
    return this.prisma.$transaction((tx) => fn(tx as DbClient), options);
  }
}
