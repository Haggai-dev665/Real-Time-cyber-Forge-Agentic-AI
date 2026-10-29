/* Browser smoke/regression checks against local HTML and mocked native commands.
 * No backend, account, browser history or model service is contacted.
 * Requires Chrome or Edge installed locally; no automation package required.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../ui');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function nativeFixture() {
  window.__calls = [];
  window.__fixtureIncidents = [];
  window.__fail = false;
  window.__localFixture = false;
  window.__fixtureEvents = [{id:'retained-scan',type:'scan:update',source:'desktop',ts:Date.now()-5000,data:{url:'https://earlier.example.invalid/',verdict:'benign',source:'local-ml'}}];
  const nativeListeners = new Map();
  window.__emitNative = (name,payload) => {
    if(name==='cf-stream'&&!window.__fixtureEvents.some(e=>e.id===payload.id))window.__fixtureEvents.push(payload);
    (nativeListeners.get(name)||[]).forEach(fn=>fn({payload}));
  };
  const invoke = async (cmd, args = {}) => {
    window.__calls.push({ cmd, args });
    if (window.__fail && !['auth_is_authenticated', 'auth_get_user', 'privacy_get'].includes(cmd)) throw new Error('Fixture: unavailable');
    if (cmd === 'auth_is_authenticated') return true;
    if (cmd === 'auth_get_user') return { user: { id: 'fixture', name: 'Fixture account', email: 'fixture@example.invalid' } };
    if (cmd === 'get_backend_url') return 'http://127.0.0.1:1';
    if(cmd==='console_snapshot')return {version:'1.0.0-fixture',summary:{status:200,durationMs:12,fetchedAt:Date.now(),body:{success:true,data:{metrics:Object.fromEntries(['devices','onlineDevices','activeAgents','pendingApprovals','activeRuns','openFindings','urgentFindings'].map(k=>[k,{value:0,state:'ready',exact:true,scope:'fixture',observedAt:new Date().toISOString()}]))}}},ml:{status:200,durationMs:18,fetchedAt:Date.now(),body:{success:true,data:{available:true,capabilities:[{id:'detector-fixture',kind:'trained_model',readiness:'not_loaded',reason:'Fixture model is not loaded',limits:{}}]}}}};
    if(cmd==='stream_status')return {connected:false,reason:'Fixture stream disconnected'};
    if(cmd==='stream_history')return {events:window.__fixtureEvents,limit:500,retentionMs:3600000};
    if(cmd==='local_model_status'||cmd==='prepare_local_models')return {success:true,ready:true,state:'ready',source:'bundled-verified',modelCount:4,totalBytes:2824495,downloadedBytes:0,scope:'URL features only; fixture runtime'};

    if (cmd === 'privacy_get') return { decided: true, features: ['history_access', 'active_tab', 'cloud_scanning', 'llm_processing', 'sync'].map(id => ({ id, label: id, enabled: false })) };
    if (cmd === 'agent_status') return { success: true, data: { backendOk: false, mlOk: false, agentRunning: false } };
    if (cmd === 'get_threats') return { success: true, data: { threats: [], total: 0, critical: 0, high: 0, medium: 0, low: 0 } };
    if (cmd === 'agent_alerts') return { success: true, data: { alerts: [] } };
    if (cmd === 'agents_call') return { agents: [], actions: [], templates: [], runs: [] };
    if (cmd === 'devices_list') return { devices: [] };
    if (cmd === 'device_status') return { state: 'not_enrolled', secureStorage: 'unavailable' };
    if (cmd === 'incidents_list') return { incidents: window.__fixtureIncidents };
    if (cmd === 'get_browser_history' || cmd === 'get_collected_history') return { success: true, data: { history: [] } };
    if (cmd === 'browser_intel') return { success: true, data: { sessions: [], domains: [] } };
    if (cmd === 'memory_list') return { success: true, data: { memories: [], total: 0 } };
    if (cmd === 'memory_search') return { success: true, data: { results: [] } };
    if (cmd === 'memory_sync') return { success: false, message: 'Sync disabled in fixture' };
    if (cmd === 'memory_save') return { success: true };
    if (cmd === 'ml_status') return { health: { status: 'degraded' }, capabilities: { success: true, data: { available: true, serviceVersion: 'fixture', source: 'fixture', capabilities: [{ id: 'detector-fixture', kind: 'trained_model', readiness: 'not_loaded', reason: 'Fixture model is not loaded', limits: {} }] } } };
    if (cmd === 'scan_url') return window.__localFixture?{success:true,data:{verdict:'benign',riskScore:12,source:'local-ml',localInferenceMs:0.8,summary:'Fixture: URL features only; page not observed',predictions:[{model:'phishing_detection',threat_score:0.12}],coverage:{localModels:true,backendModels:false,page:'not observed'}}}:{ success: true, data: { verdict: 'unknown', riskScore: 0, coverage: { page: 'not observed' } } };
    if (cmd === 'ml_url_enrich') throw new Error('Fixture: enrichment unavailable');
    if (cmd === 'ml_ioc_scan') return { success: true, data: { parsed: true } };
    if (cmd === 'otx_fetch') return { success: true, results: [{ id: 'pulse-fixture', name: 'Public fixture pulse', tags: [], indicators: [], targeted_countries: [], attack_ids: [], malware_families: [] }] };
    if (cmd === 'evidence_report') return {
      snapshotHash: 'fixture-sha', signature: { keyId: 'fixture-key' },
      report: { summary: ['Evidence fixture'], window: { fromLocal: 'start', toLocal: 'end', tz: 'UTC' }, findings: [], incidents: [], evidence: [],
        limits: { deletedEvidence: [], scansWithoutVerdict: [], providerFailures: [], devicesNotFullyCovered: [] }, dataSources: { backend: 'fixture' }, modelVersions: { findings: [], agentEngines: [] } }
    };
    return { success: true, data: {}, policies: [], log: [], count: 0 };
  };
  window.__TAURI__ = { core: { invoke }, event: { listen: async (name,fn) => {if(!nativeListeners.has(name))nativeListeners.set(name,[]);nativeListeners.get(name).push(fn);return ()=>nativeListeners.set(name,nativeListeners.get(name).filter(f=>f!==fn));} } };
  window.fetch = async () => { throw new Error('Network disabled in fixture'); };
  window.EventSource = class { addEventListener() {} close() {} };
  window.WebSocket = class { addEventListener() {} close() {} };
}

(async () => {
  const executable = process.env.CYBERFORGE_TEST_BROWSER || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ].find(file => fs.existsSync(file));
  assert(executable, 'Set CYBERFORGE_TEST_BROWSER to a local Chromium executable');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-nav-check-'));
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = spawn(executable, [...(process.env.CYBERFORGE_TEST_NO_SANDBOX==='1'?['--no-sandbox']:[]),'--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Browser startup timed out')), 30000);
      browser.on('error', reject);
      browser.stderr.on('data', data => { const match = String(data).match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
    console.log('Browser started');
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let next = 0;
    const pending = new Map(), errors = [];
    socket.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++next; const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timed out: '+method));},20000);pending.set(id, { resolve:r=>{clearTimeout(timer);resolve(r);}, reject:e=>{clearTimeout(timer);reject(e);} }); socket.send(JSON.stringify({ id, method, params, sessionId })); });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await call('Runtime.enable'); await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await call('Page.addScriptToEvaluateOnNewDocument', { source: '(' + nativeFixture.toString() + ')();' });
    const navigate = async file => {
      console.log('CHECK',file);
      errors.length = 0;
      await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/pages/${file}.html` });
      for (let i = 0; i < 100; i++) { await pause(100); if (await evaluate("document.readyState==='complete' && !!document.getElementById('cfNavToggle')")) break; }
      await pause(250);
      assert.deepEqual(errors, [], file + ': runtime exceptions');
    };
    if(process.env.CYBERFORGE_TEST_EVENTS_ONLY==='1'){
      await navigate('signal-pipeline');await pause(300);
      assert.match(await evaluate("document.getElementById('evstream').textContent"),/earlier\.example\.invalid/,'Opening the page restores earlier native scans');
      assert.equal(await evaluate("document.getElementById('n-analyze').textContent"),'1');
      await evaluate("__emitNative('cf-stream',__fixtureEvents[0])");
      assert.equal(await evaluate("document.getElementById('n-analyze').textContent"),'1','History/live race is deduplicated');
      await evaluate("document.getElementById('pauseBtn').click();__emitNative('cf-stream',{id:'paused-scan',type:'scan:update',ts:Date.now(),source:'desktop',data:{url:'https://paused.example.invalid/',verdict:'suspicious'}})");
      assert.doesNotMatch(await evaluate("document.getElementById('evstream').textContent"),/paused\.example/);
      await evaluate("document.getElementById('pauseBtn').click()");
      assert.match(await evaluate("document.getElementById('evstream').textContent"),/paused\.example/,'Resume renders the backlog');
      await evaluate("__emitNative('cf-stream',{id:'runtime-model',type:'model:status',ts:Date.now(),source:'desktop',data:{status:'ready',message:'<img src=x onerror=alert(1)>'}})");
      assert.equal(await evaluate("document.querySelectorAll('#evstream img').length"),0,'Native payload text stays inert');
      assert.equal(await evaluate("document.getElementById('n-ingest').textContent"),'1','Model lifecycle activity is visible');
      await evaluate("document.getElementById('eventFilter').value='paused';document.getElementById('eventFilter').dispatchEvent(new Event('input'))");
      assert.equal(await evaluate("document.querySelectorAll('#evstream .evr').length"),1);
      await evaluate("document.getElementById('eventFilter').value='';document.getElementById('reloadEvents').click()");await pause(100);
      assert.equal(await evaluate("document.getElementById('n-analyze').textContent"),'2');
      for(const [width,height] of [[1440,900],[1024,768],[640,720]]){
        await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(100);
        assert.equal(await evaluate("document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+2"),false,'Event page has no horizontal overflow at '+width);
      }
      await navigate('analyzer');await evaluate('__localFixture=true;analyzeUrl("https://example.invalid/","example.invalid")');
      assert.equal(await evaluate("__calls.filter(c=>c.cmd==='ml_url_enrich').length"),0,'Quick scan must not wait for cloud enrichment');
      assert.equal(await evaluate("__calls.filter(c=>c.cmd==='resolve_ip').length"),0,'Quick scan must not wait for DNS');
      assert.match(await evaluate("document.getElementById('resBody').textContent"),/local-ml/);
      assert.match(await evaluate("document.getElementById('resBody').textContent"),/Run cloud deep scan/);
      await evaluate("document.querySelector('#resBody button').click()");await pause(100);
      assert.equal(await evaluate("__calls.filter(c=>c.cmd==='ml_url_enrich').length"),1,'Cloud enrichment is an explicit action');
      assert.equal(await evaluate("__calls.filter(c=>c.cmd==='scan_url'&&c.args.deep===true).length"),1,'Deep scan explicitly requests the page/orchestrator path');
      await navigate('model-inference');await pause(100);
      assert.match(await evaluate("document.getElementById('localModelState').textContent"),/4 native detectors/);
      assert.deepEqual(errors,[]);console.log('PASS native event restoration, deduplication, pause/backlog, safe payloads, filtering, responsive layout, quick local scan and explicit cloud enrichment');
      await send('Browser.close');return;
    }
    if (process.env.CYBERFORGE_TEST_ASSISTANT_ONLY === '1') {
      await navigate('ai-assistance');
      const state = await evaluate(`(()=>{
        const body={model_generated:false,engine:{id:'ml-service-reference',kind:'fixed-text',label:'Reviewed security reference'},references:[{title:'OWASP CSRF prevention',url:'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html'}]};
        newChat();pushMsg('ai','Reviewed reference answer',body);renderMessages();
        const bubble=document.getElementById('chat').querySelector('.bubble');
        return {short:CF.engineShort(body),note:bubble.textContent,links:[...bubble.querySelectorAll('a')].map(a=>({href:a.href,rel:a.rel})),stored:loadChats()[0].messages[0].references.length,overflow:document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+2};
      })()`);
      assert.equal(state.short, 'reviewed reference');
      assert.match(state.note, /Reviewed security reference/);
      assert.match(state.note, /OWASP CSRF prevention/);
      assert.equal(state.links.length, 1);
      assert.equal(state.stored, 1);
      assert.match(state.links[0].rel, /noopener/);
      assert.equal(state.overflow, false);
      assert.deepEqual(errors, []);
      console.log('PASS assistant reference rendering, source labels, links and layout');
      await send('Browser.close');
      return;
    }
    const files = ['threat-overview','devices','agents','scheduled','ai-assistance','memory','analyzer','sandbox','alerts-evidence','investigations','incident-timeline','security-functions','reports','browser-intelligence','web-history','threat-globe','agent-core','signal-pipeline','model-inference'];
    for (const file of (process.env.CYBERFORGE_TEST_PAGES?process.env.CYBERFORGE_TEST_PAGES.split(','):files)) {
      await navigate(file);
      const result = await evaluate(`({links:[...document.querySelectorAll('#cfNavLinks a')].map(a=>({href:a.getAttribute('href'),name:a.getAttribute('aria-label')})),active:document.querySelectorAll('#cfNavLinks [aria-current="page"]').length,settings:!!document.getElementById('cfNavSettings'),overflow:document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+2})`);
      assert.equal(result.links.length, 10, file + ': ten destinations'); assert(result.links.every(a => a.name && fs.existsSync(path.join(root, 'pages', a.href))));
      assert(result.settings); assert(result.active === 1 || ['agent-core','signal-pipeline','model-inference'].includes(file));
      assert.equal(result.overflow, false, file + ': main content horizontal overflow');
      if(process.env.CYBERFORGE_TEST_RESPONSIVE==='1'){
        if(process.env.CYBERFORGE_TEST_SCREENSHOTS)fs.mkdirSync(process.env.CYBERFORGE_TEST_SCREENSHOTS,{recursive:true});
        for(const [width,height,dpr] of [[1920,1080,1],[1366,768,1],[1024,768,1],[640,720,1],[900,650,2]]){
          await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});await pause(100);
          for(const collapsed of [false,true]){
            await evaluate(`if(document.getElementById('sidebar').classList.contains('collapsed')!==${collapsed})document.getElementById('cfNavToggle').click()`);
            const layout=await evaluate(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};return {win:rect('#win'),header:rect('#topbar'),footer:rect('#statusbar'),main:rect('main'),overflow:document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+2,headerOverflow:document.getElementById('topbar').scrollWidth>document.getElementById('topbar').clientWidth+2,scale:getComputedStyle(document.getElementById('win')).transform}})()`);
            const label=file+' '+width+'x'+height+' dpr'+dpr+' '+(collapsed?'rail':'expanded');
            assert.equal(layout.scale,'none',label+': text must not be scaled down');
            assert(Math.abs(layout.win.x)<2&&Math.abs(layout.win.y)<2&&Math.abs(layout.win.right-width)<2&&Math.abs(layout.win.bottom-height)<2,label+': window fills viewport');
            assert(Math.abs(layout.header.y-1)<2&&Math.abs(layout.footer.bottom-height)<2,label+': header/footer anchored');
            assert(layout.main.y>=layout.header.bottom-1&&layout.main.bottom<=layout.footer.y+1,label+': content stays between chrome');
            assert(!layout.overflow,label+': content overflow');assert(!layout.headerOverflow,label+': header overflow');
          }
          if(process.env.CYBERFORGE_TEST_SCREENSHOTS){const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.CYBERFORGE_TEST_SCREENSHOTS,file+'-'+width+'.png'),Buffer.from(shot.data,'base64'));}
        }
        await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
      }
      if(process.env.CYBERFORGE_TEST_SCREENSHOTS){fs.mkdirSync(process.env.CYBERFORGE_TEST_SCREENSHOTS,{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.CYBERFORGE_TEST_SCREENSHOTS,file+'.png'),Buffer.from(shot.data,'base64'));}
      console.log('PASS page', file);
    }
    await navigate('analyzer');
    await evaluate('CFConsole.refresh(true)');
    assert.match(await evaluate("document.getElementById('ccBackend').textContent"),/connected/);
    assert.match(await evaluate("document.getElementById('ccMl').textContent"),/0\/1 ready/,'Healthy backend must not imply ready model');
    await evaluate("document.getElementById('ccDetailsButton').focus();document.getElementById('ccDetailsButton').click()");
    assert.equal(await evaluate("document.getElementById('ccDetails').open"),true);
    assert.match(await evaluate("document.getElementById('ccDetailsBody').textContent"),/not_loaded/);
    await evaluate("document.getElementById('ccDetails').dispatchEvent(new Event('cancel',{cancelable:true}))");
    assert.equal(await evaluate('document.activeElement.id'),'ccDetailsButton');
    await evaluate("window.dispatchEvent(new CustomEvent('cf:event',{detail:{id:'duplicate-fixture',type:'console:changed'}}));window.dispatchEvent(new CustomEvent('cf:event',{detail:{id:'duplicate-fixture',type:'console:changed'}}))");
    assert.equal(await evaluate('CFConsole.state.eventCount'),1,'Replays must not double count');
    await evaluate('__fail=true;CFConsole.refresh(true)');
    assert.match(await evaluate("document.getElementById('ccBackend').textContent"),/unavailable/);
    assert.match(await evaluate("document.getElementById('ccMl').textContent"),/unavailable/);
    await evaluate('__fail=false;CFConsole.refresh(true)');
    assert.equal(await evaluate("__calls.filter(c=>c.cmd==='get_collected_history').length"), 0, 'Analyze must not start a history queue');
    await evaluate("document.getElementById('anInput').value='example.com';analyze()");
    assert.match(await evaluate("document.getElementById('resBody').textContent"), /NOT VERIFIED/);
    await evaluate("document.getElementById('anInput').value='44d88612fea8a8f36de82e1278abb02f';analyze()");
    assert.match(await evaluate("document.getElementById('resBody').textContent"), /NOT VERIFIED/);
    assert.equal(await evaluate("__calls.filter(c=>c.cmd==='scan_url'&&c.args.url.includes('44d886')).length"), 0);
    await evaluate("document.getElementById('cfNavToggle').click()");
    const collapsed = await evaluate("document.getElementById('sidebar').classList.contains('collapsed')");
    await navigate('agents'); assert.equal(await evaluate("document.getElementById('sidebar').classList.contains('collapsed')"), collapsed);
    await evaluate("document.getElementById('cfNavSettings').click()"); assert.equal(await evaluate("document.getElementById('cfSetModal').getAttribute('role')"), 'dialog');
    await evaluate("document.querySelector('[data-sec=diagnostics]').click();document.getElementById('cfOpenRuntime').click()");
    assert.equal(await evaluate("document.querySelector('.cf-agent-frame').classList.contains('cf-hidden')"), false, 'Diagnostics opens runtime monitor');
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
    assert.equal(await evaluate("document.querySelector('.cf-agent-frame').classList.contains('cf-hidden')"), true);
    await evaluate("document.querySelector('.agent-fab,.cf-fab').click()");
    for(let i=0;i<100;i++){await pause(100);if(await evaluate("location.pathname.endsWith('/ai-assistance.html')&&document.readyState==='complete'&&document.querySelector('[aria-label=\"Open AI Assistant\"]')!==null"))break;}
    assert.equal(await evaluate("location.pathname.endsWith('/ai-assistance.html')"), true, 'Floating shortcut opens the main Assistant');
    await evaluate("document.querySelector('.agent-fab,.cf-fab').click()");
    assert.equal(await evaluate("document.activeElement.id"), 'msgInput');
    await navigate('reports');
    await evaluate("CF.findingsReport=async()=>({ok:true,data:{histWin:[],scans:[],risks:[],actions:[]},sections:[{type:'md',h:'Fixture AI',body:'First report'}],risk:'low'});buildAiReport(RANGES[0])");
    await evaluate('buildEvidenceReport(RANGES[1])');
    await evaluate("document.querySelectorAll('.ritem')[1].click()");
    assert.match(await evaluate("document.getElementById('docBody').textContent"), /First report/);
    await evaluate("document.querySelectorAll('.ritem')[0].click()");
    assert.match(await evaluate("document.querySelector('.dmeta').textContent"), /Evidence report/);
    assert.equal(await evaluate('currentReport.evidence.snapshotHash'), 'fixture-sha');
    await evaluate('__fail=true;reportsKpis()');
    assert.equal(await evaluate("document.querySelectorAll('.kpi .kv')[2].textContent"), '\u2014', 'Unavailable reports data is unknown');
    await navigate('incident-timeline');
    await evaluate("__fixtureIncidents=[{incidentId:'inc_fixture',host:'example.invalid',state:'open',findings:[],openFindings:0,occurrences:1,severity:'high',lastSeenAt:'2026-10-17T00:00:00Z',timeline:[{at:'2026-10-17T00:00:00Z',event:'Fixture event',threatId:'threat_fixture'}],evidence:[],firstSeenAt:'2026-10-17T00:00:00Z'}];loadIncidentGroups()");
    await evaluate("window.dispatchEvent(new CustomEvent('cf:threat',{detail:{indicator:'unrelated'}}))");
    await pause(200);
    assert.match(await evaluate("document.getElementById('feed').textContent"), /Fixture event/);
    assert.doesNotMatch(await evaluate("document.getElementById('feed').textContent"), /unrelated/);
    await navigate('model-inference');
    assert.match(await evaluate("document.getElementById('models').textContent"), /not_loaded/);
    await evaluate('__fail=true;refreshStatus()');
    assert.match(await evaluate("document.getElementById('models').textContent"), /No capability report/);
    await navigate('security-functions');
    await evaluate("document.querySelector('[data-view=policies]').click()");
    assert.equal(await evaluate("document.getElementById('simBtn').disabled"), true);
    assert.equal(await evaluate("__calls.filter(c=>c.cmd==='policy_evaluate').length"), 0);
    await navigate('threat-globe');
    assert.equal(await evaluate("__calls.filter(c=>c.cmd==='memory_save').length"), 0, 'Public intel must not silently change context');
    await evaluate("document.getElementById('saveIntel').click()"); await pause(200);
    assert.equal(await evaluate("document.getElementById('mLearned').textContent"), '1');
    await navigate('threat-overview');
    await evaluate('CFConsole.refresh(true)');
    await evaluate('__fail=true;CFConsole.refresh(true)');
    assert.match(await evaluate("document.getElementById('ccPageMetrics').textContent"),/stale/);
    await evaluate('__fail=false;CFConsole.refresh(true)');
    await navigate('agent-core');
    const readsBefore=await evaluate("__calls.filter(c=>c.cmd==='get_system_stats').length");
    await evaluate("[...document.querySelectorAll('.cc-page-actions button')].find(b=>b.textContent==='Refresh data').click()");
    await pause(300);
    assert((await evaluate("__calls.filter(c=>c.cmd==='get_system_stats').length"))>readsBefore,'Runtime refresh fetches current system readings');
    assert.deepEqual(errors, []);
    console.log('PASS navigation, unknown scans, report selection, incident refresh, model failure, policy consent, intel saves');
    await send('Browser.close');
  } finally {
    if(socket&&socket.readyState===1){socket.send(JSON.stringify({id:999999,method:'Browser.close'}));await pause(300);socket.close();}
    browser.kill();browser.stderr.destroy();browser.unref();server.closeAllConnections();server.close();
    // Only the unique temporary browser profile created above may be removed.
    await pause(500);
    assert(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(profile).startsWith('cf-nav-check-'));
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch (_) {}
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
