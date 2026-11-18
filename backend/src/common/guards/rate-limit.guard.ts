import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator.js';
import { RateLimitService } from '../services/rate-limit/rate-limit.service.js';
import { getRequest, getResponse } from '../utilities/execution-context.js';

/** Applies @RateLimit(...) using Redis counters. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const req = getRequest(context);
    const res = getResponse(context);

    const subject = options.by?.(req) ?? req.ip ?? 'unknown';
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const result = await this.rateLimit.consume(
      `${route}:${subject}`,
      options.limit,
      options.windowSeconds,
    );

    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.limit - result.count));
    if (!result.allowed) {
      res.setHeader('Retry-After', result.resetInSeconds);
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
