import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MyPostsController } from './my-posts.controller';
import { MyPostsService } from './my-posts.service';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [AuthModule],
  controllers: [
    MyPostsController,
    AccountDeletionController,
    ProfileController
  ],
  providers: [MyPostsService, AccountDeletionService, ProfileService]
})
export class MyPostsModule {}
