export const DRAFT_STORAGE_KEY = 'jiju.publish.draft.v1';
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function saveDraft(storage, draft, now = Date.now()) {
  const record = {
    version: 1,
    savedAt: now,
    draft
  };
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function loadDraft(storage, now = Date.now()) {
  const raw = storage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const record = JSON.parse(raw);
    if (record?.version !== 1 || typeof record.savedAt !== 'number') {
      storage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }

    if (now - record.savedAt > DRAFT_TTL_MS) {
      storage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }

    return record.draft ?? null;
  } catch {
    storage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

export function clearDraft(storage) {
  storage.removeItem(DRAFT_STORAGE_KEY);
}
