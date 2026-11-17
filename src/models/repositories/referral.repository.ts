import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { ReferralEntity } from '../schemas/referral.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class ReferralRepository extends BaseRepository<
  ReferralEntity,
  Prisma.ReferralWhereInput,
  Prisma.ReferralWhereUniqueInput,
  Prisma.ReferralUncheckedCreateInput,
  Prisma.ReferralUncheckedUpdateInput,
  Prisma.ReferralOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.referral;
  }

  findForReferrer(referrerId: string) {
    return this.db.referral.findMany({
      where: { referrerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rewardGranted: true,
        createdAt: true,
        referredUser: { select: { firstName: true, lastName: true } },
      },
    });
  }

  findByReferred(referredUserId: string): Promise<ReferralEntity | null> {
    return this.db.referral.findUnique({ where: { referredUserId } });
  }

  /** Flips rewardGranted once. False when another request already rewarded it. */
  async markRewarded(id: string): Promise<boolean> {
    const { count } = await this.db.referral.updateMany({ where: { id, rewardGranted: false }, data: { rewardGranted: true } });
    return count === 1;
  }
}
