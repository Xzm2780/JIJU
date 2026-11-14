import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AdminRoles } from '../auth/admin-roles.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { AdminAccountsService } from './admin-accounts.service';
import { RestrictAccountDto } from './dto/restrict-account.dto';

@Controller('admin/users/:userId/restrictions')
@UseGuards(SessionAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.ACCOUNT_MODERATOR)
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Post()
  async restrict(
    @Param('userId') userId: string,
    @Body() body: RestrictAccountDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.accounts.restrict({
      userId,
      actor: request.user,
      requestId,
      idempotencyKey,
      body
    });
  }
}
