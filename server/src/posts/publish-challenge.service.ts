import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDurationMilliseconds } from '../common/duration';
import { createUuidV7 } from '../common/uuid-v7';
import { RedisService } from '../redis/redis.service';

export interface StoredChallenge {
  id: string;
  userId: string;
  contentFingerprint: string;
  promptVersion: string;
  resourceVersion: string;
  resources: Array<{ name: string; scope: string; url: string }>;
  expiresAt: string;
}

@Injectable()
export class PublishChallengeService {
  private readonly ttlMilliseconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService
  ) {
    this.ttlMilliseconds = parseDurationMilliseconds(
      config.get<string>('RISK_CHALLENGE_TTL') ?? '10m'
    );
  }

  async create(
    userId: string,
    contentFingerprint: string,
    promptVersion: string,
    resourceVersion: string,
    resources: Array<{ name: string; scope: string; url: string }>
  ): Promise<StoredChallenge> {
    const challenge: StoredChallenge = {
      id: `chl_${createUuidV7()}`,
      userId,
      contentFingerprint,
      promptVersion,
      resourceVersion,
      resources,
      expiresAt: new Date(Date.now() + this.ttlMilliseconds).toISOString()
    };

    await this.redis.client.set(
      this.key(challenge.id),
      JSON.stringify(challenge),
      'PX',
      this.ttlMilliseconds
    );
    return challenge;
  }

  async get(challengeId: string): Promise<StoredChallenge | null> {
    const raw = await this.redis.client.get(this.key(challengeId));
    return raw ? (JSON.parse(raw) as StoredChallenge) : null;
  }

  async consume(challengeId: string): Promise<void> {
    await this.redis.client.del(this.key(challengeId));
  }

  private key(challengeId: string): string {
    return `risk-challenge:${challengeId}`;
  }
}
