import { ConfigService } from '@nestjs/config';
import { ConfigurableContentRuleEngine } from './configurable-content-rule.engine';

describe('ConfigurableContentRuleEngine', () => {
  const config = {
    get: (key: string) =>
      key === 'CONTENT_RULES_FILE' ? 'config/content-rules.json' : undefined
  } as ConfigService;

  const engine = new ConfigurableContentRuleEngine(config);

  it('returns PASS for ordinary text', async () => {
    const result = await engine.evaluate('今天想认真记录一下。');
    expect(result.decision).toBe('PASS');
    expect(result.matchedRuleIds).toEqual([]);
  });

  it('returns CONFIRM for a confirm rule', async () => {
    const result = await engine.evaluate('这是 [[REVIEW]] 内容');
    expect(result.decision).toBe('CONFIRM');
    expect(result.promptVersion).toBe('risk-notice-v1');
    expect(result.resources).toHaveLength(1);
  });

  it('gives BLOCK precedence over CONFIRM', async () => {
    const result = await engine.evaluate('[[REVIEW]] 和 [[BLOCK]]');
    expect(result.decision).toBe('BLOCK');
  });
});
