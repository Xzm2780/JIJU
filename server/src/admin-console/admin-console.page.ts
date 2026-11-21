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
    input,select,textarea{min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);outline:none}input:focus,select:focus,textarea:focus{border-color:#b77d81;box-shadow:0 0 0 3px rgba(165,104,108,.12)}input[readonly]{background:#f8f3f1;color:var(--muted)}
    .login-button,.primary{border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:700;padding:10px 16px}.login-button{width:100%;padding:12px}.secondary{background:var(--accent-soft);color:#7c4c52}.danger{background:#f6e6e3;color:var(--danger)}
    .app-shell{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;padding:22px 16px;background:linear-gradient(180deg,#423637,#352c2d);color:#fff;display:flex;flex-direction:column}
    .brand{display:flex;align-items:center;gap:12px;padding:4px 8px 24px;border-bottom:1px solid rgba(255,255,255,.1)}.brand-mark{width:42px;height:42px;border-radius:13px;background:#a5686c;display:flex;align-items:center;justify-content:center;font-weight:800}.brand-name{font-size:17px;font-weight:750}.brand-sub{font-size:11px;color:var(--sidebar-muted)}
    .nav{display:flex;flex-direction:column;gap:7px;margin-top:22px}.nav-button{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border:0;border-radius:11px;background:transparent;color:#d9cdcd;text-align:left;font-weight:600}.nav-button:hover{background:rgba(255,255,255,.07)}.nav-button.active{background:#a5686c;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12)}.nav-icon{width:20px;text-align:center;font-size:18px}
    .workspace{min-width:0}.topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;min-height:72px;padding:12px 28px;border-bottom:1px solid var(--line);background:rgba(255,253,252,.94);backdrop-filter:blur(12px)}.topbar h2{margin:0;font-size:20px}.breadcrumb{margin-bottom:3px;color:#a08789;font-size:11px}.topbar-actions{display:flex;align-items:center;gap:12px}.operator{padding:7px 12px;border-radius:999px;background:#f5eeeb;color:#765d5f;font-size:12px}
    .workspace-tabs{position:sticky;top:72px;z-index:4;display:flex;min-height:46px;padding:7px 20px 0;border-bottom:1px solid var(--line);background:#f7f1ee;gap:6px;overflow:auto}.workspace-tab{display:flex;min-width:0;max-width:260px;border:1px solid transparent;border-radius:10px 10px 0 0;background:transparent;align-items:center}.workspace-tab.active{border-color:var(--line);border-bottom-color:var(--panel);background:var(--panel)}.workspace-tab-label{min-width:0;border:0;background:transparent;color:#746566;padding:8px 7px 9px 12px;font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.workspace-tab.active .workspace-tab-label{color:var(--accent)}.workspace-tab-close{width:25px;height:25px;margin-right:5px;border:0;border-radius:7px;background:transparent;color:#9a8586;font-size:16px;line-height:1}.workspace-tab-close:hover{background:#f1e0e2;color:#7c4c52}.process-host{min-height:calc(100vh - 118px);background:var(--bg)}.process-pane{display:none}.process-pane.active{display:block}.process-frame{display:block;width:100%;height:calc(100vh - 118px);border:0;background:var(--bg)}
    main{padding:26px}.panel{display:none}.panel.active{display:block}.page-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.page-head h3{margin:0 0 4px;font-size:19px}.page-head p{margin:0;color:var(--muted);font-size:13px}
    .toolbar{display:flex;align-items:end;gap:10px;margin-bottom:16px;flex-wrap:wrap;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}.field{display:flex;flex-direction:column;gap:6px;min-width:150px;flex:1}.field label{font-size:12px;color:var(--muted);font-weight:700}.wide{grid-column:1/-1}
    .summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}.summary-card{padding:18px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.summary-value{font-size:27px;font-weight:800;color:#7c4c52}.summary-label{font-size:12px;color:var(--muted)}
    .list{display:block}.data-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.data-table{width:100%;min-width:880px;border-collapse:collapse}.data-table th{padding:12px 14px;background:#f8f3f1;color:#756365;font-size:11px;font-weight:750;text-align:left;white-space:nowrap}.data-table td{padding:13px 14px;border-top:1px solid #efe5e2;color:#4b4142;font-size:12px;vertical-align:middle}.data-table tr:hover td{background:#fdf9f7}.cell-main{font-weight:650;color:var(--ink)}.cell-sub{display:block;margin-top:3px;color:var(--muted);font-size:10px;word-break:break-all}.badge{display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:999px;background:var(--accent-soft);color:#7c4c52;font-size:11px}.badge.urgent{background:#f4d6d2;color:#8c3f3f}.badge.ok{background:#e7efe8;color:#58705d}.badge.muted{background:#eee8e5;color:#806f70}.actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.row-action{border:0;border-radius:8px;background:var(--accent-soft);color:#7c4c52;padding:6px 10px;font-size:11px;font-weight:700;white-space:nowrap}.row-action:disabled{background:#eee8e5;color:#9d8e8f;cursor:not-allowed}.empty{padding:34px;color:var(--muted);text-align:center}.user-cell{display:flex;align-items:center;gap:10px;min-width:180px}.mini-avatar{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#c38c90,#a5686c);color:#fff;font-weight:800}.restriction-list{display:flex;flex-direction:column;gap:3px;color:#6f5b5d;font-size:11px}.restriction-empty{color:var(--muted)}
    .data-table td{overflow-wrap:anywhere;word-break:break-word}.cell-main{display:-webkit-box;max-width:420px;overflow:hidden;overflow-wrap:anywhere;text-overflow:ellipsis;word-break:break-word;-webkit-box-orient:vertical;-webkit-line-clamp:1}.cell-main.cell-clamp-2{max-width:460px;-webkit-line-clamp:2}.cell-sub{display:-webkit-box;max-width:460px;overflow:hidden;overflow-wrap:anywhere;text-overflow:ellipsis;word-break:break-word;-webkit-box-orient:vertical;-webkit-line-clamp:1}.user-cell>div{min-width:0;flex:1}.restriction-list span{overflow-wrap:anywhere;word-break:break-word}.page-head p,.status{overflow-wrap:anywhere;word-break:break-word}
    .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;padding:18px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}textarea{min-height:88px;resize:vertical}.status{min-height:22px;margin:0 0 14px;color:var(--muted);white-space:pre-wrap}.status.error{color:var(--danger)}.empty{padding:34px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);text-align:center}
    @media(max-width:900px){.app-shell{grid-template-columns:1fr}.sidebar{position:static;height:auto}.nav{flex-direction:row;overflow:auto}.summary-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:600px){main{padding:14px}.topbar{padding:10px 14px}.operator{display:none}.login-card{padding:26px}.summary-grid{grid-template-columns:1fr 1fr}.nav-button{padding:10px}.nav-icon{display:none}}
  </style>
</head>
<body>
  <section id="login-screen" class="login-screen">
    <form id="login-form" class="login-card">
      <div class="login-logo">J</div>
      <h1>情绪广场管理后台</h1>
      <div class="login-field"><label>用户名</label><input id="login-username" placeholder="admin" autocomplete="username"></div>
      <div class="login-field"><label>密码</label><input id="login-password" type="password" placeholder="请输入密码" autocomplete="current-password"></div>
      <button class="login-button" type="submit">登录后台</button>
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
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div><div class="breadcrumb">JIJU 运营管理 / <span id="breadcrumb-current">数据工作台</span></div><h2 id="page-title">数据工作台</h2></div>
        <div class="topbar-actions"><span id="operator-name" class="operator">运营后台</span><button id="logout-button" class="secondary">退出登录</button></div>
      </header>
      <div id="workspace-tabs" class="workspace-tabs"></div>
      <main>
        <div id="status" class="status"></div>

        <section class="panel active" id="panel-overview">
          <div class="page-head"><div><h3>运营概览</h3></div><button class="primary" data-jump="reports">进入举报管理</button></div>
          <div class="summary-grid">
            <div class="summary-card"><div class="summary-value" id="summary-posts">—</div><div class="summary-label">广场可见帖子</div></div>
            <div class="summary-card"><div class="summary-value" id="summary-reports">—</div><div class="summary-label">待处理举报</div></div>
            <div class="summary-card"><div class="summary-value" id="summary-queue">—</div><div class="summary-label">待复核内容</div></div>
          </div>
          <div class="page-head"><div><h3>待处理事项</h3></div></div>
          <div class="list" id="overview-list"></div>
        </section>

        <section class="panel" id="panel-reports">
          <div class="page-head"><div><h3>举报管理</h3></div></div>
          <div class="toolbar"><div class="field"><label>处理状态</label><select id="report-status"><option value="">待处理与处理中</option><option value="PENDING">待处理</option><option value="PROCESSING">处理中</option><option value="RESOLVED">已完成</option></select></div><div class="field"><label>举报原因</label><select id="report-reason"><option value="">全部原因</option><option value="ABUSE">辱骂与骚扰</option><option value="PRIVACY">隐私</option><option value="MINOR_INVOLVED">未成年人</option><option value="DANGEROUS_OR_INAPPROPRIATE">危险内容</option><option value="SPAM">垃圾信息</option><option value="OTHER">其他</option></select></div><button id="load-reports" class="primary">查询</button></div>
          <div class="list" id="report-list"></div>
        </section>

        <section class="panel" id="panel-queue">
          <div class="page-head"><div><h3>待复核内容</h3></div></div>
          <div class="toolbar"><div class="field"><label>事项来源</label><select id="queue-source"><option value="all">全部事项</option><option value="report">用户举报</option><option value="moderation">规则复核</option></select></div><button id="load-queue" class="primary">查询</button></div>
          <div class="list" id="queue-list"></div>
        </section>

        <section class="panel" id="panel-content">
          <div class="page-head"><div><h3>内容治理</h3></div></div>
          <div class="toolbar"><div class="field"><label>内容类型</label><select id="content-filter-type"><option value="POST">帖子</option><option value="COMMENT">评论</option></select></div><div class="field"><label>状态</label><select id="content-filter-status"><option value="ALL">全部状态</option><option value="ACTIVE">公开中</option><option value="PENDING_REVIEW">待复核</option><option value="HIDDEN">已隐藏/违规</option><option value="EXPIRED">已到期</option><option value="DELETED">已删除</option></select></div><div class="field"><label>关键词</label><input id="content-query" placeholder="搜索内容摘要或作者昵称"></div><button id="load-content" class="primary">查询内容</button><button id="load-more-content" class="secondary">加载更多</button></div>
          <div class="list" id="content-list"></div>
        </section>

        <section class="panel" id="panel-accounts">
          <div class="page-head"><div><h3>用户管理</h3></div></div>
          <div class="toolbar"><div class="field"><label>账号状态</label><select id="account-filter-status"><option value="ALL">全部状态</option><option value="ACTIVE">正常</option><option value="RESTRICTED">受限</option><option value="BANNED">已封禁</option><option value="DEACTIVATED">注销冷静期</option><option value="DELETED">已注销</option></select></div><div class="field"><label>查找用户</label><input id="account-query" placeholder="输入昵称"></div><button id="load-accounts" class="primary">查询用户</button><button id="load-more-accounts" class="secondary hidden">加载更多</button></div>
          <div class="list" id="account-list"></div>
        </section>

        <section class="panel" id="panel-audit">
          <div class="page-head"><div><h3>审计日志</h3></div></div>
          <div class="toolbar"><div class="field"><label>操作类型</label><input id="audit-action"></div><div class="field"><label>对象类型</label><input id="audit-object-type"></div><div class="field"><label>开始时间</label><input id="audit-from" type="datetime-local"></div><div class="field"><label>结束时间</label><input id="audit-to" type="datetime-local"></div><button id="load-audit" class="primary">查询</button></div>
          <div class="list" id="audit-list"></div>
        </section>
      </main>
      <section id="process-host" class="process-host hidden"></section>
    </section>
  </div>

<script>
(() => {
  const ADMIN_SESSION_KEY='jiju.admin-console.session.v1';
  const CONTENT_PROCESS_KEY='jiju.admin.content-process.v1';
  const ACCOUNT_PROCESS_KEY='jiju.admin.account-process.v1';
  const OPEN_TABS_KEY='jiju.admin.workspace-tabs.v1';
  const ACTIVE_TAB_KEY='jiju.admin.active-tab.v1';
  const state={token:'',expiresAt:'',user:null};
  let contentCursor='';
  let contentItems=[];
  let accountCursor='';
  let accountItems=[];
  let openTabs=[];
  let activeTabId='';
  const $=(s)=>document.querySelector(s);
  const titles={overview:'数据工作台',reports:'举报管理',queue:'待复核内容',content:'内容治理',accounts:'用户管理',audit:'审计日志'};
  const setStatus=(text,error=false)=>{const el=$('#status');el.textContent=text||'';el.title=text||'';el.className='status'+(error?' error':'')};
  const setLoginError=(text)=>{$('#login-error').textContent=text||''};
  async function api(path,options={}){
    const authHeader=options.noAuth?{}:{authorization:'Bearer '+state.token};
    const response=await fetch('/api/v1'+path,{method:options.method||'GET',headers:{accept:'application/json',...authHeader,...(options.body?{'content-type':'application/json'}:{}),...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})},body:options.body?JSON.stringify(options.body):undefined});
    const text=await response.text();const body=text?JSON.parse(text):null;
    if(!response.ok){const error=new Error(body&&body.message?body.message:(response.status>=500?'服务暂时不可用，请稍后重试':'操作失败，请稍后重试'));error.statusCode=response.status;error.code=body&&body.code;if(response.status===401&&!options.noAuth){clearAdminSession();showLoginScreen('登录状态已失效，请重新登录')}throw error}
    return body;
  }
  function uuidV7(){const b=crypto.getRandomValues(new Uint8Array(16));let t=BigInt(Date.now());for(let i=5;i>=0;i--){b[i]=Number(t&255n);t>>=8n}b[6]=(b[6]&15)|112;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}
  const key=(operation)=>'v1:'+operation+':'+uuidV7();
  function panelTab(name){return{id:'panel:'+name,kind:'panel',name,title:titles[name],closable:name!=='overview'}}
  function persistWorkspace(){try{sessionStorage.setItem(OPEN_TABS_KEY,JSON.stringify(openTabs));sessionStorage.setItem(ACTIVE_TAB_KEY,activeTabId)}catch(error){}}
  function renderWorkspaceTabs(){const box=$('#workspace-tabs');box.textContent='';openTabs.forEach(tab=>{const wrapper=document.createElement('div');wrapper.className='workspace-tab'+(tab.id===activeTabId?' active':'');const label=document.createElement('button');label.className='workspace-tab-label';label.textContent=tab.title;label.onclick=()=>activateWorkspaceTab(tab.id);wrapper.appendChild(label);if(tab.closable){const close=document.createElement('button');close.className='workspace-tab-close';close.textContent='×';close.title='关闭标签页';close.onclick=(event)=>{event.stopPropagation();closeWorkspaceTab(tab.id)};wrapper.appendChild(close)}box.appendChild(wrapper)})}
  function ensureProcessPane(tab){const host=$('#process-host');let pane=host.querySelector('[data-process-id="'+tab.id+'"]');if(!pane){pane=document.createElement('div');pane.className='process-pane';pane.dataset.processId=tab.id;const frame=document.createElement('iframe');frame.className='process-frame';frame.title=tab.title;frame.src=tab.href;frame.setAttribute('loading','eager');pane.appendChild(frame);host.appendChild(pane)}return pane}
  function loadPanel(name){if(name==='overview')loadOverview();if(name==='reports')loadReports();if(name==='queue')loadQueue();if(name==='content')loadContent();if(name==='accounts')loadAccounts()}
  function activateWorkspaceTab(id,persist=true){const tab=openTabs.find(item=>item.id===id);if(!tab)return;activeTabId=id;renderWorkspaceTabs();const host=$('#process-host');if(tab.kind==='panel'){host.classList.add('hidden');document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',panel.id==='panel-'+tab.name));document.querySelectorAll('.nav-button').forEach(button=>button.classList.toggle('active',button.dataset.panel===tab.name));loadPanel(tab.name)}else{host.classList.remove('hidden');document.querySelectorAll('.panel').forEach(panel=>panel.classList.remove('active'));document.querySelectorAll('.process-pane').forEach(pane=>pane.classList.toggle('active',pane.dataset.processId===tab.id));ensureProcessPane(tab).classList.add('active');document.querySelectorAll('.nav-button').forEach(button=>button.classList.toggle('active',button.dataset.panel===tab.section))}$('#page-title').textContent=tab.title;$('#breadcrumb-current').textContent=tab.title;if(persist)persistWorkspace()}
  function closeWorkspaceTab(id){const index=openTabs.findIndex(tab=>tab.id===id);if(index<0||!openTabs[index].closable)return;openTabs.splice(index,1);const pane=$('#process-host').querySelector('[data-process-id="'+id+'"]');if(pane)pane.remove();if(activeTabId===id){const next=openTabs[Math.max(0,index-1)]||openTabs[0]||panelTab('overview');if(!openTabs.length)openTabs.push(panelTab('overview'));activeTabId=next.id;activateWorkspaceTab(activeTabId)}else{renderWorkspaceTabs();persistWorkspace()}}
  function openPanelTab(name){const id='panel:'+name;if(!openTabs.some(tab=>tab.id===id))openTabs.push(panelTab(name));activateWorkspaceTab(id)}
  function openProcessTab(kind,id,title,href,section){const tabId='process:'+kind+':'+id;const existing=openTabs.find(tab=>tab.id===tabId);if(existing){existing.href=href;existing.title=title;activateWorkspaceTab(tabId);return}openTabs.push({id:tabId,kind:'process',title,closable:true,href,section});activateWorkspaceTab(tabId)}
  function restoreWorkspaceTabs(){try{const saved=JSON.parse(sessionStorage.getItem(OPEN_TABS_KEY)||'[]');openTabs=Array.isArray(saved)?saved.filter(tab=>tab&&tab.id&&tab.kind&&(tab.kind==='process'||(tab.kind==='panel'&&titles[tab.name]))):[]}catch(error){openTabs=[]}if(!openTabs.length)openTabs=[panelTab('overview')];if(!openTabs.some(tab=>tab.id==='panel:overview'))openTabs.unshift(panelTab('overview'));const savedActive=sessionStorage.getItem(ACTIVE_TAB_KEY)||'';activeTabId=openTabs.some(tab=>tab.id===savedActive)?savedActive:openTabs[0].id;activateWorkspaceTab(activeTabId,false)}
  function openContentProcess(item){const type=item.target_type||'POST';const id=item.target_id||item.id;if(!id)return;try{sessionStorage.setItem(CONTENT_PROCESS_KEY,JSON.stringify({...item,target_type:type,target_id:id}))}catch(error){}const title='内容处理 · '+(item.author_nickname||human(type));const href='/api/v1/admin-console/process?kind=content&type='+encodeURIComponent(type)+'&id='+encodeURIComponent(id);openProcessTab('content',id,title,href,'content')}
  function openAccountProcess(item){if(!item.id)return;try{sessionStorage.setItem(ACCOUNT_PROCESS_KEY,JSON.stringify(item))}catch(error){}const title='账号处理 · '+(item.plaza_nickname||'用户');const href='/api/v1/admin-console/process?kind=account&id='+encodeURIComponent(item.id);openProcessTab('account',item.id,title,href,'accounts')}
  function clearAdminSession(removeStored=true){state.token='';state.expiresAt='';state.user=null;openTabs=[];activeTabId='';if(removeStored){try{for(const storageKey of [ADMIN_SESSION_KEY,OPEN_TABS_KEY,ACTIVE_TAB_KEY,CONTENT_PROCESS_KEY,ACCOUNT_PROCESS_KEY])sessionStorage.removeItem(storageKey)}catch(error){}}}
  function saveAdminSession(data){state.token=data.access_token;state.expiresAt=data.expires_at;state.user=data.user;try{sessionStorage.setItem(ADMIN_SESSION_KEY,JSON.stringify({accessToken:data.access_token,expiresAt:data.expires_at,user:data.user}))}catch(error){}}
  function showLoginScreen(message=''){$('#app-shell').classList.add('hidden');$('#login-screen').classList.remove('hidden');setLoginError(message);$('#login-password').value=''}
  function showAdminApp(){$('#login-screen').classList.add('hidden');$('#app-shell').classList.remove('hidden');$('#operator-name').textContent=state.user&&state.user.display_name?state.user.display_name+' · 运营账号':'运营后台';restoreWorkspaceTabs()}
  function restoreAdminSession(){try{const raw=sessionStorage.getItem(ADMIN_SESSION_KEY);if(!raw)return false;const saved=JSON.parse(raw);const expiresAt=Date.parse(saved.expiresAt);if(!saved.accessToken||!Number.isFinite(expiresAt)||expiresAt<=Date.now()+5000||!saved.user){clearAdminSession();return false}state.token=saved.accessToken;state.expiresAt=saved.expiresAt;state.user=saved.user;showAdminApp();return true}catch(error){clearAdminSession();return false}}
  function switchPanel(name){openPanelTab(name)}
  const labels={
    POST:'帖子',COMMENT:'评论',
    ABUSE:'辱骂与骚扰',PRIVACY:'隐私',MINOR_INVOLVED:'未成年人',DANGEROUS_OR_INAPPROPRIATE:'危险内容',SPAM:'垃圾信息',OTHER:'其他',
    PREEMPTIVE:'优先处理',NORMAL:'普通',
    PENDING:'待处理',PROCESSING:'处理中',RESOLVED:'已完成',
    report:'用户举报',moderation:'规则复核',
    PASSED:'已通过',REJECTED:'已判定违规',
    PUBLISHED:'公开中',HIDDEN:'已隐藏',EXPIRED:'已到期',DELETED:'已删除',
    ACTIVE:'正常',RESTRICTED:'受限',DEACTIVATED:'注销冷静期',BANNED:'已封禁',
    HIDE:'隐藏内容',TAKEDOWN:'下架内容',RESTORE:'恢复公开',
    WARNING:'警告',POST_LIMIT:'限制发帖',COMMENT_LIMIT:'限制评论',REACTION_LIMIT:'限制互动',BAN:'封禁账号',
    RESTRICTED:'受限',DEACTIVATED:'注销冷静期',BANNED:'已封禁',USER_ACTIVE:'正常',USER_DELETED:'已注销',
    REVIEW_PASSED:'复核通过',REVIEW_REJECTED:'判定违规',
    CONTENT:'内容',ACCOUNT:'账号',REPORT:'举报',TAG:'标签',MODERATION_RULE:'审核规则',RATE_LIMIT:'频率限制',CRISIS_RESOURCE:'求助资源',
    REPORT_REVIEWER:'举报审核员',CONTENT_MODERATOR:'内容审核员',ACCOUNT_MODERATOR:'账号管理员',AUDITOR:'审计员',CONFIG_ADMIN:'配置管理员',ADMIN_CONSOLE:'运营后台'
  };
  const human=(value)=>labels[String(value||'').toUpperCase()]||labels[value]||value||'—';
  const userStatus=(item)=>item.account_status==='UNDEFINED'?'—':item.account_status==='ACTIVE'?labels.USER_ACTIVE:item.account_status==='DELETED'?labels.USER_DELETED:human(item.account_status);
  const formatTime=(value)=>{if(!value)return '—';const d=new Date(value);return isNaN(d.getTime())?value:d.toLocaleString('zh-CN',{hour12:false})};
  function badge(text,kind){const span=document.createElement('span');span.className='badge'+(kind?' '+kind:'');span.textContent=text;return span}
  function cell(content,subtext){const td=document.createElement('td');const mainText=String(content);const main=document.createElement('span');main.className='cell-main';main.textContent=mainText;main.title=mainText;td.appendChild(main);if(subtext){const subText=String(subtext);const sub=document.createElement('span');sub.className='cell-sub';sub.textContent=subText;sub.title=subText;td.appendChild(sub)}return td}
  function dataTable(id,headers,rows){const box=$(id);box.textContent='';if(!rows.length){box.innerHTML='<div class="empty">暂无数据</div>';return}const wrap=document.createElement('div');wrap.className='data-table-wrap';const table=document.createElement('table');table.className='data-table';const thead=document.createElement('thead');const headRow=document.createElement('tr');headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;headRow.appendChild(th)});thead.appendChild(headRow);const tbody=document.createElement('tbody');rows.forEach(cells=>{const tr=document.createElement('tr');cells.forEach(value=>tr.appendChild(value instanceof HTMLElement?value:cell(String(value))));tbody.appendChild(tr)});table.append(thead,tbody);wrap.appendChild(table);box.appendChild(wrap)}
  function renderQueueTable(id,items,sourceLabel){dataTable(id,['来源','原因','内容','状态','时间','操作'],items.map(item=>{const source=human(item.source||sourceLabel);const reason=item.reason||item.reason_code;const sourceCell=cell(source);const reasonCell=document.createElement('td');reasonCell.appendChild(badge(reason?human(reason):'规则复核'));const contentCell=cell(human(item.target_type));const status=document.createElement('td');status.appendChild(badge(human(item.status),item.status==='RESOLVED'?'ok':''));const action=document.createElement('td');const button=document.createElement('button');button.className='row-action';button.textContent='处理';button.onclick=()=>openContentProcess({...item,source:item.source||sourceLabel});action.appendChild(button);return [sourceCell,reasonCell,contentCell,status,formatTime(item.submitted_at||item.queue_at),action]}))}
  function renderAuditTable(id,items){dataTable(id,['操作','操作人','对象','版本','原因','时间'],items.map(item=>[cell(human(item.action_type)),cell(item.actor_role?human(item.actor_role):'运营人员'),cell(human(item.object_type)),item.content_version?('v'+item.content_version):'—',cell(item.reason||'—'),formatTime(item.occurred_at)]))}
  function renderList(id,items,source){if(source==='审计')renderAuditTable(id,items);else renderQueueTable(id,items,source||'举报')}
  async function loadOverview(){try{setStatus('正在汇总运营数据…');const [feed,reports,queue]=await Promise.all([api('/feed?limit=50',{noAuth:true}),api('/admin/reports?limit=50'),api('/admin/review-queue?source=all&limit=50')]);$('#summary-posts').textContent=feed.data.length;$('#summary-reports').textContent=reports.data.length;$('#summary-queue').textContent=queue.data.length;const pending=[...reports.data.map(x=>({...x,source:'用户举报'})),...queue.data].slice(0,10);renderQueueTable('#overview-list',pending,'待办事项');setStatus('数据已更新')}catch(e){setStatus(e.message,true)}}
  async function loadReports(){try{setStatus('正在查询举报…');const p=new URLSearchParams({limit:'20'});if($('#report-status').value)p.set('status',$('#report-status').value);if($('#report-reason').value)p.set('reason',$('#report-reason').value);const r=await api('/admin/reports?'+p);renderList('#report-list',r.data,'用户举报');setStatus('共 '+r.data.length+' 条')}catch(e){setStatus(e.message,true)}}
  async function loadQueue(){try{setStatus('正在查询待复核内容…');const p=new URLSearchParams({source:$('#queue-source').value,limit:'20'});const r=await api('/admin/review-queue?'+p);renderList('#queue-list',r.data,'待复核');setStatus('共 '+r.data.length+' 条')}catch(e){setStatus(e.message,true)}}
  function renderContentTable(items){dataTable('#content-list',['内容','作者','版本','公开状态','审核状态','时间信息','举报数','操作'],items.map(item=>{const content=document.createElement('td');const main=document.createElement('span');main.className='cell-main cell-clamp-2';main.textContent=item.body_excerpt;main.title=item.body_excerpt;content.appendChild(main);const publicStatus=document.createElement('td');publicStatus.appendChild(badge(human(item.public_status),item.public_status==='HIDDEN'||item.public_status==='DELETED'?'urgent':item.public_status==='PUBLISHED'?'ok':''));const moderation=document.createElement('td');moderation.appendChild(badge(human(item.moderation_status),item.moderation_status==='REJECTED'?'urgent':item.moderation_status==='PASSED'?'ok':''));const action=document.createElement('td');const button=document.createElement('button');button.className='row-action';button.textContent='处理';button.onclick=()=>openContentProcess(item);action.appendChild(button);return [content,cell(item.author_nickname),'第 '+(item.content_version||1)+' 版',publicStatus,moderation,cell(item.expires_at?'到期':'发布',formatTime(item.expires_at||item.published_at)),String(item.report_count||0),action]}))}
  async function loadContent(more=false){try{setStatus(more?'正在加载更多内容…':'正在查询内容…');const p=new URLSearchParams({target_type:$('#content-filter-type').value,status:$('#content-filter-status').value,limit:'20'});const query=$('#content-query').value.trim();if(query)p.set('query',query);if(more&&contentCursor)p.set('cursor',contentCursor);const result=await api('/admin/content?'+p);contentItems=more?contentItems.concat(result.data):result.data;contentCursor=result.page.next_cursor||'';renderContentTable(contentItems);$('#load-more-content').classList.toggle('hidden',!result.page.has_more);setStatus('共显示 '+contentItems.length+' 条内容')}catch(e){setStatus(e.message,true)}}
  function userAvatar(item){const avatar=document.createElement('span');avatar.className='mini-avatar';avatar.textContent=Array.from(item.plaza_nickname||'用')[0]||'用';return avatar}
  function activeRestrictions(item){const now=Date.now();const rows=[];if(item.posting_restricted_until&&new Date(item.posting_restricted_until).getTime()>now)rows.push('发帖限制至 '+formatTime(item.posting_restricted_until));if(item.commenting_restricted_until&&new Date(item.commenting_restricted_until).getTime()>now)rows.push('评论限制至 '+formatTime(item.commenting_restricted_until));if(item.reaction_restricted_until&&new Date(item.reaction_restricted_until).getTime()>now)rows.push('互动限制至 '+formatTime(item.reaction_restricted_until));return rows}
  function renderAccountsTable(items){dataTable('#account-list',['用户','账号状态','内容数据','当前限制','加入时间','操作'],items.map(item=>{const user=document.createElement('td');const userWrap=document.createElement('div');userWrap.className='user-cell';const details=document.createElement('div');const name=document.createElement('span');name.className='cell-main';name.textContent=item.plaza_nickname;name.title=item.plaza_nickname;details.appendChild(name);userWrap.append(userAvatar(item),details);user.appendChild(userWrap);const accountStatus=document.createElement('td');const statusKind=item.account_status==='ACTIVE'?'ok':item.account_status==='RESTRICTED'?'urgent':'muted';accountStatus.appendChild(badge(userStatus(item),statusKind));const content=cell('帖子 '+item.post_count+' · 回应 '+item.comment_count);const restrictions=document.createElement('td');const restrictionWrap=document.createElement('div');restrictionWrap.className='restriction-list';const restrictionLabels=activeRestrictions(item);if(restrictionLabels.length){restrictionLabels.forEach(text=>{const line=document.createElement('span');line.textContent=text;restrictionWrap.appendChild(line)})}else{const none=document.createElement('span');none.className='restriction-empty';none.textContent='无进行中的限制';restrictionWrap.appendChild(none)}restrictions.appendChild(restrictionWrap);const action=document.createElement('td');const button=document.createElement('button');button.className='row-action';const blocked=item.account_status==='DEACTIVATED'||item.account_status==='DELETED';button.textContent=blocked?'不可处理':'处理';button.disabled=blocked;button.title=blocked?'该账号已停用，不能执行运营处置':'处理账号';if(!blocked)button.onclick=()=>openAccountProcess(item);action.appendChild(button);return [user,accountStatus,content,restrictions,formatTime(item.created_at),action]}))}
  async function loadAccounts(more=false){try{setStatus(more?'正在加载更多用户…':'正在查询用户…');const p=new URLSearchParams({status:$('#account-filter-status').value,limit:'20'});const query=$('#account-query').value.trim();if(query)p.set('query',query);if(more&&accountCursor)p.set('cursor',accountCursor);const result=await api('/admin/users?'+p);accountItems=more?accountItems.concat(result.data):result.data;accountCursor=result.page.next_cursor||'';renderAccountsTable(accountItems);$('#load-more-accounts').classList.toggle('hidden',!result.page.has_more);setStatus('共显示 '+accountItems.length+' 个用户')}catch(e){setStatus(e.message,true)}}
  $('#load-content').onclick=()=>{contentCursor='';contentItems=[];loadContent(false)};
  $('#load-more-content').onclick=()=>loadContent(true);
  $('#load-accounts').onclick=()=>{accountCursor='';accountItems=[];loadAccounts(false)};
  $('#load-more-accounts').onclick=()=>loadAccounts(true);
  $('#login-form').onsubmit=async(event)=>{event.preventDefault();const username=$('#login-username').value.trim();const password=$('#login-password').value;if(!username||!password){setLoginError('请输入用户名和密码');return}try{setLoginError('');const result=await api('/admin/auth/login',{method:'POST',noAuth:true,body:{username,password}});saveAdminSession(result.data);showAdminApp()}catch(e){clearAdminSession();setLoginError(e.message)}};
  $('#logout-button').onclick=async()=>{try{if(state.token)await api('/auth/logout',{method:'POST'})}catch(e){}clearAdminSession();showLoginScreen();setStatus('')};
  $('#sidebar-nav').onclick=(event)=>{const b=event.target.closest('.nav-button');if(b)switchPanel(b.dataset.panel)};
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>switchPanel(b.dataset.jump));
  $('#load-reports').onclick=loadReports;$('#load-queue').onclick=loadQueue;
  $('#load-audit').onclick=async()=>{try{setStatus('正在查询审计…');const p=new URLSearchParams({limit:'20'});[['action_type','#audit-action'],['object_type','#audit-object-type']].forEach(([name,sel])=>{const v=$(sel).value.trim();if(v)p.set(name,v)});for(const [name,sel] of [['from','#audit-from'],['to','#audit-to']]){const v=$(sel).value;if(v)p.set(name,new Date(v).toISOString())}const r=await api('/admin/audit-logs?'+p);renderAuditTable('#audit-list',r.data);setStatus('共 '+r.data.length+' 条')}catch(e){setStatus(e.message,true)}};
  if(!restoreAdminSession())showLoginScreen();
})();
</script>
</body>
</html>`;
