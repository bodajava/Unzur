import type { RefreshToken, User } from '../../generated/prisma/client.js';

export type { RefreshToken };

/** Row shape returned by default queries (secret hash omitted). */
export type RefreshTokenEntity = Omit<RefreshToken, 'tokenHash'>;

export type RefreshTokenWithUser = RefreshToken & {
  user: { id: string; email: string; role: User['role']; isActive: boolean };
};
