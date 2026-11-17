import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import {
  USER_AUTH_SELECT,
  USER_PROFILE_SELECT,
  type UserAuthState,
  type UserEntity,
  type UserProfile,
  type UserWithPassword,
} from '../schemas/user.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class UserRepository extends BaseRepository<
  UserEntity,
  Prisma.UserWhereInput,
  Prisma.UserWhereUniqueInput,
  Prisma.UserUncheckedCreateInput,
  Prisma.UserUncheckedUpdateInput,
  Prisma.UserOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.user;
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  /** The only query that reads passwordHash. */
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    return this.db.user.findUnique({ where: { email }, omit: { passwordHash: false } });
  }

  /** With passwordHash: only for the change-password check. */
  findByIdWithPassword(id: string): Promise<UserWithPassword | null> {
    return this.db.user.findUnique({ where: { id }, omit: { passwordHash: false } });
  }

  async phoneTakenByOther(phone: string, userId: string): Promise<boolean> {
    const row = await this.db.user.findFirst({ where: { phone, id: { not: userId } }, select: { id: true } });
    return !!row;
  }

  updateProfile(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<UserProfile> {
    return this.db.user.update({ where: { id }, data, select: USER_PROFILE_SELECT });
  }

  /** SELECT ... FOR UPDATE on the user row: serializes per-user changes (e.g. default address). */
  async lockForUpdate(id: string): Promise<void> {
    await this.db.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
  }

  findByReferralCode(referralCode: string): Promise<UserEntity | null> {
    return this.db.user.findUnique({ where: { referralCode } });
  }

  findProfile(id: string): Promise<UserProfile | null> {
    return this.db.user.findUnique({ where: { id }, select: USER_PROFILE_SELECT });
  }

  findAuthState(id: string): Promise<UserAuthState | null> {
    return this.db.user.findUnique({ where: { id }, select: USER_AUTH_SELECT });
  }

  createWithProfile(data: Prisma.UserUncheckedCreateInput): Promise<UserProfile> {
    return this.db.user.create({ data, select: USER_PROFILE_SELECT });
  }

  async emailExists(email: string): Promise<boolean> {
    return !!(await this.db.user.findUnique({ where: { email }, select: { id: true } }));
  }

  async referralCodeExists(referralCode: string): Promise<boolean> {
    return !!(await this.db.user.findUnique({ where: { referralCode }, select: { id: true } }));
  }

  /** Verified, active customers (for promotional emails). */
  findCustomerRecipients(): Promise<{ email: string; firstName: string }[]> {
    return this.db.user.findMany({
      where: { role: 'CUSTOMER', isActive: true, isEmailVerified: true },
      select: { email: true, firstName: true },
    });
  }

  async loyaltyPoints(id: string): Promise<number> {
    const row = await this.db.user.findUnique({ where: { id }, select: { loyaltyPoints: true } });
    return row?.loyaltyPoints ?? 0;
  }

  /** Takes points only if the user still has them. False = not enough points. */
  async debitLoyalty(id: string, points: number): Promise<boolean> {
    const { count } = await this.db.user.updateMany({
      where: { id, loyaltyPoints: { gte: points } },
      data: { loyaltyPoints: { decrement: points } },
    });
    return count === 1;
  }

  /** Adds points (negative = remove, never below 0). */
  async adjustLoyalty(id: string, points: number): Promise<void> {
    if (points >= 0) {
      await this.db.user.update({ where: { id }, data: { loyaltyPoints: { increment: points } } });
    } else {
      await this.db.$executeRaw`
        UPDATE users SET loyalty_points = GREATEST(loyalty_points + ${points}, 0), updated_at = now()
        WHERE id = ${id}::uuid`;
    }
  }

  /** Sets referredById only if it is still empty (one referrer per user). */
  async setReferrerIfNone(id: string, referrerId: string): Promise<boolean> {
    const { count } = await this.db.user.updateMany({ where: { id, referredById: null }, data: { referredById: referrerId } });
    return count === 1;
  }
}
