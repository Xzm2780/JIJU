import {
  Body,
  Controller,
  Delete,
  Headers,
  Param,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { SetReactionDto } from './dto/set-reaction.dto';
import { ReactionsService } from './reactions.service';

@Controller('posts/:postId/reaction')
@UseGuards(SessionAuthGuard)
export class ReactionsController {
  constructor(private readonly reactions: ReactionsService) {}

  @Put()
  async set(
    @Param('postId') postId: string,
    @Body() body: SetReactionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.reactions.set({
      postId,
      user: request.user,
      type: body.type,
      idempotencyKey,
      requestId
    });
  }

  @Delete()
  async cancel(
    @Param('postId') postId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.reactions.cancel({
      postId,
      user: request.user,
      idempotencyKey,
      requestId
    });
  }
}
