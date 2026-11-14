import { ConfigService } from '@nestjs/config';
import {
  ModerationStatus,
  PublicStatus,
  TagCategory
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { createUuidV7 } from '../common/uuid-v7';
import { PostsService } from './posts.service';

const USER: AuthenticatedUser = {
  id: 'usr_00000000-0000-7000-8000-000000000001',
  authProvider: 'MOCK',
  plazaNickname: '晚风 1024',
  accountStatus: 'ACTIVE'
};

const EMOTION_TAG = {
  id: 'tag_00000000-0000-4000-8000-000000000003',
  category: TagCategory.EMOTION,
  name: '疲惫'
};
const CONTEXT_TAG = {
  id: 'tag_00000000-0000-4000-8000-000000000104',
  category: TagCategory.CONTEXT,
  name: '职场'
};

function createIdempotencyKey(operation: string, now = Date.now()): string {
  return `v1:${operation}:${createUuidV7(now)}`;
}

function createHarness(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-11-13T10:00:00.000Z');
  let quotaCount = 0;
  let postRecord: any = null;
  let versionRecord: any = null;
  let quotaRecord: any = null;
  let moderationRecord: any = null;
  let idempotencyRecord: any = null;

  const tx = {
    noticeConfirmation: {
      findUnique: jest.fn().mockResolvedValue({ id: 'notice' })
    },
    tag: {
      findMany: jest.fn().mockResolvedValue([EMOTION_TAG, CONTEXT_TAG])
    },
    quotaUsage: {
      count: jest.fn().mockImplementation(() => Promise.resolve(quotaCount)),
      create: jest.fn().mockImplementation(({ data }) => {
        quotaRecord = data;
        quotaCount += 1;
        return Promise.resolve(data);
      })
    },
    post: {
      create: jest.fn().mockImplementation(({ data }) => {
        postRecord = data;
        return Promise.resolve(data);
      })
    },
    postVersion: {
      create: jest.fn().mockImplementation(({ data }) => {
        versionRecord = data;
        return Promise.resolve(data);
      })
    },
    moderationRecord: {
      create: jest.fn().mockImplementation(({ data }) => {
        moderationRecord = data;
        return Promise.resolve(data);
      })
    },
    idempotencyRecord: {
      create: jest.fn().mockImplementation(({ data }) => {
        idempotencyRecord = data;
        return Promise.resolve(data);
      })
    }
  };

  const prisma = {
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined)
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx))
  };

  const redis = {
    client: {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1)
    }
  };

  const challenge = {
    create: jest.fn().mockResolvedValue({
      id: 'chl_00000000-0000-7000-8000-000000000001',
      userId: USER.id,
      contentFingerprint: 'fingerprint',
      promptVersion: 'risk-notice-v1',
      resourceVersion: 'demo-resources-v1',
      resources: [{ name: 'resource', scope: 'demo', url: 'https://example.com' }],
      expiresAt: '2026-11-13T10:10:00.000Z'
    }),
    get: jest.fn().mockResolvedValue(null),
    consume: jest.fn().mockResolvedValue(undefined)
  };

  const ruleEngine = {
    evaluate: jest.fn().mockResolvedValue({
      decision: 'PASS',
      matchedRuleIds: [],
      ruleConfigVersion: 'mvp-rules-v1',
      promptVersion: 'risk-notice-v1',
      resourceVersion: 'demo-resources-v1',
      resources: []
    })
  };

  const config = {
    get: (key: string) =>
      key === 'IDEMPOTENCY_TTL' ? '24h' : undefined,
    getOrThrow: (key: string) => {
      if (key === 'NOTICE_VERSION') {
        return 'mvp-v1';
      }
      throw new Error(`Unknown config ${key}`);
    }
  } as ConfigService;

  const service = new PostsService(
    prisma as any,
    redis as any,
    challenge as any,
    config,
    ruleEngine as any
  );

  Object.assign(service, overrides);

  return {
    service,
    now,
    prisma,
    redis,
    challenge,
    ruleEngine,
    tx,
    get postRecord() {
      return postRecord;
    },
    get versionRecord() {
      return versionRecord;
    },
    get quotaRecord() {
      return quotaRecord;
    },
    get moderationRecord() {
      return moderationRecord;
    },
    get idempotencyRecord() {
      return idempotencyRecord;
    }
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    user: USER,
    idempotencyKey: createIdempotencyKey(
      'post.publish',
      Date.parse('2026-11-13T10:00:00.000Z')
    ),
    requestId: 'req_test',
    body: {
      body_text: '今天有一点累，但我还是想把它说出来。',
      emotion_tag_id: EMOTION_TAG.id,
      context_tag_id: CONTEXT_TAG.id,
      retention_hours: 168,
      risk_acknowledged: false,
      ...overrides
    }
  };
}

describe('PostsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-13T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('publishes a valid post with fixed expires_at and no view_count', async () => {
    const harness = createHarness();
    const response = await harness.service.publish(request());

    expect(response.data.public_status).toBe(PublicStatus.PUBLISHED);
    expect(response.data.moderation_status).toBe(ModerationStatus.PASSED);
    expect(
      new Date(response.data.expires_at as string).getTime() -
        new Date(response.data.published_at as string).getTime()
    ).toBe(168 * 60 * 60 * 1000);
    expect(response.data).not.toHaveProperty('view_count');
    expect(harness.postRecord.publicStatus).toBe(PublicStatus.PUBLISHED);
    expect(harness.postRecord.moderationStatus).toBe(ModerationStatus.PASSED);
    expect(harness.versionRecord.versionNumber).toBe(1);
    expect(harness.quotaRecord.quotaType).toBe('POST_DAILY');
    expect(harness.idempotencyRecord.requestFingerprint).toEqual(expect.any(String));
  });

  it('rejects empty and over-500-grapheme bodies without writes', async () => {
    const harness = createHarness();
    await expect(
      harness.service.publish(request({ body_text: '   ' }))
    ).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221',
      status: 422
    });

    await expect(
      harness.service.publish(
        request({ body_text: '👨‍👩‍👧‍👦'.repeat(501) })
      )
    ).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221',
      status: 422
    });
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('accepts exactly 500 grapheme clusters', async () => {
    const harness = createHarness();
    const response = await harness.service.publish(
      request({ body_text: '👨‍👩‍👧‍👦'.repeat(500) })
    );
    expect(response.data.public_status).toBe(PublicStatus.PUBLISHED);
    expect(harness.postRecord.bodyGraphemeLength).toBe(500);
  });

  it.each([24, 72, 168])(
    'accepts explicit retention_hours=%s and fixes expiry',
    async (retentionHours) => {
      const harness = createHarness();
      const response = await harness.service.publish(
        request({ retention_hours: retentionHours })
      );
      expect(
        new Date(response.data.expires_at as string).getTime() -
          new Date(response.data.published_at as string).getTime()
      ).toBe(retentionHours * 60 * 60 * 1000);
    }
  );

  it('rejects missing retention and never applies a server default', async () => {
    const harness = createHarness();
    await expect(
      harness.service.publish(
        request({ retention_hours: undefined as unknown as 168 })
      )
    ).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221',
      status: 422
    });
    expect(harness.postRecord).toBeNull();
  });

  it('blocks explicit violations and does not create data', async () => {
    const harness = createHarness();
    harness.ruleEngine.evaluate.mockResolvedValue({
      decision: 'BLOCK',
      matchedRuleIds: ['block'],
      ruleConfigVersion: 'v1',
      promptVersion: 'p1',
      resourceVersion: 'r1',
      resources: []
    });

    await expect(
      harness.service.publish(request({ body_text: '[[BLOCK]]' }))
    ).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221',
      status: 422
    });
    expect(harness.postRecord).toBeNull();
  });

  it('normalizes zero-width characters before rule matching', async () => {
    const harness = createHarness();
    harness.ruleEngine.evaluate.mockImplementation(async (text: string) => ({
      decision: text.includes('[[BLOCK]]') ? 'BLOCK' : 'PASS',
      matchedRuleIds: text.includes('[[BLOCK]]') ? ['block'] : [],
      ruleConfigVersion: 'v1',
      promptVersion: 'p1',
      resourceVersion: 'r1',
      resources: []
    }));

    await expect(
      harness.service.publish(
        request({ body_text: '[[\u200BBLOCK]]' })
      )
    ).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221',
      status: 422
    });
    expect(harness.ruleEngine.evaluate).toHaveBeenCalledWith('[[BLOCK]]');
    expect(harness.postRecord).toBeNull();
  });

  it('requires a two-stage challenge before publishing review content', async () => {
    const harness = createHarness();
    harness.ruleEngine.evaluate.mockResolvedValue({
      decision: 'CONFIRM',
      matchedRuleIds: ['review'],
      ruleConfigVersion: 'v1',
      promptVersion: 'risk-notice-v1',
      resourceVersion: 'resources-v1',
      resources: []
    });

    await expect(
      harness.service.publish(request({ body_text: '[[REVIEW]]' }))
    ).rejects.toMatchObject({
      code: 'JIJU_MODERATION_4092',
      status: 409
    });
    expect(harness.challenge.create).toHaveBeenCalled();
    expect(harness.postRecord).toBeNull();
  });

  it('publishes PENDING after a valid risk challenge is confirmed', async () => {
    const harness = createHarness();
    harness.ruleEngine.evaluate.mockResolvedValue({
      decision: 'CONFIRM',
      matchedRuleIds: ['review'],
      ruleConfigVersion: 'v1',
      promptVersion: 'risk-notice-v1',
      resourceVersion: 'resources-v1',
      resources: []
    });
    const challengeId = 'chl_00000000-0000-7000-8000-000000000001';
    await expect(
      harness.service.publish(request({ body_text: '[[REVIEW]]' }))
    ).rejects.toMatchObject({ code: 'JIJU_MODERATION_4092' });

    const fingerprint = harness.challenge.create.mock.calls[0][1];
    harness.challenge.get.mockResolvedValue({
      id: challengeId,
      userId: USER.id,
      contentFingerprint: fingerprint,
      promptVersion: 'risk-notice-v1',
      resourceVersion: 'resources-v1',
      resources: [],
      expiresAt: '2026-11-13T10:10:00.000Z'
    });

    const response = await harness.service.publish(
      request({
        body_text: '[[REVIEW]]',
        risk_acknowledged: true,
        risk_challenge_id: challengeId
      })
    );
    expect(response.data.moderation_status).toBe(ModerationStatus.PENDING);
    expect(harness.moderationRecord).toEqual(
      expect.objectContaining({
        targetId: response.data.id,
        moderationStatusAfter: ModerationStatus.PENDING
      })
    );
    expect(harness.challenge.consume).toHaveBeenCalledWith(challengeId);
  });

  it('rejects an expired or mismatched challenge without creating a post', async () => {
    const harness = createHarness();
    harness.ruleEngine.evaluate.mockResolvedValue({
      decision: 'CONFIRM',
      matchedRuleIds: ['review'],
      ruleConfigVersion: 'v1',
      promptVersion: 'risk-notice-v1',
      resourceVersion: 'resources-v1',
      resources: []
    });
    harness.challenge.get.mockResolvedValue({
      id: 'chl_00000000-0000-7000-8000-000000000001',
      userId: USER.id,
      contentFingerprint: 'different',
      promptVersion: 'risk-notice-v1',
      resourceVersion: 'resources-v1',
      resources: [],
      expiresAt: '2026-11-13T10:10:00.000Z'
    });

    await expect(
      harness.service.publish(
        request({
          body_text: '[[REVIEW]]',
          risk_acknowledged: true,
          risk_challenge_id: 'chl_00000000-0000-7000-8000-000000000001'
        })
      )
    ).rejects.toMatchObject({ code: 'JIJU_MODERATION_4092' });
    expect(harness.postRecord).toBeNull();
  });

  it('returns quota error without writes when Beijing daily limit is exhausted', async () => {
    const harness = createHarness();
    harness.tx.quotaUsage.count.mockResolvedValue(5);

    await expect(harness.service.publish(request())).rejects.toMatchObject({
      code: 'JIJU_QUOTA_4291',
      status: 429
    });
    expect(harness.postRecord).toBeNull();
  });

  it('returns a stored result for the same idempotency key and payload', async () => {
    const harness = createHarness();
    const sameRequest = request();
    const first = await harness.service.publish(sameRequest);
    const fingerprint = harness.idempotencyRecord.requestFingerprint;
    harness.prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'idm_existing',
      requestFingerprint: fingerprint,
      expiresAt: new Date('2026-11-14T10:00:00.000Z'),
      responseJson: first
    });

    const replay = await harness.service.publish(sameRequest);
    expect(replay).toEqual(first);
    expect(harness.tx.post.create).toHaveBeenCalledTimes(1);
    expect(harness.tx.quotaUsage.create).toHaveBeenCalledTimes(1);
  });

  it('replays the stored result when a concurrent request sees the same lock', async () => {
    const firstHarness = createHarness();
    const sameRequest = request();
    const first = await firstHarness.service.publish(sameRequest);

    const replayHarness = createHarness();
    replayHarness.redis.client.set.mockResolvedValueOnce(null);
    replayHarness.prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'idm_concurrent',
      requestFingerprint:
        firstHarness.idempotencyRecord.requestFingerprint,
      expiresAt: new Date('2026-11-14T10:00:00.000Z'),
      responseJson: first
    });

    const replayPromise = replayHarness.service.publish(sameRequest);
    await jest.advanceTimersByTimeAsync(30);
    await expect(replayPromise).resolves.toEqual(first);
    expect(replayHarness.postRecord).toBeNull();
  });

  it('rejects same key with a different payload', async () => {
    const harness = createHarness();
    const sameRequest = request();
    const first = await harness.service.publish(sameRequest);
    const fingerprint = harness.idempotencyRecord.requestFingerprint;
    harness.prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'idm_existing',
      requestFingerprint: fingerprint,
      expiresAt: new Date('2026-11-14T10:00:00.000Z'),
      responseJson: first
    });

    await expect(
      harness.service.publish({
        ...sameRequest,
        body: { ...sameRequest.body, body_text: '修改后的内容' }
      })
    ).rejects.toMatchObject({
      code: 'JIJU_CONFLICT_4091',
      status: 409
    });
  });

  it('deletes and replaces an expired idempotency result', async () => {
    const harness = createHarness();
    harness.prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'idm_expired',
      requestFingerprint: 'stale',
      expiresAt: new Date('2026-11-13T09:00:00.000Z'),
      responseJson: { data: { id: 'stale' }, request_id: 'stale' }
    });

    const response = await harness.service.publish(request());

    expect(response.data.public_status).toBe(PublicStatus.PUBLISHED);
    expect(harness.prisma.idempotencyRecord.delete).toHaveBeenCalledWith({
      where: { id: 'idm_expired' }
    });
    expect(harness.tx.post.create).toHaveBeenCalledTimes(1);
  });

  it('rejects tags from the wrong category and missing notice confirmation', async () => {
    const wrongTagHarness = createHarness();
    wrongTagHarness.tx.tag.findMany.mockResolvedValue([
      { ...EMOTION_TAG, category: TagCategory.CONTEXT },
      CONTEXT_TAG
    ]);
    await expect(
      wrongTagHarness.service.publish(request())
    ).rejects.toMatchObject({
      code: 'JIJU_VALIDATION_4221'
    });

    const noticeHarness = createHarness();
    noticeHarness.tx.noticeConfirmation.findUnique.mockResolvedValue(null);
    await expect(
      noticeHarness.service.publish(request())
    ).rejects.toMatchObject({
      code: 'JIJU_ACCESS_4032',
      status: 403
    });
  });
});
