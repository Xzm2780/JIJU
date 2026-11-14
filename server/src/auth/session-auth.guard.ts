import {
  CanActivate,
  ExecutionContext,
  Injectable
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new ApiError('JIJU_AUTH_4011', 401, '请先登录后继续');
    }

    const rawToken = authorization.slice('Bearer '.length).trim();
    if (!rawToken) {
      throw new ApiError('JIJU_AUTH_4011', 401, '请先登录后继续');
    }

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.accountStatus !== 'ACTIVE' ||
      session.user.deactivatedAt
    ) {
      throw new ApiError(
        'JIJU_AUTH_4012',
        401,
        '登录状态已失效，请重新登录'
      );
    }

    request.authSessionId = session.id;
    request.user = {
      id: session.user.id,
      authProvider: session.user.authProvider,
      plazaNickname: session.user.plazaNickname,
      accountStatus: session.user.accountStatus,
      postingRestrictedUntil: session.user.postingRestrictedUntil,
      commentingRestrictedUntil: session.user.commentingRestrictedUntil,
      reactionRestrictedUntil: session.user.reactionRestrictedUntil
    };
    return true;
  }
}
