/* pages/agent-core.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'LOCAL RUNTIME',search:'Ask the agent or search actions…',cta:'New Task',chips:''});
buildSidebar('agentcore');
buildFooter({items:[{txt:'CPU —',cls:'sb-amber',id:'sbCpu'},{txt:'MEM —',cls:'sb-cyan',id:'sbMem'},{txt:'idle',id:'sbRun'}]});
fitWindow('win');

/* ring gauges */
function rg(svg,pct,color){
  const cx=23,cy=23,r=18,sw=4.5,C=2*Math.PI*r;
  svg.innerHTML='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="rgba(126,148,184,.16)" stroke-width="'+sw+'"/>'+
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" '+
    'stroke-dasharray="'+(C*pct/100).toFixed(1)+' '+C+'" transform="rotate(-90 '+cx+' '+cy+')" style="transition:stroke-dasharray .9s cubic-bezier(.2,.8,.2,1);filter:drop-shadow(0 0 4px '+color+')"/>';
}
const gauges=[...document.querySelectorAll('[data-rg]')].map(s=>({svg:s,color:s.dataset.color,target:+s.dataset.rg}));
gauges.forEach(g=>rg(g.svg,0,g.color));
setTimeout(()=>gauges.forEach(g=>rg(g.svg,g.target,g.color)),80);
const cpuV=document.getElementById('cpuV'),ramV=document.getElementById('ramV'),linkV=document.getElementById('linkV'),
      sbCpu=document.getElementById('sbCpu'),sbMem=document.getElementById('sbMem');
// Every figure here is a reading the app took. Until one arrives the gauge is
// empty and says so; nothing is filled in to look busy.
function showReadings(){
  var d=window.CFA||{};
  if(d.sysSeen){
    var c=Math.max(0,Math.min(100,d.cpu)), m=Math.max(0,Math.min(100,d.mem));
    rg(gauges[0].svg,c,gauges[0].color); rg(gauges[1].svg,m,gauges[1].color);
    cpuV.textContent=Math.round(c)+'%'; if(sbCpu)sbCpu.textContent='CPU '+Math.round(c)+'%';
    ramV.textContent=Math.round(m)+'%'; if(sbMem)sbMem.textContent='MEM '+Math.round(m)+'%';
    document.getElementById('cpuS').textContent=d.cores?(d.cores+' logical cores'):'this computer';
    document.getElementById('ramS').textContent='of installed memory in use';
    if(d.hostname) document.getElementById('idSub').textContent=d.hostname;
  }
  if(d.statusSeen){
    rg(gauges[2].svg,d.backendOk?100:0,d.backendOk?'var(--green)':'var(--red)');
    linkV.textContent=d.backendOk?'OK':'OFF';
    document.getElementById('linkS').textContent=d.backendOk?((d.latency||0)+' ms round trip'):'server not reachable';
  }
}
setInterval(showReadings,2400);

/* sparklines: the last readings actually taken, oldest first */
const SAMPLES={cpuSpark:[],ramSpark:[],linkSpark:[]};
function drawSpark(id){
  const el=document.getElementById(id), h=SAMPLES[id], W=54, H=20;
  if(h.length<2){
    el.innerHTML='<title>No samples yet</title><line x1="2" y1="'+(H/2)+'" x2="'+(W-2)+'" y2="'+(H/2)+'" stroke="var(--faint)" stroke-width="1" stroke-dasharray="2 3" opacity=".6"/>';
    return;
  }
  const top=Math.max.apply(null,h)||1;
  const pts=h.map((v,i)=>(i*(W/(h.length-1))).toFixed(1)+','+(H-2-(v/top)*(H-4)).toFixed(1)).join(' ');
  el.innerHTML='<title>Last '+h.length+' readings</title><polyline points="'+pts+'" fill="none" stroke="var(--cyan)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>';
}
function addSample(id,value){
  if(typeof value!=='number'||isNaN(value)) return;
  const h=SAMPLES[id]; h.push(value); if(h.length>16) h.shift(); drawSpark(id);
}
Object.keys(SAMPLES).forEach(drawSpark);

/* ============ REASONING CHAIN ============ */
const STEPS=[['Perceive','globe'],['Retrieve','box'],['Reason','brain'],['Plan','branch'],['Act','bolt'],['Verify','check']];
const ICO={
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/></svg>',
  box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4-9 4Z"/><path d="M3 7v10l9 4 9-4V7"/></svg>',
  brain:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a4 4 0 0 0-4 4 4 4 0 0 0-1 7 4 4 0 0 0 5 4 4 4 0 0 0 5-4 4 4 0 0 0-1-7 4 4 0 0 0-4-4Z"/></svg>',
  branch:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.5 7.5 11 16M16.5 7.5 13 16"/></svg>',
  bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>'
};
const chain=document.getElementById('chain');
let chainHtml='';
STEPS.forEach((s,i)=>{
  chainHtml+='<div class="cstep" data-i="'+i+'"><div class="cn">'+ICO[s[1]]+'</div><div class="cl2">'+s[0]+'</div></div>';
  if(i<STEPS.length-1) chainHtml+='<div class="cconn" data-c="'+i+'"></div>';
});
chain.innerHTML=chainHtml;
const steps=[...chain.querySelectorAll('.cstep')], conns=[...chain.querySelectorAll('.cconn')];
// The chain used to advance on a timer whether or not anything was running.
// The agent reports no per-step events, so no step is lit: the label says
// whether a scan started from this page is in flight, and when the last ended.
let runsInFlight=0;
function showRunState(note){
  const running=runsInFlight>0;
  const text=running?'scan in progress':(note||'idle');
  document.getElementById('chainPhase').textContent=text;
  document.getElementById('runTxt').textContent=running?'Scanning':'Idle';
  const sb=document.getElementById('sbRun'); if(sb) sb.textContent=running?'scan in progress':'idle';
  steps.forEach(s=>s.classList.remove('active','done')); conns.forEach(c=>c.classList.remove('fill'));
}
showRunState();

/* ============ CONSOLE — agent activity ============ */
const con=document.getElementById('console');
// "Pause display" stops new lines appearing here. It does not pause the agent.
let paused=false, heldLines=0;
function pushLine(c,tag,msg){
  if(paused){ heldLines++; return; }
  const now=new Date();
  const ts=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  const el=document.createElement('div'); el.className='cl '+c;
  el.innerHTML='<span class="ts">'+ts+'</span><span class="tag">'+tag+'</span><span class="msg">'+msg+'</span>';
  con.appendChild(el); con.scrollTop=con.scrollHeight;
  while(con.children.length>40) con.firstChild.remove();
}
pushLine('think','START','Agent Core opened — checking the server…');

/* ============ AGENT TERMINAL — chat with the agent (grounded in memory) ============ */
(function(){
  var ti=document.getElementById('termInput'), tsend=document.getElementById('termSend');
  if(!ti||!tsend) return;
  var busy=false;
  function esc(s){ return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c];}); }
  function pushHtml(c,tag,html){ var now=new Date(); var t=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
    var el=document.createElement('div'); el.className='cl '+c; el.innerHTML='<span class="ts">'+t+'</span><span class="tag">'+tag+'</span><span class="msg">'+html+'</span>';
    con.appendChild(el); con.scrollTop=con.scrollHeight; while(con.children.length>60) con.firstChild.remove(); return el; }
  function inv(cmd,args){ try{ if(window.CF&&CF.invoke) return CF.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('no tauri')); }
  function ask(q){
    if(busy||!q) return; busy=true; tsend.classList.add('busy'); ti.value='';
    pushHtml('you','YOU', esc(q));
    var thinking=pushHtml('think','AGENT','<span class="eqp"><i></i><i></i><i></i><i></i></span>waiting for the answer…');
    var memP=(window.CF&&CF.gatherMemory)?CF.gatherMemory(q):Promise.resolve([]);
    memP.then(function(mems){
      var query=(window.CF&&CF.augmentQuery)?CF.augmentQuery(q,mems):q;
      return inv('ml_security_chat',{query:query, maxTokens:600}).then(function(body){ return {body:body, mems:mems}; });
    }).then(function(o){
      var d=(o.body&&o.body.data)||o.body||{}; var txt=d.response||d.answer||d.text||d.reply||(o.body&&o.body.message)||'No response.';
      if(thinking&&thinking.parentNode) thinking.remove();
      var rb=pushHtml('obs','AGENT', esc(txt).replace(/\n/g,'<br>')+'<br><span style="opacity:.7;font-size:10px">answered by: '+esc(CF.engineLabel(o.body))+'</span>');
      var threat=(window.CF&&CF.threatFromMemory)?CF.threatFromMemory(o.mems):null;
      if(threat && window.CF&&CF.threatActions){ rb.querySelector('.msg').appendChild(CF.threatActions({host:threat.host, risk:threat.risk})); con.scrollTop=con.scrollHeight; }
      busy=false; tsend.classList.remove('busy');
    }).catch(function(e){ if(thinking&&thinking.parentNode) thinking.remove(); pushHtml('warn','ERROR', esc(String((e&&e.message)||e))); busy=false; tsend.classList.remove('busy'); });
  }
  tsend.addEventListener('click',function(){ ask((ti.value||'').trim()); });
  ti.addEventListener('keydown',function(e){ if(e.key==='Enter') ask((ti.value||'').trim()); });
  pushHtml('obs','AGENT','Terminal ready — ask me about threats, scans, hosts or actions. I read your CyberForge memory to answer, and can Block, Save or Allow flagged sites.');
})();

/* ops counter — real backend latency */
const ops=document.getElementById('ops'), conBadge=document.getElementById('conBadge'), modelEl=document.getElementById('model');
setInterval(()=>{ var d=window.CFA||{};
  ops.textContent=!d.statusSeen?'checking…':(d.backendOk?('live · '+(d.latency||0)+'ms'):'offline');
  conBadge.textContent=paused?'DISPLAY PAUSED':(!d.statusSeen?'CONNECTING':(d.backendOk?'LIVE':'OFFLINE'));
  modelEl.textContent='Analysis Agents: '+(!d.statusSeen?'checking…':(d.mlOk?'online':'unavailable'));
},1000);

/* ============ TASK QUEUE ============ */
// The agent does not publish a queue. What is listed is what this page itself
// started and has seen finish: no sample tasks, and no percentage, because
// a scan reports none while it runs.
const queue=document.getElementById('queue');
const tasks=[];
function tq(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function renderQueue(){
  const active=tasks.filter(t=>t.state==='run').length;
  document.getElementById('qcount').textContent=active+' active';
  if(!tasks.length){ queue.innerHTML='<div class="tq-empty">No tasks. Scans started here are listed while they run; the agent does not report any other queue yet.</div>'; return; }
  queue.innerHTML=tasks.map((t,i)=>
    '<div class="tq '+t.state+(i?' row-div':'')+'"><span class="tqi"></span><span class="tqn">'+tq(t.name)+'</span><span class="tqt">'+tq(t.note)+'</span></div>'+
    (t.state==='run'?'<div class="tq-prog" title="In progress: the scan reports no percentage"><i></i></div>':'')
  ).join('');
}
function startTask(name){ const t={name:name,state:'run',note:'running'}; tasks.unshift(t); if(tasks.length>6) tasks.pop(); renderQueue(); return t; }
function endTask(t,ok,note){ t.state=ok?'done':'queue'; t.note=note; renderQueue(); }
renderQueue();

/* quick actions: only "Scan current/recent page" does something; the others say so */
document.querySelectorAll('.qa').forEach(qa=>{
  var label=((qa.querySelector('span')||{}).textContent||'').trim();
  if(qa.classList.contains('na')){
    qa.addEventListener('click',()=>pushLine('warn','N/A','<b>'+label+'</b> is not available: '+qa.dataset.na+'.'));
    return;
  }
  attachRipple(qa);
  qa.addEventListener('click',()=>{
    if(label==='Scan current/recent page' && typeof window.runSweep==='function'){ qa.classList.add('busy'); setTimeout(()=>qa.classList.remove('busy'),900); window.runSweep(); }
  });
});

/* pause display: holds back new console lines. The agent itself is not paused,
   and there is no control here that pauses it. */
const btnPause=document.getElementById('btnPause');
btnPause.title='Stops new lines appearing in this console. The agent keeps running.';
btnPause.addEventListener('click',()=>{
  paused=!paused;
  btnPause.innerHTML=paused
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 14 8-14 8Z"/></svg>Resume display'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>Pause display';
  if(!paused && heldLines){ var n=heldLines; heldLines=0; pushLine('obs','DISPLAY',n+' line'+(n===1?'':'s')+' not shown while the display was paused. The agent kept running.'); }
});

/* ===========================================================
   REAL DATA LAYER — Agent Core wired to Tauri + backend, kept
   in sync with the floating agent via shared scan state.
   =========================================================== */
// sysSeen / statusSeen: nothing is displayed for a reading that has not arrived.
window.CFA={cpu:0,mem:0,latency:0,backendOk:false,mlOk:false,agents:0,threats:0,sysSeen:false,statusSeen:false};
(function(){
  function cfInvoke(cmd,args){ return CF.invoke(cmd,args||{}); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // One place records a reading, whether it came from a poll or a pushed event.
  function takeSystem(d){
    if(!d || d.cpu==null || d.memory==null) return;
    var C=window.CFA; C.cpu=+d.cpu||0; C.mem=+d.memory||0; C.cores=+d.cpu_count||0; C.hostname=d.hostname||''; C.sysSeen=true;
    addSample('cpuSpark',C.cpu); addSample('ramSpark',C.mem); showReadings();
  }
  function takeStatus(d){
    if(!d) return;
    var C=window.CFA; C.latency=d.latencyMs||0; C.backendOk=!!d.backendOk; C.mlOk=!!d.mlOk; C.agents=d.agentCount||0; C.threats=d.threatCount||0; C.statusSeen=true;
    if(C.backendOk) addSample('linkSpark',C.latency);
    var st=document.querySelector('.id-state');
    if(st){ st.innerHTML='<span class="dot"></span>'+(C.backendOk?('ONLINE · '+(+C.agents||0)+' agent'+(C.agents===1?'':'s')):'OFFLINE');
      st.style.color=C.backendOk?'var(--green)':'var(--red)'; }
    var sG=document.getElementById('sAgents'); if(sG) sG.textContent=C.backendOk?String(C.agents):'—';
    showReadings();
  }
  function pollSystem(){ return cfInvoke('get_system_stats').then(function(r){ takeSystem(r&&r.data); }).catch(function(){}); }
  function pollStatus(){ return cfInvoke('agent_status').then(function(r){ takeStatus(r&&r.data); }).catch(function(){}); }
  window.addEventListener('cf:refresh-page',function(e){const task=Promise.all([pollSystem(),pollStatus()]);if(e.detail)e.detail.waitUntil(task);});
  function pollActivity(){
    cfInvoke('agent_alerts').then(function(r){ var d=(r&&r.data)||{}; var arr=d.alerts||[];
      var sA=document.getElementById('sActions'),sR=document.getElementById('sResolved');
      // a failed read leaves the last figures (or "—") in place; it is not shown as zero
      if(r && r.success===false) return;
      if(sA) sA.textContent=String(d.count||arr.length||0);
      var resolved=arr.filter(function(a){var s=(a.status||'').toLowerCase();return s==='resolved'||s==='dismissed';}).length;
      if(sR) sR.textContent=String(resolved);
    }).catch(function(){});
  }
  var lastScanId=null;
  function showScan(d){
    if(!d||!d.url) return; var id=(d.url||'')+'|'+(d.scannedAt||'');
    if(id===lastScanId) return; lastScanId=id;
    // This is a finished scan being reported, so it is written as a result:
    // one line, with what was and was not checked. No staged "analyzing" steps.
    var shown=esc((d.url||'').replace(/^https?:\/\//,'').slice(0,40)); var risk=+d.riskScore||0;
    var host=(d.url||'').split('://')[1]; host=host?host.split('/')[0].replace(/^www\./,''):'';
    if(d.verdict==='unknown' && risk<50){
      pushLine('warn','SCAN','<b>'+shown+'</b> — not verified: neither the Analysis Agents nor the page could be checked.');
    } else if(risk>=50){
      pushLine('warn','ALERT','<b>'+shown+'</b> — risk <b>'+risk+'/100</b> · '+esc((d.category||'threat').toUpperCase())+' — '+esc((d.summary||'').slice(0,90)));
      if(host && window.CF&&CF.threatActions && !paused){ var line=document.createElement('div'); line.className='cl warn';
        line.innerHTML='<span class="ts"></span><span class="tag">ACTION</span><span class="msg"></span>';
        line.querySelector('.msg').appendChild(CF.threatActions({host:host, risk:risk})); con.appendChild(line); con.scrollTop=con.scrollHeight; }
    } else {
      pushLine('obs','SCAN','<b>'+shown+'</b> — risk <b>'+risk+'/100</b> · '+esc(d.category||'no category')+(d.backendAvailable===false?' · Analysis Agents did not answer':'')+(d.summary?(' — '+esc(String(d.summary).slice(0,90))):''));
    }
  }
  function pollScan(){ cfInvoke('get_last_scan').then(function(s){ if(s&&s.data) showScan(s.data); }).catch(function(){}); }
  window.runSweep=function(){
    pushLine('act','ACTION','Scan current/recent page: scanning the most recent browser address…');
    function scan(url){
      var shown=url.replace(/^https?:\/\//,'').slice(0,40);
      pushLine('act','ACTION','Scanning '+esc(shown)+' …');
      var task=startTask('Scan '+shown); runsInFlight++; showRunState();
      function finished(ok,note){ runsInFlight=Math.max(0,runsInFlight-1); endTask(task,ok,note);
        var now=new Date(); showRunState((ok?'last scan finished ':'last scan failed ')+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')); }
      return cfInvoke('scan_url',{url:url}).then(function(){ finished(true,'done'); pollScan(); },
        function(e){ finished(false,'failed'); pushLine('warn','ERROR','Scan failed: '+esc(String((e&&e.message)||e))); });
    }
    cfInvoke('get_active_urls').then(function(r){
      var url=(((r&&r.data&&r.data.urls)||[])[0]||{}).url||'';
      if(url) return scan(url);
      // no live tab (extension) → scan the most recent real history URL
      return cfInvoke('get_browser_history',{limit:1}).then(function(h){
        var u=(((h&&h.data&&h.data.history)||[])[0]||{}).url||'';
        if(u) return scan(u);
        pushLine('warn','ALERT','No browser URL to scan yet — open a page and retry.');
      });
    }).catch(function(){ pushLine('warn','ALERT','Scan failed — server unreachable or not signed in.'); });
  };

  // REAL-TIME PUSH: one shared cf-telemetry event drives the screen + keeps it
  // in sync with the floating agent; the pollers below are a slow fallback.
  function applyTelemetry(p){
    if(!p) return;
    takeSystem(p.sys&&p.sys.data);
    takeStatus(p.status&&p.status.data);
    if(p.lastScan&&p.lastScan.data) showScan(p.lastScan.data);
  }
  try{ var T=window.__TAURI__||(window.parent&&window.parent.__TAURI__);
    if(T&&T.event&&T.event.listen) T.event.listen('cf-telemetry', function(e){ applyTelemetry(e.payload); });
  }catch(e){}

  pollSystem(); pollStatus(); pollActivity(); pollScan();
  setInterval(pollSystem,20000); setInterval(pollStatus,25000); setInterval(pollActivity,15000); setInterval(pollScan,8000);
  // Real-time: refresh activity / last-scan the instant a live SSE event arrives.
  window.addEventListener('cf:agent', function(){ try{ pollActivity(); }catch(e){} });
  window.addEventListener('cf:scan', function(){ try{ pollScan(); pollActivity(); }catch(e){} });
})();


