import type { UserProfile } from '../../../models/schemas/user.schema.js';

export interface AuthTokens {
  tokenType: 'Bearer';
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResult extends AuthTokens {
  user: UserProfile;
}

export interface RegisterResult {
  user: UserProfile;
  requiresEmailVerification: true;
}

export type { GuestSession } from '../../../common/services/guest/guest-session.service.js';
