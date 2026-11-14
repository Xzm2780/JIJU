import { ConfigService } from '@nestjs/config';
import { AccountDeletionService } from './account-deletion.service';

const USER = {
  id: 'usr_1',
  authProvider: 'MOCK',
  plazaNickname: '晚风 1024',
  accountStatus: 'ACTIVE'
};
const KEY =
  'v1:account.delete:00000000-0000-7000-8000-000000000001';

function harness() {
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: USER.id,
        accountStatus: 'ACTIVE'
      }),
      update: jest.fn().mockResolvedValue({})
    },
    authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    post: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    comment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    reaction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    idempotencyRecord: { create: jest.fn().mockResolvedValue({}) }
  };
  const prisma = {
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx))
  };
  const config = {
    get: (key: string) =>
      key === 'ACCOUNT_DELETION_GRACE_HOURS' ? '720' : undefined
  } as unknown as ConfigService;
  return {
    service: new AccountDeletionService(prisma as any, config),
    prisma,
    tx
  };
}

describe('AccountDeletionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('immediately deactivates, revokes sessions, hides content and schedules purge', async () => {
    const h = harness();
    const result = await h.service.request({
      user: USER,
      sessionId: 'ses_1',
      idempotencyKey: KEY,
      requestId: 'req_delete_account'
    });
    expect(result.data).toMatchObject({
      deletion_scheduled_at: '2026-12-14T03:00:00.000Z',
      recovery_deadline: '2026-12-14T03:00:00.000Z'
    });
    expect(h.tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountStatus: 'DEACTIVATED',
          accountDeletionScheduledAt: new Date('2026-12-14T03:00:00.000Z')
        })
      })
    );
    expect(h.tx.authSession.updateMany).toHaveBeenCalled();
    expect(h.tx.post.updateMany).toHaveBeenCalled();
    expect(h.tx.comment.updateMany).toHaveBeenCalled();
    expect(h.tx.reaction.updateMany).toHaveBeenCalled();
    expect(h.tx.auditLog.create).toHaveBeenCalled();
  });

  it('replays the first deletion response', async () => {
    const h = harness();
    const first = await h.service.request({
      user: USER,
      sessionId: 'ses_1',
      idempotencyKey: KEY,
      requestId: 'req_delete_account'
    });
    h.prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'idm_delete',
      responseJson: first
    });
    await expect(
      h.service.request({
        user: USER,
        sessionId: 'ses_1',
        idempotencyKey: KEY,
        requestId: 'req_delete_account'
      })
    ).resolves.toEqual(first);
    expect(h.tx.user.update).toHaveBeenCalledTimes(1);
  });
});
