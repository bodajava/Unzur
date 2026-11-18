import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuditContext } from '../interfaces/audit.interface.js';
import { getRequest } from '../utilities/execution-context.js';

/** @Audit() -> { actorId, ipAddress } for audit_logs. Only on authenticated routes. */
export const Audit = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuditContext => {
  const req = getRequest(ctx);
  if (!req.user) throw new UnauthorizedException();
  return { actorId: req.user.id, ipAddress: req.ip?.slice(0, 64) };
});
