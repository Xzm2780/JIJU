const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });

export function normalizeBody(value: string): string {
  return value.trim();
}

export function countGraphemes(value: string): number {
  return Array.from(segmenter.segment(value)).length;
}

export function truncateGraphemes(
  value: string,
  maximum: number
): { value: string; truncated: boolean } {
  const segments = Array.from(segmenter.segment(value), (item) => item.segment);
  if (segments.length <= maximum) {
    return { value, truncated: false };
  }
  return {
    value: `${segments.slice(0, maximum).join('')}…`,
    truncated: true
  };
}

export function sanitizeForRuleMatching(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\p{Cf}\p{Cc}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}
