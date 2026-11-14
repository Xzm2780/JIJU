import {
  ModerationPriority,
  ReportReason,
  ReportStatus,
  ReportTargetType
} from '@prisma/client';
import { AdminReportsService } from './admin-reports.service';

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rpt_00000000-0000-7000-8000-000000000001',
    targetType: ReportTargetType.POST,
    targetId: 'pst_00000000-0000-7000-8000-000000000001',
    contentVersion: 2,
    reason: ReportReason.MINOR_INVOLVED,
    otherDescription: null,
    isMinorRelated: true,
    priority: ModerationPriority.PREEMPTIVE,
    priorityRank: 0,
    status: ReportStatus.PENDING,
    submittedAt: new Date('2026-11-14T02:00:00.000Z'),
    ...overrides
  };
}

describe('AdminReportsService', () => {
  it('defaults to open reports and prioritizes minor reports without leaking identities', async () => {
    const prisma = {
      report: { findMany: jest.fn().mockResolvedValue([report()]) }
    };
    const service = new AdminReportsService(prisma as any);
    const result = await service.list({ limit: 20 });

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [ReportStatus.PENDING, ReportStatus.PROCESSING]
          }
        }),
        orderBy: [
          { priorityRank: 'asc' },
          { submittedAt: 'desc' },
          { id: 'desc' }
        ]
      })
    );
    expect(result.data[0]).toMatchObject({
      content_version: 2,
      is_minor_related: true,
      priority: ModerationPriority.PREEMPTIVE
    });
    expect(result.data[0]).not.toHaveProperty('reporter_id');
    expect(result.data[0]).not.toHaveProperty('view_count');
  });

  it('applies status, priority and reason filters', async () => {
    const prisma = {
      report: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new AdminReportsService(prisma as any);
    await service.list({
      limit: 20,
      status: ReportStatus.RESOLVED,
      priority: ModerationPriority.NORMAL,
      reason: ReportReason.SPAM
    });
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReportStatus.RESOLVED,
          priority: ModerationPriority.NORMAL,
          reason: ReportReason.SPAM
        })
      })
    );
  });
});
