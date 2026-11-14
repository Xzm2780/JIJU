import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdempotencyStatus,
  ModerationPriority,
  ModerationStatus,
  Prisma,
  PublicStatus,
  QuotaType,
  TagCategory
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import {
  beijingDayWindow,
  formatBeijingDateTime
} from '../common/beijing-time';
import { parseDurationMilliseconds } from '../common/duration';
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
import { RedisService } from '../redis/redis.service';
import { PublishPostDto } from './dto/publish-post.dto';
import {
  PublishChallengeService,
  StoredChallenge
} from './publish-challenge.service';

const RATE_LIMIT = 5;
interface PublishArguments {
  user: AuthenticatedUser;
  idempotencyKey: string | undefined;
  requestId: string;
  body: PublishPostDto;
}

@Injectable()
export class PostsService {
  private readonly idempotencyTtlMilliseconds: number;
  private readonly idempotencyLockTtlMilliseconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly challenges: PublishChallengeService,
    private readonly config: ConfigService,
    @Inject(CONTENT_RULE_ENGINE)
    private readonly ruleEngine: ContentRuleEngine
  ) {
    this.idempotencyTtlMilliseconds = parseDurationMilliseconds(
      config.get<string>('IDEMPOTENCY_TTL') ?? '24h'
    );
    this.idempotencyLockTtlMilliseconds = parseDurationMilliseconds(
      config.get<string>('IDEMPOTENCY_LOCK_TTL') ?? '30s'
    );
  }

  async publish(arguments_: PublishArguments) {
    const { user, idempotencyKey, requestId, body } = arguments_;
    const normalizedIdempotencyKey = requireIdempotencyKey(
      idempotencyKey,
      'post.publish'
    );

    const normalizedBody = normalizeBody(body.body_text);
    const bodyGraphemeLength = countGraphemes(normalizedBody);
    if (bodyGraphemeLength < 1 || bodyGraphemeLength > 500) {
      throw new ApiError('JIJU_VALIDATION_4221', 422, '内容不符合要求，请修改后重试', {
        fields: {
          body_text:
            bodyGraphemeLength < 1
              ? '正文不能为空'
              : `正文最多 500 个可见字符，当前为 ${bodyGraphemeLength}`
        }
      });
    }
    if (![24, 72, 168].includes(body.retention_hours)) {
      throw new ApiError('JIJU_VALIDATION_4221', 422, '留存时长无效', {
        fields: { retention_hours: '仅允许 24、72 或 168 小时' }
      });
    }

    const riskAcknowledged = body.risk_acknowledged === true;
    const contentFingerprint = stableStringify({
      body_text: normalizedBody,
      emotion_tag_id: body.emotion_tag_id || null,
      context_tag_id: body.context_tag_id || null,
      retention_hours: body.retention_hours
    });
    const fingerprint = stableStringify({
      content_fingerprint: contentFingerprint,
      risk_acknowledged: riskAcknowledged
    });
    const lockKey = `idempotency-lock:${user.id}:post.publish:${normalizedIdempotencyKey}`;
    const lockToken = `req_${createUuidV7()}`;
    const lock = await this.redis.client.set(
      lockKey,
      lockToken,
      'PX',
      this.idempotencyLockTtlMilliseconds,
      'NX'
    );
    if (lock !== 'OK') {
      const replay = await this.waitForIdempotentResponse(
        user.id,
        normalizedIdempotencyKey,
        fingerprint
      );
      if (replay) {
        return replay;
      }
      throw new ApiError(
        'JIJU_CONFLICT_4091',
        409,
        '发布请求正在处理中，请稍后重试'
      );
    }

    try {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: user.id,
            operation: 'post.publish',
            idempotencyKey: normalizedIdempotencyKey
          }
        }
      });
      if (existing) {
        if (existing.expiresAt.getTime() > Date.now()) {
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
          };
        }
        await this.prisma.idempotencyRecord.delete({
          where: { id: existing.id }
        });
      }

      const noticeVersion = this.config.getOrThrow<string>('NOTICE_VERSION');
      const result = await this.runSerializable(async (tx) => {
        const notice = await tx.noticeConfirmation.findUnique({
          where: {
            userId_noticeVersion: {
              userId: user.id,
              noticeVersion
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

        const tagIds = [body.emotion_tag_id, body.context_tag_id].filter(
          (value): value is string => Boolean(value)
        );
        const tags = tagIds.length
          ? await tx.tag.findMany({
              where: { id: { in: tagIds }, enabled: true }
            })
          : [];
        if (tags.length !== tagIds.length) {
          throw new ApiError(
            'JIJU_VALIDATION_4221',
            422,
            '标签无效或已停用',
            { fields: { tags: '请重新加载标签目录' } }
          );
        }
        const emotionTag = tags.find((tag) => tag.id === body.emotion_tag_id);
        const contextTag = tags.find((tag) => tag.id === body.context_tag_id);
        if (
          (emotionTag && emotionTag.category !== TagCategory.EMOTION) ||
          (contextTag && contextTag.category !== TagCategory.CONTEXT)
        ) {
          throw new ApiError(
            'JIJU_VALIDATION_4221',
            422,
            '标签分类无效',
            { fields: { tags: '标签分类不匹配' } }
          );
        }

        const evaluation = await this.ruleEngine.evaluate(
          sanitizeForRuleMatching(normalizedBody)
        );
        if (evaluation.decision === 'BLOCK') {
          throw new ApiError(
            'JIJU_VALIDATION_4221',
            422,
            '内容包含明确违规内容，请修改后重试',
            { fields: { body_text: '命中明确阻断规则' } }
          );
        }
        let confirmedChallenge: StoredChallenge | null = null;
        if (evaluation.decision === 'CONFIRM') {
          confirmedChallenge = await this.resolveChallenge(
            user.id,
            contentFingerprint,
            body.risk_challenge_id,
            riskAcknowledged,
            evaluation
          );
        }

        const now = new Date();
        const day = beijingDayWindow(now);
        const used = await tx.quotaUsage.count({
          where: {
            userId: user.id,
            quotaType: QuotaType.POST_DAILY,
            consumedAt: { gte: day.start, lt: day.end }
          }
        });
        if (used >= RATE_LIMIT) {
          throw new ApiError(
            'JIJU_QUOTA_4291',
            429,
            `今日发帖次数已达上限，请于 ${formatBeijingDateTime(day.end)}（北京时间）后重试`,
            { next_available_bj: day.end.toISOString(), remaining: 0 }
          );
        }

        const postId = `pst_${createUuidV7()}`;
        const needsReview = evaluation.decision === 'CONFIRM';
        const post = await tx.post.create({
          data: {
            id: postId,
            authorId: user.id,
            bodyText: normalizedBody,
            bodyGraphemeLength,
            emotionTagId: emotionTag?.id,
            emotionTagNameSnapshot: emotionTag?.name,
            contextTagId: contextTag?.id,
            contextTagNameSnapshot: contextTag?.name,
            retentionHours: body.retention_hours,
            publicStatus: PublicStatus.PUBLISHED,
            moderationStatus: needsReview
              ? ModerationStatus.PENDING
              : ModerationStatus.PASSED,
            riskConfirmedAt: needsReview ? now : null,
            publishedAt: now,
            expiresAt: new Date(
              now.getTime() + body.retention_hours * 60 * 60 * 1000
            ),
            currentContentVersion: 1
          }
        });

        await tx.postVersion.create({
          data: {
            id: `pvr_${createUuidV7()}`,
            postId,
            versionNumber: 1,
            bodyText: normalizedBody,
            bodyGraphemeLength,
            emotionTagId: emotionTag?.id,
            emotionTagNameSnapshot: emotionTag?.name,
            contextTagId: contextTag?.id,
            contextTagNameSnapshot: contextTag?.name
          }
        });
        await tx.quotaUsage.create({
          data: {
            id: `qtu_${createUuidV7()}`,
            userId: user.id,
            quotaType: QuotaType.POST_DAILY,
            requestId: normalizedIdempotencyKey,
            sourceId: post.id,
            consumedAt: now
          }
        });

        if (needsReview && confirmedChallenge) {
          await tx.moderationRecord.create({
            data: {
              id: `mdr_${createUuidV7()}`,
              targetType: 'POST',
              targetId: post.id,
              contentVersion: 1,
              priority: ModerationPriority.NORMAL,
              status: 'PENDING',
              hitRuleRefs: evaluation.matchedRuleIds,
              moderationStatusAfter: ModerationStatus.PENDING,
              publicStatusAfter: PublicStatus.PUBLISHED
            }
          });
        }

        const response = {
          data: {
            id: post.id,
            content_version: post.currentContentVersion,
            public_status: post.publicStatus,
            moderation_status: post.moderationStatus,
            published_at: post.publishedAt.toISOString(),
            expires_at: post.expiresAt.toISOString()
          },
          request_id: requestId
        };

        await tx.idempotencyRecord.create({
          data: {
            id: `idm_${createUuidV7()}`,
            actorId: user.id,
            operation: 'post.publish',
            idempotencyKey: normalizedIdempotencyKey,
            requestFingerprint: fingerprint,
            status: IdempotencyStatus.SUCCEEDED,
            responseStatus: 201,
            responseJson: response,
            expiresAt: new Date(
              now.getTime() + this.idempotencyTtlMilliseconds
            )
          }
        });

        return {
          response,
          challengeId: confirmedChallenge?.id ?? null
        };
      });

      if (result.challengeId) {
        await this.challenges.consume(result.challengeId);
      }
      return result.response;
    } finally {
      await this.redis.client.del(lockKey);
    }
  }

  private async resolveChallenge(
    userId: string,
    fingerprint: string,
    challengeId: string | undefined,
    riskAcknowledged: boolean,
    evaluation: Awaited<ReturnType<ContentRuleEngine['evaluate']>>
  ): Promise<StoredChallenge> {
    if (riskAcknowledged && challengeId) {
      const challenge = await this.challenges.get(challengeId);
      if (
        challenge &&
        challenge.userId === userId &&
        challenge.contentFingerprint === fingerprint &&
        challenge.promptVersion === evaluation.promptVersion &&
        new Date(challenge.expiresAt).getTime() > Date.now()
      ) {
        return challenge;
      }
    }

    const challenge = await this.challenges.create(
      userId,
      fingerprint,
      evaluation.promptVersion,
      evaluation.resourceVersion,
      evaluation.resources
    );
    throw new ApiError(
      'JIJU_MODERATION_4092',
      409,
      '请确认风险提示后再发布',
      {
        challenge_id: challenge.id,
        prompt_version: challenge.promptVersion,
        resource_version: challenge.resourceVersion,
        resources: challenge.resources
      }
    );
  }

  private async waitForIdempotentResponse(
    userId: string,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<{
    data: Record<string, unknown>;
    request_id: string;
  } | null> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: userId,
            operation: 'post.publish',
            idempotencyKey
          }
        }
      });
      if (!existing || existing.expiresAt.getTime() <= Date.now()) {
        continue;
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
      };
    }
    return null;
  }

  private async runSerializable<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        lastError = error;
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034'
        ) {
          throw error;
        }
      }
    }
    throw lastError;
  }
}
