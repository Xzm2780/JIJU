import {
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
    reason: ReportReason.ABUSE,
    otherDescription: null,
    status: ReportStatus.PENDING,
    submittedAt: new Date('2026-11-14T02:00:00.000Z'),
    ...overrides
  };
}

describe('AdminReportsService', () => {
  it('defaults to open reports without leaking identities', async () => {
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
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }]
      })
    );
    expect(result.data[0]).toMatchObject({
      content_version: 2,
      reason: ReportReason.ABUSE
    });
    expect(result.data[0]).not.toHaveProperty('reporter_id');
    expect(result.data[0]).not.toHaveProperty('view_count');
  });

  it('applies status and reason filters', async () => {
    const prisma = {
      report: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new AdminReportsService(prisma as any);
    await service.list({
      limit: 20,
      status: ReportStatus.RESOLVED,
      reason: ReportReason.SPAM
    });
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReportStatus.RESOLVED,
          reason: ReportReason.SPAM
        })
      })
    );
  });
});
