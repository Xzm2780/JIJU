import {
  Body,
  Controller,
  Get,
  Headers,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { RequestId } from '../common/request-id.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('me/profile')
@UseGuards(SessionAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  async get(
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return {
      data: await this.profile.get(request.user.id),
      request_id: requestId
    };
  }

  @Put()
  async update(
    @Body() body: UpdateProfileDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.profile.update({
      user: request.user,
      idempotencyKey,
      requestId,
      body
    });
  }
}
