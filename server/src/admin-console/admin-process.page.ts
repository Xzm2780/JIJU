export const ADMIN_PROCESS_HTML = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>JIJU 处理中心</title>
  <style>
    :root{--bg:#f4efed;--panel:#fffdfc;--ink:#30292a;--muted:#8b797a;--line:#e8dcda;--accent:#a5686c;--accent-soft:#f1e0e2;--danger:#914f4f;--ok:#708575}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
    button,input,select,textarea{font:inherit}button{cursor:pointer}.hidden{display:none!important}
    .tabs{display:flex;padding:18px 28px 0;gap:8px}.tab{border:0;border-radius:12px 12px 0 0;background:transparent;color:#7f6f70;padding:11px 18px;font-weight:700}.tab.active{background:var(--panel);color:var(--accent);box-shadow:0 -2px 0 var(--accent) inset}
    main{padding:0 28px 36px}.panel{display:none}.panel.active{display:block}.status{min-height:24px;padding:10px 0;color:var(--muted);overflow-wrap:anywhere}.status.error{color:var(--danger)}
    .card{border:1px solid var(--line);border-radius:0 16px 16px 16px;background:var(--panel);padding:22px}.section+.section{margin-top:18px}.section h2{margin:0 0 14px;font-size:17px}
    .summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.summary-row{padding:13px 14px;border-radius:12px;background:#faf5f2;min-width:0}.summary-label{display:block;color:var(--muted);font-size:11px}.summary-value{display:block;margin-top:4px;font-weight:650;overflow-wrap:anywhere}
    .content-preview{margin-top:12px;padding:16px;border-radius:12px;background:#faf5f2;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere}
    .badge{display:inline-block;padding:3px 9px;border-radius:999px;background:var(--accent-soft);color:#7c4c52;font-size:11px;font-weight:700}.badge.ok{background:#e7efe8;color:#58705d}.badge.danger{background:#f4d6d2;color:#8c3f3f}
    .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}.field{display:flex;min-width:0;flex-direction:column;gap:7px}.field label{color:var(--muted);font-size:12px;font-weight:700}.wide{grid-column:1/-1}
    input,select,textarea{width:100%;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);outline:none}input:focus,select:focus,textarea:focus{border-color:#b77d81;box-shadow:0 0 0 3px rgba(165,104,108,.12)}textarea{min-height:92px;resize:vertical}
    .actions{display:flex;margin-top:14px;gap:10px;justify-content:flex-end}.primary,.danger{border:0;border-radius:10px;padding:10px 16px;font-weight:700}.primary{background:var(--accent);color:#fff}.danger{background:#f6e6e3;color:var(--danger)}
    .history-item{padding:14px 0;border-bottom:1px solid #f0e6e3}.history-item:last-child{border-bottom:0}.history-title{font-weight:700}.history-meta{margin-top:4px;color:var(--muted);font-size:11px}.history-reason{margin-top:7px;color:#5d5253;overflow-wrap:anywhere}
    .empty{padding:32px;color:var(--muted);text-align:center}
    @media(max-width:680px){.tabs{padding:12px 14px 0;overflow:auto}main{padding:0 14px 24px}.summary{grid-template-columns:1fr}.tab{padding:10px 14px;white-space:nowrap}}
  </style>
</head>
<body>
  <nav class="tabs" id="tabs">
    <button class="tab active" data-tab="overview">概览</button>
    <button class="tab" data-tab="action">处理</button>
    <button id="history-tab" class="tab" data-tab="history">记录</button>
  </nav>
  <main>
    <div id="status" class="status"></div>
    <section class="panel active" data-panel="overview"><div class="card" id="overview"></div></section>
    <section class="panel" data-panel="action">
      <div class="card">
        <div id="content-actions" class="hidden">
          <div class="section">
            <h2>内容复核</h2>
            <form id="review-form" class="form-grid">
              <div class="field"><label>复核结论</label><select id="review-decision"><option value="PASSED">通过</option><option value="REJECTED">判定违规</option></select></div>
              <div class="field wide"><label>处理原因</label><textarea id="review-reason" required></textarea></div>
              <div class="actions wide"><button class="primary" type="submit">提交复核</button></div>
            </form>
          </div>
          <div class="section">
            <h2>内容状态</h2>
            <form id="content-action-form" class="form-grid">
              <div class="field"><label>处理方式</label><select id="content-action"><option value="HIDE">隐藏内容</option><option value="TAKEDOWN">下架内容</option><option value="RESTORE">恢复公开</option></select></div>
              <div class="field wide"><label>处理原因</label><textarea id="content-action-reason" required></textarea></div>
              <div class="actions wide"><button class="danger" type="submit">执行处理</button></div>
            </form>
          </div>
        </div>
        <form id="account-action-form" class="form-grid hidden">
          <div class="field"><label>处理方式</label><select id="account-action"><option value="WARNING">警告</option><option value="POST_LIMIT">限制发帖</option><option value="COMMENT_LIMIT">限制评论</option><option value="REACTION_LIMIT">限制互动</option><option value="BAN">封禁账号</option></select></div>
          <div class="field"><label>限制结束时间</label><input id="account-expires" type="datetime-local" disabled></div>
          <div class="field wide"><label>处理原因</label><textarea id="account-reason" required></textarea></div>
          <div class="actions wide"><button class="danger" type="submit">提交处理</button></div>
        </form>
      </div>
    </section>
    <section class="panel" data-panel="history"><div class="card" id="history"></div></section>
  </main>
<script>
(() => {
  const SESSION_KEY='jiju.admin-console.session.v1';
  const CONTENT_PROCESS_KEY='jiju.admin.content-process.v1';
  const ACCOUNT_PROCESS_KEY='jiju.admin.account-process.v1';
  const params=new URLSearchParams(location.search);
  const kind=params.get('kind')==='account'?'account':'content';
  const targetId=params.get('id')||'';
  const $=(selector)=>document.querySelector(selector);
  const setStatus=(text,error=false)=>{const el=$('#status');el.textContent=text||'';el.className='status'+(error?' error':'')};
  const formatTime=(value)=>{if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('zh-CN',{hour12:false})};
  const labels={POST:'帖子',COMMENT:'评论',PUBLISHED:'公开中',HIDDEN:'已隐藏',EXPIRED:'已到期',DELETED:'已删除',PASSED:'已通过',PENDING:'待复核',REJECTED:'已判定违规',ACTIVE:'正常',RESTRICTED:'受限',BANNED:'已封禁',DEACTIVATED:'注销冷静期',report:'用户举报',moderation:'规则复核',ABUSE:'辱骂与骚扰',PRIVACY:'隐私',MINOR_INVOLVED:'未成年人',DANGEROUS_OR_INAPPROPRIATE:'危险内容',SPAM:'垃圾信息',OTHER:'其他',WARNING:'警告',POST_LIMIT:'限制发帖',COMMENT_LIMIT:'限制评论',REACTION_LIMIT:'限制互动',BAN:'封禁账号',HIDE:'隐藏内容',TAKEDOWN:'下架内容',RESTORE:'恢复公开',REVIEW_PASSED:'复核通过',REVIEW_REJECTED:'判定违规'};
  const human=(value)=>labels[String(value||'').toUpperCase()]||labels[value]||value||'—';
  const getSession=()=>{try{const saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(!saved||!saved.accessToken||Date.parse(saved.expiresAt)<=Date.now()+5000)return null;return saved}catch(error){return null}};
  const saved=getSession();
  if(!saved){window.top.location.replace('/api/v1/admin-console');return}
  let item=null;
  try{item=JSON.parse(sessionStorage.getItem(kind==='account'?ACCOUNT_PROCESS_KEY:CONTENT_PROCESS_KEY)||'null')}catch(error){item=null}
  if(!item||!targetId){$('#overview').textContent='数据已失效';setStatus('',true);return}
  const itemId=kind==='account'?item.id:(item.target_id||item.id);
  if(itemId!==targetId){$('#overview').textContent='数据已失效';return}
  if(kind==='account')$('#history-tab').classList.add('hidden');
  function uuidV7(){const bytes=crypto.getRandomValues(new Uint8Array(16));let time=BigInt(Date.now());for(let index=5;index>=0;index--){bytes[index]=Number(time&255n);time>>=8n}bytes[6]=(bytes[6]&15)|112;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20)}
  const key=(operation)=>'v1:'+operation+':'+uuidV7();
  async function api(path,options={}){const response=await fetch('/api/v1'+path,{method:options.method||'GET',headers:{accept:'application/json',authorization:'Bearer '+saved.accessToken,...(options.body?{'content-type':'application/json'}:{}),...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})},body:options.body?JSON.stringify(options.body):undefined});const text=await response.text();const body=text?JSON.parse(text):null;if(!response.ok){if(response.status===401)window.top.location.replace('/api/v1/admin-console');throw new Error(body&&body.message?body.message:'操作失败，请稍后重试')}return body}
  function addSummary(container,label,value){const row=document.createElement('div');row.className='summary-row';const labelEl=document.createElement('span');labelEl.className='summary-label';labelEl.textContent=label;const valueEl=document.createElement('span');valueEl.className='summary-value';valueEl.textContent=value;row.append(labelEl,valueEl);container.appendChild(row)}
  function renderOverview(){const box=$('#overview');box.textContent='';const title=document.createElement('h2');title.textContent=kind==='account'?'账号概览':'内容概览';box.appendChild(title);const summary=document.createElement('div');summary.className='summary';if(kind==='account'){addSummary(summary,'昵称',item.plaza_nickname||'—');addSummary(summary,'账号状态',human(item.account_status));addSummary(summary,'帖子',String(item.post_count??0));addSummary(summary,'回应',String(item.comment_count??0));addSummary(summary,'加入时间',formatTime(item.created_at));addSummary(summary,'当前限制',activeRestrictions(item).join('、')||'无')}else{addSummary(summary,'内容类型',human(item.target_type));addSummary(summary,'作者',item.author_nickname||'—');addSummary(summary,'公开状态',human(item.public_status));addSummary(summary,'审核状态',human(item.moderation_status));addSummary(summary,'来源',item.source?human(item.source):'内容管理');addSummary(summary,'举报原因',item.reason?human(item.reason):'—');addSummary(summary,'举报数',String(item.report_count??0));addSummary(summary,'版本','v'+(item.content_version||1));addSummary(summary,'发布时间',formatTime(item.published_at));addSummary(summary,'到期时间',formatTime(item.expires_at))}box.appendChild(summary);if(kind==='content'){const preview=document.createElement('div');preview.className='content-preview';preview.textContent=item.body_excerpt||'—';box.appendChild(preview)}}
  function activeRestrictions(account){const now=Date.now();const values=[];if(account.posting_restricted_until&&new Date(account.posting_restricted_until).getTime()>now)values.push('发帖限制至 '+formatTime(account.posting_restricted_until));if(account.commenting_restricted_until&&new Date(account.commenting_restricted_until).getTime()>now)values.push('评论限制至 '+formatTime(account.commenting_restricted_until));if(account.reaction_restricted_until&&new Date(account.reaction_restricted_until).getTime()>now)values.push('互动限制至 '+formatTime(account.reaction_restricted_until));return values}
  function switchTab(name){document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.tab===name));document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===name));if(name==='history')void loadHistory()}
  function syncExpiry(){const needs=['POST_LIMIT','COMMENT_LIMIT','REACTION_LIMIT'].includes($('#account-action').value);$('#account-expires').disabled=!needs;$('#account-expires').required=needs;if(!needs)$('#account-expires').value=''}
  async function loadHistory(){const box=$('#history');box.textContent='';setStatus('正在加载记录…');try{const result=await api('/admin/audit-logs?object_id='+encodeURIComponent(targetId)+'&limit=20');if(!result.data.length){box.innerHTML='<div class="empty">暂无记录</div>'}else{result.data.forEach(entry=>{const div=document.createElement('div');div.className='history-item';const title=document.createElement('div');title.className='history-title';title.textContent=human(entry.action_type);const meta=document.createElement('div');meta.className='history-meta';meta.textContent=[human(entry.actor_role),formatTime(entry.occurred_at),entry.content_version?'v'+entry.content_version:''].filter(Boolean).join(' · ');div.append(title,meta);if(entry.reason){const reason=document.createElement('div');reason.className='history-reason';reason.textContent=entry.reason;div.appendChild(reason)}box.appendChild(div)})}setStatus('')}catch(error){box.innerHTML='<div class="empty">暂无记录</div>';setStatus('')}}
  $('#tabs').onclick=(event)=>{const tab=event.target.closest('.tab');if(tab&&!tab.classList.contains('hidden'))switchTab(tab.dataset.tab)};
  $('#account-action').onchange=syncExpiry;
  if(kind==='account'){$('#content-actions').classList.add('hidden');$('#account-action-form').classList.remove('hidden');syncExpiry()}else{$('#content-actions').classList.remove('hidden');$('#account-action-form').classList.add('hidden')}
  $('#review-form').onsubmit=async(event)=>{event.preventDefault();setStatus('正在提交复核…');try{const result=await api('/admin/content/'+encodeURIComponent(item.target_type)+'/'+encodeURIComponent(targetId)+'/reviews',{method:'POST',idempotencyKey:key('admin.review'),body:{expected_content_version:Number(item.content_version||1),decision:$('#review-decision').value,reason:$('#review-reason').value.trim()}});item={...item,moderation_status:result.data.moderation_status,public_status:result.data.public_status};renderOverview();setStatus('复核已提交');switchTab('overview')}catch(error){setStatus(error.message,true)}};
  $('#content-action-form').onsubmit=async(event)=>{event.preventDefault();setStatus('正在执行处理…');try{const result=await api('/admin/content/'+encodeURIComponent(item.target_type)+'/'+encodeURIComponent(targetId)+'/actions',{method:'POST',idempotencyKey:key('admin.content.action'),body:{action:$('#content-action').value,expected_content_version:Number(item.content_version||1),reason:$('#content-action-reason').value.trim()}});item={...item,public_status:result.data.public_status_after,moderation_status:result.data.moderation_status_after};renderOverview();setStatus('处理已完成');switchTab('overview')}catch(error){setStatus(error.message,true)}};
  $('#account-action-form').onsubmit=async(event)=>{event.preventDefault();setStatus('正在提交处理…');try{const body={action:$('#account-action').value,reason:$('#account-reason').value.trim()};if($('#account-expires').value)body.expires_at=new Date($('#account-expires').value).toISOString();const result=await api('/admin/users/'+encodeURIComponent(targetId)+'/restrictions',{method:'POST',idempotencyKey:key('admin.user.restrict'),body});item={...item,account_status:body.action==='BAN'?'BANNED':item.account_status};renderOverview();setStatus('处理已完成');switchTab('overview')}catch(error){setStatus(error.message,true)}};
  renderOverview();
})();
</script>
</body>
</html>`;
