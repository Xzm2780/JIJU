import {
  ReportReason,
  ReportStatus,
  ReportTargetType
} from '@prisma/client';
import { encodeCursor } from '../common/cursor';
import { ReviewQueueService } from './review-queue.service';
import { ReviewQueueSource } from './dto/list-review-queue.dto';

function reportRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rpt_00000000-0000-7000-8000-000000000001',
    targetType: ReportTargetType.POST,
    targetId: 'pst_00000000-0000-7000-8000-000000000001',
    contentVersion: 1,
    reason: ReportReason.ABUSE,
    status: ReportStatus.PENDING,
    submittedAt: new Date('2026-11-14T02:00:00.000Z'),
    ...overrides
  };
}

function moderationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mdr_00000000-0000-7000-8000-000000000001',
    targetType: 'POST',
    targetId: 'pst_00000000-0000-7000-8000-000000000002',
    contentVersion: 1,
    status: 'PENDING',
    hitRuleRefs: ['review-rule'],
    createdAt: new Date('2026-11-14T02:01:00.000Z'),
    ...overrides
  };
}

function createService(options: {
  reports?: unknown[];
  moderation?: unknown[];
} = {}) {
  const prisma = {
    report: {
      findMany: jest.fn().mockResolvedValue(options.reports ?? [])
    },
    moderationRecord: {
      findMany: jest.fn().mockResolvedValue(options.moderation ?? [])
    }
  };
  return {
    prisma,
    service: new ReviewQueueService(prisma as any)
  };
}

describe('ReviewQueueService', () => {
  it('merges report and moderation sources by queue time', async () => {
    const harness = createService({
      reports: [
        reportRecord({
          id: 'rpt_later',
          submittedAt: new Date('2026-11-14T02:03:00.000Z')
        }),
        reportRecord()
      ],
      moderation: [
        moderationRecord(),
        moderationRecord({
          id: 'mdr_later',
          createdAt: new Date('2026-11-14T02:02:00.000Z')
        })
      ]
    });

    const result = await harness.service.list({
      source: ReviewQueueSource.ALL,
      limit: 10
    });

    expect(result.data.map((item) => item.item_id)).toEqual([
      'rpt_00000000-0000-7000-8000-000000000001',
      'mdr_00000000-0000-7000-8000-000000000001',
      'mdr_later',
      'rpt_later'
    ]);
  });

  it('does not query moderation records when source=report', async () => {
    const harness = createService({ reports: [reportRecord()] });

    await harness.service.list({
      source: ReviewQueueSource.REPORT,
      limit: 20
    });

    expect(harness.prisma.report.findMany).toHaveBeenCalled();
    expect(harness.prisma.moderationRecord.findMany).not.toHaveBeenCalled();
  });

  it('continues across sources at the same timestamp without cross-source id filtering', async () => {
    const harness = createService();
    const queueAt = '2026-11-14T02:00:00.000Z';
    const cursor = encodeCursor({
      version: 1,
      source: 'report',
      queueAt,
      itemId: 'rpt_boundary'
    });

    await harness.service.list({
      source: ReviewQueueSource.ALL,
      cursor,
      limit: 20
    });

    const reportWhere =
      harness.prisma.report.findMany.mock.calls[0][0].where;
    const moderationWhere =
      harness.prisma.moderationRecord.findMany.mock.calls[0][0].where;

    expect(reportWhere.OR).toContainEqual({
      submittedAt: new Date(queueAt),
      id: { gt: 'rpt_boundary' }
    });
    expect(moderationWhere.OR).toContainEqual({
      createdAt: new Date(queueAt)
    });
    expect(moderationWhere.OR).not.toContainEqual(
      expect.objectContaining({ id: expect.anything() })
    );
  });

  it('skips same-time earlier-source rows but still reads newer ones after a moderation cursor', async () => {
    const harness = createService();
    const cursor = encodeCursor({
      version: 1,
      source: 'moderation',
      queueAt: '2026-11-14T02:00:00.000Z',
      itemId: 'mdr_boundary'
    });

    await harness.service.list({
      source: ReviewQueueSource.ALL,
      cursor,
      limit: 20
    });

    const reportWhere =
      harness.prisma.report.findMany.mock.calls[0][0].where;
    expect(reportWhere.OR).toContainEqual({
      submittedAt: { gt: new Date('2026-11-14T02:00:00.000Z') }
    });
    expect(reportWhere.OR).not.toContainEqual({
      submittedAt: new Date('2026-11-14T02:00:00.000Z')
    });
  });
});
