import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

interface ErrorBody {
  message: string;
  code: string;
  details?: unknown;
}

/**
 * Normalizes every thrown error into `{ message, code }` responses so the web
 * app receives predictable payloads regardless of where the exception
 * originated in Nest.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();

    const { status, body } = this.buildPayload(exception);
    httpAdapter.reply(ctx.getResponse(), body, status);
  }

  private buildPayload(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse() as
        | string
        | { message?: string | string[]; error?: string; code?: string };
      const message =
        typeof response === 'string'
          ? response
          : Array.isArray(response?.message)
            ? response.message[0]
            : response?.message ?? exception.message;
      return {
        status: exception.getStatus(),
        body: {
          message,
          code: typeof response === 'object' && response?.code ? response.code : 'HTTP_ERROR',
          details: response
        }
      };
    }

    this.logger.error('Unhandled exception bubble', exception as Error);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        message: 'Something went wrong. Please try again.',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}
