import { Injectable } from '@nestjs/common';
import {
  ModerationStatus,
  Prisma,
  PublicStatus,
  ReactionType
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import {
  decodePageCursor,
  encodePageCursor
} from '../common/page-cursor';
import { truncateGraphemes } from '../common/graphemes';
import { createUuidV7 } from '../common/uuid-v7';
import { isValidViewToken } from '../common/view-token';
import { PrismaService } from '../prisma/prisma.service';
import { ListFeedQueryDto } from './dto/list-feed-query.dto';

export interface ReactionCounts {
  hug: number;
  head_pat: number;
  cheer: number;
  total: number;
}

function emptyReactionCounts(): ReactionCounts {
  return { hug: 0, head_pat: 0, cheer: 0, total: 0 };
}

function addReaction(
  counts: ReactionCounts,
  type: ReactionType,
  amount: number
): void {
  if (type === ReactionType.HUG) {
    counts.hug += amount;
  } else if (type === ReactionType.HEAD_PAT) {
    counts.head_pat += amount;
  } else {
    counts.cheer += amount;
  }
  counts.total += amount;
}

function tagSnapshot(id: string | null, name: string | null) {
  return id && name ? { id, name } : null;
}

function publicModerationWhere(): Prisma.PostWhereInput {
  return {
    OR: [
      { moderationStatus: ModerationStatus.PASSED },
      {
        moderationStatus: ModerationStatus.PENDING,
        riskConfirmedAt: { not: null }
      }
    ]
  };
}

@Injectable()
export class PostQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async feed(query: ListFeedQueryDto) {
    const cursor = decodePageCursor(query.cursor);
    const now = new Date();
    const posts = await this.prisma.post.findMany({
      where: {
        publicStatus: PublicStatus.PUBLISHED,
        deletedAt: null,
        hiddenAt: null,
        expiresAt: { gt: now },
        AND: [publicModerationWhere()],
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
      include: {
        author: { select: { plazaNickname: true } }
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1
    });

    const page = posts.slice(0, query.limit);
    const counts = await this.countsForPosts(page.map((post) => post.id));
    const last = page.at(-1);

    return {
      data: page.map((post) => {
        const excerpt = truncateGraphemes(post.bodyText, 120);
        return {
          id: post.id,
          author_nickname: post.author.plazaNickname,
          emotion_tag: tagSnapshot(
            post.emotionTagId,
            post.emotionTagNameSnapshot
          ),
          context_tag: tagSnapshot(
            post.contextTagId,
            post.contextTagNameSnapshot
          ),
          body_excerpt: excerpt.value,
          published_at: post.publishedAt.toISOString(),
          comment_count: counts.get(post.id)?.commentCount ?? 0,
          reaction_counts:
            counts.get(post.id)?.reactionCounts ?? emptyReactionCounts()
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

  async detail(arguments_: {
    postId: string;
    user?: AuthenticatedUser;
    viewToken: string | undefined;
  }) {
    const post = await this.prisma.post.findUnique({
      where: { id: arguments_.postId },
      include: {
        author: { select: { plazaNickname: true } }
      }
    });
    if (!post || post.publicStatus === PublicStatus.DELETED) {
      throw unavailable();
    }

    const isAuthor = arguments_.user?.id === post.authorId;
    const now = new Date();
    const isExpired =
      post.publicStatus === PublicStatus.EXPIRED ||
      post.expiresAt.getTime() <= now.getTime();
    const moderationVisible =
      post.moderationStatus === ModerationStatus.PASSED ||
      (post.moderationStatus === ModerationStatus.PENDING &&
        post.riskConfirmedAt !== null);
    const publicVisible =
      post.publicStatus === PublicStatus.PUBLISHED &&
      !post.hiddenAt &&
      !isExpired &&
      moderationVisible;
    if (!isAuthor && !publicVisible) {
      throw unavailable();
    }

    if (!isAuthor) {
      if (
        !arguments_.viewToken ||
        !isValidViewToken(arguments_.viewToken)
      ) {
        throw new ApiError(
          'JIJU_VALIDATION_4221',
          422,
          '详情访问标识无效',
          { fields: { 'X-View-Token': '应为 v1:<uuid_v7>' } }
        );
      }
      await this.prisma.viewRecord.createMany({
        data: [
          {
            id: `vwr_${createUuidV7()}`,
            postId: post.id,
            viewerId: arguments_.user?.id,
            viewToken: arguments_.viewToken,
            viewedAt: now
          }
        ],
        skipDuplicates: true
      });
    }

    const counts = await this.countsForPosts([post.id]);
    const postCounts = counts.get(post.id);
    const viewCount = isAuthor
      ? await this.prisma.viewRecord.count({ where: { postId: post.id } })
      : undefined;

    return {
      id: post.id,
      content_version: post.currentContentVersion,
      author_nickname: post.author.plazaNickname,
      emotion_tag: tagSnapshot(
        post.emotionTagId,
        post.emotionTagNameSnapshot
      ),
      context_tag: tagSnapshot(
        post.contextTagId,
        post.contextTagNameSnapshot
      ),
      body_text: post.bodyText,
      published_at: post.publishedAt.toISOString(),
      expires_at: post.expiresAt.toISOString(),
      comment_count: postCounts?.commentCount ?? 0,
      reaction_counts:
        postCounts?.reactionCounts ?? emptyReactionCounts(),
      is_author: isAuthor,
      ...(isAuthor ? { view_count: viewCount } : {})
    };
  }

  private async countsForPosts(postIds: string[]) {
    const result = new Map<
      string,
      { commentCount: number; reactionCounts: ReactionCounts }
    >();
    for (const postId of postIds) {
      result.set(postId, {
        commentCount: 0,
        reactionCounts: emptyReactionCounts()
      });
    }
    if (postIds.length === 0) {
      return result;
    }

    const [comments, reactions] = await Promise.all([
      this.prisma.comment.groupBy({
        by: ['postId'],
        where: {
          postId: { in: postIds },
          deletedAt: null,
          moderationStatus: ModerationStatus.PASSED
        },
        _count: { _all: true }
      }),
      this.prisma.reaction.groupBy({
        by: ['postId', 'type'],
        where: {
          postId: { in: postIds },
          active: true
        },
        _count: { _all: true }
      })
    ]);

    for (const comment of comments) {
      result.get(comment.postId)!.commentCount = comment._count._all;
    }
    for (const reaction of reactions) {
      addReaction(
        result.get(reaction.postId)!.reactionCounts,
        reaction.type,
        reaction._count._all
      );
    }
    return result;
  }
}

function unavailable(): ApiError {
  return new ApiError(
    'JIJU_CONTENT_4041',
    404,
    '内容已不可用'
  );
}
