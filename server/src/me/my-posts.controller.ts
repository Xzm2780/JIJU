import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { ListMyPostsQueryDto } from './dto/list-my-posts-query.dto';
import { MyPostsService } from './my-posts.service';

@Controller('me/posts')
@UseGuards(SessionAuthGuard)
export class MyPostsController {
  constructor(private readonly myPosts: MyPostsService) {}

  @Get()
  async list(
    @Query() query: ListMyPostsQueryDto,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return {
      ...(await this.myPosts.list(request.user.id, query)),
      request_id: requestId
    };
  }
}
