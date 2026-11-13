import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ContentRuleEngine,
  RuleDecision,
  RuleEvaluation
} from './content-rule-engine';

interface RuleConfig {
  version: string;
  promptVersion: string;
  resourceVersion: string;
  resources: Array<{ name: string; scope: string; url: string }>;
  rules: Array<{
    id: string;
    decision: Exclude<RuleDecision, 'PASS'>;
    match: 'contains' | 'regex';
    values: string[];
  }>;
}

@Injectable()
export class ConfigurableContentRuleEngine implements ContentRuleEngine {
  private configPromise: Promise<RuleConfig> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async evaluate(text: string): Promise<RuleEvaluation> {
    const config = await this.loadConfig();
    const blocked: string[] = [];
    const confirm: string[] = [];

    for (const rule of config.rules) {
      const matched = rule.values.some((value) =>
        rule.match === 'contains'
          ? text.includes(value)
          : new RegExp(value, 'u').test(text)
      );
      if (!matched) {
        continue;
      }
      if (rule.decision === 'BLOCK') {
        blocked.push(rule.id);
      } else {
        confirm.push(rule.id);
      }
    }

    return {
      decision: blocked.length > 0 ? 'BLOCK' : confirm.length > 0 ? 'CONFIRM' : 'PASS',
      matchedRuleIds: [...blocked, ...confirm],
      ruleConfigVersion: config.version,
      promptVersion: config.promptVersion,
      resourceVersion: config.resourceVersion,
      resources: config.resources
    };
  }

  private loadConfig(): Promise<RuleConfig> {
    if (!this.configPromise) {
      const configuredPath =
        this.configService.get<string>('CONTENT_RULES_FILE') ??
        'config/content-rules.json';
      const absolutePath = path.resolve(process.cwd(), configuredPath);
      this.configPromise = readFile(absolutePath, 'utf8').then(
        (content) => JSON.parse(content) as RuleConfig
      );
    }
    return this.configPromise;
  }
}
