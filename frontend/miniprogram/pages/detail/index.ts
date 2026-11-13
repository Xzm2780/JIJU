import { PublishedPost } from '../../types';
import { formatBeijing } from '../../utils/time';

Page({
  data: {
    post: null as PublishedPost | null,
    publishedAt: '',
    expiresAt: '',
    statusLabel: '',
    missing: false
  },

  onLoad(query: Record<string, string | undefined>) {
    const post = wx.getStorageSync(
      'jiju.last-published-post.v1'
    ) as PublishedPost | '';
    if (!post || post.id !== query.id) {
      this.setData({ missing: true });
      return;
    }
    this.setData({
      post,
      publishedAt: `${formatBeijing(post.published_at)}（北京时间）`,
      expiresAt: `${formatBeijing(post.expires_at)}（北京时间）`,
      statusLabel:
        post.moderation_status === 'PENDING' ? '审核中' : '已发布',
      missing: false
    });
  },

  backToPublish() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/publish/index' })
    });
  }
});
