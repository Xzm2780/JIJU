import { Injectable } from '@nestjs/common';
import {
  ModerationStatus,
  Prisma,
  PublicStatus,
  ReactionType
} from '@prisma/client';
import { ApiError } from '../common/api-error';
import { truncateGraphemes } from '../common/graphemes';
import {
  decodePageCursor,
  encodePageCursor
} from '../common/page-cursor';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListMyPostsQueryDto,
  MyPostStatus
} from './dto/list-my-posts-query.dto';

@Injectable()
export class MyPostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListMyPostsQueryDto) {
    const cursor = decodePageCursor(query.cursor);
    const now = new Date();
    const statusWhere = this.statusWhere(query.status, now);
    const posts = await this.prisma.post.findMany({
      where: {
        authorId: userId,
        publicStatus: { not: PublicStatus.DELETED },
        deletedAt: null,
        ...statusWhere,
        ...(cursor
          ? {
              OR: [
                { publishedAt: { lt: new Date(cursor.timestamp) } },
                {
                  publishedAt: new Date(cursor.timestamp),
                  id: { lt: cursor.id }
                }
              ]
            }
          : {})
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1
    });
    const page = posts.slice(0, query.limit);
    const counts = await this.counts(page.map((post) => post.id));
    const last = page.at(-1);

    return {
      data: page.map((post) => {
        const excerpt = truncateGraphemes(post.bodyText, 120);
        const derivedPublicStatus =
          post.publicStatus === PublicStatus.PUBLISHED &&
          post.expiresAt.getTime() <= now.getTime()
            ? PublicStatus.EXPIRED
            : post.publicStatus;
        return {
          id: post.id,
          content_version: post.currentContentVersion,
          body_excerpt: excerpt.value,
          emotion_tag:
            post.emotionTagId && post.emotionTagNameSnapshot
              ? { id: post.emotionTagId, name: post.emotionTagNameSnapshot }
              : null,
          context_tag:
            post.contextTagId && post.contextTagNameSnapshot
              ? { id: post.contextTagId, name: post.contextTagNameSnapshot }
              : null,
          public_status: derivedPublicStatus,
          moderation_status: post.moderationStatus,
          published_at: post.publishedAt.toISOString(),
          expires_at: post.expiresAt.toISOString(),
          comment_count: counts.get(post.id)?.comment_count ?? 0,
          reaction_counts:
            counts.get(post.id)?.reaction_counts ?? {
              hug: 0,
              head_pat: 0,
              cheer: 0,
              total: 0
            }
        };
      }),
      page: {
        has_more: posts.length > query.limit,
        next_cursor:
          posts.length > query.limit && last
            ? encodePageCursor({
                version: 1,
                timestamp: last.publishedAt.toISOString(),
                id: last.id
              })
            : null
      }
    };
  }

  private statusWhere(
    status: MyPostStatus | undefined,
    now: Date
  ): Prisma.PostWhereInput {
    if (!status) {
      return {};
    }
    if (status === MyPostStatus.ACTIVE) {
      return {
        publicStatus: PublicStatus.PUBLISHED,
        expiresAt: { gt: now },
        hiddenAt: null
      };
    }
    if (status === MyPostStatus.HIDDEN) {
      return { publicStatus: PublicStatus.HIDDEN };
    }
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

  private async counts(postIds: string[]) {
    const result = new Map<
      string,
      {
        comment_count: number;
        reaction_counts: {
          hug: number;
          head_pat: number;
          cheer: number;
          total: number;
        };
      }
    >();
    for (const postId of postIds) {
      result.set(postId, {
        comment_count: 0,
        reaction_counts: { hug: 0, head_pat: 0, cheer: 0, total: 0 }
      });
    }
    if (!postIds.length) {
      return result;
    }
    const [comments, reactions] = await Promise.all([
      this.prisma.comment.groupBy({
        by: ['postId'],
        where: {
          postId: { in: postIds },
          deletedAt: null,
          moderationStatus: {
            in: [ModerationStatus.PASSED, ModerationStatus.PENDING]
          }
        },
        _count: { _all: true }
      }),
      this.prisma.reaction.groupBy({
        by: ['postId', 'type'],
        where: { postId: { in: postIds }, active: true },
        _count: { _all: true }
      })
    ]);
    for (const item of comments) {
      result.get(item.postId)!.comment_count = item._count._all;
    }
    for (const item of reactions) {
      const value = result.get(item.postId)!;
      if (item.type === ReactionType.HUG) {
        value.reaction_counts.hug = item._count._all;
      } else if (item.type === ReactionType.HEAD_PAT) {
        value.reaction_counts.head_pat = item._count._all;
      } else {
        value.reaction_counts.cheer = item._count._all;
      }
      value.reaction_counts.total += item._count._all;
    }
    return result;
  }
}
