import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'custom_cache';

export interface CacheOptions {
  ttlSeconds: number;
  /** Key prefix; the request URL (path + query) is appended. Defaults to the URL. */
  key?: string;
}

/**
 * Cache a GET response in Redis (anonymous requests only, so per-user data
 * is never shared). Used with CustomCacheInterceptor.
 */
export const Cache = (ttlSeconds: number, key?: string) =>
  SetMetadata(CACHE_KEY, { ttlSeconds, key } satisfies CacheOptions);
