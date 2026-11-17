import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

/**
 * Upstash Redis (REST). In local dev docker-compose runs an Upstash-compatible
 * REST proxy (SRH) in front of Redis, so the same client works everywhere.
 * Values are JSON-serialized automatically.
 */
@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('UPSTASH_REDIS_REST_URL');
    const token = config.get<string>('UPSTASH_REDIS_REST_TOKEN');
    const missing = [
      !url && 'UPSTASH_REDIS_REST_URL',
      !token && 'UPSTASH_REDIS_REST_TOKEN',
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(`Redis is not configured. Missing env: ${missing.join(', ')}`);
    }
    this.client = new Redis({ url: url!, token: token! });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.ping();
      this.logger.log('Connected to Upstash Redis');
    } catch (error) {
      this.logger.error(`Upstash Redis is unreachable: ${(error as Error).message}`);
    }
  }

  ping(): Promise<string> {
    return this.client.ping();
  }

  get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  /** SET key value NX EX ttl. True when the key was created (i.e. it did not exist). */
  async setIfAbsent<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    return (await this.client.set(key, value, { nx: true, ex: ttlSeconds })) === 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    return keys.length ? this.client.del(...keys) : 0;
  }

  incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(key, ttlSeconds)) === 1;
  }

  ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.length ? this.client.exists(...keys) : 0;
  }
}
