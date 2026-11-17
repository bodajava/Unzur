import { SetMetadata } from '@nestjs/common';
import type { AppRequest } from '../interfaces/request.interface.js';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  windowSeconds: number;
  /**
   * What to count by. Default: client IP. Example for login:
   * by: (req) => `${req.ip}:${req.body?.email}`
   */
  by?: (req: AppRequest) => string;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
