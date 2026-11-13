import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { PublishPostDto } from './dto/publish-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  async publish(
    @Body() body: PublishPostDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.postsService.publish({
      user: request.user,
      idempotencyKey,
      requestId,
      body
    });
  }
}
