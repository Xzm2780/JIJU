import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MyPostsController } from './my-posts.controller';
import { MyPostsService } from './my-posts.service';

@Module({
  imports: [AuthModule],
  controllers: [MyPostsController],
  providers: [MyPostsService]
})
export class MyPostsModule {}
