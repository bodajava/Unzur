import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Response } from 'express';
import type { AppRequest } from '../interfaces/request.interface.js';

/** GraphQL resolvers receive { req, res } in their context (see graphql.config.ts). */
export interface GqlContext {
  req: AppRequest;
  res: Response;
}

export const isGraphql = (context: ExecutionContext): boolean =>
  context.getType<string>() === 'graphql';

/** Express request for both REST handlers and GraphQL resolvers. */
export function getRequest(context: ExecutionContext): AppRequest {
  return isGraphql(context)
    ? GqlExecutionContext.create(context).getContext<GqlContext>().req
    : context.switchToHttp().getRequest<AppRequest>();
}

/** Express response for both REST handlers and GraphQL resolvers. */
export function getResponse(context: ExecutionContext): Response {
  return isGraphql(context)
    ? GqlExecutionContext.create(context).getContext<GqlContext>().res
    : context.switchToHttp().getResponse<Response>();
}
