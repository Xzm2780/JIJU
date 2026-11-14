import {
  ApiRequestError,
  confirmNotice
} from '../../services/api';
import {
  loadSession,
  saveSession
} from '../../services/session';
import { createIdempotencyKey } from '../../utils/idempotency';

Page({
  data: {
    version: '',
    confirmed: false,
    busy: false,
    message: ''
  },

  onLoad() {
    const session = loadSession();
    this.setData({
      version: session?.currentNoticeVersion ?? '',
      confirmed: session?.noticeConfirmed ?? false
    });
  },

  async confirm() {
    const session = loadSession();
    if (!session || this.data.busy) {
      this.setData({ message: '请先完成登录' });
      return;
    }
    this.setData({ busy: true, message: '' });
    try {
      await confirmNotice(
        session,
        createIdempotencyKey('notice.confirm')
      );
      saveSession({ ...session, noticeConfirmed: true });
      this.setData({
        confirmed: true,
        busy: false,
        message: '已确认当前版本使用须知'
      });
    } catch (error) {
      this.setData({
        busy: false,
        message:
          error instanceof ApiRequestError
            ? error.payload.message
            : '确认失败，请检查网络后重试'
      });
    }
  },

  back() {
    wx.navigateBack();
  }
});
