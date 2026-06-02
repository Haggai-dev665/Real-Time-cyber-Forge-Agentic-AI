/* ============================================================
   CyberForge — shared utilities (used by all screens)
   Sidebar / header / footer live in cf-sidebar.js / cf-header.js / cf-footer.js
   ============================================================ */
function fitWindow(id){
  const w=document.getElementById(id);
  if(!w) return;
  function fit(){
    const s=window.innerWidth/1440;                 // fill the full viewport width — no side bands
    w.style.transformOrigin='top left';
    w.style.transform='scale('+s+')';
    const stage=w.parentElement;                    // give the page real height so it scrolls to the bottom
    if(stage) stage.style.height=(824*s)+'px';
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
