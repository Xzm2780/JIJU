import { Injectable } from '@nestjs/common';
import {
  AdminRole,
  IdempotencyStatus,
  Prisma
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { requireIdempotencyKey } from '../common/idempotency-key';
import { stableStringify } from '../common/stable-stringify';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountAction,
  RestrictAccountDto
} from './dto/restrict-account.dto';

@Injectable()
export class AdminAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async restrict(arguments_: {
    userId: string;
    actor: AuthenticatedUser;
    requestId: string;
    idempotencyKey: string | undefined;
    body: RestrictAccountDto;
  }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'admin.user.restrict'
    );
    const reason = arguments_.body.reason.trim();
    if (!reason) {
      throw validation('处理原因不能为空');
    }
    const expiry = arguments_.body.expires_at
      ? new Date(arguments_.body.expires_at)
      : null;
    const limited = [
      AccountAction.POST_LIMIT,
      AccountAction.COMMENT_LIMIT,
      AccountAction.REACTION_LIMIT
    ].includes(arguments_.body.action);
    if (limited) {
      if (!expiry || expiry.getTime() <= Date.now()) {
        throw validation('限制类动作必须提供未来的 expires_at');
      }
    }
    if (
      arguments_.body.action === AccountAction.WARNING &&
      arguments_.body.expires_at
    ) {
      throw validation('警告不使用限制结束时间');
    }

    const fingerprint = stableStringify({
      user_id: arguments_.userId,
      action: arguments_.body.action,
      expires_at: expiry?.toISOString() ?? null,
      reason
    });
    const replay = await this.replay(
      arguments_.actor.id,
      key,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: arguments_.userId }
        });
        if (!user) {
          throw validation('目标账号不存在');
        }
        const now = new Date();
        const before = {
          account_status: user.accountStatus,
          posting_restricted_until:
            user.postingRestrictedUntil?.toISOString() ?? null,
          commenting_restricted_until:
            user.commentingRestrictedUntil?.toISOString() ?? null,
          reaction_restricted_until:
            user.reactionRestrictedUntil?.toISOString() ?? null
        };
        const data: Prisma.UserUpdateInput = {};
        if (arguments_.body.action === AccountAction.POST_LIMIT) {
          data.postingRestrictedUntil = expiry;
        } else if (arguments_.body.action === AccountAction.COMMENT_LIMIT) {
          data.commentingRestrictedUntil = expiry;
        } else if (arguments_.body.action === AccountAction.REACTION_LIMIT) {
          data.reactionRestrictedUntil = expiry;
        } else if (arguments_.body.action === AccountAction.BAN) {
          data.accountStatus = 'BANNED';
        }
        const updated =
          Object.keys(data).length > 0
            ? await tx.user.update({
                where: { id: user.id },
                data
              })
            : user;
        const after = {
          account_status: updated.accountStatus,
          posting_restricted_until:
            updated.postingRestrictedUntil?.toISOString() ?? null,
          commenting_restricted_until:
            updated.commentingRestrictedUntil?.toISOString() ?? null,
          reaction_restricted_until:
            updated.reactionRestrictedUntil?.toISOString() ?? null
        };
        const restrictionId = `rst_${createUuidV7()}`;
        await tx.auditLog.create({
          data: {
            id: `aud_${createUuidV7()}`,
            actorId: arguments_.actor.id,
            actorRole: AdminRole.ACCOUNT_MODERATOR,
            actionType: arguments_.body.action,
            objectType: 'ACCOUNT',
            objectId: user.id,
            stateBefore: before,
            stateAfter: after,
            reason,
            requestId: arguments_.requestId
          }
        });
        const response = {
          data: {
            id: restrictionId,
            user_id: user.id,
            action: arguments_.body.action,
            effective_at: now.toISOString(),
            expires_at:
              arguments_.body.action === AccountAction.BAN
                ? expiry?.toISOString() ?? null
                : expiry?.toISOString() ?? null
          },
          request_id: arguments_.requestId
        };
        await tx.idempotencyRecord.create({
          data: {
            id: `idm_${createUuidV7()}`,
            actorId: arguments_.actor.id,
            operation: 'admin.user.restrict',
            idempotencyKey: key,
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
          operation: 'admin.user.restrict',
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
}

function validation(message: string): ApiError {
  return new ApiError('JIJU_VALIDATION_4221', 422, message);
}
