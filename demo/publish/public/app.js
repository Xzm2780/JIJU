import { EMOTION_TAGS, CONTEXT_TAGS, RETENTION_OPTIONS, findTag } from '/shared/tags.js';
import { countGraphemes, normalizeText } from '/modules/graphemes.js';
import { clearDraft, loadDraft, saveDraft } from '/modules/draft.js';
import { createIntentKeyManager } from '/modules/idempotency.js';

const SESSION_STORAGE_KEY = 'jiju.publish.session.v1';
const DETAIL_STORAGE_KEY = 'jiju.publish.last-post.v1';
const MAX_BODY_GRAPHEMES = 500;

const elements = {
  publishView: document.querySelector('#publish-view'),
  detailView: document.querySelector('#detail-view'),
  form: document.querySelector('#publish-form'),
  body: document.querySelector('#body-text'),
  bodyError: document.querySelector('#body-error'),
  charCounter: document.querySelector('#char-counter'),
  emotionTag: document.querySelector('#emotion-tag'),
  contextTag: document.querySelector('#context-tag'),
  retentionOptions: document.querySelector('#retention-options'),
  publicAcknowledged: document.querySelector('#public-acknowledged'),
  publishButton: document.querySelector('#publish-button'),
  draftStatus: document.querySelector('#draft-status'),
  restoredBanner: document.querySelector('#restored-banner'),
  message: document.querySelector('#form-message'),
  loginDialog: document.querySelector('#login-dialog'),
  loginForm: document.querySelector('#login-form'),
  loginCode: document.querySelector('#login-code'),
  loginError: document.querySelector('#login-error'),
  loginCancel: document.querySelector('#login-cancel'),
  loginOpen: document.querySelector('#login-open'),
  loginSubmit: document.querySelector('#login-submit'),
  sessionLabel: document.querySelector('#session-label'),
  riskDialog: document.querySelector('#risk-dialog'),
  riskCancel: document.querySelector('#risk-cancel'),
  riskConfirm: document.querySelector('#risk-confirm'),
  backToPublish: document.querySelector('#back-to-publish'),
  detailAuthor: document.querySelector('#detail-author'),
  detailStatus: document.querySelector('#detail-status'),
  detailBody: document.querySelector('#detail-body'),
  detailTags: document.querySelector('#detail-tags'),
  detailPublished: document.querySelector('#detail-published'),
  detailExpires: document.querySelector('#detail-expires'),
  detailRetention: document.querySelector('#detail-retention'),
  detailVersion: document.querySelector('#detail-version')
};

let session = loadSession();
let pendingPublishAfterLogin = false;
let publishInFlight = false;
let idempotency = createIntentKeyManager('post.publish');

function loadSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const saved = JSON.parse(raw);
    if (!saved?.accessToken) {
      return null;
    }
    return saved;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function saveSession(nextSession) {
  session = nextSession;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  renderSession();
}

function clearSession() {
  session = null;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  renderSession();
}

function renderSession() {
  elements.loginOpen.hidden = Boolean(session);
  elements.sessionLabel.textContent = session
    ? session.user.plazaNickname
    : '游客';
}

function createOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function populateSelects() {
  for (const tag of EMOTION_TAGS) {
    elements.emotionTag.append(createOption(tag.id, tag.name));
  }
  for (const tag of CONTEXT_TAGS) {
    elements.contextTag.append(createOption(tag.id, tag.name));
  }

  for (const option of RETENTION_OPTIONS) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'retention_hours';
    input.value = String(option.hours);
    input.checked = option.hours === 168;
    const text = document.createElement('span');
    text.textContent = option.label;
    label.append(input, text);
    elements.retentionOptions.append(label);
  }
}

function selectedRetention() {
  return Number(
    document.querySelector('input[name="retention_hours"]:checked')?.value ?? 168
  );
}

function readDraftFromForm() {
  return {
    body_text: elements.body.value,
    emotion_tag_id: elements.emotionTag.value || null,
    context_tag_id: elements.contextTag.value || null,
    retention_hours: selectedRetention(),
    public_acknowledged: elements.publicAcknowledged.checked
  };
}

function applyDraft(draft) {
  if (!draft) {
    return false;
  }

  elements.body.value = draft.body_text ?? '';
  elements.emotionTag.value = draft.emotion_tag_id ?? '';
  elements.contextTag.value = draft.context_tag_id ?? '';
  elements.publicAcknowledged.checked = draft.public_acknowledged === true;

  const retentionHours = [24, 72, 168].includes(Number(draft.retention_hours))
    ? Number(draft.retention_hours)
    : 168;
  const retentionInput = document.querySelector(
    `input[name="retention_hours"][value="${retentionHours}"]`
  );
  if (retentionInput) {
    retentionInput.checked = true;
  }

  updateCharacterCount();
  return true;
}

function saveCurrentDraft() {
  saveDraft(localStorage, readDraftFromForm());
  elements.draftStatus.textContent = `草稿已保存 · ${formatBeijing(new Date())}`;
}

function updateCharacterCount() {
  const visibleText = normalizeText(elements.body.value);
  const count = countGraphemes(visibleText);
  elements.charCounter.textContent = `${count} / ${MAX_BODY_GRAPHEMES}`;
  elements.charCounter.classList.toggle('over-limit', count > MAX_BODY_GRAPHEMES);
  elements.bodyError.textContent =
    count > MAX_BODY_GRAPHEMES ? '正文最多 500 个用户可见字符' : '';
  return count;
}

function showMessage(message, kind = 'info') {
  elements.message.hidden = false;
  elements.message.className = `message ${kind}`;
  elements.message.textContent = message;
}

function hideMessage() {
  elements.message.hidden = true;
  elements.message.textContent = '';
}

function formatBeijing(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function publicPayload(riskAcknowledged) {
  return {
    body_text: normalizeText(elements.body.value),
    emotion_tag_id: elements.emotionTag.value || null,
    context_tag_id: elements.contextTag.value || null,
    retention_hours: selectedRetention(),
    risk_acknowledged: riskAcknowledged
  };
}

function validateBeforeAuth() {
  const bodyText = normalizeText(elements.body.value);
  const count = countGraphemes(bodyText);
  if (count === 0) {
    elements.bodyError.textContent = '正文不能为空';
    showMessage('请先写一点内容。', 'error');
    elements.body.focus();
    return false;
  }
  if (count > MAX_BODY_GRAPHEMES) {
    elements.bodyError.textContent = '正文最多 500 个用户可见字符';
    showMessage(`当前正文为 ${count} 个可见字符，请删减后再发布。`, 'error');
    elements.body.focus();
    return false;
  }
  if (!elements.publicAcknowledged.checked) {
    showMessage('发布前请确认内容将公开进入广场。', 'error');
    elements.publicAcknowledged.focus();
    return false;
  }
  elements.bodyError.textContent = '';
  return true;
}

function openLoginDialog(resumeAfterLogin) {
  pendingPublishAfterLogin = resumeAfterLogin;
  elements.loginError.textContent = '';
  elements.loginCode.value = elements.loginCode.value || 'demo-code-001';
  elements.loginDialog.showModal();
  window.setTimeout(() => elements.loginCode.focus(), 0);
}

function openRiskDialog() {
  elements.riskDialog.showModal();
}

function setPublishing(isPublishing) {
  publishInFlight = isPublishing;
  elements.publishButton.disabled = isPublishing;
  elements.publishButton.textContent = isPublishing ? '正在发布…' : '发布到广场';
}

async function submitCurrentDraft(riskAcknowledged = false) {
  if (publishInFlight || !validateBeforeAuth()) {
    return;
  }

  saveCurrentDraft();
  if (!session?.accessToken) {
    showMessage('内容已保存在本机。完成登录后会恢复正文、标签和留存时长。');
    openLoginDialog(true);
    return;
  }

  const payload = publicPayload(riskAcknowledged);
  const { key } = idempotency.forPayload(payload);
  setPublishing(true);
  hideMessage();

  try {
    const response = await fetch('/api/v1/posts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.accessToken}`,
        'idempotency-key': key
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        showMessage(
          body.code === 'JIJU_AUTH_4012'
            ? '登录状态已失效，请重新登录。草稿已保留。'
            : '请先登录后继续。草稿已保留。',
          'warning'
        );
        openLoginDialog(true);
        return;
      }

      if (
        response.status === 409 &&
        body.details?.risk_confirmation_required === true
      ) {
        showMessage('正文命中模拟复核规则，需要完成风险确认。', 'warning');
        openRiskDialog();
        return;
      }

      if (response.status === 429) {
        const next = body.details?.next_available_bj;
        showMessage(
          next
            ? `今日发帖次数已达上限，请于 ${formatBeijing(next)}（北京时间）后重试。`
            : body.message,
          'error'
        );
        return;
      }

      const fieldMessages = body.details?.fields
        ? Object.values(body.details.fields)
        : [];
      showMessage(
        fieldMessages.length > 0
          ? fieldMessages.join('；')
          : `${body.message ?? '发布失败，请稍后重试'}（${body.request_id ?? body.code}）`,
        'error'
      );
      return;
    }

    clearDraft(localStorage);
    idempotency.reset();
    sessionStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(body.data));
    window.location.hash = `/posts/${encodeURIComponent(body.data.id)}`;
    renderRoute();
  } catch {
    showMessage('网络连接失败，请检查网络后重试。草稿和幂等键均已保留。', 'error');
  } finally {
    setPublishing(false);
  }
}

function renderDetail(post) {
  elements.publishView.hidden = true;
  elements.detailView.hidden = false;
  elements.detailAuthor.textContent = post.author_nickname;
  elements.detailStatus.textContent =
    post.moderation_status === 'PENDING' ? '审核中' : '已发布';
  elements.detailStatus.classList.toggle(
    'pending',
    post.moderation_status === 'PENDING'
  );
  elements.detailBody.textContent = post.body_text;
  elements.detailPublished.textContent = `${formatBeijing(post.published_at)}（北京时间）`;
  elements.detailExpires.textContent = `${formatBeijing(post.expires_at)}（北京时间）`;
  elements.detailRetention.textContent =
    RETENTION_OPTIONS.find((option) => option.hours === post.retention_hours)?.label ??
    `${post.retention_hours} 小时`;
  elements.detailVersion.textContent = `v${post.content_version}`;

  elements.detailTags.replaceChildren();
  for (const tag of [post.emotion_tag, post.context_tag].filter(Boolean)) {
    const span = document.createElement('span');
    span.textContent = tag.name || findTag(tag.id)?.name || '标签';
    elements.detailTags.append(span);
  }
}

function showPublishView() {
  elements.detailView.hidden = true;
  elements.publishView.hidden = false;
}

function renderRoute() {
  const match = window.location.hash.match(/^#\/posts\/(.+)$/);
  if (!match) {
    showPublishView();
    return;
  }

  const expectedId = decodeURIComponent(match[1]);
  try {
    const post = JSON.parse(sessionStorage.getItem(DETAIL_STORAGE_KEY) || 'null');
    if (post?.id === expectedId) {
      renderDetail(post);
      return;
    }
  } catch {
    sessionStorage.removeItem(DETAIL_STORAGE_KEY);
  }

  showPublishView();
  showMessage('详情数据已不在当前会话中，请重新发布或返回发布页。', 'warning');
  history.replaceState(null, '', window.location.pathname);
}

async function handleLogin() {
  const code = elements.loginCode.value.trim();
  if (!code) {
    elements.loginError.textContent = '请输入非空模拟 code';
    return;
  }

  elements.loginSubmit.disabled = true;
  elements.loginError.textContent = '';
  try {
    const response = await fetch('/api/v1/auth/wechat/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const body = await response.json();
    if (!response.ok) {
      elements.loginError.textContent = body.message ?? '模拟登录失败';
      return;
    }

    saveSession({
      accessToken: body.data.access_token,
      expiresAt: body.data.expires_at,
      user: body.data.user
    });
    elements.loginDialog.close();
    applyDraft(loadDraft(localStorage));
    const shouldResume = pendingPublishAfterLogin;
    pendingPublishAfterLogin = false;
    showMessage('登录成功，正文、标签和留存时长已恢复。');
    if (shouldResume) {
      await submitCurrentDraft(false);
    }
  } catch {
    elements.loginError.textContent = '网络连接失败，请重试';
  } finally {
    elements.loginSubmit.disabled = false;
  }
}

function cancelLogin() {
  pendingPublishAfterLogin = false;
  elements.loginDialog.close();
  showMessage('已取消登录，草稿仍保存在本机。', 'warning');
}

function bindEvents() {
  elements.body.addEventListener('input', () => {
    updateCharacterCount();
    saveCurrentDraft();
  });
  elements.emotionTag.addEventListener('change', saveCurrentDraft);
  elements.contextTag.addEventListener('change', saveCurrentDraft);
  elements.publicAcknowledged.addEventListener('change', saveCurrentDraft);
  elements.retentionOptions.addEventListener('change', saveCurrentDraft);
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitCurrentDraft(false);
  });
  elements.loginOpen.addEventListener('click', () => openLoginDialog(false));
  elements.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleLogin();
  });
  elements.loginCancel.addEventListener('click', cancelLogin);
  elements.loginDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancelLogin();
  });
  elements.riskCancel.addEventListener('click', () => {
    elements.riskDialog.close();
    showMessage('已取消复核确认，草稿和原内容均保留。', 'warning');
  });
  elements.riskConfirm.addEventListener('click', () => {
    elements.riskDialog.close();
    void submitCurrentDraft(true);
  });
  elements.backToPublish.addEventListener('click', () => {
    history.replaceState(null, '', window.location.pathname);
    showPublishView();
  });
  window.addEventListener('hashchange', renderRoute);
}

function initialize() {
  populateSelects();
  renderSession();
  bindEvents();

  const hadDraft = applyDraft(loadDraft(localStorage));
  elements.restoredBanner.hidden = !hadDraft;
  updateCharacterCount();
  renderRoute();
}

initialize();
