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
import { ListReviewQueueDto } from './dto/list-review-queue.dto';
import { ReviewQueueService } from './review-queue.service';

@Controller('admin/review-queue')
@UseGuards(SessionAuthGuard, AdminRoleGuard)
@AdminRoles(
  AdminRole.CONTENT_MODERATOR,
  AdminRole.REPORT_REVIEWER,
  AdminRole.AUDITOR
)
export class ReviewQueueController {
  constructor(private readonly reviewQueue: ReviewQueueService) {}

  @Get()
  async list(
    @Query() query: ListReviewQueueDto,
    @RequestId() requestId: string
  ) {
    const result = await this.reviewQueue.list(query);
    return {
      ...result,
      request_id: requestId
    };
  }
}
