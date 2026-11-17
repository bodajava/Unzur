import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';

/**
 * No login required. If a valid Bearer token is sent anyway, AuthMiddleware
 * still attaches request.user, so @CurrentActor() sees either user or guest.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
