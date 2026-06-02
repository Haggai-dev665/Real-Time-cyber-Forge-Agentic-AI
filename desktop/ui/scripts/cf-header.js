/* ============================================================
   CyberForge — HEADER (top bar) component  [fully functional]
   Usage:  <div class="topbar" id="topbar"></div>
           buildHeader({ search, status, chips, threats, cta })

   Wires every header control to real behaviour:
     • IP search    — type a website → resolve_ip (Rust/OS DNS) → IP results
     • Notifications — real backend alerts (agent_alerts) + live SSE events
     • Theme         — light/dark toggle, persisted in localStorage
     • Settings      — account, backend/ML status, theme, sign out
     • Quick Scan    — scans the typed site or opens the Sandbox
   ============================================================ */
(function(){
  const bolt='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>';
  const bell='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
  const moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>';
  const sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>';
  const gear='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.4H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8Z"/></svg>';
  const user='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const MARK='<svg class="cf-mark" viewBox="0 0 60 60" fill="none"><rect x="1" y="1" width="58" height="58" fill="none" stroke="var(--cream)" stroke-width="2"></rect><path d="M15 45 L30 13 L45 45 Z" fill="var(--brand-orange)"></path><path d="M23 45 L30 29 L37 45 Z" fill="#0e1420"></path><circle class="sage" cx="30" cy="45" r="3.2" fill="var(--sage)"></circle></svg>';
  const searchI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const threatI='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/></svg>';
  const globeI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>';

  /* ---- helpers ---- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];}); }
  function set(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; }
  function timeAgo(iso){ try{ var s=Math.max(0,(Date.now()-new Date(iso).getTime())/1000);
    if(s<60)return Math.round(s)+'s ago'; if(s<3600)return Math.round(s/60)+'m ago'; if(s<86400)return Math.round(s/3600)+'h ago'; return Math.round(s/86400)+'d ago'; }catch(e){ return ''; } }
  function sevColor(s){ s=String(s||'').toLowerCase();
    return s==='critical'?'#f4495e':s==='high'?'#ffb84d':s==='medium'?'#ecc94b':s==='low'?'#2bd4ee':'#5d6c84'; }
  function inv(cmd,args){ return (window.CF&&CF.invoke)?CF.invoke(cmd,args||{}):Promise.reject(new Error('no-bridge')); }

  /* ---- theme (applied ASAP so there is no flash) ---- */
  function curTheme(){ try{ return localStorage.getItem('cf-theme')||'dark'; }catch(e){ return 'dark'; } }
  try{ if(curTheme()==='light') document.documentElement.setAttribute('data-theme','light'); }catch(e){}
  /* light-theme overrides — injected into the main doc AND into same-origin
     iframes (the floating agent panel) so the theme reaches them too. Also
     covers the hardcoded-dark surfaces of the agent panel + threat-globe map. */
  var THEME_CSS=
    'html[data-theme="light"]{--bg:#eef1f7;--bg-2:#e6ebf3;--surface:rgba(255,255,255,.9);--surface-2:rgba(248,250,253,.9);--surface-solid:#ffffff;--tile:#f3f6fb;--border:rgba(22,40,68,.12);--border-2:rgba(22,40,68,.2);--border-3:rgba(22,40,68,.3);--text:#15212f;--dim:#46586f;--faint:#8593a7;--grid:rgba(22,40,68,.06)}'+
    'html[data-theme="light"] body{background:#e6ebf3}'+
    'html[data-theme="light"] .stage{background:radial-gradient(1000px 600px at 72% -10%,#ffffff,transparent 60%),radial-gradient(800px 500px at 8% 110%,#eaf0f8,transparent 55%),#e6ebf3 !important}'+
    'html[data-theme="light"] .window{background:linear-gradient(180deg,#ffffff,#f4f6fb) !important;border-color:var(--border-2) !important}'+
    'html[data-theme="light"] .topbar{background:linear-gradient(180deg,#ffffff,#f1f4f9) !important}'+
    'html[data-theme="light"] .sidebar{background:linear-gradient(180deg,#f7f9fc,#eef1f7) !important}'+
    'html[data-theme="light"] .statusbar{background:#f1f4f9 !important}'+
    'html[data-theme="light"] .search{background:#ffffff !important}'+
    'html[data-theme="light"] .nav-item:hover{background:rgba(22,40,68,.05)}'+
    /* floating agent panel (separate iframe document) */
    'html[data-theme="light"] .agent{background:linear-gradient(180deg,#ffffff,#f5f8fc) !important;border-color:var(--border-2) !important;box-shadow:0 26px 70px -22px rgba(20,40,68,.35) !important}'+
    'html[data-theme="light"] .agent::after{opacity:.22}'+
    'html[data-theme="light"] .agent-stream,html[data-theme="light"] .task-card{background:var(--surface-2) !important}'+
    /* threat-globe map surface */
    'html[data-theme="light"] .map-stage{background:radial-gradient(900px 600px at 50% 46%,rgba(43,212,238,.10),transparent 60%),#dce5f1 !important}'+
    'html[data-theme="light"] .gl-tab{background:rgba(255,255,255,.82)}'+
    'html[data-theme="light"] .atk .flag,html[data-theme="light"] .origin .flag{background:var(--tile) !important}'+
    /* hardcoded-dark content areas: memory/browser-intel graphs, sandbox VM, report document */
    'html[data-theme="light"] .graph-stage,html[data-theme="light"] .dgraph{background:radial-gradient(700px 500px at 50% 45%,rgba(43,212,238,.06),transparent 60%),#dde6f2 !important}'+
    'html[data-theme="light"] .vm-screen{background:linear-gradient(180deg,#eef2f8,#e2e8f2) !important}'+
    'html[data-theme="light"] .submit .field{background:#ffffff !important}'+
    'html[data-theme="light"] .nv-node .nd{background:#eef2f8 !important}'+
    'html[data-theme="light"] .doc{background:#ffffff !important}';
  try{ window.__cfThemeCSS=THEME_CSS; window.cfCurrentTheme=curTheme; }catch(e){}

  /* push the current theme into same-origin iframes (the floating agent panel) */
  function propagateTheme(t){
    try{
      var frames=document.querySelectorAll('iframe');
      for(var i=0;i<frames.length;i++){
        var f=frames[i];
        try{
          var d=f.contentDocument;
          if(d&&d.documentElement){
            if(t==='light') d.documentElement.setAttribute('data-theme','light'); else d.documentElement.removeAttribute('data-theme');
            if(!d.getElementById('cf-theme-style')){ var s=d.createElement('style'); s.id='cf-theme-style'; s.textContent=THEME_CSS; (d.head||d.documentElement).appendChild(s); }
          }
        }catch(e){}
        try{ if(f.contentWindow) f.contentWindow.postMessage({cf:'theme',theme:t},'*'); }catch(e){}
      }
    }catch(e){}
  }

  function applyTheme(t){
    t=(t==='light')?'light':'dark';
    try{ localStorage.setItem('cf-theme',t); }catch(e){}
    if(t==='light') document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
    var tb=document.getElementById('cfTheme'); if(tb) tb.innerHTML=(t==='light')?sun:moon;
    propagateTheme(t);
    if(window.CF&&CF.toast) CF.toast((t==='light'?'Light':'Dark')+' theme','ok');
  }

  /* ---- inject component styles + light theme once ---- */
  function ensureStyle(){
    if(document.getElementById('cf-header-style')) return;
    var st=document.createElement('style'); st.id='cf-header-style';
    st.textContent=
      '.search{position:relative}'+
      '.search .cf-sinput{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--text);font-family:var(--mono);font-size:12.5px}'+
      '.search .cf-sinput::placeholder{color:var(--faint)}'+
      '@keyframes cfddin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'+
      '.cf-sres{position:absolute;top:calc(100% + 7px);left:0;width:440px;max-width:84vw;background:var(--surface-solid,#0d1320);border:1px solid var(--border-2);border-radius:11px;box-shadow:0 24px 60px -16px rgba(0,0,0,.6);z-index:60;display:none}'+
      '.cf-sres.open{display:block;animation:cfddin .18s ease}'+
      '.cf-sres-h,.dd-h{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--border);font-size:12.5px;font-weight:600;color:var(--text)}'+
      '.cf-sres-h svg{width:15px;height:15px;color:var(--cyan)} .cf-sres-h .right,.dd-h .right{margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--faint);font-weight:400}'+
      '.cf-sload{padding:18px;display:flex;justify-content:center} .cf-serr{padding:14px;font-family:var(--mono);font-size:11px;color:#ff7185}'+
      '.cf-ipmain{padding:13px 14px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);background:rgba(43,212,238,.05)}'+
      '.cf-ipmain-l{font-family:var(--mono);font-size:9px;letter-spacing:1px;color:var(--faint)}'+
      '.cf-ipmain-v{margin-left:auto;font-family:var(--mono);font-size:18px;font-weight:600;color:var(--cyan)}'+
      '.cf-iplist{max-height:170px;overflow-y:auto}'+
      '.cf-ip{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border);font-size:12px}'+
      '.cf-iptype{font-family:var(--mono);font-size:8.5px;font-weight:700;letter-spacing:.5px;color:var(--amber-2);background:var(--amber-dim);border:1px solid rgba(245,166,35,.3);padding:2px 6px;border-radius:4px;flex:none}'+
      '.cf-ipval{flex:1;font-family:var(--mono);font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '.cf-ipcopy{width:24px;height:24px;border-radius:6px;border:1px solid var(--border-2);background:var(--surface-2);color:var(--faint);cursor:pointer;flex:none;font-size:12px}'+
      '.cf-ipcopy:hover{color:var(--cyan);border-color:rgba(43,212,238,.4)}'+
      '.cf-sres-act{padding:11px 14px;display:flex;gap:9px}'+
      '.cf-scanbtn{flex:1;height:33px;border-radius:8px;border:1px solid rgba(245,166,35,.4);background:var(--amber-dim);color:var(--amber-2);font-family:var(--mono);font-size:11px;font-weight:600;cursor:pointer}'+
      '.cf-scanbtn:hover{filter:brightness(1.12)} .cf-scanbtn:disabled{opacity:.55;cursor:default}'+
      /* shared dropdown (notifications + settings) */
      '.cf-dd{position:absolute;top:calc(100% + 4px);right:14px;width:344px;max-height:430px;overflow-y:auto;background:var(--surface-solid,#0d1320);border:1px solid var(--border-2);border-radius:12px;box-shadow:0 26px 70px -18px rgba(0,0,0,.65);z-index:60;display:none}'+
      '.cf-dd.open{display:block;animation:cfddin .18s ease}'+
      '.cf-dd .dd-h{position:sticky;top:0;background:var(--surface-solid,#0d1320)}'+
      '.cf-ddempty{padding:30px 16px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:11px}'+
      '.cf-note{display:flex;gap:11px;padding:11px 14px;border-bottom:1px solid var(--border)}'+
      '.cf-note .nd{width:8px;height:8px;border-radius:50%;margin-top:4px;flex:none}'+
      '.cf-note .nt{flex:1;min-width:0} .cf-note .ntitle{font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '.cf-note .nmeta{font-family:var(--mono);font-size:9px;color:var(--faint);margin-top:3px}'+
      '.cf-setsec{font-family:var(--mono);font-size:9px;letter-spacing:1.2px;color:var(--faint);padding:11px 14px 5px}'+
      '.cf-setrow{display:flex;align-items:center;gap:10px;padding:8px 14px;font-size:12.5px;color:var(--text)}'+
      '.cf-setrow>span:first-child{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '.cf-setv{font-family:var(--mono);font-size:11px;color:var(--dim)}'+
      '.cf-themebtns{display:flex;gap:6px} .cf-tbtn{font-family:var(--mono);font-size:10px;padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid var(--border-2);background:var(--surface-2);color:var(--faint)}'+
      '.cf-tbtn.on{color:var(--amber-2);border-color:rgba(245,166,35,.4);background:var(--amber-dim)}'+
      '.cf-signout{font-family:var(--mono);font-size:10px;font-weight:600;padding:6px 13px;border-radius:7px;cursor:pointer;border:1px solid rgba(244,73,94,.35);background:rgba(244,73,94,.1);color:#ff7185}'+
      '.cf-signout:hover{filter:brightness(1.15)}'+
      '#cfBadge{display:none}'+
      '.icon-btn{cursor:pointer}' + THEME_CSS;
    document.head.appendChild(st);
  }

  /* ---- dropdown open/close ---- */
  function closeDD(){ document.querySelectorAll('.cf-dd.open,.cf-sres.open').forEach(function(d){ d.classList.remove('open'); }); }
  var wiredDoc=false;
  function wireDoc(){
    if(wiredDoc) return; wiredDoc=true;
    document.addEventListener('click',function(e){
      if(e.target.closest('.cf-dd')||e.target.closest('.cf-sres')||e.target.closest('#cfBell')||e.target.closest('#cfGear')||e.target.closest('#cfAvatar')||e.target.closest('#cfSearchBox')) return;
      closeDD();
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape') closeDD();
      if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){ e.preventDefault(); var i=document.getElementById('cfSearch'); if(i){ i.focus(); i.select&&i.select(); } }
    });
  }

  /* ---- notifications (real) ---- */
  var cfNotes=[], cfUnread=0;
  function updateBadge(){ var b=document.getElementById('cfBadge'); if(!b) return; b.style.display=cfUnread>0?'block':'none'; }
  function loadNotes(){
    inv('agent_alerts').then(function(r){
      var list=(r&&r.data&&r.data.alerts)||[];
      cfNotes=list.map(function(a){
        var title=String(a.description||a.source||'Alert').split('\n')[0].replace(/^#+\s*/,'').slice(0,80);
        return { sev:a.severity||'info', title:title, meta:(a.source||'agent'), ts:a.created_at||a.timestamp };
      });
      cfUnread=cfNotes.length; updateBadge();
      var dd=document.getElementById('cfNotesDD'); if(dd&&dd.classList.contains('open')) renderNotes();
    }).catch(function(){});
  }
  function renderNotes(){
    var dd=document.getElementById('cfNotesDD'); if(!dd) return;
    var body=cfNotes.length? cfNotes.slice(0,30).map(function(n){ var c=sevColor(n.sev);
      return '<div class="cf-note"><span class="nd" style="background:'+c+';box-shadow:0 0 6px '+c+'"></span><div class="nt"><div class="ntitle">'+esc(n.title)+'</div><div class="nmeta">'+esc(n.meta)+(n.ts?(' · '+timeAgo(n.ts)):'')+'</div></div></div>';
    }).join('') : '<div class="cf-ddempty">No notifications — you’re all clear</div>';
    dd.innerHTML='<div class="dd-h">Notifications<span class="right">'+cfNotes.length+'</span></div>'+body;
  }
  function onLive(e){
    var d=(e&&e.detail)||{};
    cfNotes.unshift({ sev:d.severity||'info', title:String(d.message||d.verdict||d.url||d.indicator||'Live security event').slice(0,80), meta:d.category||d.source||'live', ts:new Date().toISOString() });
    cfUnread++; updateBadge();
    var dd=document.getElementById('cfNotesDD'); if(dd&&dd.classList.contains('open')) renderNotes();
  }

  /* ---- settings (real) ---- */
  function renderSettings(){
    var dd=document.getElementById('cfSetDD'); if(!dd) return;
    var t=curTheme();
    dd.innerHTML='<div class="dd-h">Settings</div>'+
      '<div class="cf-setsec">APPEARANCE</div>'+
      '<div class="cf-setrow"><span>Theme</span><span class="cf-themebtns"><button class="cf-tbtn'+(t==='dark'?' on':'')+'" data-theme="dark">Dark</button><button class="cf-tbtn'+(t==='light'?' on':'')+'" data-theme="light">Light</button></span></div>'+
      '<div class="cf-setsec">CONNECTION</div>'+
      '<div class="cf-setrow"><span>Backend API</span><span class="cf-setv" id="cfSetBackend">checking…</span></div>'+
      '<div class="cf-setrow"><span>ML Service</span><span class="cf-setv" id="cfSetMl">checking…</span></div>'+
      '<div class="cf-setsec">ACCOUNT</div>'+
      '<div class="cf-setrow"><span class="cf-setv" id="cfSetUser">—</span><button class="cf-signout" id="cfSignout">Sign out</button></div>';
    dd.querySelectorAll('.cf-tbtn').forEach(function(b){ b.addEventListener('click',function(){ applyTheme(b.dataset.theme); dd.querySelectorAll('.cf-tbtn').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); }); });
    var so=document.getElementById('cfSignout'); if(so) so.addEventListener('click',function(){ inv('auth_logout').catch(function(){}).then(function(){ location.href='login.html'; }); });
    inv('auth_get_user').then(function(u){ var user=(u&&(u.user||(u.data&&u.data.user)||u.data||u))||{}; set('cfSetUser', user.email||'Not signed in'); }).catch(function(){ set('cfSetUser','Not signed in'); });
    inv('agent_status').then(function(s){ var d=(s&&s.data)||{};
      var be=document.getElementById('cfSetBackend'); if(be){ be.textContent=d.backendOk?('Online · '+(d.latencyMs||0)+'ms'):'Offline'; be.style.color=d.backendOk?'var(--green)':'var(--faint)'; }
      var ml=document.getElementById('cfSetMl'); if(ml){ ml.textContent=d.mlOk?'Healthy':'Unavailable'; ml.style.color=d.mlOk?'var(--green)':'var(--faint)'; }
    }).catch(function(){});
  }

  /* ---- IP search (real, via Rust resolve_ip) ---- */
  function doIpSearch(){
    var inp=document.getElementById('cfSearch'); var box=document.getElementById('cfSres'); if(!inp||!box) return;
    var q=inp.value.trim(); if(!q){ box.classList.remove('open'); return; }
    box.classList.add('open');
    box.innerHTML='<div class="cf-sres-h">'+searchI+'<span>Resolving '+esc(q)+'…</span></div><div class="cf-sload"><div class="spinner sm"></div></div>';
    inv('resolve_ip',{host:q}).then(function(r){
      if(r&&r.success) renderIpResult(r);
      else box.innerHTML='<div class="cf-sres-h">'+globeI+'<span>'+esc((r&&r.host)||q)+'</span></div><div class="cf-serr">'+esc((r&&r.error)||'Could not resolve')+'</div>';
    }).catch(function(){
      box.innerHTML='<div class="cf-serr">IP search needs the latest app build — restart <code>npm run dev</code> to enable it.</div>';
    });
  }
  function renderIpResult(r){
    var box=document.getElementById('cfSres'); if(!box) return;
    var v4=r.ipv4||[], v6=r.ipv6||[];
    function row(ip,kind){ return '<div class="cf-ip"><span class="cf-iptype">'+kind+'</span><span class="cf-ipval">'+esc(ip)+'</span><button class="cf-ipcopy" data-ip="'+esc(ip)+'" title="Copy">⧉</button></div>'; }
    var html='<div class="cf-sres-h">'+globeI+'<span>'+esc(r.host)+'</span><span class="right">'+r.count+' record'+(r.count===1?'':'s')+'</span></div>';
    html+='<div class="cf-ipmain"><span class="cf-ipmain-l">PRIMARY IP</span><span class="cf-ipmain-v">'+esc(r.ip)+'</span></div>';
    html+='<div class="cf-iplist">'+v4.map(function(i){return row(i,'IPv4');}).join('')+v6.map(function(i){return row(i,'IPv6');}).join('')+'</div>';
    html+='<div class="cf-sres-act"><button class="cf-scanbtn" data-host="'+esc(r.host)+'">Run threat scan on this site →</button></div>';
    box.innerHTML=html;
    box.querySelectorAll('.cf-ipcopy').forEach(function(b){ b.addEventListener('click',function(){ try{ navigator.clipboard.writeText(b.dataset.ip); }catch(e){} if(window.CF&&CF.toast)CF.toast('Copied '+b.dataset.ip,'ok'); }); });
    var sb=box.querySelector('.cf-scanbtn'); if(sb) sb.addEventListener('click',function(){ runScan(r.host, sb); });
  }
  function runScan(host, btn){
    btn.disabled=true; btn.textContent='Scanning '+host+'…';
    inv('scan_url',{url:'https://'+host}).then(function(r){
      var d=(r&&(r.data||r))||{};
      var verdict=d.verdict||d.classification||d.label||(d.malicious?'malicious':'')||(d.success?'clean':'completed');
      var bad=/mal|phish|threat|suspic|danger/i.test(String(verdict));
      if(window.CF&&CF.toast) CF.toast(host+' → '+verdict, bad?'error':'ok');
    }).catch(function(){ if(window.CF&&CF.toast) CF.toast('Scan needs sign-in / latest build','warn'); })
    .then(function(){ btn.disabled=false; btn.textContent='Run threat scan on this site →'; });
  }

  /* ============================================================ */
  window.buildHeader=function(o){
    ensureStyle();
    o=o||{};
    const search=o.search||'Search a website for its IP — e.g. github.com';
    const status=o.status||'MONITORING';
    const chips=(o.chips!==undefined)?o.chips:
      '<div class="tb-chip"><span class="dot rec"></span>REC</div>'+
      '<div class="tb-chip"><span class="dot" style="background:var(--green)"></span>ON</div>';
    const cta=o.cta||'Quick Scan';
    const threats=o.threats?('<div class="pill-threats" id="tbThreats">'+threatI+' '+o.threats+' threats</div>'):'';
    const html=
      '<div class="lights"><i class="r"></i><i class="y"></i><i class="g"></i></div>'+
      '<div class="brand"><a class="logo-mark" href="threat-overview.html">'+MARK+'</a><div class="name"><b>Cyber<span class="fg">Forge</span></b><span>AI SECURITY</span></div></div>'+
      '<div class="tb-group">'+chips+'</div>'+
      '<div class="search" id="cfSearchBox">'+searchI+'<input id="cfSearch" class="cf-sinput" placeholder="'+esc(search)+'" autocomplete="off" spellcheck="false" /><span class="kbd">↵</span><div class="cf-sres" id="cfSres"></div></div>'+
      '<div class="tb-status"><div class="spinner sm"></div>'+status+'</div>'+
      threats+
      '<button class="btn-scan">'+bolt+cta+'</button>'+
      '<button class="icon-btn" id="cfBell" title="Notifications"><span class="badge" id="cfBadge"></span>'+bell+'</button>'+
      '<button class="icon-btn" id="cfTheme" title="Toggle theme">'+(curTheme()==='light'?sun:moon)+'</button>'+
      '<button class="icon-btn" id="cfGear" title="Settings">'+gear+'</button>'+
      '<div class="avatar" id="cfAvatar" title="Account">'+user+'</div>';
    const el=document.getElementById('topbar');
    if(!el) return;
    el.className='topbar'; el.innerHTML=html;

    // dropdown containers (children of topbar → positioned in its space)
    var notesDD=document.createElement('div'); notesDD.className='cf-dd'; notesDD.id='cfNotesDD'; el.appendChild(notesDD);
    var setDD=document.createElement('div'); setDD.className='cf-dd'; setDD.id='cfSetDD'; el.appendChild(setDD);

    if(window.attachRipple){ var bs=el.querySelector('.btn-scan'); if(bs) attachRipple(bs); }
    applyTheme(curTheme()); // sets the toggle icon to match
    wireDoc();

    // Notifications
    var bellBtn=document.getElementById('cfBell');
    if(bellBtn) bellBtn.addEventListener('click',function(ev){ ev.stopPropagation(); var open=notesDD.classList.contains('open'); closeDD(); if(!open){ renderNotes(); notesDD.classList.add('open'); cfUnread=0; updateBadge(); } });

    // Theme toggle
    var themeBtn=document.getElementById('cfTheme');
    if(themeBtn) themeBtn.addEventListener('click',function(){ applyTheme(curTheme()==='light'?'dark':'light'); });

    // Settings (gear + avatar)
    function openSettings(ev){ ev.stopPropagation(); var open=setDD.classList.contains('open'); closeDD(); if(!open){ renderSettings(); setDD.classList.add('open'); } }
    var gearBtn=document.getElementById('cfGear'); if(gearBtn) gearBtn.addEventListener('click',openSettings);
    var avatarBtn=document.getElementById('cfAvatar'); if(avatarBtn) avatarBtn.addEventListener('click',openSettings);

    // IP search
    var inp=document.getElementById('cfSearch');
    if(inp){
      inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); doIpSearch(); } });
      inp.addEventListener('input',function(){ if(!inp.value.trim()){ var b=document.getElementById('cfSres'); if(b) b.classList.remove('open'); } });
    }
    var sbox=document.getElementById('cfSearchBox'); if(sbox) sbox.addEventListener('click',function(e){ if(e.target===sbox||e.target.tagName==='svg'||e.target.tagName==='path'||e.target.tagName==='circle'){ if(inp) inp.focus(); } });

    // Quick Scan → scan the typed site, else open the Sandbox
    var scanBtn=el.querySelector('.btn-scan');
    if(scanBtn) scanBtn.addEventListener('click',function(){ var q=inp&&inp.value.trim(); if(q){ doIpSearch(); } else { location.href='sandbox.html'; } });

    // initial + live notifications
    loadNotes();
    if(!window.__cfLiveNotesWired){ window.__cfLiveNotesWired=true; window.addEventListener('cf:alert',onLive); window.addEventListener('cf:threat',onLive); }
  };
})();
