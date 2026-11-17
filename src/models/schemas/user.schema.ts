import type { Prisma, User } from '../../generated/prisma/client.js';

export type { User };

/** Row shape returned by default queries (secret hash omitted). */
export type UserEntity = Omit<User, 'passwordHash'>;

/** Public profile: never includes passwordHash. */
export const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  isEmailVerified: true,
  isActive: true,
  loyaltyPoints: true,
  referralCode: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type UserProfile = Prisma.UserGetPayload<{ select: typeof USER_PROFILE_SELECT }>;

/** Minimal auth state used by AuthMiddleware on every request. */
export const USER_AUTH_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
} as const satisfies Prisma.UserSelect;

export type UserAuthState = Prisma.UserGetPayload<{ select: typeof USER_AUTH_SELECT }>;

/** Includes passwordHash: only for credential checks, never returned to clients. */
export type UserWithPassword = User;
