import {
  ModerationStatus,
  PublicStatus,
  ReactionType
} from '@prisma/client';
import { MyPostStatus } from './dto/list-my-posts-query.dto';
import { MyPostsService } from './my-posts.service';

const post = {
  id: 'pst_00000000-0000-7000-8000-000000000001',
  authorId: 'usr_1',
  bodyText: '我的正文',
  currentContentVersion: 2,
  emotionTagId: null,
  emotionTagNameSnapshot: null,
  contextTagId: null,
  contextTagNameSnapshot: null,
  publicStatus: PublicStatus.PUBLISHED,
  moderationStatus: ModerationStatus.PASSED,
  publishedAt: new Date('2026-11-14T02:00:00.000Z'),
  expiresAt: new Date('2026-11-21T02:00:00.000Z'),
  hiddenAt: null,
  deletedAt: null
};

function harness() {
  const prisma = {
    post: { findMany: jest.fn().mockResolvedValue([post]) },
    comment: {
      groupBy: jest.fn().mockResolvedValue([
        { postId: post.id, _count: { _all: 3 } }
      ])
    },
    reaction: {
      groupBy: jest.fn().mockResolvedValue([
        { postId: post.id, type: ReactionType.HUG, _count: { _all: 2 } }
      ])
    }
  };
  return {
    prisma,
    service: new MyPostsService(prisma as any)
  };
}

describe('MyPostsService', () => {
  it('queries only the authenticated author and omits deleted posts', async () => {
    const h = harness();
    const result = await h.service.list('usr_1', { limit: 20 });

    expect(h.prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          authorId: 'usr_1',
          publicStatus: { not: PublicStatus.DELETED },
          deletedAt: null
        })
      })
    );
    expect(result.data[0]).toMatchObject({
      id: post.id,
      content_version: 2,
      comment_count: 3,
      reaction_counts: { hug: 2, head_pat: 0, cheer: 0, total: 2 }
    });
    expect(result.data[0]).not.toHaveProperty('view_count');
  });

  it.each([
    [MyPostStatus.ACTIVE, { publicStatus: PublicStatus.PUBLISHED }],
    [MyPostStatus.HIDDEN, { publicStatus: PublicStatus.HIDDEN }]
  ])('applies the %s author status filter', async (status, expected) => {
    const h = harness();
    await h.service.list('usr_1', { limit: 20, status });
    expect(h.prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining(expected)
      })
    );
  });

  it('derives expired state for a published post past expires_at', async () => {
    const h = harness();
    h.prisma.post.findMany.mockResolvedValue([
      {
        ...post,
        expiresAt: new Date('2026-01-01T00:00:00.000Z')
      }
    ]);
    const result = await h.service.list('usr_1', {
      limit: 20,
      status: MyPostStatus.EXPIRED
    });
    expect(result.data[0].public_status).toBe(PublicStatus.EXPIRED);
  });
});
