import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { OptionalSessionAuthGuard } from '../auth/optional-session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { PublishPostDto } from './dto/publish-post.dto';
import { PostQueryService } from './post-query.service';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postQuery: PostQueryService
  ) {}

  @Get(':postId')
  @UseGuards(OptionalSessionAuthGuard)
  async detail(
    @Param('postId') postId: string,
    @Headers('x-view-token') viewToken: string | undefined,
    @Req() request: Partial<AuthenticatedRequest>,
    @RequestId() requestId: string
  ) {
    return {
      data: await this.postQuery.detail({
        postId,
        user: request.user,
        viewToken
      }),
      request_id: requestId
    };
  }

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
