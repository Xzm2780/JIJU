import {
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ApiError } from '../common/api-error';
import { RequestId } from '../common/request-id.decorator';
import { createUuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notices')
@UseGuards(SessionAuthGuard)
export class NoticesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  @Post(':noticeVersion/confirmations')
  async confirm(
    @Param('noticeVersion') noticeVersion: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    if (
      typeof idempotencyKey !== 'string' ||
      !/^v1:notice\.confirm:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        idempotencyKey
      )
    ) {
      throw new ApiError('JIJU_VALIDATION_4221', 422, '缺少或无效的幂等键', {
        fields: { 'Idempotency-Key': '应为 v1:notice.confirm:<uuid_v7>' }
      });
    }

    const currentVersion = this.config.getOrThrow<string>('NOTICE_VERSION');
    if (noticeVersion !== currentVersion) {
      throw new ApiError('JIJU_VALIDATION_4221', 422, '使用须知版本已更新');
    }

    const confirmation = await this.prisma.noticeConfirmation.upsert({
      where: {
        userId_noticeVersion: {
          userId: request.user.id,
          noticeVersion
        }
      },
      create: {
        id: `ncf_${createUuidV7()}`,
        userId: request.user.id,
        noticeVersion
      },
      update: {}
    });

    return {
      data: {
        notice_version: confirmation.noticeVersion,
        confirmed_at: confirmation.confirmedAt.toISOString()
      },
      request_id: requestId
    };
  }
}
