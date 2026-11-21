import { ApiError } from './api-error';

export interface PageCursor {
  version: 1;
  timestamp: string;
  id: string;
}

export function encodePageCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodePageCursor(value: string | undefined): PageCursor | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as PageCursor;
    if (
      parsed.version !== 1 ||
      typeof parsed.id !== 'string' ||
      !parsed.id ||
      Number.isNaN(Date.parse(parsed.timestamp))
    ) {
      throw new Error('invalid cursor');
    }
    return parsed;
  } catch {
    throw new ApiError('JIJU_VALIDATION_4221', 422, '分页游标无效');
  }
}
