import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AdminContentController } from './admin-content.controller';
import { AdminContentListController } from './admin-content-list.controller';
import { AdminContentListService } from './admin-content-list.service';
import { AdminContentService } from './admin-content.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminContentController, AdminContentListController],
  providers: [AdminContentService, AdminContentListService, AdminRoleGuard]
})
export class AdminContentModule {}
