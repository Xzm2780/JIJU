import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApp } from '../server/app.js';
import { createIdempotencyKey } from '../public/modules/idempotency.js';
import { EMOTION_TAGS, CONTEXT_TAGS } from '../public/shared/tags.js';

const FIXED_NOW = Date.parse('2026-11-13T02:00:00Z');

async function startApp(options = {}) {
  const app = createDemoApp({ clock: () => FIXED_NOW, ...options });
  const baseUrl = await app.listen();
  return { app, baseUrl };
}

async function login(baseUrl, code = 'test-login-code') {
  const response = await fetch(`${baseUrl}/api/v1/auth/wechat/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  return body.data;
}

function publish(baseUrl, token, key, payload) {
  return fetch(`${baseUrl}/api/v1/posts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': key
    },
    body: JSON.stringify(payload)
  });
}

function normalPayload(overrides = {}) {
  return {
    body_text: '今天有一点累，但我还是想把它说出来。',
    emotion_tag_id: EMOTION_TAGS[2].id,
    context_tag_id: CONTEXT_TAGS[3].id,
    retention_hours: 168,
    risk_acknowledged: false,
    ...overrides
  };
}

test('serves the publish page without external dependencies', async () => {
  const { app, baseUrl } = await startApp();
  try {
    const response = await fetch(baseUrl);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /发布到广场/);
    assert.match(html, /这是一条公开内容/);
    const appResponse = await fetch(`${baseUrl}/app.js`);
    const appScript = await appResponse.text();
    assert.match(appScript, /登录状态已失效/);
  } finally {
    await app.close();
  }
});

test('AC-03 publish succeeds and fixes expires_at from retention', async () => {
  const { app, baseUrl } = await startApp();
  try {
    const loginData = await login(baseUrl);
    const response = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      normalPayload({ retention_hours: 24 })
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.public_status, 'PUBLISHED');
    assert.equal(body.data.moderation_status, 'PASSED');
    assert.equal(body.data.content_version, 1);
    assert.equal(
      Date.parse(body.data.expires_at) - Date.parse(body.data.published_at),
      24 * 60 * 60 * 1000
    );
    assert.equal(app.state.posts.length, 1);
    assert.equal([...app.state.quotas.values()][0], 1);
  } finally {
    await app.close();
  }
});

test('retention accepts only 24, 72 and 168 hours and defaults to seven days', async () => {
  const { app, baseUrl } = await startApp();
  try {
    const loginData = await login(baseUrl);
    const cases = [
      { input: undefined, expectedHours: 168 },
      { input: 24, expectedHours: 24 },
      { input: 72, expectedHours: 72 },
      { input: 168, expectedHours: 168 }
    ];

    for (const [index, item] of cases.entries()) {
      const payload = normalPayload({ body_text: `留存枚举测试 ${index + 1}` });
      if (item.input === undefined) {
        delete payload.retention_hours;
      }
      else {
        payload.retention_hours = item.input;
      }

      const response = await publish(
        baseUrl,
        loginData.access_token,
        createIdempotencyKey('post.publish'),
        payload
      );
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.data.retention_hours, item.expectedHours);
      assert.equal(
        Date.parse(body.data.expires_at) - Date.parse(body.data.published_at),
        item.expectedHours * 60 * 60 * 1000
      );
    }

    const invalidResponse = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      normalPayload({ retention_hours: 48 })
    );
    assert.equal(invalidResponse.status, 422);
    assert.equal(app.state.posts.length, 4);
  } finally {
    await app.close();
  }
});

test('AC-04 validates 1 to 500 grapheme clusters and does not consume quota on failure', async () => {
  const { app, baseUrl } = await startApp();
  try {
    const loginData = await login(baseUrl);
    const family = '👨‍👩‍👧‍👦';

    const emptyResponse = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      normalPayload({ body_text: '   ' })
    );
    assert.equal(emptyResponse.status, 422);

    const validResponse = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      normalPayload({ body_text: family.repeat(500) })
    );
    assert.equal(validResponse.status, 201);

    const tooLongResponse = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      normalPayload({ body_text: family.repeat(501) })
    );
    const tooLongBody = await tooLongResponse.json();
    assert.equal(tooLongResponse.status, 422);
    assert.equal(tooLongBody.code, 'JIJU_VALIDATION_4221');
    assert.equal(app.state.posts.length, 1);
    assert.equal([...app.state.quotas.values()][0], 1);
  } finally {
    await app.close();
  }
});

test('AC-05 explicit violation is blocked without creating a post or quota usage', async () => {
  const { app, baseUrl } = await startApp();
  try {
    const loginData = await login(baseUrl);
    const response = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      normalPayload({ body_text: '这里是 [[BLOCK]] 演示内容' })
    );
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.code, 'JIJU_VALIDATION_4221');
    assert.equal(app.state.posts.length, 0);
    assert.equal(app.state.quotas.size, 0);
  } finally {
    await app.close();
  }
});

test('AC-07 enforces five posts per Beijing day and resets after midnight', async () => {
  let now = FIXED_NOW;
  const { app, baseUrl } = await startApp({ clock: () => now });
  try {
    const loginData = await login(baseUrl);
    for (let index = 0; index < 5; index += 1) {
      const response = await publish(
        baseUrl,
        loginData.access_token,
        createIdempotencyKey('post.publish', now),
        normalPayload({ body_text: `配额测试帖子 ${index + 1}` })
      );
      assert.equal(response.status, 201);
    }

    const sixthResponse = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish', now),
      normalPayload({ body_text: '第 6 篇应被阻止' })
    );
    const sixthBody = await sixthResponse.json();
    assert.equal(sixthResponse.status, 429);
    assert.equal(sixthBody.code, 'JIJU_QUOTA_4291');
    assert.ok(sixthBody.details.next_available_bj);
    assert.equal(app.state.posts.length, 5);

    now = Date.parse('2026-11-14T00:10:00Z');
    const nextDayResponse = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish', now),
      normalPayload({ body_text: '北京时间第二天发布成功' })
    );
    assert.equal(nextDayResponse.status, 201);
    assert.equal(app.state.posts.length, 6);
  } finally {
    await app.close();
  }
});

test('AC-20 same idempotency key creates one post and same key with different payload conflicts', async () => {
  const { app, baseUrl } = await startApp();
  try {
    const loginData = await login(baseUrl);
    const key = createIdempotencyKey('post.publish');
    const payload = normalPayload();
    const [first, second] = await Promise.all([
      publish(baseUrl, loginData.access_token, key, payload),
      publish(baseUrl, loginData.access_token, key, payload)
    ]);
    const firstBody = await first.json();
    const secondBody = await second.json();

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(firstBody.data.id, secondBody.data.id);
    assert.equal(app.state.posts.length, 1);
    assert.equal([...app.state.quotas.values()][0], 1);

    const conflictResponse = await publish(
      baseUrl,
      loginData.access_token,
      key,
      normalPayload({ body_text: '同一幂等键但内容不同' })
    );
    assert.equal(conflictResponse.status, 409);
  } finally {
    await app.close();
  }
});

test('AUTH-02 flow API requires login and preserves the publish operation for retry', async () => {
  const { app, baseUrl } = await startApp();
  try {
    const payload = normalPayload();
    const unauthorized = await publish(
      baseUrl,
      '',
      createIdempotencyKey('post.publish'),
      payload
    );
    const unauthorizedBody = await unauthorized.json();
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorizedBody.code, 'JIJU_AUTH_4011');

    const loginData = await login(baseUrl);
    const authorized = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      payload
    );
    assert.equal(authorized.status, 201);
    assert.equal(app.state.posts.length, 1);
  } finally {
    await app.close();
  }
});

test('simulated review branch requires confirmation and publishes as PENDING', async () => {
  const { app, baseUrl } = await startApp();
  try {
    const loginData = await login(baseUrl);
    const reviewPayload = normalPayload({ body_text: '这是 [[REVIEW]] 演示内容' });
    const firstResponse = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      reviewPayload
    );
    const firstBody = await firstResponse.json();
    assert.equal(firstResponse.status, 409);
    assert.equal(firstBody.code, 'JIJU_MODERATION_4091');
    assert.equal(firstBody.details.risk_confirmation_required, true);
    assert.equal(app.state.posts.length, 0);

    const confirmedResponse = await publish(
      baseUrl,
      loginData.access_token,
      createIdempotencyKey('post.publish'),
      { ...reviewPayload, risk_acknowledged: true }
    );
    const confirmedBody = await confirmedResponse.json();
    assert.equal(confirmedResponse.status, 201);
    assert.equal(confirmedBody.data.moderation_status, 'PENDING');
    assert.ok(confirmedBody.data.risk_confirmed_at);
    assert.equal(app.state.posts.length, 1);
  } finally {
    await app.close();
  }
});
