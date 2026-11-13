import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';

function nicknameFor(code: string): string {
  const prefixes = ['晚风', '远山', '微光', '星野', '南岸', '晴川', '小岛', '清晨'];
  let hash = 0;
  for (const character of code) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return `${prefixes[hash % prefixes.length]} ${1000 + (hash % 9000)}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async login(code: string) {
    if (this.config.get<string>('MOCK_WECHAT_LOGIN') !== 'true') {
      throw new ApiError(
        'JIJU_SYSTEM_5031',
        503,
        '登录服务暂时不可用，请稍后重试'
      );
    }
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new ApiError('JIJU_VALIDATION_4221', 422, '登录凭证无效，请重试');
    }
    const user = await this.prisma.user.upsert({
      where: { loginCode: normalizedCode },
      create: {
        id: `usr_${createUuidV7()}`,
        loginCode: normalizedCode,
        plazaNickname: nicknameFor(normalizedCode)
      },
      update: {}
    });

    const rawToken = `ses_${randomBytes(32).toString('base64url')}`;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.authSession.create({
      data: {
        id: `ses_${createUuidV7()}`,
        tokenHash,
        userId: user.id,
        expiresAt
      }
    });

    const noticeVersion = this.config.getOrThrow<string>('NOTICE_VERSION');
    const notice = await this.prisma.noticeConfirmation.findUnique({
      where: {
        userId_noticeVersion: {
          userId: user.id,
          noticeVersion
        }
      }
    });

    return {
      access_token: rawToken,
      token_type: 'Bearer',
      expires_at: expiresAt.toISOString(),
      user: {
        id: user.id,
        plaza_nickname: user.plazaNickname
      },
      current_notice_version: noticeVersion,
      notice_confirmed: Boolean(notice)
    };
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
}
