import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdempotencyStatus,
  ModerationStatus,
  Prisma,
  PublicStatus,
  ReactionType
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { requireIdempotencyKey } from '../common/idempotency-key';
import { stableStringify } from '../common/stable-stringify';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';

export interface ReactionState {
  hug: number;
  head_pat: number;
  cheer: number;
  total: number;
}

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async set(arguments_: {
    postId: string;
    user: AuthenticatedUser;
    type: ReactionType;
    idempotencyKey: string | undefined;
    requestId: string;
  }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'reaction.set'
    );
    const fingerprint = stableStringify({
      post_id: arguments_.postId,
      type: arguments_.type
    });
    const replay = await this.replay(
      arguments_.user.id,
      'reaction.set',
      key,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    return this.runSerializable(async (tx) => {
      await this.requirePublicPost(arguments_.postId, tx);
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
      await tx.reaction.upsert({
        where: {
          userId_postId: {
            userId: arguments_.user.id,
            postId: arguments_.postId
          }
        },
        create: {
          id: `rxn_${createUuidV7()}`,
          userId: arguments_.user.id,
          postId: arguments_.postId,
          type: arguments_.type,
          active: true
        },
        update: {
          type: arguments_.type,
          active: true
        }
      });
      const state = await this.stateFor(
        arguments_.postId,
        arguments_.user.id,
        tx
      );
      const response = {
        data: {
          my_reaction: arguments_.type,
          counts: state.counts
        },
        request_id: arguments_.requestId
      };
      await this.storeResponse(
        tx,
        arguments_.user.id,
        'reaction.set',
        key,
        fingerprint,
        response
      );
      return response;
    });
  }

  async cancel(arguments_: {
    postId: string;
    user: AuthenticatedUser;
    idempotencyKey: string | undefined;
    requestId: string;
  }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'reaction.cancel'
    );
    const fingerprint = stableStringify({
      post_id: arguments_.postId,
      action: 'cancel'
    });
    const replay = await this.replay(
      arguments_.user.id,
      'reaction.cancel',
      key,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    return this.runSerializable(async (tx) => {
      await this.requirePublicPost(arguments_.postId, tx);
      await tx.reaction.updateMany({
        where: {
          userId: arguments_.user.id,
          postId: arguments_.postId,
          active: true
        },
        data: { active: false }
      });
      const state = await this.stateFor(
        arguments_.postId,
        arguments_.user.id,
        tx
      );
      const response = {
        data: {
          my_reaction: null,
          counts: state.counts
        },
        request_id: arguments_.requestId
      };
      await this.storeResponse(
        tx,
        arguments_.user.id,
        'reaction.cancel',
        key,
        fingerprint,
        response
      );
      return response;
    });
  }

  private async requirePublicPost(
    postId: string,
    tx: Prisma.TransactionClient
  ) {
    const post = await tx.post.findUnique({ where: { id: postId } });
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

  private async stateFor(
    postId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<{ counts: ReactionState }> {
    const groups = await tx.reaction.groupBy({
      by: ['type'],
      where: { postId, active: true },
      _count: { _all: true }
    });
    const counts: ReactionState = { hug: 0, head_pat: 0, cheer: 0, total: 0 };
    for (const group of groups) {
      const amount = group._count._all;
      if (group.type === ReactionType.HUG) {
        counts.hug = amount;
      } else if (group.type === ReactionType.HEAD_PAT) {
        counts.head_pat = amount;
      } else {
        counts.cheer = amount;
      }
      counts.total += amount;
    }
    return { counts };
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
        '同一幂等键不能提交不同操作，请刷新后重试'
      );
    }
    return existing.responseJson as unknown as {
      data: Record<string, unknown>;
      request_id: string;
    };
  }

  private async storeResponse(
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
          !['P2034', 'P2002'].includes(error.code)
        ) {
          throw error;
        }
      }
    }
    throw lastError;
  }
}
