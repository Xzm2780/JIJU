import { randomUUID } from 'node:crypto';
import { buildSafeLogEvent } from './safe-log';

interface RequestLike {
  method?: string;
  path?: string;
  route?: { path?: string };
  requestId?: string;
}

interface ResponseLike {
  statusCode?: number;
  on(event: 'finish', listener: () => void): void;
}

export function classifyStatus(statusCode: number): string {
  if (statusCode >= 500) {
    return 'server_error';
  }
  if (statusCode >= 400) {
    return 'client_error';
  }
  return 'success';
}

export function createRequestObservabilityMiddleware(options: {
  emit?: (event: ReturnType<typeof buildSafeLogEvent>) => void;
} = {}) {
  const emit = options.emit ?? ((event) => console.log(JSON.stringify(event)));
  return (
    request: RequestLike,
    response: ResponseLike,
    next: () => void
  ): void => {
    const startedAt = performance.now();
    response.on('finish', () => {
      const statusCode = response.statusCode ?? 500;
      emit(
        buildSafeLogEvent({
          request_id: request.requestId ?? `req_${randomUUID()}`,
          route_template:
            request.route?.path ?? request.path?.split('?')[0] ?? 'unknown',
          method: request.method ?? 'UNKNOWN',
          status_code: statusCode,
          duration_ms: Math.round(performance.now() - startedAt),
          result_category: classifyStatus(statusCode)
        })
      );
    });
    next();
  };
}
