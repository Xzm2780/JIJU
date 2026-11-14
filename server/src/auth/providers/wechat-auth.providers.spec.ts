import { createHmac } from 'node:crypto';
import { MockWechatAuthProvider } from './mock-wechat-auth.provider';
import { WechatCode2SessionProvider } from './wechat-code2session.provider';

describe('Wechat auth providers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mock provider returns only an internal identity', async () => {
    const identity = await new MockWechatAuthProvider().exchangeCode('code');
    expect(identity.provider).toBe('MOCK');
    expect(identity.subjectRef).toMatch(/^mock_/);
    expect(identity).not.toHaveProperty('session_key');
    expect(identity).not.toHaveProperty('openid');
  });

  it('official provider hashes openid and drops session_key', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          openid: 'openid-value',
          session_key: 'must-not-escape',
          unionid: 'unionid-value'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const provider = new WechatCode2SessionProvider('appid', 'secret');

    const identity = await provider.exchangeCode('wechat-code');
    const expected = createHmac('sha256', 'secret')
      .update('openid-value')
      .digest('hex');

    expect(identity).toEqual({
      subjectRef: expected,
      provider: 'WECHAT',
      nicknameSeed: expected
    });
    expect(JSON.stringify(identity)).not.toContain('session_key');
    expect(JSON.stringify(identity)).not.toContain('openid-value');
  });

  it('official provider maps invalid code errors without network details', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    const provider = new WechatCode2SessionProvider('appid', 'secret');

    await expect(provider.exchangeCode('bad-code')).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221',
      status: 422
    });
  });
});
