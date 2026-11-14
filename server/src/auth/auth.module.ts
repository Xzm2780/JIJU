import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './session-auth.guard';
import { OptionalSessionAuthGuard } from './optional-session-auth.guard';
import { ConfigService } from '@nestjs/config';
import { MockWechatAuthProvider } from './providers/mock-wechat-auth.provider';
import { WechatCode2SessionProvider } from './providers/wechat-code2session.provider';
import {
  WECHAT_AUTH_PROVIDER
} from './providers/wechat-auth.provider';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionAuthGuard,
    OptionalSessionAuthGuard,
    {
      provide: WECHAT_AUTH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('MOCK_WECHAT_LOGIN') === 'true'
          ? new MockWechatAuthProvider()
          : new WechatCode2SessionProvider(
              config.getOrThrow<string>('WECHAT_APP_ID'),
              config.getOrThrow<string>('WECHAT_APP_SECRET')
            )
    }
  ],
  exports: [SessionAuthGuard, OptionalSessionAuthGuard]
})
export class AuthModule {}
