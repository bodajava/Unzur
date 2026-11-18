import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, of, tap } from 'rxjs';
import type { AppRequest } from '../interfaces/request.interface.js';
import { CACHE_KEY, type CacheOptions } from '../decorators/cache.decorator.js';
import { CacheService } from '../utilities/caching/cache.service.js';
import { isGraphql } from '../utilities/execution-context.js';

/**
 * Serves @Cache() GET routes from Redis. Only anonymous requests are cached
 * and served from cache, so user-specific data never leaks between users.
 * Caches the handler result (before the response envelope is applied).
 */
@Injectable()
export class CustomCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.getAllAndOverride<CacheOptions | undefined>(CACHE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // REST GET only; GraphQL uses its own caching per resolver if needed.
    if (!options || isGraphql(context)) return next.handle();
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (req.method !== 'GET' || req.user) return next.handle();

    const key = `${options.key ?? 'route'}:${req.originalUrl}`;
    const cached = await this.cache.get<unknown>(key);
    if (cached !== null) return of(cached);

    return next.handle().pipe(
      tap((data) => {
        void this.cache.set(key, data, options.ttlSeconds);
      }),
    );
  }
}
