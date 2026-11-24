(() => {
  'use strict';

  const reports = [
    { id: 'case_1', source: '用户举报', reason: '隐私信息', target: '帖子', author: '晚风 4821', copy: '今天终于把拖了很久的事情做完了。没有想象中那么轻松，但至少往前了一点。', status: 'PENDING', submittedAt: '今天 14:28' },
    { id: 'case_2', source: '规则复核', reason: '高风险表达', target: '帖子', author: '微光 1208', copy: '最近总觉得时间不够用，脑子一直在转。希望今晚能早点睡。', status: 'PENDING', submittedAt: '今天 13:52' },
    { id: 'case_3', source: '用户举报', reason: '垃圾信息', target: '评论', author: '南岸 9052', copy: '多次发布重复推广内容。', status: 'PENDING', submittedAt: '今天 12:10' },
    { id: 'case_4', source: '用户举报', reason: '辱骂与骚扰', target: '评论', author: '远山 7310', copy: '包含攻击他人的回应。', status: 'RESOLVED', submittedAt: '昨天 22:16' }
  ];

  const contents = [
    { copy: '给自己留一句：慢一点也没关系。', author: '星野 3366', publicStatus: '公开中', moderation: '已通过', expiry: '6 天后', reports: 0 },
    { copy: '最近总觉得时间不够用，脑子一直在转。', author: '微光 1208', publicStatus: '公开中', moderation: '待复核', expiry: '18 小时后', reports: 1 },
    { copy: '有些话不想发在熟人看得见的地方。', author: '南岸 9052', publicStatus: '已隐藏', moderation: '判定违规', expiry: '2 天后', reports: 2 },
    { copy: '下班路上看到很漂亮的晚霞。', author: '远山 7310', publicStatus: '已到期', moderation: '已通过', expiry: '已到期', reports: 0 }
  ];

  const users = [
    { name: '晚风 4821', status: '正常', posts: 12, comments: 36, restriction: '无进行中的限制', joined: '11/20' },
    { name: '远山 7310', status: '受限', posts: 8, comments: 17, restriction: '限制评论至 11/25 18:00', joined: '11/19' },
    { name: '微光 1208', status: '正常', posts: 5, comments: 24, restriction: '无进行中的限制', joined: '11/18' },
    { name: '南岸 9052', status: '已封禁', posts: 3, comments: 9, restriction: '账号已封禁', joined: '11/16' }
  ];

  const audits = [
    { action: '复核通过', actor: '内容审核员', object: '帖子', reason: '未发现违规', time: '今天 14:36' },
    { action: '判定违规', actor: '内容审核员', object: '评论', reason: '辱骂与骚扰', time: '今天 14:12' },
    { action: '隐藏内容', actor: '内容审核员', object: '帖子', reason: '隐私信息', time: '今天 11:40' },
    { action: '恢复公开', actor: '内容审核员', object: '帖子', reason: '复核确认无误', time: '昨天 20:18' }
  ];

  const labels = { overview: '数据工作台', queue: '待处理事项', content: '内容治理', users: '用户管理', audit: '审计日志' };
  let currentPanel = 'overview';
  let currentCase = null;
  let openTabs = [{ id: 'overview', closable: false }];

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function badge(text, kind = '') {
    return `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
  }

  function renderTabs() {
    const box = $('#workspace-tabs');
    box.textContent = '';
    openTabs.forEach((tab) => {
      const wrapper = document.createElement('div');
      wrapper.className = `workspace-tab${tab.id === currentPanel ? ' active' : ''}`;
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'workspace-tab-label';
      label.textContent = labels[tab.id];
      label.addEventListener('click', () => switchPanel(tab.id));
      wrapper.appendChild(label);
      if (tab.closable) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'workspace-tab-close';
        close.textContent = '×';
        close.title = '关闭标签页';
        close.addEventListener('click', (event) => {
          event.stopPropagation();
          closeTab(tab.id);
        });
        wrapper.appendChild(close);
      }
      box.appendChild(wrapper);
    });
  }

  function switchPanel(panel) {
    currentPanel = panel;
    if (!openTabs.some((tab) => tab.id === panel)) {
      openTabs.push({ id: panel, closable: panel !== 'overview' });
    }
    $$('.panel').forEach((section) => section.classList.toggle('active', section.id === `panel-${panel}`));
    $$('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.panel === panel));
    $('#page-title').textContent = labels[panel];
    $('#breadcrumb-current').textContent = labels[panel];
    renderTabs();
  }

  function closeTab(panel) {
    const index = openTabs.findIndex((tab) => tab.id === panel);
    if (index < 0) return;
    openTabs.splice(index, 1);
    if (!openTabs.some((tab) => tab.id === 'overview')) openTabs.unshift({ id: 'overview', closable: false });
    if (currentPanel === panel) switchPanel(openTabs[Math.max(0, index - 1)]?.id || 'overview');
    else renderTabs();
  }

  function renderOverview() {
    const list = $('#overview-list');
    list.textContent = '';
    reports.filter((item) => item.status === 'PENDING').slice(0, 3).forEach((item) => {
      const card = document.createElement('article');
      card.className = 'queue-card';
      card.innerHTML = `<span class="queue-mark">${item.source === '用户举报' ? '⚑' : '◇'}</span><div class="queue-copy"><strong>${escapeHtml(item.reason)} · ${escapeHtml(item.target)}</strong><small>${escapeHtml(item.author)} · ${escapeHtml(item.submittedAt)}</small></div>`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'row-action';
      button.textContent = '处理';
      button.addEventListener('click', () => openProcess(item));
      card.appendChild(button);
      list.appendChild(card);
    });
  }

  function renderQueue() {
    const source = $('#queue-source').value;
    const status = $('#queue-status').value;
    const body = $('#queue-body');
    body.textContent = '';
    reports.filter((item) => (!source || item.source === source) && (!status || item.status === status)).forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${badge(item.source)}</td><td>${badge(item.reason, 'warning')}</td><td><span class="cell-main">${escapeHtml(item.target)}</span><span class="cell-sub">${escapeHtml(item.author)}</span></td><td>${item.status === 'RESOLVED' ? badge('已处理', 'ok') : badge('待处理')}</td><td>${escapeHtml(item.submittedAt)}</td><td></td>`;
      const action = row.lastElementChild;
      if (item.status === 'RESOLVED') {
        action.innerHTML = '<span class="done-text">已处理</span>';
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'row-action';
        button.textContent = '处理';
        button.addEventListener('click', () => openProcess(item));
        action.appendChild(button);
      }
      body.appendChild(row);
    });
  }

  function renderContent() {
    const body = $('#content-body');
    body.textContent = '';
    contents.forEach((item) => {
      const closed = item.publicStatus === '已到期' || item.publicStatus === '已隐藏' || item.moderation === '判定违规';
      const row = document.createElement('tr');
      row.innerHTML = `<td><span class="cell-main">${escapeHtml(item.copy)}</span></td><td>${escapeHtml(item.author)}</td><td>${badge(item.publicStatus, item.publicStatus === '公开中' ? 'ok' : item.publicStatus === '已隐藏' ? 'danger' : '')}</td><td>${badge(item.moderation, item.moderation === '已通过' ? 'ok' : item.moderation === '判定违规' ? 'danger' : 'warning')}</td><td>${escapeHtml(item.expiry)}</td><td>${item.reports}</td><td>${closed ? `<span class="done-text">${escapeHtml(item.publicStatus)}</span>` : '<button class="row-action" type="button">处理</button>'}</td>`;
      body.appendChild(row);
    });
  }

  function renderUsers() {
    const query = $('#user-search').value.trim().toLowerCase();
    const body = $('#user-body');
    body.textContent = '';
    users.filter((user) => !query || user.name.toLowerCase().includes(query)).forEach((user) => {
      const kind = user.status === '正常' ? 'ok' : user.status === '受限' ? 'warning' : 'danger';
      const row = document.createElement('tr');
      row.innerHTML = `<td><div class="user-cell"><span class="mini-avatar">${escapeHtml(Array.from(user.name)[0])}</span><span class="cell-main">${escapeHtml(user.name)}</span></div></td><td>${badge(user.status, kind)}</td><td>帖子 ${user.posts} · 回应 ${user.comments}</td><td>${escapeHtml(user.restriction)}</td><td>${escapeHtml(user.joined)}</td><td>${user.status === '已封禁' ? '<span class="done-text">不可处理</span>' : '<button class="row-action" type="button">处理</button>'}</td>`;
      body.appendChild(row);
    });
  }

  function renderAudit() {
    const action = $('#audit-action').value;
    const body = $('#audit-body');
    body.textContent = '';
    audits.filter((item) => !action || item.action === action).forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${badge(item.action, 'ok')}</td><td>${escapeHtml(item.actor)}</td><td>${escapeHtml(item.object)}</td><td>${escapeHtml(item.reason)}</td><td>${escapeHtml(item.time)}</td>`;
      body.appendChild(row);
    });
  }

  function openProcess(item) {
    currentCase = item;
    $('#process-title').textContent = item.source === '用户举报' ? '处理举报' : '内容复核';
    $('#process-avatar').textContent = Array.from(item.author)[0] || '用';
    $('#process-author').textContent = item.author;
    $('#process-copy').textContent = item.copy;
    $('#process-source').textContent = item.source;
    $('#process-reason').textContent = item.reason;
    $('#process-time').textContent = item.submittedAt;
    $('#process-reason-input').value = '';
    $('#process-message').textContent = '';
    document.querySelector('input[name="decision"][value="PASSED"]').checked = true;
    $('#process-layer').hidden = false;
  }

  function closeProcess() {
    $('#process-layer').hidden = true;
    currentCase = null;
  }

  function submitProcess() {
    if (!currentCase) return;
    const decision = document.querySelector('input[name="decision"]:checked')?.value;
    const reason = $('#process-reason-input').value.trim();
    if (!reason) {
      $('#process-message').textContent = '请填写处理原因。';
      return;
    }
    currentCase.status = 'RESOLVED';
    audits.unshift({ action: decision === 'PASSED' ? '复核通过' : '判定违规', actor: '演示运营账号', object: currentCase.target, reason, time: '刚刚' });
    closeProcess();
    renderOverview();
    renderQueue();
    renderAudit();
    $('#feedback-title').textContent = decision === 'PASSED' ? '处理成功' : '已判定违规';
    $('#feedback-message').textContent = decision === 'PASSED' ? '事项已复核通过并写入审计日志。' : '内容已隐藏，处理结果已写入审计日志。';
    $('#feedback-layer').hidden = false;
  }

  function bindEvents() {
    $('#login-form').addEventListener('submit', (event) => {
      event.preventDefault();
      enterDemo();
    });
    $('#logout').addEventListener('click', () => {
      $('#admin-app').hidden = true;
      $('#login-screen').hidden = false;
    });
    $$('.nav-button').forEach((button) => button.addEventListener('click', () => switchPanel(button.dataset.panel)));
    $$('[data-jump]').forEach((button) => button.addEventListener('click', () => switchPanel(button.dataset.jump)));
    $('#queue-source').addEventListener('change', renderQueue);
    $('#queue-status').addEventListener('change', renderQueue);
    $('#user-search').addEventListener('input', renderUsers);
    $('#audit-action').addEventListener('change', renderAudit);
    $('#close-process').addEventListener('click', closeProcess);
    $('#cancel-process').addEventListener('click', closeProcess);
    $('#submit-process').addEventListener('click', submitProcess);
    $('#feedback-close').addEventListener('click', () => { $('#feedback-layer').hidden = true; });
    $('#process-layer').addEventListener('click', (event) => { if (event.target === $('#process-layer')) closeProcess(); });
    $('#feedback-layer').addEventListener('click', (event) => { if (event.target === $('#feedback-layer')) $('#feedback-layer').hidden = true; });
  }

  function enterDemo() {
    $('#login-screen').hidden = true;
    $('#admin-app').hidden = false;
    renderAll();
  }

  function renderAll() {
    renderOverview();
    renderQueue();
    renderContent();
    renderUsers();
    renderAudit();
    renderTabs();
  }

  bindEvents();
  if (new URLSearchParams(window.location.search).get('demo') === '1') {
    enterDemo();
  }
})();
