import type { UserRole } from '../enums/prisma.enums.js';
import type { Lang } from '../enums/http.enum.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  /** refresh_tokens.id */
  jti: string;
  type: 'refresh';
}

/** Attached to request.user by AuthMiddleware */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/** Who is acting: a logged-in user, a guest, or both */
export interface Actor {
  userId?: string;
  role?: UserRole;
  guestId?: string;
}

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
  lang: Lang;
}
