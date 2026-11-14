import { Controller, Get, Query } from '@nestjs/common';
import { RequestId } from '../common/request-id.decorator';
import { ListFeedQueryDto } from './dto/list-feed-query.dto';
import { PostQueryService } from './post-query.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly postQuery: PostQueryService) {}

  @Get()
  async list(
    @Query() query: ListFeedQueryDto,
    @RequestId() requestId: string
  ) {
    return {
      ...(await this.postQuery.feed(query)),
      request_id: requestId
    };
  }
}
