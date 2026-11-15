import {
  ApiEnvelope,
  ApiErrorPayload,
  AppRuntime,
  CommentPage,
  CommentItem,
  DeleteAccountResult,
  FeedPage,
  MyPostPage,
  MyPostStatusFilter,
  PostDetail,
  ReactionState,
  ReactionType,
  ReportReason,
  ReportReceipt,
  ReportTargetType,
  PublishedPost,
  Session,
  TagCatalog,
  UpdatedProfile,
  UserProfile
} from '../types';
import { createViewToken } from '../utils/view-token';

export class ApiRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly payload: ApiErrorPayload
  ) {
    super(payload.message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: WechatMiniprogram.IAnyObject;
  accessToken?: string;
  idempotencyKey?: string;
  viewToken?: string;
}

function apiBaseUrl(): string {
  return getApp<AppRuntime>().globalData.apiBaseUrl.replace(/\/$/, '');
}

export function buildQuery(
  params: Record<string, string | number | undefined>
): string {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`
    )
    .join('&');
}

function safeErrorPayload(
  statusCode: number,
  data: unknown,
  fallbackRequestId = ''
): ApiErrorPayload {
  const payload =
    data && typeof data === 'object'
      ? (data as Partial<ApiErrorPayload>)
      : {};
  if (payload.code && payload.message) {
    return {
      ...payload,
      code: payload.code,
      message: payload.message,
      request_id: payload.request_id || fallbackRequestId || undefined
    } as ApiErrorPayload;
  }
  if (statusCode === 401) {
    return {
      code: 'JIJU_AUTH_4012',
      message: '登录状态已失效，请重新登录',
      request_id: fallbackRequestId || undefined
    };
  }
  if (statusCode === 403) {
    return {
      code: 'JIJU_ACCESS_4031',
      message: '你无权执行此操作',
      request_id: fallbackRequestId || undefined
    };
  }
  if (statusCode === 404) {
    return {
      code: 'JIJU_CONTENT_4041',
      message: '内容已不可用',
      request_id: fallbackRequestId || undefined
    };
  }
  return {
    code: statusCode >= 500 ? 'JIJU_SYSTEM_5031' : 'JIJU_VALIDATION_4221',
    message:
      statusCode >= 500
        ? '服务暂时不可用，请稍后重试'
        : '内容不符合要求，请修改后重试',
    request_id: fallbackRequestId || undefined
  };
}

export function request<T>(
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
    if (options.viewToken) {
      header['x-view-token'] = options.viewToken;
    }

    wx.request({
      url: `${apiBaseUrl()}${path}`,
      method: (options.method ?? 'GET') as WechatMiniprogram.RequestOption['method'],
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
            safeErrorPayload(
              response.statusCode,
              response.data,
              response.header?.['x-request-id']
            )
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

export async function loginWithWechat(
  restoreDeletedAccount = false
): Promise<Session> {
  const loginResult = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
    (resolve, reject) => {
      wx.login({ success: resolve, fail: reject });
    }
  );
  if (!loginResult.code) {
    throw new ApiRequestError(0, {
      code: 'NETWORK_ERROR',
      message: '无法获取微信登录凭证，请检查网络后重试'
    });
  }
  const response = await request<{
    access_token: string;
    token_type: 'Bearer';
    expires_at: string;
    user: { id: string; plaza_nickname: string };
    current_notice_version: string;
    notice_confirmed: boolean;
  }>('/auth/wechat/login', {
    method: 'POST',
    data: {
      code: loginResult.code,
      ...(restoreDeletedAccount
        ? { restore_deleted_account: true }
        : {})
    }
  });

  return {
    accessToken: response.data.access_token,
    expiresAt: response.data.expires_at,
    user: response.data.user,
    currentNoticeVersion: response.data.current_notice_version,
    noticeConfirmed: response.data.notice_confirmed
  };
}

export async function fetchFeed(
  cursor?: string,
  limit = 20
): Promise<FeedPage> {
  const query = buildQuery({ limit, cursor });
  return request<FeedPage['data']>(`/feed?${query}`).then(
    (response) =>
      ({
        data: response.data,
        page: (response as unknown as FeedPage).page,
        request_id: response.request_id
      }) satisfies FeedPage
  );
}

export async function fetchPostDetail(
  postId: string,
  viewToken?: string,
  accessToken?: string
): Promise<PostDetail> {
  const response = await request<PostDetail>(
    `/posts/${encodeURIComponent(postId)}`,
    {
      accessToken,
      viewToken: viewToken || createViewToken()
    }
  );
  return response.data;
}

export async function fetchMyPosts(
  session: Session,
  status: MyPostStatusFilter | undefined,
  cursor?: string,
  limit = 20
): Promise<MyPostPage> {
  const query = buildQuery({ limit, status, cursor });
  return request<MyPostPage['data']>(`/me/posts?${query}`, {
    accessToken: session.accessToken
  }).then(
    (response) =>
      ({
        data: response.data,
        page: (response as unknown as MyPostPage).page,
        request_id: response.request_id
      }) satisfies MyPostPage
  );
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

export async function logoutSession(session: Session): Promise<void> {
  await request('/auth/logout', {
    method: 'POST',
    accessToken: session.accessToken
  });
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

export async function editPost(
  session: Session,
  postId: string,
  idempotencyKey: string,
  payload: {
    expected_content_version: number;
    body_text?: string;
    emotion_tag_id?: string | null;
    context_tag_id?: string | null;
    risk_acknowledged: boolean;
  }
): Promise<PublishedPost> {
  const response = await request<PublishedPost>(
    `/posts/${encodeURIComponent(postId)}`,
    {
      method: 'PUT',
      accessToken: session.accessToken,
      idempotencyKey,
      data: payload
    }
  );
  return response.data;
}

export async function deletePost(
  session: Session,
  postId: string,
  idempotencyKey: string
): Promise<void> {
  await request(`/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    accessToken: session.accessToken,
    idempotencyKey
  });
}

export async function setReaction(
  session: Session,
  postId: string,
  type: ReactionType,
  idempotencyKey: string
): Promise<ReactionState> {
  const response = await request<ReactionState>(
    `/posts/${encodeURIComponent(postId)}/reaction`,
    {
      method: 'PUT',
      accessToken: session.accessToken,
      idempotencyKey,
      data: { type }
    }
  );
  return response.data;
}

export async function cancelReaction(
  session: Session,
  postId: string,
  idempotencyKey: string
): Promise<ReactionState> {
  const response = await request<ReactionState>(
    `/posts/${encodeURIComponent(postId)}/reaction`,
    {
      method: 'DELETE',
      accessToken: session.accessToken,
      idempotencyKey
    }
  );
  return response.data;
}

export async function createReport(
  session: Session,
  payload: {
    target_type: ReportTargetType;
    target_id: string;
    reason: ReportReason;
    other_description?: string;
  },
  idempotencyKey: string
): Promise<ReportReceipt> {
  const response = await request<ReportReceipt>('/reports', {
    method: 'POST',
    accessToken: session.accessToken,
    idempotencyKey,
    data: payload
  });
  return response.data;
}

export async function fetchComments(
  postId: string,
  accessToken?: string,
  cursor?: string,
  limit = 20
): Promise<CommentPage> {
  const query = buildQuery({ limit, cursor });
  return request<CommentPage['data']>(
    `/posts/${encodeURIComponent(postId)}/comments?${query}`,
    { accessToken }
  ).then(
    (response) =>
      ({
        data: response.data,
        page: (response as unknown as CommentPage).page,
        request_id: response.request_id
      }) satisfies CommentPage
  );
}

export async function createComment(
  session: Session,
  postId: string,
  bodyText: string,
  idempotencyKey: string
): Promise<CommentItem> {
  const response = await request<CommentItem>(
    `/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: 'POST',
      accessToken: session.accessToken,
      idempotencyKey,
      data: { body_text: bodyText }
    }
  );
  return response.data;
}

export async function deleteComment(
  session: Session,
  commentId: string,
  idempotencyKey: string
): Promise<void> {
  await request(`/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    accessToken: session.accessToken,
    idempotencyKey
  });
}

export async function deleteAccount(
  session: Session,
  idempotencyKey: string
): Promise<DeleteAccountResult> {
  const response = await request<DeleteAccountResult>('/me/account', {
    method: 'DELETE',
    accessToken: session.accessToken,
    idempotencyKey,
    data: { confirmation_text: '注销账号' }
  });
  return response.data;
}

export async function fetchProfile(session: Session): Promise<UserProfile> {
  const response = await request<UserProfile>('/me/profile', {
    accessToken: session.accessToken
  });
  return response.data;
}

export async function updateProfile(
  session: Session,
  payload: {
    plaza_nickname: string;
    bio: string;
    avatar_color: UserProfile['avatar_color'];
  },
  idempotencyKey: string
): Promise<UpdatedProfile> {
  const response = await request<UpdatedProfile>('/me/profile', {
    method: 'PUT',
    accessToken: session.accessToken,
    idempotencyKey,
    data: payload
  });
  return response.data;
}
