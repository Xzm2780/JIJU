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
  public_status: 'PUBLISHED' | 'HIDDEN' | 'EXPIRED' | 'DELETED';
  moderation_status: 'PASSED' | 'PENDING' | 'REJECTED';
  published_at: string;
  expires_at: string;
  edited_at?: string;
}

export interface TagRef {
  id: string;
  name: string;
}

export interface ReactionCounts {
  hug: number;
  head_pat: number;
  cheer: number;
  total: number;
}

export type ReactionType = 'HUG' | 'HEAD_PAT' | 'CHEER';

export interface ReactionState {
  my_reaction: ReactionType | null;
  counts: ReactionCounts;
}

export interface FeedItem {
  id: string;
  author_nickname: string;
  emotion_tag: TagRef | null;
  context_tag: TagRef | null;
  body_excerpt: string;
  published_at: string;
  comment_count: number;
  reaction_counts: ReactionCounts;
}

export interface FeedPage {
  data: FeedItem[];
  page: {
    next_cursor: string | null;
    has_more: boolean;
  };
  request_id: string;
}

export interface PostDetail {
  id: string;
  content_version: number;
  author_nickname: string;
  emotion_tag: TagRef | null;
  context_tag: TagRef | null;
  body_text: string;
  published_at: string;
  expires_at: string;
  comment_count: number;
  reaction_counts: ReactionCounts;
  is_author: boolean;
  view_count?: number;
}

export type MyPostStatusFilter = 'ACTIVE' | 'EXPIRED' | 'HIDDEN';

export interface MyPostItem {
  id: string;
  content_version: number;
  body_excerpt: string;
  emotion_tag: TagRef | null;
  context_tag: TagRef | null;
  public_status: 'PUBLISHED' | 'HIDDEN' | 'EXPIRED' | 'DELETED';
  moderation_status: 'PASSED' | 'PENDING' | 'REJECTED';
  published_at: string;
  expires_at: string;
  comment_count: number;
  reaction_counts: ReactionCounts;
}

export interface MyPostPage {
  data: MyPostItem[];
  page: {
    next_cursor: string | null;
    has_more: boolean;
  };
  request_id: string;
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
