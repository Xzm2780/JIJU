import { ApiRequestError, fetchFeed } from '../../services/api';
import { FeedItem } from '../../types';
import { formatBeijing } from '../../utils/time';

interface FeedCard extends FeedItem {
  publishedLabel: string;
}

Page({
  data: {
    items: [] as FeedCard[],
    cursor: '',
    hasMore: true,
    loading: true,
    loadingMore: false,
    error: '',
    requestId: ''
  },

  onLoad() {
    void this.loadFirstPage();
  },

  onPullDownRefresh() {
    void this.loadFirstPage(true);
  },

  onReachBottom() {
    void this.loadMore();
  },

  async loadFirstPage(fromPullDown = false) {
    if (!fromPullDown) {
      this.setData({ loading: true, error: '' });
    }
    try {
      const page = await fetchFeed(undefined, 20);
      this.setData({
        items: page.data.map((item) => ({
          ...item,
          publishedLabel: `${formatBeijing(item.published_at)}（北京时间）`
        })),
        cursor: page.page.next_cursor ?? '',
        hasMore: page.page.has_more,
        requestId: page.request_id,
        loading: false,
        error: ''
      });
    } catch (error) {
      this.setData({
        loading: false,
        error:
          error instanceof ApiRequestError
            ? error.payload.message
            : '网络连接失败，请稍后重试'
      });
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadMore() {
    if (
      this.data.loading ||
      this.data.loadingMore ||
      !this.data.hasMore ||
      !this.data.cursor
    ) {
      return;
    }
    this.setData({ loadingMore: true, error: '' });
    try {
      const page = await fetchFeed(this.data.cursor, 20);
      const existing = new Set(this.data.items.map((item) => item.id));
      const nextItems = page.data
        .filter((item) => !existing.has(item.id))
        .map((item) => ({
          ...item,
          publishedLabel: `${formatBeijing(item.published_at)}（北京时间）`
        }));
      this.setData({
        items: [...this.data.items, ...nextItems],
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
            : '加载更多失败，请稍后重试'
      });
    }
  },

  retry() {
    void (this.data.items.length ? this.loadMore() : this.loadFirstPage());
  },

  openDetail(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id ?? '');
    if (id) {
      wx.navigateTo({
        url: `/pages/detail/index?id=${encodeURIComponent(id)}`
      });
    }
  },

  goPublish() {
    wx.switchTab({ url: '/pages/publish/index' });
  }
});
