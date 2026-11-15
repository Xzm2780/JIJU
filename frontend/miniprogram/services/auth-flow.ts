import { ApiRequestError } from './api';

export function isAuthenticationError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    (error.statusCode === 401 ||
      error.payload.code === 'JIJU_AUTH_4011' ||
      error.payload.code === 'JIJU_AUTH_4012')
  );
}

export function openLoginPage(): void {
  wx.navigateTo({
    url: '/pages/login/index',
    fail: () => wx.switchTab({ url: '/pages/my/index' })
  });
}
