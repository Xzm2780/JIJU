import {
  ModerationStatus,
  PublicStatus,
  ReactionType
} from '@prisma/client';
import { PostQueryService } from './post-query.service';

const post = {
  id: 'pst_00000000-0000-7000-8000-000000000001',
  authorId: 'usr_author',
  bodyText: '正文',
  bodyGraphemeLength: 2,
  emotionTagId: 'tag_emotion',
  emotionTagNameSnapshot: '疲惫',
  contextTagId: null,
  contextTagNameSnapshot: null,
  retentionHours: 168,
  publicStatus: PublicStatus.PUBLISHED,
  moderationStatus: ModerationStatus.PASSED,
  riskConfirmedAt: null,
  publishedAt: new Date('2026-11-14T02:00:00.000Z'),
  expiresAt: new Date('2099-11-21T02:00:00.000Z'),
  currentContentVersion: 1,
  editedAt: null,
  hiddenAt: null,
  deletedAt: null,
  createdAt: new Date('2026-11-14T02:00:00.000Z'),
  updatedAt: new Date('2026-11-14T02:00:00.000Z'),
  author: { plazaNickname: '晚风 1024' }
};

function createPrisma(overrides: Record<string, unknown> = {}) {
  return {
    post: {
      findMany: jest.fn().mockResolvedValue([post]),
      findUnique: jest.fn().mockResolvedValue(post),
      ...(overrides.post as object)
    },
    comment: {
      groupBy: jest.fn().mockResolvedValue([
        { postId: post.id, _count: { _all: 2 } }
      ])
    },
    reaction: {
      findUnique: jest.fn().mockResolvedValue(null),
      groupBy: jest.fn().mockResolvedValue([
        { postId: post.id, type: ReactionType.HUG, _count: { _all: 1 } }
      ])
    },
    viewRecord: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(3)
    }
  };
}

describe('PostQueryService', () => {
  it('returns a whitelisted feed without view_count', async () => {
    const prisma = createPrisma();
    const service = new PostQueryService(prisma as any);

    const result = await service.feed({ limit: 20 });

    expect(result.data[0]).toMatchObject({
      id: post.id,
      author_nickname: '晚风 1024',
      comment_count: 2,
      reaction_counts: { hug: 1, head_pat: 0, cheer: 0, total: 1 }
    });
    expect(result.data[0]).not.toHaveProperty('view_count');
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publicStatus: PublicStatus.PUBLISHED,
          deletedAt: null,
          hiddenAt: null
        })
      })
    );
  });

  it('records one non-author view and omits view_count', async () => {
    const prisma = createPrisma();
    const service = new PostQueryService(prisma as any);

    const result = await service.detail({
      postId: post.id,
      viewToken: 'v1:00000000-0000-7000-8000-000000000099'
    });

    expect(result.is_author).toBe(false);
    expect(result.content_version).toBe(1);
    expect(result.my_reaction).toBeNull();
    expect(result).not.toHaveProperty('expires_at');
    expect(result).not.toHaveProperty('view_count');
    expect(prisma.viewRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it('returns author view_count without recording another view', async () => {
    const prisma = createPrisma();
    const service = new PostQueryService(prisma as any);

    const result = await service.detail({
      postId: post.id,
      user: {
        id: 'usr_author',
        authProvider: 'MOCK',
        plazaNickname: '晚风 1024',
        accountStatus: 'ACTIVE'
      },
      viewToken: undefined
    });

    expect(result.is_author).toBe(true);
    expect(result).toHaveProperty('expires_at');
    expect(result).toHaveProperty('view_count', 3);
    expect(prisma.viewRecord.createMany).not.toHaveBeenCalled();
  });

  it('uses one unavailable response for hidden content', async () => {
    const prisma = createPrisma({
      post: {
        findUnique: jest.fn().mockResolvedValue({
          ...post,
          publicStatus: PublicStatus.HIDDEN,
          hiddenAt: new Date()
        })
      }
    });
    const service = new PostQueryService(prisma as any);

    await expect(
      service.detail({
        postId: post.id,
        viewToken: 'v1:00000000-0000-7000-8000-000000000099'
      })
    ).rejects.toMatchObject({
      code: 'JIJU_CONTENT_4041',
      status: 404,
      message: '内容已不可用'
    });
  });
});
