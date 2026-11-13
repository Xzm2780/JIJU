import {
  beijingDayWindow,
  formatBeijingDateTime
} from './beijing-time';
import { parseDurationMilliseconds } from './duration';
import {
  countGraphemes,
  normalizeBody,
  sanitizeForRuleMatching
} from './graphemes';
import { stableStringify } from './stable-stringify';
import { createUuidV7 } from './uuid-v7';

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
});
