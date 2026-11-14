import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdempotencyStatus,
  Prisma,
  PublicStatus
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { requireIdempotencyKey } from '../common/idempotency-key';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async request(arguments_: {
    user: AuthenticatedUser;
    sessionId: string;
    idempotencyKey: string | undefined;
    requestId: string;
  }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'account.delete'
    );
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId: arguments_.user.id,
          operation: 'account.delete',
          idempotencyKey: key
        }
      }
    });
    if (existing) {
      return existing.responseJson as unknown as {
        data: Record<string, unknown>;
        request_id: string;
      };
    }

    const graceHours = Number(
      this.config.get<string>('ACCOUNT_DELETION_GRACE_HOURS') ?? '720'
    );
    const now = new Date();
    const scheduledAt = new Date(
      now.getTime() + graceHours * 60 * 60 * 1000
    );
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: arguments_.user.id }
        });
        if (!user) {
          throw new ApiError('JIJU_AUTH_4012', 401, '登录状态已失效，请重新登录');
        }
        await tx.user.update({
          where: { id: user.id },
          data: {
            accountStatus: 'DEACTIVATED',
            deactivatedAt: now,
            accountDeletionScheduledAt: scheduledAt
          }
        });
        await tx.authSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now }
        });
        await tx.post.updateMany({
          where: { authorId: user.id, publicStatus: { not: PublicStatus.DELETED } },
          data: {
            publicStatus: PublicStatus.HIDDEN,
            hiddenAt: now
          }
        });
        await tx.comment.updateMany({
          where: { authorId: user.id, deletedAt: null },
          data: { deletedAt: now }
        });
        await tx.reaction.updateMany({
          where: { userId: user.id, active: true },
          data: { active: false }
        });
        await tx.auditLog.create({
          data: {
            id: `aud_${createUuidV7()}`,
            actorId: user.id,
            actorRole: 'USER',
            actionType: 'ACCOUNT_DELETE_REQUESTED',
            objectType: 'ACCOUNT',
            objectId: user.id,
            stateBefore: { account_status: user.accountStatus },
            stateAfter: {
              account_status: 'DEACTIVATED',
              deletion_scheduled_at: scheduledAt.toISOString()
            },
            requestId: arguments_.requestId
          }
        });
        const response = {
          data: {
            deletion_scheduled_at: scheduledAt.toISOString(),
            recovery_deadline: scheduledAt.toISOString(),
            message:
              '账号已立即停用并隐藏本人内容，可在冷静期内重新微信登录恢复。'
          },
          request_id: arguments_.requestId
        };
        await tx.idempotencyRecord.create({
          data: {
            id: `idm_${createUuidV7()}`,
            actorId: user.id,
            operation: 'account.delete',
            idempotencyKey: key,
            requestFingerprint: 'account.delete',
            status: IdempotencyStatus.SUCCEEDED,
            responseStatus: 202,
            responseJson: response,
            expiresAt: scheduledAt
          }
        });
        return response;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
