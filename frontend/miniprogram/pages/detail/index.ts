import {
  ApiRequestError,
  cancelReaction,
  deletePost,
  fetchPostDetail,
  setReaction
} from '../../services/api';
import { loadSession } from '../../services/session';
import { PostDetail, ReactionType } from '../../types';
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
    error: '',
    myReaction: null as ReactionType | null,
    reactionBusy: false,
    reactionMessage: ''
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
        myReaction: null,
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

  reportPost() {
    if (this.data.post) {
      wx.navigateTo({
        url: `/pages/report/index?target_type=POST&target_id=${encodeURIComponent(this.data.post.id)}`
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
  },

  async toggleReaction(event: WechatMiniprogram.BaseEvent) {
    const type = event.currentTarget.dataset.type as ReactionType;
    const post = this.data.post;
    const session = loadSession();
    if (!post || this.data.reactionBusy) {
      return;
    }
    if (!session) {
      wx.showModal({
        title: '请先登录',
        content: '登录后才能发送轻互动。',
        confirmText: '去登录',
        success: (result) => {
          if (result.confirm) {
            wx.switchTab({ url: '/pages/my/index' });
          }
        }
      });
      return;
    }
    this.setData({ reactionBusy: true, reactionMessage: '' });
    try {
      const next =
        this.data.myReaction === type
          ? await cancelReaction(
              session,
              post.id,
              createIdempotencyKey('reaction.cancel')
            )
          : await setReaction(
              session,
              post.id,
              type,
              createIdempotencyKey('reaction.set')
            );
      this.setData({
        myReaction: next.my_reaction,
        'post.reaction_counts': next.counts,
        reactionBusy: false
      });
    } catch (error) {
      this.setData({ reactionBusy: false });
      if (
        error instanceof ApiRequestError &&
        error.payload.code === 'JIJU_ACCESS_4032'
      ) {
        wx.showModal({
          title: '需要确认使用须知',
          content: '完成当前版本须知确认后即可继续互动。',
          confirmText: '去确认',
          success: (result) => {
            if (result.confirm) {
              wx.navigateTo({ url: '/pages/notice/index' });
            }
          }
        });
        return;
      }
      this.setData({
        reactionMessage:
          error instanceof ApiRequestError
            ? error.payload.message
            : '轻互动失败，请稍后重试'
      });
    }
  }
});
