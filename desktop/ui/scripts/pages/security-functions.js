/* pages/security-functions.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'PROTECTION'});
buildSidebar('security');
buildFooter({items:[{txt:'policy agents',cls:'sb-amber'},{txt:'server-linked',cls:'sb-cyan'},{txt:'Agents sensors',cls:'sb-cyan'},{txt:'Live',cls:'sb-green',spin:true}]});
fitWindow('win');

/* ---- Blocked & Saved sites (blocking edits the hosts file; saving is a list only) ---- */
(function(){
  function inv(c,a){ try{ if(window.CF&&CF.invoke) return CF.invoke(c,a||{}); }catch(e){} return Promise.reject(new Error('no tauri')); }
  function e(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function ago(ts){ var s=Math.max(0,Math.floor(Date.now()/1000)-(ts||0)); if(s<60)return s+'s'; if(s<3600)return Math.floor(s/60)+'m'; if(s<86400)return Math.floor(s/3600)+'h'; return Math.floor(s/86400)+'d'; }
  var blkList=document.getElementById('blkList'), prList=document.getElementById('prList');
  function loadBlocked(){
    inv('list_blocked').then(function(r){
      var arr=(r&&r.blocked)||[]; var c=document.getElementById('blkCount'); if(c)c.textContent=arr.length;
      if(!arr.length){ blkList.innerHTML='<div class="sf-empty">No sites blocked</div>'; return; }
      blkList.innerHTML=arr.map(function(b){ var on=b.enforced;
        return '<div class="blk-row"><span class="bd" style="background:'+(on?'var(--red)':'var(--amber)')+'"></span>'+
          '<div class="bi"><b>'+e(b.domain)+'</b><span>'+e(b.reason||'')+' · '+(on?'enforced':'listed · needs admin')+' · '+ago(b.ts)+' ago</span></div>'+
          '<button class="bx" data-d="'+e(b.domain)+'">Unblock</button></div>'; }).join('');
      blkList.querySelectorAll('.bx').forEach(function(btn){ btn.addEventListener('click',function(){ btn.textContent='…'; inv('unblock_site',{domain:btn.dataset.d}).then(loadBlocked).catch(function(err){ btn.textContent='Unblock'; if(CF.toast) CF.toast(String((err&&err.message)||err),'error'); loadBlocked(); }); }); });
    }).catch(function(){ blkList.innerHTML='<div class="sf-empty">Blocking needs a rebuilt desktop app.</div>'; });
  }
  function loadProtected(){
    inv('list_protected').then(function(r){
      var arr=(r&&r.protected)||[]; var c=document.getElementById('prCount'); if(c)c.textContent=arr.length;
      if(!arr.length){ prList.innerHTML='<div class="sf-empty">No saved sites</div>'; return; }
      prList.innerHTML=arr.map(function(p){ return '<div class="blk-row"><span class="bd" style="background:var(--cyan)"></span>'+
        '<div class="bi"><b>'+e(p.domain)+'</b><span>saved, nothing enforced · '+ago(p.ts)+' ago</span></div>'+
        '<button class="bx" data-d="'+e(p.domain)+'">Remove</button></div>'; }).join('');
      prList.querySelectorAll('.bx').forEach(function(btn){ btn.addEventListener('click',function(){ btn.textContent='…'; inv('unprotect_site',{domain:btn.dataset.d}).then(loadProtected).catch(function(){ btn.textContent='Remove'; }); }); });
    }).catch(function(){ prList.innerHTML='<div class="sf-empty">—</div>'; });
  }
  var ai=document.getElementById('blkInput'), ab=document.getElementById('blkAdd');
  function addBlock(){ var v=(ai.value||'').trim(); if(!v) return; ab.textContent='…';
    inv('block_site',{domain:v, reason:'Manually blocked'}).then(function(r){ ai.value=''; ab.textContent='Block';
      if(window.CF&&CF.toast) CF.toast((r&&r.enforced)?('Blocked '+(r.domain||v)+' system-wide'):('Listed — '+((r&&r.message)||'needs admin')), (r&&r.enforced)?'ok':'warn'); loadBlocked();
      try{ window.dispatchEvent(new Event('cf:secaction')); }catch(_){}
    }).catch(function(){ ab.textContent='Block'; if(window.CF&&CF.toast) CF.toast('Block failed','error'); }); }
  ab&&ab.addEventListener('click',addBlock);
  ai&&ai.addEventListener('keydown',function(ev){ if(ev.key==='Enter') addBlock(); });
  var alList=document.getElementById('alList');
  function loadAllowed(){
    inv('list_allowed').then(function(r){
      var arr=(r&&r.allowed)||[]; var c=document.getElementById('alCount'); if(c)c.textContent=arr.length;
      if(!arr.length){ alList.innerHTML='<div class="sf-empty">No allowed sites</div>'; return; }
      alList.innerHTML=arr.map(function(p){ return '<div class="blk-row"><span class="bd" style="background:var(--green)"></span>'+
        '<div class="bi"><b>'+e(p.domain)+'</b><span>trusted · '+ago(p.ts)+' ago</span></div>'+
        '<button class="bx" data-d="'+e(p.domain)+'">Remove</button></div>'; }).join('');
      alList.querySelectorAll('.bx').forEach(function(btn){ btn.addEventListener('click',function(){ btn.textContent='…'; inv('unallow_site',{domain:btn.dataset.d}).then(loadAllowed).catch(function(){ btn.textContent='Remove'; }); }); });
    }).catch(function(){ alList.innerHTML='<div class="sf-empty">—</div>'; });
  }
  var rf=document.getElementById('sfRefresh'); rf&&rf.addEventListener('click',function(){ loadBlocked(); loadProtected(); loadAllowed(); });
  loadBlocked(); loadProtected(); loadAllowed(); setInterval(function(){ loadBlocked(); loadProtected(); loadAllowed(); }, 20000);
})();

(function(){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }); }
  function set(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; }
  function val(id){ var e=document.getElementById(id); return e?e.value.trim():''; }
  function timeAgo(iso){ try{ var s=Math.max(0,(Date.now()-new Date(iso).getTime())/1000);
    if(s<60)return Math.round(s)+'s ago'; if(s<3600)return Math.round(s/60)+'m ago'; if(s<86400)return Math.round(s/3600)+'h ago'; return Math.round(s/86400)+'d ago'; }catch(e){ return ''; } }

  // action type → response category (the three the operator cares about)
  var CAT={ soft_block:'block', session_restrict:'block',
            alert_escalate:'alert', notify_soc:'alert', log_response:'alert',
            weight_boost:'secure', agent_task:'secure' };
  function catOf(t){ return CAT[t]||'alert'; }
  function catLabel(c){ return c==='block'?'BLOCK':c==='secure'?'SECURE':'ALERT'; }
  function catColor(c){ return c==='block'?'#ff7185':c==='secure'?'var(--cyan)':'var(--amber-2)'; }
  var METRIC_LABEL={ risk_score:'Risk Score', alert_count_24h:'Alerts / 24h', correlation_count:'Correlations', malicious_domains:'Malicious Domains', threat_severity:'Threat Severity' };

  // Static policy schema — mirrors the backend Policy Engine (policyEngineService.js).
  // Used as an immediate fallback so the Add-Function dropdowns are always populated,
  // even when /api/policy/meta is unreachable (offline / backend cold start / rate-limited).
  // loadMeta() refreshes this from the server whenever it responds.
  var META={
    triggerMetrics:['risk_score','alert_count_24h','correlation_count','malicious_domains','threat_severity'],
    operators:['>','>=','<','<=','==','!='],
    actionTypes:{
      alert_escalate:{ label:'Escalate Alert' },
      notify_soc:{ label:'Notify SOC' },
      log_response:{ label:'Log Response' },
      soft_block:{ label:'Soft Block' },
      session_restrict:{ label:'Restrict Session' },
      weight_boost:{ label:'Boost Risk Weights' },
      agent_task:{ label:'Dispatch Agent Task' },
    },
  };
  var POLICIES=[];

  /* ---- loaders (all real, via Rust → backend Policy Engine) ---- */
  async function loadMeta(){
    buildForm(); // populate dropdowns immediately from the static fallback (don't wait on the network)
    try{ var r=await CF.invoke('policy_meta');
      if(r&&r.data&&Array.isArray(r.data.triggerMetrics)&&r.data.triggerMetrics.length){ META=r.data; buildForm(); }
    }catch(e){}
  }
  async function loadPolicies(){
    try{ var r=await CF.invoke('policy_list'); POLICIES=(r&&r.policies)||[]; renderPolicies(r&&r.offline);
      set('armedCount', POLICIES.filter(function(p){return p.enabled;}).length+' active');
    }catch(e){set('armedCount','Unavailable');document.getElementById('fnList').textContent='Policies unavailable: '+String(e.message||e);}
  }
  async function loadStats(){
    try{ var r=await CF.invoke('policy_stats'); var d=(r&&r.data)||{};
      set('kTotal', d.totalPolicies!=null?d.totalPolicies:POLICIES.length);
      set('kActive', d.enabledPolicies!=null?d.enabledPolicies:POLICIES.filter(function(p){return p.enabled;}).length);
    }catch(e){set('kTotal','—');set('kActive','—');}
  }
  /* Security activity comes primarily from the LOCAL memory store — every
     block / protect / allow and every flagged scan is recorded there — merged
     with any backend policy responses. This keeps the log full even offline. */
  async function loadLog(){
    var mem=[], plog=[];
    try{ var r=await CF.invoke('memory_list',{limit:160}); mem=(r&&r.data&&r.data.memories)||[]; }catch(e){}
    try{ var pr=await CF.invoke('policy_response_log',{limit:40}); plog=(pr&&pr.log)||[]; }catch(e){}
    var items=[], actions=0;
    mem.forEach(function(m){
      var cat=String(m.category||''), kind=null, color=null;
      if(/^action-block/.test(cat)){ kind='BLOCK'; color='#ff7185'; actions++; }
      else if(/^action-protect/.test(cat)){ kind='SAVED'; color='var(--cyan)'; actions++; }
      else if(/^action-allow/.test(cat)){ kind='ALLOW'; color='var(--green)'; actions++; }
      else if(cat==='report'){ kind='REPORT'; color='var(--amber-2)'; }
      else if(m.kind==='episodic' && m.risk!=null && +m.risk>=50){ kind='THREAT'; color='#ff7185'; }
      else if(/otx/.test(cat) && m.kind==='semantic'){ return; }
      else return;
      items.push({ kind:kind, text:m.text, ts:(m.ts?m.ts*1000:Date.now()), color:color });
    });
    // Each policy response says what happened to it: only "applied" was carried out.
    plog.forEach(function(a){ var st=policyOutcome(a); items.push({ kind:'POLICY', text:(a.policyName||'policy')+' — '+(a.actionType||'action')+' · '+st.text, ts:(new Date(a.timestamp).getTime()||Date.now()), color:st.color }); });
    items.sort(function(a,b){ return b.ts-a.ts; });
    const counts={};plog.forEach(a=>{const state=a.status||'unknown';counts[state]=(counts[state]||0)+1;});
    set('outcomeCounts','Recent policy outcomes: '+(Object.keys(counts).map(k=>k+': '+counts[k]).join(' · ')||'none returned'));
    renderActivity(items, actions + plog.length);
  }
  /* ---- render: functions list ---- */
  function renderPolicies(offline){
    var box=document.getElementById('fnList');
    if(!POLICIES.length){
      box.innerHTML='<div class="sf-empty">'+(offline?'Sign in to load and manage policys.':'No policys yet — click “Add Function”.')+'</div>';
      return;
    }
    box.innerHTML=POLICIES.map(function(p){
      var c=catOf(p.action&&p.action.type);
      var act=((META.actionTypes[p.action.type]||{}).label)||(p.action&&p.action.type)||'action';
      var rule=METRIC_LABEL[p.trigger.metric]||p.trigger.metric;
      return '<div class="sf-fn'+(p.enabled?' on':'')+'" data-id="'+esc(p.id)+'">'+
        '<button class="sf-tog'+(p.enabled?' on':'')+'" data-act="toggle" title="'+(p.enabled?'Disable':'Enable')+'"><span></span></button>'+
        '<div class="sf-fnbody">'+
          '<div class="sf-fnname">'+esc(p.name)+'<span class="sf-cat '+c+'">'+catLabel(c)+'</span>'+(p.isDefault?'<span class="sf-cat def">DEFAULT</span>':'')+'</div>'+
          (p.description?'<div class="sf-fndesc">'+esc(p.description)+'</div>':'')+
          '<div class="sf-fnrule"><b>IF</b> '+esc(rule)+' '+esc(p.trigger.operator)+' '+esc(p.trigger.threshold)+' &nbsp;<b>&rarr;</b>&nbsp; '+esc(act)+'</div>'+
          '<div class="sf-fnstat">Triggered '+(+p.triggerCount||0)+'×'+(p.lastTriggered?(' · last '+timeAgo(p.lastTriggered)):'')+'</div>'+
        '</div>'+
        (p.isDefault?'':'<button class="sf-del" data-act="del" title="Delete">×</button>')+
      '</div>';
    }).join('');
    box.querySelectorAll('.sf-fn').forEach(function(el){
      var id=el.dataset.id;
      var tog=el.querySelector('[data-act=toggle]'); if(tog) tog.addEventListener('click',function(){ togglePolicy(id, el); });
      var del=el.querySelector('[data-act=del]'); if(del) del.addEventListener('click',function(){ armDelete(id, del); });
    });
  }

  async function togglePolicy(id, el){
    var p=POLICIES.find(function(x){return x.id===id;}); if(!p) return;
    var next=!p.enabled; var tog=el.querySelector('.sf-tog'); if(tog) tog.classList.add('busy');
    try{
      var r=await CF.invoke('policy_update',{ id:id, updates:{ enabled:next } });
      if(r&&r.success){ p.enabled=next; if(CF.toast)CF.toast(p.name+' '+(next?'enabled':'disabled'), next?'ok':'warn'); renderPolicies(); loadStats();
        set('armedCount', POLICIES.filter(function(x){return x.enabled;}).length+' active'); }
      else { if(CF.toast)CF.toast((r&&r.error)||'Update failed','error'); if(tog) tog.classList.remove('busy'); }
    }catch(e){ if(CF.toast)CF.toast('Update failed','error'); if(tog) tog.classList.remove('busy'); }
  }

  function armDelete(id, btn){
    if(btn.dataset.armed){ doDelete(id); return; }
    btn.dataset.armed='1'; btn.classList.add('arm'); btn.textContent='Delete?';
    setTimeout(function(){ if(btn){ btn.removeAttribute('data-armed'); btn.classList.remove('arm'); btn.innerHTML='×'; } }, 3000);
  }
  async function doDelete(id){
    try{
      var r=await CF.invoke('policy_delete',{ id:id });
      if(r&&r.success){ POLICIES=POLICIES.filter(function(x){return x.id!==id;}); if(CF.toast)CF.toast('Function deleted','ok'); renderPolicies(); loadStats(); }
      else { if(CF.toast)CF.toast((r&&r.error)||'Delete failed','error'); }
    }catch(e){ if(CF.toast)CF.toast('Delete failed','error'); }
  }

  /* ---- add form ---- */
  function buildForm(){
    // the lists come from the backend's policy metadata: text, never markup (SEC-05)
    var m=document.getElementById('fMetric'); if(m) m.innerHTML=(META.triggerMetrics||[]).map(function(x){return '<option value="'+esc(x)+'">'+esc(METRIC_LABEL[x]||x)+'</option>';}).join('');
    var o=document.getElementById('fOp'); if(o) o.innerHTML=(META.operators||[]).map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join('');
    // An action type the backend cannot carry out is shown as such, not offered as if it worked.
    var a=document.getElementById('fAction'); if(a) a.innerHTML=Object.keys(META.actionTypes||{}).map(function(k){ var t=META.actionTypes[k]; var off=(t.supported===false);
      return '<option value="'+esc(k)+'"'+(off?' disabled':'')+'>'+catLabel(catOf(k))+' · '+esc(t.label)+(off?' — not available: nothing carries it out yet':'')+'</option>';}).join('');
  }
  // What happened to a policy response, in words. "applied" is the only status that means it was done.
  function policyOutcome(a){
    var s=String((a&&a.status)||'');
    if(s==='applied') return { text:'applied'+((a.receipt&&a.receipt.executor)?(' by '+a.receipt.executor):''), color:'var(--green)' };
    if(s==='failed') return { text:'failed'+(a.reason?(': '+a.reason):''), color:'#ff7185' };
    if(s==='unsupported') return { text:'not carried out (no executor)', color:'var(--faint)' };
    return { text:(s||'recorded')+' — not carried out', color:'var(--faint)' };
  }
  function openForm(){ document.getElementById('sfForm').classList.add('open'); }
  function closeForm(){ document.getElementById('sfForm').classList.remove('open'); }
  document.getElementById('sfAdd').addEventListener('click',function(){ var f=document.getElementById('sfForm'); f.classList.toggle('open'); });
  document.getElementById('fCancel').addEventListener('click',closeForm);
  document.getElementById('fCreate').addEventListener('click',async function(){
    var name=val('fName'); if(!name){ if(CF.toast)CF.toast('Give the function a name','warn'); return; }
    var policy={ name:name, description:val('fDesc'),
      trigger:{ metric:val('fMetric'), operator:val('fOp'), threshold:Number(val('fThresh')||0) },
      action:{ type:val('fAction') }, enabled:true, scope:'global' };
    var btn=this; btn.disabled=true; btn.textContent='Creating…';
    try{
      var r=await CF.invoke('policy_create',{ policy:policy });
      if(r&&r.success){ if(CF.toast)CF.toast('Security function created','ok'); document.getElementById('fName').value=''; document.getElementById('fDesc').value=''; closeForm(); await loadPolicies(); loadStats(); }
      else { if(CF.toast)CF.toast((r&&r.error)||'Create failed','error'); }
    }catch(e){ if(CF.toast)CF.toast('Create failed','error'); }
    btn.disabled=false; btn.textContent='Create Policy';
  });

  /* ---- threat simulator (real /api/policy/evaluate) ---- */
  function bindRange(id,vid){ var r=document.getElementById(id),v=document.getElementById(vid); if(r&&v){ r.addEventListener('input',function(){ v.textContent=r.value; }); } }
  bindRange('mRisk','mRiskV'); bindRange('mSev','mSevV');
  document.getElementById('simConsent').addEventListener('change',function(){document.getElementById('simBtn').disabled=!this.checked;});
  document.getElementById('simBtn').addEventListener('click',async function(){
    if(!document.getElementById('simConsent').checked||this.disabled)return;
    var metrics={ risk_score:Number(val('mRisk')), threat_severity:Number(val('mSev')),
      alert_count_24h:Number(val('mAlerts')), correlation_count:Number(val('mCorr')), malicious_domains:Number(val('mDom')) };
    var res=document.getElementById('simRes'); res.innerHTML='<div class="sf-empty" style="padding:10px"><div class="spinner sm" style="display:inline-block;vertical-align:middle"></div> Evaluating…</div>';
    var btn=this; btn.disabled=true;
    try{
      // fresh node id per run so the engine isn't in its per-node cooldown window
      var r=await CF.invoke('policy_evaluate',{ payload:{ nodeId:'sim-'+Date.now(), metrics:metrics } });
      var d=(r&&r.data)||{}; var trig=d.triggered||[];
      if(!trig.length){ res.innerHTML='<div class="sf-noresult">✓ No policy triggered at these levels' + (d.suppressed?(' ('+(+d.suppressed||0)+' suppressed by cooldown)'):'') + '</div>'; }
      else{
        res.innerHTML=trig.map(function(a){
          var c=catOf(a.actionType); var lbl=((META.actionTypes[a.actionType]||{}).label)||a.actionType; var st=policyOutcome(a);
          return '<div class="sf-fire"><span class="fdot" style="background:'+catColor(c)+';box-shadow:0 0 6px '+catColor(c)+'"></span>'+
            '<span class="fn">'+esc(a.policyName)+'</span>'+
            '<span class="fa sf-cat '+c+'">'+catLabel(c)+' · '+esc(lbl)+'</span>'+
            '<span class="fa" style="color:'+st.color+'">'+esc(st.text)+'</span></div>';
        }).join('');
      }
      loadStats(); loadLog(); // a real evaluation appends to the response log
    }catch(e){ res.innerHTML='<div class="sf-empty" style="padding:10px;color:#ff7185">Evaluation failed</div>'; }
    document.getElementById('simConsent').checked=false;btn.disabled=true;
  });

  /* ---- response log / security activity (memory-backed) ---- */
  function cleanTxt(t){ return String(t||'')
      .replace(/^User\s+/,'')
      .replace(/^enabled protected access for\s+/i,'protected ')
      .replace(/\s*\(marked trusted\)/i,'')
      .replace(/^Scanned\s+/i,'scanned ')
      .replace(/^Security report\s+/i,'report ').trim(); }
  function renderActivity(items, respCount){
    set('logCount', items.length);
    if(respCount!=null) set('kResp', respCount);
    var box=document.getElementById('logList');
    if(!items.length){ box.innerHTML='<div class="sf-empty">No security activity yet — block, save or allow a site (or run a scan) and it appears here from memory.</div>'; return; }
    box.innerHTML=items.slice(0,60).map(function(a){
      return '<div class="sf-logrow"><span class="ldot" style="background:'+a.color+';box-shadow:0 0 6px '+a.color+'"></span>'+
        '<span class="ln"><b style="color:'+a.color+';font-family:var(--mono);font-size:8.5px;letter-spacing:.5px;margin-right:6px">'+a.kind+'</b>'+esc(cleanTxt(a.text).slice(0,90))+'</span>'+
        '<span class="lt">'+timeAgo(new Date(a.ts).toISOString())+'</span></div>';
    }).join('');
  }


  /* ---- refresh + real-time ---- */
  function refreshAll(){ loadPolicies(); loadStats(); loadLog();  }
  document.getElementById('sfRefresh').addEventListener('click',function(){ var b=this; b.classList.add('busy'); refreshAll(); setTimeout(function(){ b.classList.remove('busy'); },700); });

  // initial load
  loadMeta().then(function(){ refreshAll(); });
  // a live threat/alert may trigger policies server-side → refresh the log + stats
  var _lt; function bump(){ clearTimeout(_lt); _lt=setTimeout(function(){ loadLog(); loadStats(); },400); }
  ['cf:threat','cf:alert','cf:scan','cf:secaction'].forEach(function(n){ window.addEventListener(n, bump); });
  setInterval(function(){ loadStats(); loadLog(); }, 30000);
})();

// Local views retain the same lists, policies, permissions and outcomes.
(function(){
  const views={sites:['blkList','prList','alList'],policies:['fnList','simBtn'],actions:['logList']};
  const nav=document.createElement('nav');nav.className='workspace-tabs';nav.setAttribute('aria-label','Protection views');
  const labels={sites:'Site lists',policies:'Policies',actions:'Action outcomes'};
  function select(view){
    Object.keys(views).forEach(k=>{views[k].forEach(id=>{const el=document.getElementById(id);if(el)el.closest('.card').hidden=k!==view;});});
    nav.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
    document.querySelector('.sf-grid').dataset.view=view;history.replaceState(null,'','#'+view);
  }
  Object.keys(views).forEach(k=>{const b=document.createElement('button');b.type='button';b.className='nav-item';b.dataset.view=k;b.textContent=labels[k];b.addEventListener('click',()=>select(k));nav.appendChild(b);});
  document.querySelector('.main-head').after(nav);
  select(Object.hasOwn(views,location.hash.slice(1))?location.hash.slice(1):'sites');
})();
