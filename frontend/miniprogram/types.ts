export type TagCategory = 'EMOTION' | 'CONTEXT';

export interface AppRuntime {
  globalData: {
    apiBaseUrl: string;
  };
}

export interface TagItem {
  id: string;
  name: string;
  category: TagCategory;
  sort_order: number;
}

export interface TagCatalog {
  version: string;
  items: TagItem[];
}

export interface Session {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    plaza_nickname: string;
  };
  currentNoticeVersion: string;
  noticeConfirmed: boolean;
}

export interface PublishDraft {
  body_text: string;
  emotion_tag_id: string;
  context_tag_id: string;
  retention_hours: 24 | 72 | 168;
  public_acknowledged: boolean;
}

export interface PublishedPost {
  id: string;
  content_version: number;
  public_status: 'PUBLISHED';
  moderation_status: 'PASSED' | 'PENDING';
  published_at: string;
  expires_at: string;
}

export interface ApiEnvelope<T> {
  data: T;
  request_id: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  request_id?: string;
  details?: {
    challenge_id?: string;
    prompt_version?: string;
    resource_version?: string;
    resources?: Array<{ name: string; scope: string; url: string }>;
    next_available_bj?: string;
    risk_confirmation_required?: boolean;
    fields?: Record<string, string>;
  };
}
