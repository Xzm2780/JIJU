import {
  ApiRequestError,
  fetchProfile,
  loginWithWechat
} from '../../services/api';
import {
  loadSession,
  saveSession
} from '../../services/session';
import { Session, UserProfile } from '../../types';
import { formatBeijing } from '../../utils/time';

Page({
  data: {
    session: null as Session | null,
    profile: null as UserProfile | null,
    avatarInitial: '',
    loading: false,
    busy: false,
    error: ''
  },

  onShow() {
    const tabBar = (this as unknown as {
      getTabBar?: () => { setData: (value: { selected: number }) => void };
    }).getTabBar?.();
    tabBar?.setData({ selected: 2 });
    const session = loadSession();
    this.setData({ session, error: '' });
    if (session) {
      void this.loadProfile();
    } else {
      this.setData({ profile: null, loading: false });
    }
  },

  onPullDownRefresh() {
    if (this.data.session) {
      void this.loadProfile(true);
    } else {
      wx.stopPullDownRefresh();
    }
  },

  async loadProfile(fromPullDown = false) {
    const session = this.data.session;
    if (!session) {
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const profile = await fetchProfile(session);
      this.setData({
        profile,
        avatarInitial:
          Array.from(profile.plaza_nickname.trim())[0] ?? '我',
        loading: false
      });
      saveSession({
        ...session,
        user: {
          ...session.user,
          plaza_nickname: profile.plaza_nickname
        }
      });
    } catch (error) {
      this.setData({
        loading: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '个人资料加载失败'
      });
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async login(restoreDeletedAccount = false) {
    if (this.data.busy) {
      return;
    }
    this.setData({ busy: true, error: '' });
    try {
      const session = await loginWithWechat(restoreDeletedAccount);
      saveSession(session);
      this.setData({ session, busy: false });
      await this.loadProfile();
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
            )}。是否恢复？`,
            confirmText: '恢复账号',
            success: (result) => resolve(result.confirm),
            fail: () => resolve(false)
          });
        });
        if (restore) {
          await this.login(true);
        }
        return;
      }
      this.setData({
        busy: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '登录失败，请稍后重试'
      });
    }
  },

  retry() {
    void this.loadProfile();
  },

  openMyPosts() {
    wx.navigateTo({ url: '/pages/my-posts/index' });
  },

  editProfile() {
    wx.navigateTo({ url: '/pages/profile/index' });
  },

  openNotice() {
    wx.navigateTo({ url: '/pages/notice/index' });
  },

  openSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  goPublish() {
    wx.switchTab({ url: '/pages/publish/index' });
  }
});
