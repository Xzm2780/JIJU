import { ConfigService } from '@nestjs/config';
import {
  ModerationPriority,
  ModerationStatus,
  PublicStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ReportsService } from './reports.service';

const USER: AuthenticatedUser = {
  id: 'usr_reporter',
  authProvider: 'MOCK',
  plazaNickname: '晚风 1024',
  accountStatus: 'ACTIVE'
};
const KEY = 'v1:report.submit:00000000-0000-7000-8000-000000000010';

function harness() {
  let reportData: any = null;
  const tx = {
    noticeConfirmation: {
      findUnique: jest.fn().mockResolvedValue({ id: 'notice' })
    },
    post: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'pst_1',
        authorId: 'usr_author',
        currentContentVersion: 3,
        publicStatus: PublicStatus.PUBLISHED,
        moderationStatus: ModerationStatus.PASSED,
        riskConfirmedAt: null,
        expiresAt: new Date('2026-11-21T02:00:00.000Z'),
        hiddenAt: null,
        deletedAt: null
      })
    },
    comment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'cmt_1',
        authorId: 'usr_author',
        contentVersion: 1,
        deletedAt: null,
        moderationStatus: ModerationStatus.PASSED,
        post: {
          publicStatus: PublicStatus.PUBLISHED,
          hiddenAt: null,
          deletedAt: null,
          expiresAt: new Date('2026-11-21T02:00:00.000Z')
        }
      })
    },
    report: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => {
        reportData = data;
        return Promise.resolve({
          ...data,
          submittedAt: new Date('2026-11-14T03:00:00.000Z')
        });
      })
    },
    idempotencyRecord: { create: jest.fn().mockResolvedValue({}) }
  };
  const prisma = {
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({})
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx))
  };
  return {
    service: new ReportsService(
      prisma as any,
      { getOrThrow: () => 'mvp-v1' } as unknown as ConfigService
    ),
    prisma,
    tx,
    get reportData() {
      return reportData;
    }
  };
}

describe('ReportsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('captures the current post version and returns only a receipt', async () => {
    const h = harness();
    const result = await h.service.create({
      user: USER,
      idempotencyKey: KEY,
      requestId: 'req_report',
      body: {
        target_type: ReportTargetType.POST,
        target_id: 'pst_1',
        reason: ReportReason.ABUSE
      }
    });
    expect(result.data).toEqual({
      report_id: expect.any(String),
      submitted_at: '2026-11-14T03:00:00.000Z'
    });
    expect(result.data).not.toHaveProperty('content_version');
    expect(result.data).not.toHaveProperty('other_description');
    expect(h.reportData.contentVersion).toBe(3);
  });

  it('prioritizes minor-related reports', async () => {
    const h = harness();
    await h.service.create({
      user: USER,
      idempotencyKey: KEY,
      requestId: 'req_report',
      body: {
        target_type: ReportTargetType.POST,
        target_id: 'pst_1',
        reason: ReportReason.MINOR_INVOLVED
      }
    });
    expect(h.reportData).toMatchObject({
      isMinorRelated: true,
      priority: ModerationPriority.PREEMPTIVE,
      priorityRank: 0,
      status: ReportStatus.PENDING
    });
  });

  it('requires and trims OTHER description without echoing it', async () => {
    const missing = harness();
    await expect(
      missing.service.create({
        user: USER,
        idempotencyKey: KEY,
        requestId: 'req_report',
        body: {
          target_type: ReportTargetType.POST,
          target_id: 'pst_1',
          reason: ReportReason.OTHER,
          other_description: '   '
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });

    const valid = harness();
    const result = await valid.service.create({
      user: USER,
      idempotencyKey: KEY,
      requestId: 'req_report',
      body: {
        target_type: ReportTargetType.POST,
        target_id: 'pst_1',
        reason: ReportReason.OTHER,
        other_description: '  只供后台查看  '
      }
    });
    expect(valid.reportData.otherDescription).toBe('只供后台查看');
    expect(JSON.stringify(result)).not.toContain('只供后台查看');
  });

  it('returns the existing report inside the 24-hour dedupe window', async () => {
    const h = harness();
    h.tx.report.findFirst.mockResolvedValue({
      id: 'rpt_existing',
      submittedAt: new Date('2026-11-14T02:00:00.000Z')
    });
    const result = await h.service.create({
      user: USER,
      idempotencyKey: KEY,
      requestId: 'req_report',
      body: {
        target_type: ReportTargetType.POST,
        target_id: 'pst_1',
        reason: ReportReason.SPAM
      }
    });
    expect(result.data.report_id).toBe('rpt_existing');
    expect(h.tx.report.create).not.toHaveBeenCalled();
  });

  it('supports comment reports and rejects an unavailable target', async () => {
    const h = harness();
    await h.service.create({
      user: USER,
      idempotencyKey: KEY,
      requestId: 'req_report',
      body: {
        target_type: ReportTargetType.COMMENT,
        target_id: 'cmt_1',
        reason: ReportReason.PRIVACY
      }
    });
    expect(h.reportData).toMatchObject({
      targetType: ReportTargetType.COMMENT,
      contentVersion: 1
    });

    const unavailable = harness();
    unavailable.tx.post.findUnique.mockResolvedValue(null);
    await expect(
      unavailable.service.create({
        user: USER,
        idempotencyKey: KEY,
        requestId: 'req_report',
        body: {
          target_type: ReportTargetType.POST,
          target_id: 'pst_missing',
          reason: ReportReason.ABUSE
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_CONTENT_4041' });
  });

  it('rejects reporting your own post or comment', async () => {
    const h = harness();
    h.tx.post.findUnique.mockResolvedValue({
      id: 'pst_own',
      authorId: USER.id,
      currentContentVersion: 1,
      publicStatus: PublicStatus.PUBLISHED,
      moderationStatus: ModerationStatus.PASSED,
      riskConfirmedAt: null,
      expiresAt: new Date('2026-11-21T02:00:00.000Z'),
      hiddenAt: null,
      deletedAt: null
    });
    await expect(
      h.service.create({
        user: USER,
        idempotencyKey: KEY,
        requestId: 'req_report_own',
        body: {
          target_type: ReportTargetType.POST,
          target_id: 'pst_own',
          reason: ReportReason.ABUSE
        }
      })
    ).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221',
      message: '不能举报自己的内容'
    });
    expect(h.tx.report.create).not.toHaveBeenCalled();
  });
});
