import { Injectable } from '@nestjs/common';
import {
  IdempotencyStatus,
  Prisma,
  PublicStatus
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { countGraphemes, normalizeBody } from '../common/graphemes';
import { requireIdempotencyKey } from '../common/idempotency-key';
import { stableStringify } from '../common/stable-stringify';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';

const AVATAR_COLORS = ['ROSE', 'SAGE', 'SAND', 'LAVENDER', 'SKY'];

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError('JIJU_AUTH_4012', 401, '登录状态已失效，请重新登录');
    }
    const now = new Date();
    const posts = await this.prisma.post.findMany({
      where: { authorId: userId, publicStatus: { not: PublicStatus.DELETED } },
      select: {
        publicStatus: true,
        expiresAt: true
      }
    });
    const stats = {
      total: posts.length,
      active: posts.filter(
        (post) =>
          post.publicStatus === PublicStatus.PUBLISHED &&
          post.expiresAt.getTime() > now.getTime()
      ).length,
      expired: posts.filter(
        (post) =>
          post.publicStatus === PublicStatus.EXPIRED ||
          (post.publicStatus === PublicStatus.PUBLISHED &&
            post.expiresAt.getTime() <= now.getTime())
      ).length,
      hidden: posts.filter(
        (post) => post.publicStatus === PublicStatus.HIDDEN
      ).length
    };
    return {
      id: user.id,
      plaza_nickname: user.plazaNickname,
      avatar_color: user.avatarColor,
      stats
    };
  }

  async update(arguments_: {
    user: AuthenticatedUser;
    idempotencyKey: string | undefined;
    requestId: string;
    body: {
      plaza_nickname: string;
      avatar_color: string;
    };
  }) {
    const key = requireIdempotencyKey(
      arguments_.idempotencyKey,
      'profile.update'
    );
    const nickname = normalizeBody(arguments_.body.plaza_nickname);
    const nicknameLength = countGraphemes(nickname);
    if (nicknameLength < 1 || nicknameLength > 20) {
      throw validation('昵称长度需为 1 至 20 个可见字符');
    }
    if (!AVATAR_COLORS.includes(arguments_.body.avatar_color)) {
      throw validation('头像配色无效');
    }
    const fingerprint = stableStringify({
      plaza_nickname: nickname,
      avatar_color: arguments_.body.avatar_color
    });
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId: arguments_.user.id,
          operation: 'profile.update',
          idempotencyKey: key
        }
      }
    });
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new ApiError(
          'JIJU_CONFLICT_4091',
          409,
          '同一幂等键不能提交不同资料，请刷新后重试'
        );
      }
      return existing.responseJson as unknown as {
        data: Record<string, unknown>;
        request_id: string;
      };
    }

    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.update({
          where: { id: arguments_.user.id },
          data: {
            plazaNickname: nickname,
            avatarColor: arguments_.body.avatar_color
          }
        });
        const response = {
          data: {
            id: user.id,
            plaza_nickname: user.plazaNickname,
            avatar_color: user.avatarColor
          },
          request_id: arguments_.requestId
        };
        await tx.idempotencyRecord.create({
          data: {
            id: `idm_${createUuidV7()}`,
            actorId: user.id,
            operation: 'profile.update',
            idempotencyKey: key,
            requestFingerprint: fingerprint,
            status: IdempotencyStatus.SUCCEEDED,
            responseStatus: 200,
            responseJson: response,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });
        return response;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}

function validation(message: string): ApiError {
  return new ApiError('JIJU_VALIDATION_4221', 422, message);
}
