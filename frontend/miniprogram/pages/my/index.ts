import {
  ApiRequestError,
  fetchProfile
} from '../../services/api';
import {
  isAuthenticationError,
  openLoginPage
} from '../../services/auth-flow';
import {
  clearSession,
  loadSession,
  saveSession
} from '../../services/session';
import { Session, UserProfile } from '../../types';

Page({
  data: {
    session: null as Session | null,
    profile: null as UserProfile | null,
    avatarInitial: '',
    loading: false,
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
      if (isAuthenticationError(error)) {
        clearSession();
        this.setData({
          session: null,
          profile: null,
          loading: false,
          error: ''
        });
        wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' });
        return;
      }
      this.setData({
        loading: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '广场身份加载失败'
      });
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  openLogin() {
    openLoginPage();
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
