(() => {
  'use strict';

  const STORAGE_KEY = 'jiju.preview.v3';
  const DAILY_LIMIT = 5;
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
    : null;

  const SEED_POSTS = [
    {
      id: 'pst_demo_1',
      author: '晚风 4821',
      mine: false,
      body: '今天终于把拖了很久的事情做完了。没有想象中那么轻松，但至少往前了一点。',
      emotion: '平静',
      context: '日常',
      publishedAt: Date.now() - 22 * 60 * 1000,
      retentionHours: 168,
      reactions: { HUG: 12, HEAD_PAT: 8, CHEER: 19 },
      myReaction: null,
      comments: [
        { id: 'cmt_demo_1', author: '微光 1208', body: '已经很棒了，慢慢来。', at: Date.now() - 10 * 60 * 1000 }
      ]
    },
    {
      id: 'pst_demo_2',
      author: '远山 7310',
      mine: false,
      body: '下班路上看到很漂亮的晚霞，想在这里停一会儿。',
      emotion: '温暖',
      context: '路上',
      publishedAt: Date.now() - 74 * 60 * 1000,
      retentionHours: 72,
      reactions: { HUG: 6, HEAD_PAT: 5, CHEER: 9 },
      myReaction: null,
      comments: []
    },
    {
      id: 'pst_demo_3',
      author: '微光 1208',
      mine: false,
      body: '最近总觉得时间不够用，脑子一直在转。希望今晚能早点睡。',
      emotion: '疲惫',
      context: '夜晚',
      publishedAt: Date.now() - 3 * 60 * 60 * 1000,
      retentionHours: 24,
      reactions: { HUG: 24, HEAD_PAT: 11, CHEER: 17 },
      myReaction: null,
      comments: [
        { id: 'cmt_demo_2', author: '南岸 9052', body: '今晚先把手机放远一点吧。', at: Date.now() - 2 * 60 * 60 * 1000 }
      ]
    },
    {
      id: 'pst_demo_4',
      author: '南岸 9052',
      mine: false,
      body: '有些话不想发在熟人看得见的地方，放在这里刚刚好。',
      emotion: '松弛',
      context: '独处',
      publishedAt: Date.now() - 6 * 60 * 60 * 1000,
      retentionHours: 72,
      reactions: { HUG: 10, HEAD_PAT: 14, CHEER: 5 },
      myReaction: null,
      comments: []
    },
    {
      id: 'pst_demo_5',
      author: '星野 3366',
      mine: false,
      body: '给自己留一句：慢一点也没关系。',
      emotion: '鼓励',
      context: '工作',
      publishedAt: Date.now() - 9 * 60 * 60 * 1000,
      retentionHours: 168,
      reactions: { HUG: 8, HEAD_PAT: 7, CHEER: 26 },
      myReaction: null,
      comments: []
    }
  ];

  const EMOTIONS = ['平静', '温暖', '疲惫', '松弛', '鼓励', '复杂'];
  const CONTEXTS = ['日常', '工作', '夜晚', '独处', '路上', '关系'];
  const REACTIONS = [
    { type: 'HUG', icon: '♡', label: '抱一抱' },
    { type: 'HEAD_PAT', icon: '⌁', label: '摸摸头' },
    { type: 'CHEER', icon: '✊', label: '握拳' }
  ];

  const defaultState = () => ({
    version: 3,
    session: false,
    noticeConfirmed: false,
    activeView: 'feed',
    selectedPostId: null,
    draft: {
      body: '',
      emotion: '',
      context: '',
      retention: '168',
      acknowledged: false
    },
    posts: structuredClone(SEED_POSTS),
    quota: []
  });

  let state = loadState();
  let publishing = false;
  let pendingAfterLogin = false;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || saved.version !== 3 || !Array.isArray(saved.posts)) {
        return defaultState();
      }
      return { ...defaultState(), ...saved };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function graphemeCount(value) {
    if (segmenter) {
      return Array.from(segmenter.segment(value)).length;
    }
    return Array.from(value).length;
  }

  function formatRelative(timestamp) {
    const seconds = Math.max(1, Math.floor((Date.now() - Number(timestamp)) / 1000));
    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  function remainingLabel(post) {
    const expiresAt = post.publishedAt + post.retentionHours * 3600000;
    const remaining = Math.max(0, expiresAt - Date.now());
    const hours = Math.ceil(remaining / 3600000);
    if (hours <= 0) return '已到期';
    if (hours < 24) return `还剩 ${hours} 小时`;
    return `还剩 ${Math.ceil(hours / 24)} 天`;
  }

  function totalReactions(post) {
    return Object.values(post.reactions).reduce((sum, value) => sum + value, 0);
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('visible'), 1800);
  }

  function setView(view) {
    state.activeView = view;
    saveState();
    $$('.view').forEach((section) => {
      const active = section.id === `view-${view}`;
      section.hidden = !active;
      section.classList.toggle('active', active);
    });
    $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.nav === view));
    if (view === 'feed') renderFeed();
    if (view === 'publish') restoreDraft();
    if (view === 'my') renderMy();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderFeed() {
    const list = $('#post-list');
    list.textContent = '';
    state.posts
      .filter((post) => !post.mine || state.session)
      .sort((left, right) => right.publishedAt - left.publishedAt)
      .forEach((post) => list.appendChild(createPostCard(post)));
  }

  function createPostCard(post, compact = false) {
    const card = document.createElement('article');
    card.className = 'post-card';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'post-card-button post-card';
    button.style.cssText = 'padding:0;border:0;background:transparent;box-shadow:none;';
    button.addEventListener('click', () => openDetail(post.id));

    const authorRow = document.createElement('div');
    authorRow.className = 'post-author-row';
    const author = document.createElement('span');
    author.className = 'author';
    const avatar = document.createElement('span');
    avatar.className = 'mini-avatar';
    avatar.textContent = Array.from(post.author)[0] || 'J';
    const authorName = document.createElement('span');
    authorName.textContent = post.author;
    author.append(avatar, authorName);
    const time = document.createElement('span');
    time.className = 'post-time';
    time.textContent = post.mine ? `我的情绪 · ${remainingLabel(post)}` : formatRelative(post.publishedAt);
    authorRow.append(author, time);

    const body = document.createElement('p');
    body.className = 'post-body';
    body.textContent = post.body;
    if (compact) body.style.webkitLineClamp = '2';

    const tags = document.createElement('div');
    tags.className = 'tag-row';
    if (post.emotion) tags.appendChild(createTag(post.emotion));
    if (post.context) tags.appendChild(createTag(post.context, true));

    const footer = document.createElement('div');
    footer.className = 'post-footer';
    footer.innerHTML = `<span>评论 ${post.comments.length}</span><span>回应 ${totalReactions(post)}</span>`;

    button.append(authorRow, body, tags, footer);
    card.appendChild(button);
    return card;
  }

  function createTag(text, context = false) {
    const tag = document.createElement('span');
    tag.className = `tag${context ? ' context' : ''}`;
    tag.textContent = text;
    return tag;
  }

  function openDetail(postId) {
    const post = state.posts.find((item) => item.id === postId);
    if (!post) return;
    state.selectedPostId = postId;
    saveState();
    $('#detail-title').textContent = post.mine ? '我的情绪' : 'TA的情绪';
    renderDetail(post);
    $('#detail-layer').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    $('#detail-layer').hidden = true;
    document.body.style.overflow = '';
    state.selectedPostId = null;
    saveState();
  }

  function renderDetail(post) {
    const content = $('#detail-content');
    content.textContent = '';
    const body = document.createElement('div');
    body.className = 'detail-body';

    const authorRow = document.createElement('div');
    authorRow.className = 'detail-author';
    const author = document.createElement('span');
    author.className = 'author';
    const avatar = document.createElement('span');
    avatar.className = 'mini-avatar';
    avatar.textContent = Array.from(post.author)[0] || 'J';
    const name = document.createElement('span');
    name.textContent = post.author;
    author.append(avatar, name);
    const time = document.createElement('span');
    time.className = 'post-time';
    time.textContent = post.mine ? remainingLabel(post) : formatRelative(post.publishedAt);
    authorRow.append(author, time);

    const copy = document.createElement('p');
    copy.className = 'detail-copy';
    copy.textContent = post.body;

    const tags = document.createElement('div');
    tags.className = 'tag-row';
    if (post.emotion) tags.appendChild(createTag(post.emotion));
    if (post.context) tags.appendChild(createTag(post.context, true));

    const reactions = document.createElement('div');
    reactions.className = 'reaction-bar';
    reactions.style.marginTop = '22px';
    REACTIONS.forEach((reaction) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `reaction-button${post.myReaction === reaction.type ? ' active' : ''}`;
      button.innerHTML = `<span class="reaction-icon">${reaction.icon}</span><span>${reaction.label}</span><strong>${post.reactions[reaction.type]}</strong>`;
      button.addEventListener('click', (event) => toggleReaction(post.id, reaction.type, event.currentTarget));
      reactions.appendChild(button);
    });

    const footer = document.createElement('p');
    footer.className = 'detail-footer';
    footer.textContent = post.mine
      ? `发布于 ${formatTime(post.publishedAt)} · ${remainingLabel(post)}`
      : `发布于 ${formatTime(post.publishedAt)} · 留存时间仅作者可见`;

    const comments = document.createElement('section');
    comments.className = 'comment-section';
    const heading = document.createElement('h3');
    heading.textContent = `回应 · ${post.comments.length}`;
    const list = document.createElement('div');
    list.className = 'comment-list';
    post.comments.forEach((comment) => list.appendChild(createComment(comment)));
    if (!post.comments.length) {
      const empty = document.createElement('p');
      empty.className = 'post-time';
      empty.textContent = '还没有回应，给 TA 留一句吧。';
      list.appendChild(empty);
    }

    const compose = document.createElement('form');
    compose.className = 'comment-compose';
    const input = document.createElement('input');
    input.maxLength = 200;
    input.placeholder = '写一句回应……';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = '发送';
    compose.append(input, submit);
    compose.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (graphemeCount(text) > 200) {
        showToast('回应最多 200 个可见字符');
        return;
      }
      post.comments.push({
        id: `cmt_${Date.now()}`,
        author: '晚风 1024',
        body: text,
        at: Date.now()
      });
      saveState();
      renderDetail(post);
      renderFeed();
      showToast('回应已发送');
    });
    comments.append(heading, list, compose);
    body.append(authorRow, copy, tags, reactions, footer, comments);
    content.appendChild(body);
  }

  function createComment(comment) {
    const row = document.createElement('div');
    row.className = 'comment';
    const avatar = document.createElement('span');
    avatar.className = 'comment-avatar';
    avatar.textContent = Array.from(comment.author)[0] || 'J';
    const content = document.createElement('div');
    content.className = 'comment-content';
    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    const name = document.createElement('span');
    name.textContent = comment.author;
    const time = document.createElement('span');
    time.textContent = formatRelative(comment.at);
    meta.append(name, time);
    const body = document.createElement('p');
    body.textContent = comment.body;
    content.append(meta, body);
    row.append(avatar, content);
    return row;
  }

  function toggleReaction(postId, type, button) {
    const post = state.posts.find((item) => item.id === postId);
    if (!post) return;
    if (post.myReaction === type) {
      post.reactions[type] = Math.max(0, post.reactions[type] - 1);
      post.myReaction = null;
    } else {
      if (post.myReaction) {
        post.reactions[post.myReaction] = Math.max(0, post.reactions[post.myReaction] - 1);
      }
      post.reactions[type] += 1;
      post.myReaction = type;
      burst(button, REACTIONS.find((item) => item.type === type)?.icon || '♡');
    }
    saveState();
    renderDetail(post);
    renderFeed();
  }

  function burst(button, symbol) {
    const burstLayer = document.createElement('span');
    burstLayer.className = 'reaction-burst';
    for (let index = 0; index < 5; index += 1) {
      const particle = document.createElement('span');
      particle.textContent = symbol;
      particle.style.left = `${18 + index * 16}%`;
      particle.style.animationDelay = `${index * 35}ms`;
      burstLayer.appendChild(particle);
    }
    button.appendChild(burstLayer);
  }

  function renderTagChoices() {
    renderChips('#emotion-tags', EMOTIONS, 'emotion');
    renderChips('#context-tags', CONTEXTS, 'context');
  }

  function renderChips(selector, values, field) {
    const container = $(selector);
    container.textContent = '';
    values.forEach((value) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip${state.draft[field] === value ? ' active' : ''}`;
      chip.textContent = value;
      chip.addEventListener('click', () => {
        state.draft[field] = state.draft[field] === value ? '' : value;
        saveState();
        renderChips(selector, values, field);
      });
      container.appendChild(chip);
    });
  }

  function restoreDraft() {
    $('#body-text').value = state.draft.body;
    $('#public-ack').checked = state.draft.acknowledged;
    $$('input[name="retention"]').forEach((input) => {
      input.checked = input.value === state.draft.retention;
    });
    renderTagChoices();
    updateBodyCount();
  }

  function updateBodyCount() {
    const length = graphemeCount($('#body-text').value.trim());
    $('#body-count').textContent = `${length} / 500`;
  }

  function persistDraft() {
    state.draft.body = $('#body-text').value;
    state.draft.acknowledged = $('#public-ack').checked;
    const retention = document.querySelector('input[name="retention"]:checked');
    state.draft.retention = retention?.value || '168';
    saveState();
  }

  function openLogin() {
    pendingAfterLogin = true;
    $('#login-message').textContent = '';
    $('#login-notice').checked = state.noticeConfirmed;
    $('#login-layer').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLayer(id) {
    $(`#${id}`).hidden = true;
    document.body.style.overflow = $('#detail-layer').hidden ? '' : 'hidden';
  }

  function publish() {
    if (publishing) return;
    persistDraft();
    const body = $('#body-text').value.trim();
    const length = graphemeCount(body);
    const message = $('#publish-message');
    message.textContent = '';

    if (!body || length > 500) {
      message.textContent = !body ? '先写下一点内容。' : '正文最多 500 个可见字符。';
      return;
    }
    if (!$('#public-ack').checked) {
      message.textContent = '请先确认内容会进入公共广场。';
      return;
    }
    if (!state.session) {
      openLogin();
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    state.quota = state.quota.filter((timestamp) => timestamp >= today.getTime());
    if (state.quota.length >= DAILY_LIMIT) {
      message.textContent = '今天已经发布 5 条，明天再来吧。';
      return;
    }

    publishing = true;
    $('#publish-submit').disabled = true;
    $('#publish-submit').textContent = '正在发布…';
    setTimeout(() => {
      const now = Date.now();
      const post = {
        id: `pst_${now}`,
        author: '晚风 1024',
        mine: true,
        body,
        emotion: state.draft.emotion,
        context: state.draft.context,
        publishedAt: now,
        retentionHours: Number(state.draft.retention),
        reactions: { HUG: 0, HEAD_PAT: 0, CHEER: 0 },
        myReaction: null,
        comments: []
      };
      state.posts.unshift(post);
      state.quota.push(now);
      state.draft = { body: '', emotion: '', context: '', retention: '168', acknowledged: false };
      saveState();
      publishing = false;
      $('#publish-submit').disabled = false;
      $('#publish-submit').textContent = '发布';
      restoreDraft();
      showToast('发布成功');
      setView('feed');
      openDetail(post.id);
    }, 360);
  }

  function renderMy() {
    const mine = state.posts.filter((post) => post.mine);
    const comments = mine.reduce((sum, post) => sum + post.comments.length, 0);
    const active = mine.filter((post) => post.publishedAt + post.retentionHours * 3600000 > Date.now()).length;
    $('#stat-total').textContent = String(mine.length);
    $('#stat-active').textContent = String(active);
    $('#stat-comments').textContent = String(comments);
    const list = $('#my-post-list');
    list.textContent = '';
    if (!mine.length) {
      const empty = document.createElement('p');
      empty.className = 'post-time';
      empty.textContent = '还没有发布过内容。';
      list.appendChild(empty);
      return;
    }
    mine.forEach((post) => list.appendChild(createPostCard(post, true)));
  }

  function resetDemo() {
    const confirmed = window.confirm('重置所有体验数据和本地草稿？');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    saveState();
    setView('feed');
    showToast('体验数据已重置');
  }

  function bindEvents() {
    $$('[data-nav]').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.nav));
    });
    $('#close-detail').addEventListener('click', closeDetail);
    $('#detail-layer').addEventListener('click', (event) => {
      if (event.target === $('#detail-layer')) closeDetail();
    });
    $$('[data-close]').forEach((button) => {
      button.addEventListener('click', () => closeLayer(button.dataset.close));
    });
    $('#body-text').addEventListener('input', () => {
      updateBodyCount();
      persistDraft();
    });
    $('#public-ack').addEventListener('change', persistDraft);
    $$('input[name="retention"]').forEach((input) => {
      input.addEventListener('change', persistDraft);
    });
    $('#publish-form').addEventListener('submit', (event) => {
      event.preventDefault();
      publish();
    });
    $('#demo-login').addEventListener('click', () => {
      if (!$('#login-notice').checked) {
        $('#login-message').textContent = '请先勾选并同意使用须知。';
        return;
      }
      state.session = true;
      state.noticeConfirmed = true;
      saveState();
      closeLayer('login-layer');
      showToast('体验登录成功，草稿已恢复');
      if (pendingAfterLogin) setView('publish');
      pendingAfterLogin = false;
    });
    $('#reset-demo').addEventListener('click', resetDemo);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!$('#detail-layer').hidden) closeDetail();
        if (!$('#login-layer').hidden) closeLayer('login-layer');
      }
    });
  }

  bindEvents();
  restoreDraft();
  const previewParams = new URLSearchParams(window.location.search);
  const requestedView = previewParams.get('view');
  const initialView = ['feed', 'publish', 'my'].includes(requestedView || '')
    ? requestedView
    : state.activeView === 'my' || state.activeView === 'publish'
      ? state.activeView
      : 'feed';
  setView(initialView);
  const requestedPost = previewParams.get('post');
  if (requestedPost && state.posts.some((post) => post.id === requestedPost)) {
    openDetail(requestedPost);
  }
})();
