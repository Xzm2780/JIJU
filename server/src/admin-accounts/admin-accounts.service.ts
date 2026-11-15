import { Injectable } from '@nestjs/common';
import {
  AdminRole,
  IdempotencyStatus,
  Prisma,
  PublicStatus
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { requireIdempotencyKey } from '../common/idempotency-key';
import {
  decodePageCursor,
  encodePageCursor
} from '../common/page-cursor';
import { stableStringify } from '../common/stable-stringify';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminUserStatus,
  ListAdminUsersDto
} from './dto/list-admin-users.dto';
import {
  AccountAction,
  RestrictAccountDto
} from './dto/restrict-account.dto';

@Injectable()
export class AdminAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminUsersDto) {
    const cursor = decodePageCursor(query.cursor);
    const now = new Date();
    const search = query.query?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          this.statusWhere(query.status, now),
          ...(search
            ? [
                {
                  OR: [
                    {
                      id: {
                        contains: search,
                        mode: 'insensitive' as const
                      }
                    },
                    {
                      plazaNickname: {
                        contains: search,
                        mode: 'insensitive' as const
                      }
                    }
                  ]
                }
              ]
            : []),
          ...(cursor
            ? [
                {
                  OR: [
                    { updatedAt: { lt: new Date(cursor.timestamp) } },
                    {
                      updatedAt: new Date(cursor.timestamp),
                      id: { lt: cursor.id }
                    }
                  ]
                }
              ]
            : [])
        ]
      },
      select: {
        id: true,
        plazaNickname: true,
        accountStatus: true,
        postingRestrictedUntil: true,
        commentingRestrictedUntil: true,
        reactionRestrictedUntil: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1
    });
    const page = users.slice(0, query.limit);
    const userIds = page.map((user) => user.id);
    const [postCounts, commentCounts] = await Promise.all([
      this.postCounts(userIds),
      this.commentCounts(userIds)
    ]);
    const last = page.at(-1);
    return {
      data: page.map((user) => ({
        id: user.id,
        plaza_nickname: user.plazaNickname,
        account_status: this.effectiveStatus(user, now),
        posting_restricted_until:
          user.postingRestrictedUntil?.toISOString() ?? null,
        commenting_restricted_until:
          user.commentingRestrictedUntil?.toISOString() ?? null,
        reaction_restricted_until:
          user.reactionRestrictedUntil?.toISOString() ?? null,
        post_count: postCounts.get(user.id) ?? 0,
        comment_count: commentCounts.get(user.id) ?? 0,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString()
      })),
      page: {
        has_more: users.length > query.limit,
        next_cursor:
          users.length > query.limit && last
            ? encodePageCursor({
                version: 1,
                timestamp: last.updatedAt.toISOString(),
                id: last.id
              })
            : null
      }
    };
  }

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

    try {
      return await this.prisma.$transaction(
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.replay(
          arguments_.actor.id,
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

  private statusWhere(
    status: AdminUserStatus,
    now: Date
  ): Prisma.UserWhereInput {
    const hasActiveRestriction = {
      OR: [
        { postingRestrictedUntil: { gt: now } },
        { commentingRestrictedUntil: { gt: now } },
        { reactionRestrictedUntil: { gt: now } }
      ]
    } satisfies Prisma.UserWhereInput;
    if (status === AdminUserStatus.RESTRICTED) {
      return {
        accountStatus: 'ACTIVE',
        ...hasActiveRestriction
      };
    }
    if (
      status === AdminUserStatus.DEACTIVATED ||
      status === AdminUserStatus.BANNED ||
      status === AdminUserStatus.DELETED
    ) {
      return { accountStatus: status };
    }
    if (status === AdminUserStatus.ACTIVE) {
      return {
        accountStatus: 'ACTIVE',
        NOT: hasActiveRestriction
      };
    }
    return {};
  }

  private effectiveStatus(
    user: {
      accountStatus: string;
      postingRestrictedUntil: Date | null;
      commentingRestrictedUntil: Date | null;
      reactionRestrictedUntil: Date | null;
    },
    now: Date
  ): AdminUserStatus {
    if (user.accountStatus !== 'ACTIVE') {
      return user.accountStatus as AdminUserStatus;
    }
    if (
      [
        user.postingRestrictedUntil,
        user.commentingRestrictedUntil,
        user.reactionRestrictedUntil
      ].some((value) => value && value.getTime() > now.getTime())
    ) {
      return AdminUserStatus.RESTRICTED;
    }
    return AdminUserStatus.ACTIVE;
  }

  private async postCounts(userIds: string[]): Promise<Map<string, number>> {
    if (!userIds.length) {
      return new Map();
    }
    const groups = await this.prisma.post.groupBy({
      by: ['authorId'],
      where: {
        authorId: { in: userIds },
        publicStatus: { not: PublicStatus.DELETED }
      },
      _count: { _all: true }
    });
    return new Map(groups.map((group) => [group.authorId, group._count._all]));
  }

  private async commentCounts(userIds: string[]): Promise<Map<string, number>> {
    if (!userIds.length) {
      return new Map();
    }
    const groups = await this.prisma.comment.groupBy({
      by: ['authorId'],
      where: {
        authorId: { in: userIds },
        deletedAt: null
      },
      _count: { _all: true }
    });
    return new Map(groups.map((group) => [group.authorId, group._count._all]));
  }
}

function validation(message: string): ApiError {
  return new ApiError('JIJU_VALIDATION_4221', 422, message);
}
