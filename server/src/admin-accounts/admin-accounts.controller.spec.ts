import 'reflect-metadata';
import { AdminRole } from '@prisma/client';
import { ADMIN_ROLES_KEY } from '../auth/admin-roles.decorator';
import { AdminAccountsController } from './admin-accounts.controller';

describe('AdminAccountsController permissions', () => {
  it('allows account moderators and auditors to list users', () => {
    expect(
      Reflect.getMetadata(ADMIN_ROLES_KEY, AdminAccountsController)
    ).toEqual([AdminRole.ACCOUNT_MODERATOR, AdminRole.AUDITOR]);
    expect(
      Reflect.getMetadata(
        ADMIN_ROLES_KEY,
        AdminAccountsController.prototype.list
      )
    ).toBeUndefined();
  });

  it('allows only account moderators to restrict accounts', () => {
    expect(
      Reflect.getMetadata(
        ADMIN_ROLES_KEY,
        AdminAccountsController.prototype.restrict
      )
    ).toEqual([AdminRole.ACCOUNT_MODERATOR]);
  });
});
