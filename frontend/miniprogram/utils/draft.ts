import { PublishDraft } from '../types';

export const DRAFT_KEY = 'jiju.publish.draft.v1';
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

interface DraftRecord {
  version: 1;
  savedAt: number;
  draft: PublishDraft;
}

export function saveDraft(draft: PublishDraft, now = Date.now()): void {
  const record: DraftRecord = { version: 1, savedAt: now, draft };
  wx.setStorageSync(DRAFT_KEY, record);
}

export function loadDraft(now = Date.now()): PublishDraft | null {
  const record = wx.getStorageSync(DRAFT_KEY) as DraftRecord | '';
  if (!record || record.version !== 1 || typeof record.savedAt !== 'number') {
    wx.removeStorageSync(DRAFT_KEY);
    return null;
  }
  if (now - record.savedAt > DRAFT_TTL_MS) {
    wx.removeStorageSync(DRAFT_KEY);
    return null;
  }
  return record.draft;
}

export function clearDraft(): void {
  wx.removeStorageSync(DRAFT_KEY);
}
