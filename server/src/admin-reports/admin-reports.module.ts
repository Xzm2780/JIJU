import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminReportsController],
  providers: [AdminReportsService, AdminRoleGuard]
})
export class AdminReportsModule {}
