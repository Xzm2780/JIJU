import { Injectable } from '@nestjs/common';
import {
  AdminRole,
  IdempotencyStatus,
  ModerationStatus,
  Prisma,
  PublicStatus,
  ReportTargetType
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { requireIdempotencyKey } from '../common/idempotency-key';
import { stableStringify } from '../common/stable-stringify';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContentAction,
  ContentActionDto
} from './dto/content-action.dto';
import {
  ReviewContentDto,
  ReviewDecision
} from './dto/review-content.dto';

interface AdminArguments {
  targetType: ReportTargetType;
  targetId: string;
  user: AuthenticatedUser;
  requestId: string;
  idempotencyKey: string | undefined;
}

@Injectable()
export class AdminContentService {
  constructor(private readonly prisma: PrismaService) {}

  async review(arguments_: AdminArguments & { body: ReviewContentDto }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'admin.review'
    );
    if (!arguments_.body.reason.trim()) {
      throw validation('处理原因不能为空');
    }
    const fingerprint = stableStringify({
      target_type: arguments_.targetType,
      target_id: arguments_.targetId,
      expected_content_version: arguments_.body.expected_content_version,
      decision: arguments_.body.decision,
      reason: arguments_.body.reason.trim()
    });
    const replay = await this.replay(
      arguments_.user.id,
      'admin.review',
      key,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    return this.runSerializable(async (tx) => {
      const target = await this.getTarget(
        tx,
        arguments_.targetType,
        arguments_.targetId
      );
      if (target.contentVersion !== arguments_.body.expected_content_version) {
        throw new ApiError(
          'JIJU_CONFLICT_4092',
          409,
          '内容已更新，请刷新后重试'
        );
      }
      if (target.moderationStatus !== ModerationStatus.PENDING) {
        throw new ApiError(
          'JIJU_CONFLICT_4091',
          409,
          '内容状态已变化，请刷新后重试'
        );
      }

      const now = new Date();
      const nextModeration =
        arguments_.body.decision === ReviewDecision.PASSED
          ? ModerationStatus.PASSED
          : ModerationStatus.REJECTED;
      let nextPublic = target.publicStatus;
      if (arguments_.targetType === ReportTargetType.POST) {
        if (nextModeration === ModerationStatus.REJECTED) {
          nextPublic = PublicStatus.HIDDEN;
        }
        await tx.post.update({
          where: { id: arguments_.targetId },
          data: {
            moderationStatus: nextModeration,
            ...(nextPublic === PublicStatus.HIDDEN
              ? { publicStatus: PublicStatus.HIDDEN, hiddenAt: now }
              : {})
          }
        });
      } else {
        await tx.comment.update({
          where: { id: arguments_.targetId },
          data: { moderationStatus: nextModeration }
        });
      }

      const record =
        (await tx.moderationRecord.findFirst({
          where: {
            targetType: arguments_.targetType,
            targetId: arguments_.targetId,
            contentVersion: target.contentVersion,
            status: 'PENDING'
          },
          orderBy: { reviewRound: 'desc' }
        })) ??
        (await tx.moderationRecord.create({
          data: {
            id: `mdr_${createUuidV7()}`,
            targetType: arguments_.targetType,
            targetId: arguments_.targetId,
            contentVersion: target.contentVersion,
            status: 'PENDING'
          }
        }));
      const reviewed = await tx.moderationRecord.update({
        where: { id: record.id },
        data: {
          status: 'RESOLVED',
          moderationStatusAfter: nextModeration,
          publicStatusAfter: nextPublic,
          handledBy: arguments_.user.id,
          handledAt: now,
          reason: arguments_.body.reason.trim()
        }
      });
      await this.audit(tx, arguments_, {
        actionType: `REVIEW_${arguments_.body.decision}`,
        contentVersion: target.contentVersion,
        stateBefore: {
          moderation_status: target.moderationStatus,
          public_status: target.publicStatus
        },
        stateAfter: {
          moderation_status: nextModeration,
          public_status: nextPublic
        },
        reason: arguments_.body.reason.trim()
      });
      const response = {
        data: {
          id: reviewed.id,
          target_type: arguments_.targetType,
          target_id: arguments_.targetId,
          content_version: target.contentVersion,
          review_round: reviewed.reviewRound,
          moderation_status: nextModeration,
          public_status: nextPublic,
          handled_by: arguments_.user.id,
          handled_at: now.toISOString(),
          reason: arguments_.body.reason.trim()
        },
        request_id: arguments_.requestId
      };
      await this.store(
        tx,
        arguments_.user.id,
        'admin.review',
        key,
        fingerprint,
        response
      );
      return response;
    });
  }

  async action(arguments_: AdminArguments & { body: ContentActionDto }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'admin.content.action'
    );
    if (!arguments_.body.reason.trim()) {
      throw validation('处理原因不能为空');
    }
    if (arguments_.targetType !== ReportTargetType.POST) {
      if (arguments_.body.action === ContentAction.RESTORE) {
        throw new ApiError(
          'JIJU_CONTENT_4221',
          422,
          '内容已不可用'
        );
      }
    }
    const fingerprint = stableStringify({
      target_type: arguments_.targetType,
      target_id: arguments_.targetId,
      action: arguments_.body.action,
      expected_content_version: arguments_.body.expected_content_version,
      reason: arguments_.body.reason.trim()
    });
    const replay = await this.replay(
      arguments_.user.id,
      'admin.content.action',
      key,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    return this.runSerializable(async (tx) => {
      const target = await this.getTarget(
        tx,
        arguments_.targetType,
        arguments_.targetId
      );
      if (target.contentVersion !== arguments_.body.expected_content_version) {
        throw new ApiError(
          'JIJU_CONFLICT_4092',
          409,
          '内容已更新，请刷新后重试'
        );
      }
      const now = new Date();
      const before = {
        publicStatus: target.publicStatus,
        moderationStatus: target.moderationStatus
      };
      let nextPublic = target.publicStatus;
      let nextModeration = target.moderationStatus;

      if (arguments_.targetType === ReportTargetType.POST) {
        if (arguments_.body.action === ContentAction.RESTORE) {
          if (
            target.publicStatus !== PublicStatus.HIDDEN ||
            target.deletedAt ||
            target.expiresAt.getTime() <= now.getTime() ||
            target.moderationStatus === ModerationStatus.REJECTED
          ) {
            throw new ApiError('JIJU_CONTENT_4221', 422, '内容已不可用');
          }
          nextPublic = PublicStatus.PUBLISHED;
        } else {
          if (target.deletedAt) {
            throw new ApiError('JIJU_CONTENT_4221', 422, '内容已不可用');
          }
          nextPublic = PublicStatus.HIDDEN;
        }
        await tx.post.update({
          where: { id: arguments_.targetId },
          data: {
            publicStatus: nextPublic,
            ...(nextPublic === PublicStatus.HIDDEN
              ? { hiddenAt: now }
              : { hiddenAt: null })
          }
        });
      } else {
        nextModeration = ModerationStatus.REJECTED;
        await tx.comment.update({
          where: { id: arguments_.targetId },
          data: { moderationStatus: nextModeration }
        });
      }

      const moderation = await tx.moderationRecord.create({
        data: {
          id: `mdr_${createUuidV7()}`,
          targetType: arguments_.targetType,
          targetId: arguments_.targetId,
          contentVersion: target.contentVersion,
          status: 'RESOLVED',
          moderationStatusAfter: nextModeration,
          publicStatusAfter: nextPublic,
          handledBy: arguments_.user.id,
          handledAt: now,
          reason: arguments_.body.reason.trim()
        }
      });
      await this.audit(tx, arguments_, {
        actionType: arguments_.body.action,
        contentVersion: target.contentVersion,
        stateBefore: {
          moderation_status: before.moderationStatus,
          public_status: before.publicStatus,
          expires_at: target.expiresAt.toISOString()
        },
        stateAfter: {
          moderation_status: nextModeration,
          public_status: nextPublic,
          expires_at: target.expiresAt.toISOString()
        },
        reason: arguments_.body.reason.trim()
      });
      const response = {
        data: {
          action: arguments_.body.action,
          public_status_before: before.publicStatus,
          public_status_after: nextPublic,
          moderation_status_before: before.moderationStatus,
          moderation_status_after: nextModeration,
          handled_at: now.toISOString()
        },
        request_id: arguments_.requestId
      };
      await this.store(
        tx,
        arguments_.user.id,
        'admin.content.action',
        key,
        fingerprint,
        response
      );
      return response;
    });
  }

  private async getTarget(
    tx: Prisma.TransactionClient,
    targetType: ReportTargetType,
    targetId: string
  ) {
    if (targetType === ReportTargetType.POST) {
      const post = await tx.post.findUnique({ where: { id: targetId } });
      if (!post || post.deletedAt) {
        throw new ApiError('JIJU_CONTENT_4041', 404, '内容已不可用');
      }
      return {
        contentVersion: post.currentContentVersion,
        publicStatus: post.publicStatus,
        moderationStatus: post.moderationStatus,
        expiresAt: post.expiresAt,
        deletedAt: post.deletedAt
      };
    }
    const comment = await tx.comment.findUnique({
      where: { id: targetId }
    });
    if (!comment || comment.deletedAt) {
      throw new ApiError('JIJU_CONTENT_4041', 404, '内容已不可用');
    }
    return {
      contentVersion: comment.contentVersion,
      publicStatus: PublicStatus.PUBLISHED,
      moderationStatus: comment.moderationStatus,
      expiresAt: new Date(8640000000000000),
      deletedAt: null
    };
  }

  private async audit(
    tx: Prisma.TransactionClient,
    arguments_: AdminArguments,
    event: {
      actionType: string;
      contentVersion: number;
      stateBefore: Prisma.InputJsonValue;
      stateAfter: Prisma.InputJsonValue;
      reason: string;
    }
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        id: `aud_${createUuidV7()}`,
        actorId: arguments_.user.id,
        actorRole: AdminRole.CONTENT_MODERATOR,
        actionType: event.actionType,
        objectType: 'CONTENT',
        objectId: arguments_.targetId,
        contentVersion: event.contentVersion,
        stateBefore: event.stateBefore,
        stateAfter: event.stateAfter,
        reason: event.reason,
        requestId: arguments_.requestId
      }
    });
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
    if (existing.requestFingerprint !== fingerprint) {
      throw new ApiError(
        'JIJU_CONFLICT_4091',
        409,
        '同一幂等键不能提交不同操作，请刷新后重试'
      );
    }
    return existing.responseJson as unknown as {
      data: Record<string, unknown>;
      request_id: string;
    };
  }

  private async store(
    tx: Prisma.TransactionClient,
    actorId: string,
    operation: string,
    key: string,
    fingerprint: string,
    response: {
      data: Record<string, unknown>;
      request_id: string;
    }
  ): Promise<void> {
    const now = new Date();
    await tx.idempotencyRecord.create({
      data: {
        id: `idm_${createUuidV7()}`,
        actorId,
        operation,
        idempotencyKey: key,
        requestFingerprint: fingerprint,
        status: IdempotencyStatus.SUCCEEDED,
        responseStatus: 200,
        responseJson: response as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      }
    });
  }

  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
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

function validation(message: string): ApiError {
  return new ApiError('JIJU_VALIDATION_4221', 422, message);
}
