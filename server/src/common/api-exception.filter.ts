import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { ApiError } from './api-error';
import { mapHttpException } from './api-error-mapping';

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
      const mapped = mapHttpException(exception.getStatus());
      response.status(mapped.status).json({
        code: mapped.code,
        message: mapped.message,
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
