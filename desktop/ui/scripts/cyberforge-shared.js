/* ============================================================
   CyberForge — shared utilities (used by all screens)
   Sidebar / header / footer live in cf-sidebar.js / cf-header.js / cf-footer.js
   ============================================================ */
function fitWindow(id){
  const w=document.getElementById(id);
  if(!w) return;
  function fit(){
    const vw=window.innerWidth, vh=window.innerHeight, DW=1440, DH=824;
    // Scale so the design HEIGHT exactly fills the viewport (footer always
    // visible, no vertical scroll). Then WIDEN the design to fill the viewport
    // width too, so there are no dark side bands. On unusually narrow windows we
    // fall back to a width-fit and centre vertically (still no side bands).
    const sH=vh/DH;
    w.style.transformOrigin='top left';
    if(vw/sH>=DW){                                  // wide enough → fluid full-width
      w.style.width=(vw/sH)+'px';
      w.style.transform='scale('+sH+')';
      w.style.left='0px'; w.style.top='0px';
    }else{                                          // narrow → fit width, centre vertically
      const s=vw/DW;
      w.style.width=DW+'px';
      w.style.transform='scale('+s+')';
      w.style.left='0px'; w.style.top=Math.max(0,(vh-DH*s)/2)+'px';
    }
    const stage=w.parentElement;                    // exact viewport height → no page scroll
    if(stage) stage.style.height=vh+'px';
  }
  window.addEventListener('resize',fit); fit();
}

function startClock(id){
  const el=document.getElementById(id); if(!el)return;
  let s=0; setInterval(()=>{ s++; const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
    el.textContent=h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); },1000);
}

/* ripple helper for buttons */
function attachRipple(el){
  el.addEventListener('click',e=>{
    const r=el.getBoundingClientRect(),s=document.createElement('span');s.className='ripple';
    const size=Math.max(r.width,r.height);s.style.width=s.style.height=size+'px';
    s.style.left=(e.clientX-r.left)+'px';s.style.top=(e.clientY-r.top)+'px';
    el.appendChild(s);setTimeout(()=>s.remove(),600);
  });
}

/* ============================================================
   CF — shared backend bridge used by every screen.
   All backend/ML access goes through the Rust commands (via Tauri
   invoke), exactly like cf-auth.js — no direct fetch, so there are
   no CORS/CSP concerns. Works whether the page is the top window or
   an iframe (the floating agent panel) by walking to window.parent.
   ============================================================ */
window.CF = window.CF || {};
CF.API_BASE = CF.API_BASE || 'https://cyberforge-ddd97655464f.herokuapp.com';

/* locate the Tauri bridge from this window or a parent frame */
CF._tauri = function(){
  try { if (window.__TAURI__ && window.__TAURI__.core) return window.__TAURI__; } catch(e){}
  try { if (window.parent && window.parent.__TAURI__ && window.parent.__TAURI__.core) return window.parent.__TAURI__; } catch(e){}
  return null;
};

/* invoke a Rust command; rejects if the bridge isn't present (browser preview) */
CF.invoke = function(cmd, args){
  var T = CF._tauri();
  if (T && T.core && T.core.invoke) { try { return T.core.invoke(cmd, args||{}); } catch(e){ return Promise.reject(e); } }
  return Promise.reject(new Error('tauri-unavailable'));
};

/* subscribe to a Tauri event (e.g. 'cf-telemetry'); returns a no-op if unavailable */
CF.listen = function(evt, cb){
  var T = CF._tauri();
  if (T && T.event && T.event.listen) { try { return T.event.listen(evt, function(e){ cb(e.payload); }); } catch(e){} }
  return Promise.resolve(function(){});
};

/* current auth token (keychain-backed, via Rust) — used by cf-realtime SSE */
CF.getToken = async function(){
  try { var r = await CF.invoke('auth_get_token'); return (r && r.token) || null; } catch(e){ return null; }
};

/* ML convenience wrappers over the ml_* Rust commands */
CF.ml = {
  chat:       function(query, maxTokens){ return CF.invoke('ml_security_chat', { query: query, maxTokens: maxTokens||512 }); },
  classifyUrl:function(url){ return CF.invoke('ml_classify_url', { url: url }); },
  detectDga:  function(domain){ return CF.invoke('ml_detect_dga', { domain: domain }); },
  iocScan:    function(args){ return CF.invoke('ml_ioc_scan', args||{}); },
  urlEnrich:  function(url){ return CF.invoke('ml_url_enrich', { url: url }); },
  status:     function(){ return CF.invoke('ml_status'); }
};

/* Write a memory to the local vector store (memory_save) so the AI Assistant and
   the Memory page can recall it. Any page calls this on a meaningful event —
   a generated report, a sandbox analysis, etc. Deduped per-session so repeated
   identical events don't flood the store. opts: {kind, category, url, risk}. */
CF._memSeen = CF._memSeen || {};
CF.remember = function(text, opts){
  try{
    text = String(text||'').trim(); if(!text) return Promise.resolve();
    var key = text.slice(0,160);
    if(CF._memSeen[key]) return Promise.resolve(); CF._memSeen[key]=1;
    opts = opts||{};
    return CF.invoke('memory_save', {
      text: text,
      kind: opts.kind || 'episodic',
      url: opts.url || null,
      category: opts.category || 'app',
      risk: (opts.risk!=null ? opts.risk : null)
    }).catch(function(){});
  }catch(e){ return Promise.resolve(); }
};

/* ---- shared memory grounding (AI assistant + agent terminals) ---- */
CF.gatherMemory = function(query){
  var pS = CF.invoke('memory_search',{query:query, topK:8}).then(function(r){ return (r&&r.data&&r.data.results)||[]; }).catch(function(){ return []; });
  var pL = CF.invoke('memory_list',{limit:80}).then(function(r){ return (r&&r.data)||{}; }).catch(function(){ return {}; });
  return Promise.all([pS,pL]).then(function(a){
    var sem=a[0]||[], ld=a[1]||{}, recent=ld.memories||[], seen={}, merged=[];
    function add(m){ if(!m||!m.text) return; var k=String(m.text).slice(0,120); if(seen[k]) return; seen[k]=1;
      merged.push({text:m.text, category:m.category||m.kind||'memory', kind:m.kind, ts:m.ts, url:m.url, risk:m.risk}); }
    sem.forEach(add); recent.forEach(add);
    var items=merged.slice(0,20);
    items._counts={ total:(ld.total!=null?ld.total:merged.length), episodic:ld.episodic||0, semantic:ld.semantic||0, procedural:ld.procedural||0 };
    return items;
  });
};
CF.augmentQuery = function(q, mems){
  if(!mems||!mems.length) return q;
  var c=mems._counts||{};
  var ctx=mems.map(function(m,i){ return (i+1)+'. ['+m.category+'] '+m.text; }).join('\n');
  var ov='Memory overview: '+(c.total||mems.length)+' memories — '+(c.episodic||0)+' scans/analyses, '+(c.semantic||0)+' threat-intel, '+(c.procedural||0)+' reports/actions.';
  return 'You are the CyberForge security assistant. The CONTEXT below is the user\'s local CyberForge memory — every scan, threat-intel pulse, report and action saved across the app (scans begin with "Scanned ..."). Ground your answer in it; when asked what scans/threats/actions exist, LIST them from context, and cite specifics (hosts, verdicts, risk, malware, techniques). '+ov+'\n\nCONTEXT:\n'+ctx+'\n\nQUESTION: '+q;
};
CF.threatFromMemory = function(mems){
  if(!mems||!mems.length) return null;
  function hostOf(u){ try{ var h=(String(u).split('://')[1]||String(u)).split('/')[0]; return h.split('?')[0].replace(/^www\./,''); }catch(e){ return ''; } }
  function hostFromText(t){ var m=String(t||'').match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i); return m?m[1].replace(/^www\./,''):''; }
  var best=null;
  mems.forEach(function(m){ var risk=(m.risk!=null)?+m.risk:0; var mal=/phishing|malicious|malware|ransomware|botnet|trojan|c2|spyware|dga/i.test(m.text||'');
    var host=m.url?hostOf(m.url):(mal?hostFromText(m.text):''); if(!host) return;
    var sev=Math.max(risk, mal?65:0); if(sev>=50 && (!best||sev>best.risk)) best={host:host,risk:sev}; });
  return best;
};

/* ---- shared Block / Protect / Allow action buttons for a flagged host ---- */
CF._taCss=function(){ if(document.getElementById('cf-ta-css'))return; var st=document.createElement('style'); st.id='cf-ta-css';
  st.textContent='.cf-ta{margin-top:10px;padding:11px;border-radius:10px;border:1px solid rgba(244,73,94,.3);background:rgba(244,73,94,.07)}'+
  '.cf-ta .h{font-size:12px;color:#ff9aa6;display:flex;align-items:center;gap:7px;margin-bottom:9px}.cf-ta .h b{color:#ff7185}'+
  '.cf-ta .b{display:flex;gap:8px;flex-wrap:wrap}'+
  '.cf-ta button{height:32px;padding:0 13px;border-radius:8px;font-family:Space Grotesk,system-ui,sans-serif;font-size:12px;font-weight:600;cursor:pointer;border:1px solid;background:transparent;transition:.15s}'+
  '.cf-ta .blk{color:#ff7185;border-color:rgba(244,73,94,.45);background:rgba(244,73,94,.12)}.cf-ta .blk:hover{background:rgba(244,73,94,.22)}'+
  '.cf-ta .prt{color:#2bd4ee;border-color:rgba(43,212,238,.4);background:rgba(43,212,238,.12)}.cf-ta .prt:hover{background:rgba(43,212,238,.22)}'+
  '.cf-ta .alw{color:#43e08a;border-color:rgba(67,224,138,.4);background:rgba(67,224,138,.12)}.cf-ta .alw:hover{background:rgba(67,224,138,.22)}'+
  '.cf-ta .done{opacity:.7;pointer-events:none}'+
  '.cf-ta .n{font-family:JetBrains Mono,monospace;font-size:10px;color:#90a0b8;margin-top:8px;line-height:1.5}';
  document.head.appendChild(st); };
CF.threatActions=function(opts){
  opts=opts||{}; var host=String(opts.host||'').replace(/[<>]/g,''); var risk=(opts.risk!=null)?opts.risk:'';
  CF._taCss();
  var w=document.createElement('div'); w.className='cf-ta';
  w.innerHTML='<div class="h"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 10 18H2Z"/><path d="M12 9v5M12 17h.01"/></svg>Threat - <b>'+host+'</b>'+(risk!==''?(' (risk '+risk+')'):'')+' · choose an action:</div>'+
    '<div class="b"><button class="blk">Block</button><button class="prt">Protect</button><button class="alw">Allow</button></div><div class="n"></div>';
  var note=w.querySelector('.n');
  function act(btn, cmd, args, ok){ btn.classList.add('done'); var orig=btn.textContent; btn.textContent='…';
    CF.invoke(cmd,args).then(function(r){ ok(r,btn); if(opts.onAction)opts.onAction(cmd,host,r); })
      .catch(function(e){ btn.classList.remove('done'); btn.textContent=orig; note.textContent=cmd+' unavailable: '+((e&&e.message)||e)+' (rebuild the desktop app)'; }); }
  w.querySelector('.blk').addEventListener('click',function(){ act(this,'block_site',{domain:host,reason:'CyberForge action'},function(r,b){ b.textContent=r&&r.enforced?'✓ Blocked':'✓ Listed'; note.textContent=r&&r.enforced?(host+' blocked system-wide via the hosts file.'):('Listed - needs admin to enforce. '+((r&&r.message)||'')); }); });
  w.querySelector('.prt').addEventListener('click',function(){ act(this,'protect_site',{domain:host},function(r,b){ b.textContent='✓ Protected'; var ip=r&&r.publicIp?(' Public IP: '+r.publicIp+'.'):''; note.textContent=((r&&r.note)||'Protected access recorded.')+ip; }); });
  w.querySelector('.alw').addEventListener('click',function(){ act(this,'allow_site',{domain:host},function(r,b){ b.textContent='✓ Allowed'; note.textContent=host+' marked trusted (allow-list)'+(r&&r.wasUnblocked?' and unblocked':'')+'.'; }); });
  return w;
};

/* lightweight toast (used by cf-live.js + any page); auto-styles once */
CF.toast = function(text, kind){
  try{
    if(!document.getElementById('cf-toast-styles')){
      var st=document.createElement('style'); st.id='cf-toast-styles';
      st.textContent='#cf-toasts{position:fixed;top:54px;right:16px;z-index:10001;display:flex;flex-direction:column;gap:8px}'+
        '.cf-toast{font:500 12.5px/1.4 system-ui,sans-serif;color:#eaf2f6;background:rgba(11,22,34,.97);'+
        'border:1px solid #1f3a4d;border-left-width:3px;border-radius:9px;padding:9px 13px;max-width:330px;'+
        'box-shadow:0 8px 28px rgba(0,0,0,.45);animation:cftin .25s ease}'+
        '.cf-toast.warn{border-left-color:#f5a623}.cf-toast.error{border-left-color:#f87171}.cf-toast.ok{border-left-color:#2dd4bf}'+
        '@keyframes cftin{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}';
      document.head.appendChild(st);
    }
    var box=document.getElementById('cf-toasts');
    if(!box){ box=document.createElement('div'); box.id='cf-toasts'; document.body.appendChild(box); }
    var t=document.createElement('div'); t.className='cf-toast '+(kind||''); t.textContent=text;
    box.appendChild(t); setTimeout(function(){ t.style.opacity='0'; setTimeout(function(){ t.remove(); },300); }, 5000);
  }catch(e){}
};

/* convenience: build the whole shell at once */
function buildShell(opts){
  opts=opts||{};
  if(window.buildHeader) buildHeader(opts.header||{});
  if(window.buildSidebar) buildSidebar(opts.active||'');
  if(window.buildFooter) buildFooter(opts.footer||{});
  if(opts.win) fitWindow(opts.win);
}

/* auto-load the floating Agent panel component on every app screen
   (this file is included by all shell pages, so the agent is available
   everywhere without editing each page individually). */
(function(){
  if(document.getElementById('cf-agent-loader')) return;
  var s=document.createElement('script');
  s.id='cf-agent-loader';
  s.src='../scripts/cf-agent.js';
  (document.head||document.documentElement).appendChild(s);
})();
