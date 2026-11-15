import {
  ApiRequestError,
  fetchProfile,
  updateProfile
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
import { Session } from '../../types';
import { countGraphemes, normalizeBody } from '../../utils/graphemes';
import { createIdempotencyKey } from '../../utils/idempotency';

Page({
  data: {
    session: null as Session | null,
    nickname: '',
    avatarInitial: '我',
    nicknameCount: 0,
    loading: true,
    saving: false,
    message: ''
  },

  hasShown: false,

  onLoad() {
    void this.initialize();
  },

  onShow() {
    if (!this.hasShown) {
      this.hasShown = true;
      return;
    }
    void this.initialize();
  },

  async initialize() {
    const session = loadSession();
    if (!session) {
      this.setData({ session: null, loading: false, message: '' });
      return;
    }
    this.setData({ session, loading: true, message: '' });
    try {
      const profile = await fetchProfile(session);
      this.setData({
        nickname: profile.plaza_nickname,
        avatarInitial: Array.from(profile.plaza_nickname)[0] ?? '我',
        nicknameCount: countGraphemes(profile.plaza_nickname),
        loading: false
      });
    } catch (error) {
      if (isAuthenticationError(error)) {
        clearSession();
        this.setData({ session: null, loading: false, message: '' });
        return;
      }
      this.setData({
        loading: false,
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '个人资料加载失败'
      });
    }
  },

  openLogin() {
    openLoginPage();
  },

  onNicknameInput(event: WechatMiniprogram.Input) {
    const nickname = event.detail.value;
    this.setData({
      nickname,
      nicknameCount: countGraphemes(normalizeBody(nickname)),
      avatarInitial: Array.from(normalizeBody(nickname))[0] ?? '我'
    });
  },

  async save() {
    const session = this.data.session;
    if (!session || this.data.saving) {
      return;
    }
    const nickname = normalizeBody(this.data.nickname);
    const nicknameCount = countGraphemes(nickname);
    if (nicknameCount < 1 || nicknameCount > 20) {
      this.setData({ message: '昵称需为 1 至 20 个可见字符' });
      return;
    }
    this.setData({ saving: true, message: '' });
    try {
      const updated = await updateProfile(
        session,
        {
          plaza_nickname: nickname
        },
        createIdempotencyKey('profile.update')
      );
      saveSession({
        ...session,
        user: {
          ...session.user,
          plaza_nickname: updated.plaza_nickname
        }
      });
      wx.showToast({ title: '个人资料已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 350);
    } catch (error) {
      this.setData({
        saving: false,
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '保存失败，请稍后重试'
      });
    }
  }
});
