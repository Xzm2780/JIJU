import {
  ApiRequestError,
  deletePost,
  fetchPostDetail
} from '../../services/api';
import { loadSession } from '../../services/session';
import { PostDetail } from '../../types';
import { formatBeijing } from '../../utils/time';
import { createViewToken } from '../../utils/view-token';
import { createIdempotencyKey } from '../../utils/idempotency';

Page({
  data: {
    postId: '',
    post: null as PostDetail | null,
    publishedAt: '',
    expiresAt: '',
    loading: true,
    unavailable: false,
    error: ''
  },

  viewToken: '',
  hasShown: false,

  onLoad(query: Record<string, string | undefined>) {
    this.viewToken = createViewToken();
    const postId = query.id ?? '';
    this.setData({ postId });
    void this.loadDetail(postId);
  },

  onShow() {
    if (!this.hasShown) {
      this.hasShown = true;
      return;
    }
    if (this.data.postId) {
      void this.loadDetail(this.data.postId);
    }
  },

  onPullDownRefresh() {
    void this.loadDetail(this.data.postId).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadDetail(postId: string) {
    if (!postId) {
      this.setData({ loading: false, unavailable: true });
      return;
    }
    this.setData({ loading: true, unavailable: false, error: '' });
    try {
      const session = loadSession();
      const post = await fetchPostDetail(
        postId,
        this.viewToken,
        session?.accessToken
      );
      this.setData({
        post,
        publishedAt: `${formatBeijing(post.published_at)}（北京时间）`,
        expiresAt: `${formatBeijing(post.expires_at)}（北京时间）`,
        loading: false
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.statusCode === 404) {
        this.setData({
          loading: false,
          unavailable: true,
          post: null
        });
        return;
      }
      this.setData({
        loading: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '网络连接失败，请稍后重试'
      });
    }
  },

  retry() {
    void this.loadDetail(this.data.postId);
  },

  backToFeed() {
    wx.switchTab({
      url: '/pages/feed/index',
      fail: () => wx.reLaunch({ url: '/pages/feed/index' })
    });
  },

  editPost() {
    if (this.data.post) {
      wx.navigateTo({
        url: `/pages/edit/index?id=${encodeURIComponent(this.data.post.id)}`
      });
    }
  },

  async removePost() {
    const post = this.data.post;
    const session = loadSession();
    if (!post || !session || !post.is_author) {
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '删除这条内容？',
        content: '删除后将立即从广场、详情和“我的”中消失，且不能恢复。',
        confirmText: '确认删除',
        confirmColor: '#a5686c',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) {
      return;
    }
    try {
      await deletePost(
        session,
        post.id,
        createIdempotencyKey('post.delete')
      );
      wx.switchTab({ url: '/pages/feed/index' });
    } catch (error) {
      wx.showToast({
        title:
          error instanceof ApiRequestError
            ? error.payload.message
            : '删除失败，请稍后重试',
        icon: 'none'
      });
    }
  }
});
