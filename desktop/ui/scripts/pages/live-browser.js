/* pages/live-browser.html — the Live Agent: the agent checks a page in its own browser
   (desktop/src-tauri/src/live_browse.rs) and every step is shown here as it happens.
   The picture is the agent's browser screen, streamed; the cursor, highlight box and
   click ripple are placed at the real positions the agent reports. Everything from
   the page is set as text, never as HTML. */
buildHeader({status:'LIVE AGENT',search:'Look up a domain'});
buildSidebar('livebrowser');
buildFooter({items:[{txt:'Isolated agent browser',cls:'sb-cyan'},{txt:'Hover · click · verify',cls:'sb-amber'},{txt:'Never types or submits',cls:'sb-green'}]});
fitWindow('win');

(function(){
  var VIEW_W=1280;
  var $=function(id){ return document.getElementById(id); };
  var win=$('lbWindow'), screen=$('lbScreen'), frame=$('lbFrame'), empty=$('lbEmpty'), emptyText=$('lbEmptyText');
  var cursor=$('lbCursor'), box=$('lbBox'), tag=$('lbTag'), steps=$('lbSteps'), caption=$('lbCaption'), elapsed=$('lbElapsed');
  var urlInput=$('lbUrl'), sourceChip=$('lbSource'), startBtn=$('lbStart'), stopBtn=$('lbStop'), mineBtn=$('lbMine'), follow=$('lbFollow');
  var run=0, running=false, startedAt=0, timer=0, lastPoint=null, lastUrl='', stepCount=0, currentStep=null;

  function invoke(cmd,args){ try{ if(window.CF&&CF.invoke) return CF.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('Desktop runtime unavailable')); }
  function msg(e){ return String((e&&e.message)||e||'unknown error'); }
  function el(t,c,x){ var e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; }
  function icon(name){ var t=$('ic-'+name)||$('ic-inspect'); return t.content.firstElementChild.cloneNode(true); }
  function ago(sec){ var s=Math.max(0,Math.floor(Date.now()/1000)-(+sec||0)); return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':Math.floor(s/3600)+' h ago'; }

  /* ---------- status ---------- */
  function status(text){ $('lbStatus').textContent=text; }
  function setRunning(on){
    running=on; win.classList.toggle('running',on); stopBtn.disabled=!on; startBtn.disabled=false;
    clearInterval(timer);
    if(on){ startedAt=Date.now(); timer=setInterval(function(){ elapsed.textContent=((Date.now()-startedAt)/1000).toFixed(0)+' s'; },500); }
  }

  /* ---------- the overlay: cursor, box, label, ripple ---------- */
  function scale(){ return screen.clientWidth/VIEW_W; }
  function placeCursor(px,py){ var k=scale(); cursor.style.transform='translate('+(px*k-3)+'px,'+(py*k-3)+'px)'; cursor.classList.add('on'); }
  function placeTag(px,py,text){
    var k=scale(); tag.textContent=text; tag.classList.add('on');
    var x=px*k+18, y=py*k+20, w=tag.offsetWidth||200;
    if(x+w>screen.clientWidth-8) x=Math.max(8,px*k-w-14);
    if(y>screen.clientHeight-40) y=py*k-40;
    tag.style.transform='translate('+x+'px,'+y+'px)';
  }
  function placeBox(t,kind){
    var k=scale();
    box.style.left=(t.x*k-4)+'px'; box.style.top=(t.y*k-4)+'px'; box.style.width=(t.w*k+8)+'px'; box.style.height=(t.h*k+8)+'px';
    box.className='lb-box on'+(kind==='inspect'?' inspect':'');
  }
  function ripple(px,py){
    var k=scale(), r=el('div','lb-ripple'); r.style.left=(px*k)+'px'; r.style.top=(py*k)+'px'; screen.appendChild(r);
    cursor.classList.add('press'); setTimeout(function(){ cursor.classList.remove('press'); },140);
    setTimeout(function(){ if(r.parentNode) r.parentNode.removeChild(r); },700);
  }
  function clearOverlay(){ box.className='lb-box'; tag.classList.remove('on'); cursor.classList.remove('on'); lastPoint=null; }
  // The screen changes size with the window, the sidebar and the side panel: keep the
  // overlay on the element it points at, without animating the correction.
  function replace(){
    if(!lastPoint) return;
    [cursor,box,tag].forEach(function(e){ e.style.transition='none'; });
    placeCursor(lastPoint.px,lastPoint.py); placeBox(lastPoint,lastPoint.kind); placeTag(lastPoint.px,lastPoint.py,tag.textContent);
    if(box.classList.contains('on')&&lastPoint.high) box.classList.add('high');
    void screen.offsetWidth; [cursor,box,tag].forEach(function(e){ e.style.transition=''; });
  }
  if(window.ResizeObserver) new ResizeObserver(replace).observe(screen); else window.addEventListener('resize',replace);

  /* ---------- the step list ---------- */
  function addStep(action,label,detail){
    if(currentStep) currentStep.classList.remove('cur');
    var li=el('div','lb-step cur'); var ic=el('span','ic'); ic.appendChild(icon(action)); li.appendChild(ic);
    var tx=el('div','tx'); tx.appendChild(el('b',null,label)); if(detail) tx.appendChild(el('span',null,detail)); li.appendChild(tx);
    steps.appendChild(li); currentStep=li; stepCount++; $('lbCount').textContent=String(stepCount);
    li.scrollIntoView({block:'nearest',behavior:'smooth'});
    return li;
  }
  function addFinding(f){
    var host=currentStep&&currentStep.querySelector('.tx'); if(!host) return;
    host.appendChild(el('div','lb-f '+(f.severity||'info'),f.text));
    if(f.severity==='high'&&lastPoint){ box.classList.add('high'); lastPoint.high=true; }
  }

  /* ---------- evidence ---------- */
  var facts=$('lbFacts'), factRows={};
  function addFact(p){
    var key=String(p.key||''); if(!key) return;
    var row=factRows[key];
    if(!row){ row=el('div','lb-fact'); row.appendChild(el('span','k',key)); row.appendChild(el('span','v')); facts.appendChild(row); factRows[key]=row; }
    else { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
    row.className='lb-fact'+(p.tone?' '+p.tone:'')+(row.classList.contains('flash')?' flash':'');
    row.querySelector('.v').textContent=String(p.value==null?'':p.value);
    $('lbFactCount').textContent=String(Object.keys(factRows).length);
  }
  function clearFacts(){ facts.textContent=''; factRows={}; $('lbFactCount').textContent=''; }
  var agentsPanel=$('lbAgents');
  function showTab(which){
    [['steps','lbTabSteps',steps],['facts','lbTabFacts',facts],['agents','lbTabAgents',agentsPanel]].forEach(function(t){
      var on=t[0]===which; $(t[1]).setAttribute('aria-selected',on?'true':'false'); t[2].hidden=!on;
    });
  }
  $('lbTabSteps').addEventListener('click',function(){ showTab('steps'); });
  $('lbTabFacts').addEventListener('click',function(){ showTab('facts'); });
  $('lbTabAgents').addEventListener('click',function(){ showTab('agents'); });

  /* ---------- the eight analysis agents, working on the same address ---------- */
  var AGENTS=[
    {id:'url_classifier',name:'URL classifier',stage:1,does:'BERT phishing and malware model'},
    {id:'dga_detector',name:'DGA detector',stage:1,does:'machine-generated host name?'},
    {id:'web_scraper',name:'Web scraper',stage:1,does:'the page in a rendered-page scanner'},
    {id:'memory',name:'Memory reader',stage:1,does:'this domain’s history'},
    {id:'ioc_extractor',name:'IOC extractor',stage:2,does:'domains, IPs, URLs, hashes'},
    {id:'behavioral',name:'Behavioural analyser',stage:2,does:'forms, scripts, redirects'},
    {id:'mitre_mapper',name:'MITRE mapper',stage:3,does:'ATT&CK techniques'},
    {id:'threat_intel',name:'Threat intelligence',stage:3,does:'AlienVault OTX lookups'},
    {id:'reporter',name:'Reporter',stage:4,does:'weighs the evidence, decides'}
  ];
  var STAGE_NAME={1:'Stage 1 · in parallel',2:'Stage 2 · needs the page',3:'Stage 3 · needs the IOCs',4:'Report'};
  var agentRows={}, agentsRun='', agentsDone=0;
  function agentDetail(id,r){
    if(!r) return '';
    switch(id){
      case 'url_classifier': return (r.verdict||r.label||'?')+(r.confidence!=null?' · '+r.confidence+'%':'');
      case 'dga_detector': return (r.verdict==='dga'?'looks generated':'looks legitimate')+(r.confidence!=null?' · '+r.confidence+'%':'');
      case 'web_scraper': return (r.pageLoaded?'page loaded':'page not loaded')+' · evidence '+(r.evidenceStatus||'?')+(r.networkRequests!=null?' · '+r.networkRequests+' requests':'');
      case 'memory': return r.visitCount?(r.visitCount+' earlier visits · last verdict '+(r.lastVerdict||'none')):'first visit to this domain';
      case 'ioc_extractor': return (r.count||0)+' indicators';
      case 'behavioral': return (r.findings&&r.findings.length)?String(r.findings[0]):((r.forms||0)+' forms · nothing risky');
      case 'mitre_mapper': return (r.techniqueCount||0)+' techniques'+(r.techniques&&r.techniques[0]?' · '+(r.techniques[0].id||'')+' '+(r.techniques[0].name||''):'');
      case 'threat_intel': return (r.checked||0)+' checked · '+(r.flagged||0)+' known bad';
      default: return '';
    }
  }
  function agentState(id,state,detail,ms){
    var row=agentRows[id]; if(!row) return;
    row.className='lb-agent '+state;
    row.querySelector('.st').textContent=state==='ok'?'✓':state==='failed'?'✕':state==='running'?'':'•';
    if(detail!=null) row.querySelector('.d').textContent=detail;
    row.querySelector('.ms').textContent=ms!=null?(ms/1000).toFixed(1)+' s':'';
  }
  function agentsHead(text,tone){ var h=$('lbAgentsHead'); h.className='lb-agents-head'+(tone?' '+tone:''); h.textContent=text; }
  function resetAgents(note){
    agentsPanel.textContent=''; agentRows={}; agentsDone=0; $('lbAgentCount').textContent='';
    var head=document.createElement('div'); head.id='lbAgentsHead'; agentsPanel.appendChild(head);
    var result=document.createElement('div'); result.id='lbAgentsResult'; agentsPanel.appendChild(result);
    var stage=0;
    AGENTS.forEach(function(a){
      if(a.stage!==stage){ stage=a.stage; agentsPanel.appendChild(el('div','lb-agent-stage',STAGE_NAME[stage])); }
      var row=el('div','lb-agent wait');
      var st=el('span','st','•'); var main=el('div','m'); main.appendChild(el('b',null,a.name)); main.appendChild(el('span','d',a.does));
      row.appendChild(st); row.appendChild(main); row.appendChild(el('span','ms',''));
      agentsPanel.appendChild(row); agentRows[a.id]=row;
    });
    agentsHead(note||'The agents start when a run starts.');
  }
  function agentsFinal(rep){
    var box=$('lbAgentsResult'); box.textContent='';
    var risk=Math.max(0,Math.min(100,+rep.riskScore||0)), v=String(rep.verdict||'unknown');
    var tone=v==='malicious'?'bad':v==='suspicious'?'warn':v==='clean'?'good':'';
    var top=el('div','lb-agents-verdict '+tone); top.appendChild(el('b',null,v)); top.appendChild(el('span',null,'risk '+risk+'/100 · page evidence '+(rep.evidenceStatus||'unknown')));
    box.appendChild(top);
    if(rep.summary){ box.appendChild(el('p','lb-agents-summary',String(rep.summary).replace(/\*\*/g,'').slice(0,900))); }
    (rep.findings||[]).slice(0,5).forEach(function(f){ box.appendChild(el('div','lb-agents-finding',String(f))); });
    var failed=(rep.coverage&&rep.coverage.agents_failed)||[];
    if(failed.length) box.appendChild(el('div','lb-agents-gap','Did not answer: '+failed.map(function(id){ var a=AGENTS.filter(function(x){return x.id===id;})[0]; return a?a.name:id; }).join(', ')+'. Missing evidence is reported as a gap, never as safe.'));
    agentsHead('Analysis agents finished',tone);
    addFact({key:'Analysis agents',value:v+' · risk '+risk+'/100',tone:tone==='bad'?'bad':tone==='warn'?'warn':tone==='good'?'good':''});
  }
  if(window.CF&&CF.listen) CF.listen('cf-agents-stream',function(p){
    if(!p||p.id!==agentsRun||!p.event) return;
    var e=p.event;
    if(e.type==='agent_start'){ agentState(e.agent,'running',null,null); agentsHead('Agents working · '+agentsDone+'/8 done'); }
    else if(e.type==='agent'){
      var ok=e.status==='ok';
      agentState(e.agent,ok?'ok':'failed',ok?(agentDetail(e.agent,e.result)||'done'):('did not answer: '+(e.error||'unknown reason')),e.latencyMs);
      if(e.agent!=='reporter'){ agentsDone++; $('lbAgentCount').textContent=agentsDone+'/8'; agentsHead('Agents working · '+agentsDone+'/8 done'); }
    }
  });
  function startAgents(url){
    if(!url) return;
    var id='ag'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); agentsRun=id;
    resetAgents('Starting the eight analysis agents on this address…');
    invoke('agents_analyze_stream',{url:url,requestId:id}).then(function(rep){
      if(agentsRun!==id||!rep) return;
      if(rep.streamed===false){ AGENTS.forEach(function(a){ var r=rep.agents&&rep.agents[a.id]; if(r) agentState(a.id,r.status==='ok'?'ok':'failed',r.status==='ok'?agentDetail(a.id,r.result):('did not answer: '+(r.error||'')),r.latencyMs); }); }
      agentsFinal(rep);
    }).catch(function(e){
      if(agentsRun!==id) return;
      var why=msg(e);
      agentsHead(/privacy|cloud scanning|not allowed|consent/i.test(why)?'The analysis agents need Cloud scanning (Settings › Privacy). Nothing was sent.':why,'warn');
      AGENTS.forEach(function(a){ var row=agentRows[a.id]; if(row&&/wait|running/.test(row.className)) agentState(a.id,'wait',null,null); });
    });
  }
  resetAgents();

  /* ---------- verdict ---------- */
  function verdict(v){
    var risk=Math.max(0,Math.min(100,+v.risk||0)), C=2*Math.PI*36;
    var color=risk>=70?'#ff4d6a':risk>=40?'var(--amber-2)':'var(--green)';
    var arc=$('lbArc'); arc.setAttribute('stroke-dasharray',(C*risk/100).toFixed(1)+' '+C.toFixed(1)); arc.setAttribute('stroke',color);
    $('lbRisk').textContent=String(risk); $('lbRisk').style.color=color;
    $('lbVerdict').textContent=v.verdict||'No verdict';
    var n=v.checked||0, f=v.findings||0;
    $('lbVerdictSub').textContent=n+(n===1?' element':' elements')+' hovered or clicked · '+f+(f===1?' finding':' findings')+', '+(v.high||0)+' serious · URL models '+(v.mlRisk==null?'unavailable':v.mlRisk+'/100')+' · content '+(v.contentRisk||0)+'/100';
  }
  function resetVerdict(){ var arc=$('lbArc'); arc.setAttribute('stroke-dasharray','0 999'); $('lbRisk').textContent='—'; $('lbRisk').style.color=''; $('lbVerdict').textContent='Checking…'; $('lbVerdictSub').textContent='Risk combines the URL models, the page\'s content and what the agent found by hovering and clicking.'; }

  /* ---------- events from the agent ---------- */
  function onEvent(p){
    if(!p||typeof p!=='object'||!(p.run>=run)) return;
    if(p.run>run) run=p.run;
    switch(p.type){
      case 'start':
        steps.textContent=''; stepCount=0; currentStep=null; $('lbCount').textContent=''; clearOverlay(); resetVerdict(); clearFacts(); showTab('steps');
        frame.classList.remove('on'); empty.hidden=false; emptyText.textContent='Starting the agent\'s browser…';
        $('lbAddr').textContent=p.url||''; $('lbLock').className='lb-lock'; lastUrl=p.url||lastUrl;
        setRunning(true); status('Live'); caption.textContent='Starting the agent\'s isolated browser…';
        startAgents(p.url); break; // the eight analysis agents work on the same address, alongside the browser
      case 'browser': caption.textContent='Browser ready ('+(p.name||'browser')+'), with an empty profile.'; break;
      case 'frame':
        if(p.data){ frame.src='data:image/jpeg;base64,'+p.data; if(!frame.classList.contains('on')){ frame.classList.add('on'); empty.hidden=true; } }
        break;
      case 'page':
        if(p.url){ $('lbAddr').textContent=p.url; $('lbLock').className='lb-lock '+(p.https?'ok':'bad'); $('lbLock').title=p.https?'Encrypted (https)':'Not encrypted (http)'; }
        break;
      case 'step':
        addStep(p.action||'inspect',p.label||'',p.detail||''); caption.textContent=p.label||'';
        if(p.target&&p.target.px!=null){
          var t=p.target; t.kind=p.action;
          if(p.action==='click'){ placeCursor(t.px,t.py); ripple(t.px,t.py); placeBox(t,'click'); }
          else { placeCursor(t.px,t.py); placeBox(t,p.action); }
          placeTag(t.px,t.py,p.label||''); lastPoint=t;
        }else if(p.action==='open'||p.action==='inspect'||p.action==='model'){ box.className='lb-box'; tag.classList.remove('on'); }
        break;
      case 'finding': addFinding(p); break;
      case 'fact': addFact(p); break;
      case 'destination': if(p.url) caption.textContent='Stopped at: '+p.url; break;
      case 'verdict':
        verdict(p); var li=addStep('done',p.verdict||'Finished',p.url||''); li.classList.remove('cur'); caption.textContent=(p.verdict||'Finished')+' · '+(p.url||''); break;
      case 'error':
        var e=addStep('error','The run could not finish',p.message||''); e.classList.add('err'); e.classList.remove('cur'); caption.textContent=p.message||'The run could not finish.';
        if(!frame.classList.contains('on')){ emptyText.textContent=p.message||''; }
        $('lbVerdict').textContent='No verdict'; break;
      case 'done':
        setRunning(false); if(currentStep) currentStep.classList.remove('cur');
        status(p.stopped?'Stopped':'Finished'); tag.classList.remove('on');
        elapsed.textContent=(+p.seconds||0).toFixed(0)+' s'; break;
    }
  }
  if(window.CF&&CF.listen) CF.listen('cf-live-browse',onEvent);

  /* ---------- starting and stopping ---------- */
  var SOURCE={ 'active-tab':'Your active tab', recent:'Your most recent page', entered:'Address you entered' };
  function start(url,source,note){
    url=String(url||'').trim(); if(!url) { urlInput.focus(); return; }
    urlInput.value=url; sourceChip.textContent=note||SOURCE[source]||'';
    startBtn.disabled=true; status('Starting…');
    invoke('live_browse_start',{url:url,source:source||'entered'}).then(function(r){
      if(r&&r.run>run) run=r.run; lastUrl=(r&&r.url)||url;
    }).catch(function(e){
      startBtn.disabled=false; status('Idle'); setRunning(false);
      caption.textContent=msg(e); emptyText.textContent=msg(e); empty.hidden=frame.classList.contains('on');
    });
  }
  function stop(){ invoke('live_browse_stop').catch(function(){}); }

  // The page the user is on: the active browser tab when one is in front, otherwise the
  // page most recently opened in any browser (a fresh read of the history, if allowed).
  function currentPage(){
    return invoke('get_active_urls').then(function(r){
      var u=r&&r.data&&r.data.urls&&r.data.urls[0];
      if(u&&u.url) return {url:u.url,source:'active-tab'};
      throw new Error('no active tab');
    }).catch(function(){
      return invoke('live_browse_recent').then(function(r){
        if(r&&r.url) return {url:r.url,source:'recent',note:'Your most recent page'+(r.browser?' in '+r.browser:'')+(r.lastVisit?' · '+ago(r.lastVisit):'')};
        return null;
      });
    });
  }
  function useMine(auto){
    emptyText.textContent='Looking for the page you are on…';
    return currentPage().then(function(p){
      if(p){ start(p.url,p.source,p.note); return true; }
      if(!auto){ caption.textContent='No recent page was found in your browsers.'; }
      emptyText.textContent='No recent page found. Enter an address above and press “Watch the agent”.';
      return false;
    }).catch(function(e){
      var why=msg(e);
      emptyText.textContent=/history|permission|privacy|allow/i.test(why)
        ? 'To follow your browsing, allow reading browser history in Settings → Privacy. Or enter an address above.'
        : 'Enter an address above and press “Watch the agent”.';
      if(!auto) caption.textContent=why;
      return false;
    });
  }

  startBtn.addEventListener('click',function(){ start(urlInput.value,'entered'); });
  urlInput.addEventListener('keydown',function(e){ if(e.key==='Enter') start(urlInput.value,'entered'); });
  stopBtn.addEventListener('click',stop);
  mineBtn.addEventListener('click',function(){ useMine(false); });

  var followOn=true; try{ followOn=localStorage.getItem('cf-live-follow')!=='0'; }catch(e){}
  function setFollow(on){ followOn=on; follow.setAttribute('aria-checked',on?'true':'false'); try{ localStorage.setItem('cf-live-follow',on?'1':'0'); }catch(e){} }
  setFollow(followOn);
  follow.addEventListener('click',function(){ setFollow(!followOn); });
  follow.addEventListener('keydown',function(e){ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); setFollow(!followOn); } });
  // Follow: when the run is over and a different page is now the most recent, check it next.
  setInterval(function(){
    if(!followOn||running||startBtn.disabled||document.visibilityState!=='visible') return;
    currentPage().then(function(p){ if(p&&p.url&&p.url!==lastUrl) start(p.url,p.source,p.note); }).catch(function(){});
  },6000);

  // The browser closes when you leave this screen.
  window.addEventListener('pagehide',stop);

  // Arriving here: start on the page you are on, or on an address passed in (?url=).
  var given=''; try{ given=new URLSearchParams(location.search).get('url')||''; }catch(e){}
  if(given) start(given.slice(0,2048),'entered'); else useMine(true);
})();
