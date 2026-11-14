import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminAccountsController],
  providers: [AdminAccountsService, AdminRoleGuard]
})
export class AdminAccountsModule {}
