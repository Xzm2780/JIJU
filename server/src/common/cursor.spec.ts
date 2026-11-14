import { decodeCursor, encodeCursor } from './cursor';

describe('review queue cursor', () => {
  it('round-trips a stable opaque cursor', () => {
    const cursor = {
      version: 1 as const,
      source: 'report' as const,
      priorityRank: 0,
      queueAt: '2026-11-14T02:00:00.000Z',
      itemId: 'rpt_1'
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow('分页游标无效');
  });
});
