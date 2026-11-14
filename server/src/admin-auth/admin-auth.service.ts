import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, expected] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) {
    return false;
  }
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    actual.length === expectedBuffer.length &&
    timingSafeEqual(actual, expectedBuffer)
  );
}

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string) {
    const credential = await this.prisma.adminCredential.findUnique({
      where: { username: username.trim() },
      include: { user: true }
    });
    if (
      !credential ||
      !credential.active ||
      credential.user.accountStatus !== 'ACTIVE' ||
      credential.user.deactivatedAt ||
      !verifyPassword(password, credential.passwordHash)
    ) {
      throw new ApiError('JIJU_AUTH_4013', 401, '账号或密码错误');
    }
    const role = await this.prisma.adminRoleAssignment.findFirst({
      where: {
        userId: credential.userId,
        active: true,
        revokedAt: null
      }
    });
    if (!role) {
      throw new ApiError('JIJU_ACCESS_4031', 403, '你无权进入管理后台');
    }

    const rawToken = `adm_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.prisma.authSession.create({
      data: {
        id: `ses_${createUuidV7()}`,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        userId: credential.userId,
        expiresAt
      }
    });
    await this.prisma.auditLog.create({
      data: {
        id: `aud_${createUuidV7()}`,
        actorId: credential.userId,
        actorRole: 'ADMIN_CONSOLE',
        actionType: 'ADMIN_LOGIN',
        objectType: 'ACCOUNT',
        objectId: credential.userId,
        requestId: `login_${createUuidV7()}`
      }
    });
    return {
      access_token: rawToken,
      token_type: 'Bearer',
      expires_at: expiresAt.toISOString(),
      user: {
        id: credential.userId,
        username: credential.username,
        display_name: credential.user.plazaNickname
      }
    };
  }
}
