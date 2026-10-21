/* pages/browser-intelligence.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'BROWSER ACTIVITY'});
buildSidebar('browser');
buildFooter({items:[{txt:'Observed pages',cls:'sb-cyan'},{txt:'This computer',cls:'sb-amber'},{txt:'Request methods and response sizes are not captured'}]});
fitWindow('win');

/* domain graph */
(function(){
  const cvs=document.getElementById('dgraph'),ctx=cvs.getContext('2d');
  let W=0,H=0,dpr=Math.min(window.devicePixelRatio||1,2);
  function resize(){const r=cvs.parentElement.getBoundingClientRect();W=r.width;H=r.height;
    cvs.width=W*dpr;cvs.height=H*dpr;cvs.style.width=W+'px';cvs.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  resize();window.addEventListener('resize',resize);
  // center = browser, ring of domains
  let domains=[['scanning…','#5d6c84']];
  window.__setDomains=function(a){ domains=(a&&a.length)?a:[['no active tabs','#5d6c84']]; };
  let pulses=[];
  function frame(t){
    if(W<2){requestAnimationFrame(frame);return;}
    ctx.clearRect(0,0,W,H);
    const cx=W/2,cy=H/2,R=Math.min(W,H)*0.34;
    const pos=domains.map((d,i)=>{const a=i/domains.length*Math.PI*2;return [cx+Math.cos(a)*R,cy+Math.sin(a)*R];});
    // edges
    pos.forEach((p,i)=>{ctx.strokeStyle='rgba(126,148,184,.12)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(p[0],p[1]);ctx.stroke();});
    // domain nodes
    pos.forEach((p,i)=>{const c=domains[i][1];
      ctx.fillStyle=c;ctx.beginPath();ctx.arc(p[0],p[1],4,0,7);ctx.fill();
      ctx.fillStyle='rgba(200,215,235,.7)';ctx.font='9px JetBrains Mono, monospace';ctx.textAlign=p[0]<cx?'right':'left';
      ctx.fillText(domains[i][0], p[0]+(p[0]<cx?-8:8), p[1]+3);});
    // center browser
    ctx.fillStyle='#0d1320';ctx.strokeStyle='rgba(245,166,35,.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(cx,cy,15,0,7);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffb84d';ctx.font='10px JetBrains Mono';ctx.textAlign='center';ctx.fillText('⚿',cx,cy+3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* HTTP history stream is populated from REAL data only — live tabs (browser_intel)
   and the user's actual browser history (get_browser_history) — wired below. */

/* ===========================================================
   BROWSER INTELLIGENCE — real data via Rust (browser_intel:
   running browsers + active tabs + visited domains) + cf-telemetry
   (behavioral alerts = backend threats). Reports to the backend
   via browser_intel_report.
   =========================================================== */
(function(){
  function cfInvoke(cmd,args){ try{ var T=window.__TAURI__||(window.parent&&window.parent.__TAURI__); if(T&&T.core&&T.core.invoke) return CF.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('no tauri')); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function hostOf(u){ try{ return new URL(u).hostname; }catch(e){ return String(u||''); } }
  const USER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="9" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
  const kv=document.querySelectorAll('.kpi .kv'), kd=document.querySelectorAll('.kpi .kd');
  const sessEl=document.getElementById('sess'), httpEl=document.getElementById('http'),
        intcEl=document.getElementById('intercept');
  let lastUrls={};

  function httpEntry(browser,url,host,https,visitedAt){
    if(!httpEl) return;
    const el=document.createElement('div'); el.className='hr'; el.title=url;
    const now=visitedAt?new Date(Number(visitedAt)*1000):new Date(); const ts=now.toLocaleString();
    // the address's scheme, not a status code: nothing here sees the response
    const st=https?['https','ok']:['http','warn'];
    el.innerHTML='<span class="hm get">'+esc(browser||'Unknown')+'</span><span class="hu" style="'+(!https?'color:var(--amber-2)':'')+'">'+esc(url)+'</span>'+
      '<span class="hs '+st[1]+'">'+st[0]+'</span><span class="ht">'+esc(ts)+'</span>';
    httpEl.prepend(el); while(httpEl.children.length>90) httpEl.lastChild.remove();
  }
  // Local browser detection (Rust detect_browsers, via the cf-telemetry event) —
  // independent of the browser extension, so the page shows your real browsers
  // even before any live tab/session is captured.
  var localBrowsers=[], lastSessions=[];
  function renderBrowserKpi(){
    var running=localBrowsers.filter(function(b){return b.isRunning;}).length;
    if(kd[0]) kd[0].textContent = localBrowsers.length ? (running+' running · '+localBrowsers.length+' detected') : '0 browsers';
  }
  function renderSessions(sessions){
    lastSessions=sessions||[];
    if(!sessions||!sessions.length){
      var names=localBrowsers.map(function(b){return esc(b.name)+(b.isRunning?' <span style="color:var(--green)">(running)</span>':'');});
      sessEl.innerHTML = names.length
        ? '<div style="padding:14px;color:var(--dim);font-family:var(--mono);font-size:11px;line-height:1.8">Browsers detected on this device:<br>'+names.map(function(n){return '&nbsp;&nbsp;•&nbsp;'+n;}).join('<br>')+'<br><br><span style="color:var(--faint);font-size:9.5px">No pages observed. Check active-tab consent and browser permissions in Privacy.</span></div>'
        : '<div style="padding:20px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:11px">No active browser tabs detected<br><span style="font-size:9px">(check collection consent and browser permissions in Privacy)</span></div>';
    }
    else sessEl.innerHTML=sessions.map(function(s){
      return '<div class="sr"><span class="sav">'+USER+'</span><div class="sinfo"><div class="su">'+esc(s.browser)+'</div><div class="sm">'+esc(s.host||hostOf(s.url))+'</div></div><span class="sdot" style="'+(s.https?'':'background:var(--amber-2);box-shadow:0 0 5px var(--amber-2)')+'"></span></div>';
    }).join('');
    if(kv[0]) kv[0].textContent=(sessions||[]).length;
    renderBrowserKpi();
  }
  var dgaCache={};          // domain -> {flagged,score} | null (in-flight)
  var lastDomainArr=[];
  function pushDomains(){
    var out=lastDomainArr.slice(0,10).map(function(x){
      var c=dgaCache[x[0]];
      return (c&&c.flagged) ? [x[0]+' ⚠dga', '#f4495e'] : x;
    });
    if(window.__setDomains) window.__setDomains(out.length?out:[['no active tabs','#5d6c84']]);
  }
  var histDomains=[];
  function renderDomains(domains,sessions){
    const arr=[];
    (sessions||[]).forEach(function(s){ var h=s.host||hostOf(s.url); if(h&&!arr.some(function(x){return x[0]===h;})) arr.push([h, s.https?'#43e08a':'#f4495e']); });
    (domains||[]).forEach(function(d){ if(d&&!arr.some(function(x){return x[0]===d;})) arr.push([d,'#2bd4ee']); });
    histDomains.forEach(function(h){ if(h&&!arr.some(function(x){return x[0]===h;})) arr.push([h,'#2bd4ee']); });
    if(!arr.length) return;   // nothing real yet — leave the graph rather than clobbering it
    lastDomainArr=arr; pushDomains();
    if(kv[1]) kv[1].textContent=arr.length;
    // DGA detection on real visited domains (cached, best-effort) — recolors flagged nodes live
    arr.slice(0,10).forEach(function(x){
      var dom=x[0]; if(dom in dgaCache) return; if(!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(dom)) return;
      dgaCache[dom]=null;
      cfInvoke('ml_detect_dga',{domain:dom}).then(function(r){
        dgaCache[dom]={flagged:!!(r&&(r.is_threat||r.prediction==='dga')), score:(r&&r.threat_score)||0};
        if(dgaCache[dom].flagged) pushDomains();
      }).catch(function(){ dgaCache[dom]={flagged:false}; });
    });
  }
  function renderIntercept(sessions){
    const flagged=(sessions||[]).filter(function(s){ return !s.https; });
    intcEl.innerHTML = flagged.length ? flagged.map(function(s){
      return '<div class="intc"><div class="ih"><span class="hm get">HTTP</span><span class="iurl">'+esc(s.host||hostOf(s.url))+'</span></div>'+
        '<div class="iact"><button class="ibtn fwd" data-u="'+esc(s.url)+'">SCAN</button><button class="ibtn drop">DISMISS</button></div></div>';
    }).join('') : '<div style="padding:24px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:11px">No plain-HTTP pages in the current observations. Unobserved tabs have not been checked.</div>';
    document.getElementById('intcCount').textContent=flagged.length+' flagged';
    document.getElementById('kIntc').textContent=flagged.length;
    intcEl.querySelectorAll('.ibtn.drop').forEach(function(b){ b.addEventListener('click',function(){ b.closest('.intc').remove(); }); });
    intcEl.querySelectorAll('.ibtn.fwd').forEach(function(b){ b.addEventListener('click',function(){ var u=b.getAttribute('data-u'); b.textContent='SCANNING…'; cfInvoke('scan_url',{url:u}).then(function(r){ var d=(r&&r.data)||{}; b.textContent='RISK '+(d.riskScore||0); }).catch(function(){ b.textContent='ERR'; }); }); });
  }
  function poll(){
    return cfInvoke('browser_intel').then(function(r){
      const d=(r&&r.data)||{}; const sessions=d.sessions||[];
      renderSessions(sessions); renderDomains(d.domains,sessions); renderIntercept(sessions);
      sessions.forEach(function(s){ if(lastUrls[s.browser]!==s.url){ lastUrls[s.browser]=s.url; httpEntry(s.browser,s.url,s.host||hostOf(s.url),!!s.https,null); } });
    }).catch(function(e){sessEl.textContent='Could not read observed pages: '+String(e.message||e);if(kv[0])kv[0].textContent='—';});
  }
  function applyTel(p){ if(!p) return;
    var st=(p.status&&p.status.data)||null;
    if(st){ if(kv[2]) kv[2].textContent=st.threatCount||0; if(document.getElementById('rpm')) document.getElementById('rpm').textContent=(st.threatCount||0)+' threats on your account'; }
    var br=(p.browsers&&p.browsers.data)||null;
    if(br){ localBrowsers=br.browsers||[]; renderBrowserKpi(); if(!lastSessions.length) renderSessions(lastSessions); }
  }
  // Telemetry may arrive via Tauri events or be relayed by the host page.
  window.addEventListener('message', function(e){ if(e&&e.data&&e.data.cf==='telemetry') applyTel(e.data.payload); });
  try{ var T=window.__TAURI__||(window.parent&&window.parent.__TAURI__);
    if(T&&T.event&&T.event.listen) T.event.listen('cf-telemetry', function(e){ applyTel(e.payload); });
  }catch(e){}

  // REAL browser history → HTTP stream + domain graph (works with no extension).
  var histSeen={};
  function pollHistory(){
    return cfInvoke('get_browser_history',{limit:30}).then(function(r){
      var hist=(r&&r.data&&r.data.history)||[];
      var doms=[]; hist.forEach(function(it){ var h=hostOf(it.url); if(h&&doms.indexOf(h)<0) doms.push(h); });
      histDomains=doms.slice(0,12);
      renderDomains(null, lastSessions);
      hist.slice().reverse().forEach(function(it){
        if(histSeen[it.url]) return; histSeen[it.url]=1;
        httpEntry(it.browser,it.url,hostOf(it.url),/^https:/i.test(it.url),it.lastVisit);
      });
    }).catch(function(e){httpEl.textContent='Could not read history: '+String(e.message||e);});
  }
  const clear=document.querySelector('.btn-refresh');
  if(clear)clear.addEventListener('click',function(){httpEl.textContent='Visible observations cleared. New observations will appear here; browser history and stored records were not deleted.';});

  window.addEventListener('cf:refresh-page',function(e){const task=Promise.all([poll(),pollHistory()]);if(e.detail)e.detail.waitUntil(task);});
  poll(); setInterval(poll,6000);
  pollHistory(); setInterval(pollHistory,12000);
  cfInvoke('browser_intel_report').catch(function(){});
  setInterval(function(){ cfInvoke('browser_intel_report').catch(function(){}); },60000);
})();

document.getElementById('browserPrivacy').addEventListener('click',function(){window.openCfSettings('privacy');});
document.querySelectorAll('details').forEach(function(d){d.addEventListener('toggle',function(){window.dispatchEvent(new Event('resize'));});});

CF.invoke('privacy_get').then(function(p){
  const node=document.getElementById('browserCollection');
  const wanted=['history_access','active_tab','cloud_scanning'];
  node.textContent=(p.features||[]).filter(f=>wanted.includes(f.id)).map(f=>f.label+': '+(f.enabled?'on':'off')).join(' · ')||'Collection state unavailable';
}).catch(function(){document.getElementById('browserCollection').textContent='Collection state unavailable';});
