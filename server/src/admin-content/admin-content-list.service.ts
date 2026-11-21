import { Injectable } from '@nestjs/common';
import {
  ModerationStatus,
  Prisma,
  PublicStatus,
  ReportStatus,
  ReportTargetType
} from '@prisma/client';
import { truncateGraphemes } from '../common/graphemes';
import {
  decodePageCursor,
  encodePageCursor
} from '../common/page-cursor';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminContentStatus,
  AdminContentType,
  ListAdminContentDto
} from './dto/list-admin-content.dto';

@Injectable()
export class AdminContentListService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminContentDto) {
    const cursor = decodePageCursor(query.cursor);
    const now = new Date();
    if (query.target_type === AdminContentType.COMMENT) {
      return this.listComments(query, cursor, now);
    }
    return this.listPosts(query, cursor, now);
  }

  private async listPosts(
    query: ListAdminContentDto,
    cursor: ReturnType<typeof decodePageCursor>,
    now: Date
  ) {
    const search = query.query?.trim();
    const posts = await this.prisma.post.findMany({
      where: {
        AND: [
          this.postStatusWhere(query.status, now),
          ...(search
            ? [
                {
                  OR: [
                    { bodyText: { contains: search, mode: 'insensitive' as const } },
                    {
                      author: {
                        plazaNickname: {
                          contains: search,
                          mode: 'insensitive' as const
                        }
                      }
                    }
                  ]
                }
              ]
            : []),
          this.cursorWhere(cursor)
        ]
      },
      include: { author: { select: { plazaNickname: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1
    });
    const page = posts.slice(0, query.limit);
    const reportCounts = await this.reportCounts(
      ReportTargetType.POST,
      page.map((post) => post.id)
    );
    const last = page.at(-1);
    return {
      data: page.map((post) => {
        const preview = truncateGraphemes(post.bodyText, 180);
        const publicStatus =
          post.publicStatus === PublicStatus.PUBLISHED &&
          post.expiresAt.getTime() <= now.getTime()
            ? PublicStatus.EXPIRED
            : post.publicStatus;
        return {
          id: post.id,
          target_type: ReportTargetType.POST,
          author_nickname: post.author.plazaNickname,
          body_excerpt: preview.value,
          content_version: post.currentContentVersion,
          public_status: publicStatus,
          moderation_status: post.moderationStatus,
          published_at: post.publishedAt.toISOString(),
          expires_at: post.expiresAt.toISOString(),
          hidden_at: post.hiddenAt?.toISOString() ?? null,
          deleted_at: post.deletedAt?.toISOString() ?? null,
          report_count: reportCounts.get(post.id) ?? 0
        };
      }),
      page: {
        has_more: posts.length > query.limit,
        next_cursor:
          posts.length > query.limit && last
            ? encodePageCursor({
                version: 1,
                timestamp: last.updatedAt.toISOString(),
                id: last.id
              })
            : null
      }
    };
  }

  private async listComments(
    query: ListAdminContentDto,
    cursor: ReturnType<typeof decodePageCursor>,
    _now: Date
  ) {
    const search = query.query?.trim();
    const comments = await this.prisma.comment.findMany({
      where: {
        AND: [
          this.commentStatusWhere(query.status),
          ...(search
            ? [
                {
                  OR: [
                    { bodyText: { contains: search, mode: 'insensitive' as const } },
                    {
                      author: {
                        plazaNickname: {
                          contains: search,
                          mode: 'insensitive' as const
                        }
                      }
                    }
                  ]
                }
              ]
            : []),
          this.cursorWhere(cursor)
        ]
      },
      include: {
        author: { select: { plazaNickname: true } }
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1
    });
    const page = comments.slice(0, query.limit);
    const reportCounts = await this.reportCounts(
      ReportTargetType.COMMENT,
      page.map((comment) => comment.id)
    );
    const last = page.at(-1);
    return {
      data: page.map((comment) => {
        const preview = truncateGraphemes(comment.bodyText, 180);
        const publicStatus = comment.deletedAt
          ? PublicStatus.DELETED
          : comment.moderationStatus === ModerationStatus.REJECTED
            ? PublicStatus.HIDDEN
            : PublicStatus.PUBLISHED;
        return {
          id: comment.id,
          target_type: ReportTargetType.COMMENT,
          author_nickname: comment.author.plazaNickname,
          body_excerpt: preview.value,
          content_version: comment.contentVersion,
          public_status: publicStatus,
          moderation_status: comment.moderationStatus,
          published_at: comment.publishedAt.toISOString(),
          expires_at: null,
          hidden_at:
            comment.moderationStatus === ModerationStatus.REJECTED
              ? comment.updatedAt.toISOString()
              : null,
          deleted_at: comment.deletedAt?.toISOString() ?? null,
          report_count: reportCounts.get(comment.id) ?? 0
        };
      }),
      page: {
        has_more: comments.length > query.limit,
        next_cursor:
          comments.length > query.limit && last
            ? encodePageCursor({
                version: 1,
                timestamp: last.updatedAt.toISOString(),
                id: last.id
              })
            : null
      }
    };
  }

  private postStatusWhere(
    status: AdminContentStatus,
    now: Date
  ): Prisma.PostWhereInput {
    if (status === AdminContentStatus.ACTIVE) {
      return {
        publicStatus: PublicStatus.PUBLISHED,
        expiresAt: { gt: now },
        hiddenAt: null,
        deletedAt: null
      };
    }
    if (status === AdminContentStatus.HIDDEN) {
      return { publicStatus: PublicStatus.HIDDEN };
    }
    if (status === AdminContentStatus.DELETED) {
      return { publicStatus: PublicStatus.DELETED };
    }
    if (status === AdminContentStatus.EXPIRED) {
      return {
        OR: [
          { publicStatus: PublicStatus.EXPIRED },
          {
            publicStatus: PublicStatus.PUBLISHED,
            expiresAt: { lte: now }
          }
        ]
      };
    }
    if (status === AdminContentStatus.PENDING_REVIEW) {
      return { moderationStatus: ModerationStatus.PENDING };
    }
    return {};
  }

  private commentStatusWhere(
    status: AdminContentStatus
  ): Prisma.CommentWhereInput {
    if (status === AdminContentStatus.ACTIVE) {
      return {
        deletedAt: null,
        moderationStatus: ModerationStatus.PASSED
      };
    }
    if (status === AdminContentStatus.HIDDEN) {
      return { moderationStatus: ModerationStatus.REJECTED };
    }
    if (status === AdminContentStatus.DELETED) {
      return { deletedAt: { not: null } };
    }
    if (status === AdminContentStatus.PENDING_REVIEW) {
      return { moderationStatus: ModerationStatus.PENDING };
    }
    if (status === AdminContentStatus.EXPIRED) {
      return { id: '__none__' };
    }
    return {};
  }

  private cursorWhere(
    cursor: ReturnType<typeof decodePageCursor>
  ): {
    OR?: Array<
      | { updatedAt: { lt: Date } }
      | { updatedAt: Date; id: { lt: string } }
    >;
  } {
    if (!cursor) {
      return {};
    }
    return {
      OR: [
        { updatedAt: { lt: new Date(cursor.timestamp) } },
        {
          updatedAt: new Date(cursor.timestamp),
          id: { lt: cursor.id }
        }
      ]
    };
  }

  private async reportCounts(
    targetType: ReportTargetType,
    targetIds: string[]
  ): Promise<Map<string, number>> {
    if (!targetIds.length) {
      return new Map();
    }
    const groups = await this.prisma.report.groupBy({
      by: ['targetId'],
      where: {
        targetType,
        targetId: { in: targetIds },
        status: { in: [ReportStatus.PENDING, ReportStatus.PROCESSING] }
      },
      _count: { _all: true }
    });
    return new Map(groups.map((group) => [group.targetId, group._count._all]));
  }
}
