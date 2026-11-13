import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigurableContentRuleEngine } from './configurable-content-rule.engine';
import { CONTENT_RULE_ENGINE } from './content-rule-engine';

@Module({
  providers: [
    {
      provide: CONTENT_RULE_ENGINE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new ConfigurableContentRuleEngine(configService)
    }
  ],
  exports: [CONTENT_RULE_ENGINE]
})
export class ContentModule {}
