import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTEXT_TAGS, EMOTION_TAGS, RETENTION_OPTIONS, findTag } from '../public/shared/tags.js';
import { countGraphemes, normalizeText } from '../public/modules/graphemes.js';
import {
  createUuidV7,
  stableStringify
} from '../public/modules/idempotency.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const publicDirectory = path.resolve(currentDirectory, '../public');
const DAILY_POST_LIMIT = 5;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;
const RETENTION_HOURS = new Set(RETENTION_OPTIONS.map((option) => option.hours));
const EMOTION_TAG_IDS = new Set(EMOTION_TAGS.map((tag) => tag.id));
const CONTEXT_TAG_IDS = new Set(CONTEXT_TAGS.map((tag) => tag.id));

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function requestId() {
  return `req_${createUuidV7()}`;
}

function postId() {
  return `pst_${createUuidV7()}`;
}

function sessionToken() {
  return `ses_${createUuidV7()}`;
}

function errorBody(code, message, id, details = undefined) {
  return {
    code,
    message,
    request_id: id,
    ...(details ? { details } : {})
  };
}

function writeJson(response, status, payload, id, extraHeaders = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-request-id': id,
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('request body too large');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('invalid JSON');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function getBeijingDateKey(nowMs) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(nowMs));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function nextBeijingMidnight(nowMs) {
  const offsetMs = 8 * 60 * 60 * 1000;
  const localNow = new Date(nowMs + offsetMs);
  const nextLocalMidnight = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate() + 1
  );
  return new Date(nextLocalMidnight - offsetMs).toISOString();
}

function nicknameFor(loginCode) {
  const prefixes = ['晚风', '远山', '微光', '星野', '南岸', '晴川', '小岛', '清晨'];
  let hash = 0;
  for (const character of loginCode) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return `${prefixes[hash % prefixes.length]} ${1000 + (hash % 9000)}`;
}

function validatePublishInput(body, nowMs) {
  const bodyText = normalizeText(body.body_text);
  const bodyGraphemeLength = countGraphemes(bodyText);
  const errors = {};

  if (bodyGraphemeLength < 1) {
    errors.body_text = '正文不能为空';
  } else if (bodyGraphemeLength > 500) {
    errors.body_text = `正文最多 500 个可见字符，当前为 ${bodyGraphemeLength}`;
  }

  const retentionHours =
    body.retention_hours === undefined || body.retention_hours === null
      ? 168
      : Number(body.retention_hours);
  if (!RETENTION_HOURS.has(retentionHours)) {
    errors.retention_hours = '留存时长仅允许 24、72 或 168 小时';
  }

  const emotionTagId = body.emotion_tag_id || null;
  if (emotionTagId && !EMOTION_TAG_IDS.has(emotionTagId)) {
    errors.emotion_tag_id = '情绪标签无效或已停用';
  }

  const contextTagId = body.context_tag_id || null;
  if (contextTagId && !CONTEXT_TAG_IDS.has(contextTagId)) {
    errors.context_tag_id = '情境标签无效或已停用';
  }

  return {
    errors,
    normalized: {
      body_text: bodyText,
      body_grapheme_length: bodyGraphemeLength,
      emotion_tag_id: emotionTagId,
      context_tag_id: contextTagId,
      retention_hours: retentionHours,
      risk_acknowledged: body.risk_acknowledged === true
    }
  };
}

function resolveSession(request, state, nowMs) {
  const authorization = request.headers.authorization ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return { error: 'missing' };
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return { error: 'missing' };
  }
  const session = state.sessions.get(token);
  if (!session || session.expiresAt <= nowMs) {
    if (session) {
      state.sessions.delete(token);
    }
    return { error: 'expired' };
  }

  return { session };
}

async function serveStatic(request, response, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(publicDirectory, relativePath);
  if (
    resolvedPath !== publicDirectory &&
    !resolvedPath.startsWith(`${publicDirectory}${path.sep}`)
  ) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await readFile(resolvedPath);
    response.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(resolvedPath)] ?? 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    response.end(file);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

export function createDemoApp(options = {}) {
  const clock = options.clock ?? (() => Date.now());
  const state = {
    usersByLoginCode: new Map(),
    sessions: new Map(),
    posts: [],
    quotas: new Map(),
    idempotency: new Map()
  };

  const server = createServer(async (request, response) => {
    const id = requestId();
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      await serveStatic(request, response, url.pathname);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/auth/wechat/login') {
      try {
        const body = await readJson(request);
        const code = typeof body.code === 'string' ? body.code.trim() : '';
        if (!code) {
          writeJson(
            response,
            422,
            errorBody('JIJU_VALIDATION_4221', '登录凭证无效，请重试', id, {
              fields: { code: '模拟登录 code 不能为空' }
            }),
            id
          );
          return;
        }

        let user = state.usersByLoginCode.get(code);
        if (!user) {
          user = {
            id: `usr_${createUuidV7()}`,
            loginCode: code,
            plazaNickname: nicknameFor(code)
          };
          state.usersByLoginCode.set(code, user);
        }

        const nowMs = clock();
        const token = sessionToken();
        state.sessions.set(token, {
          userId: user.id,
          expiresAt: nowMs + SESSION_TTL_MS
        });

        writeJson(
          response,
          200,
          {
            data: {
              access_token: token,
              token_type: 'Bearer',
              expires_at: new Date(nowMs + SESSION_TTL_MS).toISOString(),
              user: {
                id: user.id,
                plaza_nickname: user.plazaNickname
              },
              current_notice_version: 'demo-notice-v1',
              notice_confirmed: true
            },
            request_id: id
          },
          id
        );
      } catch (error) {
        const tooLarge = error.code === 'BODY_TOO_LARGE';
        writeJson(
          response,
          tooLarge ? 413 : 422,
          errorBody(
            'JIJU_VALIDATION_4221',
            tooLarge ? '请求内容过大' : '请求格式不正确',
            id
          ),
          id
        );
      }
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/posts') {
      const nowMs = clock();
      const auth = resolveSession(request, state, nowMs);
      if (auth.error === 'missing') {
        writeJson(response, 401, errorBody('JIJU_AUTH_4011', '请先登录后继续', id), id);
        return;
      }
      if (auth.error === 'expired') {
        writeJson(
          response,
          401,
          errorBody('JIJU_AUTH_4012', '登录状态已失效，请重新登录', id),
          id
        );
        return;
      }

      const user = Array.from(state.usersByLoginCode.values()).find(
        (candidate) => candidate.id === auth.session.userId
      );
      if (!user) {
        writeJson(
          response,
          401,
          errorBody('JIJU_AUTH_4012', '登录状态已失效，请重新登录', id),
          id
        );
        return;
      }

      const idempotencyKey = request.headers['idempotency-key'];
      if (
        typeof idempotencyKey !== 'string' ||
        !/^v1:post\.publish:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          idempotencyKey
        )
      ) {
        writeJson(
          response,
          422,
          errorBody('JIJU_VALIDATION_4221', '缺少或无效的幂等键', id, {
            fields: { 'Idempotency-Key': '应为 v1:post.publish:<uuid_v7>' }
          }),
          id
        );
        return;
      }

      let body;
      try {
        body = await readJson(request);
      } catch (error) {
        const tooLarge = error.code === 'BODY_TOO_LARGE';
        writeJson(
          response,
          tooLarge ? 413 : 422,
          errorBody(
            'JIJU_VALIDATION_4221',
            tooLarge ? '请求内容过大' : '请求格式不正确',
            id
          ),
          id
        );
        return;
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        body = {};
      }

      const scope = `${user.id}:post.publish:${idempotencyKey}`;
      const fingerprint = stableStringify({
        body_text: normalizeText(body.body_text),
        emotion_tag_id: body.emotion_tag_id || null,
        context_tag_id: body.context_tag_id || null,
        retention_hours:
          body.retention_hours === undefined || body.retention_hours === null
            ? 168
            : Number(body.retention_hours),
        risk_acknowledged: body.risk_acknowledged === true
      });
      const existingIntent = state.idempotency.get(scope);
      if (existingIntent) {
        if (existingIntent.fingerprint !== fingerprint) {
          writeJson(
            response,
            409,
            errorBody(
              'JIJU_CONFLICT_4091',
              '同一幂等键不能提交不同内容，请刷新后重试',
              id
            ),
            id
          );
          return;
        }
        writeJson(
          response,
          existingIntent.status,
          existingIntent.payload,
          existingIntent.requestId,
          { 'idempotency-replayed': 'true' }
        );
        return;
      }

      const validation = validatePublishInput(body, nowMs);
      if (Object.keys(validation.errors).length > 0) {
        writeJson(
          response,
          422,
          errorBody('JIJU_VALIDATION_4221', '内容不符合要求，请修改后重试', id, {
            fields: validation.errors
          }),
          id
        );
        return;
      }

      const normalized = validation.normalized;
      if (normalized.body_text.includes('[[BLOCK]]')) {
        writeJson(
          response,
          422,
          errorBody('JIJU_VALIDATION_4221', '内容包含明确违规示例，请修改后重试', id, {
            fields: { body_text: '命中明确违规演示规则' }
          }),
          id
        );
        return;
      }

      const needsReview = normalized.body_text.includes('[[REVIEW]]');
      if (needsReview && !normalized.risk_acknowledged) {
        writeJson(
          response,
          409,
          errorBody('JIJU_MODERATION_4091', '发布前需要确认风险提示', id, {
            risk_confirmation_required: true
          }),
          id
        );
        return;
      }

      const dateKey = getBeijingDateKey(nowMs);
      const quotaKey = `${user.id}:${dateKey}`;
      const usedCount = state.quotas.get(quotaKey) ?? 0;
      if (usedCount >= DAILY_POST_LIMIT) {
        const nextAvailableAt = nextBeijingMidnight(nowMs);
        writeJson(
          response,
          429,
          errorBody(
            'JIJU_QUOTA_4291',
            '今日发帖次数已达上限，请稍后重试',
            id,
            {
              next_available_bj: nextAvailableAt,
              remaining: 0
            }
          ),
          id
        );
        return;
      }

      const emotionTag = normalized.emotion_tag_id ? findTag(normalized.emotion_tag_id) : null;
      const contextTag = normalized.context_tag_id ? findTag(normalized.context_tag_id) : null;
      const publishedAt = new Date(nowMs).toISOString();
      const expiresAt = new Date(nowMs + normalized.retention_hours * 60 * 60 * 1000).toISOString();
      const post = {
        id: postId(),
        author_id: user.id,
        author_nickname: user.plazaNickname,
        body_text: normalized.body_text,
        body_grapheme_length: normalized.body_grapheme_length,
        emotion_tag: emotionTag ? { id: emotionTag.id, name: emotionTag.name } : null,
        context_tag: contextTag ? { id: contextTag.id, name: contextTag.name } : null,
        retention_hours: normalized.retention_hours,
        public_status: 'PUBLISHED',
        moderation_status: needsReview ? 'PENDING' : 'PASSED',
        risk_confirmed_at: needsReview ? new Date(nowMs).toISOString() : null,
        published_at: publishedAt,
        expires_at: expiresAt,
        content_version: 1
      };

      state.posts.push(post);
      state.quotas.set(quotaKey, usedCount + 1);

      const payload = {
        data: post,
        request_id: id
      };
      state.idempotency.set(scope, {
        fingerprint,
        status: 201,
        payload,
        requestId: id
      });

      writeJson(response, 201, payload, id);
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      writeJson(
        response,
        404,
        errorBody('JIJU_CONTENT_4041', '内容已不可用', id),
        id
      );
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });

  return {
    server,
    state,
    async listen(port = 0) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });
      const address = server.address();
      return `http://127.0.0.1:${address.port}`;
    },
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}
