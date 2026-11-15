import {
  ApiRequestError,
  confirmNotice,
  fetchTags,
  loginWithWechat,
  publishPost
} from '../../services/api';
import {
  clearSession,
  loadSession,
  saveSession
} from '../../services/session';
import { PublishedPost, Session, TagItem } from '../../types';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draft';
import {
  countGraphemes,
  normalizeBody
} from '../../utils/graphemes';
import {
  createIdempotencyKey,
  IdempotencyManager
} from '../../utils/idempotency';
import { formatBeijing } from '../../utils/time';

interface RiskContext {
  challengeId: string;
  promptVersion: string;
  resources: Array<{ name: string; scope: string; url: string }>;
}

const idempotency = new IdempotencyManager('post.publish');

Page({
  data: {
    session: null as Session | null,
    sessionLabel: '游客',
    bodyText: '',
    charCount: 0,
    emotionTags: [] as TagItem[],
    contextTags: [] as TagItem[],
    emotionIndex: 0,
    contextIndex: 0,
    retentionHours: 168 as 24 | 72 | 168,
    publicAcknowledged: false,
    message: '',
    messageType: '' as '' | 'error' | 'warning' | 'info',
    publishing: false,
    showLoginModal: false,
    loadingTags: true
  },

  riskContext: null as RiskContext | null,
  pendingPublishAfterLogin: false,

  async onLoad() {
    const session = loadSession();
    this.setData({
      session,
      sessionLabel: session?.user.plaza_nickname ?? '游客'
    });
    await this.loadTags();
    this.applyDraft(loadDraft());
  },

  onShow() {
    const tabBar = (this as unknown as {
      getTabBar?: () => { setData: (value: { selected: number }) => void };
    }).getTabBar?.();
    tabBar?.setData({ selected: 1 });
  },

  async loadTags() {
    try {
      const catalog = await fetchTags();
      this.setData({
        emotionTags: [
          {
            id: '',
            name: '不选择',
            category: 'EMOTION' as const,
            sort_order: 0
          },
          ...catalog.items.filter((tag) => tag.category === 'EMOTION')
        ],
        contextTags: [
          {
            id: '',
            name: '不选择',
            category: 'CONTEXT' as const,
            sort_order: 0
          },
          ...catalog.items.filter((tag) => tag.category === 'CONTEXT')
        ],
        loadingTags: false
      });
    } catch (error) {
      this.setData({
        loadingTags: false,
        message:
          error instanceof ApiRequestError ? error.payload.message : '标签加载失败',
        messageType: 'error'
      });
    }
  },

  applyDraft(draft: ReturnType<typeof loadDraft>) {
    if (!draft) {
      return;
    }
    const emotionIndex = Math.max(
      0,
      this.data.emotionTags.findIndex((tag) => tag.id === draft.emotion_tag_id)
    );
    const contextIndex = Math.max(
      0,
      this.data.contextTags.findIndex((tag) => tag.id === draft.context_tag_id)
    );
    const body = draft.body_text ?? '';
    this.setData({
      bodyText: body,
      charCount: countGraphemes(normalizeBody(body)),
      emotionIndex,
      contextIndex,
      retentionHours: draft.retention_hours ?? 168,
      publicAcknowledged: draft.public_acknowledged === true
    });
  },

  currentDraft() {
    return {
      body_text: this.data.bodyText,
      emotion_tag_id:
        this.data.emotionTags[this.data.emotionIndex]?.id ?? '',
      context_tag_id:
        this.data.contextTags[this.data.contextIndex]?.id ?? '',
      retention_hours: this.data.retentionHours,
      public_acknowledged: this.data.publicAcknowledged
    };
  },

  saveCurrentDraft() {
    saveDraft(this.currentDraft());
  },

  onBodyInput(event: WechatMiniprogram.Input) {
    const value = event.detail.value;
    this.setData({
      bodyText: value,
      charCount: countGraphemes(normalizeBody(value))
    });
    this.saveCurrentDraft();
  },

  onEmotionChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ emotionIndex: Number(event.detail.value) });
    this.saveCurrentDraft();
  },

  onContextChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ contextIndex: Number(event.detail.value) });
    this.saveCurrentDraft();
  },

  onRetentionChange(event: WechatMiniprogram.BaseEvent) {
    const hours = Number(event.currentTarget.dataset.hours) as 24 | 72 | 168;
    this.setData({ retentionHours: hours });
    this.saveCurrentDraft();
  },

  onPublicAcknowledgedChange(event: WechatMiniprogram.CheckboxGroupChange) {
    this.setData({
      publicAcknowledged: event.detail.value.includes('acknowledged')
    });
    this.saveCurrentDraft();
  },

  showMessage(message: string, messageType: 'error' | 'warning' | 'info') {
    this.setData({ message, messageType });
  },

  validateDraft(): boolean {
    const normalized = normalizeBody(this.data.bodyText);
    const length = countGraphemes(normalized);
    if (length < 1) {
      this.showMessage('正文不能为空', 'error');
      return false;
    }
    if (length > 500) {
      this.showMessage(`当前正文为 ${length} 个可见字符，请删减后再发布`, 'error');
      return false;
    }
    if (!this.data.publicAcknowledged) {
      this.showMessage('发布前请确认内容将公开进入广场', 'error');
      return false;
    }
    return true;
  },

  async onSubmit() {
    if (this.data.publishing || !this.validateDraft()) {
      return;
    }
    this.saveCurrentDraft();
    if (!this.data.session) {
      this.pendingPublishAfterLogin = true;
      this.setData({ showLoginModal: true });
      return;
    }
    await this.publish(false);
  },

  cancelLogin() {
    this.pendingPublishAfterLogin = false;
    this.setData({ showLoginModal: false });
    this.showMessage('已取消登录，草稿仍保存在本机', 'warning');
  },

  async confirmLogin() {
    try {
      const session = await loginWithWechat();
      saveSession(session);
      this.setData({
        session,
        sessionLabel: session.user.plaza_nickname,
        showLoginModal: false
      });
      this.applyDraft(loadDraft());
      if (!(await this.ensureNotice(session))) {
        return;
      }
      if (this.pendingPublishAfterLogin) {
        this.pendingPublishAfterLogin = false;
        await this.publish(false);
      }
    } catch (error) {
      this.showMessage(
        error instanceof ApiRequestError ? error.payload.message : '登录失败，请重试',
        'error'
      );
    }
  },

  async ensureNotice(session: Session): Promise<boolean> {
    if (session.noticeConfirmed) {
      return true;
    }
    const agreed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '使用须知',
        content:
          'JIJU 是公共情绪表达空间，不提供心理咨询、治疗、诊断或危机干预。发布内容会进入公共广场，可能被查看或截图。',
        confirmText: '同意并继续',
        cancelText: '暂不发布',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false)
      });
    });
    if (!agreed) {
      this.showMessage('尚未确认使用须知，草稿和操作意图已保留', 'warning');
      return false;
    }

    try {
      await confirmNotice(
        session,
        createIdempotencyKey('notice.confirm')
      );
      const nextSession = { ...session, noticeConfirmed: true };
      saveSession(nextSession);
      this.setData({ session: nextSession });
      return true;
    } catch (error) {
      this.showMessage(
        error instanceof ApiRequestError
          ? error.payload.message
          : '须知确认失败，请重试',
        'error'
      );
      return false;
    }
  },

  async publish(riskAcknowledged: boolean) {
    if (this.data.publishing) {
      return;
    }
    const session = this.data.session;
    if (!session || !this.validateDraft()) {
      return;
    }
    if (!(await this.ensureNotice(session))) {
      return;
    }

    const payload = {
      body_text: normalizeBody(this.data.bodyText),
      emotion_tag_id: this.data.emotionTags[this.data.emotionIndex]?.id,
      context_tag_id: this.data.contextTags[this.data.contextIndex]?.id,
      retention_hours: this.data.retentionHours,
      risk_acknowledged: riskAcknowledged,
      ...(riskAcknowledged && this.riskContext
        ? { risk_challenge_id: this.riskContext.challengeId }
        : {})
    };
    const key = idempotency.forPayload(payload);
    this.setData({ publishing: true, message: '' });

    try {
      const post = await publishPost(session, key, payload);
      clearDraft();
      idempotency.reset();
      wx.setStorageSync('jiju.last-published-post.v1', post);
      this.setData({ publishing: false });
      wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(post.id)}` });
    } catch (error) {
      this.setData({ publishing: false });
      await this.handlePublishError(error);
    }
  },

  async handlePublishError(error: unknown) {
    if (!(error instanceof ApiRequestError)) {
      this.showMessage('网络连接失败，请检查网络后重试', 'error');
      return;
    }

    if (error.statusCode === 401) {
      clearSession();
      this.setData({ session: null, sessionLabel: '游客', showLoginModal: true });
      this.pendingPublishAfterLogin = true;
      this.showMessage('登录状态已失效，草稿已保留', 'warning');
      return;
    }
    if (error.statusCode === 403 && error.payload.code === 'JIJU_ACCESS_4032') {
      const session = this.data.session;
      if (session) {
        const confirmed = await this.ensureNotice({
          ...session,
          noticeConfirmed: false
        });
        if (confirmed) {
          await this.publish(false);
        }
      }
      return;
    }
    if (
      error.statusCode === 409 &&
      error.payload.code === 'JIJU_MODERATION_4092' &&
      error.payload.details?.challenge_id
    ) {
      this.riskContext = {
        challengeId: error.payload.details.challenge_id,
        promptVersion: error.payload.details.prompt_version ?? '',
        resources: error.payload.details.resources ?? []
      };
      await this.showRiskConfirmation();
      return;
    }
    if (error.statusCode === 429) {
      const next = error.payload.details?.next_available_bj;
      this.showMessage(
        next
          ? `今日发帖次数已达上限，请于 ${formatBeijing(next)} 后重试`
          : error.payload.message,
        'error'
      );
      return;
    }

    const fieldMessages = Object.values(error.payload.details?.fields ?? {});
    this.showMessage(
      fieldMessages.length
        ? fieldMessages.join('；')
        : `${error.payload.message}${error.payload.request_id ? `（${error.payload.request_id}）` : ''}`,
      'error'
    );
  },

  async showRiskConfirmation() {
    const resources = this.riskContext?.resources
      ?.map((resource) => resource.name)
      .join('、');
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '发布前风险确认',
        content: `${resources ? `可查看：${resources}。` : ''}确认后将发布为“审核中”，平台不提供心理咨询、治疗或危机干预。`,
        confirmText: '确认发布',
        cancelText: '取消',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false)
      });
    });
    if (confirmed) {
      await this.publish(true);
    } else {
      this.showMessage('已取消风险确认，内容仍保留在草稿中', 'warning');
    }
  }
});
