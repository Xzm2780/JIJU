import { createHmac } from 'node:crypto';
import { ApiError } from '../../common/api-error';
import { WechatAuthProvider, WechatIdentity } from './wechat-auth.provider';

interface Code2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export class WechatCode2SessionProvider implements WechatAuthProvider {
  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly endpoint = 'https://api.weixin.qq.com/sns/jscode2session'
  ) {}

  async exchangeCode(code: string): Promise<WechatIdentity> {
    const url = new URL(this.endpoint);
    url.searchParams.set('appid', this.appId);
    url.searchParams.set('secret', this.appSecret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new ApiError(
        'JIJU_SYSTEM_5031',
        503,
        '登录服务暂时不可用，请稍后重试'
      );
    }

    const body = (await response.json().catch(() => ({}))) as Code2SessionResponse;
    if (!response.ok || body.errcode || !body.openid) {
      throw new ApiError(
        'JIJU_VALIDATION_4221',
        422,
        '登录凭证无效，请重试'
      );
    }

    const subjectRef = createHmac('sha256', this.appSecret)
      .update(body.openid)
      .digest('hex');

    return {
      subjectRef,
      provider: 'WECHAT',
      nicknameSeed: subjectRef
    };
  }
}
