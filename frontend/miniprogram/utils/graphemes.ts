const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
    : null;

export function normalizeBody(value: string): string {
  return value.trim();
}

export function countGraphemes(value: string): number {
  if (!value) {
    return 0;
  }
  return segmenter
    ? Array.from(segmenter.segment(value)).length
    : Array.from(value).length;
}
