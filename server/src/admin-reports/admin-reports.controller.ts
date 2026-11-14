import {
  Controller,
  Get,
  Query,
  UseGuards
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AdminRoles } from '../auth/admin-roles.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { AdminReportsService } from './admin-reports.service';
import { ListAdminReportsDto } from './dto/list-admin-reports.dto';

@Controller('admin/reports')
@UseGuards(SessionAuthGuard, AdminRoleGuard)
@AdminRoles(
  AdminRole.REPORT_REVIEWER,
  AdminRole.CONTENT_MODERATOR,
  AdminRole.AUDITOR
)
export class AdminReportsController {
  constructor(private readonly reports: AdminReportsService) {}

  @Get()
  async list(
    @Query() query: ListAdminReportsDto,
    @RequestId() requestId: string
  ) {
    return {
      ...(await this.reports.list(query)),
      request_id: requestId
    };
  }
}
