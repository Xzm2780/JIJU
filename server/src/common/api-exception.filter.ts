import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { ApiError } from './api-error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    const requestId =
      request.requestId ?? request.headers['x-request-id'] ?? 'unknown';

    if (exception instanceof ApiError) {
      response.status(exception.status).json({
        code: exception.code,
        message: exception.message,
        request_id: requestId,
        ...(exception.details ? { details: exception.details } : {})
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const reason = exception.getResponse();
      const message =
        typeof reason === 'string'
          ? reason
          : (reason as { message?: string | string[] }).message;
      response.status(status).json({
        code:
          status === HttpStatus.UNAUTHORIZED
            ? 'JIJU_AUTH_4011'
            : status === HttpStatus.FORBIDDEN
              ? 'JIJU_ACCESS_4031'
              : status === HttpStatus.NOT_FOUND
                ? 'JIJU_CONTENT_4041'
                : 'JIJU_VALIDATION_4221',
        message,
        request_id: requestId
      });
      return;
    }

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      code: 'JIJU_SYSTEM_5031',
      message: '服务暂时不可用，请稍后重试',
      request_id: requestId
    });
  }
}
