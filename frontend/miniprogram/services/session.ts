import { Session } from '../types';

export const SESSION_KEY = 'jiju.session.v1';

export function loadSession(): Session | null {
  const stored = wx.getStorageSync(SESSION_KEY) as Session | '' | undefined;
  if (
    !stored ||
    typeof stored !== 'object' ||
    typeof stored.accessToken !== 'string' ||
    !stored.accessToken ||
    typeof stored.expiresAt !== 'string' ||
    !stored.user ||
    typeof stored.user.id !== 'string' ||
    typeof stored.user.plaza_nickname !== 'string'
  ) {
    clearSession();
    return null;
  }
  const expiresAt = Date.parse(stored.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearSession();
    return null;
  }
  return stored;
}

export function saveSession(session: Session): void {
  wx.setStorageSync(SESSION_KEY, session);
}

export function clearSession(): void {
  wx.removeStorageSync(SESSION_KEY);
}
