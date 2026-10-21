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
  const user='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 11.6a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6Z"/><path d="M4.6 19.4c0-3.25 3.46-5.3 7.4-5.3s7.4 2.05 7.4 5.3c0 1-.82 1.8-1.82 1.8H6.42c-1 0-1.82-.8-1.82-1.8Z"/></svg>';
  /* settings-section glyphs */
  const icProfile='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>';
  const icPaint='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.4"/><circle cx="17.5" cy="10.5" r="1.4"/><circle cx="8.5" cy="7.5" r="1.4"/><circle cx="6.5" cy="12.5" r="1.4"/><path d="M12 2a10 10 0 0 0 0 20c1.4 0 2-1 2-2 0-.6-.3-1-.7-1.4-.4-.4-.6-.8-.6-1.3 0-1 .8-1.8 1.8-1.8H16a6 6 0 0 0 6-6c0-4.4-4.5-7.5-10-7.5Z"/></svg>';
  const icShield='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>';
  const icPlug='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v6"/></svg>';
  const icCpu='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9.5 2v3M14.5 2v3M9.5 19v3M14.5 19v3M2 9.5h3M2 14.5h3M19 9.5h3M19 14.5h3"/></svg>';
  const icChip='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="4"/></svg>';
  const icInfo='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>';
  const icClose='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const icOut='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/></svg>';
  function appVersion(){return window.CFConsole&&CFConsole.state.version?CF.esc(CFConsole.state.version):'unavailable';}
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
  try{ if(localStorage.getItem('cf-reduce-motion')==='1') document.documentElement.setAttribute('data-motion','reduce'); }catch(e){}
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

  function applyTheme(t,silent){
    t=(t==='light')?'light':'dark';
    try{ localStorage.setItem('cf-theme',t); }catch(e){}
    if(t==='light') document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
    var tb=document.getElementById('cfTheme'); if(tb) tb.innerHTML=(t==='light')?sun:moon;
    propagateTheme(t);
    if(!silent&&window.CF&&CF.toast) CF.toast((t==='light'?'Light':'Dark')+' theme','ok');
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
      '#cfBadge{display:none}'+
      '.icon-btn{cursor:pointer}'+
      /* ---------- refined header (improved visuals, all pages) ---------- */
      '.topbar{height:54px;gap:11px;background:linear-gradient(180deg,rgba(17,24,38,.96),rgba(10,14,23,.93)) !important}'+
      '.topbar::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(245,166,35,.4),rgba(43,212,238,.34),transparent);opacity:.7;pointer-events:none}'+
      '.topbar{padding-left:18px} .topbar .brand{padding-left:0}'+
      '.topbar .brand .name b{font-size:14.5px} .topbar .brand .name span{font-size:8px;letter-spacing:2.4px}'+
      '.topbar .tb-chip{height:28px;border-radius:8px;font-size:10.5px;background:var(--surface);border-color:var(--border)}'+
      '.topbar .search{height:33px;border-radius:10px;background:rgba(8,12,20,.66);transition:border-color .18s,box-shadow .18s}'+
      '.topbar .search:focus-within{border-color:rgba(43,212,238,.5);box-shadow:0 0 0 3px rgba(43,212,238,.1)}'+
      '.topbar .tb-status{font-size:10.5px;letter-spacing:.8px;padding:0 2px}'+
      '.topbar .pill-threats{height:30px;border-radius:9px}'+
      '.topbar .btn-scan{height:33px;border-radius:10px;font-size:12.5px;padding:0 15px}'+
      '.topbar .icon-btn{width:33px;height:33px;border-radius:10px;background:var(--surface-2);transition:.18s}'+
      '.topbar .icon-btn:hover{color:var(--cyan);border-color:rgba(43,212,238,.4);background:var(--cyan-dim);transform:translateY(-1px)}'+
      '.topbar .icon-btn svg{width:16px;height:16px}'+
      '.topbar .icon-btn .badge{width:9px;height:9px;background:var(--red);box-shadow:0 0 7px var(--red);border-color:var(--surface-solid,#0d1320)}'+
      /* ---------- modern circular avatar ---------- */
      '.topbar .avatar{width:31px;height:31px;border-radius:50%;border:1.5px solid var(--border-2);background:linear-gradient(135deg,#1d3a52,#0f2231);position:relative;overflow:hidden;transition:.18s;margin-left:1px}'+
      '.topbar .avatar:hover{border-color:rgba(43,212,238,.7);box-shadow:0 0 0 3px rgba(43,212,238,.13);transform:translateY(-1px)}'+
      '.avatar .cf-avico{display:grid;place-items:center;width:100%;height:100%;color:var(--cyan)} .avatar .cf-avico svg{width:17px;height:17px}'+
      '.avatar .cf-avinit{display:none;position:absolute;inset:0;place-items:center;font-family:var(--sans);font-weight:700;font-size:13px;color:#0a1118;background:linear-gradient(135deg,#ffc760,#f5a623)}'+
      '.avatar.has-init .cf-avico{display:none} .avatar.has-init .cf-avinit{display:grid}'+
      /* ---------- full settings modal ---------- */
      '@keyframes cfmovin{from{opacity:0}to{opacity:1}} @keyframes cfmwin{from{transform:translateY(12px) scale(.985);opacity:.4}to{transform:none;opacity:1}}'+
      '.cf-mov{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:26px;background:rgba(3,6,12,.66);backdrop-filter:blur(12px);animation:cfmovin .2s ease}'+
      '.cf-mw{width:930px;max-width:96vw;height:606px;max-height:90vh;display:flex;overflow:hidden;background:var(--surface-solid,#0d1320);border:1px solid var(--border-2);border-radius:18px;box-shadow:0 50px 130px -28px rgba(0,0,0,.85),0 0 0 1px rgba(0,0,0,.4);animation:cfmwin .26s cubic-bezier(.2,.9,.25,1)}'+
      '.cf-mside{width:230px;flex:none;border-right:1px solid var(--border);background:linear-gradient(180deg,rgba(255,255,255,.025),transparent);display:flex;flex-direction:column;padding:18px 12px}'+
      '.cf-mside-h{display:flex;align-items:center;gap:11px;padding:4px 8px 15px;border-bottom:1px solid var(--border);margin-bottom:12px}'+
      '.cf-mside-h .cf-mark{width:27px;height:27px} .cf-mside-h b{font-size:15px;font-weight:700} .cf-mside-h b .fg{color:var(--brand-orange)} .cf-mside-h small{display:block;font-family:var(--mono);font-size:8px;letter-spacing:2px;color:var(--faint);margin-top:2px}'+
      '.cf-mnav{display:flex;flex-direction:column;gap:3px;flex:1;overflow-y:auto}'+
      '.cf-mni{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;cursor:pointer;color:var(--dim);font-size:13px;font-weight:500;border:1px solid transparent;transition:.14s}'+
      '.cf-mni svg{width:16px;height:16px;flex:none}'+
      '.cf-mni:hover{background:var(--surface-2);color:var(--text)}'+
      '.cf-mni.on{background:var(--cyan-dim);color:var(--cyan);border-color:rgba(43,212,238,.28)}'+
      '.cf-mside-f{font-family:var(--mono);font-size:9px;color:var(--faint);padding:11px 10px 2px;letter-spacing:.4px;border-top:1px solid var(--border);margin-top:10px}'+
      '.cf-mmain{flex:1;display:flex;flex-direction:column;min-width:0}'+
      '.cf-mtop{display:flex;align-items:center;gap:12px;padding:17px 22px;border-bottom:1px solid var(--border)}'+
      '.cf-mtop h3{font-size:16px;font-weight:600;flex:1;min-width:0} .cf-mtop h3 small{display:block;font-weight:400;font-size:11px;color:var(--faint);margin-top:3px;font-family:var(--mono)}'+
      '.cf-mclose{width:33px;height:33px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--dim);cursor:pointer;display:grid;place-items:center;flex:none;transition:.16s} .cf-mclose svg{width:15px;height:15px}'+
      '.cf-mclose:hover{color:#ff7185;border-color:rgba(244,73,94,.4);background:rgba(244,73,94,.1)}'+
      '.cf-mbody{flex:1;overflow-y:auto;padding:20px 22px}'+
      '.cf-sectn{font-family:var(--mono);font-size:10px;letter-spacing:1.5px;color:var(--faint);margin:4px 2px 9px}'+
      '.cf-sectn:not(:first-child){margin-top:22px}'+
      '.cf-card{background:var(--surface-2);border:1px solid var(--border);border-radius:13px;padding:2px 16px}'+
      '.cf-srow{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border);min-height:30px}'+
      '.cf-srow:last-child{border-bottom:none}'+
      '.cf-srow .l{flex:1;min-width:0} .cf-srow .lt{font-size:13px;color:var(--text);font-weight:500} .cf-srow .ls{font-size:11px;color:var(--faint);margin-top:3px;font-family:var(--mono);white-space:normal;line-height:1.5}'+
      '.cf-srow .rv{font-family:var(--mono);font-size:12px;color:var(--dim);text-align:right;max-width:54%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '.cf-srow .r{flex:none;display:flex;align-items:center;gap:8px;justify-content:flex-end}'+
      '.cf-srow .ls code{font-family:var(--mono);font-size:10.5px;color:var(--cyan);background:var(--cyan-dim);padding:1px 5px;border-radius:4px}'+
      '.cf-srow.col{flex-direction:column;align-items:stretch;gap:9px}'+
      'html[data-motion="reduce"] *,html[data-motion="reduce"] *::before,html[data-motion="reduce"] *::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important;scroll-behavior:auto !important}'+
      '.cf-prof{display:flex;align-items:center;gap:15px;padding:6px 0 16px}'+
      '.cf-prof .av{width:54px;height:54px;border-radius:50%;flex:none;display:grid;place-items:center;font-family:var(--sans);font-weight:700;font-size:22px;color:#0a1118;background:linear-gradient(135deg,#ffc760,#f5a623);border:1px solid rgba(245,166,35,.5)}'+
      '.cf-prof .pn{font-size:16px;font-weight:600;color:var(--text)} .cf-prof .pe{font-family:var(--mono);font-size:12px;color:var(--dim);margin-top:3px}'+
      '.cf-btn{height:34px;padding:0 15px;border-radius:9px;border:1px solid var(--border-2);background:var(--surface-2);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap}'+
      '.cf-btn svg{width:14px;height:14px} .cf-btn:hover{border-color:var(--border-3);transform:translateY(-1px)} .cf-btn:disabled{opacity:.5;cursor:default;transform:none}'+
      '.cf-btn.pri{border-color:rgba(245,166,35,.55);background:linear-gradient(180deg,#ffc15a,#f5a623);color:#1a1206}'+
      '.cf-btn.dng{border-color:rgba(244,73,94,.4);background:rgba(244,73,94,.1);color:#ff7185}'+
      '.cf-input{height:36px;width:100%;border-radius:9px;border:1px solid var(--border-2);background:rgba(8,12,20,.6);color:var(--text);padding:0 12px;font-family:var(--mono);font-size:12px;outline:none}'+
      '.cf-input:focus{border-color:rgba(43,212,238,.5);box-shadow:0 0 0 3px rgba(43,212,238,.08)}'+
      '.cf-inrow{display:flex;gap:9px}'+
      '.cf-eye{width:36px;height:36px;border-radius:9px;border:1px solid var(--border-2);background:var(--surface-2);color:var(--dim);cursor:pointer;display:grid;place-items:center;flex:none;transition:.15s} .cf-eye:hover{color:var(--cyan);border-color:rgba(43,212,238,.4)} .cf-eye svg{width:16px;height:16px}'+
      '.cf-hint{display:flex;align-items:center;gap:8px;margin-top:9px;font-family:var(--mono);font-size:11px;color:var(--dim)}'+
      '.cf-hint .k{color:var(--faint)} .cf-hint b{color:var(--cyan);font-weight:600;letter-spacing:.3px} .cf-hint .src{margin-left:auto;color:var(--faint);font-size:10px}'+
      '.cf-badge{font-family:var(--mono);font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:.4px;flex:none}'+
      '.cf-badge.g{color:var(--green);background:rgba(67,224,138,.12);border:1px solid rgba(67,224,138,.32)}'+
      '.cf-badge.r{color:#ff7185;background:rgba(244,73,94,.1);border:1px solid rgba(244,73,94,.3)}'+
      '.cf-badge.d{color:var(--faint);background:var(--surface-2);border:1px solid var(--border)}'+
      '.cf-seg{display:inline-flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:3px}'+
      '.cf-seg button{font-family:var(--sans);font-size:12px;font-weight:600;padding:6px 16px;border-radius:7px;cursor:pointer;border:none;background:transparent;color:var(--faint);display:inline-flex;align-items:center;gap:6px} .cf-seg button svg{width:13px;height:13px}'+
      '.cf-seg button.on{color:var(--text);background:var(--cyan-dim);box-shadow:inset 0 0 0 1px rgba(43,212,238,.3)}'+
      '.cf-sw{width:42px;height:24px;border-radius:20px;border:1px solid var(--border-2);background:var(--surface);position:relative;cursor:pointer;flex:none;transition:.2s}'+
      '.cf-sw::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--faint);transition:.2s}'+
      '.cf-sw.on{background:rgba(67,224,138,.25);border-color:rgba(67,224,138,.5)} .cf-sw.on::after{left:20px;background:var(--green)}'+
      '.cf-msg{font-family:var(--mono);font-size:11px;color:var(--faint);padding:14px 2px;display:flex;align-items:center;gap:8px}'+
      '.cf-note-info{font-size:11.5px;color:var(--faint);line-height:1.6;padding:2px 2px 0;font-family:var(--sans)}' + THEME_CSS;
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

  /* ===========================================================
     SETTINGS — full functional screen (modal overlay)
     Opens from the header gear (and the avatar → Account).
     Every section is wired to a real Rust command.
     =========================================================== */
  function initialOf(s){ s=String(s||'').trim(); return (s ? s[0] : '?').toUpperCase(); }
  function reduceMotion(){ try{ return localStorage.getItem('cf-reduce-motion')==='1'; }catch(e){ return false; } }
  function applyMotion(on){
    try{ localStorage.setItem('cf-reduce-motion', on?'1':'0'); }catch(e){}
    if(on) document.documentElement.setAttribute('data-motion','reduce');
    else document.documentElement.removeAttribute('data-motion');
    if(window.CF&&CF.toast) CF.toast(on?'Reduced motion on':'Motion restored','ok');
  }
  /* generic settings row */
  function srow(lt, ls, right){
    return '<div class="cf-srow"><div class="l"><div class="lt">'+lt+'</div>'+(ls?('<div class="ls">'+ls+'</div>'):'')+'</div>'+(right!=null?('<div class="r">'+right+'</div>'):'')+'</div>';
  }

  var SECTIONS=[
    { k:'account',    ic:icProfile, label:'Account',      sub:'Your CyberForge identity' },
    { k:'appearance', ic:icPaint,   label:'Appearance',   sub:'Theme & motion' },
    { k:'ai',         ic:icChip,    label:'AI & Models',  sub:'Assistant agents and your optional token' },
    { k:'connection', ic:icPlug,    label:'Connection',   sub:'Server & Analysis Agents' },
    { k:'system',     ic:icCpu,     label:'System',       sub:'Device profile & PATH' },
    { k:'security',   ic:icShield,  label:'Security',      sub:'Credentials & network' },
    { k:'privacy',    ic:icShield,  label:'Privacy',       sub:'What is collected and sent' },
    { k:'diagnostics', ic:icCpu, label:'Diagnostics', sub:'Runtime, events & model readiness' },
    { k:'integrations', ic:icPlug, label:'Integrations', sub:'CLI setup & supported commands' },
    { k:'about',      ic:icInfo,    label:'About',         sub:'Version & privacy' }
  ];

  /* ---- section renderers (each wired to a real command) ---- */
  function secAccount(b){
    b.innerHTML=
      '<div class="cf-prof"><div class="av" id="cfPfAv">·</div><div><div class="pn" id="cfPfName">Loading…</div><div class="pe" id="cfPfEmail">—</div></div></div>'+
      '<div class="cf-sectn">SESSION</div><div class="cf-card">'+
        srow('Status','Local session on this device','<span class="cf-badge d" id="cfPfStatus">checking…</span>')+
        srow('Sign out','End this session — your local data is kept','<button class="cf-btn dng" id="cfPfOut">'+icOut+'Sign out</button>')+
      '</div>'+
      '<div class="cf-note-info">CyberForge keeps your data on-device. Signing out clears the local session; your scans, intel and memory stay stored locally.</div>';
    b.querySelector('#cfPfOut').addEventListener('click',function(){ inv('auth_logout').catch(function(){}).then(function(){ location.href='login.html'; }); });
    inv('auth_get_user').then(function(u){
      var user=(u&&(u.user||(u.data&&u.data.user)||u.data))||{};
      var email=user.email||''; var name=user.name||user.fullName||user.username||(email?email.split('@')[0]:'');
      set('cfPfName', name||'Not signed in'); set('cfPfEmail', email||'Sign in to sync across devices');
      var av=b.querySelector('#cfPfAv'); if(av) av.textContent=initialOf(name||email||'?');
      var st=b.querySelector('#cfPfStatus'); if(st){ st.className='cf-badge '+(email?'g':'r'); st.textContent=email?'Signed in':'Signed out'; }
    }).catch(function(){ set('cfPfName','Not signed in'); set('cfPfEmail','—'); });
  }
  function secAppearance(b){
    var t=curTheme(), rm=reduceMotion();
    b.innerHTML=
      '<div class="cf-sectn">THEME</div><div class="cf-card">'+
        srow('Color theme','Dark or light surfaces, app-wide','<div class="cf-seg" id="cfThemeSeg"><button data-theme="dark" class="'+(t==='dark'?'on':'')+'">'+moon+'Dark</button><button data-theme="light" class="'+(t==='light'?'on':'')+'">'+sun+'Light</button></div>')+
      '</div>'+
      '<div class="cf-sectn">MOTION</div><div class="cf-card">'+
        srow('Reduce motion','Minimise animations and transitions','<div class="cf-sw'+(rm?' on':'')+'" id="cfRmSw" role="switch" tabindex="0"></div>')+
      '</div>'+
      '<div class="cf-note-info">Your preferences are saved on this device and apply to every screen, including the floating agent panel.</div>';
    b.querySelectorAll('#cfThemeSeg button').forEach(function(btn){ btn.addEventListener('click',function(){ applyTheme(btn.dataset.theme); b.querySelectorAll('#cfThemeSeg button').forEach(function(x){x.classList.remove('on');}); btn.classList.add('on'); }); });
    var sw=b.querySelector('#cfRmSw'); if(sw) sw.addEventListener('click',function(){ var on=!sw.classList.contains('on'); sw.classList.toggle('on',on); applyMotion(on); });
  }
  function secAi(b){
    var eyeOn='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    var eyeOff='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.2 3.9M6.3 6.3A16 16 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3-.5"/></svg>';
    b.innerHTML=
      '<div class="cf-sectn">ASSISTANT</div><div class="cf-card">'+
        srow('Your token (optional)','Sends questions straight to DeepSeek on Hugging Face','<span class="cf-badge d" id="cfAiStat">checking…</span>')+
        srow('Answers come from','The Analysis Agents\' open-source model, or DeepSeek directly if you save your own token below. Each answer names its agent.','<span class="rv">Analysis Agents by default</span>')+
        '<div class="cf-srow col"><div class="l"><div class="lt">Access token</div><div class="ls">Paste a Hugging Face token (hf_…). Kept in your system credential store — sent only to Hugging Face.</div></div>'+
          '<div class="cf-inrow"><input class="cf-input" id="cfHfTok" type="password" placeholder="hf_xxxxxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false"/>'+
            '<button class="cf-eye" id="cfHfEye" title="Show / hide token" type="button">'+eyeOn+'</button>'+
            '<button class="cf-btn pri" id="cfHfSave">Save</button></div>'+
          '<div class="cf-hint" id="cfHfHint" style="display:none"><span class="k">Saved token</span><b id="cfHfMask">—</b><span class="src" id="cfHfSrc"></span></div>'+
        '</div>'+
      '</div>'+
      '<div class="cf-note-info" id="cfHfNote">The token is kept in your system credential store (Windows Credential Manager, macOS Keychain or the Secret Service). It is not written to a file and is not shown again after saving: only a masked preview is.</div>';
    b.insertAdjacentHTML('beforeend','<a class="cf-btn" href="model-inference.html">Model capabilities and limitations</a>');
    var inp=b.querySelector('#cfHfTok'), shown=false;
    function loadHf(){
      inv('hf_token_get').then(function(r){
        var ok=r&&r.configured; var s=b.querySelector('#cfAiStat');
        if(s){ s.className='cf-badge '+(ok?'g':'r'); s.textContent=ok?'Connected':'Not connected'; }
        var hint=b.querySelector('#cfHfHint');
        // The saved token is never sent to this page: only its masked form and source.
        if(inp){ inp.value=''; inp.placeholder=ok?'saved — paste a new token to replace it':'hf_xxxxxxxxxxxxxxxxxxxx'; }
        if(ok){
          if(hint){ hint.style.display='flex'; set('cfHfMask', r.masked||'saved'); set('cfHfSrc', r.source?('from the '+r.source):''); }
          var note=b.querySelector('#cfHfNote');
          if(note && r.plaintext){ note.style.color='#ff9aa6'; note.textContent='This token is still in a plaintext file because the system credential store is not working on this machine. See Settings > Security for the reason.'; }
        }else if(hint){ hint.style.display='none'; }
      }).catch(function(){
        // older build without hf_token_get → fall back to the boolean status
        inv('hf_token_status').then(function(r){ var ok=r&&r.configured; var s=b.querySelector('#cfAiStat'); if(s){ s.className='cf-badge '+(ok?'g':'r'); s.textContent=ok?'Connected':'Not connected'; } }).catch(function(){ var s=b.querySelector('#cfAiStat'); if(s){ s.className='cf-badge d'; s.textContent='Unavailable'; } });
      });
    }
    loadHf();
    var eye=b.querySelector('#cfHfEye'); if(eye) eye.addEventListener('click',function(){ shown=!shown; if(inp) inp.type=shown?'text':'password'; eye.innerHTML=shown?eyeOff:eyeOn; });
    var sv=b.querySelector('#cfHfSave'); if(sv) sv.addEventListener('click',function(){ var v=(inp&&inp.value||'').trim(); if(!v){ if(window.CF&&CF.toast)CF.toast('Paste a token first','warn'); return; } sv.disabled=true; sv.textContent='Saving…'; inv('set_hf_token',{token:v}).then(function(){ if(window.CF&&CF.toast)CF.toast('Token saved to the credential store','ok'); loadHf(); }).catch(function(e){ var why=String((e&&e.message)||e||'Could not save the token'); if(window.CF&&CF.toast)CF.toast(why,'error'); var note=b.querySelector('#cfHfNote'); if(note){ note.style.color='#ff9aa6'; note.textContent=why; } }).then(function(){ sv.disabled=false; sv.textContent='Save'; }); });
  }
  function secConnection(b){
    b.innerHTML=
      '<div class="cf-sectn">SERVICES</div><div class="cf-card">'+
        srow('Server API','Cloud sync & threat intelligence','<span class="cf-badge d" id="cfCBe">checking…</span>')+
        srow('Analysis Agents','Phishing & IOC detection models','<span class="cf-badge d" id="cfCMl">checking…</span>')+
        srow('Active agents','Registered agents + this device','<span class="rv" id="cfCAg">—</span>')+
        srow('Open threats','Across your workspace','<span class="rv" id="cfCTh">—</span>')+
      '</div>'+
      '<div class="cf-srow" style="border:none;padding-left:0"><button class="cf-btn" id="cfConnRef">Refresh status</button></div>';
    function loadConn(){ inv('agent_status').then(function(s){ var d=(s&&s.data)||{};
      var be=b.querySelector('#cfCBe'); if(be){ be.className='cf-badge '+(d.backendOk?'g':'r'); be.textContent=d.backendOk?('Online · '+(d.latencyMs||0)+'ms'):'Offline'; }
      var ml=b.querySelector('#cfCMl'); if(ml){ ml.className='cf-badge '+(d.mlOk?'g':'r'); ml.textContent=d.mlOk?'Healthy':'Unavailable'; }
      set('cfCAg', String(d.agentCount!=null?d.agentCount:'—')); set('cfCTh', String(d.threatCount!=null?d.threatCount:'—'));
    }).catch(function(){ var be=b.querySelector('#cfCBe'); if(be){ be.className='cf-badge d'; be.textContent='Unavailable'; } }); }
    loadConn();
    var rf=b.querySelector('#cfConnRef'); if(rf) rf.addEventListener('click',function(){ rf.disabled=true; rf.textContent='Refreshing…'; loadConn(); setTimeout(function(){ rf.disabled=false; rf.textContent='Refresh status'; },900); });
  }
  function secSystem(b){
    b.innerHTML=
      '<div class="cf-sectn">DEVICE</div><div class="cf-card">'+
        srow('Operating system','','<span class="rv" id="cfSyOs">loading…</span>')+
        srow('Processor','','<span class="rv" id="cfSyCpu">—</span>')+
        srow('Memory','','<span class="rv" id="cfSyMem">—</span>')+
        srow('Storage','','<span class="rv" id="cfSySto">—</span>')+
        srow('Hostname','','<span class="rv" id="cfSyHost">—</span>')+
      '</div>'+
      '<div class="cf-sectn">COMMAND-LINE ACCESS</div><div class="cf-card">'+
        srow('CyberForge on PATH','Run <code>cyberforge</code> from any terminal','<span class="cf-badge d" id="cfSyPath">checking…</span>')+
        '<div class="cf-srow"><div class="l"><div class="ls" id="cfSyBin" style="word-break:break-all">—</div></div><button class="cf-btn" id="cfSyAdd">Add to PATH</button></div>'+
      '</div>';
    inv('get_system_profile').then(function(p){ var d=(p&&p.data)||{}; var os=d.os||{}, cpu=d.cpu||{}, mem=d.memory||{}, sto=d.storage||{};
      set('cfSyOs',(os.pretty||os.name||'Unknown')+(os.arch?(' · '+os.arch):''));
      set('cfSyCpu',(cpu.brand||'Processor')+(cpu.cores?(' · '+cpu.cores+' cores'):''));
      set('cfSyMem',mem.label||(mem.totalGb?(mem.totalGb+' GB'):'—'));
      set('cfSySto',sto.label||'—'); set('cfSyHost',d.hostname||'—');
    }).catch(function(){ set('cfSyOs','Needs the latest app build'); });
    function loadPath(){ inv('get_path_status').then(function(r){ var present=r&&r.present; var pb=b.querySelector('#cfSyPath'); if(pb){ pb.className='cf-badge '+(present?'g':'d'); pb.textContent=present?'Registered':'Not added'; } set('cfSyBin',(r&&r.bin)||''); var add=b.querySelector('#cfSyAdd'); if(add) add.style.display=present?'none':''; }).catch(function(){}); }
    loadPath();
    var addb=b.querySelector('#cfSyAdd'); if(addb) addb.addEventListener('click',function(){ addb.disabled=true; addb.textContent='Adding…'; inv('add_to_path').then(function(r){ if(window.CF&&CF.toast)CF.toast((r&&r.alreadyPresent)?'Already on PATH':'Added to PATH','ok'); loadPath(); }).catch(function(){ if(window.CF&&CF.toast)CF.toast('Could not modify PATH','error'); }).then(function(){ addb.disabled=false; addb.textContent='Add to PATH'; }); });
  }
  function secSecurity(b){
    b.innerHTML=
      '<div class="cf-sectn">PROTECTION LISTS</div><div class="cf-card">'+
        srow('Blocked sites','Resolved to localhost via the hosts file','<span class="rv" id="cfSecB">—</span>')+
        srow('Saved sites','A list only: nothing is enforced for them','<span class="rv" id="cfSecP">—</span>')+
        srow('Allowed sites','Unblocked by you; still scanned','<span class="rv" id="cfSecA">—</span>')+
      '</div>'+
      '<div class="cf-sectn">CREDENTIALS</div><div class="cf-card">'+
        srow('Credential storage','Where the sign-in session and the AI token are kept','<span class="rv" id="cfSecStore">checking…</span>')+
      '</div>'+
      '<div class="cf-note-info" id="cfSecStoreNote" style="display:none"></div>'+
      '<div class="cf-sectn">NETWORK</div><div class="cf-card">'+
        srow('Public IP','Your current outbound address','<span class="rv" id="cfSecIp">checking…</span>')+
      '</div>'+
      '<div class="cf-srow" style="border:none;padding-left:0"><button class="cf-btn" id="cfSecManage">'+icShield+'Manage in Protection</button></div>';
    function cnt(cmd,id){ inv(cmd).then(function(r){ set(id, String((r&&r.count)!=null?r.count:0)); }).catch(function(){ set(id,'—'); }); }
    cnt('list_blocked','cfSecB'); cnt('list_protected','cfSecP'); cnt('list_allowed','cfSecA');
    inv('public_ip').then(function(r){ set('cfSecIp',(r&&r.ip)||'Unavailable'); }).catch(function(){ set('cfSecIp','Unavailable'); });
    // Whether the system credential store keeps a value on this machine. When it
    // does not, sign-in lasts until the app closes and the reason is shown here.
    inv('credential_storage_status').then(function(r){
      var note=b.querySelector('#cfSecStoreNote');
      if(r&&r.working){ set('cfSecStore','System credential store · working'); return; }
      set('cfSecStore','Not working');
      if(note){ note.style.display='block'; note.style.color='#ff9aa6';
        note.textContent='The system credential store did not keep a test value'+((r&&r.reason)?(': '+r.reason):'')+'. Sign-in lasts until the app closes, and an AI token cannot be saved. Nothing is written to a file instead.'; }
    }).catch(function(){ set('cfSecStore','Unknown (older build)'); });
    var mg=b.querySelector('#cfSecManage'); if(mg) mg.addEventListener('click',function(){ closeSettingsModal(); location.href='security-functions.html'; });
  }
  /* What the app may collect and send (SEC-07). Each control is separate and
     says what it sends; the Rust commands check the same choices. */
  function secPrivacy(b){
    b.innerHTML='<div class="cf-msg">Loading…</div>';
    function draw(p, effects){
      var rows=(p.features||[]).map(function(f){
        return srow(esc(f.label), esc(f.sends), '<div class="cf-sw'+(f.enabled?' on':'')+'" data-priv="'+esc(f.id)+'" role="switch" tabindex="0" aria-checked="'+(f.enabled?'true':'false')+'"></div>');
      }).join('');
      var log=(p.log||[]).slice(0,8).map(function(c){ return '<div class="ls">'+esc(new Date(c.at).toLocaleString())+' · '+esc(c.feature)+' '+esc(c.enabled?'on':'off')+'</div>'; }).join('');
      b.innerHTML=
        (p.decided?'':'<div class="cf-note-info" style="color:var(--amber-2)">Nothing below is on yet. Turn on only what you want; each one says what it sends and where.</div>')+
        '<div class="cf-sectn">COLLECTION AND SHARING</div><div class="cf-card">'+rows+'</div>'+
        ((effects&&effects.length)?'<div class="cf-note-info">'+esc(effects.join('. '))+'.</div>':'')+
        '<div class="cf-sectn">ON THIS COMPUTER</div><div class="cf-card">'+
          srow('Clear browser history copy','The history this app read from your browsers','<button class="cf-btn dng" id="cfPrivHist">Clear</button>')+
          srow('Clear local memory','What the assistant recalls on this computer; copies already synced to your account are not affected','<button class="cf-btn dng" id="cfPrivMem">Clear</button>')+
        '</div>'+
        (log?'<div class="cf-sectn">CHANGES</div><div class="cf-card" style="padding:8px 12px">'+log+'</div>':'')+
        '<div class="cf-note-info">Consent version '+esc(p.consentVersion)+(p.decidedAt?(' · last saved '+esc(new Date(p.decidedAt).toLocaleString())):'')+'</div>'+
        '<div id="cfPrivAcct"></div>';
      accountData(b.querySelector('#cfPrivAcct'));
      b.querySelectorAll('[data-priv]').forEach(function(sw){
        function flip(){ var choice={}; choice[sw.dataset.priv]=!sw.classList.contains('on');
          inv('privacy_set',{choices:choice}).then(function(r){ draw(r, r.effects); try{ CF._privacyDecided=r.decided; var bn=document.getElementById('cfPrivBanner'); if(bn&&r.decided) bn.remove(); }catch(e){} })
            .catch(function(e){ if(window.CF&&CF.toast) CF.toast(String((e&&e.message)||e),'error'); }); }
        sw.addEventListener('click',flip); sw.addEventListener('keydown',function(e){ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); flip(); } });
      });
      function twoStep(id, cmd, done){ var btn=b.querySelector('#'+id); if(!btn) return; var armed=false;
        btn.addEventListener('click',function(){ if(!armed){ armed=true; btn.textContent='Confirm'; return; }
          inv(cmd).then(function(r){ if(window.CF&&CF.toast) CF.toast(done(r),'ok'); btn.textContent='Cleared'; btn.disabled=true; })
            .catch(function(e){ if(window.CF&&CF.toast) CF.toast(String((e&&e.message)||e),'error'); }); }); }
      twoStep('cfPrivHist','privacy_clear_history',function(r){ return 'Browser history copy cleared ('+(r.filesRemoved||0)+' file).'; });
      twoStep('cfPrivMem','privacy_clear_memory',function(r){ return (r.memoriesRemoved||0)+' local memories cleared.'; });
    }
    inv('privacy_get').then(function(p){ draw(p); }).catch(function(){ b.innerHTML='<div class="cf-msg">This section needs the latest app build.</div>'; });
  }
  /* The account's own data on the backend (SEC-07): export it as a file, delete
     one kind of it, or delete the account (the email typed out to confirm).
     Every value shown is set as text. */
  var DATA_SCOPES=[['memory','Synced memory'],['scans','Scans and threats'],['agents','Agents'],['devices','Devices'],['all','All synced data']];
  function accountData(box){
    if(!box) return;
    box.innerHTML=
      '<div class="cf-sectn">YOUR ACCOUNT\'S DATA</div><div class="cf-card">'+
        srow('Export your data','Everything kept about your account, saved as a JSON file in Downloads','<button class="cf-btn" id="cfAcExp">Export</button>')+
        srow('Delete synced data','Removes that kind of data from your account; the account stays','<div class="cf-inrow"><select class="cf-input" id="cfAcScope" style="width:auto"></select><button class="cf-btn dng" id="cfAcDel">Delete</button></div>')+
      '</div>'+
      '<div class="cf-note-info" id="cfAcMsg" style="display:none;white-space:pre-line"></div>'+
      '<div class="cf-sectn">DELETE ACCOUNT</div><div class="cf-card" style="padding:12px">'+
        '<div class="ls" id="cfAcWhat">Deletes your account and everything it holds on the server: synced memory, scans, agents, devices, captures and the sign-in. Audit events stay until their 90-day retention ends. Type your account\'s email address to confirm.</div>'+
        '<div class="cf-inrow" style="margin-top:10px"><input class="cf-input" id="cfAcEmail" type="email" autocomplete="off" spellcheck="false"/><button class="cf-btn dng" id="cfAcGo" disabled>Delete account</button></div>'+
      '</div>'+
      '<div class="cf-note-info" id="cfAcReceipt" style="display:none;white-space:pre-line"></div>';
    var sel=box.querySelector('#cfAcScope');
    DATA_SCOPES.forEach(function(s){ var o=document.createElement('option'); o.value=s[0]; o.textContent=s[1]; sel.appendChild(o); });
    function say(text, bad){ var m=box.querySelector('#cfAcMsg'); m.style.display='block'; m.style.color=bad?'#ff9aa6':''; m.textContent=text; }
    function failure(e){ return String((e&&e.message)||e); }
    var email='';
    inv('auth_get_user').then(function(u){
      var user=(u&&(u.user||(u.data&&u.data.user)||u.data))||{};
      email=String(user.email||'');
      var input=box.querySelector('#cfAcEmail'); input.placeholder=email||'Sign in first';
      if(!email){ box.querySelectorAll('button').forEach(function(x){ x.disabled=true; }); }
    }).catch(function(){});

    var exp=box.querySelector('#cfAcExp');
    exp.addEventListener('click',function(){ exp.disabled=true; exp.textContent='Exporting…';
      inv('account_call',{op:'export'}).then(function(r){
        var counts=Object.keys(r.counts||{}).map(function(k){ return k.replace(/_/g,' ')+': '+r.counts[k]; }).join('\n');
        say('Saved to '+r.path+'\n\n'+counts);
      }).catch(function(e){ say('Export failed: '+failure(e), true); }).then(function(){ exp.disabled=false; exp.textContent='Export'; });
    });

    var del=box.querySelector('#cfAcDel'); var armed=false;
    sel.addEventListener('change',function(){ armed=false; del.textContent='Delete'; });
    del.addEventListener('click',function(){
      if(!armed){ armed=true; del.textContent='Confirm'; return; }
      armed=false; del.disabled=true; del.textContent='Deleting…';
      var label=sel.options[sel.selectedIndex].textContent;
      inv('account_call',{op:'data_delete',arg:sel.value}).then(function(r){
        var removed=0; Object.keys(r.results||{}).forEach(function(k){ removed+=(r.results[k].removed||0); });
        say(r.complete ? label+': '+removed+' record'+(removed===1?'':'s')+' deleted.' : label+': '+removed+' deleted, but these could not be: '+(r.failed||[]).join(', ')+'. Try again later.', !r.complete);
      }).catch(function(e){ say('Delete failed: '+failure(e), true); }).then(function(){ del.disabled=false; del.textContent='Delete'; });
    });

    var input=box.querySelector('#cfAcEmail'); var go=box.querySelector('#cfAcGo');
    input.addEventListener('input',function(){ go.disabled=!email || input.value.trim().toLowerCase()!==email.toLowerCase(); });
    go.addEventListener('click',function(){
      if(go.disabled) return;
      go.disabled=true; go.textContent='Deleting…';
      inv('account_call',{op:'delete_account',body:{confirm:input.value.trim()}}).then(function(r){
        var out=box.querySelector('#cfAcReceipt'); out.style.display='block';
        if(r.state==='completed'){
          out.style.color='';
          out.textContent='Your account was deleted. Receipt '+r.deletionId+' (keep it to check the deletion later).\n\nKept:\n'+(r.kept||[]).map(function(k){ return '• '+k; }).join('\n');
          go.textContent='Deleted'; input.disabled=true;
          var done=document.createElement('button'); done.className='cf-btn'; done.textContent='Go to sign-in'; done.style.marginTop='10px';
          done.addEventListener('click',function(){ location.href='login.html'; }); out.appendChild(document.createElement('br')); out.appendChild(done);
        } else {
          out.style.color='#ff9aa6';
          out.textContent='Deletion is not finished: '+(r.failed||[]).join(', ')+' could not be deleted. Your account is kept; try again to finish.';
          go.disabled=false; go.textContent='Delete account';
        }
      }).catch(function(e){ say('Account deletion failed: '+failure(e), true); go.disabled=false; go.textContent='Delete account'; });
    });
  }
  function secAbout(b){
    b.innerHTML=
      '<div class="cf-prof" style="padding-bottom:12px"><div class="av" style="background:linear-gradient(135deg,#143042,#0c1a26);border-color:var(--border-2)">'+MARK+'</div><div><div class="pn">CyberForge Console</div><div class="pe">Version '+appVersion()+' · Desktop</div></div></div>'+
      '<div class="cf-card">'+
        srow('Edition','Local-first AI security workspace','<span class="rv">Desktop</span>')+
        srow('Runtime','Desktop application','<span class="rv">Tauri + Rust</span>')+
        srow('Data residency','Where your data goes, from your Privacy choices','<span class="rv" id="cfAbRes">checking…</span>')+
      '</div>'+
      '<div class="cf-note-info" id="cfAbNote">Memory, reports and the history copy are kept on this computer. What leaves it depends on your Privacy choices. © 2026 CyberForge.</div>';
    inv('privacy_get').then(function(p){
      var on=(p.features||[]).filter(function(f){ return f.enabled && ['cloud_scanning','llm_processing','sync'].indexOf(f.id)>=0; }).map(function(f){ return f.label; });
      set('cfAbRes', on.length ? 'This computer, plus: '+on.join(', ') : 'This computer only');
    }).catch(function(){ set('cfAbRes','Unknown (older build)'); });
  }
  function secDiagnostics(b){
    b.innerHTML='<div class="cf-note-info">Troubleshoot this computer and its services. Each page reports its own source and availability. The same pages are in the sidebar under Diagnostics.</div><div class="cf-card">'+
      srow('Local runtime','Monitoring, resource use and console','<a class="cf-btn" href="agent-core.html">Open runtime</a>')+
      srow('Floating monitor','Inspect the existing background monitor','<button class="cf-btn" id="cfOpenRuntime">Open monitor</button>')+
      srow('Event stream','Events received by this window and server round trip','<a class="cf-btn" href="signal-pipeline.html">Open events</a>')+
      srow('Model capabilities','Reported model and heuristic readiness, sources and limitations','<a class="cf-btn" href="model-inference.html">Open models</a>')+
      srow('Device coverage','Enrollment, connection and verified action outcomes','<a class="cf-btn" href="devices.html">Open Devices</a>')+'</div>';
    b.querySelector('#cfOpenRuntime').addEventListener('click',function(){closeSettingsModal();window.dispatchEvent(new Event('cf:open-runtime-monitor'));});
  }
  function secIntegrations(b){
    function code(lines){ return '<code>'+lines.map(esc).join('<br>')+'</code>'; }
    b.innerHTML='<div class="cf-sectn">CYBERFORGE CLI</div><div class="cf-card">'+
      srow('Installed','The cyberforge command, installed beside this app','<span class="cf-badge d" id="cfCliInstalled">checking…</span>')+
      srow('Version','As the installed command reports it','<span class="rv" id="cfCliVersion">—</span>')+
      srow('On PATH','Whether a new terminal finds it as cyberforge','<span class="rv" id="cfCliOnPath">—</span>')+
      srow('Location','Where it is installed','<span class="rv" id="cfCliPath">—</span>')+'</div>'+
      '<div class="cf-sectn">COMMANDS</div><div class="cf-card">'+
      srow('Check the setup','Server, credential store, sign-in and which program owns this computer\'s state',code(['cyberforge status']))+
      srow('Sign in','Its own session, separate from this app\'s; the password is never an argument',code(['cyberforge auth login','cyberforge auth status','cyberforge auth logout']))+
      srow('Analysis Agents','What the agents can do now, and a versioned check of one address',code(['cyberforge models status','cyberforge scan url https://example.com']))+
      srow('Profiles','Named servers, each with its own sign-in',code(['cyberforge profile list','cyberforge config set origin https://…']))+
      srow('This computer\'s state','Which CyberForge program owns it',code(['cyberforge broker status']))+
      srow('Scripts and CI','One JSON answer and a fixed exit code; a verdict exits 0 unless asked',code(['cyberforge --json scan url https://example.com --fail-on threat']))+
      srow('AI clients','Approve, list and revoke clients of the MCP server',code(['cyberforge mcp grant create --name "Claude Desktop"','cyberforge mcp grant list','cyberforge mcp config --grant <id>']))+'</div>'+
      '<div class="cf-sectn">MCP SERVER</div><div class="cf-card">'+
      srow('For AI clients','An approved client starts it as cyberforge mcp serve and gets only the tools you grant it','<span class="cf-badge d" id="cfMcpState">checking…</span>')+
      srow('Acts as','The CLI\'s current profile and its sign-in, separate from this app\'s','<span class="rv" id="cfMcpProfile">—</span>')+'</div>'+
      '<div class="cf-sectn">APPROVE A CLIENT</div><div class="cf-card">'+
      srow('Client name','How you will recognise it here later','<input class="cf-input" id="cfMcpName" maxlength="60" placeholder="Claude Desktop" autocomplete="off" spellcheck="false" style="width:220px"/>')+
      srow('Read-only tools','Server status and what the Analysis Agents can do now. Always included','<span class="rv">cyberforge_status, cyberforge_model_status</span>')+
      srow('Address analysis','Also let it send web addresses to your server for analysis (credentials are removed first)','<input type="checkbox" id="cfMcpScan"/>')+
      srow('Expires after','It must be approved again then','<select class="cf-input" id="cfMcpDays" style="width:auto"><option value="30">30 days</option><option value="90" selected>90 days</option><option value="365">365 days</option></select>')+
      '<div class="cf-srow" style="border:none"><div class="l"><div class="ls" id="cfMcpMsg"></div></div><div class="r"><button class="cf-btn pri" id="cfMcpApprove" disabled>Approve</button></div></div>'+
      '<div id="cfMcpCfgBox" style="display:none;padding:0 16px 14px"><div class="ls" style="margin-bottom:6px">Add this to the client\'s MCP configuration. It holds no password or token.</div><pre id="cfMcpCfg" style="white-space:pre-wrap;word-break:break-all;font-family:var(--mono);font-size:11px;margin:0;padding:10px;border-radius:9px;border:1px solid var(--border-2);background:rgba(8,12,20,.6)"></pre><button class="cf-btn" id="cfMcpCopy" style="margin-top:8px">Copy</button></div>'+
      '</div>'+
      '<div class="cf-sectn">APPROVED CLIENTS</div><div class="cf-card" id="cfMcpList"><div class="cf-srow"><div class="l"><div class="ls">Checking…</div></div></div></div>'+
      '<div class="cf-sectn">RECENT CALLS</div><div class="cf-card" id="cfMcpCalls"><div class="cf-srow"><div class="l"><div class="ls">—</div></div></div></div>'+
      '<div class="cf-note-info" id="cfIntNote">Approving a client lets it act as the CLI profile shown above: sign that profile in with cyberforge auth login first. Revoking, expiry, signing the profile in to another account, or pointing it at another server stops the client\'s next call. Calls are logged without what was sent.</div>';
    var mcpCfgText='';
    function showCfg(cfg){
      mcpCfgText=JSON.stringify(cfg,null,2);
      var box=document.getElementById('cfMcpCfgBox'); if(box) box.style.display='';
      set('cfMcpCfg',mcpCfgText);
    }
    function when(sec){ if(!sec) return '—'; try{ return new Date(sec*1000).toLocaleString(); }catch(e){ return String(sec); } }
    function loadMcp(){
      inv('mcp_grants').then(function(r){
        var badge=document.getElementById('cfMcpState');
        var grants=(r&&r.grants)||[];
        var active=grants.filter(function(g){ return g.state==='active'; });
        if(badge){ badge.className='cf-badge '+(active.length?'g':'d'); badge.textContent=active.length?(active.length+' approved'):'No client approved'; }
        var prof=null; ((r&&r.profiles&&r.profiles.profiles)||[]).forEach(function(p){ if(p.current) prof=p; });
        set('cfMcpProfile',prof?(prof.name+' · '+prof.origin+' · '+(prof.session==='kept'?'signed in':'not signed in')):'No CLI profile yet; run cyberforge config set origin …');
        var approve=document.getElementById('cfMcpApprove'); if(approve) approve.disabled=false;
        var names={}; grants.forEach(function(g){ names[g.id]=g.clientName; });
        var list=document.getElementById('cfMcpList');
        if(list){
          list.innerHTML=grants.length?grants.slice().reverse().map(function(g){
            var cls=g.state==='active'?'g':(g.state==='revoked'?'r':'d');
            var btns=g.state==='active'?('<button class="cf-btn" data-cfg="'+esc(g.id)+'">Configuration</button> <button class="cf-btn dng" data-revoke="'+esc(g.id)+'">Revoke</button>'):'';
            return '<div class="cf-srow"><div class="l"><div class="lt">'+esc(g.clientName)+' <span class="cf-badge '+cls+'">'+esc(g.state)+'</span></div>'+
              '<div class="ls">'+esc((g.operations||[]).join(', '))+' · profile '+esc(g.profile)+' · expires '+esc(when(g.expiresAt))+' · '+esc(g.id)+'</div></div><div class="r">'+btns+'</div></div>';
          }).join(''):'<div class="cf-srow"><div class="l"><div class="ls">No AI client is approved.</div></div></div>';
          list.querySelectorAll('[data-cfg]').forEach(function(btn){ btn.addEventListener('click',function(){
            grants.forEach(function(g){ if(g.id===btn.getAttribute('data-cfg')&&g.clientConfig) showCfg(g.clientConfig); });
          }); });
          list.querySelectorAll('[data-revoke]').forEach(function(btn){ btn.addEventListener('click',function(){
            btn.disabled=true;
            inv('mcp_grant_revoke',{id:btn.getAttribute('data-revoke')}).then(function(){
              if(window.CF&&CF.toast) CF.toast('Approval revoked','ok'); loadMcp();
            }).catch(function(e){ btn.disabled=false; if(window.CF&&CF.toast) CF.toast(String((e&&e.message)||e),'err'); });
          }); });
        }
        var calls=document.getElementById('cfMcpCalls');
        if(calls){
          var rows=(r&&r.recentCalls)||[];
          calls.innerHTML=rows.length?rows.map(function(c){
            return '<div class="cf-srow"><div class="l"><div class="lt">'+esc(c.tool)+'</div><div class="ls">'+esc(names[c.grant]||c.grant)+' · '+esc(when(c.at))+'</div></div><div class="r"><span class="cf-badge '+(c.outcome==='ok'?'g':'r')+'">'+esc(c.outcome)+'</span></div></div>';
          }).join(''):'<div class="cf-srow"><div class="l"><div class="ls">No calls yet.</div></div></div>';
        }
      }).catch(function(e){
        var badge=document.getElementById('cfMcpState'); if(badge){ badge.className='cf-badge r'; badge.textContent='Unavailable'; }
        var list=document.getElementById('cfMcpList'); if(list) list.innerHTML='<div class="cf-srow"><div class="l"><div class="ls">'+esc(String((e&&e.message)||e||'This section needs the latest app build.'))+'</div></div></div>';
      });
    }
    var approveBtn=document.getElementById('cfMcpApprove');
    if(approveBtn) approveBtn.addEventListener('click',function(){
      var name=(document.getElementById('cfMcpName')||{}).value||'';
      var scan=!!(document.getElementById('cfMcpScan')||{}).checked;
      var days=parseInt((document.getElementById('cfMcpDays')||{}).value,10)||90;
      if(!name.trim()){ set('cfMcpMsg','Give the client a name.'); return; }
      approveBtn.disabled=true; set('cfMcpMsg','Checking the CLI profile\'s sign-in with the server…');
      inv('mcp_grant_create',{name:name.trim(),allowScan:scan,days:days}).then(function(d){
        set('cfMcpMsg','Approved '+((d&&d.grant&&d.grant.clientName)||name.trim())+'.');
        if(d&&d.clientConfig) showCfg(d.clientConfig);
        approveBtn.disabled=false; loadMcp();
      }).catch(function(e){ approveBtn.disabled=false; set('cfMcpMsg',String((e&&e.message)||e)); });
    });
    var copyBtn=document.getElementById('cfMcpCopy');
    if(copyBtn) copyBtn.addEventListener('click',function(){
      try{ navigator.clipboard.writeText(mcpCfgText); if(window.CF&&CF.toast) CF.toast('Configuration copied','ok'); }catch(e){}
    });
    loadMcp();
    inv('cli_status').then(function(r){
      var badge=document.getElementById('cfCliInstalled');
      if(badge){ badge.className='cf-badge '+(r&&r.installed?'g':'r'); badge.textContent=r&&r.installed?'Installed':'Not installed'; }
      if(!r||!r.installed){ set('cfCliVersion','—'); set('cfCliOnPath','—'); set('cfCliPath',(r&&r.reason)||'Not found'); return; }
      set('cfCliVersion',r.version?('v'+r.version+(r.schema?' · '+r.schema:'')):(r.versionError||'Unknown'));
      set('cfCliOnPath',r.onPath?'Yes':'Not in this app\'s PATH; open a new terminal after installing, or add '+r.folder);
      set('cfCliPath',r.path);
    }).catch(function(){ set('cfCliInstalled','Unavailable'); set('cfCliPath','This section needs the latest app build.'); });
  }
  var RENDER={ diagnostics:secDiagnostics, integrations:secIntegrations, account:secAccount, appearance:secAppearance, ai:secAi, connection:secConnection, system:secSystem, security:secSecurity, privacy:secPrivacy, about:secAbout };

  function showSection(k){
    var ov=document.getElementById('cfSetModal'); if(!ov) return;
    var sec=null; for(var i=0;i<SECTIONS.length;i++){ if(SECTIONS[i].k===k){ sec=SECTIONS[i]; break; } }
    if(!sec) sec=SECTIONS[0];
    ov.querySelectorAll('.cf-mni').forEach(function(n){ n.classList.toggle('on', n.dataset.sec===sec.k); });
    var ttl=ov.querySelector('#cfSetTitle'); if(ttl) ttl.innerHTML=esc(sec.label)+'<small>'+esc(sec.sub)+'</small>';
    var body=ov.querySelector('#cfSetBody'); if(!body) return; body.scrollTop=0;
    try{ RENDER[sec.k](body); }catch(e){ body.innerHTML='<div class="cf-msg">This section needs the latest app build.</div>'; }
  }
  var cfSetReturn=null;   // the element focused before Settings opened; focus goes back to it
  function closeSettingsModal(){ var ov=document.getElementById('cfSetModal'); if(!ov) return; ov.remove();
    if(cfSetReturn&&document.contains(cfSetReturn)) try{ cfSetReturn.focus(); }catch(e){}
    cfSetReturn=null; }
  function openSettingsModal(section){
    var from=document.activeElement;
    closeDD(); closeSettingsModal();
    cfSetReturn=(from&&from!==document.body)?from:null;
    var ov=document.createElement('div'); ov.className='cf-mov'; ov.id='cfSetModal';
    ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-labelledby','cfSetTitle');
    ov.innerHTML='<div class="cf-mw">'+
        '<div class="cf-mside">'+
          '<div class="cf-mside-h">'+MARK+'<div><b>Cyber<span class="fg">Forge</span></b><small>SETTINGS</small></div></div>'+
          '<div class="cf-mnav">'+SECTIONS.map(function(s){ return '<div class="cf-mni" data-sec="'+s.k+'">'+s.ic+'<span>'+s.label+'</span></div>'; }).join('')+'</div>'+
          '<div class="cf-mside-f">CyberForge Console · v'+appVersion()+'</div>'+
        '</div>'+
        '<div class="cf-mmain">'+
          '<div class="cf-mtop"><h3 id="cfSetTitle">Account</h3><button class="cf-mclose" id="cfSetClose" title="Close">'+icClose+'</button></div>'+
          '<div class="cf-mbody" id="cfSetBody"></div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov) closeSettingsModal(); });
    ov.querySelector('#cfSetClose').addEventListener('click',closeSettingsModal);
    ov.querySelectorAll('.cf-mni').forEach(function(n){ n.addEventListener('click',function(){ showSection(n.dataset.sec); }); });
    if(!window.__cfSetEsc){ window.__cfSetEsc=true; document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ closeSettingsModal(); } }); }
    // Tab and Shift+Tab stay inside the dialog while it is open.
    ov.addEventListener('keydown',function(e){
      if(e.key!=='Tab') return;
      var f=[].slice.call(ov.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(function(x){ return !x.disabled && x.offsetParent!==null; });
      if(!f.length) return;
      var first=f[0], last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
    });
    showSection(section||'account');
    try{ ov.querySelector('#cfSetClose').focus(); }catch(e){}
  }
  try{ window.openCfSettings=openSettingsModal; }catch(e){}

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
    // No status chips unless the page passes real ones (a default "REC" and "ON" stood here, with nothing recording).
    const chips=(o.chips!==undefined)?o.chips:'';
    const cta='Analyze';
    const threats=o.threats?('<div class="pill-threats" id="tbThreats">'+threatI+' '+o.threats+' threats</div>'):'';
    const html=
      '<div class="brand"><a class="logo-mark" href="threat-overview.html">'+MARK+'</a><div class="name"><b>Cyber<span class="fg">Forge</span></b><span>AI SECURITY</span></div></div>'+
      '<div class="tb-group">'+chips+'</div>'+
      '<div class="search" id="cfSearchBox">'+searchI+'<input id="cfSearch" class="cf-sinput" placeholder="Look up a domain" aria-label="Look up a domain" autocomplete="off" spellcheck="false" /><span class="kbd">↵</span><div class="cf-sres" id="cfSres"></div></div>'+
      '<div class="tb-status"><div class="spinner sm"></div>'+status+'</div>'+
      threats+
      '<button class="btn-scan">'+bolt+cta+'</button>'+
      '<button class="icon-btn" id="cfBell" title="Notifications"><span class="badge" id="cfBadge"></span>'+bell+'</button>'+
      '<button class="icon-btn" id="cfTheme" title="Toggle theme">'+(curTheme()==='light'?sun:moon)+'</button>'+
      '<button class="icon-btn" id="cfGear" title="Settings">'+gear+'</button>'+
      '<div class="avatar" id="cfAvatar" title="Account & settings"><span class="cf-avico">'+user+'</span><span class="cf-avinit" id="cfAvInit"></span></div>';
    const el=document.getElementById('topbar');
    if(!el) return;
    el.className='topbar'; el.innerHTML=html;

    // notifications dropdown container (settings is now a full modal screen)
    var notesDD=document.createElement('div'); notesDD.className='cf-dd'; notesDD.id='cfNotesDD'; el.appendChild(notesDD);

    if(window.attachRipple){ var bs=el.querySelector('.btn-scan'); if(bs) attachRipple(bs); }
    applyTheme(curTheme(),true); // Restore the saved theme without covering the header with a toast.
    wireDoc();

    // Until the user has chosen what may be collected and sent, nothing is, and every page says so (SEC-07).
    inv('privacy_get').then(function(p){
      if(!p || p.decided || document.getElementById('cfPrivBanner')) return;
      var bn=document.createElement('div'); bn.id='cfPrivBanner'; bn.className='cf-note-info';
      bn.style.cssText='margin:6px 14px;border:1px solid rgba(245,166,35,.4);color:var(--amber-2);display:flex;align-items:center;gap:10px';
      bn.textContent='Choose what CyberForge may collect and send. Until you do, history reading, scanning, the assistant and sync stay off. ';
      var go=document.createElement('button'); go.className='cf-btn'; go.textContent='Choose';
      go.addEventListener('click',function(){ openSettingsModal('privacy'); });
      bn.appendChild(go); el.after(bn);
    }).catch(function(){});

    // Notifications
    var bellBtn=document.getElementById('cfBell');
    if(bellBtn) bellBtn.addEventListener('click',function(ev){ ev.stopPropagation(); var open=notesDD.classList.contains('open'); closeDD(); if(!open){ renderNotes(); notesDD.classList.add('open'); cfUnread=0; updateBadge(); } });

    // Theme toggle
    var themeBtn=document.getElementById('cfTheme');
    if(themeBtn) themeBtn.addEventListener('click',function(){ applyTheme(curTheme()==='light'?'dark':'light'); });

    // Settings — full screen. Gear opens it; avatar opens it on the Account tab.
    var gearBtn=document.getElementById('cfGear'); if(gearBtn) gearBtn.addEventListener('click',function(ev){ ev.stopPropagation(); openSettingsModal('account'); });
    var avatarBtn=document.getElementById('cfAvatar'); if(avatarBtn) avatarBtn.addEventListener('click',function(ev){ ev.stopPropagation(); openSettingsModal('account'); });

    // Personalise the avatar with the signed-in user's initial.
    inv('auth_get_user').then(function(u){
      var user=(u&&(u.user||(u.data&&u.data.user)||u.data))||{};
      var nm=user.name||user.fullName||user.username||user.email||'';
      var av=document.getElementById('cfAvatar'), ini=document.getElementById('cfAvInit');
      if(av&&ini&&nm){ ini.textContent=initialOf(nm); av.classList.add('has-init'); }
    }).catch(function(){});

    // IP search
    var inp=document.getElementById('cfSearch');
    if(inp){
      inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); doIpSearch(); } });
      inp.addEventListener('input',function(){ if(!inp.value.trim()){ var b=document.getElementById('cfSres'); if(b) b.classList.remove('open'); } });
    }
    var sbox=document.getElementById('cfSearchBox'); if(sbox) sbox.addEventListener('click',function(e){ if(e.target===sbox||e.target.tagName==='svg'||e.target.tagName==='path'||e.target.tagName==='circle'){ if(inp) inp.focus(); } });

    // Quick Scan → scan the typed site, else open the Sandbox
    var scanBtn=el.querySelector('.btn-scan');
    if(scanBtn) scanBtn.addEventListener('click',function(){ location.href='analyzer.html'; });

    // initial + live notifications
    loadNotes();
    if(!window.__cfLiveNotesWired){ window.__cfLiveNotesWired=true; window.addEventListener('cf:alert',onLive); window.addEventListener('cf:threat',onLive); }
  };
})();
