import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdempotencyStatus,
  ModerationStatus,
  Prisma,
  PublicStatus,
  QuotaType
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { formatBeijingDateTime } from '../common/beijing-time';
import {
  countGraphemes,
  normalizeBody,
  sanitizeForRuleMatching
} from '../common/graphemes';
import { requireIdempotencyKey } from '../common/idempotency-key';
import { stableStringify } from '../common/stable-stringify';
import { createUuidV7 } from '../common/uuid-v7';
import {
  CONTENT_RULE_ENGINE,
  ContentRuleEngine
} from '../content/content-rule-engine';
import { PrismaService } from '../prisma/prisma.service';
import {
  decodeCommentCursor,
  encodeCommentCursor
} from './comment-cursor';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';

const COMMENT_QUOTA = 10;
const COMMENT_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(CONTENT_RULE_ENGINE)
    private readonly ruleEngine: ContentRuleEngine
  ) {}

  async list(postId: string, query: ListCommentsQueryDto) {
    await this.requirePublicPost(postId);
    const cursor = decodeCommentCursor(query.cursor);
    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        deletedAt: null,
        moderationStatus: {
          in: [ModerationStatus.PASSED, ModerationStatus.PENDING]
        },
        ...(cursor
          ? {
              OR: [
                {
                  publishedAt: { gt: new Date(cursor.timestamp) }
                },
                {
                  publishedAt: new Date(cursor.timestamp),
                  id: { gt: cursor.id }
                }
              ]
            }
          : {})
      },
      include: {
        author: { select: { plazaNickname: true } }
      },
      orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1
    });
    const page = comments.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.map((comment) => ({
        id: comment.id,
        post_id: comment.postId,
        author_nickname: comment.author.plazaNickname,
        body_text: comment.bodyText,
        published_at: comment.publishedAt.toISOString()
      })),
      page: {
        has_more: comments.length > query.limit,
        next_cursor:
          comments.length > query.limit && last
            ? encodeCommentCursor({
                version: 1,
                timestamp: last.publishedAt.toISOString(),
                id: last.id
              })
            : null
      }
    };
  }

  async create(arguments_: {
    postId: string;
    user: AuthenticatedUser;
    idempotencyKey: string | undefined;
    requestId: string;
    bodyText: string;
  }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'comment.publish'
    );
    const bodyText = normalizeBody(arguments_.bodyText);
    const length = countGraphemes(bodyText);
    if (length < 1 || length > 200) {
      throw new ApiError(
        'JIJU_VALIDATION_4221',
        422,
        '内容不符合要求，请修改后重试',
        {
          fields: {
            body_text:
              length < 1
                ? '评论不能为空'
                : `评论最多 200 个可见字符，当前为 ${length}`
          }
        }
      );
    }
    const fingerprint = stableStringify({
      post_id: arguments_.postId,
      body_text: bodyText
    });
    const existing = await this.replay(
      arguments_.user.id,
      'comment.publish',
      key,
      fingerprint
    );
    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(
      async (tx) => {
        await this.requirePublicPost(arguments_.postId, tx);
        const now = new Date();
        const notice = await tx.noticeConfirmation.findUnique({
          where: {
            userId_noticeVersion: {
              userId: arguments_.user.id,
              noticeVersion:
                this.config.getOrThrow<string>('NOTICE_VERSION')
            }
          }
        });
        if (!notice) {
          throw new ApiError(
            'JIJU_ACCESS_4032',
            403,
            '请先阅读并确认当前版本使用须知'
          );
        }

        const windowStart = new Date(now.getTime() - COMMENT_WINDOW_MS);
        const recent = await tx.quotaUsage.findMany({
          where: {
            userId: arguments_.user.id,
            quotaType: QuotaType.COMMENT_ROLLING_60M,
            consumedAt: { gte: windowStart, lte: now }
          },
          orderBy: { consumedAt: 'asc' }
        });
        if (recent.length >= COMMENT_QUOTA) {
          const releaseAt = new Date(
            recent[recent.length - COMMENT_QUOTA]!.consumedAt.getTime() +
              COMMENT_WINDOW_MS
          );
          throw new ApiError(
            'JIJU_QUOTA_4292',
            429,
            `评论过于频繁，请于 ${formatBeijingDateTime(releaseAt)}（北京时间）后重试`,
            { next_available_bj: releaseAt.toISOString() }
          );
        }

        const evaluation = await this.ruleEngine.evaluate(
          sanitizeForRuleMatching(bodyText)
        );
        if (evaluation.decision === 'BLOCK') {
          throw new ApiError(
            'JIJU_VALIDATION_4221',
            422,
            '评论包含明确违规内容，请修改后重试'
          );
        }
        const comment = await tx.comment.create({
          data: {
            id: `cmt_${createUuidV7()}`,
            postId: arguments_.postId,
            authorId: arguments_.user.id,
            bodyText,
            bodyGraphemeLength: length,
            contentVersion: 1,
            moderationStatus:
              evaluation.decision === 'CONFIRM'
                ? ModerationStatus.PENDING
                : ModerationStatus.PASSED,
            publishedAt: now
          },
          include: {
            author: { select: { plazaNickname: true } }
          }
        });
        await tx.quotaUsage.create({
          data: {
            id: `qtu_${createUuidV7()}`,
            userId: arguments_.user.id,
            quotaType: QuotaType.COMMENT_ROLLING_60M,
            requestId: key,
            sourceId: comment.id,
            consumedAt: now
          }
        });
        if (evaluation.decision === 'CONFIRM') {
          await tx.moderationRecord.create({
            data: {
              id: `mdr_${createUuidV7()}`,
              targetType: 'COMMENT',
              targetId: comment.id,
              contentVersion: 1,
              status: 'PENDING',
              hitRuleRefs: evaluation.matchedRuleIds,
              moderationStatusAfter: ModerationStatus.PENDING
            }
          });
        }

        const response = {
          data: {
            id: comment.id,
            post_id: comment.postId,
            author_nickname: comment.author.plazaNickname,
            body_text: comment.bodyText,
            published_at: comment.publishedAt.toISOString()
          },
          request_id: arguments_.requestId
        };
        await tx.idempotencyRecord.create({
          data: {
            id: `idm_${createUuidV7()}`,
            actorId: arguments_.user.id,
            operation: 'comment.publish',
            idempotencyKey: key,
            requestFingerprint: fingerprint,
            status: IdempotencyStatus.SUCCEEDED,
            responseStatus: 201,
            responseJson: response,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        });
        return response;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async delete(arguments_: {
    commentId: string;
    user: AuthenticatedUser;
    idempotencyKey: string | undefined;
    requestId: string;
  }): Promise<void> {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'comment.delete'
    );
    const fingerprint = stableStringify({
      comment_id: arguments_.commentId
    });
    const existing = await this.replay(
      arguments_.user.id,
      'comment.delete',
      key,
      fingerprint
    );
    if (existing) {
      return;
    }

    await this.prisma.$transaction(
      async (tx) => {
        const comment = await tx.comment.findUnique({
          where: { id: arguments_.commentId }
        });
        if (!comment || comment.authorId !== arguments_.user.id) {
          throw new ApiError('JIJU_ACCESS_4031', 403, '你无权执行此操作');
        }
        const now = new Date();
        if (!comment.deletedAt) {
          await tx.comment.update({
            where: { id: comment.id },
            data: { deletedAt: now }
          });
        }
        await tx.idempotencyRecord.create({
          data: {
            id: `idm_${createUuidV7()}`,
            actorId: arguments_.user.id,
            operation: 'comment.delete',
            idempotencyKey: key,
            requestFingerprint: fingerprint,
            status: IdempotencyStatus.SUCCEEDED,
            responseStatus: 204,
            responseJson: {},
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async requirePublicPost(
    postId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const post = await client.post.findUnique({ where: { id: postId } });
    const now = new Date();
    const moderationVisible =
      post?.moderationStatus === ModerationStatus.PASSED ||
      (post?.moderationStatus === ModerationStatus.PENDING &&
        post.riskConfirmedAt !== null);
    if (
      !post ||
      post.publicStatus !== PublicStatus.PUBLISHED ||
      post.deletedAt ||
      post.hiddenAt ||
      post.expiresAt.getTime() <= now.getTime() ||
      !moderationVisible
    ) {
      throw new ApiError('JIJU_CONTENT_4041', 404, '内容已不可用');
    }
    return post;
  }

  private async replay(
    actorId: string,
    operation: string,
    key: string,
    fingerprint: string
  ) {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId,
          operation,
          idempotencyKey: key
        }
      }
    });
    if (!existing) {
      return null;
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      await this.prisma.idempotencyRecord.delete({
        where: { id: existing.id }
      });
      return null;
    }
    if (existing.requestFingerprint !== fingerprint) {
      throw new ApiError(
        'JIJU_CONFLICT_4091',
        409,
        '同一幂等键不能提交不同内容，请刷新后重试'
      );
    }
    return existing.responseJson as unknown as {
      data: Record<string, unknown>;
      request_id: string;
    } | null;
  }
}
