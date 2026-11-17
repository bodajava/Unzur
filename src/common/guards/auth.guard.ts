import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { getRequest } from '../utilities/execution-context.js';

/**
 * Global guard: every route needs request.user (set by AuthMiddleware from a
 * valid Bearer JWT) unless it is marked @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (!getRequest(context).user) {
      throw new UnauthorizedException('Authentication required');
    }
    return true;
  }
}
