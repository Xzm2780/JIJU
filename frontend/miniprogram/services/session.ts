import { Session } from '../types';

const SESSION_KEY = 'jiju.session.v1';

export function loadSession(): Session | null {
  const stored = wx.getStorageSync(SESSION_KEY) as Session | '' | undefined;
  if (!stored || typeof stored !== 'object' || !stored.accessToken) {
    return null;
  }
  if (new Date(stored.expiresAt).getTime() <= Date.now()) {
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
