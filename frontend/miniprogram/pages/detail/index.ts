import {
  ApiRequestError,
  fetchPostDetail
} from '../../services/api';
import { loadSession } from '../../services/session';
import { PostDetail } from '../../types';
import { formatBeijing } from '../../utils/time';
import { createViewToken } from '../../utils/view-token';

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

  onLoad(query: Record<string, string | undefined>) {
    this.viewToken = createViewToken();
    const postId = query.id ?? '';
    this.setData({ postId });
    void this.loadDetail(postId);
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
  }
});
