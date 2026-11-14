export interface WechatEnvironment {
  NODE_ENV?: string;
  MOCK_WECHAT_LOGIN?: string;
  WECHAT_APP_ID?: string;
  WECHAT_APP_SECRET?: string;
}

export function validateWechatEnvironment(
  environment: WechatEnvironment
): void {
  const production = environment.NODE_ENV === 'production';
  const mock = environment.MOCK_WECHAT_LOGIN === 'true';

  if (production && mock) {
    throw new Error('MOCK_WECHAT_LOGIN is forbidden in production');
  }
  if (!mock && (!environment.WECHAT_APP_ID || !environment.WECHAT_APP_SECRET)) {
    throw new Error(
      'WECHAT_APP_ID and WECHAT_APP_SECRET are required when mock login is disabled'
    );
  }
}

export function usesMockWechatAuth(
  environment: Pick<WechatEnvironment, 'MOCK_WECHAT_LOGIN'>
): boolean {
  return environment.MOCK_WECHAT_LOGIN === 'true';
}
