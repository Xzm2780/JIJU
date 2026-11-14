import {
  ModerationPriority,
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
    isMinorRelated: false,
    priority: ModerationPriority.NORMAL,
    priorityRank: 1,
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
    priority: ModerationPriority.NORMAL,
    priorityRank: 1,
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
  it('merges report and moderation sources with PREEMPTIVE first', async () => {
    const harness = createService({
      reports: [
        reportRecord({
          id: 'rpt_preemptive',
          reason: ReportReason.MINOR_INVOLVED,
          isMinorRelated: true,
          priority: ModerationPriority.PREEMPTIVE,
          priorityRank: 0
        }),
        reportRecord()
      ],
      moderation: [
        moderationRecord(),
        moderationRecord({
          id: 'mdr_preemptive',
          priority: ModerationPriority.PREEMPTIVE,
          priorityRank: 0,
          createdAt: new Date('2026-11-14T02:02:00.000Z')
        })
      ]
    });

    const result = await harness.service.list({
      source: ReviewQueueSource.ALL,
      limit: 10
    });

    expect(result.data.map((item) => item.item_id)).toEqual([
      'rpt_preemptive',
      'mdr_preemptive',
      'rpt_00000000-0000-7000-8000-000000000001',
      'mdr_00000000-0000-7000-8000-000000000001'
    ]);
    expect(result.data[0].is_minor_related).toBe(true);
    expect(result.data[0]).not.toHaveProperty('priority_rank');
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

  it('maps PREEMPTIVE priority filter to rank zero', async () => {
    const harness = createService();

    await harness.service.list({
      source: ReviewQueueSource.ALL,
      priority: ModerationPriority.PREEMPTIVE,
      limit: 20
    });

    expect(harness.prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ priorityRank: 0 })
      })
    );
    expect(harness.prisma.moderationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ priorityRank: 0 })
      })
    );
  });

  it('continues across sources at the same timestamp without cross-source id filtering', async () => {
    const harness = createService();
    const queueAt = '2026-11-14T02:00:00.000Z';
    const cursor = encodeCursor({
      version: 1,
      source: 'report',
      priorityRank: 1,
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
      priorityRank: 1,
      submittedAt: new Date(queueAt),
      id: { gt: 'rpt_boundary' }
    });
    expect(moderationWhere.OR).toContainEqual({
      priorityRank: 1,
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
      priorityRank: 0,
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
      priorityRank: 0,
      submittedAt: { gt: new Date('2026-11-14T02:00:00.000Z') }
    });
    expect(reportWhere.OR).not.toContainEqual({
      priorityRank: 0,
      submittedAt: new Date('2026-11-14T02:00:00.000Z')
    });
  });
});
