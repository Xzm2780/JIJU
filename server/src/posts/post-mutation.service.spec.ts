import { ConfigService } from '@nestjs/config';
import {
  ModerationStatus,
  PublicStatus,
  TagCategory
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PostMutationService } from './post-mutation.service';

const USER: AuthenticatedUser = {
  id: 'usr_author',
  authProvider: 'MOCK',
  plazaNickname: '晚风 1024',
  accountStatus: 'ACTIVE'
};
const POST_ID = 'pst_00000000-0000-7000-8000-000000000001';
const EDIT_KEY = 'v1:post.edit:00000000-0000-7000-8000-000000000010';
const DELETE_KEY = 'v1:post.delete:00000000-0000-7000-8000-000000000011';

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: POST_ID,
    authorId: USER.id,
    bodyText: '旧正文',
    bodyGraphemeLength: 3,
    emotionTagId: null,
    emotionTagNameSnapshot: null,
    contextTagId: null,
    contextTagNameSnapshot: null,
    retentionHours: 168,
    publicStatus: PublicStatus.PUBLISHED,
    moderationStatus: ModerationStatus.PASSED,
    riskConfirmedAt: null,
    publishedAt: new Date('2026-11-14T02:00:00.000Z'),
    expiresAt: new Date('2026-11-21T02:00:00.000Z'),
    currentContentVersion: 1,
    editedAt: null,
    hiddenAt: null,
    deletedAt: null,
    createdAt: new Date('2026-11-14T02:00:00.000Z'),
    updatedAt: new Date('2026-11-14T02:00:00.000Z'),
    ...overrides
  };
}

function harness(currentPost = post()) {
  let idempotency: any = null;
  const tx = {
    post: {
      findUnique: jest.fn().mockResolvedValue(currentPost),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...currentPost,
          ...data,
          publishedAt: currentPost.publishedAt,
          expiresAt: currentPost.expiresAt
        })
      )
    },
    noticeConfirmation: {
      findUnique: jest.fn().mockResolvedValue({ id: 'notice' })
    },
    tag: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'tag_emotion',
          name: '疲惫',
          category: TagCategory.EMOTION
        }
      ])
    },
    postVersion: { create: jest.fn().mockResolvedValue({}) },
    moderationRecord: { create: jest.fn().mockResolvedValue({}) },
    idempotencyRecord: {
      create: jest.fn().mockImplementation(({ data }) => {
        idempotency = data;
        return Promise.resolve(data);
      })
    }
  };
  const prisma = {
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
  const challenges = {
    create: jest.fn().mockResolvedValue({
      id: 'chl_1',
      promptVersion: 'v1',
      resourceVersion: 'v1',
      resources: []
    })
  };
  return {
    service: new PostMutationService(
      prisma as any,
      config,
      challenges as any,
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

describe('PostMutationService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a new version without changing published_at or expires_at', async () => {
    const h = harness();
    const result = await h.service.edit({
      postId: POST_ID,
      user: USER,
      idempotencyKey: EDIT_KEY,
      requestId: 'req_edit',
      body: {
        expected_content_version: 1,
        body_text: '新正文',
        emotion_tag_id: 'tag_emotion',
        risk_acknowledged: false
      }
    });

    expect(result.data.content_version).toBe(2);
    expect(result.data.published_at).toBe('2026-11-14T02:00:00.000Z');
    expect(result.data.expires_at).toBe('2026-11-21T02:00:00.000Z');
    expect(h.tx.postVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versionNumber: 2, bodyText: '新正文' })
      })
    );
    expect(h.idempotency.operation).toBe('post.edit');
  });

  it('rejects a version conflict and non-author edit', async () => {
    const conflict = harness();
    await expect(
      conflict.service.edit({
        postId: POST_ID,
        user: USER,
        idempotencyKey: EDIT_KEY,
        requestId: 'req_edit',
        body: {
          expected_content_version: 2,
          body_text: '新正文',
          risk_acknowledged: false
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_CONFLICT_4092' });

    const forbidden = harness();
    await expect(
      forbidden.service.edit({
        postId: POST_ID,
        user: { ...USER, id: 'usr_other' },
        idempotencyKey:
          'v1:post.edit:00000000-0000-7000-8000-000000000012',
        requestId: 'req_edit',
        body: {
          expected_content_version: 1,
          body_text: '越权',
          risk_acknowledged: false
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_ACCESS_4031' });
  });

  it('rejects edits after expiry while preserving the old version', async () => {
    const h = harness(
      post({ expiresAt: new Date('2026-11-14T02:00:00.000Z') })
    );
    await expect(
      h.service.edit({
        postId: POST_ID,
        user: USER,
        idempotencyKey: EDIT_KEY,
        requestId: 'req_edit',
        body: {
          expected_content_version: 1,
          body_text: '到期后编辑',
          risk_acknowledged: false
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_CONTENT_4221' });
    expect(h.tx.postVersion.create).not.toHaveBeenCalled();
  });

  it('soft deletes the post and replays the same delete key', async () => {
    const h = harness();
    const args = {
      postId: POST_ID,
      user: USER,
      idempotencyKey: DELETE_KEY,
      requestId: 'req_delete'
    };

    await h.service.delete(args);
    expect(h.tx.post.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: {
        publicStatus: PublicStatus.DELETED,
        deletedAt: expect.any(Date)
      }
    });

    h.prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'idm_delete',
      operation: 'post.delete',
      idempotencyKey: DELETE_KEY,
      requestFingerprint: JSON.stringify({ post_id: POST_ID }),
      expiresAt: new Date('2026-11-15T03:00:00.000Z'),
      responseJson: {}
    });
    await h.service.delete(args);
    expect(h.tx.post.update).toHaveBeenCalledTimes(1);
  });
});
