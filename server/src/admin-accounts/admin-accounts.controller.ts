import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { RestrictAccountDto } from './dto/restrict-account.dto';

@Controller('admin/users')
@UseGuards(SessionAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.ACCOUNT_MODERATOR, AdminRole.AUDITOR)
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get()
  async list(
    @Query() query: ListAdminUsersDto,
    @RequestId() requestId: string
  ) {
    return {
      ...(await this.accounts.list(query)),
      request_id: requestId
    };
  }

  @Post(':userId/restrictions')
  @AdminRoles(AdminRole.ACCOUNT_MODERATOR)
  @HttpCode(HttpStatus.OK)
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
