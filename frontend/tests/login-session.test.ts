import { beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error Vitest runs in Node while the miniapp tsconfig limits Node ambient types.
import { readFileSync } from 'node:fs';
import {
  ApiRequestError,
  loginWithWechat
} from '../miniprogram/services/api';
import {
  SESSION_KEY,
  loadSession,
  saveSession
} from '../miniprogram/services/session';
import { Session } from '../miniprogram/types';

const storage = new Map<string, unknown>();
const validSession: Session = {
  accessToken: 'ses_test_token',
  expiresAt: '2026-12-01T00:00:00.000Z',
  user: {
    id: 'usr_test',
    plaza_nickname: '晚风 1024'
  },
  currentNoticeVersion: 'notice-v1',
  noticeConfirmed: false
};

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
  (globalThis as unknown as { getApp: () => unknown }).getApp = () => ({
    globalData: { apiBaseUrl: 'http://127.0.0.1:3001/api/v1' }
  });
});

describe('miniapp login session', () => {
  it('registers the independent login page in the miniapp', () => {
    const app = JSON.parse(readFileSync('miniprogram/app.json', 'utf8')) as {
      pages: string[];
    };
    expect(app.pages).toContain('pages/login/index');
  });

  it('restores a valid saved session', () => {
    saveSession(validSession);
    expect(loadSession()).toEqual(validSession);
  });

  it('clears expired or malformed stored sessions', () => {
    storage.set(SESSION_KEY, {
      ...validSession,
      expiresAt: '2020-01-01T00:00:00.000Z'
    });
    expect(loadSession()).toBeNull();
    expect(storage.has(SESSION_KEY)).toBe(false);

    storage.set(SESSION_KEY, {
      ...validSession,
      expiresAt: 'not-a-date'
    });
    expect(loadSession()).toBeNull();
    expect(storage.has(SESSION_KEY)).toBe(false);

    storage.set(SESSION_KEY, { accessToken: '', expiresAt: '' });
    expect(loadSession()).toBeNull();
    expect(storage.has(SESSION_KEY)).toBe(false);
  });

  it('maps a WeChat login code to a safe platform session', async () => {
    (wx as unknown as {
      login: (options: {
        success: (result: { code: string }) => void;
      }) => void;
    }).login = (options) => options.success({ code: 'wx-one-time-code' });
    (wx as unknown as {
      request: (options: {
        success: (response: {
          statusCode: number;
          data: unknown;
          header: Record<string, string>;
        }) => void;
      }) => void;
    }).request = (options) => {
      options.success({
        statusCode: 200,
        data: {
          data: {
            access_token: 'ses_platform_token',
            token_type: 'Bearer',
            expires_at: '2026-12-01T00:00:00.000Z',
            user: {
              id: 'usr_test',
              plaza_nickname: '晚风 1024'
            },
            current_notice_version: 'notice-v1',
            notice_confirmed: false
          },
          request_id: 'req_login'
        },
        header: {}
      });
    };

    await expect(loginWithWechat()).resolves.toEqual({
      accessToken: 'ses_platform_token',
      expiresAt: '2026-12-01T00:00:00.000Z',
      user: {
        id: 'usr_test',
        plaza_nickname: '晚风 1024'
      },
      currentNoticeVersion: 'notice-v1',
      noticeConfirmed: false
    });
  });

  it('rejects an empty WeChat login code without calling the API', async () => {
    (wx as unknown as {
      login: (options: {
        success: (result: { code: string }) => void;
      }) => void;
    }).login = (options) => options.success({ code: '' });

    await expect(loginWithWechat()).rejects.toMatchObject({
      statusCode: 0,
      payload: {
        code: 'NETWORK_ERROR',
        message: '无法获取微信登录凭证，请检查网络后重试'
      }
    } satisfies Partial<ApiRequestError>);
  });
});
