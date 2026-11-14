import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

const baseUrl = process.env.JIJU_CONTRACT_BASE_URL?.replace(/\/$/, '');
const allowWrites = process.env.JIJU_CONTRACT_ALLOW_WRITES === 'true';
const primaryToken = process.env.JIJU_CONTRACT_ACCESS_TOKEN;
const otherToken = process.env.JIJU_CONTRACT_OTHER_ACCESS_TOKEN;
const wechatCode = process.env.JIJU_CONTRACT_WECHAT_CODE;

const skipRead = baseUrl
  ? false
  : '未验证：需要 JIJU_CONTRACT_BASE_URL 指向生产 API 契约测试环境';
const skipWrites =
  baseUrl && allowWrites && primaryToken
    ? false
    : '未验证：需要 JIJU_CONTRACT_BASE_URL、JIJU_CONTRACT_ALLOW_WRITES=true 和 JIJU_CONTRACT_ACCESS_TOKEN';
const skipOtherUser =
  baseUrl && allowWrites && otherToken
    ? false
    : '未验证：需要 JIJU_CONTRACT_OTHER_ACCESS_TOKEN 及可写契约测试环境';

function uuidV7() {
  const bytes = randomBytes(16);
  const timestamp = BigInt(Date.now());
  for (let index = 0; index < 6; index += 1) {
    bytes[index] = Number((timestamp >> BigInt(40 - index * 8)) & 0xffn);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function idempotencyKey(operation) {
  return `v1:${operation}:${uuidV7()}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
      ...(options.idempotencyKey
        ? { 'idempotency-key': options.idempotencyKey }
        : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null
  };
}

async function getTags() {
  const response = await request('/tags');
  assert.equal(response.status, 200);
  return response.body.data.items;
}

function publish(tags, overrides = {}, token = primaryToken) {
  const emotion = tags.find((tag) => tag.category === 'EMOTION');
  const context = tags.find((tag) => tag.category === 'CONTEXT');
  return request('/posts', {
    method: 'POST',
    token,
    idempotencyKey: idempotencyKey('post.publish'),
    body: JSON.stringify({
      body_text: '今天有一点累，但我还是想把它说出来。',
      emotion_tag_id: emotion?.id ?? null,
      context_tag_id: context?.id ?? null,
      retention_hours: 168,
      risk_acknowledged: false,
      ...overrides
    })
  });
}

test('production contract: public tag catalog', { skip: skipRead }, async () => {
  const tags = await getTags();
  assert.ok(Array.isArray(tags));
  assert.ok(tags.every((tag) => tag.enabled === undefined));
});

test('AC-03: valid publish returns PUBLISHED and a fixed expiry', { skip: skipWrites }, async () => {
  const tags = await getTags();
  const response = await publish(tags);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.public_status, 'PUBLISHED');
  assert.equal(response.body.data.moderation_status, 'PASSED');
  assert.equal(
    Date.parse(response.body.data.expires_at) -
      Date.parse(response.body.data.published_at),
    168 * 60 * 60 * 1000
  );
  assert.equal(response.body.data.view_count, undefined);
});

test('AC-04 + SUP-01: empty, 500 and 501 grapheme boundaries', { skip: skipWrites }, async () => {
  const tags = await getTags();
  const family = '👨‍👩‍👧‍👦';

  const empty = await publish(tags, { body_text: '   ' });
  assert.equal(empty.status, 422);
  assert.equal(empty.body.code, 'JIJU_VALIDATION_4221');

  const fiveHundred = await publish(tags, {
    body_text: family.repeat(500)
  });
  assert.equal(fiveHundred.status, 201);

  const fiveHundredOne = await publish(tags, {
    body_text: family.repeat(501)
  });
  assert.equal(fiveHundredOne.status, 422);
  assert.equal(fiveHundredOne.body.code, 'JIJU_VALIDATION_4221');
});

test('AC-21: unauthenticated publish is rejected without credentials', { skip: skipRead }, async () => {
  const tags = await getTags();
  const response = await publish(tags, {}, '');
  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'JIJU_AUTH_4011');
});

test(
  'AUTH-02: production login response never exposes WeChat secrets',
  {
    skip:
      baseUrl && wechatCode
        ? false
        : '未验证：需要 JIJU_CONTRACT_WECHAT_CODE'
  },
  async () => {
    const response = await request('/auth/wechat/login', {
      method: 'POST',
      body: JSON.stringify({ code: wechatCode })
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.access_token.startsWith('ses_'), true);
    assert.deepEqual(
      Object.keys(response.body.data).filter((key) =>
        ['openid', 'unionid', 'session_key'].includes(key)
      ),
      []
    );
    assert.equal(JSON.stringify(response.body).includes('session_key'), false);
  }
);

test('AC-20: repeated idempotent publish returns the same post', { skip: skipWrites }, async () => {
  const tags = await getTags();
  const emotion = tags.find((tag) => tag.category === 'EMOTION');
  const context = tags.find((tag) => tag.category === 'CONTEXT');
  const options = {
    method: 'POST',
    token: primaryToken,
    idempotencyKey: idempotencyKey('post.publish'),
    body: JSON.stringify({
      body_text: '相同幂等键只应生成一篇帖子。',
      emotion_tag_id: emotion?.id ?? null,
      context_tag_id: context?.id ?? null,
      retention_hours: 168,
      risk_acknowledged: false
    })
  };

  const first = await request('/posts', options);
  const replay = await request('/posts', options);

  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(first.body.data.id, replay.body.data.id);
});

test(
  'AC-07: sixth post in one Beijing day is rejected',
  {
    skip: skipWrites
      ? skipWrites
      : process.env.JIJU_CONTRACT_CLEAN_ACCOUNT === 'true'
        ? false
        : '未验证：需要 JIJU_CONTRACT_CLEAN_ACCOUNT=true 的专用账号'
  },
  async () => {
    const tags = await getTags();
    for (let index = 0; index < 5; index += 1) {
      const response = await publish(tags, {
        body_text: `生产契约配额边界 ${index + 1}`
      });
      assert.equal(response.status, 201);
    }

    const response = await publish(tags, {
      body_text: '生产契约第六篇应被拒绝'
    });
    assert.equal(response.status, 429);
    assert.equal(response.body.code, 'JIJU_QUOTA_4291');
  }
);

test('T06 red contract: a non-author cannot edit another user post', { skip: skipOtherUser }, async () => {
  const tags = await getTags();
  const published = await publish(tags);
  assert.equal(published.status, 201);

  const response = await request(`/posts/${published.body.data.id}`, {
    method: 'PATCH',
    token: otherToken,
    idempotencyKey: idempotencyKey('post.edit'),
    body: JSON.stringify({
      body_text: '越权修改',
      expected_content_version: 1,
      risk_acknowledged: false
    })
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'JIJU_ACCESS_4031');
});

test(
  'T07 red contract: comments are rejected at expires_at',
  {
    skip: skipWrites
      ? skipWrites
      : process.env.JIJU_CONTRACT_EXPIRED_POST_ID
        ? false
        : '未验证：需要 JIJU_CONTRACT_EXPIRED_POST_ID'
  },
  async () => {
    const response = await request(
      `/posts/${process.env.JIJU_CONTRACT_EXPIRED_POST_ID}/comments`,
      {
        method: 'POST',
        token: primaryToken,
        idempotencyKey: idempotencyKey('comment.publish'),
        body: JSON.stringify({ body_text: '到期后不应评论成功' })
      }
    );
    assert.equal(response.status, 422);
    assert.equal(response.body.code, 'JIJU_CONTENT_4221');
    assert.equal(response.body.message, '内容已不可用');
  }
);

test('T08 red contract: concurrent reactions remain one per user and post', { skip: skipWrites }, async () => {
  const tags = await getTags();
  const published = await publish(tags);
  assert.equal(published.status, 201);
  const reactionTypes = ['HUG', 'HEAD_PAT', 'CHEER'];

  const responses = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      request(`/posts/${published.body.data.id}/reaction`, {
        method: 'PUT',
        token: primaryToken,
        idempotencyKey: idempotencyKey('reaction.set'),
        body: JSON.stringify({
          type: reactionTypes[index % reactionTypes.length]
        })
      })
    )
  );
  assert.equal(responses.every(({ status }) => status === 200), true);

  const detail = await request(`/posts/${published.body.data.id}`, {
    token: primaryToken
  });
  assert.equal(detail.status, 200);
  assert.ok(detail.body.data.reaction_counts.total <= 1);
});
