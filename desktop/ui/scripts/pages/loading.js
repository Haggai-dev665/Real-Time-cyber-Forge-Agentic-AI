/* pages/loading.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
fitWindow('win');

/* the only thing on the page: the brand mark, fully animating */
var forgeHost=document.getElementById('forge');
forgeIllustration(forgeHost, 480);
/* re-forge the mark periodically so it keeps animating while the app loads */
setInterval(function(){ if(window.replayForge) replayForge(forgeHost); }, 5500);

function delay(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }
var T = window.__TAURI__;
function inv(cmd, args){ return (T && T.core && T.core.invoke) ? T.core.invoke(cmd, args || {}) : Promise.reject(new Error('no-tauri')); }
/* stash a command result so any page can render it instantly on navigate
   (read by CF.preGet / direct localStorage). Format: {ts, payload}. */
function preSet(key, payload){ try{ localStorage.setItem('cf_pre_'+key, JSON.stringify({ ts: Date.now(), payload: payload })); }catch(e){} }

/* Warm the data behind the SIX Intelligence screens — the first six items in the
   sidebar — so they are fully ready before the app opens. We don't navigate until
   every one of these has finished (see authCheck below). Order = sidebar order:
   1 Overview · 2 Threat Intelligence · 3 Sandbox · 4 Browser Intelligence ·
   5 AI Assistant · 6 Protection. Each result is cached in the Rust
   process AND stashed to localStorage so the destination page shows it instantly,
   then refreshes live. The trailing entries warm data for later pages too. */
var WARM = [
  // ── 1 · Overview (also feeds every header) ──
  { key:'status',     run:function(){ return inv('agent_status'); } },
  { key:'threats',    run:function(){ return inv('get_threats'); } },
  // ── 2 · Threat Intelligence (slow network → early) ──
  { key:'globe',      run:function(){ return inv('otx_fetch', { limit: 50 }); } },
  // ── 3 · Sandbox (idle until a scan; shares the ML status engines panel) ──
  { key:'ml',         run:function(){ return inv('ml_status'); } },
  // ── 4 · Browser Intelligence ──
  { key:'browsers',   run:function(){ return inv('detect_browsers'); } },
  { key:'history',    run:function(){ return inv('get_collected_history'); } },
  // ── 5 · AI Assistant ──
  { key:'hf',         run:function(){ return inv('hf_token_status'); } },
  // ── 6 · Protection ──
  { key:'policymeta', run:function(){ return inv('policy_meta'); } },
  { key:'policylist', run:function(){ return inv('policy_list'); } },
  { key:'policystats',run:function(){ return inv('policy_stats'); } },
  { key:'blocked',    run:function(){ return inv('list_blocked'); } },
  { key:'protected',  run:function(){ return inv('list_protected'); } },
  { key:'allowed',    run:function(){ return inv('list_allowed'); } },
  // ── background: data for later pages (not gated on, just pre-warmed) ──
  { key:'sys',        run:function(){ return inv('get_system_stats'); } },
  { key:'memory',     run:function(){ return inv('memory_list', { limit: 80 }); } },
  { key:'alerts',     run:function(){ return inv('agent_alerts'); } }
];
/* The first SIX screens are the first 13 WARM entries (indices 0–12, ending at
   the last Protection entry). The app stays on the loading screen until
   all of these settle. The remaining entries warm in the background. */
var SCREEN6_COUNT = 13;
function runWarm(t){ return t.run().then(function(r){ if(r) preSet(t.key, r); }).catch(function(){}); }

/* rotating status + time-based progress over the ~30s warm-up. The phrases walk
   through the six Intelligence screens being pre-loaded, in sidebar order. */
var PHRASES = ['Connecting to the agent core','Loading your threat overview','Mapping the global threat grid',
  'Preparing manual analysis','Preparing browser activity','Waking the AI assistant',
  'Loading your security functions','Warming the Analysis Agents','Indexing local memory','Preparing your workspace'];
var pi=0, statusTimer=setInterval(function(){ var e=document.getElementById('lstatus'); if(e) e.textContent=PHRASES[pi++%PHRASES.length]; }, 2400);
/* WARM_MS = minimum time on the loading screen so the six screens have time to
   load and the brand plays; HARD_CAP_MS = absolute ceiling so we never hang. */
var t0=Date.now(), WARM_MS=30000, HARD_CAP_MS=45000;
var progTimer=setInterval(function(){ var b=document.getElementById('lbar'); if(b) b.style.width=Math.min(96,(Date.now()-t0)/WARM_MS*100)+'%'; }, 80);

/* persistent login: validate the keychain session (this also restores the Rust
   session so the warm-up commands below are authenticated). */
var authCheck = (window.cfAuth && cfAuth.available())
  ? cfAuth.isAuthenticated().then(function(r){ return !!(r && r.authenticated); }).catch(function(){ return false; })
  : Promise.resolve(false);

var navigated=false;
function go(authed){
  if(navigated) return; navigated=true;
  clearInterval(statusTimer); clearInterval(progTimer);
  var b=document.getElementById('lbar'); if(b) b.style.width='100%';
  var e=document.getElementById('lstatus'); if(e) e.textContent='Ready';
  setTimeout(function(){ window.location.replace(authed ? 'threat-overview.html' : 'login.html'); }, 340);
}

authCheck.then(function(authed){
  if(!authed){ delay(1600).then(function(){ go(false); }); return; }
  // Authenticated → warm every page (sidebar order), but don't open the app
  // until the first SIX screens are fully loaded AND the ~30s minimum elapses.
  var warms = WARM.map(runWarm);
  var screen6 = Promise.allSettled(warms.slice(0, SCREEN6_COUNT));  // all six Intelligence screens ready
  Promise.allSettled([screen6, delay(WARM_MS)]).then(function(){ go(true); });
  delay(HARD_CAP_MS).then(function(){ go(true); });                 // safety net — never hang
});
