import { AdminAccountsService } from './admin-accounts.service';
import { AccountAction } from './dto/restrict-account.dto';

const ACTOR = {
  id: 'usr_admin',
  authProvider: 'MOCK',
  plazaNickname: '运营',
  accountStatus: 'ACTIVE'
};

function harness() {
  const user = {
    id: 'usr_target',
    accountStatus: 'ACTIVE',
    postingRestrictedUntil: null,
    commentingRestrictedUntil: null,
    reactionRestrictedUntil: null
  };
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...user, ...data })
      )
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    idempotencyRecord: { create: jest.fn().mockResolvedValue({}) }
  };
  const prisma = {
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx))
  };
  return {
    service: new AdminAccountsService(prisma as any),
    prisma,
    tx
  };
}

describe('AdminAccountsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('updates only the selected capability and writes audit', async () => {
    const h = harness();
    const expiresAt = '2026-11-15T03:00:00.000Z';
    const result = await h.service.restrict({
      userId: 'usr_target',
      actor: ACTOR,
      requestId: 'req_restrict',
      idempotencyKey:
        'v1:admin.user.restrict:00000000-0000-7000-8000-000000000001',
      body: {
        action: AccountAction.COMMENT_LIMIT,
        expires_at: expiresAt,
        reason: '限制评论'
      }
    });
    expect(result.data).toMatchObject({
      action: AccountAction.COMMENT_LIMIT,
      expires_at: expiresAt
    });
    expect(h.tx.user.update).toHaveBeenCalledWith({
      where: { id: 'usr_target' },
      data: { commentingRestrictedUntil: new Date(expiresAt) }
    });
    expect(h.tx.auditLog.create).toHaveBeenCalled();
  });

  it('allows warning without user mutation and validates limited expiry', async () => {
    const warning = harness();
    await warning.service.restrict({
      userId: 'usr_target',
      actor: ACTOR,
      requestId: 'req_warning',
      idempotencyKey:
        'v1:admin.user.restrict:00000000-0000-7000-8000-000000000002',
      body: {
        action: AccountAction.WARNING,
        reason: '警告'
      }
    });
    expect(warning.tx.user.update).not.toHaveBeenCalled();

    const invalid = harness();
    await expect(
      invalid.service.restrict({
        userId: 'usr_target',
        actor: ACTOR,
        requestId: 'req_invalid',
        idempotencyKey:
          'v1:admin.user.restrict:00000000-0000-7000-8000-000000000003',
        body: {
          action: AccountAction.POST_LIMIT,
          expires_at: '2026-11-13T03:00:00.000Z',
          reason: '过期时间'
        }
      })
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });
  });

  it('bans the account without deleting content', async () => {
    const h = harness();
    await h.service.restrict({
      userId: 'usr_target',
      actor: ACTOR,
      requestId: 'req_ban',
      idempotencyKey:
        'v1:admin.user.restrict:00000000-0000-7000-8000-000000000004',
      body: {
        action: AccountAction.BAN,
        reason: '持续封禁'
      }
    });
    expect(h.tx.user.update).toHaveBeenCalledWith({
      where: { id: 'usr_target' },
      data: { accountStatus: 'BANNED' }
    });
  });
});
