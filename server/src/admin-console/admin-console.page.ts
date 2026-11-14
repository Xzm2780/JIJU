export const ADMIN_CONSOLE_HTML = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>JIJU 运营后台</title>
  <style>
    :root{--bg:#f5f0ee;--card:#fffcfb;--ink:#30292a;--muted:#816f70;--accent:#a5686c;--line:#e5d8d5;--danger:#8e4d4d}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#fbf7f4,#f5f0ee);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
    header{position:sticky;top:0;z-index:2;padding:18px 24px;background:rgba(255,252,251,.96);border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:22px}.sub{color:var(--muted);font-size:12px}.auth{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
    input,select,textarea,button{font:inherit}input,select,textarea{min-width:0;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:#fffdfc;color:var(--ink)}
    input[type=password]{min-width:280px}button{padding:9px 14px;border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:650;cursor:pointer}
    button.secondary{background:#f1e0e2;color:#7c4c52}button.danger{background:#f5e3e0;color:var(--danger)}
    main{max-width:1180px;margin:0 auto;padding:24px}.tabs{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}.tab{background:#ebe0dd;color:#6e5d5e}.tab.active{background:var(--accent);color:#fff}
    .panel{display:none}.panel.active{display:block}.toolbar{display:flex;align-items:end;gap:10px;margin-bottom:14px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:5px;min-width:150px;flex:1}.field label{color:var(--muted);font-size:12px}
    .list{display:grid;gap:12px}.item{padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.item-head{display:flex;justify-content:space-between;gap:12px;align-items:start}
    .item h3{margin:0;font-size:15px}.meta{color:var(--muted);font-size:12px;word-break:break-all}.badge{display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:999px;background:#f1e0e2;color:#7c4c52;font-size:11px}
    .badge.urgent{background:#f5d8d4;color:#873f3f}.actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:16px;background:var(--card);border:1px solid var(--line);border-radius:14px}
    .wide{grid-column:1/-1}textarea{min-height:78px;resize:vertical}.status{min-height:22px;color:var(--muted);margin:12px 0;white-space:pre-wrap}.error{color:var(--danger)}
    code{font-size:11px}@media(max-width:640px){main{padding:14px}input[type=password]{min-width:0;width:100%}.auth{flex-direction:column}.auth input,.auth button{width:100%}}
  </style>
</head>
<body>
<header>
  <h1>JIJU 运营后台</h1>
  <div class="sub">使用独立后台身份令牌。所有治理动作由服务端鉴权并留痕。</div>
  <div class="auth">
    <input id="base-url" value="/api/v1" aria-label="API 根路径">
    <input id="token" type="password" placeholder="Admin bearer token" aria-label="后台令牌">
    <button id="save-auth">保存连接</button>
  </div>
</header>
<main>
  <nav class="tabs" id="tabs">
    <button class="tab active" data-panel="reports">举报队列</button>
    <button class="tab" data-panel="queue">统一复核队列</button>
    <button class="tab" data-panel="content">内容复核与治理</button>
    <button class="tab" data-panel="accounts">账号限制</button>
    <button class="tab" data-panel="audit">审计查询</button>
  </nav>
  <div id="status" class="status"></div>

  <section class="panel active" id="panel-reports">
    <div class="toolbar">
      <div class="field"><label>状态</label><select id="report-status"><option value="">处理中队列</option><option>PENDING</option><option>PROCESSING</option><option>RESOLVED</option></select></div>
      <div class="field"><label>优先级</label><select id="report-priority"><option value="">全部</option><option>PREEMPTIVE</option><option>NORMAL</option></select></div>
      <div class="field"><label>原因</label><select id="report-reason"><option value="">全部</option><option>ABUSE</option><option>PRIVACY</option><option>MINOR_INVOLVED</option><option>DANGEROUS_OR_INAPPROPRIATE</option><option>SPAM</option><option>OTHER</option></select></div>
      <button id="load-reports">查询</button>
    </div>
    <div class="list" id="report-list"></div>
  </section>

  <section class="panel" id="panel-queue">
    <div class="toolbar">
      <div class="field"><label>来源</label><select id="queue-source"><option>all</option><option>report</option><option>moderation</option></select></div>
      <div class="field"><label>优先级</label><select id="queue-priority"><option value="">全部</option><option>PREEMPTIVE</option><option>NORMAL</option></select></div>
      <button id="load-queue">查询</button>
    </div>
    <div class="list" id="queue-list"></div>
  </section>

  <section class="panel" id="panel-content">
    <form class="form-grid" id="content-form">
      <div class="field"><label>目标类型</label><select id="content-type"><option>POST</option><option>COMMENT</option></select></div>
      <div class="field"><label>目标 ID</label><input id="content-id" required></div>
      <div class="field"><label>内容版本</label><input id="content-version" type="number" min="1" required></div>
      <div class="field"><label>复核结论</label><select id="review-decision"><option>PASSED</option><option>REJECTED</option></select></div>
      <div class="field"><label>治理动作</label><select id="content-action"><option value="">不执行治理</option><option>HIDE</option><option>TAKEDOWN</option><option>RESTORE</option></select></div>
      <div class="field wide"><label>原因</label><textarea id="content-reason" required></textarea></div>
      <div class="actions wide"><button type="submit">提交复核</button><button type="button" class="danger" id="submit-action">执行治理动作</button></div>
    </form>
  </section>

  <section class="panel" id="panel-accounts">
    <form class="form-grid" id="account-form">
      <div class="field"><label>账号 ID</label><input id="account-user-id" required></div>
      <div class="field"><label>动作</label><select id="account-action"><option>WARNING</option><option>POST_LIMIT</option><option>COMMENT_LIMIT</option><option>REACTION_LIMIT</option><option>BAN</option></select></div>
      <div class="field"><label>结束时间 UTC</label><input id="account-expires" placeholder="2026-11-20T00:00:00Z"></div>
      <div class="field wide"><label>原因</label><textarea id="account-reason" required></textarea></div>
      <div class="actions wide"><button type="submit">提交账号处置</button></div>
    </form>
  </section>

  <section class="panel" id="panel-audit">
    <div class="toolbar">
      <div class="field"><label>账号 ID</label><input id="audit-actor"></div>
      <div class="field"><label>动作</label><input id="audit-action"></div>
      <div class="field"><label>对象类型</label><input id="audit-object-type"></div>
      <div class="field"><label>对象 ID</label><input id="audit-object-id"></div>
      <div class="field"><label>开始 UTC</label><input id="audit-from" placeholder="2026-11-01T00:00:00Z"></div>
      <div class="field"><label>结束 UTC</label><input id="audit-to" placeholder="2026-12-01T00:00:00Z"></div>
      <button id="load-audit">查询</button>
    </div>
    <div class="list" id="audit-list"></div>
  </section>
</main>
<script>
(() => {
  const state = {token: sessionStorage.getItem('jiju.admin.token') || '', base: sessionStorage.getItem('jiju.admin.base') || '/api/v1'};
  const q = (s) => document.querySelector(s);
  const status = (text, error) => { const el=q('#status'); el.textContent=text || ''; el.className='status'+(error?' error':''); };
  q('#base-url').value = state.base; q('#token').value = state.token;
  q('#save-auth').onclick = () => { state.base=q('#base-url').value.trim().replace(/\/$/,''); state.token=q('#token').value.trim(); sessionStorage.setItem('jiju.admin.base',state.base); sessionStorage.setItem('jiju.admin.token',state.token); status('连接信息已保存'); };
  async function api(path, options={}) {
    if (!state.token) throw new Error('请先填写后台令牌');
    const response = await fetch(state.base + path, {method:options.method||'GET', headers:{'accept':'application/json',...(options.body?{'content-type':'application/json'}:{}),authorization:'Bearer '+state.token,...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})}, body:options.body?JSON.stringify(options.body):undefined});
    const text = await response.text(); const body = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error((body && body.code ? body.code+': ' : '') + (body && body.message ? body.message : response.status));
    return body;
  }
  function uuidV7(){const b=crypto.getRandomValues(new Uint8Array(16));let t=BigInt(Date.now());for(let i=5;i>=0;i--){b[i]=Number(t&255n);t>>=8n}b[6]=(b[6]&15)|112;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}
  const key = (operation) => 'v1:'+operation+':'+uuidV7();
  function card(item, mode) {
    const el=document.createElement('article');el.className='item';
    const head=document.createElement('div');head.className='item-head';
    const title=document.createElement('h3');title.textContent=(item.source||'report')+' · '+item.target_type+' · '+(item.id||item.item_id);
    const badges=document.createElement('div');
    [item.priority,item.status,item.is_minor_related?'未成年人优先':''].filter(Boolean).forEach(x=>{const b=document.createElement('span');b.className='badge'+(x==='未成年人优先'?' urgent':'');b.textContent=x;badges.appendChild(b)});
    head.append(title,badges);
    const meta=document.createElement('div');meta.className='meta';meta.textContent='目标 '+item.target_id+' · 版本 '+item.content_version+' · 入队 '+(item.submitted_at||item.queue_at||'')+(item.reason?' · '+item.reason:'')+(item.other_description?' · 说明：'+item.other_description:'');
    el.append(head,meta);
    if(mode==='review'){const actions=document.createElement('div');actions.className='actions';const use=document.createElement('button');use.className='secondary';use.textContent='带入复核表单';use.onclick=()=>{q('#content-type').value=item.target_type;q('#content-id').value=item.target_id;q('#content-version').value=item.content_version;switchPanel('content')};actions.appendChild(use);el.appendChild(actions)}
    return el;
  }
  function list(id,items,mode){const box=q(id);box.textContent='';if(!items.length){box.textContent='没有符合条件的数据';return}items.forEach(x=>box.appendChild(card(x,mode)))}
  function switchPanel(name){document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id==='panel-'+name));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.panel===name))}
  q('#tabs').onclick=(event)=>{const b=event.target.closest('.tab');if(b)switchPanel(b.dataset.panel)};
  q('#load-reports').onclick=async()=>{try{status('查询举报队列…');const p=new URLSearchParams({limit:'20'});if(q('#report-status').value)p.set('status',q('#report-status').value);if(q('#report-priority').value)p.set('priority',q('#report-priority').value);if(q('#report-reason').value)p.set('reason',q('#report-reason').value);const r=await api('/admin/reports?'+p);list('#report-list',r.data,'reports');status('共 '+r.data.length+' 条')}catch(e){status(e.message,true)}};
  q('#load-queue').onclick=async()=>{try{status('查询统一队列…');const p=new URLSearchParams({source:q('#queue-source').value,limit:'20'});if(q('#queue-priority').value)p.set('priority',q('#queue-priority').value);const r=await api('/admin/review-queue?'+p);list('#queue-list',r.data,'review');status('共 '+r.data.length+' 条')}catch(e){status(e.message,true)}};
  q('#content-form').onsubmit=async(event)=>{event.preventDefault();try{const type=q('#content-type').value,id=encodeURIComponent(q('#content-id').value.trim());const body={expected_content_version:Number(q('#content-version').value),decision:q('#review-decision').value,reason:q('#content-reason').value.trim()};status('提交复核…');const r=await api('/admin/content/'+type+'/'+id+'/reviews',{method:'POST',idempotencyKey:key('admin.review'),body});status('复核完成：'+r.data.moderation_status+' / '+r.data.public_status)}catch(e){status(e.message,true)}};
  q('#submit-action').onclick=async()=>{try{const action=q('#content-action').value;if(!action)throw new Error('请选择治理动作');const type=q('#content-type').value,id=encodeURIComponent(q('#content-id').value.trim());const body={action,expected_content_version:Number(q('#content-version').value),reason:q('#content-reason').value.trim()};status('执行治理动作…');const r=await api('/admin/content/'+type+'/'+id+'/actions',{method:'POST',idempotencyKey:key('admin.content.action'),body});status('治理完成：'+r.data.public_status_before+' → '+r.data.public_status_after+'，到期时间未延长')}catch(e){status(e.message,true)}};
  q('#account-form').onsubmit=async(event)=>{event.preventDefault();try{const body={action:q('#account-action').value,reason:q('#account-reason').value.trim()};const expires=q('#account-expires').value.trim();if(expires)body.expires_at=expires;status('提交账号处置…');const id=encodeURIComponent(q('#account-user-id').value.trim());const r=await api('/admin/users/'+id+'/restrictions',{method:'POST',idempotencyKey:key('admin.user.restrict'),body});status('处置完成：'+r.data.action+'，生效 '+r.data.effective_at)}catch(e){status(e.message,true)}};
  q('#load-audit').onclick=async()=>{try{status('查询审计…');const p=new URLSearchParams({limit:'20'});[['actor_id','#audit-actor'],['action_type','#audit-action'],['object_type','#audit-object-type'],['object_id','#audit-object-id'],['from','#audit-from'],['to','#audit-to']].forEach(([name,sel])=>{const v=q(sel).value.trim();if(v)p.set(name,v)});const r=await api('/admin/audit-logs?'+p);list('#audit-list',r.data.map(x=>({source:x.action_type,id:x.id,target_type:x.object_type,target_id:x.object_id,content_version:x.content_version,queue_at:x.occurred_at,status:x.actor_role,reason:x.reason})),'audit');status('共 '+r.data.length+' 条')}catch(e){status(e.message,true)}};
})();
</script>
</body>
</html>`;
