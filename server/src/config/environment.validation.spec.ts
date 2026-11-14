import { validateWechatEnvironment } from './environment.validation';

describe('validateWechatEnvironment', () => {
  it('rejects mock login in production', () => {
    expect(() =>
      validateWechatEnvironment({
        NODE_ENV: 'production',
        MOCK_WECHAT_LOGIN: 'true',
        WECHAT_APP_ID: 'appid',
        WECHAT_APP_SECRET: 'secret'
      })
    ).toThrow('MOCK_WECHAT_LOGIN is forbidden in production');
  });

  it('requires official credentials when mock login is disabled', () => {
    expect(() =>
      validateWechatEnvironment({
        NODE_ENV: 'production',
        MOCK_WECHAT_LOGIN: 'false'
      })
    ).toThrow('WECHAT_APP_ID and WECHAT_APP_SECRET are required');
  });

  it('allows explicitly enabled mock outside production', () => {
    expect(() =>
      validateWechatEnvironment({
        NODE_ENV: 'test',
        MOCK_WECHAT_LOGIN: 'true'
      })
    ).not.toThrow();
  });
});
