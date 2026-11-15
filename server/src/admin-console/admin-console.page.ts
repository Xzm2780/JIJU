export const ADMIN_CONSOLE_HTML = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>JIJU 情绪广场管理后台</title>
  <style>
    :root{--bg:#f4efed;--panel:#fffdfc;--ink:#30292a;--muted:#8b797a;--line:#e8dcda;--accent:#a5686c;--accent-soft:#f1e0e2;--sidebar:#3d3233;--sidebar-muted:#b9a9aa;--danger:#914f4f;--ok:#708575}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
    button,input,select,textarea{font:inherit}button{cursor:pointer}.hidden{display:none!important}
    .login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 20% 20%,#ead7d8 0,transparent 34%),linear-gradient(145deg,#f9f4f1,#eee3e2)}
    .login-card{width:min(420px,100%);padding:38px;border:1px solid rgba(165,104,108,.18);border-radius:24px;background:rgba(255,253,252,.96);box-shadow:0 24px 70px rgba(71,48,50,.16)}
    .login-logo{width:58px;height:58px;border-radius:18px;background:linear-gradient(145deg,#c38c90,#a5686c);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;margin-bottom:18px}
    .login-card h1{margin:0 0 8px;font-size:26px}.login-card p{margin:0 0 26px;color:var(--muted)}
    .login-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}.login-field label{font-size:12px;color:var(--muted);font-weight:700}
    input,select,textarea{min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);outline:none}input:focus,select:focus,textarea:focus{border-color:#b77d81;box-shadow:0 0 0 3px rgba(165,104,108,.12)}
    .login-button,.primary{border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:700;padding:10px 16px}.login-button{width:100%;padding:12px}.secondary{background:var(--accent-soft);color:#7c4c52}.danger{background:#f6e6e3;color:var(--danger)}
    .login-help{margin-top:14px;color:var(--muted);font-size:12px;line-height:1.6;text-align:center}
    .app-shell{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;padding:22px 16px;background:linear-gradient(180deg,#423637,#352c2d);color:#fff;display:flex;flex-direction:column}
    .brand{display:flex;align-items:center;gap:12px;padding:4px 8px 24px;border-bottom:1px solid rgba(255,255,255,.1)}.brand-mark{width:42px;height:42px;border-radius:13px;background:#a5686c;display:flex;align-items:center;justify-content:center;font-weight:800}.brand-name{font-size:17px;font-weight:750}.brand-sub{font-size:11px;color:var(--sidebar-muted)}
    .nav{display:flex;flex-direction:column;gap:7px;margin-top:22px}.nav-button{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border:0;border-radius:11px;background:transparent;color:#d9cdcd;text-align:left;font-weight:600}.nav-button:hover{background:rgba(255,255,255,.07)}.nav-button.active{background:#a5686c;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12)}.nav-icon{width:20px;text-align:center;font-size:18px}
    .sidebar-footer{margin-top:auto;padding:14px 8px 0;border-top:1px solid rgba(255,255,255,.1);color:var(--sidebar-muted);font-size:11px}
    .workspace{min-width:0}.topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;min-height:72px;padding:12px 28px;border-bottom:1px solid var(--line);background:rgba(255,253,252,.94);backdrop-filter:blur(12px)}.topbar h2{margin:0;font-size:20px}.breadcrumb{margin-bottom:3px;color:#a08789;font-size:11px}.topbar-sub{color:var(--muted);font-size:12px;margin-top:2px}.topbar-actions{display:flex;align-items:center;gap:12px}.operator{padding:7px 12px;border-radius:999px;background:#f5eeeb;color:#765d5f;font-size:12px}
    main{padding:26px}.panel{display:none}.panel.active{display:block}.page-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.page-head h3{margin:0 0 4px;font-size:19px}.page-head p{margin:0;color:var(--muted);font-size:13px}
    .toolbar{display:flex;align-items:end;gap:10px;margin-bottom:16px;flex-wrap:wrap;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}.field{display:flex;flex-direction:column;gap:6px;min-width:150px;flex:1}.field label{font-size:12px;color:var(--muted);font-weight:700}.wide{grid-column:1/-1}
    .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.summary-card{padding:18px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.summary-value{font-size:27px;font-weight:800;color:#7c4c52}.summary-label{font-size:12px;color:var(--muted)}
    .list{display:block}.data-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.data-table{width:100%;min-width:880px;border-collapse:collapse}.data-table th{padding:12px 14px;background:#f8f3f1;color:#756365;font-size:11px;font-weight:750;text-align:left;white-space:nowrap}.data-table td{padding:13px 14px;border-top:1px solid #efe5e2;color:#4b4142;font-size:12px;vertical-align:middle}.data-table tr:hover td{background:#fdf9f7}.cell-main{font-weight:650;color:var(--ink)}.cell-sub{display:block;margin-top:3px;color:var(--muted);font-size:10px;word-break:break-all}.badge{display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:999px;background:var(--accent-soft);color:#7c4c52;font-size:11px}.badge.urgent{background:#f4d6d2;color:#8c3f3f}.badge.ok{background:#e7efe8;color:#58705d}.actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.row-action{border:0;border-radius:8px;background:var(--accent-soft);color:#7c4c52;padding:6px 10px;font-size:11px;font-weight:700;white-space:nowrap}.empty{padding:34px;color:var(--muted);text-align:center}
    .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;padding:18px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}textarea{min-height:88px;resize:vertical}.status{min-height:22px;margin:0 0 14px;color:var(--muted);white-space:pre-wrap}.status.error{color:var(--danger)}.empty{padding:34px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);text-align:center}
    .system-note{margin-top:18px;padding:15px;border-radius:14px;background:#f8f1ed;color:#7d625e;font-size:12px;line-height:1.7}
    @media(max-width:900px){.app-shell{grid-template-columns:1fr}.sidebar{position:static;height:auto}.nav{flex-direction:row;overflow:auto}.sidebar-footer{display:none}.summary-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:600px){main{padding:14px}.topbar{padding:10px 14px}.topbar-sub,.operator{display:none}.login-card{padding:26px}.summary-grid{grid-template-columns:1fr 1fr}.nav-button{padding:10px}.nav-icon{display:none}}
  </style>
</head>
<body>
  <section id="login-screen" class="login-screen">
    <form id="login-form" class="login-card">
      <div class="login-logo">J</div>
      <h1>情绪广场管理后台</h1>
      <p>请使用运营账号登录。所有治理动作会由服务端校验角色并写入审计。</p>
      <div class="login-field"><label>用户名</label><input id="login-username" placeholder="admin" autocomplete="username"></div>
      <div class="login-field"><label>密码</label><input id="login-password" type="password" placeholder="请输入密码" autocomplete="current-password"></div>
      <button class="login-button" type="submit">登录后台</button>
      <div class="login-help">账号由系统管理员统一分配，如无法登录请联系运营负责人。</div>
      <div id="login-error" class="status error"></div>
    </form>
  </section>

  <div id="app-shell" class="app-shell hidden">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">J</div><div><div class="brand-name">JIJU</div><div class="brand-sub">情绪广场管理后台</div></div></div>
      <nav class="nav" id="sidebar-nav">
        <button class="nav-button active" data-panel="overview"><span class="nav-icon">▦</span><span>数据工作台</span></button>
        <button class="nav-button" data-panel="content"><span class="nav-icon">◇</span><span>内容治理</span></button>
        <button class="nav-button" data-panel="queue"><span class="nav-icon">≡</span><span>待复核内容</span></button>
        <button class="nav-button" data-panel="reports"><span class="nav-icon">⚑</span><span>举报管理</span></button>
        <button class="nav-button" data-panel="accounts"><span class="nav-icon">◎</span><span>用户管理</span></button>
        <button class="nav-button" data-panel="audit"><span class="nav-icon">⌕</span><span>审计日志</span></button>
      </nav>
      <div class="sidebar-footer">权限由 AdminRoleAssignment 控制<br>敏感数据不会进入通用日志</div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div><div class="breadcrumb">JIJU 运营管理 / <span id="breadcrumb-current">数据工作台</span></div><h2 id="page-title">数据工作台</h2><div id="page-subtitle" class="topbar-sub">处理举报、内容复核和账号治理</div></div>
        <div class="topbar-actions"><span class="operator">运营后台</span><button id="logout-button" class="secondary">退出登录</button></div>
      </header>
      <main>
        <div id="status" class="status"></div>

        <section class="panel active" id="panel-overview">
          <div class="page-head"><div><h3>运营概览</h3><p>聚合内容、举报、复核和未成年人优先事项。</p></div><button class="primary" data-jump="reports">进入举报管理</button></div>
          <div class="summary-grid">
            <div class="summary-card"><div class="summary-value" id="summary-posts">—</div><div class="summary-label">广场可见帖子</div></div>
            <div class="summary-card"><div class="summary-value" id="summary-reports">—</div><div class="summary-label">待处理举报</div></div>
            <div class="summary-card"><div class="summary-value" id="summary-queue">—</div><div class="summary-label">待复核内容</div></div>
            <div class="summary-card"><div class="summary-value" id="summary-minor">—</div><div class="summary-label">未成年人相关待办</div></div>
          </div>
          <div class="page-head"><div><h3>待处理事项</h3><p>按来源汇总当前需要运营关注的项目。</p></div></div>
          <div class="list" id="overview-list"></div>
          <div class="system-note">建议按“举报队列 → 统一复核 → 内容治理 → 审计”顺序处理。账号限制属于独立高风险操作，需二次确认。登录令牌与业务数据不会写入浏览器持久存储，关闭页面后需要重新登录。</div>
        </section>

        <section class="panel" id="panel-reports">
          <div class="page-head"><div><h3>举报管理</h3><p>仅“涉及未成年人”举报使用优先标记，其余举报按提交时间处理。</p></div></div>
          <div class="toolbar"><div class="field"><label>处理状态</label><select id="report-status"><option value="">待处理与处理中</option><option value="PENDING">待处理</option><option value="PROCESSING">处理中</option><option value="RESOLVED">已完成</option></select></div><div class="field"><label>举报原因</label><select id="report-reason"><option value="">全部原因</option><option value="ABUSE">辱骂、攻击或骚扰</option><option value="PRIVACY">隐私信息</option><option value="MINOR_INVOLVED">涉及未成年人</option><option value="DANGEROUS_OR_INAPPROPRIATE">危险或不适当内容</option><option value="SPAM">广告或垃圾信息</option><option value="OTHER">其他原因</option></select></div><button id="load-reports" class="primary">查询</button></div>
          <div class="list" id="report-list"></div>
        </section>

        <section class="panel" id="panel-queue">
          <div class="page-head"><div><h3>待复核内容</h3><p>合并用户举报和内容规则产生的事项，仅返回运营处理所需信息。</p></div></div>
          <div class="toolbar"><div class="field"><label>事项来源</label><select id="queue-source"><option value="all">全部事项</option><option value="report">用户举报</option><option value="moderation">规则复核</option></select></div><button id="load-queue" class="primary">查询</button></div>
          <div class="list" id="queue-list"></div>
        </section>

        <section class="panel" id="panel-content">
          <div class="page-head"><div><h3>内容治理</h3><p>先筛选并选择需要处理的内容，系统会自动带入内容编号和当前版本。</p></div></div>
          <div class="toolbar"><div class="field"><label>内容类型</label><select id="content-filter-type"><option value="POST">帖子</option><option value="COMMENT">评论</option></select></div><div class="field"><label>状态</label><select id="content-filter-status"><option value="ALL">全部状态</option><option value="ACTIVE">公开中</option><option value="PENDING_REVIEW">待复核</option><option value="HIDDEN">已隐藏/违规</option><option value="EXPIRED">已到期</option><option value="DELETED">已删除</option></select></div><div class="field"><label>关键词</label><input id="content-query" placeholder="搜索内容摘要或作者昵称"></div><button id="load-content" class="primary">查询内容</button><button id="load-more-content" class="secondary">加载更多</button></div>
          <div class="list" id="content-list"></div>
          <div class="page-head" style="margin-top:22px"><div><h3>内容处理</h3><p id="selected-content-label">请从上方列表选择一条内容。</p></div></div>
          <form class="form-grid" id="content-form"><div class="field"><label>内容类型</label><select id="content-type"><option value="POST">帖子</option><option value="COMMENT">评论</option></select></div><div class="field"><label>内容编号</label><input id="content-id" placeholder="从上方列表自动带入" required></div><div class="field"><label>内容版本</label><input id="content-version" type="number" min="1" required></div><div class="field"><label>复核结论</label><select id="review-decision"><option value="PASSED">通过</option><option value="REJECTED">判定违规</option></select></div><div class="field"><label>后续处理</label><select id="content-action"><option value="">仅记录复核结果</option><option value="HIDE">隐藏内容</option><option value="TAKEDOWN">下架内容</option><option value="RESTORE">恢复公开</option></select></div><div class="field wide"><label>处理原因</label><textarea id="content-reason" placeholder="填写审核依据，只进入受权限保护的治理记录" required></textarea></div><div class="actions wide"><button type="submit" class="primary">提交复核结果</button><button type="button" class="danger" id="submit-action">执行后续处理</button></div></form>
        </section>

        <section class="panel" id="panel-accounts">
          <div class="page-head"><div><h3>账号处置</h3><p>账号处置不会删除用户内容；永久注销属于用户自助流程。</p></div></div>
          <form class="form-grid" id="account-form"><div class="field"><label>用户编号</label><input id="account-user-id" placeholder="usr_..." required></div><div class="field"><label>处理方式</label><select id="account-action"><option value="WARNING">警告</option><option value="POST_LIMIT">限制发帖</option><option value="COMMENT_LIMIT">限制评论</option><option value="REACTION_LIMIT">限制互动</option><option value="BAN">封禁账号</option></select></div><div class="field"><label>限制结束时间</label><input id="account-expires" type="datetime-local"></div><div class="field wide"><label>处理原因</label><textarea id="account-reason" required></textarea></div><div class="actions wide"><button type="submit" class="primary">提交账号处理</button></div></form>
        </section>

        <section class="panel" id="panel-audit">
          <div class="page-head"><div><h3>审计日志</h3><p>审计记录只追加、不允许后台修改或删除。</p></div></div>
          <div class="toolbar"><div class="field"><label>操作人编号</label><input id="audit-actor" placeholder="usr_..."></div><div class="field"><label>操作类型</label><input id="audit-action" placeholder="例如 REVIEW_REJECTED"></div><div class="field"><label>对象类型</label><input id="audit-object-type" placeholder="例如 CONTENT"></div><div class="field"><label>对象编号</label><input id="audit-object-id" placeholder="pst_..."></div><div class="field"><label>开始时间</label><input id="audit-from" type="datetime-local"></div><div class="field"><label>结束时间</label><input id="audit-to" type="datetime-local"></div><button id="load-audit" class="primary">查询</button></div>
          <div class="list" id="audit-list"></div>
        </section>
      </main>
    </section>
  </div>

<script>
(() => {
  const state={token:''};
  let contentCursor='';
  let contentItems=[];
  const $=(s)=>document.querySelector(s);
  const titles={overview:['数据工作台','处理举报、内容复核和账号治理'],reports:['举报管理','举报优先级与处理状态'],queue:['待复核内容','举报与审核规则的统一待办'],content:['内容治理','复核、隐藏、下架和条件恢复'],accounts:['用户管理','警告、能力限制与封禁'],audit:['审计日志','治理动作的可追溯记录']};
  const setStatus=(text,error=false)=>{const el=$('#status');el.textContent=text||'';el.className='status'+(error?' error':'')};
  const setLoginError=(text)=>{$('#login-error').textContent=text||''};
  async function api(path,options={}){
    const authHeader=options.noAuth?{}:{authorization:'Bearer '+state.token};
    const response=await fetch('/api/v1'+path,{method:options.method||'GET',headers:{accept:'application/json',...authHeader,...(options.body?{'content-type':'application/json'}:{}),...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})},body:options.body?JSON.stringify(options.body):undefined});
    const text=await response.text();const body=text?JSON.parse(text):null;
    if(!response.ok)throw new Error((body&&body.code?body.code+': ':'')+(body&&body.message?body.message:response.status));
    return body;
  }
  function uuidV7(){const b=crypto.getRandomValues(new Uint8Array(16));let t=BigInt(Date.now());for(let i=5;i>=0;i--){b[i]=Number(t&255n);t>>=8n}b[6]=(b[6]&15)|112;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}
  const key=(operation)=>'v1:'+operation+':'+uuidV7();
  function switchPanel(name){document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id==='panel-'+name));document.querySelectorAll('.nav-button').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));$('#page-title').textContent=titles[name][0];$('#page-subtitle').textContent=titles[name][1];$('#breadcrumb-current').textContent=titles[name][0];if(name==='overview')loadOverview();if(name==='reports')loadReports();if(name==='queue')loadQueue();if(name==='content')loadContent()}
  const labels={
    POST:'帖子',COMMENT:'评论',
    ABUSE:'辱骂、攻击或骚扰',PRIVACY:'隐私信息',MINOR_INVOLVED:'涉及未成年人',DANGEROUS_OR_INAPPROPRIATE:'危险或不适当内容',SPAM:'广告或垃圾信息',OTHER:'其他原因',
    PREEMPTIVE:'优先处理',NORMAL:'普通',
    PENDING:'待处理',PROCESSING:'处理中',RESOLVED:'已完成',
    report:'用户举报',moderation:'规则复核',
    PASSED:'已通过',REJECTED:'已判定违规',
    PUBLISHED:'公开中',HIDDEN:'已隐藏',EXPIRED:'已到期',DELETED:'已删除',
    HIDE:'隐藏内容',TAKEDOWN:'下架内容',RESTORE:'恢复公开',
    WARNING:'警告',POST_LIMIT:'限制发帖',COMMENT_LIMIT:'限制评论',REACTION_LIMIT:'限制互动',BAN:'封禁账号',
    REVIEW_PASSED:'复核通过',REVIEW_REJECTED:'判定违规',
    CONTENT:'内容',ACCOUNT:'账号',REPORT:'举报',TAG:'标签',MODERATION_RULE:'审核规则',RATE_LIMIT:'频率限制',CRISIS_RESOURCE:'求助资源',
    REPORT_REVIEWER:'举报审核员',CONTENT_MODERATOR:'内容审核员',ACCOUNT_MODERATOR:'账号管理员',AUDITOR:'审计员',CONFIG_ADMIN:'配置管理员',ADMIN_CONSOLE:'运营后台'
  };
  const human=(value)=>labels[String(value||'').toUpperCase()]||labels[value]||value||'—';
  const shortId=(value)=>{const text=String(value||'');return text.length>18?text.slice(0,8)+'…'+text.slice(-6):text};
  const formatTime=(value)=>{if(!value)return '—';const d=new Date(value);return isNaN(d.getTime())?value:d.toLocaleString('zh-CN',{hour12:false})};
  function badge(text,kind){const span=document.createElement('span');span.className='badge'+(kind?' '+kind:'');span.textContent=text;return span}
  function cell(content,subtext){const td=document.createElement('td');const main=document.createElement('span');main.className='cell-main';main.textContent=content;td.appendChild(main);if(subtext){const sub=document.createElement('span');sub.className='cell-sub';sub.textContent=subtext;td.appendChild(sub)}return td}
  function dataTable(id,headers,rows){const box=$(id);box.textContent='';if(!rows.length){box.innerHTML='<div class="empty">暂无数据</div>';return}const wrap=document.createElement('div');wrap.className='data-table-wrap';const table=document.createElement('table');table.className='data-table';const thead=document.createElement('thead');const headRow=document.createElement('tr');headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;headRow.appendChild(th)});thead.appendChild(headRow);const tbody=document.createElement('tbody');rows.forEach(cells=>{const tr=document.createElement('tr');cells.forEach(value=>tr.appendChild(value instanceof HTMLElement?value:cell(String(value))));tbody.appendChild(tr)});table.append(thead,tbody);wrap.appendChild(table);box.appendChild(wrap)}
  function renderQueueTable(id,items,sourceLabel){dataTable(id,['事项来源','内容','关注标记','处理状态','提交时间','操作'],items.map(item=>{const source=human(item.source||sourceLabel);const reason=item.reason||item.reason_code;const sourceCell=cell(source,reason?human(reason):item.hit_rule_refs?'命中内容规则':'');const contentCell=cell(human(item.target_type),'编号 '+shortId(item.target_id||item.item_id)+' · 第 '+(item.content_version||1)+' 版');const attention=document.createElement('td');attention.appendChild(item.is_minor_related?badge('涉及未成年人','urgent'):badge('常规'));const status=document.createElement('td');status.appendChild(badge(human(item.status),item.status==='RESOLVED'?'ok':''));const action=document.createElement('td');const button=document.createElement('button');button.className='row-action';button.textContent='查看并处理';button.onclick=()=>{switchPanel('content');$('#content-type').value=item.target_type;$('#content-id').value=item.target_id;$('#content-version').value=item.content_version};action.appendChild(button);return [sourceCell,contentCell,attention,status,formatTime(item.submitted_at||item.queue_at),action]}))}
  function renderAuditTable(id,items){dataTable(id,['操作','操作人','处理对象','内容版本','处理原因','操作时间'],items.map(item=>[cell(human(item.action_type),shortId(item.id)),cell(item.actor_role?human(item.actor_role):'运营人员',shortId(item.actor_id)),cell(human(item.object_type),'编号 '+shortId(item.object_id)),item.content_version?('第 '+item.content_version+' 版'):'—',cell('处理原因',item.reason||'—'),formatTime(item.occurred_at)]))}
  function renderList(id,items,source){if(source==='审计')renderAuditTable(id,items);else renderQueueTable(id,items,source||'举报')}
  async function loadOverview(){try{setStatus('正在汇总运营数据…');const [feed,reports,queue]=await Promise.all([api('/feed?limit=50',{noAuth:true}),api('/admin/reports?limit=50'),api('/admin/review-queue?source=all&limit=50')]);$('#summary-posts').textContent=feed.data.length;$('#summary-reports').textContent=reports.data.length;$('#summary-queue').textContent=queue.data.length;$('#summary-minor').textContent=queue.data.filter(x=>x.is_minor_related||x.reason_code==='MINOR_INVOLVED').length;const pending=[...reports.data.map(x=>({...x,source:'用户举报'})),...queue.data].sort((a,b)=>(a.is_minor_related||a.reason_code==='MINOR_INVOLVED'?0:1)-(b.is_minor_related||b.reason_code==='MINOR_INVOLVED'?0:1)).slice(0,10);renderQueueTable('#overview-list',pending,'待办事项');setStatus('数据已更新')}catch(e){setStatus(e.message,true)}}
  async function loadReports(){try{setStatus('正在查询举报…');const p=new URLSearchParams({limit:'20'});if($('#report-status').value)p.set('status',$('#report-status').value);if($('#report-reason').value)p.set('reason',$('#report-reason').value);const r=await api('/admin/reports?'+p);renderList('#report-list',r.data,'用户举报');setStatus('共 '+r.data.length+' 条')}catch(e){setStatus(e.message,true)}}
  async function loadQueue(){try{setStatus('正在查询待复核内容…');const p=new URLSearchParams({source:$('#queue-source').value,limit:'20'});const r=await api('/admin/review-queue?'+p);renderList('#queue-list',r.data,'待复核');setStatus('共 '+r.data.length+' 条')}catch(e){setStatus(e.message,true)}}
  function selectContent(item){$('#content-type').value=item.target_type;$('#content-id').value=item.id;$('#content-version').value=item.content_version;$('#selected-content-label').textContent=human(item.target_type)+' · 编号 '+shortId(item.id)+' · 作者 '+item.author_nickname+' · 当前第 '+item.content_version+' 版';$('#content-form').scrollIntoView({behavior:'smooth',block:'center'});setStatus('已选择'+human(item.target_type)+'，请填写处理意见')}
  function renderContentTable(items){dataTable('#content-list',['内容','作者','版本','公开状态','审核状态','时间信息','举报数','操作'],items.map(item=>{const content=document.createElement('td');const main=document.createElement('span');main.className='cell-main';main.textContent=item.body_excerpt;const sub=document.createElement('span');sub.className='cell-sub';sub.textContent=human(item.target_type)+' · 编号 '+shortId(item.id);content.append(main,sub);const publicStatus=document.createElement('td');publicStatus.appendChild(badge(human(item.public_status),item.public_status==='HIDDEN'||item.public_status==='DELETED'?'urgent':item.public_status==='PUBLISHED'?'ok':''));const moderation=document.createElement('td');moderation.appendChild(badge(human(item.moderation_status),item.moderation_status==='REJECTED'?'urgent':item.moderation_status==='PASSED'?'ok':''));const action=document.createElement('td');const button=document.createElement('button');button.className='row-action';button.textContent='处理';button.onclick=()=>selectContent(item);action.appendChild(button);return [content,cell(item.author_nickname),'第 '+(item.content_version||1)+' 版',publicStatus,moderation,cell(item.expires_at?'到期':'发布',formatTime(item.expires_at||item.published_at)),String(item.report_count||0),action]}))}
  async function loadContent(more=false){try{setStatus(more?'正在加载更多内容…':'正在查询内容…');const p=new URLSearchParams({target_type:$('#content-filter-type').value,status:$('#content-filter-status').value,limit:'20'});const query=$('#content-query').value.trim();if(query)p.set('query',query);if(more&&contentCursor)p.set('cursor',contentCursor);const result=await api('/admin/content?'+p);contentItems=more?contentItems.concat(result.data):result.data;contentCursor=result.page.next_cursor||'';renderContentTable(contentItems);$('#load-more-content').classList.toggle('hidden',!result.page.has_more);setStatus('共显示 '+contentItems.length+' 条内容')}catch(e){setStatus(e.message,true)}}
  $('#load-content').onclick=()=>{contentCursor='';contentItems=[];loadContent(false)};
  $('#load-more-content').onclick=()=>loadContent(true);
  $('#login-form').onsubmit=async(event)=>{event.preventDefault();const username=$('#login-username').value.trim();const password=$('#login-password').value;if(!username||!password){setLoginError('请输入用户名和密码');return}try{setLoginError('');const result=await api('/admin/auth/login',{method:'POST',noAuth:true,body:{username,password}});state.token=result.data.access_token;$('#login-screen').classList.add('hidden');$('#app-shell').classList.remove('hidden');switchPanel('overview')}catch(e){setLoginError(e.message);state.token=''}};
  $('#logout-button').onclick=async()=>{try{if(state.token)await api('/auth/logout',{method:'POST'})}catch(e){}state.token='';$('#app-shell').classList.add('hidden');$('#login-screen').classList.remove('hidden');$('#login-password').value='';setStatus('')};
  $('#sidebar-nav').onclick=(event)=>{const b=event.target.closest('.nav-button');if(b)switchPanel(b.dataset.panel)};
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>switchPanel(b.dataset.jump));
  $('#load-reports').onclick=loadReports;$('#load-queue').onclick=loadQueue;
  $('#content-form').onsubmit=async(event)=>{event.preventDefault();try{setStatus('正在提交复核…');const type=$('#content-type').value,id=encodeURIComponent($('#content-id').value.trim());const r=await api('/admin/content/'+type+'/'+id+'/reviews',{method:'POST',idempotencyKey:key('admin.review'),body:{expected_content_version:Number($('#content-version').value),decision:$('#review-decision').value,reason:$('#content-reason').value.trim()}});setStatus('复核完成：'+human(r.data.moderation_status)+'，内容状态：'+human(r.data.public_status))}catch(e){setStatus(e.message,true)}};
  $('#submit-action').onclick=async()=>{try{const action=$('#content-action').value;if(!action)throw new Error('请选择后续处理方式');setStatus('正在执行内容处理…');const type=$('#content-type').value,id=encodeURIComponent($('#content-id').value.trim());const r=await api('/admin/content/'+type+'/'+id+'/actions',{method:'POST',idempotencyKey:key('admin.content.action'),body:{action,expected_content_version:Number($('#content-version').value),reason:$('#content-reason').value.trim()}});setStatus('处理完成：'+human(r.data.public_status_before)+' → '+human(r.data.public_status_after))}catch(e){setStatus(e.message,true)}};
  $('#account-form').onsubmit=async(event)=>{event.preventDefault();try{setStatus('正在提交账号处理…');const body={action:$('#account-action').value,reason:$('#account-reason').value.trim()};const expires=$('#account-expires').value.trim();if(expires)body.expires_at=new Date(expires).toISOString();const id=encodeURIComponent($('#account-user-id').value.trim());const r=await api('/admin/users/'+id+'/restrictions',{method:'POST',idempotencyKey:key('admin.user.restrict'),body});setStatus('处理完成：'+human(r.data.action))}catch(e){setStatus(e.message,true)}};
  $('#load-audit').onclick=async()=>{try{setStatus('正在查询审计…');const p=new URLSearchParams({limit:'20'});[['actor_id','#audit-actor'],['action_type','#audit-action'],['object_type','#audit-object-type'],['object_id','#audit-object-id']].forEach(([name,sel])=>{const v=$(sel).value.trim();if(v)p.set(name,v)});for(const [name,sel] of [['from','#audit-from'],['to','#audit-to']]){const v=$(sel).value;if(v)p.set(name,new Date(v).toISOString())}const r=await api('/admin/audit-logs?'+p);renderAuditTable('#audit-list',r.data);setStatus('共 '+r.data.length+' 条')}catch(e){setStatus(e.message,true)}};
})();
</script>
</body>
</html>`;
