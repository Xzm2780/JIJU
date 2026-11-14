import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdempotencyStatus,
  ModerationPriority,
  ModerationStatus,
  Prisma,
  PublicStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { requireIdempotencyKey } from '../common/idempotency-key';
import { stableStringify } from '../common/stable-stringify';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async create(arguments_: {
    user: AuthenticatedUser;
    idempotencyKey: string | undefined;
    requestId: string;
    body: CreateReportDto;
  }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'report.submit'
    );
    const description = arguments_.body.other_description?.trim();
    if (
      arguments_.body.reason === ReportReason.OTHER &&
      !description
    ) {
      throw new ApiError(
        'JIJU_VALIDATION_4221',
        422,
        '请填写举报说明',
        { fields: { other_description: '选择“其他”时必须填写' } }
      );
    }
    const fingerprint = stableStringify({
      target_type: arguments_.body.target_type,
      target_id: arguments_.body.target_id,
      reason: arguments_.body.reason,
      other_description: description ?? null
    });
    const replay = await this.replay(
      arguments_.user.id,
      key,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    try {
      return await this.runSerializable(async (tx) => {
      const notice = await tx.noticeConfirmation.findUnique({
        where: {
          userId_noticeVersion: {
            userId: arguments_.user.id,
            noticeVersion: this.config.getOrThrow<string>('NOTICE_VERSION')
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

      const target = await this.targetSnapshot(
        tx,
        arguments_.body.target_type,
        arguments_.body.target_id
      );
      const now = new Date();
      const recent = await tx.report.findFirst({
        where: {
          reporterId: arguments_.user.id,
          targetType: arguments_.body.target_type,
          targetId: arguments_.body.target_id,
          reason: arguments_.body.reason,
          submittedAt: {
            gte: new Date(now.getTime() - DEDUPE_WINDOW_MS)
          }
        },
        orderBy: { submittedAt: 'desc' }
      });
      if (recent) {
        return {
          data: {
            report_id: recent.id,
            submitted_at: recent.submittedAt.toISOString()
          },
          request_id: arguments_.requestId
        };
      }

      const minor = arguments_.body.reason === ReportReason.MINOR_INVOLVED;
      const report = await tx.report.create({
        data: {
          id: `rpt_${createUuidV7()}`,
          reporterId: arguments_.user.id,
          targetType: arguments_.body.target_type,
          targetId: arguments_.body.target_id,
          contentVersion: target.contentVersion,
          reason: arguments_.body.reason,
          otherDescription:
            arguments_.body.reason === ReportReason.OTHER
              ? description
              : null,
          isMinorRelated: minor,
          priority: minor
            ? ModerationPriority.PREEMPTIVE
            : ModerationPriority.NORMAL,
          priorityRank: minor ? 0 : 1,
          status: ReportStatus.PENDING,
          dedupeKey: `report_${createUuidV7()}`,
          submittedAt: now
        }
      });
      const response = {
        data: {
          report_id: report.id,
          submitted_at: report.submittedAt.toISOString()
        },
        request_id: arguments_.requestId
      };
      await tx.idempotencyRecord.create({
        data: {
          id: `idm_${createUuidV7()}`,
          actorId: arguments_.user.id,
          operation: 'report.submit',
          idempotencyKey: key,
          requestFingerprint: fingerprint,
          status: IdempotencyStatus.SUCCEEDED,
          responseStatus: 201,
          responseJson: response,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        }
      });
      return response;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.replay(
          arguments_.user.id,
          key,
          fingerprint
        );
        if (replay) {
          return replay;
        }
      }
      throw error;
    }
  }

  private async targetSnapshot(
    tx: Prisma.TransactionClient,
    targetType: ReportTargetType,
    targetId: string
  ): Promise<{ contentVersion: number }> {
    const now = new Date();
    if (targetType === ReportTargetType.POST) {
      const post = await tx.post.findUnique({ where: { id: targetId } });
      const moderationVisible =
        post?.moderationStatus === ModerationStatus.PASSED ||
        (post?.moderationStatus === ModerationStatus.PENDING &&
          post.riskConfirmedAt !== null);
      if (
        !post ||
        post.publicStatus !== PublicStatus.PUBLISHED ||
        post.hiddenAt ||
        post.deletedAt ||
        post.expiresAt.getTime() <= now.getTime() ||
        !moderationVisible
      ) {
        throw unavailable();
      }
      return { contentVersion: post.currentContentVersion };
    }

    const comment = await tx.comment.findUnique({
      where: { id: targetId },
      include: { post: true }
    });
    if (
      !comment ||
      comment.deletedAt ||
      comment.moderationStatus === ModerationStatus.REJECTED ||
      comment.post.publicStatus !== PublicStatus.PUBLISHED ||
      comment.post.hiddenAt ||
      comment.post.deletedAt ||
      comment.post.expiresAt.getTime() <= now.getTime()
    ) {
      throw unavailable();
    }
    return { contentVersion: comment.contentVersion };
  }

  private async replay(
    actorId: string,
    key: string,
    fingerprint: string
  ) {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId,
          operation: 'report.submit',
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
        '同一幂等键不能提交不同举报，请刷新后重试'
      );
    }
    return existing.responseJson as unknown as {
      data: Record<string, unknown>;
      request_id: string;
    };
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

function unavailable(): ApiError {
  return new ApiError('JIJU_CONTENT_4041', 404, '内容已不可用');
}
