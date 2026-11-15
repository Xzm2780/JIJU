import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AdminRoles } from '../auth/admin-roles.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { AdminContentListService } from './admin-content-list.service';
import { ListAdminContentDto } from './dto/list-admin-content.dto';

@Controller('admin/content')
@UseGuards(SessionAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.CONTENT_MODERATOR, AdminRole.AUDITOR)
export class AdminContentListController {
  constructor(private readonly content: AdminContentListService) {}

  @Get()
  async list(
    @Query() query: ListAdminContentDto,
    @RequestId() requestId: string
  ) {
    return {
      ...(await this.content.list(query)),
      request_id: requestId
    };
  }
}
