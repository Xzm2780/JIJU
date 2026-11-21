import {
  ApiRequestError,
  createReport
} from '../../services/api';
import {
  isAuthenticationError,
  openLoginPage
} from '../../services/auth-flow';
import {
  clearSession,
  loadSession
} from '../../services/session';
import {
  ReportReason,
  ReportReceipt,
  ReportTargetType
} from '../../types';
import { createIdempotencyKey } from '../../utils/idempotency';

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'ABUSE', label: '辱骂、攻击或骚扰' },
  { value: 'PRIVACY', label: '泄露隐私信息' },
  { value: 'DANGEROUS_OR_INAPPROPRIATE', label: '危险或不适当内容' },
  { value: 'SPAM', label: '广告或垃圾信息' },
  { value: 'OTHER', label: '其他' }
];

Page({
  data: {
    targetType: 'POST' as ReportTargetType,
    targetId: '',
    reasons: REASONS.map((item) => item.label),
    reasonIndex: 0,
    otherDescription: '',
    submitting: false,
    message: '',
    receipt: null as ReportReceipt | null
  },

  onLoad(query: Record<string, string | undefined>) {
    const targetType =
      query.target_type === 'COMMENT' ? 'COMMENT' : 'POST';
    this.setData({
      targetType,
      targetId: query.target_id ?? ''
    });
  },

  onReasonChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ reasonIndex: Number(event.detail.value) });
  },

  onOtherInput(event: WechatMiniprogram.Input) {
    this.setData({ otherDescription: event.detail.value });
  },

  async submit() {
    const session = loadSession();
    if (!session) {
      openLoginPage();
      return;
    }
    if (!this.data.targetId || this.data.submitting) {
      this.setData({ message: '举报目标无效' });
      return;
    }
    const reason = REASONS[this.data.reasonIndex]!.value;
    const other = this.data.otherDescription.trim();
    if (reason === 'OTHER' && !other) {
      this.setData({ message: '选择“其他”时请填写说明' });
      return;
    }
    this.setData({ submitting: true, message: '' });
    try {
      const receipt = await createReport(
        session,
        {
          target_type: this.data.targetType,
          target_id: this.data.targetId,
          reason,
          ...(reason === 'OTHER'
            ? { other_description: other }
            : {})
        },
        createIdempotencyKey('report.submit')
      );
      this.setData({ submitting: false, receipt });
    } catch (error) {
      this.setData({ submitting: false });
      if (isAuthenticationError(error)) {
        clearSession();
        this.setData({ message: '登录已失效，请重新登录后提交举报' });
        openLoginPage();
        return;
      }
      if (
        error instanceof ApiRequestError &&
        error.payload.code === 'JIJU_ACCESS_4032'
      ) {
        wx.showModal({
          title: '需要确认使用须知',
          content: '完成当前版本须知确认后即可提交举报。',
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
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '举报提交失败，请稍后重试'
      });
    }
  },

  back() {
    wx.navigateBack();
  }
});
