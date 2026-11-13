import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NoticesController } from './notices.controller';

@Module({
  imports: [AuthModule],
  controllers: [NoticesController]
})
export class NoticesModule {}
