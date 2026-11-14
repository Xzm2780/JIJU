import { ApiError } from './api-error';

export interface QueueCursor {
  version: 1;
  source: 'report' | 'moderation';
  priorityRank: number;
  queueAt: string;
  itemId: string;
}

export function encodeCursor(cursor: QueueCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(value: string | undefined): QueueCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as QueueCursor;
    if (
      parsed.version !== 1 ||
      !['report', 'moderation'].includes(parsed.source) ||
      !Number.isInteger(parsed.priorityRank) ||
      Number.isNaN(Date.parse(parsed.queueAt)) ||
      typeof parsed.itemId !== 'string'
    ) {
      throw new Error('invalid cursor');
    }
    return parsed;
  } catch {
    throw new ApiError('JIJU_VALIDATION_4221', 422, '分页游标无效');
  }
}
