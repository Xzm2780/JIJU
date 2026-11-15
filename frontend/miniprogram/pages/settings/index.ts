import {
  ApiRequestError,
  deleteAccount,
  logoutSession
} from '../../services/api';
import { openLoginPage } from '../../services/auth-flow';
import {
  clearSession,
  loadSession
} from '../../services/session';
import { Session } from '../../types';
import { createIdempotencyKey } from '../../utils/idempotency';
import { formatBeijing } from '../../utils/time';

Page({
  data: {
    session: null as Session | null,
    busy: false,
    message: ''
  },

  onShow() {
    this.setData({ session: loadSession(), message: '' });
  },

  openLogin() {
    openLoginPage();
  },

  openNotice() {
    wx.navigateTo({ url: '/pages/notice/index' });
  },

  async logout() {
    const session = this.data.session;
    if (!session || this.data.busy) {
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '退出登录',
        content: '退出后本地草稿会保留，账号和内容不会删除。',
        confirmText: '退出',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) {
      return;
    }
    this.setData({ busy: true });
    try {
      await logoutSession(session);
    } catch (error) {
      if (
        !(error instanceof ApiRequestError) ||
        !['JIJU_AUTH_4011', 'JIJU_AUTH_4012'].includes(error.payload.code)
      ) {
        this.setData({
          busy: false,
          message:
            error instanceof ApiRequestError
              ? error.payload.message
              : '退出失败，请稍后重试'
        });
        return;
      }
    }
    clearSession();
    this.setData({ session: null, busy: false, message: '' });
    wx.showToast({ title: '已退出登录', icon: 'success', duration: 800 });
    wx.switchTab({ url: '/pages/feed/index' });
  },

  async deleteAccount() {
    const session = this.data.session;
    if (!session || this.data.busy) {
      return;
    }
    const first = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '永久注销账号',
        content:
          '账号会立即停用，本人内容停止公开，并进入 30 天冷静期。冷静期结束后正文和身份关联将被清理。',
        confirmText: '继续',
        confirmColor: '#914f4f',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false)
      });
    });
    if (!first) {
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '确认注销',
        content: '冷静期内可以重新微信登录恢复账号。',
        confirmText: '确认注销',
        confirmColor: '#914f4f',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) {
      return;
    }
    this.setData({ busy: true });
    try {
      const result = await deleteAccount(
        session,
        createIdempotencyKey('account.delete')
      );
      clearSession();
      this.setData({ session: null, busy: false });
      wx.showModal({
        title: '账号已停用',
        content: `计划清理时间：${formatBeijing(result.deletion_scheduled_at)}`,
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/my/index' })
      });
    } catch (error) {
      this.setData({
        busy: false,
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '注销请求失败，请稍后重试'
      });
    }
  }
});
