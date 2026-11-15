import {
  PublicStatus
} from '@prisma/client';
import { ProfileService } from './profile.service';

const USER = {
  id: 'usr_1',
  authProvider: 'MOCK',
  plazaNickname: '晚风 1024',
  accountStatus: 'ACTIVE'
};

describe('ProfileService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns profile and post dashboard counts', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: USER.id,
          plazaNickname: '晚风 1024',
          avatarColor: 'ROSE'
        })
      },
      post: {
        findMany: jest.fn().mockResolvedValue([
          {
            publicStatus: PublicStatus.PUBLISHED,
            expiresAt: new Date('2026-11-20T00:00:00.000Z')
          },
          {
            publicStatus: PublicStatus.PUBLISHED,
            expiresAt: new Date('2026-11-13T00:00:00.000Z')
          },
          {
            publicStatus: PublicStatus.HIDDEN,
            expiresAt: new Date('2026-11-20T00:00:00.000Z')
          }
        ])
      }
    };
    const service = new ProfileService(prisma as any);
    const result = await service.get(USER.id);
    expect(result).toMatchObject({
      plaza_nickname: '晚风 1024',
      stats: { total: 3, active: 1, expired: 1, hidden: 1 }
    });
  });

  it('updates profile and records idempotency without touching posts', async () => {
    let storedIdempotency: any = null;
    const tx = {
      user: {
        update: jest.fn().mockResolvedValue({
          id: USER.id,
          plazaNickname: '新的昵称',
          avatarColor: 'SAGE'
        })
      },
      idempotencyRecord: {
        create: jest.fn().mockImplementation(({ data }) => {
          storedIdempotency = data;
          return Promise.resolve(data);
        })
      }
    };
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null)
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx))
    };
    const service = new ProfileService(prisma as any);
    const result = await service.update({
      user: USER,
      idempotencyKey:
        'v1:profile.update:00000000-0000-7000-8000-000000000001',
      requestId: 'req_profile',
      body: {
        plaza_nickname: '新的昵称',
        avatar_color: 'SAGE'
      }
    });
    expect(result.data).toMatchObject({
      plaza_nickname: '新的昵称',
      avatar_color: 'SAGE'
    });
    expect(storedIdempotency.operation).toBe('profile.update');
  });

  it('rejects invalid nickname and avatar color', async () => {
    const service = new ProfileService({} as any);
    const base = {
      user: USER,
      idempotencyKey:
        'v1:profile.update:00000000-0000-7000-8000-000000000002',
      requestId: 'req_profile'
    };
    await expect(
      service.update({
        ...base,
        body: {
          plaza_nickname: '',
          avatar_color: 'ROSE'
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });
    await expect(
      service.update({
        ...base,
        body: {
          plaza_nickname: '昵称',
          avatar_color: 'UNKNOWN'
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });
  });
});
