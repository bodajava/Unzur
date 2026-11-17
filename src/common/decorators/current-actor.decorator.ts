import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { CookieName, HeaderName } from '../enums/http.enum.js';
import type { Actor } from '../interfaces/auth.interface.js';
import type { AppRequest } from '../interfaces/request.interface.js';
import { getRequest } from '../utilities/execution-context.js';
import { Regex } from '../utilities/regex/regex.js';

function sanitizeGuestId(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && Regex.GUEST_ID.test(raw) ? raw : undefined;
}

export function resolveActor(req: AppRequest): Actor {
  const guestId =
    sanitizeGuestId(req.headers[HeaderName.GUEST_ID]) ??
    sanitizeGuestId(req.cookies?.[CookieName.GUEST_ID]);

  const actor: Actor = {};
  if (req.user) {
    actor.userId = req.user.id;
    actor.role = req.user.role;
  }
  if (guestId) actor.guestId = guestId;
  return actor;
}

/**
 * Who is acting: logged-in user (request.user), guest (x-guest-id header /
 * guest_id cookie), or both. Used by cart/checkout and auth flows. Works in REST and GraphQL.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor =>
    resolveActor(getRequest(ctx)),
);
