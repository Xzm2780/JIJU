import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApp } from '../../demo/publish/server/app.js';
import {
  CONTEXT_TAGS,
  EMOTION_TAGS
} from '../../demo/publish/public/shared/tags.js';
import { createIdempotencyKey } from '../../demo/publish/public/modules/idempotency.js';

const FIXED_NOW = Date.parse('2026-11-14T02:00:00.000Z');

async function startApp(clock = () => FIXED_NOW) {
  const app = createDemoApp({ clock });
  const baseUrl = await app.listen();
  return { app, baseUrl };
}

async function login(baseUrl, code) {
  const response = await fetch(`${baseUrl}/api/v1/auth/wechat/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  return body.data;
}

function publish(baseUrl, token, key, overrides = {}) {
  return fetch(`${baseUrl}/api/v1/posts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': key
    },
    body: JSON.stringify({
      body_text: '今天有一点累，但我还是想把它说出来。',
      emotion_tag_id: EMOTION_TAGS[2].id,
      context_tag_id: CONTEXT_TAGS[3].id,
      retention_hours: 168,
      risk_acknowledged: false,
      ...overrides
    })
  });
}

test('AC-03: valid publish returns PUBLISHED and a fixed expiry', async (t) => {
  const { app, baseUrl } = await startApp();
  t.after(() => app.close());
  const session = await login(baseUrl, 'acceptance-normal');

  const response = await publish(
    baseUrl,
    session.access_token,
    createIdempotencyKey('post.publish')
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.data.public_status, 'PUBLISHED');
  assert.equal(body.data.moderation_status, 'PASSED');
  assert.equal(
    Date.parse(body.data.expires_at) - Date.parse(body.data.published_at),
    168 * 60 * 60 * 1000
  );
  assert.equal(body.data.view_count, undefined);
});

test('AC-04 + SUP-01: empty, 500 and 501 grapheme boundaries', async (t) => {
  const { app, baseUrl } = await startApp();
  t.after(() => app.close());
  const session = await login(baseUrl, 'acceptance-boundaries');
  const family = '👨‍👩‍👧‍👦';

  const empty = await publish(
    baseUrl,
    session.access_token,
    createIdempotencyKey('post.publish'),
    { body_text: '   ' }
  );
  assert.equal(empty.status, 422);

  const fiveHundred = await publish(
    baseUrl,
    session.access_token,
    createIdempotencyKey('post.publish'),
    { body_text: family.repeat(500) }
  );
  assert.equal(fiveHundred.status, 201);

  const fiveHundredOne = await publish(
    baseUrl,
    session.access_token,
    createIdempotencyKey('post.publish'),
    { body_text: family.repeat(501) }
  );
  assert.equal(fiveHundredOne.status, 422);
  assert.equal(app.state.posts.length, 1);
});

test('AC-21: unauthenticated publish is rejected without data', async (t) => {
  const { app, baseUrl } = await startApp();
  t.after(() => app.close());

  const response = await publish(
    baseUrl,
    '',
    createIdempotencyKey('post.publish')
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.code, 'JIJU_AUTH_4011');
  assert.equal(app.state.posts.length, 0);
});

test('AC-20: repeated idempotent publish creates one post and one quota usage', async (t) => {
  const { app, baseUrl } = await startApp();
  t.after(() => app.close());
  const session = await login(baseUrl, 'acceptance-idempotent');
  const key = createIdempotencyKey('post.publish');

  const first = await publish(baseUrl, session.access_token, key);
  const replay = await publish(baseUrl, session.access_token, key);
  const firstBody = await first.json();
  const replayBody = await replay.json();

  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(firstBody.data.id, replayBody.data.id);
  assert.equal(app.state.posts.length, 1);
  assert.equal([...app.state.quotas.values()][0], 1);
});

test('AC-07: sixth post in one Beijing day is rejected', async (t) => {
  const { app, baseUrl } = await startApp();
  t.after(() => app.close());
  const session = await login(baseUrl, 'acceptance-quota');

  for (let index = 0; index < 5; index += 1) {
    const response = await publish(
      baseUrl,
      session.access_token,
      createIdempotencyKey('post.publish'),
      { body_text: `配额边界测试 ${index + 1}` }
    );
    assert.equal(response.status, 201);
  }

  const response = await publish(
    baseUrl,
    session.access_token,
    createIdempotencyKey('post.publish'),
    { body_text: '第六篇应被拒绝' }
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.code, 'JIJU_QUOTA_4291');
  assert.equal(app.state.posts.length, 5);
});

test('permission: a non-author cannot edit another user post', async (t) => {
  const { app, baseUrl } = await startApp();
  t.after(() => app.close());
  const author = await login(baseUrl, 'acceptance-author');
  const otherUser = await login(baseUrl, 'acceptance-other');
  const published = await publish(
    baseUrl,
    author.access_token,
    createIdempotencyKey('post.publish')
  );
  const post = (await published.json()).data;

  const response = await fetch(`${baseUrl}/api/v1/posts/${post.id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${otherUser.access_token}`,
      'idempotency-key': createIdempotencyKey('post.edit')
    },
    body: JSON.stringify({
      body_text: '越权修改',
      expected_content_version: 1,
      risk_acknowledged: false
    })
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.code, 'JIJU_ACCESS_4031');
});

test('expiry: comments are rejected after expires_at', async (t) => {
  let now = FIXED_NOW;
  const { app, baseUrl } = await startApp(() => now);
  t.after(() => app.close());
  const session = await login(baseUrl, 'acceptance-expiry');
  const published = await publish(
    baseUrl,
    session.access_token,
    createIdempotencyKey('post.publish'),
    { retention_hours: 24 }
  );
  const post = (await published.json()).data;
  now = Date.parse(post.expires_at);

  const response = await fetch(
    `${baseUrl}/api/v1/posts/${post.id}/comments`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
        'idempotency-key': createIdempotencyKey('comment.publish')
      },
      body: JSON.stringify({ body_text: '到期后不应评论成功' })
    }
  );
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.code, 'JIJU_CONTENT_4221');
});

test('concurrency: one user can keep only one reaction per post', async (t) => {
  const { app, baseUrl } = await startApp();
  t.after(() => app.close());
  const session = await login(baseUrl, 'acceptance-reaction');
  const published = await publish(
    baseUrl,
    session.access_token,
    createIdempotencyKey('post.publish')
  );
  const post = (await published.json()).data;
  const reactionTypes = ['HUG', 'HEAD_PAT', 'CHEER'];

  const responses = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      fetch(`${baseUrl}/api/v1/posts/${post.id}/reaction`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
          'idempotency-key': createIdempotencyKey('reaction.set')
        },
        body: JSON.stringify({
          type: reactionTypes[index % reactionTypes.length]
        })
      })
    )
  );

  assert.equal(responses.every((response) => response.status === 200), true);
  assert.ok(app.state.reactions instanceof Map);
  assert.equal(app.state.reactions.size, 1);
});
