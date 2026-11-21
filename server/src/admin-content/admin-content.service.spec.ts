import {
  ModerationStatus,
  PublicStatus,
  ReportTargetType
} from '@prisma/client';
import { AdminContentService } from './admin-content.service';
import {
  ContentAction
} from './dto/content-action.dto';
import { ReviewDecision } from './dto/review-content.dto';

const ACTOR = {
  id: 'usr_admin',
  authProvider: 'MOCK',
  plazaNickname: '运营',
  accountStatus: 'ACTIVE'
};
const POST_ID = 'pst_00000000-0000-7000-8000-000000000001';

function harness(overrides: Record<string, unknown> = {}) {
  const post = {
    id: POST_ID,
    currentContentVersion: 2,
    publicStatus: PublicStatus.PUBLISHED,
    moderationStatus: ModerationStatus.PENDING,
    expiresAt: new Date('2099-11-21T02:00:00.000Z'),
    hiddenAt: null,
    deletedAt: null,
    ...overrides
  };
  const tx = {
    post: {
      findUnique: jest.fn().mockResolvedValue(post),
      update: jest.fn().mockResolvedValue(post)
    },
    comment: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    moderationRecord: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'mdr_1',
        reviewRound: 1
      }),
      create: jest.fn().mockResolvedValue({
        id: 'mdr_created',
        reviewRound: 1
      }),
      update: jest.fn().mockResolvedValue({
        id: 'mdr_1',
        reviewRound: 1
      })
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    idempotencyRecord: { create: jest.fn().mockResolvedValue({}) }
  };
  const prisma = {
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx))
  };
  return {
    service: new AdminContentService(prisma as any),
    tx,
    prisma
  };
}

describe('AdminContentService', () => {
  it('rejects matching content and hides it while writing moderation and audit', async () => {
    const h = harness();
    const result = await h.service.review({
      targetType: ReportTargetType.POST,
      targetId: POST_ID,
      user: ACTOR,
      requestId: 'req_review',
      idempotencyKey:
        'v1:admin.review:00000000-0000-7000-8000-000000000001',
      body: {
        expected_content_version: 2,
        decision: ReviewDecision.REJECTED,
        reason: '明确违规'
      }
    });
    expect(result.data).toMatchObject({
      moderation_status: ModerationStatus.REJECTED,
      public_status: PublicStatus.HIDDEN
    });
    expect(h.tx.moderationRecord.update).toHaveBeenCalled();
    expect(h.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: ACTOR.id,
          actionType: 'REVIEW_REJECTED'
        })
      })
    );
  });

  it('restores HIDDEN to PUBLISHED without extending expiry', async () => {
    const h = harness({
      publicStatus: PublicStatus.HIDDEN,
      moderationStatus: ModerationStatus.PASSED,
      hiddenAt: new Date()
    });
    const result = await h.service.action({
      targetType: ReportTargetType.POST,
      targetId: POST_ID,
      user: ACTOR,
      requestId: 'req_action',
      idempotencyKey:
        'v1:admin.content.action:00000000-0000-7000-8000-000000000002',
      body: {
        action: ContentAction.RESTORE,
        expected_content_version: 2,
        reason: '复核恢复'
      }
    });
    expect(result.data).toMatchObject({
      public_status_before: PublicStatus.HIDDEN,
      public_status_after: PublicStatus.PUBLISHED
    });
    expect(h.tx.post.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: {
        publicStatus: PublicStatus.PUBLISHED,
        hiddenAt: null
      }
    });
    const audit = h.tx.auditLog.create.mock.calls[0][0].data;
    expect(audit.stateBefore.expires_at).toBe(audit.stateAfter.expires_at);
  });

  it('rejects restore after expiry or REJECTED moderation', async () => {
    const expired = harness({
      publicStatus: PublicStatus.HIDDEN,
      moderationStatus: ModerationStatus.PASSED,
      expiresAt: new Date('2026-01-01T00:00:00.000Z')
    });
    await expect(
      expired.service.action({
        targetType: ReportTargetType.POST,
        targetId: POST_ID,
        user: ACTOR,
        requestId: 'req_action',
        idempotencyKey:
          'v1:admin.content.action:00000000-0000-7000-8000-000000000003',
        body: {
          action: ContentAction.RESTORE,
          expected_content_version: 2,
          reason: '错误恢复'
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_CONTENT_4221' });
  });
});
