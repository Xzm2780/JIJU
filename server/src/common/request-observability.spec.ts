import {
  classifyStatus,
  createRequestObservabilityMiddleware
} from './request-observability';

describe('request observability', () => {
  it('classifies status ranges', () => {
    expect(classifyStatus(200)).toBe('success');
    expect(classifyStatus(422)).toBe('client_error');
    expect(classifyStatus(503)).toBe('server_error');
  });

  it('logs only whitelisted request metadata', () => {
    let listener: (() => void) | undefined;
    const events: unknown[] = [];
    const middleware = createRequestObservabilityMiddleware({
      emit: (event) => events.push(event)
    });
    middleware(
      {
        method: 'POST',
        path: '/api/v1/posts',
        route: { path: '/posts' },
        requestId: 'req_safe'
      } as any,
      {
        statusCode: 201,
        on: (_event, callback) => {
          listener = callback;
        }
      },
      () => undefined
    );
    listener?.();

    expect(events[0]).toEqual(
      expect.objectContaining({
        request_id: 'req_safe',
        route_template: '/posts',
        method: 'POST',
        status_code: 201,
        result_category: 'success'
      })
    );
    expect(JSON.stringify(events)).not.toContain('body_text');
    expect(JSON.stringify(events)).not.toContain('openid');
  });
});
