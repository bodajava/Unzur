import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import { GqlExecutionContext } from '@nestjs/graphql';
import { getRequest, getResponse, isGraphql } from '../utilities/execution-context.js';

/** One line per request: METHOD url status duration (user). No bodies logged. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = getRequest(context);
    const res = getResponse(context);
    const started = Date.now();
    // GraphQL: log the operation field (e.g. "graphql Query.products")
    const target = isGraphql(context)
      ? `graphql ${GqlExecutionContext.create(context).getInfo<{ parentType: { name: string }; fieldName: string }>().parentType.name}.${GqlExecutionContext.create(context).getInfo<{ fieldName: string }>().fieldName}`
      : `${req.method} ${req.originalUrl}`;
    const line = (status: number) =>
      `${target} ${status} ${Date.now() - started}ms${req.user ? ` user=${req.user.id}` : ''}`;

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(line(res.statusCode)),
        error: (err: { status?: number }) => this.logger.warn(line(err?.status ?? 500)),
      }),
    );
  }
}
