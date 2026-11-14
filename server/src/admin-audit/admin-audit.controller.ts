import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AdminRoles } from '../auth/admin-roles.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { AdminAuditService } from './admin-audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Controller('admin/audit-logs')
@UseGuards(SessionAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.AUDITOR, AdminRole.CONTENT_MODERATOR)
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  async list(
    @Query() query: ListAuditLogsDto,
    @RequestId() requestId: string
  ) {
    return {
      ...(await this.audit.list(query)),
      request_id: requestId
    };
  }
}
