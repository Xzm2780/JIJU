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
        upsert: jest.fn().mockResolvedValue({
          id: 'usr_00000000-0000-7000-8000-000000000001',
          loginCode: 'mock-code',
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
    const service = new AuthService(prisma as any, config());

    const result = await service.login(' mock-code ');

    expect(result.user.plaza_nickname).toBe('晚风 1024');
    expect(result.notice_confirmed).toBe(false);
    expect(result.current_notice_version).toBe('mvp-v1');
    expect(result.access_token).toMatch(/^ses_/);
    expect(result).not.toHaveProperty('openid');
    expect(result).not.toHaveProperty('unionid');
  });

  it('rejects login when the mock provider is not explicitly enabled', async () => {
    const prisma = {
      user: { upsert: jest.fn() },
      authSession: { create: jest.fn() },
      noticeConfirmation: { findUnique: jest.fn() }
    };
    const service = new AuthService(prisma as any, config('false'));

    await expect(service.login('mock-code')).rejects.toMatchObject({
      code: 'JIJU_SYSTEM_5031',
      status: 503
    });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});
