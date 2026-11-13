import {
  ApiEnvelope,
  ApiErrorPayload,
  AppRuntime,
  PublishedPost,
  Session,
  TagCatalog
} from '../types';

export class ApiRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly payload: ApiErrorPayload
  ) {
    super(payload.message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  data?: WechatMiniprogram.IAnyObject;
  accessToken?: string;
  idempotencyKey?: string;
}

function apiBaseUrl(): string {
  return getApp<AppRuntime>().globalData.apiBaseUrl.replace(/\/$/, '');
}

function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiEnvelope<T>> {
  return new Promise((resolve, reject) => {
    const header: Record<string, string> = {
      'content-type': 'application/json'
    };
    if (options.accessToken) {
      header.authorization = `Bearer ${options.accessToken}`;
    }
    if (options.idempotencyKey) {
      header['idempotency-key'] = options.idempotencyKey;
    }

    wx.request({
      url: `${apiBaseUrl()}${path}`,
      method: options.method ?? 'GET',
      data: options.data,
      header,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as ApiEnvelope<T>);
          return;
        }
        reject(
          new ApiRequestError(
            response.statusCode,
            response.data as ApiErrorPayload
          )
        );
      },
      fail() {
        reject(
          new ApiRequestError(0, {
            code: 'NETWORK_ERROR',
            message: '网络连接失败，请检查网络后重试'
          })
        );
      }
    });
  });
}

export async function loginWithWechat(): Promise<Session> {
  const loginResult = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
    (resolve, reject) => {
      wx.login({ success: resolve, fail: reject });
    }
  );
  const response = await request<{
    access_token: string;
    token_type: 'Bearer';
    expires_at: string;
    user: { id: string; plaza_nickname: string };
    current_notice_version: string;
    notice_confirmed: boolean;
  }>('/auth/wechat/login', {
    method: 'POST',
    data: { code: loginResult.code || `mock-${Date.now()}` }
  });

  return {
    accessToken: response.data.access_token,
    expiresAt: response.data.expires_at,
    user: response.data.user,
    currentNoticeVersion: response.data.current_notice_version,
    noticeConfirmed: response.data.notice_confirmed
  };
}

export async function confirmNotice(
  session: Session,
  idempotencyKey: string
): Promise<void> {
  await request(
    `/notices/${encodeURIComponent(session.currentNoticeVersion)}/confirmations`,
    {
      method: 'POST',
      accessToken: session.accessToken,
      idempotencyKey
    }
  );
}

export async function fetchTags(): Promise<TagCatalog> {
  const response = await request<TagCatalog>('/tags');
  return response.data;
}

export async function publishPost(
  session: Session,
  idempotencyKey: string,
  payload: {
    body_text: string;
    emotion_tag_id?: string;
    context_tag_id?: string;
    retention_hours: 24 | 72 | 168;
    risk_acknowledged: boolean;
    risk_challenge_id?: string;
  }
): Promise<PublishedPost> {
  const response = await request<PublishedPost>('/posts', {
    method: 'POST',
    accessToken: session.accessToken,
    idempotencyKey,
    data: payload
  });
  return response.data;
}
