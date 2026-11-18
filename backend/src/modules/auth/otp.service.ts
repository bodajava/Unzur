import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OtpType } from '../../common/enums/index.js';
import { RateLimitService } from '../../common/services/rate-limit/rate-limit.service.js';
import { RandomService } from '../../common/services/security/random.service.js';
import { SecurityService } from '../../common/services/security/security.service.js';
import { RedisService } from '../../common/utilities/caching/redis.service.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { OtpRepository } from '../../models/repositories/otp.repository.js';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_SEND_LIMIT = 3;
export const OTP_WINDOW_SEC = 15 * 60;
export const OTP_VERIFY_MAX_ATTEMPTS = 5;

/**
 * 6-digit codes stored as HMAC-SHA256(type:email:code) with OTP_SECRET,
 * so a database leak cannot be brute-forced offline.
 */
@Injectable()
export class OtpService {
  private readonly secret: string;

  constructor(
    private readonly otps: OtpRepository,
    private readonly tx: TransactionManager,
    private readonly random: RandomService,
    private readonly security: SecurityService,
    private readonly rateLimit: RateLimitService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('OTP_SECRET');
  }

  /** New code (older unused ones are invalidated). Null when the send limit is hit. */
  async issue(email: string, type: OtpType): Promise<string | null> {
    const { allowed } = await this.rateLimit.consume(
      `otp_rate:${email}`,
      OTP_SEND_LIMIT,
      OTP_WINDOW_SEC,
    );
    if (!allowed) return null;

    const code = this.random.otp();
    await this.tx.run(async (tx) => {
      const repo = this.otps.withTx(tx);
      await repo.invalidateActive(email, type);
      await repo.create({
        email,
        type,
        codeHash: this.hash(email, type, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      });
    });
    await this.redis.del(this.attemptsKey(email, type));
    return code;
  }

  /** Verifies and consumes the active code, or throws. */
  async verifyAndConsume(email: string, type: OtpType, code: string): Promise<void> {
    const attemptsKey = this.attemptsKey(email, type);
    if (((await this.redis.get<number>(attemptsKey)) ?? 0) >= OTP_VERIFY_MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many invalid attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = await this.otps.findLatestActiveWithHash(email, type);
    const valid =
      !!otp && this.security.safeEqualHex(otp.codeHash, this.hash(email, type, code));

    if (!valid || !(await this.otps.consume(otp.id))) {
      const n = await this.redis.incr(attemptsKey);
      if (n === 1) await this.redis.expire(attemptsKey, OTP_WINDOW_SEC);
      throw new BadRequestException('Invalid or expired code');
    }
    await this.redis.del(attemptsKey);
  }

  private hash(email: string, type: OtpType, code: string): string {
    return this.security.hmacSha256(this.secret, `${type}:${email}:${code}`);
  }

  private attemptsKey(email: string, type: OtpType): string {
    return `otp_attempts:${type}:${email}`;
  }
}
