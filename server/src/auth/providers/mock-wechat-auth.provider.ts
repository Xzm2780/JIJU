import { createHash } from 'node:crypto';
import { WechatAuthProvider, WechatIdentity } from './wechat-auth.provider';

export class MockWechatAuthProvider implements WechatAuthProvider {
  async exchangeCode(code: string): Promise<WechatIdentity> {
    const digest = createHash('sha256').update(`mock:${code}`).digest('hex');
    return {
      subjectRef: `mock_${digest}`,
      provider: 'MOCK',
      nicknameSeed: code
    };
  }
}
