import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countGraphemes,
  normalizeBody
} from '../miniprogram/utils/graphemes';
import {
  DRAFT_KEY,
  DRAFT_TTL_MS,
  clearDraft,
  loadDraft,
  saveDraft
} from '../miniprogram/utils/draft';
import {
  IdempotencyManager,
  createIdempotencyKey,
  createUuidV7
} from '../miniprogram/utils/idempotency';
import { PublishDraft } from '../miniprogram/types';

const storage = new Map<string, unknown>();

beforeEach(() => {
  storage.clear();
  (globalThis as unknown as { wx: unknown }).wx = {
    getStorageSync: (key: string) => storage.get(key) ?? '',
    setStorageSync: (key: string, value: unknown) => {
      storage.set(key, value);
    },
    removeStorageSync: (key: string) => {
      storage.delete(key);
    }
  };
});

describe('publish client utilities', () => {
  it('counts extended grapheme clusters', () => {
    expect(countGraphemes('👨‍👩‍👧‍👦')).toBe(1);
    expect(countGraphemes('e\u0301')).toBe(1);
    expect(normalizeBody('  你好  ')).toBe('你好');
  });

  it('creates UUIDv7 and operation-scoped idempotency keys', () => {
    const now = Date.parse('2026-11-13T10:00:00Z');
    expect(createUuidV7(now)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(createIdempotencyKey('post.publish', now)).toMatch(
      /^v1:post\.publish:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('reuses a key for retries and changes it for a new payload', () => {
    const manager = new IdempotencyManager('post.publish');
    const first = manager.forPayload({ body_text: '原文' });
    expect(manager.forPayload({ body_text: '原文' })).toBe(first);
    expect(manager.forPayload({ body_text: '修改后' })).not.toBe(first);
  });

  it('preserves body, tags and retention in a 24-hour local draft', () => {
    const now = Date.parse('2026-11-13T10:00:00Z');
    const draft: PublishDraft = {
      body_text: '今天有点累',
      emotion_tag_id: 'tag_emotion',
      context_tag_id: 'tag_context',
      retention_hours: 72,
      public_acknowledged: true
    };
    saveDraft(draft, now);
    expect(loadDraft(now + 1000)).toEqual(draft);
    expect(storage.has(DRAFT_KEY)).toBe(true);
    expect(loadDraft(now + DRAFT_TTL_MS + 1)).toBeNull();
    expect(storage.has(DRAFT_KEY)).toBe(false);
  });

  it('clears a draft after success', () => {
    saveDraft({
      body_text: '草稿',
      emotion_tag_id: '',
      context_tag_id: '',
      retention_hours: 168,
      public_acknowledged: true
    });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
