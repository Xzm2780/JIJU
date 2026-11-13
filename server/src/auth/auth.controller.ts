import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { RequestId } from '../common/request-id.decorator';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { SessionAuthGuard } from './session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat/login')
  async login(
    @Body() body: WechatLoginDto,
    @RequestId() requestId: string
  ) {
    return {
      data: await this.authService.login(body.code),
      request_id: requestId
    };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.authService.logout(request.user.id, request.authSessionId);
  }
}
