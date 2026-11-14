import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

const baseUrl = process.env.JIJU_PERF_BASE_URL?.replace(/\/$/, '');
const samples = Number(process.env.JIJU_PERF_SAMPLES ?? 20);
const skip = baseUrl
  ? false
  : '未验证：需要 JIJU_PERF_BASE_URL 指向已灌入基线数据的测试环境';

async function timed(path) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`);
  const duration = performance.now() - started;
  assert.ok([200, 404].includes(response.status));
  return duration;
}

test('AC-24 feed p95 stays below 1000ms', { skip }, async () => {
  const durations = [];
  for (let index = 0; index < samples; index += 1) {
    durations.push(await timed('/feed?limit=20'));
  }
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
  assert.ok(p95 <= 1000, `feed p95=${p95.toFixed(1)}ms`);
});

test('AC-24 detail p95 stays below 1000ms', { skip }, async () => {
  const latest = await fetch(`${baseUrl}/feed?limit=1`);
  assert.equal(latest.status, 200);
  const body = await latest.json();
  const postId = body.data[0]?.id;
  assert.ok(postId, 'performance fixture must contain at least one post');
  const durations = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    const response = await fetch(`${baseUrl}/posts/${postId}`, {
      headers: {
        'x-view-token': `v1:00000000-0000-7000-8000-${String(index).padStart(12, '0')}`
      }
    });
    assert.equal(response.status, 200);
    durations.push(performance.now() - started);
  }
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
  assert.ok(p95 <= 1000, `detail p95=${p95.toFixed(1)}ms`);
});
