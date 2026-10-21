/* Shared live chrome. Private snapshots stay in memory; no sample data or secrets. */
(function(){
  'use strict';
  if(!document.getElementById('sidebar'))return;
  const CF=window.CF;
  const paths={server:'M3 3h18v7H3zM3 14h18v7H3zM7 6h.01M7 17h.01',signal:'M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8M12 12h.01',cpu:'M5 5h14v14H5zM9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3',clock:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',refresh:'M20 7a9 9 0 1 0 1 8M20 3v5h-5',more:'M5 12h.01M12 12h.01M19 12h.01',close:'m6 6 12 12M6 18 18 6',lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',monitor:'M3 3h18v13H3zM12 16v5M8 21h8',search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',check:'m5 12 4 4L19 6',activity:'M2 12h5l3-8 4 16 3-8h5'};
  function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.activity);svg.append(p);return svg;}
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(label,ic,fn,cls){const b=el('button','cc-button '+(cls||''));b.type='button';b.append(icon(ic),el('span','',label));b.addEventListener('click',fn);return b;}
  function link(label,href){const a=el('a','cc-button',label);a.href=href;return a;}
  const page=location.pathname.split('/').pop().replace('.html','');
  const state={snapshot:null,lastSummary:null,privacy:null,device:null,account:null,stream:{connected:false,reason:'Checking event connection'},lastEvent:null,eventCount:0,pageAt:null,records:{},pending:new Map(),operation:null,backend:'checking',ml:'checking',version:null};
  let generation=0,request=null,backoff=30000,nextRefresh=0,drawer=null,returnFocus=null;
  const original=CF.invoke;
  const actions=/^(scan_url|ml_security_chat|ml_classify_url|ml_detect_dga|ml_ioc_scan|ml_url_enrich|browser_intel_report|memory_save|memory_sync|policy_(create|update|delete|evaluate)|block_site|unblock_site|allow_site|unallow_site|protect_site|unprotect_site|device_(enroll_this|approve|revoke|rename|heartbeat|rotate_key|command_send)|finding_state|finding_exception|alert_state|incident_resolve|incident_evidence|evidence_report|privacy_set|set_hf_token)$/;
  function isAction(cmd,args){return actions.test(cmd)||(cmd==='agents_call'&&!['templates','list','get','runs','run_get','run_search','actions'].includes(args.op));}
  const safeState=new Set(['queued','leased','running','completed','partial','failed','cancelled','applied','delivered','proposed','approved','rejected','resolved','acknowledged','dismissed']);
  function body(r){return r&&r.data||r||{};}
  function describe(cmd,args,r){
    const d=body(r);let text=cmd.replace(/_/g,' ');
    if(cmd==='agents_call')text='Agent '+String(args.op||'request');
    const result=d.state||d.status||d.outcome&&d.outcome.state;
    if(safeState.has(result))text+=' · '+result;else text+=' · response received';
    const engine=CF.engineShort&&cmd==='ml_security_chat'?CF.engineShort(r):(d.engine||d.answerEngine||r&&r.engine);
    if(engine)text+=' · '+String(typeof engine==='object'?(engine.name||engine.id||'attributed agent'):engine).slice(0,90);
    const id=d.runId||d.scanId||d.incidentId||d.commandId;
    if(id)text+=' · '+String(id).slice(0,80);
    return text;
  }
  // Observe requests, never their input bodies/tokens. Page readers share this bridge.
  CF.invoke=function(cmd,args){
    args=args||{};const epoch=generation,started=Date.now(),token=Symbol(cmd),active=isAction(cmd,args);
    if(active){state.pending.set(token,{label:cmd.replace(/_/g,' '),started});render();}
    return Promise.resolve().then(()=>original(cmd,args)).then(r=>{
      if(epoch!==generation)return r;
      if(cmd==='auth_logout'){clear();return r;}
      if(cmd==='privacy_get'||cmd==='privacy_set')state.privacy=r;
      if(cmd==='device_status')state.device=r;
      if(cmd==='auth_get_user')state.account=body(r).user||r&&r.user||body(r);
      if(cmd==='stream_status')state.stream=r||{connected:false,reason:'Unavailable'};
      if(cmd!=='console_snapshot'&&!/^(auth_|get_backend_url|stream_status|privacy_|hf_token)/.test(cmd)){
        const ok=r!=null&&r.success!==false;
        const d=body(r);const record={at:started,ok,command:cmd};
        for(const key of ['total','count','riskScore','verdict','state','runId','scanId','incidentId','commandId','lastSeenAt','nextRunAt'])if(d[key]!==undefined)record[key]=d[key];
        for(const key of ['devices','agents','actions','runs','history','memories','incidents','policies','log','sessions','results','threats','alerts'])if(Array.isArray(d[key]))record[key]=d[key].length;
        if(cmd==='agents_call')record.op=args.op;
        state.records[cmd+(args.op?':'+args.op:'')]=record;
        if(ok)state.pageAt=Date.now();
      }
      if(active){nextRefresh=Date.now()+5000;state.operation={text:r&&r.success===false?cmd.replace(/_/g,' ')+' · failed':describe(cmd,args,r),failed:r&&r.success===false,at:Date.now(),duration:Date.now()-started};}
      return r;
    },err=>{if(epoch===generation&&active)state.operation={text:cmd.replace(/_/g,' ')+' · failed',failed:true,at:Date.now(),duration:Date.now()-started};throw err;})
      .finally(()=>{state.pending.delete(token);if(epoch===generation)render();});
  };
  function clear(){generation++;state.snapshot=null;state.lastSummary=null;state.system=null;state.records={};state.pending.clear();state.operation=null;state.account=null;state.device=null;state.privacy=null;state.pageAt=null;state.lastEvent=null;state.eventCount=0;state.backend='signed out';state.ml='unknown';state.stream={connected:false,reason:'Signed out'};nextRefresh=Infinity;close();render();}
  /* What a native round trip's answer means. A missing route (404) on a
     reachable server is not an outage: that server version lacks the route. */
  function serverState(summary){
    if(!summary||summary.status==null)return 'unreachable';
    if(summary.status===200&&summary.body&&summary.body.success===true)return 'connected';
    if(summary.status===404)return 'connected';
    if(summary.status===401||summary.status===403)return 'sign in again';
    if(summary.status===429)return 'busy';
    return 'error '+summary.status;
  }
  function engineState(ml){
    if(!ml||ml.status==null)return 'unreachable';
    const report=ml.body&&ml.body.success===true&&ml.body.data;
    if(ml.status===200&&report&&report.available===true)return 'reported';
    if(ml.status===401||ml.status===403)return 'sign in again';
    if(ml.status===404)return 'not offered by this server';
    return 'unavailable';
  }
  function engineReason(ml){const m=ml&&ml.body&&ml.body.message;return typeof m==='string'?m.slice(0,200):'';}
  async function refresh(force){
    if(request)return request;
    const epoch=generation;
    request=(async()=>{
      try{
        // { authenticated, user }: the object itself is always truthy.
        const signed=await original('auth_is_authenticated');if(!signed||signed.authenticated!==true){clear();return;}
        const results=await Promise.allSettled([original('console_snapshot',{refresh:!!force}),CF.invoke('privacy_get'),CF.invoke('device_status'),CF.invoke('auth_get_user'),CF.invoke('stream_status')]);
        if(epoch!==generation)return;
        const r=results[0];
        if(r.status==='fulfilled'&&r.value&&r.value.summary){
          state.snapshot=r.value;state.version=r.value.version||null;
          state.backend=serverState(r.value.summary);
          state.summaryMissing=!!(r.value.summary&&r.value.summary.status===404);
          if(r.value.summary&&r.value.summary.status===200&&state.backend==='connected')state.lastSummary=r.value.summary;
          state.ml=engineState(r.value.ml);state.mlReason=engineReason(r.value.ml);
          backoff=state.backend==='connected'?30000:Math.min(backoff*2,120000);
        }else{
          // The native snapshot refused (signed out in flight, or no answer at all).
          const reason=r.status==='rejected'?String(r.reason||''):'';
          if(/sign in|session changed/i.test(reason)){clear();return;}
          state.backend='unreachable';state.ml='unreachable';backoff=Math.min(backoff*2,120000);
        }
      }catch(_){if(epoch===generation){state.backend='unreachable';state.ml='unreachable';backoff=Math.min(backoff*2,120000);}}
      finally{nextRefresh=Date.now()+backoff;request=null;render();}
    })();render();return request;
  }
  function capabilities(){const r=state.snapshot&&state.snapshot.ml;return state.ml==='reported'&&r&&r.body&&r.body.data||null;}
  function age(at){if(!at)return 'not received';const seconds=Math.max(0,Math.floor((Date.now()-new Date(at).getTime())/1000));return Number.isFinite(seconds)?(seconds<60?seconds+'s':Math.floor(seconds/60)+'m')+' ago':'unknown';}
  function sourceTime(source){const s=state.snapshot&&state.snapshot[source];return s&&s.fetchedAt;}
  function fresh(source){const at=sourceTime(source);return at&&Date.now()-at<(source==='ml'?90000:60000);}
  function set(id,text,status){const n=document.getElementById(id);if(!n)return;const span=n.querySelector('span')||n;if(span.textContent!==text){span.textContent=text;n.classList.remove('cc-changed');void n.offsetWidth;n.classList.add('cc-changed');}if(status)n.dataset.state=status;}
  function render(){
    const report=capabilities(),entries=report&&report.capabilities;
    const ready=entries?entries.filter(c=>c.readiness==='ready').length:null;
    set('ccBackend','Server: '+(state.backend==='connected'&&!fresh('summary')?'stale':state.backend),state.backend==='connected'&&fresh('summary')?'ok':'warn');
    set('ccEvents','Events: '+(state.stream.connected?'connected':(/did not accept the session/.test(state.stream.reason||'')?'sign in again':'offline')),state.stream.connected?'ok':'warn');
    const ev=document.getElementById('ccEvents');if(ev)ev.title=state.stream.connected?'Live events connected':'Live events: '+(state.stream.reason||'not connected');
    const be=document.getElementById('ccBackend');if(be)be.title=state.summaryMissing?'The server answers, but this server version has no console summary yet (deploy the latest server).':'Server: '+state.backend;
    const mlNode=document.getElementById('ccMl');if(mlNode)mlNode.title=state.mlReason||('Analysis Agents: '+state.ml);
    set('ccMl','Agents: '+(entries?(fresh('ml')?ready+'/'+entries.length+' ready':'stale'):state.ml),entries&&fresh('ml')&&ready===entries.length?'ok':'warn');
    set('ccUpdated','Data: '+age(state.pageAt));
    const active=[...state.pending.values()];
    const op=active.length?active[0].label+' · waiting '+Math.floor((Date.now()-active[0].started)/1000)+'s'+(active.length>1?' +'+(active.length-1):''):state.operation?state.operation.text:'No operation in progress';
    set('ccOperation',op,state.operation&&state.operation.failed?'error':'neutral');
    const opNode=document.getElementById('ccOperation');if(opNode){opNode.classList.toggle('cc-running',!!active.length);opNode.title=op;}
    set('ccVersion',state.version?'v'+state.version:'Version unavailable');
    set('ccScope',state.account&&state.account.name?String(state.account.name).slice(0,35):'Account & device');
    set('ccServices',state.backend==='connected'&&fresh('summary')&&state.ml==='reported'?'Services':'Check services',state.backend==='connected'&&state.ml==='reported'?'ok':'warn');
    const metrics=document.getElementById('ccPageMetrics');if(metrics){
      metrics.replaceChildren();
      const keys=['devices','agents','scheduled'].includes(page)?['onlineDevices','activeAgents','pendingApprovals']:['threat-overview','alerts-evidence','investigations','incident-timeline'].includes(page)?['openFindings','urgentFindings','pendingApprovals']:[];
      const names={onlineDevices:'Devices online',activeAgents:'Active agents',pendingApprovals:'Pending approvals',openFindings:'Open findings',urgentFindings:'Critical / high'};
      const summary=state.lastSummary;const data=summary&&summary.body&&summary.body.data;const stale=state.backend!=='connected'||!fresh('summary');
      for(const key of keys){const m=data&&data.metrics&&data.metrics[key];const chip=el('span','cc-metric',names[key]+': '+(m&&m.state==='ready'?m.value+(stale?' (stale)':''):'—'));chip.title=(m?m.scope:'Server')+' · '+(!stale?'current snapshot':'stale/unavailable')+' · '+age(m&&m.observedAt);metrics.append(chip);}
      if(!keys.length){const records=Object.values(state.records).filter(r=>r.ok);const record=records.find(r=>({memory:'memory_list','web-history':'get_browser_history','browser-intelligence':'browser_intel','security-functions':'policy_list','threat-globe':'otx_fetch','reports':'evidence_report',analyzer:'scan_url','ai-assistance':'ml_security_chat','model-inference':'ml_status','agent-core':'agent_status','signal-pipeline':'agent_status'}[page])===r.command);
        if(record){const n=['history','memories','sessions','policies','results'].find(k=>record[k]!==undefined);metrics.append(el('span','cc-metric',n?record[n]+' '+n+' loaded':'Data received · '+age(record.at)));}
        if(['analyzer','ai-assistance','model-inference','reports'].includes(page))metrics.append(el('span','cc-metric',entries?'Agents ready: '+ready+'/'+entries.length:'Agents readiness unavailable'));
      }
    }
    // Detail rows refresh only when opened or explicitly requested, preserving keyboard/scroll position.
    if(drawer&&document.activeElement===document.getElementById('ccDetails'))renderDetails();
  }
  function detail(label,value){const row=el('div','cc-detail');row.append(el('dt','',label),el('dd','',value==null?'Unknown':String(value)));return row;}
  function renderDetails(){const box=document.getElementById('ccDetailsBody');if(!box)return;box.replaceChildren();
    const summary=state.snapshot&&state.snapshot.summary,ml=state.snapshot&&state.snapshot.ml,report=capabilities();
    box.append(detail('Scope',state.account&&state.account.name||'Signed-in account; local data stays on this installation'),detail('This installation',state.device&&state.device.state||'Unknown'),detail('Server',state.backend+' · last response '+age(sourceTime('summary'))),detail('Server response duration',summary&&summary.durationMs!=null?summary.durationMs+' ms (native round trip)':'Not measured'),detail('Event stream',(state.stream.connected?'Connected':'Disconnected')+' · '+(state.stream.reason||'')+' · last event '+age(state.lastEvent)),detail('Events observed',state.eventCount+' in this page session'),detail('Agents report',state.ml+' · '+age(sourceTime('ml'))),detail('Agents response duration',ml&&ml.durationMs!=null?ml.durationMs+' ms (server round trip, not inference latency)':'Not measured'));
    if(report){for(const c of report.capabilities||[])box.append(detail(c.id,c.kind+' · '+c.readiness+(c.model?' · '+c.model:'')+(c.reason?' · '+c.reason:'')+(c.answersWithoutModel?' · fallback: '+c.answersWithoutModel:'')));
      if(report.operational){for(const [k,v] of Object.entries(report.operational))box.append(detail('Space '+k,v));}
      box.append(detail('Training',report.training&&report.training.note||'No training metadata'));
    }
    for(const f of state.privacy&&state.privacy.features||[])box.append(detail(f.label||f.id,f.enabled?'Enabled':'Disabled'));
    for(const r of Object.values(state.records).slice(-8))box.append(detail(r.command+(r.op?' / '+r.op:''),(r.ok?'Response received':'Unavailable')+' · '+age(r.at)+(r.runId?' · run '+r.runId:'')+(r.scanId?' · scan '+r.scanId:'')));
    if(state.system)box.append(detail('Local CPU / memory',state.system.cpu+'% / '+state.system.memory+'% · sampled '+age(state.system.at)));
    for(const n of document.querySelectorAll('.cc-legacy span'))if(n.textContent)box.append(detail('Page status',n.textContent));
    if(state.operation)box.append(detail('Last operation',state.operation.text+' · '+state.operation.duration+' ms round trip'));
  }
  function close(){if(drawer){drawer.remove();drawer=null;if(returnFocus&&document.contains(returnFocus))returnFocus.focus();}}
  function open(){if(drawer)return;returnFocus=document.activeElement;drawer=el('dialog','cc-dialog');drawer.id='ccDetails';drawer.setAttribute('aria-labelledby','ccDetailsTitle');const head=el('div','cc-dialog-head');head.append(el('h2','', 'Connection & activity'));head.firstChild.id='ccDetailsTitle';head.append(button('Close','close',close));const box=el('dl','cc-details');box.id='ccDetailsBody';const foot=el('div','cc-dialog-actions');foot.append(button('Refresh status','refresh',async()=>{await refresh(true);renderDetails();}),button('Privacy','lock',()=>{close();window.openCfSettings('privacy');}),link('Model capabilities','model-inference.html'),button('Copy diagnostic summary','download',async()=>{
      // Deliberately excludes accounts, URLs, record identifiers, tokens and raw errors.
      const safe={version:state.version,backend:state.backend,events:state.stream.connected,ml:state.ml,page,checkedAt:new Date().toISOString()};
      try{await navigator.clipboard.writeText(JSON.stringify(safe,null,2));CF.toast('Diagnostic summary copied','ok');}catch(_){CF.toast('Clipboard unavailable','warn');}
    }));drawer.append(head,box,foot);document.body.append(drawer);drawer.addEventListener('cancel',e=>{e.preventDefault();close();});drawer.addEventListener('click',e=>{if(e.target===drawer)close();});drawer.showModal();renderDetails();head.querySelector('button').focus();}
  function mountFooter(options){const host=document.getElementById('statusbar');if(!host)return;host.replaceChildren();host.className='statusbar cc-footer';
    for(const [id,label,ic] of [['ccBackend','Server: checking','server'],['ccEvents','Events: checking','signal'],['ccMl','Agents: checking','cpu'],['ccUpdated','Data: not received','clock'],['ccOperation','No operation in progress','activity']]){const b=button(label,ic,open);b.id=id;host.append(b);}
    const more=button('Details','more',open);more.id='ccDetailsButton';host.append(more);const version=el('span','cc-version','Version unavailable');version.id='ccVersion';host.append(version);
    // Existing page-specific live writers keep their IDs in an accessible detail region.
    const legacy=el('div','cc-legacy');legacy.hidden=true;for(const item of options&&options.items||[])if(item.id){const n=el('span','');n.id=item.id;legacy.append(n);}host.append(legacy);
  }
  const refreshers={devices:'refresh',agents:'refresh',scheduled:'load','alerts-evidence':'loadRealAlerts',investigations:'loadInvestigations','incident-timeline':'loadIncidentGroups','web-history':'load','model-inference':'refreshStatus','threat-overview':'refreshCoverage',reports:'reportsKpis','signal-pipeline':'tele'};
  const filters={devices:'.dv-row:not(.dv-head)',agents:'.ag-item',memory:'.mrow','alerts-evidence':'.al',investigations:'#cases .cs', 'threat-globe':'.atk','web-history':'.hrow'};
  function mount(){
    const top=document.getElementById('topbar');if(!top)return;
    top.querySelectorAll('.tb-status,.pill-threats').forEach(n=>n.remove());
    const scope=button('Account & device','monitor',open,'cc-scope');scope.id='ccScope';scope.title='Account and this installation; page controls define filtering';top.querySelector('.brand').after(scope);
    const services=button('Services','server',open,'cc-services');services.id='ccServices';top.append(services);
    const head=document.querySelector('.main-head');if(!head)return;
    const tools=el('div','cc-page-tools');tools.setAttribute('aria-label','Page data controls');const metrics=el('div','cc-page-metrics');metrics.id='ccPageMetrics';tools.append(metrics);
    if(filters[page]){const label=el('label','cc-filter');label.append(icon('search'));const input=el('input');input.type='search';input.placeholder='Filter loaded rows';input.setAttribute('aria-label','Filter loaded rows on this page');const count=el('span','cc-filter-count');
      let scheduled=false;const apply=()=>{scheduled=false;let shown=0,total=0;document.querySelectorAll(filters[page]).forEach(row=>{const match=row.textContent.toLowerCase().includes(input.value.toLowerCase());row.classList.toggle('cc-filtered',!match);total++;if(match)shown++;});const text=input.value?shown+'/'+total+' loaded':'';if(count.textContent!==text)count.textContent=text;};
      input.addEventListener('input',apply);label.append(input,count);tools.append(label);new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(apply);}}).observe(document.querySelector('main'),{childList:true,subtree:true});
    }
    const actions=el('div','cc-page-actions');
    const oldRefresh=[...head.querySelectorAll('button')].find(b=>b.textContent.trim()==='Refresh');
    if(oldRefresh)oldRefresh.remove();
    const refreshButton=button(['analyzer','ai-assistance'].includes(page)?'Refresh status':'Refresh data','refresh',async()=>{refreshButton.disabled=true;refreshButton.classList.add('cc-running');try{await refresh(true);const fn=window[refreshers[page]];if(typeof fn==='function')await fn();else if(page==='security-functions')document.getElementById('sfRefresh').click();else if(oldRefresh)oldRefresh.click();else {const pending=[];window.dispatchEvent(new CustomEvent('cf:refresh-page',{detail:{waitUntil:p=>pending.push(p)}}));await Promise.all(pending);}}finally{refreshButton.disabled=false;refreshButton.classList.remove('cc-running');}});
    actions.append(refreshButton);
    const menu=el('details','cc-more');const trigger=el('summary','cc-button');trigger.append(icon('more'),el('span','','More'));const menuBody=el('div','cc-menu');menuBody.append(button('Connection & activity','server',()=>{menu.open=false;open();}),button('Privacy controls','lock',()=>{menu.open=false;window.openCfSettings('privacy');}),link('Devices & coverage','devices.html'),link('Approvals & runs','agents.html'),link('Model capabilities','model-inference.html'));menu.append(trigger,menuBody);actions.append(menu);tools.append(actions);
    const tabs=document.getElementById('cfWorkspaceTabs');(tabs||head).after(tools);
    head.querySelectorAll('.live-ind').forEach(n=>{n.classList.add('cc-page-state');});
    // Replace decorative refresh spinners and duplicated static header status.
    top.querySelectorAll('button').forEach(b=>{if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',b.title||b.textContent.trim());});
    refresh(false);render();
  }
  window.addEventListener('cf:stream-status',e=>{const reconnect=!state.stream.connected&&e.detail.connected;state.stream=e.detail;if(!e.detail.connected&&/signed out/i.test(e.detail.reason||'')){clear();return;}render();if(reconnect)refresh(true);});
  const seen=new Set();window.addEventListener('cf:event',e=>{const d=e.detail||{},key=d.id||JSON.stringify([d.type,d.ts,d.data&&d.data.id]);if(seen.has(key))return;seen.add(key);if(seen.size>300)seen.delete(seen.values().next().value);state.lastEvent=Date.now();state.eventCount++;nextRefresh=Math.min(nextRefresh,Date.now()+5000);render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()>=nextRefresh)refresh(false);});
  setInterval(()=>{if(!document.hidden){if(Date.now()>=nextRefresh)refresh(false);render();}},5000);
  CF.listen('cf-telemetry',p=>{const sys=p&&p.sys&&p.sys.data;if(sys&&Number.isFinite(sys.cpu)&&Number.isFinite(sys.memory))state.system={cpu:sys.cpu,memory:sys.memory,at:Date.now()};});
  window.CFConsole={state,refresh,open,clear,icon,mountFooter,capabilities};
  document.addEventListener('DOMContentLoaded',mount);
})();
