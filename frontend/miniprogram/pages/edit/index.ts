import {
  ApiRequestError,
  editPost,
  fetchPostDetail,
  fetchTags
} from '../../services/api';
import { loadSession } from '../../services/session';
import { PostDetail, Session, TagItem } from '../../types';
import {
  countGraphemes,
  normalizeBody
} from '../../utils/graphemes';
import {
  createIdempotencyKey,
  IdempotencyManager
} from '../../utils/idempotency';
import { createViewToken } from '../../utils/view-token';

const idempotency = new IdempotencyManager('post.edit');

Page({
  data: {
    postId: '',
    post: null as PostDetail | null,
    bodyText: '',
    charCount: 0,
    emotionTags: [] as TagItem[],
    contextTags: [] as TagItem[],
    emotionIndex: 0,
    contextIndex: 0,
    loading: true,
    saving: false,
    message: ''
  },

  session: null as Session | null,

  async onLoad(query: Record<string, string | undefined>) {
    const session = loadSession();
    const postId = query.id ?? '';
    if (!session || !postId) {
      this.setData({ loading: false, message: '请先登录后再编辑' });
      return;
    }
    this.session = session;
    this.setData({ postId });
    try {
      const [post, catalog] = await Promise.all([
        fetchPostDetail(postId, createViewToken(), session.accessToken),
        fetchTags()
      ]);
      if (!post.is_author) {
        this.setData({ loading: false, message: '你无权编辑这条内容' });
        return;
      }
      const emotionTags = [
        { id: '', name: '不选择', category: 'EMOTION' as const, sort_order: 0 },
        ...catalog.items.filter((tag) => tag.category === 'EMOTION')
      ];
      const contextTags = [
        { id: '', name: '不选择', category: 'CONTEXT' as const, sort_order: 0 },
        ...catalog.items.filter((tag) => tag.category === 'CONTEXT')
      ];
      this.setData({
        post,
        bodyText: post.body_text,
        charCount: countGraphemes(post.body_text),
        emotionTags,
        contextTags,
        emotionIndex: Math.max(
          0,
          emotionTags.findIndex((tag) => tag.id === post.emotion_tag?.id)
        ),
        contextIndex: Math.max(
          0,
          contextTags.findIndex((tag) => tag.id === post.context_tag?.id)
        ),
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '内容加载失败，请稍后重试'
      });
    }
  },

  onBodyInput(event: WechatMiniprogram.Input) {
    const bodyText = event.detail.value;
    this.setData({
      bodyText,
      charCount: countGraphemes(normalizeBody(bodyText))
    });
  },

  onEmotionChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ emotionIndex: Number(event.detail.value) });
  },

  onContextChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ contextIndex: Number(event.detail.value) });
  },

  validate() {
    const body = normalizeBody(this.data.bodyText);
    const length = countGraphemes(body);
    if (length < 1 || length > 500) {
      this.setData({
        message:
          length < 1
            ? '正文不能为空'
            : `当前正文为 ${length} 个可见字符，请删减后再保存`
      });
      return false;
    }
    return true;
  },

  async save(riskAcknowledged = false) {
    const session = this.session;
    const post = this.data.post;
    if (!session || !post || this.data.saving || !this.validate()) {
      return;
    }
    const payload = {
      expected_content_version: post.content_version,
      body_text: normalizeBody(this.data.bodyText),
      emotion_tag_id: this.data.emotionTags[this.data.emotionIndex]?.id || null,
      context_tag_id: this.data.contextTags[this.data.contextIndex]?.id || null,
      risk_acknowledged: riskAcknowledged
    };
    this.setData({ saving: true, message: '' });
    try {
      await editPost(
        session,
        post.id,
        idempotency.forPayload(payload),
        payload
      );
      idempotency.reset();
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 350);
    } catch (error) {
      this.setData({ saving: false });
      if (
        error instanceof ApiRequestError &&
        error.payload.code === 'JIJU_MODERATION_4092'
      ) {
        const confirmed = await new Promise<boolean>((resolve) => {
          wx.showModal({
            title: '提交前风险确认',
            content: '修改后的内容需要重新进入人工复核，确认后仍可能被下架。',
            confirmText: '确认提交',
            success: (result) => resolve(result.confirm),
            fail: () => resolve(false)
          });
        });
        if (confirmed) {
          await this.save(true);
        }
        return;
      }
      this.setData({
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '保存失败，请稍后重试'
      });
    }
  },

  submit() {
    void this.save(false);
  }
});
