export const WECHAT_AUTH_PROVIDER = Symbol('WECHAT_AUTH_PROVIDER');

export interface WechatIdentity {
  subjectRef: string;
  provider: 'WECHAT' | 'MOCK';
  nicknameSeed: string;
}

export interface WechatAuthProvider {
  exchangeCode(code: string): Promise<WechatIdentity>;
}
