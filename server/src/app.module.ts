import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { ContentModule } from './content/content.module';
import { MyPostsModule } from './me/my-posts.module';
import { NoticesModule } from './notices/notices.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReactionsModule } from './reactions/reactions.module';
import { RedisModule } from './redis/redis.module';
import { ReviewQueueModule } from './review-queue/review-queue.module';
import { TagsModule } from './tags/tags.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    CommentsModule,
    NoticesModule,
    TagsModule,
    ContentModule,
    MyPostsModule,
    PostsModule,
    ReactionsModule,
    ReviewQueueModule
  ]
})
export class AppModule {}
