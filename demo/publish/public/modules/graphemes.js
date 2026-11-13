const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
    : null;

export function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function countGraphemes(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }

  if (segmenter) {
    return Array.from(segmenter.segment(value)).length;
  }

  return Array.from(value).length;
}
