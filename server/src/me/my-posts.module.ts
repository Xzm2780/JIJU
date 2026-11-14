import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MyPostsController } from './my-posts.controller';
import { MyPostsService } from './my-posts.service';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [AuthModule],
  controllers: [MyPostsController, AccountDeletionController],
  providers: [MyPostsService, AccountDeletionService]
})
export class MyPostsModule {}
