import { Module } from '@nestjs/common';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AuthModule } from '../auth/auth.module';
import { ReviewQueueController } from './review-queue.controller';
import { ReviewQueueService } from './review-queue.service';

@Module({
  imports: [AuthModule],
  controllers: [ReviewQueueController],
  providers: [ReviewQueueService, AdminRoleGuard]
})
export class ReviewQueueModule {}
