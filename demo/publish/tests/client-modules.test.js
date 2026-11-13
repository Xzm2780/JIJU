import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countGraphemes,
  normalizeText
} from '../public/modules/graphemes.js';
import {
  clearDraft,
  DRAFT_STORAGE_KEY,
  DRAFT_TTL_MS,
  loadDraft,
  saveDraft
} from '../public/modules/draft.js';
import {
  createIdempotencyKey,
  createIntentKeyManager,
  createUuidV7
} from '../public/modules/idempotency.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test('Unicode extended grapheme clusters are counted as one visible character', () => {
  assert.equal(countGraphemes('👨‍👩‍👧‍👦'), 1);
  assert.equal(countGraphemes('e\u0301'), 1);
  assert.equal(countGraphemes('中🙂'), 2);
  assert.equal(normalizeText('  你好  '), '你好');
});

test('local draft restores body, tags and retention and expires after 24 hours', () => {
  const storage = createMemoryStorage();
  const now = Date.parse('2026-11-13T02:00:00Z');
  const draft = {
    body_text: '今天有点累，但想认真记录。',
    emotion_tag_id: 'tag_00000000-0000-4000-8000-000000000003',
    context_tag_id: 'tag_00000000-0000-4000-8000-000000000104',
    retention_hours: 72,
    public_acknowledged: true
  };

  saveDraft(storage, draft, now);
  assert.deepEqual(loadDraft(storage, now + 1000), draft);
  assert.equal(storage.getItem(DRAFT_STORAGE_KEY) !== null, true);
  assert.equal(loadDraft(storage, now + DRAFT_TTL_MS + 1), null);
  assert.equal(storage.getItem(DRAFT_STORAGE_KEY), null);
});

test('draft can be explicitly cleared after successful publish', () => {
  const storage = createMemoryStorage();
  saveDraft(storage, { body_text: '草稿' });
  assert.ok(loadDraft(storage));
  clearDraft(storage);
  assert.equal(loadDraft(storage), null);
});

test('idempotency keys are UUIDv7 and change only when publish payload changes', () => {
  const now = Date.parse('2026-11-13T02:00:00Z');
  const uuid = createUuidV7(now);
  assert.match(
    uuid,
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );

  const key = createIdempotencyKey('post.publish', now);
  assert.match(
    key,
    /^v1:post\.publish:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );

  const manager = createIntentKeyManager('post.publish', () => now);
  const first = manager.forPayload({ body_text: '同一内容' });
  const retry = manager.forPayload({ body_text: '同一内容' });
  const changed = manager.forPayload({ body_text: '修改后的内容' });
  assert.equal(first.key, retry.key);
  assert.notEqual(first.key, changed.key);
});
