import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  it('filters audit logs and returns no content bodies', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'aud_1',
            actorId: 'usr_admin',
            actorRole: 'CONTENT_MODERATOR',
            actionType: 'HIDE',
            objectType: 'CONTENT',
            objectId: 'pst_1',
            contentVersion: 2,
            stateBefore: { public_status: 'PUBLISHED' },
            stateAfter: { public_status: 'HIDDEN' },
            reason: '违规',
            requestId: 'req_1',
            occurredAt: new Date('2026-11-14T03:00:00.000Z')
          }
        ])
      }
    };
    const service = new AdminAuditService(prisma as any);
    const result = await service.list({
      limit: 20,
      actor_id: 'usr_admin',
      object_type: 'CONTENT',
      from: '2026-11-14T00:00:00.000Z',
      to: '2026-11-15T00:00:00.000Z'
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        actor_role: 'CONTENT_MODERATOR',
        action_type: 'HIDE',
        content_version: 2
      })
    );
    expect(JSON.stringify(result)).not.toContain('body_text');
    expect(JSON.stringify(result)).not.toContain('view_count');
  });

  it('rejects reversed time range', async () => {
    const service = new AdminAuditService({
      auditLog: { findMany: jest.fn() }
    } as any);
    await expect(
      service.list({
        limit: 20,
        from: '2026-11-15T00:00:00.000Z',
        to: '2026-11-14T00:00:00.000Z'
      })
    ).rejects.toMatchObject({ code: 'JIJU_VALIDATION_4221' });
  });
});
