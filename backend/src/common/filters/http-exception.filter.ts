import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request, Response } from 'express';
import { GraphQLError } from 'graphql';
import { Prisma } from '../../generated/prisma/client.js';
import type { ErrorResponse } from '../interfaces/api-response.interface.js';
import { AppEvents } from '../events/event-names.js';

/** Payload of AppEvents.SERVER_ERROR (an unexpected 500). */
export interface ServerErrorEvent {
  where: string;
  message: string;
  stack?: string;
  at: string;
}

/** GraphQL error codes (extensions.code) by HTTP status. */
const GRAPHQL_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  501: 'NOT_IMPLEMENTED',
};

/**
 * Normalizes every error. Never leaks stack traces, SQL or Prisma internals.
 *  - REST:    { success: false, data: null, message, errors } with the HTTP status
 *  - GraphQL: a GraphQLError with extensions { code, statusCode, errors }
 *             (GraphQL has no Express response to set a status on)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /** Optional so the filter also works when built by hand (tests). */
  constructor(@Optional() private readonly events?: EventEmitter2) {}

  catch(exception: unknown, host: ArgumentsHost): GraphQLError | void {
    if (exception instanceof GraphQLError && host.getType<string>() === 'graphql') return exception;
    const { status, message, errors } = this.resolve(exception);
    const isGraphql = host.getType<string>() === 'graphql';

    // Only unexpected errors are logged with stacks (not intentional HttpExceptions)
    if (status >= 500 && !(exception instanceof HttpException)) {
      const where = isGraphql ? 'graphql' : this.describe(host);
      this.logger.error(
        `${where} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Error tracking: the team gets an alert (throttled) instead of finding out from customers.
      const event: ServerErrorEvent = {
        where,
        message: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
        at: new Date().toISOString(),
      };
      this.events?.emit(AppEvents.SERVER_ERROR, event);
    }

    if (isGraphql) {
      // Returned (not sent): Nest rethrows it to Apollo, which adds it to `errors`.
      return new GraphQLError(message, {
        extensions: {
          code: GRAPHQL_CODES[status] ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
          statusCode: status,
          ...(errors ? { errors } : {}),
        },
      });
    }

    const response = host.switchToHttp().getResponse<Response>();
    const body: ErrorResponse = { success: false, data: null, message, errors };
    response.status(status).json(body);
  }

  private describe(host: ArgumentsHost): string {
    const request = host.switchToHttp().getRequest<Request>();
    return `${request.method} ${request.url}`;
  }

  private resolve(exception: unknown): {
    status: number;
    message: string;
    errors: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return { status, message: res, errors: null };
      }

      const { message, errors } = res as {
        message?: string | string[];
        errors?: unknown;
      };

      // ValidationPipe puts an array of messages in `message`
      if (Array.isArray(message)) {
        return { status, message: 'Validation failed', errors: message };
      }
      return {
        status,
        message: message ?? exception.message,
        errors: errors ?? null,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          const target = this.uniqueTarget(exception);
          return {
            status: HttpStatus.CONFLICT,
            message: target
              ? `A record with this ${target} already exists`
              : 'A record with these values already exists',
            errors: target ? { fields: target.split(', ') } : null,
          };
        }
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            message: 'Resource not found',
            errors: null,
          };
        case 'P2003':
          return {
            status: HttpStatus.BAD_REQUEST,
            message: 'Related resource does not exist or is still in use',
            errors: null,
          };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid request data',
        errors: null,
      };
    }

    // Unknown error: sanitized 500
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: null,
    };
  }

  /**
   * Only column names, never values, are surfaced.
   * With the pg driver adapter Prisma reports the index name
   * (e.g. "users_email_key"), so the column is derived from it.
   */
  private uniqueTarget(
    e: Prisma.PrismaClientKnownRequestError,
  ): string | undefined {
    const meta = e.meta as
      | {
          target?: string[] | string;
          driverAdapterError?: {
            cause?: {
              table?: string;
              constraint?: { fields?: string[]; index?: string };
            };
          };
        }
      | undefined;

    const cause = meta?.driverAdapterError?.cause;
    let fields: string[] | string | undefined =
      meta?.target ?? cause?.constraint?.fields;

    const index = cause?.constraint?.index;
    if (!fields && index && cause?.table) {
      const prefix = `${cause.table}_`;
      if (index.startsWith(prefix) && index.endsWith('_key')) {
        fields = index.slice(prefix.length, -'_key'.length);
      }
    }
    if (!fields) return undefined;
    return (Array.isArray(fields) ? fields : [fields])
      .map((f) => f.replace(/"/g, ''))
      .join(', ');
  }
}
