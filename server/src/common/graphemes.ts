const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });

export function normalizeBody(value: string): string {
  return value.trim();
}

export function countGraphemes(value: string): number {
  return Array.from(segmenter.segment(value)).length;
}

export function sanitizeForRuleMatching(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\p{Cf}\p{Cc}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}
