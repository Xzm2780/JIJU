import { AdminAccountsService } from './admin-accounts.service';
import { AdminUserStatus } from './dto/list-admin-users.dto';
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

  it('lists operator-facing user profiles and content counts without identity refs', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'usr_target',
            plazaNickname: '晚风 1024',
            bio: '今天也在认真生活',
            avatarColor: 'ROSE',
            accountStatus: 'ACTIVE',
            postingRestrictedUntil: new Date('2026-11-16T03:00:00.000Z'),
            commentingRestrictedUntil: null,
            reactionRestrictedUntil: null,
            createdAt: new Date('2026-11-01T03:00:00.000Z'),
            updatedAt: new Date('2026-11-14T02:00:00.000Z')
          }
        ])
      },
      post: {
        groupBy: jest.fn().mockResolvedValue([
          { authorId: 'usr_target', _count: { _all: 3 } }
        ])
      },
      comment: {
        groupBy: jest.fn().mockResolvedValue([
          { authorId: 'usr_target', _count: { _all: 7 } }
        ])
      }
    };
    const service = new AdminAccountsService(prisma as any);

    const result = await service.list({
      status: AdminUserStatus.RESTRICTED,
      query: '晚风',
      limit: 20
    });

    expect(result.data).toEqual([
      {
        id: 'usr_target',
        plaza_nickname: '晚风 1024',
        bio: '今天也在认真生活',
        avatar_color: 'ROSE',
        account_status: AdminUserStatus.RESTRICTED,
        posting_restricted_until: '2026-11-16T03:00:00.000Z',
        commenting_restricted_until: null,
        reaction_restricted_until: null,
        post_count: 3,
        comment_count: 7,
        created_at: '2026-11-01T03:00:00.000Z',
        updated_at: '2026-11-14T02:00:00.000Z'
      }
    ]);
    expect(JSON.stringify(result.data)).not.toContain('authSubjectRef');
    expect(JSON.stringify(result.data)).not.toContain('loginCode');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              accountStatus: 'ACTIVE',
              OR: expect.arrayContaining([
                expect.objectContaining({
                  postingRestrictedUntil: { gt: expect.any(Date) }
                })
              ])
            }),
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  plazaNickname: {
                    contains: '晚风',
                    mode: 'insensitive'
                  }
                })
              ])
            })
          ])
        }),
        select: expect.not.objectContaining({
          authSubjectRef: true,
          loginCode: true
        })
      })
    );
  });

  it('returns stable cursor pagination for account lists', async () => {
    const updatedAt = new Date('2026-11-14T02:00:00.000Z');
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'usr_banned',
            plazaNickname: '停用账号',
            bio: null,
            avatarColor: 'SAND',
            accountStatus: 'BANNED',
            postingRestrictedUntil: null,
            commentingRestrictedUntil: null,
            reactionRestrictedUntil: null,
            createdAt: updatedAt,
            updatedAt
          },
          {
            id: 'usr_next',
            plazaNickname: '下一页账号',
            bio: null,
            avatarColor: 'SAGE',
            accountStatus: 'BANNED',
            postingRestrictedUntil: null,
            commentingRestrictedUntil: null,
            reactionRestrictedUntil: null,
            createdAt: updatedAt,
            updatedAt
          }
        ])
      },
      post: { groupBy: jest.fn().mockResolvedValue([]) },
      comment: { groupBy: jest.fn().mockResolvedValue([]) }
    };
    const service = new AdminAccountsService(prisma as any);

    const result = await service.list({
      status: AdminUserStatus.BANNED,
      limit: 1
    });

    expect(result.data).toHaveLength(1);
    expect(result.page.has_more).toBe(true);
    expect(result.page.next_cursor).toEqual(expect.any(String));
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { accountStatus: 'BANNED' }
          ])
        }),
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 2
      })
    );
  });
});
