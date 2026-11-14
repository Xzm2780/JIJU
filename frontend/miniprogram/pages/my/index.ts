import {
  ApiRequestError,
  deletePost,
  fetchMyPosts,
  loginWithWechat,
  logoutSession
} from '../../services/api';
import {
  clearSession,
  loadSession,
  saveSession
} from '../../services/session';
import {
  MyPostItem,
  MyPostStatusFilter,
  Session
} from '../../types';
import { createIdempotencyKey } from '../../utils/idempotency';
import { formatBeijing } from '../../utils/time';

interface MyPostCard extends MyPostItem {
  publishedLabel: string;
  expiresLabel: string;
  statusLabel: string;
}

function statusLabel(status: MyPostStatusFilter): string {
  return status === 'ACTIVE'
    ? '有效'
    : status === 'EXPIRED'
      ? '已到期'
      : '已下架';
}

Page({
  data: {
    session: null as Session | null,
    status: 'ACTIVE' as MyPostStatusFilter,
    items: [] as MyPostCard[],
    cursor: '',
    hasMore: true,
    loading: false,
    loadingMore: false,
    busy: false,
    error: '',
    message: ''
  },

  onShow() {
    const session = loadSession();
    this.setData({ session, message: '' });
    if (session) {
      void this.loadFirstPage();
    } else {
      this.setData({ items: [], loading: false, error: '' });
    }
  },

  onPullDownRefresh() {
    if (this.data.session) {
      void this.loadFirstPage(true);
    } else {
      wx.stopPullDownRefresh();
    }
  },

  onReachBottom() {
    void this.loadMore();
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
      await this.loadFirstPage();
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

  selectStatus(event: WechatMiniprogram.BaseEvent) {
    const status = event.currentTarget.dataset.status as MyPostStatusFilter;
    if (status === this.data.status) {
      return;
    }
    this.setData({ status, items: [], cursor: '', hasMore: true });
    void this.loadFirstPage();
  },

  async loadFirstPage(fromPullDown = false) {
    const session = this.data.session;
    if (!session) {
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const page = await fetchMyPosts(session, this.data.status);
      this.setData({
        items: page.data.map((item) => this.toCard(item)),
        cursor: page.page.next_cursor ?? '',
        hasMore: page.page.has_more,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '加载失败，请稍后重试'
      });
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadMore() {
    const session = this.data.session;
    if (
      !session ||
      this.data.loading ||
      this.data.loadingMore ||
      !this.data.hasMore ||
      !this.data.cursor
    ) {
      return;
    }
    this.setData({ loadingMore: true, error: '' });
    try {
      const page = await fetchMyPosts(
        session,
        this.data.status,
        this.data.cursor
      );
      const existing = new Set(this.data.items.map((item) => item.id));
      this.setData({
        items: [
          ...this.data.items,
          ...page.data
            .filter((item) => !existing.has(item.id))
            .map((item) => this.toCard(item))
        ],
        cursor: page.page.next_cursor ?? '',
        hasMore: page.page.has_more,
        loadingMore: false
      });
    } catch (error) {
      this.setData({
        loadingMore: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '加载更多失败'
      });
    }
  },

  toCard(item: MyPostItem): MyPostCard {
    return {
      ...item,
      publishedLabel: `${formatBeijing(item.published_at)}（北京时间）`,
      expiresLabel: `${formatBeijing(item.expires_at)}（北京时间）`,
      statusLabel:
        item.public_status === 'EXPIRED'
          ? '已到期'
          : item.public_status === 'HIDDEN'
            ? '已下架'
            : item.moderation_status === 'PENDING'
              ? '审核中'
              : '有效'
    };
  },

  retry() {
    void this.loadFirstPage();
  },

  openDetail(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id ?? '');
    if (id) {
      wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(id)}` });
    }
  },

  editPost(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id ?? '');
    if (id) {
      wx.navigateTo({ url: `/pages/edit/index?id=${encodeURIComponent(id)}` });
    }
  },

  async removePost(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id ?? '');
    const session = this.data.session;
    if (!id || !session) {
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '删除这条内容？',
        content: '删除后不能恢复，也不会返还发帖配额。',
        confirmText: '确认删除',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) {
      return;
    }
    try {
      await deletePost(session, id, createIdempotencyKey('post.delete'));
      await this.loadFirstPage();
    } catch (error) {
      wx.showToast({
        title:
          error instanceof ApiRequestError
            ? error.payload.message
            : '删除失败，请稍后重试',
        icon: 'none'
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
    this.setData({ busy: true });
    try {
      await logoutSession(session);
    } catch (error) {
      if (
        !(error instanceof ApiRequestError) ||
        !['JIJU_AUTH_4011', 'JIJU_AUTH_4012'].includes(error.payload.code)
      ) {
        this.setData({ busy: false });
        return;
      }
    }
    clearSession();
    this.setData({
      session: null,
      items: [],
      busy: false,
      message: '已退出当前会话'
    });
  },

  goPublish() {
    wx.switchTab({ url: '/pages/publish/index' });
  }
});
