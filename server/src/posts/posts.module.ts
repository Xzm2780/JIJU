import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { FeedController } from './feed.controller';
import { PostQueryService } from './post-query.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PublishChallengeService } from './publish-challenge.service';

@Module({
  imports: [AuthModule, ContentModule],
  controllers: [FeedController, PostsController],
  providers: [PostsService, PostQueryService, PublishChallengeService]
})
export class PostsModule {}
