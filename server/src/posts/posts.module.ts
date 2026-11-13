import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PublishChallengeService } from './publish-challenge.service';

@Module({
  imports: [AuthModule, ContentModule],
  controllers: [PostsController],
  providers: [PostsService, PublishChallengeService]
})
export class PostsModule {}
