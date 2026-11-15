import {
  ApiRequestError,
  confirmNotice,
  loginWithWechat
} from '../../services/api';
import {
  loadSession,
  saveSession
} from '../../services/session';
import { Session } from '../../types';
import { createIdempotencyKey } from '../../utils/idempotency';
import { formatBeijing } from '../../utils/time';

Page({
  data: {
    session: null as Session | null,
    agreed: false,
    busy: false,
    error: ''
  },

  onLoad() {
    this.setData({ session: loadSession() });
  },

  async login() {
    if (!this.data.agreed) {
      this.setData({ error: '请先阅读并勾选使用须知' });
      return;
    }
    await this.performLogin(false);
  },

  async performLogin(restoreDeletedAccount: boolean) {
    if (this.data.busy) {
      return;
    }
    if (this.data.session) {
      await this.continueSession();
      return;
    }
    this.setData({ busy: true, error: '' });
    try {
      const session = await loginWithWechat(restoreDeletedAccount);
      saveSession(session);
      this.setData({ session });
      await this.finalizeSession(session);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.payload.details?.account_recovery_available &&
        !restoreDeletedAccount
      ) {
        this.setData({ busy: false });
        const restore = await new Promise<boolean>((resolve) => {
          wx.showModal({
            title: '恢复账号',
            content: `账号仍处于注销冷静期，截止 ${formatBeijing(
              error.payload.details?.recovery_deadline ?? ''
            )}。是否恢复并继续登录？`,
            confirmText: '恢复账号',
            success: (result) => resolve(result.confirm),
            fail: () => resolve(false)
          });
        });
        if (restore) {
          await this.performLogin(true);
        }
        return;
      }
      this.setData({
        busy: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '登录失败，请检查网络后重试'
      });
    }
  },

  onAgreementChange(event: WechatMiniprogram.CheckboxGroupChange) {
    this.setData({
      agreed: event.detail.value.includes('agreed'),
      error: ''
    });
  },

  openNotice() {
    wx.navigateTo({ url: '/pages/notice/index?review=1' });
  },

  async continueSession() {
    const session = this.data.session;
    if (!session || this.data.busy) {
      return;
    }
    if (!session.noticeConfirmed && !this.data.agreed) {
      this.setData({ error: '请先阅读并勾选使用须知' });
      return;
    }
    this.setData({ busy: true, error: '' });
    try {
      await this.finalizeSession(session);
    } catch (error) {
      this.setData({
        busy: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '使用须知确认失败，请检查网络后重试'
      });
    }
  },

  async finalizeSession(session: Session) {
    let current = session;
    if (!current.noticeConfirmed) {
      await confirmNotice(
        current,
        createIdempotencyKey('notice.confirm')
      );
      current = { ...current, noticeConfirmed: true };
      saveSession(current);
      this.setData({ session: current });
    }
    this.setData({ busy: false });
    wx.showToast({ title: '登录成功', icon: 'success', duration: 900 });
    setTimeout(() => this.finishLogin(), 250);
  },

  finishLogin() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/my/index' });
  },

  cancel() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/my/index' });
  }
});
