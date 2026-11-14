import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdempotencyStatus,
  ModerationPriority,
  ModerationStatus,
  Prisma,
  PublicStatus,
  TagCategory
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { assertActionAllowed } from '../common/account-restrictions';
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
import { PublishChallengeService } from './publish-challenge.service';
import { EditPostDto } from './dto/edit-post.dto';

interface MutationArguments {
  postId: string;
  user: AuthenticatedUser;
  idempotencyKey: string | undefined;
  requestId: string;
  body?: EditPostDto;
}

@Injectable()
export class PostMutationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly challenges: PublishChallengeService,
    @Inject(CONTENT_RULE_ENGINE)
    private readonly ruleEngine: ContentRuleEngine
  ) {}

  async edit(arguments_: MutationArguments) {
    assertActionAllowed(arguments_.user, 'post');
    const body = arguments_.body;
    if (!body) {
      throw new ApiError('JIJU_VALIDATION_4221', 422, '缺少编辑内容');
    }
    const idempotencyKey = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'post.edit'
    );
    if (
      body.body_text === undefined &&
      body.emotion_tag_id === undefined &&
      body.context_tag_id === undefined
    ) {
      throw new ApiError(
        'JIJU_VALIDATION_4221',
        422,
        '请至少提供一个可编辑字段'
      );
    }

    const normalizedBody =
      body.body_text === undefined ? undefined : normalizeBody(body.body_text);
    if (normalizedBody !== undefined) {
      const length = countGraphemes(normalizedBody);
      if (length < 1 || length > 500) {
        throw new ApiError(
          'JIJU_VALIDATION_4221',
          422,
          '内容不符合要求，请修改后重试',
          {
            fields: {
              body_text:
                length < 1
                  ? '正文不能为空'
                  : `正文最多 500 个可见字符，当前为 ${length}`
            }
          }
        );
      }
    }

    const fingerprint = stableStringify({
      expected_content_version: body.expected_content_version,
      body_text: normalizedBody ?? null,
      emotion_tag_id:
        body.emotion_tag_id === undefined ? '__unchanged__' : body.emotion_tag_id,
      context_tag_id:
        body.context_tag_id === undefined ? '__unchanged__' : body.context_tag_id,
      risk_acknowledged: body.risk_acknowledged === true
    });
    const existing = await this.idempotentReplay(
      arguments_.user.id,
      'post.edit',
      idempotencyKey,
      fingerprint
    );
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
        const post = await tx.post.findUnique({
          where: { id: arguments_.postId }
        });
        if (!post || post.authorId !== arguments_.user.id) {
          throw new ApiError('JIJU_ACCESS_4031', 403, '你无权执行此操作');
        }
        const now = new Date();
        if (
          post.publicStatus !== PublicStatus.PUBLISHED ||
          post.expiresAt.getTime() <= now.getTime() ||
          post.moderationStatus === ModerationStatus.REJECTED
        ) {
          throw unavailable();
        }
        if (post.currentContentVersion !== body.expected_content_version) {
          throw new ApiError(
            'JIJU_CONFLICT_4092',
            409,
            '内容已更新，请刷新后重试'
          );
        }

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

        const requestedTagIds = [
          body.emotion_tag_id,
          body.context_tag_id
        ].filter(
          (value): value is string =>
            value !== undefined && value !== null && value !== ''
        );
        const tags = requestedTagIds.length
          ? await tx.tag.findMany({
              where: { id: { in: requestedTagIds }, enabled: true }
            })
          : [];
        if (tags.length !== new Set(requestedTagIds).size) {
          throw new ApiError('JIJU_VALIDATION_4221', 422, '标签无效或已停用');
        }
        const emotionTag =
          body.emotion_tag_id === undefined
            ? null
            : tags.find((tag) => tag.id === body.emotion_tag_id) ?? null;
        const contextTag =
          body.context_tag_id === undefined
            ? null
            : tags.find((tag) => tag.id === body.context_tag_id) ?? null;
        if (
          (emotionTag && emotionTag.category !== TagCategory.EMOTION) ||
          (contextTag && contextTag.category !== TagCategory.CONTEXT)
        ) {
          throw new ApiError('JIJU_VALIDATION_4221', 422, '标签分类无效');
        }

        let nextModeration = post.moderationStatus;
        let riskConfirmedAt = post.riskConfirmedAt;
        let matchedRuleIds: string[] = [];
        if (normalizedBody !== undefined) {
          const evaluation = await this.ruleEngine.evaluate(
            sanitizeForRuleMatching(normalizedBody)
          );
          if (evaluation.decision === 'BLOCK') {
            throw new ApiError(
              'JIJU_VALIDATION_4221',
              422,
              '内容包含明确违规内容，请修改后重试'
            );
          }
          if (evaluation.decision === 'CONFIRM') {
            if (body.risk_acknowledged !== true) {
              const challenge = await this.challenges.create(
                arguments_.user.id,
                fingerprint,
                evaluation.promptVersion,
                evaluation.resourceVersion,
                evaluation.resources
              );
              throw new ApiError(
                'JIJU_MODERATION_4092',
                409,
                '请确认风险提示后再提交',
                {
                  challenge_id: challenge.id,
                  prompt_version: challenge.promptVersion,
                  resource_version: challenge.resourceVersion,
                  resources: challenge.resources
                }
              );
            }
            nextModeration = ModerationStatus.PENDING;
            riskConfirmedAt = now;
            matchedRuleIds = evaluation.matchedRuleIds;
          }
        }

        const nextVersion = post.currentContentVersion + 1;
        const nextBody = normalizedBody ?? post.bodyText;
        const nextEmotionId =
          body.emotion_tag_id === undefined
            ? post.emotionTagId
            : body.emotion_tag_id || null;
        const nextEmotionName =
          body.emotion_tag_id === undefined
            ? post.emotionTagNameSnapshot
            : emotionTag?.name ?? null;
        const nextContextId =
          body.context_tag_id === undefined
            ? post.contextTagId
            : body.context_tag_id || null;
        const nextContextName =
          body.context_tag_id === undefined
            ? post.contextTagNameSnapshot
            : contextTag?.name ?? null;

        await tx.postVersion.create({
          data: {
            id: `pvr_${createUuidV7()}`,
            postId: post.id,
            versionNumber: nextVersion,
            bodyText: nextBody,
            bodyGraphemeLength: countGraphemes(nextBody),
            emotionTagId: nextEmotionId,
            emotionTagNameSnapshot: nextEmotionName,
            contextTagId: nextContextId,
            contextTagNameSnapshot: nextContextName
          }
        });
        const updated = await tx.post.update({
          where: { id: post.id },
          data: {
            bodyText: nextBody,
            bodyGraphemeLength: countGraphemes(nextBody),
            emotionTagId: nextEmotionId,
            emotionTagNameSnapshot: nextEmotionName,
            contextTagId: nextContextId,
            contextTagNameSnapshot: nextContextName,
            currentContentVersion: nextVersion,
            editedAt: now,
            moderationStatus: nextModeration,
            riskConfirmedAt
          }
        });

        if (matchedRuleIds.length) {
          await tx.moderationRecord.create({
            data: {
              id: `mdr_${createUuidV7()}`,
              targetType: 'POST',
              targetId: post.id,
              contentVersion: nextVersion,
              priority: ModerationPriority.NORMAL,
              status: 'PENDING',
              hitRuleRefs: matchedRuleIds,
              moderationStatusAfter: ModerationStatus.PENDING,
              publicStatusAfter: PublicStatus.PUBLISHED
            }
          });
        }

        const response = {
          data: {
            id: updated.id,
            content_version: updated.currentContentVersion,
            public_status: updated.publicStatus,
            moderation_status: updated.moderationStatus,
            published_at: updated.publishedAt.toISOString(),
            expires_at: updated.expiresAt.toISOString(),
            edited_at: updated.editedAt!.toISOString()
          },
          request_id: arguments_.requestId
        };
        await tx.idempotencyRecord.create({
          data: {
            id: `idm_${createUuidV7()}`,
            actorId: arguments_.user.id,
            operation: 'post.edit',
            idempotencyKey,
            requestFingerprint: fingerprint,
            status: IdempotencyStatus.SUCCEEDED,
            responseStatus: 200,
            responseJson: response,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        });
        return response;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.idempotentReplay(
          arguments_.user.id,
          'post.edit',
          idempotencyKey,
          fingerprint
        );
        if (replay) {
          return replay;
        }
      }
      throw error;
    }
  }

  async delete(arguments_: MutationArguments): Promise<void> {
    assertActionAllowed(arguments_.user, 'post');
    const idempotencyKey = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'post.delete'
    );
    const fingerprint = stableStringify({ post_id: arguments_.postId });
    const existing = await this.idempotentReplay(
      arguments_.user.id,
      'post.delete',
      idempotencyKey,
      fingerprint
    );
    if (existing) {
      return;
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
        const post = await tx.post.findUnique({
          where: { id: arguments_.postId }
        });
        if (!post || post.authorId !== arguments_.user.id) {
          throw new ApiError('JIJU_ACCESS_4031', 403, '你无权执行此操作');
        }
        const now = new Date();
        if (post.publicStatus !== PublicStatus.DELETED) {
          await tx.post.update({
            where: { id: post.id },
            data: {
              publicStatus: PublicStatus.DELETED,
              deletedAt: now
            }
          });
        }
        await tx.idempotencyRecord.create({
          data: {
            id: `idm_${createUuidV7()}`,
            actorId: arguments_.user.id,
            operation: 'post.delete',
            idempotencyKey,
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.idempotentReplay(
          arguments_.user.id,
          'post.delete',
          idempotencyKey,
          fingerprint
        );
        if (replay) {
          return;
        }
      }
      throw error;
    }
  }

  private async idempotentReplay(
    actorId: string,
    operation: string,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<{ data: Record<string, unknown>; request_id: string } | null> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId,
          operation,
          idempotencyKey
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

function unavailable(): ApiError {
  return new ApiError('JIJU_CONTENT_4221', 422, '内容已不可用');
}
