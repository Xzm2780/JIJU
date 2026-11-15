import {
  ApiRequestError,
  cancelReaction,
  createComment,
  deletePost,
  deleteComment,
  fetchComments,
  fetchPostDetail,
  setReaction
} from '../../services/api';
import { loadSession } from '../../services/session';
import { CommentItem, PostDetail, ReactionType } from '../../types';
import { countGraphemes, normalizeBody } from '../../utils/graphemes';
import { formatBeijing } from '../../utils/time';
import { createViewToken } from '../../utils/view-token';
import { createIdempotencyKey } from '../../utils/idempotency';

Page({
  data: {
    postId: '',
    viewToken: '',
    post: null as PostDetail | null,
    publishedAt: '',
    authorInitial: 'TA',
    expiresAt: '',
    loading: true,
    unavailable: false,
    error: '',
    myReaction: null as ReactionType | null,
    reactionBusy: false,
    reactionMessage: '',
    reactionEffect: '',
    reactionEffectIcon: '',
    comments: [] as Array<CommentItem & { publishedLabel: string }>,
    commentText: '',
    commentCount: 0,
    commentsLoading: false,
    commentSubmitting: false,
    commentMessage: '',
    commentsCursor: '',
    commentsHasMore: true
  },

  hasShown: false,

  onLoad(query: Record<string, string | undefined>) {
    const viewToken = createViewToken();
    const postId = query.id ?? '';
    this.setData({ postId, viewToken });
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
        this.data.viewToken || createViewToken(),
        session?.accessToken
      );
      this.setData({
        post,
        authorInitial: Array.from(post.author_nickname)[0] ?? 'TA',
        myReaction: post.my_reaction,
        publishedAt: formatBeijing(post.published_at),
        expiresAt: post.expires_at ? formatBeijing(post.expires_at) : '',
        loading: false
      });
      wx.setNavigationBarTitle({
        title: post.is_author ? '我的情绪' : 'TA的情绪'
      });
      await this.loadComments(true);
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

  onReachBottom() {
    void this.loadComments(false);
  },

  async loadComments(reset: boolean) {
    const post = this.data.post;
    if (!post || this.data.commentsLoading) {
      return;
    }
    if (!reset && (!this.data.commentsHasMore || !this.data.commentsCursor)) {
      return;
    }
    const session = loadSession();
    this.setData({ commentsLoading: true });
    try {
      const page = await fetchComments(
        post.id,
        session?.accessToken,
        reset ? undefined : this.data.commentsCursor
      );
      const existing = new Set(
        reset ? [] : this.data.comments.map((item) => item.id)
      );
      const next = page.data
        .filter((item) => !existing.has(item.id))
        .map((item) => ({
          ...item,
          publishedLabel: formatBeijing(item.published_at)
        }));
      this.setData({
        comments: reset ? next : [...this.data.comments, ...next],
        commentsCursor: page.page.next_cursor ?? '',
        commentsHasMore: page.page.has_more,
        commentsLoading: false
      });
    } catch (error) {
      this.setData({
        commentsLoading: false,
        commentMessage:
          error instanceof ApiRequestError
            ? error.payload.message
            : '评论加载失败'
      });
    }
  },

  onCommentInput(event: WechatMiniprogram.Input) {
    const commentText = event.detail.value;
    this.setData({
      commentText,
      commentCount: countGraphemes(normalizeBody(commentText))
    });
  },

  async submitComment() {
    const post = this.data.post;
    const session = loadSession();
    const body = normalizeBody(this.data.commentText);
    const length = countGraphemes(body);
    if (!post || this.data.commentSubmitting) {
      return;
    }
    if (!session) {
      wx.showModal({
        title: '请先登录',
        content: '登录后才能发表评论。',
        confirmText: '去登录',
        success: (result) => {
          if (result.confirm) {
            wx.switchTab({ url: '/pages/my/index' });
          }
        }
      });
      return;
    }
    if (length < 1 || length > 200) {
      this.setData({
        commentMessage:
          length < 1 ? '评论不能为空' : '评论最多 200 个可见字符'
      });
      return;
    }
    this.setData({ commentSubmitting: true, commentMessage: '' });
    try {
      const created = await createComment(
        session,
        post.id,
        body,
        createIdempotencyKey('comment.publish')
      );
      this.setData({
        comments: [
          ...this.data.comments,
          {
            ...created,
            publishedLabel: formatBeijing(created.published_at)
          }
        ],
        commentText: '',
        commentCount: 0,
        commentSubmitting: false,
        'post.comment_count': this.data.post!.comment_count + 1
      });
    } catch (error) {
      this.setData({ commentSubmitting: false });
      if (
        error instanceof ApiRequestError &&
        error.payload.code === 'JIJU_ACCESS_4032'
      ) {
        wx.showModal({
          title: '需要确认使用须知',
          content: '完成当前版本须知确认后即可评论。',
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
        commentMessage:
          error instanceof ApiRequestError
            ? error.payload.message
            : '评论提交失败'
      });
    }
  },

  async removeComment(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id ?? '');
    const session = loadSession();
    if (!id || !session || this.data.commentSubmitting) {
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '删除这条评论？',
        content: '删除后其他用户将不再看到这条评论。',
        confirmText: '删除',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteComment(
        session,
        id,
        createIdempotencyKey('comment.delete')
      );
      this.setData({
        comments: this.data.comments.filter((item) => item.id !== id),
        'post.comment_count': Math.max(0, this.data.post!.comment_count - 1)
      });
    } catch (error) {
      this.setData({
        commentMessage:
          error instanceof ApiRequestError
            ? error.payload.message
            : '评论删除失败'
      });
    }
  },

  reportComment(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id ?? '');
    if (id) {
      wx.navigateTo({
        url: `/pages/report/index?target_type=COMMENT&target_id=${encodeURIComponent(id)}`
      });
    }
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
    const effectIcon =
      type === 'HUG' ? '♡' : type === 'HEAD_PAT' ? '✧' : '✊';
    this.setData({
      reactionEffect: type,
      reactionEffectIcon: effectIcon
    });
    setTimeout(() => {
      if (this.data.reactionEffect === type) {
        this.setData({ reactionEffect: '', reactionEffectIcon: '' });
      }
    }, 700);
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
