export type RuleDecision = 'PASS' | 'CONFIRM' | 'BLOCK';

export interface RuleEvaluation {
  decision: RuleDecision;
  matchedRuleIds: string[];
  ruleConfigVersion: string;
  promptVersion: string;
  resourceVersion: string;
  resources: Array<{ name: string; scope: string; url: string }>;
}

export interface ContentRuleEngine {
  evaluate(text: string): Promise<RuleEvaluation>;
}

export const CONTENT_RULE_ENGINE = Symbol('CONTENT_RULE_ENGINE');
