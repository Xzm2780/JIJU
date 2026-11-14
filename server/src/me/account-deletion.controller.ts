import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Req,
  UseGuards
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { RequestId } from '../common/request-id.decorator';
import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Controller('me/account')
@UseGuards(SessionAuthGuard)
export class AccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Delete()
  @HttpCode(202)
  async request(
    @Body() body: DeleteAccountDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.deletion.request({
      user: request.user,
      sessionId: request.authSessionId,
      idempotencyKey,
      requestId
    });
  }
}
