import {
  ModerationStatus,
  PublicStatus,
  ReportTargetType
} from '@prisma/client';
import { AdminContentListService } from './admin-content-list.service';
import {
  AdminContentStatus,
  AdminContentType
} from './dto/list-admin-content.dto';

describe('AdminContentListService', () => {
  it('lists posts with readable moderation metadata and report count', async () => {
    const prisma = {
      post: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pst_1',
            bodyText: '这是一段帖子正文',
            currentContentVersion: 2,
            publicStatus: PublicStatus.PUBLISHED,
            moderationStatus: ModerationStatus.PENDING,
            publishedAt: new Date('2026-11-15T01:00:00.000Z'),
            expiresAt: new Date('2026-11-22T01:00:00.000Z'),
            hiddenAt: null,
            deletedAt: null,
            updatedAt: new Date('2026-11-15T02:00:00.000Z'),
            author: { plazaNickname: '晚风 1024' }
          }
        ])
      },
      report: {
        groupBy: jest.fn().mockResolvedValue([
          { targetId: 'pst_1', _count: { _all: 2 } }
        ])
      }
    };
    const service = new AdminContentListService(prisma as any);
    const result = await service.list({
      target_type: AdminContentType.POST,
      status: AdminContentStatus.PENDING_REVIEW,
      limit: 20
    });
    expect(result.data[0]).toMatchObject({
      id: 'pst_1',
      target_type: ReportTargetType.POST,
      author_nickname: '晚风 1024',
      content_version: 2,
      moderation_status: ModerationStatus.PENDING,
      report_count: 2
    });
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              moderationStatus: ModerationStatus.PENDING
            })
          ])
        })
      })
    );
  });

  it('lists comments and maps deleted comments as unavailable', async () => {
    const prisma = {
      comment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cmt_1',
            bodyText: '评论正文',
            contentVersion: 1,
            moderationStatus: ModerationStatus.PASSED,
            publishedAt: new Date('2026-11-15T01:00:00.000Z'),
            deletedAt: new Date('2026-11-15T03:00:00.000Z'),
            updatedAt: new Date('2026-11-15T03:00:00.000Z'),
            author: { plazaNickname: '远山 2046' }
          }
        ])
      },
      report: {
        groupBy: jest.fn().mockResolvedValue([])
      }
    };
    const service = new AdminContentListService(prisma as any);
    const result = await service.list({
      target_type: AdminContentType.COMMENT,
      status: AdminContentStatus.DELETED,
      limit: 20
    });
    expect(result.data[0]).toMatchObject({
      id: 'cmt_1',
      target_type: ReportTargetType.COMMENT,
      public_status: PublicStatus.DELETED,
      report_count: 0
    });
  });
});
