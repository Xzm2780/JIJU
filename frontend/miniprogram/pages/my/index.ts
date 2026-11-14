import {
  ApiRequestError,
  loginWithWechat,
  logoutSession
} from '../../services/api';
import {
  clearSession,
  loadSession,
  saveSession
} from '../../services/session';
import { Session } from '../../types';

Page({
  data: {
    session: null as Session | null,
    busy: false,
    message: ''
  },

  onShow() {
    this.setData({ session: loadSession(), message: '' });
  },

  async login() {
    if (this.data.busy) {
      return;
    }
    this.setData({ busy: true, message: '' });
    try {
      const session = await loginWithWechat();
      saveSession(session);
      this.setData({ session, busy: false });
    } catch (error) {
      this.setData({
        busy: false,
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '登录失败，请检查网络后重试'
      });
    }
  },

  openNotice() {
    wx.navigateTo({ url: '/pages/notice/index' });
  },

  async logout() {
    const session = this.data.session;
    if (!session || this.data.busy) {
      return;
    }
    this.setData({ busy: true, message: '' });
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
    this.setData({
      session: null,
      busy: false,
      message: '已退出当前会话'
    });
  },

  goPublish() {
    wx.switchTab({ url: '/pages/publish/index' });
  }
});
