import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

function config(mockLogin = 'true'): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'MOCK_WECHAT_LOGIN') {
        return mockLogin;
      }
      return undefined;
    },
    getOrThrow: (key: string) => {
      if (key === 'NOTICE_VERSION') {
        return 'mvp-v1';
      }
      throw new Error(`Unknown config ${key}`);
    }
  } as ConfigService;
}

describe('AuthService', () => {
  it('creates a mock user and returns a non-public session payload', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'usr_00000000-0000-7000-8000-000000000001',
          authProvider: 'MOCK',
          plazaNickname: '晚风 1024'
        })
      },
      authSession: {
        create: jest.fn().mockResolvedValue({ id: 'session' })
      },
      noticeConfirmation: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };
    const wechatAuth = {
      exchangeCode: jest.fn().mockResolvedValue({
        subjectRef: 'mock_subject',
        provider: 'MOCK',
        nicknameSeed: 'mock-code'
      })
    };
    const service = new AuthService(prisma as any, config(), wechatAuth);

    const result = await service.login(' mock-code ');

    expect(result.user.plaza_nickname).toBe('晚风 1024');
    expect(result.notice_confirmed).toBe(false);
    expect(result.current_notice_version).toBe('mvp-v1');
    expect(result.access_token).toMatch(/^ses_/);
    expect(result).not.toHaveProperty('openid');
    expect(result).not.toHaveProperty('unionid');
    expect(result).not.toHaveProperty('session_key');
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authSubjectRef: 'mock_subject' }
      })
    );
  });

  it('rejects an empty login code before invoking the provider', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn()
      },
      authSession: { create: jest.fn() },
      noticeConfirmation: { findUnique: jest.fn() }
    };
    const wechatAuth = {
      exchangeCode: jest.fn()
    };
    const service = new AuthService(prisma as any, config(), wechatAuth);

    await expect(service.login('   ')).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221',
      status: 422
    });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(wechatAuth.exchangeCode).not.toHaveBeenCalled();
  });

  it('revokes only the current session and remains idempotent', async () => {
    const prisma = {
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };
    const service = new AuthService(prisma as any, config(), {
      exchangeCode: jest.fn()
    });

    await expect(service.logout('usr_1', 'ses_1')).resolves.toBeUndefined();
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ses_1',
        userId: 'usr_1',
        revokedAt: null
      },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it('requires explicit confirmation to restore an account in the deletion grace period', async () => {
    const scheduledAt = new Date(Date.now() + 86400000);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'usr_1',
          accountStatus: 'DEACTIVATED',
          deactivatedAt: new Date(),
          accountDeletionScheduledAt: scheduledAt
        }),
        upsert: jest.fn().mockResolvedValue({
          id: 'usr_1',
          authProvider: 'MOCK',
          plazaNickname: '晚风 1024'
        })
      },
      authSession: { create: jest.fn() },
      noticeConfirmation: { findUnique: jest.fn().mockResolvedValue(null) }
    };
    const identity = {
      exchangeCode: jest.fn().mockResolvedValue({
        subjectRef: 'subject',
        provider: 'MOCK',
        nicknameSeed: 'code'
      })
    };
    const service = new AuthService(prisma as any, config(), identity);

    await expect(service.login('code')).rejects.toMatchObject({
      code: 'JIJU_AUTH_4012',
      details: { account_recovery_available: true }
    });

    await service.login('code', true);
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          accountStatus: 'ACTIVE',
          deactivatedAt: null,
          accountDeletionScheduledAt: null
        })
      })
    );
  });
});
