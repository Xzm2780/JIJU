import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import {
  AdminRole,
  ReportTargetType
} from '@prisma/client';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AdminRoles } from '../auth/admin-roles.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { AdminContentService } from './admin-content.service';
import { ContentActionDto } from './dto/content-action.dto';
import { ReviewContentDto } from './dto/review-content.dto';

@Controller('admin/content/:targetType/:targetId')
@UseGuards(SessionAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.CONTENT_MODERATOR)
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  @Post('reviews')
  async review(
    @Param('targetType') targetType: ReportTargetType,
    @Param('targetId') targetId: string,
    @Body() body: ReviewContentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.content.review({
      targetType,
      targetId,
      user: request.user,
      requestId,
      idempotencyKey,
      body
    });
  }

  @Post('actions')
  async action(
    @Param('targetType') targetType: ReportTargetType,
    @Param('targetId') targetId: string,
    @Body() body: ContentActionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.content.action({
      targetType,
      targetId,
      user: request.user,
      requestId,
      idempotencyKey,
      body
    });
  }
}
