import { randomBytes, scryptSync } from 'node:crypto';
import { AdminAuthService } from './admin-auth.service';

function passwordHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function harness(password = 'correct-password') {
  const prisma = {
    adminCredential: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'adc_1',
        userId: 'usr_admin',
        username: 'admin',
        passwordHash: passwordHash(password),
        active: true,
        user: {
          id: 'usr_admin',
          plazaNickname: '演示运营',
          accountStatus: 'ACTIVE',
          deactivatedAt: null
        }
      })
    },
    adminRoleAssignment: {
      findFirst: jest.fn().mockResolvedValue({ id: 'adr_1' })
    },
    authSession: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) }
  };
  return {
    prisma,
    service: new AdminAuthService(prisma as any)
  };
}

describe('AdminAuthService', () => {
  it('logs in with username and password and creates an eight-hour session', async () => {
    const h = harness();
    const result = await h.service.login('admin', 'correct-password');
    expect(result).toMatchObject({
      token_type: 'Bearer',
      user: {
        username: 'admin',
        display_name: '演示运营'
      }
    });
    expect(result.access_token).toMatch(/^adm_/);
    expect(h.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'ADMIN_LOGIN' })
      })
    );
  });

  it('returns the same safe error for wrong password or unknown username', async () => {
    const wrongPassword = harness();
    await expect(
      wrongPassword.service.login('admin', 'wrong-password')
    ).rejects.toMatchObject({
      code: 'JIJU_AUTH_4013',
      message: '账号或密码错误'
    });

    const unknown = harness();
    unknown.prisma.adminCredential.findUnique.mockResolvedValue(null);
    await expect(
      unknown.service.login('unknown', 'password')
    ).rejects.toMatchObject({
      code: 'JIJU_AUTH_4013',
      message: '账号或密码错误'
    });
  });

  it('rejects a valid credential without an active admin role', async () => {
    const h = harness();
    h.prisma.adminRoleAssignment.findFirst.mockResolvedValue(null);
    await expect(
      h.service.login('admin', 'correct-password')
    ).rejects.toMatchObject({
      code: 'JIJU_ACCESS_4031'
    });
  });
});
