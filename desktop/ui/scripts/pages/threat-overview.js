/* pages/threat-overview.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'CHECKING',threats:'—'});
buildSidebar('overview');
buildFooter({items:[{txt:'— agents'},{txt:'CPU 0%',cls:'sb-amber'},{txt:'MEM 0%',cls:'sb-cyan'},{txt:'1 browser',cls:'sb-cyan'},{txt:'Syncing…',cls:'sb-green',spin:true}]});
/* Scale the fixed-size window to fill the viewport, as every other screen does. */
fitWindow('win');
/* The sections' entrance plays on the first visit of a session only. */
try{ if(sessionStorage.getItem('cf_ov_seen')) document.documentElement.classList.add('ov-seen'); sessionStorage.setItem('cf_ov_seen','1'); }catch(e){}

/* Every value shown here comes from the account's server or this computer; nothing is
   invented while waiting. Placeholders are skeletons until the first real answer. */
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }); }
function reducedMotion(){
  return document.documentElement.getAttribute('data-motion')==='reduce' ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
/* Restart a one-shot CSS animation class. */
function flash(el,cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function clock(t){ var d=new Date(t); return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'}); }
function ago(t){
  var ms=Date.now()-new Date(t).getTime(); if(!isFinite(ms)) return '';
  var s=Math.max(0,Math.round(ms/1000));
  if(s<60) return s+'s ago'; if(s<3600) return Math.round(s/60)+'m ago';
  if(s<86400) return Math.round(s/3600)+'h ago'; return Math.round(s/86400)+'d ago';
}

/* ---------- numbers count to their new value ---------- */
function countTo(el,value){
  if(!el) return;
  var to=Number(value)||0;
  var from=el.classList.contains('sk')?0:(Number(el.dataset.v)||0);
  el.classList.remove('sk'); el.dataset.v=String(to);
  if(el._raf){ cancelAnimationFrame(el._raf); el._raf=0; }   // a newer value replaces a count still running
  if(from===to){ el.textContent=String(to); return; }
  if(el.dataset.seen==='1') flash(el,'bump');
  el.dataset.seen='1';
  if(reducedMotion() || Math.abs(to-from)<2){ el.textContent=String(to); return; }
  var start=performance.now(), dur=650;
  (function step(now){
    var k=Math.min(1,(now-start)/dur), e=1-Math.pow(1-k,3);
    el.textContent=String(Math.round(from+(to-from)*e));
    el._raf=k<1?requestAnimationFrame(step):0;
  })(start);
}
function showText(el,text){ if(!el) return; el.classList.remove('sk'); el.textContent=text; }

/* ---------- stat cards: a soft light follows the pointer ---------- */
document.querySelectorAll('.stat').forEach(function(card){
  card.addEventListener('pointermove',function(e){
    var r=card.getBoundingClientRect();
    card.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');
    card.style.setProperty('--my',((e.clientY-r.top)/r.height*100).toFixed(1)+'%');
  });
});
function stat(key){ return document.querySelector('.stat[data-stat="'+key+'"]'); }
function setShare(key,part,total){
  var bar=stat(key)&&stat(key).querySelector('.share i'); if(!bar) return;
  bar.style.width=(total>0?Math.max(part>0?3:0,Math.round(part/total*100)):0)+'%';
}

/* ---------- "updated" stamp: the dot pings once when real data arrives ---------- */
function stampUpdated(){
  var wrap=document.getElementById('updatedWrap'), up=document.getElementById('updated');
  if(up) up.textContent='Updated '+clock(Date.now());
  if(wrap){ wrap.classList.add('live'); flash(wrap,'tick'); }
}

/* ---------- recorded-total chart, drawn at its real size so nothing stretches ---------- */
var volSeries=[];          // [{t, v}], newest last, 24 observations kept
var volDrawn=false;
function renderVol(animate){
  var stage=document.getElementById('volStage'), svg=document.getElementById('volChart');
  var empty=document.getElementById('volEmpty'); if(!stage||!svg) return;
  var W=stage.offsetWidth||600, H=stage.offsetHeight||196, n=volSeries.length;
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  if(!n){ svg.innerHTML=''; if(empty) empty.hidden=false; return; }
  if(empty) empty.hidden=true;
  var padL=30,padR=12,padT=14,padB=10;
  var vals=volSeries.map(function(p){ return p.v; });
  // three whole-number steps above zero, so every axis label is distinct
  var max=Math.max(3,Math.ceil(Math.max.apply(null,vals)/3)*3);
  var x=function(i){ return n===1?(padL+W-padR)/2:padL+i*(W-padL-padR)/(n-1); };
  var y=function(v){ return H-padB-(v/max)*(H-padT-padB); };
  var line='';
  for(var i=0;i<n;i++){
    var px=x(i),py=y(vals[i]);
    if(i===0) line='M'+px.toFixed(1)+' '+py.toFixed(1);
    else { var cx=((x(i-1)+px)/2).toFixed(1); line+=' C'+cx+' '+y(vals[i-1]).toFixed(1)+' '+cx+' '+py.toFixed(1)+' '+px.toFixed(1)+' '+py.toFixed(1); }
  }
  var area=line+' L'+x(n-1).toFixed(1)+' '+(H-padB)+' L'+x(0).toFixed(1)+' '+(H-padB)+' Z';
  var grid='';
  for(var g=0;g<=3;g++){
    var gy=(padT+g*(H-padT-padB)/3).toFixed(1), gv=Math.round(max*(1-g/3));
    grid+='<line x1="'+padL+'" y1="'+gy+'" x2="'+(W-padR)+'" y2="'+gy+'" stroke="rgba(126,148,184,.09)"/>'+
          '<text class="yl" x="'+(padL-8)+'" y="'+(Number(gy)+3)+'" text-anchor="end">'+gv+'</text>';
  }
  var draw=animate&&!volDrawn&&!reducedMotion();
  var lx=x(n-1).toFixed(1), ly=y(vals[n-1]).toFixed(1);
  svg.innerHTML=
    '<defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(245,166,35,.30)"/><stop offset="1" stop-color="rgba(245,166,35,0)"/></linearGradient></defs>'+
    grid+
    '<path class="'+(draw?'ar':'')+'" d="'+area+'" fill="url(#vg)"/>'+
    '<path class="ln'+(draw?' draw':'')+'" id="volLine" d="'+line+'"/>'+
    '<line class="xh" id="volXh" x1="0" y1="'+padT+'" x2="0" y2="'+(H-padB)+'"/>'+
    '<circle class="pt" id="volPt" r="4.5" cx="-20" cy="-20"/>'+
    '<circle class="halo" id="volHalo" cx="'+lx+'" cy="'+ly+'" r="4" stroke-width="2"/>'+
    '<circle class="last" cx="'+lx+'" cy="'+ly+'" r="3.5"/>';
  if(draw){ var path=document.getElementById('volLine'); if(path&&path.getTotalLength) path.style.setProperty('--len',Math.ceil(path.getTotalLength())); }
  volDrawn=true;
  stage._geom={x:x,y:y,W:W,padL:padL,padR:padR};
  var first=document.getElementById('axisFirst'), last=document.getElementById('axisLast');
  if(first) first.textContent=n>1?clock(volSeries[0].t):'First observation';
  if(last) last.textContent=clock(volSeries[n-1].t);
  var meta=document.getElementById('volMeta'); if(meta) meta.textContent=n+' observation'+(n===1?'':'s')+' this window';
}
(function(){
  var stage=document.getElementById('volStage'); if(!stage) return;
  var tip=document.getElementById('volTip');
  stage.addEventListener('pointermove',function(e){
    var gm=stage._geom, n=volSeries.length; if(!gm||!n||!tip) return;
    var r=stage.getBoundingClientRect(), scale=r.width/(stage.offsetWidth||r.width);
    var mx=(e.clientX-r.left)/scale;
    var i=n===1?0:Math.round((mx-gm.padL)/((gm.W-gm.padL-gm.padR)/(n-1)));
    i=Math.max(0,Math.min(n-1,i));
    var px=gm.x(i), py=gm.y(volSeries[i].v);
    var xh=document.getElementById('volXh'), pt=document.getElementById('volPt');
    if(xh){ xh.setAttribute('x1',px); xh.setAttribute('x2',px); }
    if(pt){ pt.setAttribute('cx',px); pt.setAttribute('cy',py); }
    tip.innerHTML='<b>'+esc(volSeries[i].v)+'</b> recorded<small>'+esc(clock(volSeries[i].t))+'</small>';
    tip.style.left=px+'px'; tip.style.top=py+'px'; tip.classList.add('has');
  });
  stage.addEventListener('pointerleave',function(){ if(tip) tip.classList.remove('has'); });
  var t; window.addEventListener('resize',function(){ clearTimeout(t); t=setTimeout(function(){ renderVol(false); },120); });
})();
renderVol(false);

/* ---------- severity donut: segments sweep to their share; hover to focus one ---------- */
var SEGS=[['Critical','var(--red)'],['High','var(--amber)'],['Medium','var(--yellow)'],['Low','var(--blue)']];
var donutCounts=null;
(function(){
  var svg=document.getElementById('donut'); if(!svg) return;
  var html='<circle cx="82" cy="82" r="58" fill="none" stroke="rgba(126,148,184,.12)" stroke-width="18"/>';
  SEGS.forEach(function(s,i){
    html+='<circle class="seg" data-seg="'+i+'" cx="82" cy="82" r="58" stroke="'+s[1]+'" stroke-dasharray="0 364.4" stroke-dashoffset="0" transform="rotate(-90 82 82)"/>';
  });
  svg.innerHTML=html;
  var stage=document.getElementById('donutStage');
  function focus(i){
    if(!donutCounts) return;
    var total=donutCounts.reduce(function(a,b){ return a+b; },0);
    stage.classList.toggle('focus',i!=null);
    svg.querySelectorAll('.seg').forEach(function(c){ c.classList.toggle('on',String(i)===c.getAttribute('data-seg')); });
    document.querySelectorAll('.legend .row').forEach(function(r){ r.classList.toggle('on',String(i)===r.getAttribute('data-seg')); });
    var val=document.getElementById('donutVal'), lbl=document.getElementById('donutLbl');
    if(i==null){ val.textContent=String(total); val.style.color=''; lbl.textContent='Total'; }
    else { var c=donutCounts[i]; val.textContent=total?Math.round(c/total*100)+'%':'0%'; val.style.color=SEGS[i][1]; lbl.textContent=SEGS[i][0]+' · '+c; }
  }
  svg.addEventListener('pointerover',function(e){ var s=e.target.closest&&e.target.closest('.seg'); if(s) focus(Number(s.getAttribute('data-seg'))); });
  svg.addEventListener('pointerleave',function(){ focus(null); });
  document.querySelectorAll('.legend .row').forEach(function(r){
    r.addEventListener('pointerenter',function(){ focus(Number(r.getAttribute('data-seg'))); });
    r.addEventListener('pointerleave',function(){ focus(null); });
  });
})();
function drawDonut(counts){
  donutCounts=counts;
  var total=counts.reduce(function(a,b){ return a+b; },0), C=2*Math.PI*58, off=0;
  document.querySelectorAll('#donut .seg').forEach(function(c,i){
    var len=total>0?(counts[i]/total)*C:0;
    c.setAttribute('stroke-dasharray',len.toFixed(2)+' '+(C-len).toFixed(2));
    c.setAttribute('stroke-dashoffset',(-off).toFixed(2));
    off+=len;
  });
  countTo(document.getElementById('donutVal'),total);
  document.querySelectorAll('.legend .row').forEach(function(r,i){
    var lv=r.querySelector('.lv'), bar=r.querySelector('.bar i');
    if(lv) lv.textContent=String(counts[i]);
    if(bar) bar.style.width=(total>0?Math.round(counts[i]/total*100):0)+'%';
  });
}

/* ---------- latest threats: only rows not seen before animate in ---------- */
var seenThreats=null;
function renderFeed(list){
  var skel=document.getElementById('feedSkel'), empty=document.getElementById('feedEmpty'), box=document.getElementById('feedList');
  var meta=document.getElementById('feedMeta'); if(!box) return;
  if(skel) skel.hidden=true;
  if(!list||!list.length){ box.hidden=true; box.innerHTML=''; if(empty) empty.hidden=false; if(meta) meta.textContent=''; seenThreats=seenThreats||{}; return; }
  if(empty) empty.hidden=true; box.hidden=false;
  var rows=list.slice(0,14), first=seenThreats===null, next={};
  box.innerHTML=rows.map(function(t,i){
    var sev=String(t.severity||'low').toLowerCase(); if(['critical','high','medium','low'].indexOf(sev)<0) sev='low';
    var col=sev==='critical'?'var(--red)':sev==='high'?'var(--amber-2)':sev==='medium'?'var(--yellow)':'var(--blue)';
    var id=String(t.threatId||t.id||t._id||'');
    var key=id||('row'+i+String(t.title||t.type||''));
    next[key]=1;
    var name=t.title||t.type||(t.detection&&t.detection.source)||t.source||t.url||'Threat';
    var risk=(t.riskScore!=null?t.riskScore:(t.detection&&t.detection.riskScore));
    var when=t.detectedAt||t.timestamp||t.createdAt;
    var fresh=!first&&!seenThreats[key];
    return '<a class="ov-row'+(fresh?' is-new':'')+'" href="investigations.html#'+encodeURIComponent(id)+'">'+
      '<span class="sd" style="background:'+col+';box-shadow:0 0 6px '+col+'"></span>'+
      '<span class="nm">'+esc(String(name).slice(0,64))+'</span>'+
      (when?'<span class="tm" title="'+esc(new Date(when).toLocaleString())+'">'+esc(ago(when))+'</span>':'')+
      '<span class="sev '+sev+'">'+esc(sev)+((risk!=null&&risk!=='')?(' '+esc(risk)):'')+'</span>'+
      '<svg class="go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>';
  }).join('');
  seenThreats=next;
  if(meta) meta.textContent=rows.length<list.length?('latest '+rows.length+' of '+list.length):(rows.length+' shown');
}

/* ---------- service health ---------- */
var lastHealth={};
function renderHealth(st){
  var skel=document.getElementById('healthSkel'), box=document.getElementById('healthList'); if(!box) return;
  if(skel) skel.hidden=true; box.hidden=false;
  var lat=Number(st.latencyMs)||0;
  var rows=[
    {k:'agent',ok:!!st.agentRunning,name:'Local monitoring',detail:st.agentRunning?'Watching this computer':'Not running on this computer',state:st.agentRunning?'RUNNING':'IDLE',
     icon:'<path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/>'},
    {k:'server',ok:!!st.backendOk,name:'Server',detail:st.backendOk?('Answered in '+lat+' ms'):'No answer from the server',state:st.backendOk?'ONLINE':'OFFLINE',lat:st.backendOk?lat:null,
     icon:'<rect x="2" y="3" width="20" height="6" rx="1"/><rect x="2" y="15" width="20" height="6" rx="1"/>'},
    {k:'engine',ok:!!st.mlOk,name:'Analysis Agents',detail:st.mlOk?'Reported healthy by the server':'Not available',state:st.mlOk?'HEALTHY':'DOWN',
     icon:'<path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 19l-6-10V3"/>'}
  ];
  box.innerHTML=rows.map(function(r){
    var flip=(r.k in lastHealth)&&lastHealth[r.k]!==r.ok;
    // the latency bar fills toward 1 s: shorter is better, so it is drawn as remaining headroom
    var bar=r.lat!=null?'<span class="lat" title="Round trip '+esc(r.lat)+' ms"><i style="width:'+Math.max(4,Math.min(100,100-r.lat/10))+'%"></i></span>':'';
    return '<div class="svc-row'+(flip?' flip':'')+'" data-ok="'+(r.ok?1:0)+'">'+
      '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+r.icon+'</svg></span>'+
      '<span class="tx"><b>'+esc(r.name)+'</b><small>'+esc(r.detail)+'</small>'+bar+'</span>'+
      '<span class="svc-state">'+esc(r.state)+'</span></div>';
  }).join('');
  rows.forEach(function(r){ lastHealth[r.k]=r.ok; });
  var up=rows.filter(function(r){ return r.ok; }).length;
  var cnt=document.getElementById('healthCount'); if(cnt) cnt.textContent=up+' of '+rows.length+' available';
}

/* ---------- real data via the shared cf-telemetry event and direct pulls ---------- */
function applyThreats(p){
  if(!p) return;
  var th=(p.threats&&p.threats.data)||null;
  var st=(p.status&&p.status.data)||null;
  if(th){
    var total=th.total||0, crit=th.critical||0, high=th.high||0;
    countTo(stat('total').querySelector('.num'),total);
    countTo(stat('critical').querySelector('.num'),crit);
    countTo(stat('high').querySelector('.num'),high);
    setShare('critical',crit,total); setShare('high',high,total);
    var sc=document.getElementById('subCritical'), sh=document.getElementById('subHigh');
    if(sc) sc.textContent=total?(Math.round(crit/total*100)+'% of all · P0'):'P0 alerts';
    if(sh) sh.textContent=total?(Math.round(high/total*100)+'% of all · P1'):'P1 alerts';
    drawDonut([crit,high,th.medium||0,th.low||0]);
    renderFeed(th.threats||[]);
    var changed=!volSeries.length||volSeries[volSeries.length-1].v!==total;
    volSeries.push({t:Date.now(),v:total}); if(volSeries.length>24) volSeries.shift();
    renderVol(true);
    if(changed){ var halo=document.getElementById('volHalo'); if(halo) flash(halo,'tick'); }
    var live=document.getElementById('volLive'); if(live){ live.classList.add('on'); live.lastChild.textContent='LIVE'; flash(live,'tick'); }
    stampUpdated();
  }
  if(st){ renderHealth(st); stampUpdated(); }
}
var pullThreats=function(){};
try{ var T=window.__TAURI__||(window.parent&&window.parent.__TAURI__);
  if(T&&T.event&&T.event.listen) T.event.listen('cf-telemetry', function(e){ applyThreats(e.payload); applyLive(e.payload); });
  pullThreats=function(){ if(!(T&&T.core&&T.core.invoke)) return Promise.resolve();
    return Promise.allSettled([
      T.core.invoke('get_threats').then(function(r){ applyThreats({threats:r}); }),
      T.core.invoke('agent_status').then(function(r){ applyThreats({status:r}); })
    ]);
  };
  // Paint at once from the loading screen's prewarm (under 10 minutes old), then refresh live.
  try{ var _pt=JSON.parse(localStorage.getItem('cf_pre_threats')||'null'); if(_pt&&_pt.payload&&(Date.now()-_pt.ts)<600000) applyThreats({threats:_pt.payload}); }catch(e){}
  try{ var _ps=JSON.parse(localStorage.getItem('cf_pre_status')||'null'); if(_ps&&_ps.payload&&(Date.now()-_ps.ts)<600000) applyThreats({status:_ps.payload}); }catch(e){}
  pullThreats();
  // Re-pull the moment a live event arrives.
  var _lt; function cfLiveRefresh(){ clearTimeout(_lt); _lt=setTimeout(pullThreats,300); }
  ['cf:threat','cf:scan','cf:alert'].forEach(function(n){ window.addEventListener(n, cfLiveRefresh); });
}catch(e){}

/* ---------- browsing on this computer: active tab, latest scan, recent pages ---------- */
function host(u){ try{ return new URL(u).hostname.replace(/^www\./,''); }catch(e){ return String(u||''); } }
function verdictChip(v,risk){
  var w=String(v||'').toLowerCase();
  var cls=/threat|malicious|phish|danger|block/.test(w)?'bad':/suspicious|warn|caution/.test(w)?'warn':/safe|benign|clean|allow/.test(w)?'good':'';
  return '<span class="vchip '+cls+'">'+esc(w||'unknown')+((risk!=null&&risk!=='')?(' '+esc(risk)):'')+'</span>';
}
function privacyOff(err){ return /PRIVACY_OFF/.test(String((err&&err.message)||err||'')); }
function showEmpty(id,icon,title,text,action){
  var el=document.getElementById(id); if(!el) return;
  el.innerHTML='<span class="em off">'+icon+'</span><b>'+esc(title)+'</b><span>'+esc(text)+'</span>'+(action?'<button type="button" class="btnlike" data-act="'+esc(action[0])+'">'+esc(action[1])+'</button>':'');
  el.hidden=false;
  var b=el.querySelector('[data-act="privacy"]'); if(b) b.addEventListener('click',function(){ if(window.openCfSettings) window.openCfSettings('privacy'); });
}
var ICON_LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
var ICON_WIFI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/></svg>';
var live={scan:null,scanKey:'',scanSeen:0,active:null,seenPages:null,seenRuns:null,runningBrowsers:[]};
function markLive(id){ var b=document.getElementById(id); if(b){ b.classList.add('on'); b.lastChild.textContent='LIVE'; flash(b,'tick'); } }
function renderNow(){
  var box=document.getElementById('browseNow'); if(!box) return;
  var lines=[];
  if(live.active){
    var a=live.active;
    lines.push('<div class="ln"><span class="k">Active tab</span><span class="v">'+esc(a.title||a.host||a.url||'')+'<small>'+esc((a.host||host(a.url||''))+(a.browser?(' · '+a.browser):''))+'</small></span></div>');
  }
  if(live.scan){
    var d=live.scan;
    lines.push('<div class="ln"><span class="k">Last scan</span><span class="v">'+esc(host(d.url||d.target||''))+'<small>'+esc(d.category||'')+(live.scanSeen?(' · '+ago(live.scanSeen)):'')+'</small></span>'+verdictChip(d.verdict,d.riskScore)+'</div>');
  }
  if(live.runningBrowsers.length) lines.push('<div class="ln"><span class="k">Running</span><span class="v">'+esc(live.runningBrowsers.join(', '))+'</span></div>');
  box.innerHTML=lines.join(''); box.hidden=!lines.length;
}
/* from the 3 s telemetry: the latest scan and which browsers are running */
function applyLive(p){
  if(!p) return;
  var scan=p.lastScan&&(p.lastScan.data||p.lastScan);
  if(scan&&typeof scan==='object'&&(scan.url||scan.target||scan.verdict)){
    var key=[scan.url||scan.target,scan.verdict,scan.riskScore].join('|');
    if(key!==live.scanKey){
      var firstSeen=!live.scanKey; live.scanKey=key; live.scan=scan; live.scanSeen=scan.scannedAt||scan.timestamp||Date.now();
      if(!firstSeen){ var nb=document.getElementById('browseNow'); if(nb) flash(nb,'flash'); }
      markLive('browseLive');
    }
  }
  var br=p.browsers&&p.browsers.data&&p.browsers.data.browsers;
  if(Array.isArray(br)) live.runningBrowsers=br.filter(function(b){ return b.isRunning; }).map(function(b){ return String(b.name||''); }).filter(Boolean);
  renderNow();
}
function pullBrowsing(){
  if(!(window.CF&&CF.invoke)) return Promise.resolve();
  var skel=document.getElementById('browseSkel'), list=document.getElementById('browseList'), empty=document.getElementById('browseEmpty'), meta=document.getElementById('browseMeta');
  return Promise.allSettled([CF.invoke('get_browser_history',{limit:8}), CF.invoke('get_active_urls'), CF.invoke('get_last_scan')]).then(function(r){
    if(skel) skel.hidden=true;
    // the active tab (Active-tab access) and the scan kept in this session
    if(r[1].status==='fulfilled'){ var d=(r[1].value&&r[1].value.data)||{}; var u=(d.urls||[])[0]; live.active=u||(d.active?{title:d.active.title,browser:d.active.browser}:null); }
    else live.active=null;
    if(r[2].status==='fulfilled'&&r[2].value) applyLive({lastScan:r[2].value}); else renderNow();
    if(r[0].status==='rejected'){
      list.hidden=true; if(meta) meta.textContent='';
      if(privacyOff(r[0].reason)) showEmpty('browseEmpty',ICON_LOCK,'History access is off','CyberForge reads your browser history only when you allow it.',['privacy','Open Privacy settings']);
      else showEmpty('browseEmpty',ICON_WIFI,'History unavailable',String((r[0].reason&&r[0].reason.message)||r[0].reason||'The history could not be read.'));
      return;
    }
    var data=(r[0].value&&r[0].value.data)||{}, items=data.history||[];
    var browsers=Object.keys(data.byBrowser||{}).length;
    if(meta) meta.textContent=(data.totalUnique||items.length)+' pages · '+browsers+' browser'+(browsers===1?'':'s');
    if(!items.length){ list.hidden=true; showEmpty('browseEmpty',ICON_WIFI,'No pages collected yet','Pages appear here as your browsers record them.'); return; }
    empty.hidden=true; list.hidden=false;
    var first=live.seenPages===null, next={};
    var scannedHost=live.scan?host(live.scan.url||live.scan.target||''):'';
    list.innerHTML=items.map(function(it){
      var h=host(it.url), key=it.url+'|'+it.lastVisit; next[key]=1;
      var fresh=!first&&!live.seenPages[key];
      var when=it.lastVisit?ago(it.lastVisit*1000):'';
      return '<a class="ov-row'+(fresh?' is-new':'')+'" href="web-history.html">'+
        '<span class="bb" title="'+esc(it.browser||'')+'">'+esc(String(it.browser||'?').slice(0,2).toUpperCase())+'</span>'+
        '<span class="two"><b>'+esc(it.title||h||it.url)+'</b><small>'+esc(h)+(it.browser?(' · '+esc(it.browser)):'')+'</small></span>'+
        (when?'<span class="tm">'+esc(when)+'</span>':'')+
        (scannedHost&&h===scannedHost?verdictChip(live.scan.verdict,live.scan.riskScore):'')+'</a>';
    }).join('');
    live.seenPages=next;
    markLive('browseLive');
  });
}

/* ---------- agent work: active agents and their latest runs ---------- */
var RUN_CLS={queued:'',leased:'run',running:'run',completed:'good',partial:'warn',failed:'bad',cancelled:''};
/* a run state from the server picks one of these fixed classes, or none */
function runCls(state){ return Object.prototype.hasOwnProperty.call(RUN_CLS,state)?RUN_CLS[state]:''; }
function pullAgents(){
  if(!(window.CF&&CF.invoke)) return Promise.resolve();
  var skel=document.getElementById('agentSkel'), list=document.getElementById('agentList'), empty=document.getElementById('agentEmpty'), meta=document.getElementById('agentMeta'), now=document.getElementById('agentNow');
  return Promise.allSettled([CF.invoke('agents_call',{op:'run_search',id:null,body:{}}), CF.invoke('agents_call',{op:'list',id:null,body:null})]).then(function(r){
    if(skel) skel.hidden=true;
    if(r[0].status==='rejected'&&r[1].status==='rejected'){
      list.hidden=true; if(now) now.hidden=true; if(meta) meta.textContent='';
      showEmpty('agentEmpty',ICON_WIFI,'Agent work unavailable',String((r[0].reason&&r[0].reason.message)||r[0].reason||'The server did not answer.'));
      return;
    }
    var agents=(r[1].status==='fulfilled'&&r[1].value&&r[1].value.agents)||[];
    var runs=(r[0].status==='fulfilled'&&r[0].value&&r[0].value.runs)||[];
    var active=agents.filter(function(a){ return a.state==='active'; }).length;
    var working=runs.filter(function(x){ return ['queued','leased','running'].indexOf(x.state)>=0; });
    if(meta) meta.textContent=active+' of '+agents.length+' agents active';
    if(now){
      var lines=[];
      lines.push('<div class="ln"><span class="k">Working</span><span class="v">'+(working.length?esc(working.length+' run'+(working.length===1?'':'s')+' in progress'):'Nothing running now')+'</span>'+(working.length?'<span class="vchip run">live</span>':'')+'</div>');
      var done=runs.filter(function(x){ return x.endedAt; })[0];
      if(done) lines.push('<div class="ln"><span class="k">Last done</span><span class="v">'+esc(done.agentName||'Agent')+'<small>'+esc(ago(done.endedAt))+'</small></span>'+'<span class="vchip '+runCls(done.state)+'">'+esc(done.state)+'</span></div>');
      now.innerHTML=lines.join(''); now.hidden=false;
    }
    if(!runs.length){
      list.hidden=true;
      showEmpty('agentEmpty',ICON_WIFI,agents.length?'No runs yet':'No agents yet',agents.length?'Runs appear here as your agents work.':'Create an agent on the Agents page to have work run for you.');
      return;
    }
    empty.hidden=true; list.hidden=false;
    var first=live.seenRuns===null, next={};
    list.innerHTML=runs.slice(0,8).map(function(x){
      var key=x.runId+'|'+x.state; next[key]=1;
      var fresh=!first&&!live.seenRuns[key];
      return '<a class="ov-row'+(fresh?' is-new':'')+'" href="agents.html">'+
        '<span class="two"><b>'+esc(x.agentName||'Agent')+'</b><small>'+esc(x.outcome||(x.trigger?('Triggered '+x.trigger):''))+'</small></span>'+
        '<span class="tm">'+esc(ago(x.createdAt))+'</span>'+
        '<span class="vchip '+runCls(x.state)+'">'+esc(x.state)+'</span></a>';
    }).join('');
    live.seenRuns=next;
    markLive('agentLive');
  });
}
pullBrowsing(); pullAgents();
setInterval(function(){ if(!document.hidden) pullBrowsing(); },10000);
setInterval(function(){ if(!document.hidden) pullAgents(); },15000);
// live events: a scan or agent activity re-pulls the matching section at once
(function(){
  var tb,ta;
  window.addEventListener('cf:scan',function(){ clearTimeout(tb); tb=setTimeout(pullBrowsing,400); });
  window.addEventListener('cf:agent',function(){ clearTimeout(ta); ta=setTimeout(pullAgents,400); });
  document.addEventListener('visibilitychange',function(){ if(!document.hidden){ pullBrowsing(); pullAgents(); } });
})();

/* ---------- this computer: privacy, approvals, devices ---------- */
function setContext(id,tone,state,detail){
  var card=document.getElementById(id); if(!card) return;
  card.setAttribute('data-tone',tone);
  var b=card.querySelector('.ct b'), small=card.querySelector('.ct small');
  if(b) b.textContent=state;
  if(small){ small.textContent=detail; small.title=detail; }
}
(function(){
  var m=document.getElementById('ctxMonitor');
  if(m) m.addEventListener('click',function(){ if(typeof window.openCfSettings==='function') window.openCfSettings('privacy'); });
})();
/* Called by the console's "Refresh data" button too. */
async function refreshCoverage(){
  const invoke=(cmd,args)=>CF.invoke(cmd,args||{});
  await Promise.allSettled([
    pullThreats(), pullBrowsing(), pullAgents(),
    invoke('devices_list').then(r=>{
      const devices=r.devices;if(!Array.isArray(devices))throw new Error('No inventory');
      const online=devices.filter(d=>d.connection==='online').length, full=devices.filter(d=>d.coverage==='full').length;
      countTo(stat('devices').querySelector('.num'),devices.length);
      setShare('devices',online,devices.length);
      const sub=document.getElementById('subDevices');if(sub)sub.textContent=devices.length?(online+' online now'):'None enrolled yet';
      setContext('ctxDevice',!devices.length?'off':online===devices.length?'ok':'warn',
        devices.length?(online+' of '+devices.length+' online'):'No devices enrolled',
        devices.length?(full+' reporting full coverage'):'Enroll this computer from Devices');
    }).catch(()=>{
      showText(stat('devices').querySelector('.num'),'—');
      setContext('ctxDevice','off','Unavailable','Device inventory could not be read');
    }),
    invoke('agents_call',{op:'actions',id:null,body:null}).then(r=>{
      if(!Array.isArray(r.actions))throw new Error('No actions');
      const waiting=r.actions.filter(a=>a.state==='proposed').length;
      setContext('ctxApproval',waiting?'warn':'ok',waiting?(waiting+' awaiting you'):'Nothing waiting',
        waiting?(waiting===1?'A proposal needs your decision':'Proposals need your decision'):'No agent proposal needs a decision');
    }).catch(()=>{ setContext('ctxApproval','off','Unavailable','Pending approvals could not be read'); }),
    invoke('privacy_get').then(r=>{
      const features=r.features||[], on=features.filter(f=>f.enabled);
      setContext('ctxMonitor',on.length?'ok':'off',features.length?(on.length+' of '+features.length+' features on'):'No features reported',
        features.map(f=>f.label+': '+(f.enabled?'on':'off')).join(' · ')||'Review Settings → Privacy');
    }).catch(()=>{ setContext('ctxMonitor','off','Unavailable','Review Settings → Privacy'); })
  ]);
}
refreshCoverage();setInterval(refreshCoverage,30000);
