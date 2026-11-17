import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type {
  RefreshTokenEntity,
  RefreshTokenWithUser,
} from '../schemas/refresh-token.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class RefreshTokenRepository extends BaseRepository<
  RefreshTokenEntity,
  Prisma.RefreshTokenWhereInput,
  Prisma.RefreshTokenWhereUniqueInput,
  Prisma.RefreshTokenUncheckedCreateInput,
  Prisma.RefreshTokenUncheckedUpdateInput,
  Prisma.RefreshTokenOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.refreshToken;
  }

  /** Reads tokenHash (opt-in) plus the owner's auth state. */
  findByIdWithHash(id: string): Promise<RefreshTokenWithUser | null> {
    return this.db.refreshToken.findUnique({
      where: { id },
      omit: { tokenHash: false },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });
  }

  /** Atomic consume. Returns false if it was already revoked (race or reuse). */
  async revokeIfActive(id: string): Promise<boolean> {
    const { count } = await this.db.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count === 1;
  }

  async revokeMatching(where: { id: string; userId: string; tokenHash: string }): Promise<number> {
    const { count } = await this.db.refreshToken.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const { count } = await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }
}
