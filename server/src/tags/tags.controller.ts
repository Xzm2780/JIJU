import { Controller, Get } from '@nestjs/common';
import { RequestId } from '../common/request-id.decorator';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  async list(@RequestId() requestId: string) {
    return {
      data: await this.tagsService.list(),
      request_id: requestId
    };
  }
}
