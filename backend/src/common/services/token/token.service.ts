import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../interfaces/auth.interface.js';

type ExpiresIn = JwtSignOptions['expiresIn'];

export interface SignedToken {
  token: string;
  expiresAt: Date;
}

/** JWT sign/verify only. Session storage/rotation lives in the auth module. */
@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: ExpiresIn;
  private readonly refreshExpiresIn: ExpiresIn;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessExpiresIn = (config.get<string>('JWT_ACCESS_EXPIRES_IN') ||
      '15m') as ExpiresIn;
    this.refreshExpiresIn = (config.get<string>('JWT_REFRESH_EXPIRES_IN') ||
      '7d') as ExpiresIn;
  }

  async signAccess(payload: Omit<AccessTokenPayload, 'type'>): Promise<SignedToken> {
    const token = await this.jwt.signAsync(
      { ...payload, type: 'access' } satisfies AccessTokenPayload,
      { secret: this.accessSecret, expiresIn: this.accessExpiresIn, algorithm: 'HS256' },
    );
    return { token, expiresAt: this.expiryOf(token) };
  }

  async signRefresh(payload: Omit<RefreshTokenPayload, 'type'>): Promise<SignedToken> {
    const token = await this.jwt.signAsync(
      { ...payload, type: 'refresh' } satisfies RefreshTokenPayload,
      { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn, algorithm: 'HS256' },
    );
    return { token, expiresAt: this.expiryOf(token) };
  }

  /** Returns null for missing/expired/invalid tokens (never throws). */
  async verifyAccess(token: string): Promise<AccessTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
        algorithms: ['HS256'],
      });
      return payload.type === 'access' ? payload : null;
    } catch {
      return null;
    }
  }

  async verifyRefresh(
    token: string,
    { ignoreExpiration = false } = {},
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
        ignoreExpiration,
      });
      if (payload.type !== 'refresh' || !payload.jti) throw new Error();
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private expiryOf(token: string): Date {
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return new Date(exp * 1000);
  }
}
