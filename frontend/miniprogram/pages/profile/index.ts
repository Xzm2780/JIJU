import {
  ApiRequestError,
  fetchProfile,
  updateProfile
} from '../../services/api';
import {
  loadSession,
  saveSession
} from '../../services/session';
import { Session, UserProfile } from '../../types';
import { countGraphemes, normalizeBody } from '../../utils/graphemes';
import { createIdempotencyKey } from '../../utils/idempotency';

const AVATAR_COLORS: Array<{
  value: UserProfile['avatar_color'];
  label: string;
}> = [
  { value: 'ROSE', label: '烟粉' },
  { value: 'SAGE', label: '鼠尾草' },
  { value: 'SAND', label: '暖沙' },
  { value: 'LAVENDER', label: '灰紫' },
  { value: 'SKY', label: '雾蓝' }
];

Page({
  data: {
    session: null as Session | null,
    nickname: '',
    bio: '',
    avatarColor: 'ROSE' as UserProfile['avatar_color'],
    avatarInitial: '我',
    nicknameCount: 0,
    bioCount: 0,
    colors: AVATAR_COLORS,
    loading: true,
    saving: false,
    message: ''
  },

  async onLoad() {
    const session = loadSession();
    if (!session) {
      this.setData({ loading: false, message: '请先登录' });
      return;
    }
    this.setData({ session });
    try {
      const profile = await fetchProfile(session);
      this.setData({
        nickname: profile.plaza_nickname,
        bio: profile.bio,
        avatarColor: profile.avatar_color,
        avatarInitial: Array.from(profile.plaza_nickname)[0] ?? '我',
        nicknameCount: countGraphemes(profile.plaza_nickname),
        bioCount: countGraphemes(profile.bio),
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '资料加载失败'
      });
    }
  },

  onNicknameInput(event: WechatMiniprogram.Input) {
    const nickname = event.detail.value;
    this.setData({
      nickname,
      nicknameCount: countGraphemes(normalizeBody(nickname)),
      avatarInitial: Array.from(normalizeBody(nickname))[0] ?? '我'
    });
  },

  onBioInput(event: WechatMiniprogram.Input) {
    const bio = event.detail.value;
    this.setData({
      bio,
      bioCount: countGraphemes(normalizeBody(bio))
    });
  },

  selectColor(event: WechatMiniprogram.BaseEvent) {
    this.setData({
      avatarColor: event.currentTarget.dataset.color as UserProfile['avatar_color']
    });
  },

  async save() {
    const session = this.data.session;
    if (!session || this.data.saving) {
      return;
    }
    const nickname = normalizeBody(this.data.nickname);
    const nicknameCount = countGraphemes(nickname);
    const bio = normalizeBody(this.data.bio);
    if (nicknameCount < 1 || nicknameCount > 20) {
      this.setData({ message: '昵称需为 1 至 20 个可见字符' });
      return;
    }
    if (countGraphemes(bio) > 80) {
      this.setData({ message: '个人简介最多 80 个可见字符' });
      return;
    }
    this.setData({ saving: true, message: '' });
    try {
      const updated = await updateProfile(
        session,
        {
          plaza_nickname: nickname,
          bio,
          avatar_color: this.data.avatarColor
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
      wx.showToast({ title: '资料已保存', icon: 'success' });
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
