import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../utilities/caching/redis.service.js';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  /** Seconds until the window resets */
  resetInSeconds: number;
}

/** Fixed-window rate limiting in Redis: key -> counter with TTL. */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redis: RedisService) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    try {
      const count = await this.redis.incr(redisKey);
      if (count === 1) await this.redis.expire(redisKey, windowSeconds);
      const ttl = await this.redis.ttl(redisKey);
      return {
        allowed: count <= limit,
        count,
        limit,
        resetInSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (error) {
      // Fail open: Redis outage must not lock everyone out.
      this.logger.error(`rate limit check failed: ${(error as Error).message}`);
      return { allowed: true, count: 0, limit, resetInSeconds: windowSeconds };
    }
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`rl:${key}`);
  }
}
