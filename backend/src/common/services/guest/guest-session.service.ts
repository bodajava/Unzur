import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { CookieName } from '../../enums/http.enum.js';
import { RedisService } from '../../utilities/caching/redis.service.js';
import { RandomService } from '../security/random.service.js';

export const GUEST_SESSION_TTL_SEC = 30 * 24 * 60 * 60;

export interface GuestSession {
  guestId: string;
}

interface GuestSessionRecord {
  createdAt: string;
  lastSeenAt: string;
}

/**
 * Anonymous visitor sessions kept in Redis (guest:<id>, 30 days).
 * Shared: auth (1.9) and cart (auto-created on the first cart write).
 */
@Injectable()
export class GuestSessionService {
  private readonly secureCookies: boolean;

  constructor(
    private readonly redis: RedisService,
    private readonly random: RandomService,
    config: ConfigService,
  ) {
    this.secureCookies = config.get<string>('NODE_ENV') === 'production';
  }

  async ensure(existingGuestId?: string): Promise<GuestSession> {
    const now = new Date().toISOString();
    const guestId = existingGuestId ?? this.random.guestId();
    const key = `guest:${guestId}`;

    const current = existingGuestId
      ? await this.redis.get<GuestSessionRecord>(key)
      : null;
    await this.redis.set<GuestSessionRecord>(
      key,
      { createdAt: current?.createdAt ?? now, lastSeenAt: now },
      GUEST_SESSION_TTL_SEC,
    );
    return { guestId };
  }

  cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.secureCookies, sameSite: 'lax', path: '/' };
  }

  /** Sets the guest_id cookie (REST and GraphQL both have an Express response). */
  writeCookie(res: Response | undefined, guestId: string): void {
    res?.cookie(CookieName.GUEST_ID, guestId, {
      ...this.cookieOptions(),
      maxAge: GUEST_SESSION_TTL_SEC * 1000,
    });
  }
}
