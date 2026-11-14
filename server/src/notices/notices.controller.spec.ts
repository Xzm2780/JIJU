import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from '../auth/auth.types';
import { NoticesController } from './notices.controller';

function config(): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (key === 'NOTICE_VERSION') {
        return 'mvp-v1';
      }
      throw new Error(`Unknown config ${key}`);
    }
  } as ConfigService;
}

function request(): AuthenticatedRequest {
  return {
    user: {
      id: 'usr_1',
      authProvider: 'MOCK',
      plazaNickname: '晚风 1024',
      accountStatus: 'ACTIVE'
    }
  } as AuthenticatedRequest;
}

describe('NoticesController', () => {
  it('creates one confirmation for the current notice version', async () => {
    const prisma = {
      noticeConfirmation: {
        upsert: jest.fn().mockResolvedValue({
          noticeVersion: 'mvp-v1',
          confirmedAt: new Date('2026-11-14T02:00:00.000Z')
        })
      }
    };
    const controller = new NoticesController(prisma as any, config());

    const result = await controller.confirm(
      'mvp-v1',
      'v1:notice.confirm:00000000-0000-7000-8000-000000000001',
      request(),
      'req_1'
    );

    expect(result).toEqual({
      data: {
        notice_version: 'mvp-v1',
        confirmed_at: '2026-11-14T02:00:00.000Z'
      },
      request_id: 'req_1'
    });
    expect(prisma.noticeConfirmation.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects an old notice version and malformed idempotency key', async () => {
    const controller = new NoticesController(
      { noticeConfirmation: { upsert: jest.fn() } } as any,
      config()
    );

    await expect(
      controller.confirm(
        'mvp-v1',
        'not-an-idempotency-key',
        request(),
        'req_1'
      )
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });

    await expect(
      controller.confirm(
        'old-version',
        'v1:notice.confirm:00000000-0000-7000-8000-000000000001',
        request(),
        'req_1'
      )
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });
  });
});
