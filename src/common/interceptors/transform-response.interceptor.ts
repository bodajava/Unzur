import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator.js';
import type { SuccessResponse } from '../interfaces/api-response.interface.js';
import { isGraphql } from '../utilities/execution-context.js';

/**
 * Wraps every successful REST response: { success, data, message }.
 * Left alone: GraphQL results (the schema defines their shape), files
 * (StreamableFile, e.g. PDF invoices) and responses already sent by the
 * handler (e.g. res.redirect for the Paymob callback).
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    if (isGraphql(context)) return next.handle() as unknown as Observable<SuccessResponse<T>>;

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'OK';

    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((payload) => {
        if (res.headersSent || payload instanceof StreamableFile) {
          return payload as unknown as SuccessResponse<T>;
        }
        return { success: true as const, data: payload ?? ({} as T), message };
      }),
    );
  }
}
