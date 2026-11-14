import { ApiError } from '../common/api-error';

interface CommentCursor {
  version: 1;
  timestamp: string;
  id: string;
}

export function encodeCommentCursor(cursor: CommentCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCommentCursor(
  value: string | undefined
): CommentCursor | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as CommentCursor;
    if (
      parsed.version !== 1 ||
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
