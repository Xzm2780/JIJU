import {
  CanActivate,
  ExecutionContext,
  Injectable
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();
    const authorization = request.headers?.authorization;
    if (authorization === undefined) {
      return true;
    }
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new ApiError(
        'JIJU_AUTH_4012',
        401,
        '登录状态已失效，请重新登录'
      );
    }

    const rawToken = authorization.slice('Bearer '.length).trim();
    if (!rawToken) {
      throw new ApiError(
        'JIJU_AUTH_4012',
        401,
        '登录状态已失效，请重新登录'
      );
    }

    const session = await this.prisma.authSession.findUnique({
      where: {
        tokenHash: createHash('sha256').update(rawToken).digest('hex')
      },
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
      accountStatus: session.user.accountStatus
    };
    return true;
  }
}
