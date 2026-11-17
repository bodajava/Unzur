import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service.js';

export const CACHE_PREFIX = 'cache:';

/** Cache-aside helpers on top of Redis. Cache failures never break requests. */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.redis.get<T>(CACHE_PREFIX + key);
    } catch (error) {
      this.logger.warn(`cache get failed: ${(error as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(CACHE_PREFIX + key, value, ttlSeconds);
    } catch (error) {
      this.logger.warn(`cache set failed: ${(error as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      await this.redis.del(...keys.map((k) => CACHE_PREFIX + k));
    } catch (error) {
      this.logger.warn(`cache del failed: ${(error as Error).message}`);
    }
  }

  /** Return cached value or compute, cache and return it. */
  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fn();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
