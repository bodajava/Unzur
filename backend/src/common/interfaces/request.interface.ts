import type { Request } from 'express';
import type { AuthUser } from './auth.interface.js';

export interface AppRequest extends Request {
  user?: AuthUser;
  cookies: Record<string, unknown>;
}
