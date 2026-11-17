import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../interfaces/auth.interface.js';
import { getRequest } from '../utilities/execution-context.js';

/** @CurrentUser() -> AuthUser | undefined, @CurrentUser('id') -> string */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = getRequest(ctx).user;
    return field ? user?.[field] : user;
  },
);
