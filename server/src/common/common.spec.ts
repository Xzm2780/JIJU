import {
  beijingDayWindow,
  formatBeijingDateTime
} from './beijing-time';
import { mapHttpException } from './api-error-mapping';
import { parseDurationMilliseconds } from './duration';
import {
  countGraphemes,
  normalizeBody,
  sanitizeForRuleMatching
} from './graphemes';
import { stableStringify } from './stable-stringify';
import { createUuidV7 } from './uuid-v7';
import {
  isValidIdempotencyKey,
  requireIdempotencyKey
} from './idempotency-key';
import { buildSafeLogEvent } from './safe-log';
import { isValidViewToken } from './view-token';

describe('common utilities', () => {
  it('counts Unicode extended grapheme clusters', () => {
    expect(countGraphemes('👨‍👩‍👧‍👦')).toBe(1);
    expect(countGraphemes('e\u0301')).toBe(1);
    expect(countGraphemes('中🙂')).toBe(2);
    expect(normalizeBody('  你好  ')).toBe('你好');
    expect(sanitizeForRuleMatching('[[\u200BREVIEW]]')).toBe('[[REVIEW]]');
    expect(sanitizeForRuleMatching('正\u200D文\n内容')).toBe('正文内容');
  });

  it('creates UUIDv7 identifiers', () => {
    expect(createUuidV7(Date.parse('2026-11-13T10:00:00Z'))).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('parses configured durations and Beijing day boundaries', () => {
    expect(parseDurationMilliseconds('24h')).toBe(24 * 60 * 60 * 1000);
    expect(parseDurationMilliseconds('10m')).toBe(10 * 60 * 1000);

    const day = beijingDayWindow(new Date('2026-11-13T02:00:00Z'));
    expect(day.start.toISOString()).toBe('2026-11-12T16:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-11-13T16:00:00.000Z');
    expect(formatBeijingDateTime(day.end)).toContain('2026');
  });

  it('creates deterministic object fingerprints', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(
      stableStringify({ a: 1, b: 2 })
    );
  });

  it('validates operation-scoped idempotency and view tokens', () => {
    const uuid = createUuidV7(Date.parse('2026-11-13T10:00:00Z'));
    expect(isValidIdempotencyKey(`v1:post.publish:${uuid}`, 'post.publish')).toBe(
      true
    );
    expect(() =>
      requireIdempotencyKey(`v1:post.edit:${uuid}`, 'post.publish')
    ).toThrow('缺少或无效的幂等键');
    expect(isValidViewToken(`v1:view:${uuid}`)).toBe(true);
    expect(isValidViewToken(`v1:view:${uuid}`.replace('v1:view:', 'v1:'))).toBe(
      false
    );
  });

  it('maps framework errors and filters unsafe log fields', () => {
    expect(mapHttpException(404)).toEqual({
      code: 'JIJU_CONTENT_4041',
      status: 404,
      message: '内容已不可用'
    });
    expect(
      buildSafeLogEvent({
        request_id: 'req_1',
        route_template: '/posts/:id',
        status_code: 200,
        body_text: 'must-not-be-logged',
        openid: 'must-not-be-logged'
      })
    ).toEqual({
      request_id: 'req_1',
      route_template: '/posts/:id',
      status_code: 200
    });
  });
});
