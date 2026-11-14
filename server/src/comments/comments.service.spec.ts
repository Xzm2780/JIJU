import { ConfigService } from '@nestjs/config';
import {
  ModerationStatus,
  PublicStatus,
  QuotaType
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CommentsService } from './comments.service';

const USER: AuthenticatedUser = {
  id: 'usr_author',
  authProvider: 'MOCK',
  plazaNickname: '晚风 1024',
  accountStatus: 'ACTIVE'
};
const POST_ID = 'pst_00000000-0000-7000-8000-000000000001';
const COMMENT_ID = 'cmt_00000000-0000-7000-8000-000000000001';
const PUBLISH_KEY =
  'v1:comment.publish:00000000-0000-7000-8000-000000000010';
const DELETE_KEY =
  'v1:comment.delete:00000000-0000-7000-8000-000000000011';

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: POST_ID,
    publicStatus: PublicStatus.PUBLISHED,
    moderationStatus: ModerationStatus.PASSED,
    riskConfirmedAt: null,
    expiresAt: new Date('2026-11-21T02:00:00.000Z'),
    hiddenAt: null,
    deletedAt: null,
    ...overrides
  };
}

function comment(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_ID,
    postId: POST_ID,
    authorId: USER.id,
    bodyText: '抱抱你',
    bodyGraphemeLength: 3,
    contentVersion: 1,
    moderationStatus: ModerationStatus.PASSED,
    publishedAt: new Date('2026-11-14T02:00:00.000Z'),
    deletedAt: null,
    author: { plazaNickname: USER.plazaNickname },
    ...overrides
  };
}

function harness() {
  let idempotency: any = null;
  const tx = {
    post: { findUnique: jest.fn().mockResolvedValue(post()) },
    noticeConfirmation: {
      findUnique: jest.fn().mockResolvedValue({ id: 'notice' })
    },
    quotaUsage: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({})
    },
    comment: {
      findMany: jest.fn().mockResolvedValue([comment()]),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...comment(),
          ...data,
          author: { plazaNickname: USER.plazaNickname }
        })
      ),
      findUnique: jest.fn().mockResolvedValue(comment()),
      update: jest.fn().mockResolvedValue({})
    },
    moderationRecord: { create: jest.fn().mockResolvedValue({}) },
    idempotencyRecord: {
      create: jest.fn().mockImplementation(({ data }) => {
        idempotency = data;
        return Promise.resolve(data);
      })
    }
  };
  const prisma = {
    post: { findUnique: jest.fn().mockResolvedValue(post()) },
    comment: { findMany: jest.fn().mockResolvedValue([comment()]) },
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({})
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx))
  };
  const config = {
    getOrThrow: () => 'mvp-v1'
  } as unknown as ConfigService;
  const ruleEngine = {
    evaluate: jest.fn().mockResolvedValue({
      decision: 'PASS',
      matchedRuleIds: []
    })
  };
  return {
    service: new CommentsService(
      prisma as any,
      config,
      ruleEngine as any
    ),
    prisma,
    tx,
    ruleEngine,
    get idempotency() {
      return idempotency;
    }
  };
}

describe('CommentsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists visible comments in ascending stable order without view_count', async () => {
    const h = harness();
    const result = await h.service.list(POST_ID, { limit: 20 });
    expect(result.data[0]).toMatchObject({
      id: COMMENT_ID,
      post_id: POST_ID,
      body_text: '抱抱你'
    });
    expect(result.data[0]).not.toHaveProperty('view_count');
    expect(h.prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }]
      })
    );
  });

  it('creates a comment and consumes one rolling quota only after success', async () => {
    const h = harness();
    const result = await h.service.create({
      postId: POST_ID,
      user: USER,
      idempotencyKey: PUBLISH_KEY,
      requestId: 'req_comment',
      bodyText: '  抱抱你  '
    });

    expect(result.data.body_text).toBe('抱抱你');
    expect(result.data).not.toHaveProperty('view_count');
    expect(h.tx.quotaUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quotaType: QuotaType.COMMENT_ROLLING_60M
        })
      })
    );
    expect(h.idempotency.operation).toBe('comment.publish');
  });

  it('rejects empty, 201-grapheme and blocked comments without writes', async () => {
    const h = harness();
    await expect(
      h.service.create({
        postId: POST_ID,
        user: USER,
        idempotencyKey: PUBLISH_KEY,
        requestId: 'req_comment',
        bodyText: ' '
      })
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });

    await expect(
      h.service.create({
        postId: POST_ID,
        user: USER,
        idempotencyKey:
          'v1:comment.publish:00000000-0000-7000-8000-000000000012',
        requestId: 'req_comment',
        bodyText: '👨‍👩‍👧‍👦'.repeat(201)
      })
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });
    expect(h.tx.comment.create).not.toHaveBeenCalled();
  });

  it('rejects the eleventh comment in a rolling 60-minute window', async () => {
    const h = harness();
    h.tx.quotaUsage.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        consumedAt: new Date(
          Date.parse('2026-11-14T02:00:00.000Z') + index * 60_000
        )
      }))
    );
    await expect(
      h.service.create({
        postId: POST_ID,
        user: USER,
        idempotencyKey: PUBLISH_KEY,
        requestId: 'req_comment',
        bodyText: '第十一条'
      })
    ).rejects.toMatchObject({
      code: 'JIJU_QUOTA_4292',
      status: 429
    });
    expect(h.tx.comment.create).not.toHaveBeenCalled();
  });

  it('rejects comments after expiry and non-author deletion', async () => {
    const expired = harness();
    expired.tx.post.findUnique.mockResolvedValue(
      post({ expiresAt: new Date('2026-11-14T02:00:00.000Z') })
    );
    await expect(
      expired.service.create({
        postId: POST_ID,
        user: USER,
        idempotencyKey: PUBLISH_KEY,
        requestId: 'req_comment',
        bodyText: '到期评论'
      })
    ).rejects.toMatchObject({ code: 'JIJU_CONTENT_4041' });

    const forbidden = harness();
    await expect(
      forbidden.service.delete({
        commentId: COMMENT_ID,
        user: { ...USER, id: 'usr_other' },
        idempotencyKey: DELETE_KEY,
        requestId: 'req_delete'
      })
    ).rejects.toMatchObject({ code: 'JIJU_ACCESS_4031' });
  });

  it('soft deletes the author comment and is idempotent', async () => {
    const h = harness();
    const args = {
      commentId: COMMENT_ID,
      user: USER,
      idempotencyKey: DELETE_KEY,
      requestId: 'req_delete'
    };
    await h.service.delete(args);
    expect(h.tx.comment.update).toHaveBeenCalledWith({
      where: { id: COMMENT_ID },
      data: { deletedAt: expect.any(Date) }
    });

    h.prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'idm_delete',
      requestFingerprint: JSON.stringify({ comment_id: COMMENT_ID }),
      expiresAt: new Date('2026-11-15T03:00:00.000Z'),
      responseJson: {}
    });
    await h.service.delete(args);
    expect(h.tx.comment.update).toHaveBeenCalledTimes(1);
  });
});
