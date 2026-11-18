import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestMeta } from '../../common/interfaces/auth.interface.js';
import { RandomService } from '../../common/services/security/random.service.js';
import { SecurityService } from '../../common/services/security/security.service.js';
import { TokenService } from '../../common/services/token/token.service.js';
import { RefreshTokenRepository } from '../../models/repositories/refresh-token.repository.js';
import type { UserEntity } from '../../models/schemas/user.schema.js';
import type { AuthTokens } from './entities/auth.entity.js';

type TokenUser = Pick<UserEntity, 'id' | 'email' | 'role'>;

/**
 * Login sessions: access JWT + rotating refresh JWT.
 * Refresh tokens are stored as SHA-256 hashes; presenting an already-rotated
 * token revokes every session of that user (theft detection).
 */
@Injectable()
export class AuthSessionService {
  constructor(
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly security: SecurityService,
    private readonly random: RandomService,
  ) {}

  async issue(user: TokenUser, meta: Partial<RequestMeta> = {}): Promise<AuthTokens> {
    const refreshId = this.random.uuid();
    const refresh = await this.tokens.signRefresh({ sub: user.id, jti: refreshId });

    await this.refreshTokens.create({
      id: refreshId,
      userId: user.id,
      tokenHash: this.security.sha256(refresh.token),
      expiresAt: refresh.expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const access = await this.tokens.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      tokenType: 'Bearer',
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
    };
  }

  async rotate(refreshToken: string, meta: Partial<RequestMeta> = {}): Promise<AuthTokens> {
    const payload = await this.tokens.verifyRefresh(refreshToken);
    const stored = await this.refreshTokens.findByIdWithHash(payload.jti);

    if (
      !stored ||
      stored.userId !== payload.sub ||
      !this.security.safeEqualHex(stored.tokenHash, this.security.sha256(refreshToken))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt <= new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Only one concurrent request can win the rotation.
    if (!(await this.refreshTokens.revokeIfActive(stored.id))) {
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return this.issue(stored.user, meta);
  }

  /** Logout: revoke one token owned by userId. Silent on invalid tokens. */
  async revoke(refreshToken: string, userId: string): Promise<void> {
    let jti: string;
    let sub: string;
    try {
      ({ jti, sub } = await this.tokens.verifyRefresh(refreshToken, { ignoreExpiration: true }));
    } catch {
      return;
    }
    if (sub !== userId) return;
    await this.refreshTokens.revokeMatching({
      id: jti,
      userId,
      tokenHash: this.security.sha256(refreshToken),
    });
  }

  revokeAll(userId: string): Promise<number> {
    return this.refreshTokens.revokeAllForUser(userId);
  }
}
