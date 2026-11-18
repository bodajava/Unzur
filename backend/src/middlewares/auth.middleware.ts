import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AppRequest } from '../common/interfaces/request.interface.js';
import { TokenService } from '../common/services/token/token.service.js';
import { UserRepository } from '../models/repositories/user.repository.js';

/**
 * Reads "Authorization: Bearer <access JWT>" and, if valid and the user is
 * still active, attaches request.user. Never rejects: invalid/expired tokens
 * leave the request anonymous; AuthGuard decides whether that is allowed.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly tokens: TokenService,
    private readonly users: UserRepository,
  ) {}

  async use(req: AppRequest, _res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authenticate(req);
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sets req.user from the Bearer token when valid. Also called by the
   * GraphQL context factory: /graphql sits outside the /api/v1 prefix that
   * Nest middleware is mounted under.
   */
  async authenticate(req: AppRequest): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    const payload = await this.tokens.verifyAccess(header.slice(7).trim());
    if (!payload) return;
    const user = await this.users.findAuthState(payload.sub);
    if (user?.isActive) {
      req.user = { id: user.id, email: user.email, role: user.role };
    }
  }
}
