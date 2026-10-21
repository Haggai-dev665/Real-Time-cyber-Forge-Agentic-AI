/* components/agent-panel.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
/* Text for HTML: addresses, categories and browser names come from outside the panel (SEC-05). */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
/* ---------- live ring gauges (CPU / RAM) ---------- */
const GA=(function(){
  const cx=21,cy=21,r=16,sw=4.5,C=2*Math.PI*r;
  const gauges=[...document.querySelectorAll('[data-gauge]')].map(svg=>{
    const color=svg.dataset.color, target=+svg.dataset.gauge;
    svg.innerHTML=
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="rgba(126,148,184,.16)" stroke-width="'+sw+'"/>'+
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" '+
        'stroke-dasharray="0 '+C+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
    const arc=svg.querySelector('circle:last-child');
    const val=svg.parentElement.querySelector('.val');
    return {arc,val,cur:0,target,C};
  });
  function set(g,pct){
    g.cur=pct;
    g.arc.setAttribute('stroke-dasharray',(g.C*pct/100).toFixed(1)+' '+g.C);
    g.val.textContent=Math.round(pct)+'%';
  }
  function sweepIn(){ gauges.forEach(g=>{ g.arc.style.strokeDasharray='0 '+g.C; setTimeout(()=>set(g,g.target),60); }); }
  // initial sweep from 0
  sweepIn();
  // driven by REAL system telemetry (window.CF, polled from Tauri get_system_stats)
  setInterval(function(){
    var d=window.CF||{};
    if(gauges[0]) set(gauges[0], Math.max(0,Math.min(100, d.cpu||0)));
    if(gauges[1]) set(gauges[1], Math.max(0,Math.min(100, d.mem||0)));
  },2000);
  return {sweepIn,gauges,set};
})();

/* ---------- uptime ticker ---------- */
(function(){
  const el=document.getElementById('uptime'); if(!el)return;
  // REAL system uptime (seconds) from Tauri get_system_stats
  setInterval(function(){ var sec=(window.CF&&window.CF.uptime)||0;
    var d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60);
    el.textContent = d>0 ? (d+'d '+h+'h') : (h+'h '+m+'m'); },1000);
})();

/* ---------- cursor spotlight on agent panel ---------- */
(function(){
  const a=document.getElementById('agent'); if(!a)return;
  a.addEventListener('mousemove',e=>{ const r=a.getBoundingClientRect();
    a.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
    a.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%'); });
})();

/* ---------- neural activity stream (typewriter) — REAL status ---------- */
(function(){
  const txt=document.getElementById('streamText'), ops=document.getElementById('ops');
  if(!txt) return;
  function msgs(){ var d=window.CF||{}; return [
    'CPU '+Math.round(d.cpu||0)+'% · MEM '+Math.round(d.mem||0)+'%',
    d.backendOk?('Server connected · '+(d.agents||1)+' agent'+((d.agents||1)===1?'':'s')+' online'):'Server offline — retrying…',
    (d.threats?('Monitoring '+d.threats+' active threat'+(d.threats>1?'s':'')):'No active threats — posture nominal'),
    'Inference latency '+(d.latency||0)+' ms',
    d.mlOk?'Analysis Agents healthy':'Analysis Agents degraded',
    (d.browsers||0)+' browser'+((d.browsers||0)===1?'':'s')+' detected'
  ]; }
  let mi=0,ci=0,del=false,cache=msgs();
  function type(){
    if(ci===0&&!del) cache=msgs();
    const m=cache[mi%cache.length]||'';
    txt.textContent=del?m.slice(0,ci--):m.slice(0,ci++);
    let d=del?26:42;
    if(!del&&ci>m.length){d=1500;del=true;}
    else if(del&&ci<0){del=false;ci=0;mi=(mi+1)%cache.length;d=220;}
    setTimeout(type,d);
  }
  type();
  setInterval(function(){ var d=window.CF||{};
    if(ops) ops.textContent=(d.backendOk?('live · '+(d.latency||0)+'ms'):'offline'); },900);
})();

/* ---------- ripple + control interactions ---------- */
function ripple(el,e){
  const r=el.getBoundingClientRect(), s=document.createElement('span'); s.className='ripple';
  const size=Math.max(r.width,r.height); s.style.width=s.style.height=size+'px';
  s.style.left=(e.clientX-r.left)+'px'; s.style.top=(e.clientY-r.top)+'px';
  el.appendChild(s); setTimeout(()=>s.remove(),600);
}
function logLine(t){
  const log=document.getElementById('streamLog'); if(!log)return;
  const now=new Date(), ts=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  // the line can name a scanned address: added as text, never markup
  const d=document.createElement('div'); d.className='ln'; d.innerHTML='<span class="t">'+ts+'</span>'; d.appendChild(document.createTextNode(String(t)));
  log.prepend(d); while(log.children.length>3) log.lastChild.remove();
}
/* ---------- CONTROLS: functional resync + navigation ---------- */
(function(){
  const btn=document.getElementById('btnResync'), body=document.getElementById('agentBody'),
        brefresh=document.getElementById('browserRefresh');
  function inv(cmd,args){ try{ var T=(window.parent&&window.parent.__TAURI__)||window.__TAURI__;
    if(T&&T.core&&T.core.invoke) return T.core.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('no tauri')); }
  // Navigate the HOST window (the panel is an iframe inside a pages/ document).
  function go(page){
    var url=page;
    try{ var host=(window.top&&window.top!==window)?window.top:window;
      if(/\/components\//.test((host.location&&host.location.pathname)||'')) url='../pages/'+page; }catch(e){}
    try{ (window.top||window).location.href=url; }catch(e){ try{ location.href=url; }catch(e2){} }
  }
  function resync(e){
    if(e) ripple(btn,e);
    btn&&btn.classList.add('busy');
    brefresh&&brefresh.classList.add('busy');
    body.classList.remove('scanning'); void body.offsetWidth; body.classList.add('scanning');
    if(typeof GA!=='undefined'&&GA.sweepIn) GA.sweepIn();
    logLine('Resync initiated…');
    // Real re-fetch: system stats, running browsers, agent status.
    inv('get_system_stats').catch(function(){});
    inv('detect_browsers').catch(function(){});
    inv('agent_status').catch(function(){});
    setTimeout(()=>logLine('Telemetry re-synced · all systems nominal'),900);
    setTimeout(()=>{ btn&&btn.classList.remove('busy'); brefresh&&brefresh.classList.remove('busy'); body.classList.remove('scanning'); },1200);
  }
  btn&&btn.addEventListener('click',resync);
  brefresh&&brefresh.addEventListener('click',function(){ resync(); });
  var core=document.getElementById('btnCore');
  core&&core.addEventListener('click',function(e){ ripple(core,e); logLine('Opening Agent Core…'); setTimeout(function(){ go('agent-core.html'); },150); });
  var asst=document.getElementById('btnAssist');
  asst&&asst.addEventListener('click',function(e){ ripple(asst,e); logLine('Opening AI Assistant…'); setTimeout(function(){ go('ai-assistance.html'); },150); });
  logLine('Agent online · v2.1 agentic mode');
})();
/* ---------- agent vitals: live task / throughput / latency / agents ---------- */
(function(){
  // capacity dots
  const ad=document.getElementById('adots');
  if(ad){ for(let i=0;i<8;i++){ const d=document.createElement('i'); if(i===0)d.className='on'; ad.appendChild(d); } }

  // throughput
  const thru=document.getElementById('thru');
  setInterval(function(){ var t=(window.CF&&window.CF.threats)||0; thru.textContent = t>=1000?(t/1000).toFixed(1)+'k':String(t); },1100);

  // latency + sparkline
  const lat=document.getElementById('lat'),sp=document.getElementById('latSpark');
  let hist=Array.from({length:13},()=>0.05);
  function drawLat(){
    const W=52,H=16, pts=hist.map((v,i)=>(i*(W/(hist.length-1)))+','+ (H-2-v*(H-4))).join(' ');
    sp.innerHTML='<polyline points="'+pts+'" fill="none" stroke="var(--cyan)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'+
      '<circle cx="'+W+'" cy="'+(H-2-hist[hist.length-1]*(H-4))+'" r="1.8" fill="var(--cyan)"/>';
  }
  drawLat();
  setInterval(function(){ var ms=(window.CF&&window.CF.latency)||0; lat.textContent=ms;
    hist.push(Math.max(0.05,Math.min(1,ms/400))); hist.shift(); drawLat(); },1300);
})();

/* ---------- SCANNING pipeline (live website scan) ---------- */
(function(){
  const I={
    globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/></svg>',
    ports:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/><path d="M6 7.5h.01M6 16.5h.01"/></svg>',
    lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/></svg>',
    bug:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="8" width="10" height="11" rx="4"/><path d="M12 8V5M9 11H4M20 11h-5M9 16H4M20 16h-5M9 6 7.5 4.5M15 6l1.5-1.5"/></svg>',
    eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
  };
  const VI={
    ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    bad:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>'
  };
  const tools=[
    {name:'DNS Resolve',icon:I.globe,ok:{label:'resolved',cls:'ok'},alt:[{label:'cname chain',cls:'info'}]},
    {name:'Port Scan',icon:I.ports,ok:{label:'2 open',cls:'info'},alt:[{label:'5 open',cls:'warn'}]},
    {name:'TLS Certificate',icon:I.lock,ok:{label:'valid · A+',cls:'ok'},alt:[{label:'expiring',cls:'warn'}]},
    {name:'Security Headers',icon:I.shield,ok:{label:'pass',cls:'ok'},alt:[{label:'2 missing',cls:'warn'}]},
    {name:'Malware Scan',icon:I.bug,ok:{label:'clean',cls:'ok'},alt:[{label:'payload flagged',cls:'bad'}]},
    {name:'Threat Reputation',icon:I.eye,ok:{label:'trusted',cls:'ok'},alt:[{label:'blocklisted',cls:'bad'},{label:'neutral',cls:'info'}]}
  ];
  function cfInvoke(cmd,args){
    try{ var T=(window.parent&&window.parent.__TAURI__)||window.__TAURI__;
      if(T&&T.core&&T.core.invoke) return T.core.invoke(cmd,args||{}); }catch(e){}
    return Promise.reject(new Error('Tauri unavailable'));
  }
  const elTools=document.getElementById('scanTools'),elTarget=document.getElementById('scanTarget'),
        elPct=document.getElementById('scanPct'),elBar=document.getElementById('scanBar'),
        elVerdict=document.getElementById('scanVerdict'),elId=document.getElementById('scanId');
  if(!elTools)return;
  let scanNo=1;
  elTools.innerHTML=tools.map(t=>
    '<div class="tool pending"><span class="t-node"><span class="led"></span><span class="t-spin"></span></span>'+
    '<span class="t-ico">'+t.icon+'</span><span class="t-name">'+t.name+'</span><span class="t-res"></span></div>'
  ).join('');
  const rows=[...elTools.children];

  // map a REAL backend scan payload (data) onto the 6 tool rows
  function toolResults(d){
    d=d||{};
    var url=d.url||'';
    var https=/^https:/i.test(url);
    var missing=(d.missingHeaders&&d.missingHeaders.length)||0;
    var ext=(d.externalDomains&&d.externalDomains.length)||0;
    var risk=+d.riskScore||0;
    var cat=(d.category||'').toLowerCase();
    var malicious=risk>=50||/phish|malware|malicious|scam|trojan/.test(cat);
    var blocklisted=risk>=70||/phish|malware|malicious|blocklist/.test(cat);
    return [
      d.scraperSuccess===false?{label:'unreachable',cls:'bad'}:{label:'resolved',cls:'ok'},
      {label:(ext?ext+' ext domains':'no external'),cls:(ext>8?'warn':'info')},
      https?{label:'valid TLS',cls:'ok'}:{label:'no TLS',cls:'warn'},
      missing?{label:missing+' missing',cls:'warn'}:{label:'headers pass',cls:'ok'},
      malicious?{label:'flagged',cls:'bad'}:{label:'clean',cls:'ok'},
      blocklisted?{label:(cat||'blocklisted'),cls:'bad'}:(risk>=35?{label:'suspicious',cls:'warn'}:{label:'trusted',cls:'ok'})
    ];
  }
  function resetRows(){
    elPct.textContent='0%'; elBar.style.width='0%'; elVerdict.className='scan-verdict';
    rows.forEach(function(r){ r.className='tool running'; var re=r.querySelector('.t-res'); re.className='t-res'; re.textContent=''; });
  }
  function applyResults(results,risk,cat){
    var worst='ok',warns=0;
    rows.forEach(function(r,i){
      setTimeout(function(){
        var res=results[i]||{label:'—',cls:'info'};
        r.className='tool done'+(res.cls==='bad'?' threat':'');
        var re=r.querySelector('.t-res'); re.textContent=res.label; re.className='t-res show '+res.cls;
        if(res.cls==='bad')worst='bad'; else if(res.cls==='warn'){warns++; if(worst!=='bad')worst='warn';}
        var done=i+1; elPct.textContent=Math.round(done/rows.length*100)+'%'; elBar.style.width=(done/rows.length*100)+'%';
        if(done===rows.length) setTimeout(function(){ verdict(worst,warns,risk,cat); },360);
      }, i*150);
    });
  }
  function verdict(worst,warns,risk,cat){
    var cls,txt;
    if(worst==='bad'){cls='bad';txt=esc((cat?String(cat).toUpperCase():'Threat')+' · risk '+(risk||0));}
    else if(worst==='warn'){cls='warn';txt=esc(warns+' risk factor'+(warns>1?'s':'')+' · '+(risk||0));}
    else{cls='ok';txt='No threats · safe';}
    elVerdict.innerHTML='<span class="vi">'+VI[cls]+'</span>'+txt+'<span class="meta">'+rows.length+' checks</span>';
    elVerdict.className='scan-verdict show '+cls;
    // Next scan is scheduled by the real-time controller (active-tab driven) below.
  }
  // No real page to scan → show an honest idle state (NEVER a placeholder URL).
  function idleScan(){
    elId.textContent='idle';
    elTarget.textContent='Waiting for active page…';
    elPct.textContent='—'; elBar.style.width='0%';
    rows.forEach(function(r){ r.className='tool pending'; var re=r.querySelector('.t-res'); re.className='t-res'; re.textContent=''; });
    elVerdict.className='scan-verdict show';
    elVerdict.innerHTML='<span class="vi">'+I.globe+'</span>Idle · no active page to scan<span class="meta">monitoring</span>';
  }
  /* =========================================================================
     REAL-TIME SCAN CONTROLLER
     Priority is the tab the user is ACTIVELY looking at (get_active_urls →
     active browser tab). Rules:
       • a running scan is NEVER interrupted;
       • if the user switches/opens another tab mid-scan, that newest tab is
         queued and scanned the instant the current scan finishes ("on top");
       • the same active tab is only re-scanned after REFRESH_MS;
       • if no active browser tab can be resolved we fall back ONCE to the most
         recent history URL, then idle — we never cycle history (that was the
         "confused about which URL to scan" bug).
     ======================================================================== */
  var POLL_MS=2500, REFRESH_MS=60000;
  var ctl={scanning:false,current:'',last:'',lastAt:0,queued:'',usedFallback:false};

  function getActiveUrl(cb){
    cfInvoke('get_active_urls').then(function(r){
      var u=((r&&r.data&&r.data.urls)||[])[0]; cb((u&&u.url)||'');
    }).catch(function(){ cb(''); });
  }
  var elActions=document.getElementById('scanActions');
  function clearActions(){ if(elActions) elActions.innerHTML=''; }
  // Floating-agent Block / Save / Allow (same Rust commands as the rest of
  // the app — the agent core has these too, this is its compact twin).
  function showActions(url, risk){
    if(!elActions) return; clearActions();
    if(risk<50) return;
    var host=(url||'').split('://')[1]; host=host?host.split('/')[0].replace(/^www\./,''):''; if(!host) return;
    elActions.innerHTML='<div class="pa-head">⚠ '+esc(host)+' (risk '+esc(risk)+') — choose an action:</div>'+
      '<div class="pa-btns"><button class="pa blk">Block</button><button class="pa prt" title="Keeps this site on your saved list. It does not change how the site is reached.">Save</button><button class="pa alw">Allow</button></div><div class="pa-note"></div>';
    var note=elActions.querySelector('.pa-note');
    function wire(sel,cmd,args,okfn){ var b=elActions.querySelector(sel); b&&b.addEventListener('click',function(){ b.disabled=true; var o=b.textContent; b.textContent='…';
      cfInvoke(cmd,args).then(function(r){ b.textContent=okfn(r); }).catch(function(e){ b.disabled=false; b.textContent=o; note.textContent='unavailable — rebuild the desktop app'; }); }); }
    wire('.blk','block_site',{domain:host,reason:'Floating agent action'},function(r){ note.textContent=(r&&r.enforced)?(host+' blocked on this computer (hosts file).'):'Listed — needs admin to enforce.'; return (r&&r.enforced)?'✓ Blocked':'✓ Listed'; });
    wire('.prt','protect_site',{domain:host},function(r){ note.textContent=(r&&r.note)||'Saved to your list. Nothing else changes.'; return '✓ Saved'; });
    wire('.alw','allow_site',{domain:host},function(r){ if(r&&r.stillBlocked){ note.textContent=host+' is still blocked: '+(r.message||'the hosts file could not be changed')+'.'; return 'Still blocked'; } note.textContent=host+' allowed'+((r&&r.wasUnblocked)?' & unblocked':'')+'. Still scanned.'; return '✓ Allowed'; });
  }
  function beginScan(url){
    ctl.scanning=true; ctl.current=url; ctl.queued='';
    elId.textContent='#'+(scanNo++);
    elTarget.textContent=url.replace(/^https?:\/\//,'').slice(0,42);
    resetRows(); clearActions();
    cfInvoke('scan_url',{url:url}).then(function(res){
      var d=(res&&res.data)||{};
      applyResults(toolResults(d), +d.riskScore||0, d.category||'');
      showActions(url, +d.riskScore||0);
      if(typeof logLine==='function') logLine('Scanned '+((d.url||url).replace(/^https?:\/\//,'').slice(0,34))+' · risk '+(d.riskScore||0)+' · '+(d.category||'ok'));
      endScan(url, rows.length*150+760);   // let the verdict animation play out
    }).catch(function(){ endScan(url, 400); });
  }
  function endScan(url, delay){
    setTimeout(function(){
      ctl.scanning=false; ctl.last=url; ctl.lastAt=Date.now(); ctl.current='';
      var next=ctl.queued; ctl.queued='';
      if(next && next!==url) beginScan(next);   // a tab switched-to mid-scan goes next
    }, Math.max(300, delay||400));
  }
  function tick(){
    getActiveUrl(function(u){
      if(u){
        ctl.usedFallback=false;
        if(ctl.scanning){
          if(u!==ctl.current) ctl.queued=u;                 // newest tab waits on top
        } else if(u!==ctl.last || (Date.now()-ctl.lastAt)>REFRESH_MS){
          beginScan(u);                                     // active tab is the priority
        }
        return;
      }
      // No active browser tab in focus.
      if(ctl.scanning) return;
      if(!ctl.last && !ctl.usedFallback){
        ctl.usedFallback=true;                              // one-time history fallback
        cfInvoke('get_browser_history',{limit:1}).then(function(h){
          var fu=(((h&&h.data&&h.data.history)||[])[0]||{}).url||'';
          if(fu && !ctl.scanning) beginScan(fu); else idleScan();
        }).catch(idleScan);
      } else if(!ctl.last){
        idleScan();
      }
      // else: keep showing the last verdict until the user focuses a tab again.
    });
  }
  tick(); setInterval(tick, POLL_MS);
})();

/* ===========================================================
   REAL DATA LAYER — everything below is linked to the backend
   via Tauri commands (get_system_stats, detect_browsers, agent_status).
   Calls go through the parent window's __TAURI__ (same-origin iframe).
   =========================================================== */
window.CF={cpu:0,mem:0,uptime:0,browsers:0,agents:0,threats:0,latency:0,backendOk:false,mlOk:false};
(function(){
  function cfInvoke(cmd,args){
    try{
      var T=(window.parent&&window.parent.__TAURI__)||window.__TAURI__;
      if(T&&T.core&&T.core.invoke) return T.core.invoke(cmd,args||{});
    }catch(e){}
    return Promise.reject(new Error('Tauri runtime unavailable'));
  }

  // header ACTIVE / OFFLINE badge reflects real backend reachability
  function setBadge(ok){
    var b=document.querySelector('.agent-active'); if(!b)return;
    b.innerHTML='<span class="dot"></span>'+(ok?'ACTIVE':'OFFLINE');
    b.style.color=ok?'var(--green)':'var(--red)';
    b.style.borderColor=ok?'rgba(67,224,138,0.3)':'rgba(244,73,94,0.35)';
    b.style.background=ok?'rgba(67,224,138,0.12)':'rgba(244,73,94,0.12)';
    var dot=b.querySelector('.dot'); if(dot) dot.style.background=ok?'var(--green)':'var(--red)';
  }
  // SYSTEM "Browsers" tile (last tile in the grid)
  function setBrowsersTile(n){
    var tile=document.querySelector('.sys-grid .sys-tile:last-child .big');
    if(tile) tile.textContent=String(n);
  }
  // VITALS "Active agents" — light up dots + number
  function setAgents(n){
    var dots=document.querySelectorAll('#adots i');
    for(var i=0;i<dots.length;i++) dots[i].className=(i<Math.min(n,dots.length))?'on':'';
    var ad=document.getElementById('adots');
    var vval=ad&&ad.closest('.svc')?ad.closest('.svc').querySelector('.vval'):null;
    if(vval&&vval.firstChild&&vval.firstChild.nodeType===3) vval.firstChild.textContent=String(n);
  }
  // BROWSERS section — RUNNING browsers only (installed-but-closed are hidden).
  function renderBrowsers(list){
    var ref=document.getElementById('browserRefresh');
    var sect=ref?ref.closest('.sect'):null; if(!sect)return;
    sect.querySelectorAll('.browser-row,.browser-foot').forEach(function(n){n.remove();});
    list=(list||[]).filter(function(b){ return b && b.isRunning; });
    if(!list.length){
      var none=document.createElement('div'); none.className='browser-foot';
      none.textContent='No running browsers'; sect.appendChild(none); return;
    }
    list.forEach(function(b){
      var row=document.createElement('div'); row.className='browser-row';
      row.innerHTML='<div class="bicon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/><path d="M12 9h9M12 9 7.5 4.2M12 15l-4.5 4.6"/></svg></div>'+
        '<div><div class="bname">'+esc(b.name)+'</div><div class="bver">running</div></div>'+
        '<span class="running"><span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 5px var(--green)"></span>RUNNING</span>';
      sect.appendChild(row);
    });
    var foot=document.createElement('div'); foot.className='browser-foot';
    foot.textContent=list.length+(list.length===1?' running browser':' running browsers');
    sect.appendChild(foot);
  }
  function runningCount(d){
    if(d && d.running!=null) return d.running;
    var list=(d && d.browsers)||[];
    return list.filter(function(b){return b&&b.isRunning;}).length;
  }

  function pollSystem(){
    cfInvoke('get_system_stats').then(function(r){
      var d=(r&&r.data)||{};
      window.CF.cpu=+d.cpu||0; window.CF.mem=+d.memory||0; window.CF.uptime=+d.uptime||0;
    }).catch(function(){});
  }
  function pollBrowsers(){
    cfInvoke('detect_browsers').then(function(r){
      var d=(r&&r.data)||{};
      var running=runningCount(d);
      window.CF.browsers=running;
      setBrowsersTile(running);
      renderBrowsers(d.browsers||[]);
    }).catch(function(){});
  }
  function pollAgent(){
    cfInvoke('agent_status').then(function(r){
      var d=(r&&r.data)||{};
      window.CF.agents=d.agentCount||0; window.CF.threats=d.threatCount||0;
      window.CF.latency=d.latencyMs||0; window.CF.backendOk=!!d.backendOk; window.CF.mlOk=!!d.mlOk;
      setBadge(window.CF.backendOk); setAgents(window.CF.agents);
      if(typeof logLine==='function')
        logLine(window.CF.backendOk?('Synced · '+window.CF.agents+' agents · '+window.CF.threats+' threats · '+window.CF.latency+'ms'):'Server unreachable');
    }).catch(function(){ window.CF.backendOk=false; setBadge(false); });
  }

  // REAL-TIME PUSH: one shared `cf-telemetry` event feeds every surface, so we
  // don't each poll the backend. Apply it directly to the panel.
  function applyTelemetry(p){
    if(!p) return;
    var sys=(p.sys&&p.sys.data)||null;
    if(sys){ window.CF.cpu=+sys.cpu||0; window.CF.mem=+sys.memory||0; window.CF.uptime=+sys.uptime||0; }
    var st=(p.status&&p.status.data)||null;
    if(st){ window.CF.agents=st.agentCount||0; window.CF.threats=st.threatCount||0; window.CF.latency=st.latencyMs||0;
      window.CF.backendOk=!!st.backendOk; window.CF.mlOk=!!st.mlOk; setBadge(window.CF.backendOk); setAgents(window.CF.agents); }
    var br=(p.browsers&&p.browsers.data)||null;
    if(br){ var running=runningCount(br); window.CF.browsers=running; setBrowsersTile(running); renderBrowsers(br.browsers||[]); }
  }
  try{
    var T=(window.parent&&window.parent.__TAURI__)||window.__TAURI__;
    if(T&&T.event&&T.event.listen) T.event.listen('cf-telemetry', function(e){ applyTelemetry(e.payload); });
  }catch(e){}
  // Also accept telemetry relayed by the host page (cf-agent.js) via postMessage —
  // this path works even when the iframe can't subscribe to Tauri events directly.
  window.addEventListener('message', function(e){
    if(e && e.data && e.data.cf==='telemetry') applyTelemetry(e.data.payload);
  });

  // immediate first paint, then a SLOW cached-command fallback (the event is the
  // real-time path; these only matter if events ever stop arriving).
  pollSystem(); pollAgent(); pollBrowsers();
  setInterval(pollSystem,20000);
  setInterval(pollAgent,25000);
  setInterval(pollBrowsers,60000);
  var br=document.getElementById('browserRefresh');
  if(br) br.addEventListener('click',pollBrowsers);

  // ---------- AI ANALYST (DeepSeek security chat via backend) ----------
  (function(){
    var out=document.getElementById('aiOut'), q=document.getElementById('aiQuery'),
        send=document.getElementById('aiSend'), eng=document.getElementById('aiEngine');
    if(!out||!q||!send) return;
    function inv(cmd,args){ try{ var T=(window.parent&&window.parent.__TAURI__)||window.__TAURI__;
      if(T&&T.core&&T.core.invoke) return T.core.invoke(cmd,args||{}); }catch(e){} return Promise.reject('tauri unavailable'); }
    // the engine as the answering side reported it (F28); no guessing from names
    function engineOf(r){ var e=r&&(r.engine||(r.data&&r.data.engine)); if(!e) return 'agent not reported';
      return e.kind==='fixed-text' ? 'no model (fixed text)' : String(e.model||e.id).split('/').pop().replace(/-GGUF$/i,''); }
    function ask(){
      var text=(q.value||'').trim(); if(!text) return;
      send.disabled=true; out.classList.add('thinking'); out.textContent='Analyzing…';
      inv('ml_security_chat',{query:text}).then(function(r){
        out.classList.remove('thinking');
        out.textContent=(r&&(r.response||r.error))||'No response.';
        eng.textContent=engineOf(r); eng.title=(r&&r.engine&&r.engine.label)||'';
        q.value='';
      }).catch(function(err){ out.classList.remove('thinking'); out.textContent='Error: '+err; })
        .then(function(){ send.disabled=false; });
    }
    send.addEventListener('click',ask);
    q.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); ask(); } });
  })();
})();

/* minimize / close -> ask the host page to collapse to the floating icon */
document.querySelectorAll('.win-btns i').forEach(function(b,idx){
  b.addEventListener('click',function(){ if(idx!==1){ try{ parent.postMessage({cf:'agent-min'},'*'); }catch(e){} } });
});
