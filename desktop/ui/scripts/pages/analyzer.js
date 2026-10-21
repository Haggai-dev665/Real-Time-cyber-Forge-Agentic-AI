/* pages/analyzer.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'ANALYZER',search:'Analyze a URL, domain, IP or hash…'});
buildSidebar('analyzer');
buildFooter({items:[{txt:'Agents stack',cls:'sb-cyan'},{txt:'BERT · DGA · IOC',cls:'sb-amber'},{txt:'Manual analysis',cls:'sb-green'}]});
fitWindow('win');

function cfInvoke(cmd,args){ try{ if(window.CF&&CF.invoke) return CF.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('Desktop runtime unavailable')); }
function be(p){ return Promise.resolve(p).then(function(r){return r;}).catch(function(){return null;}); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function hostOf(u){ try{ var h=(String(u).split('://')[1]||String(u)).split('/')[0]; return h.split('?')[0]; }catch(e){ return u; } }
function ago(ts){ var s=Math.max(0,Math.floor(Date.now()/1000)-(ts||0)); if(s<60)return s+'s ago'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }

var input=document.getElementById('anInput'), typeEl=document.getElementById('anType'), goBtn=document.getElementById('anGo');

/* engine icons */
var ICO={
  orch:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/></svg>',
  rep:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/></svg>',
  bert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
  dga:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4c8 4 8 12 16 16M20 4C12 8 12 16 4 20"/></svg>',
  ens:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/></svg>',
  ai:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>'
};

/* ---------- input type detection ---------- */
function detectType(v){
  v=(v||'').trim();
  if(!v) return {type:'auto'};
  if(/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(v)) return {type:'hash',val:v};
  if(/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return {type:'ip',val:v};
  if(/^https?:\/\//i.test(v) || /\//.test(v)) return {type:'url',val:v};
  if(/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return {type:'domain',val:v};
  return {type:'url',val:v};
}
function refreshType(){ typeEl.textContent=(detectType(input.value).type||'auto').toUpperCase(); }
input.addEventListener('input',refreshType); refreshType();
document.querySelectorAll('.an-ex .ex').forEach(function(e){ e.addEventListener('click',function(){ input.value=e.dataset.v; refreshType(); input.focus(); }); });

/* ---------- helpers ---------- */
function gauge(score,color){
  var cx=60,cy=60,r=48,sw=12,C=2*Math.PI*r,frac=(score==null?0:Math.max(0,Math.min(100,score))/100);
  return '<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="rgba(126,148,184,.12)" stroke-width="'+sw+'"/>'+
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+(C*frac).toFixed(1)+' '+C+'" transform="rotate(-90 60 60)" style="transition:stroke-dasharray 1s cubic-bezier(.3,.8,.3,1);filter:drop-shadow(0 0 6px '+color+')"/></svg>';
}
function statOf(score){ if(score==null) return 'na'; return score>=65?'mal':score>=35?'sus':'clean'; }
function colOf(st){ return st==='mal'?'#ff7185':st==='sus'?'var(--amber-2)':st==='clean'?'var(--green)':'var(--faint)'; }
function statLabel(st){ return st==='mal'?'MALICIOUS':st==='sus'?'SUSPECT':st==='clean'?'CLEAN':'N/A'; }
function verdictOf(risk){ return risk==null?'No data':(risk>=65?'Malicious':risk>=35?'Suspicious':'Likely clean'); }

function engRow(e){
  var col=colOf(e.status), pct=e.score==null?0:Math.max(0,Math.min(100,e.score));
  return '<div class="eng"><div class="eico" style="color:'+col+'">'+e.icon+'</div>'+
    '<div class="einfo"><div class="en">'+esc(e.name)+'</div>'+(e.note?'<div class="enote">'+esc(e.note)+'</div>':'')+'</div>'+
    '<div class="etrack"><i style="width:'+pct+'%;background:'+col+'"></i></div>'+
    '<div class="echip"><span class="escore" style="color:'+col+'">'+(e.score==null?'—':Math.round(e.score))+'</span><span class="estat" style="color:'+col+'">'+statLabel(e.status)+'</span></div></div>';
}
function renderReport(o){
  // o.status overrides the status worked out from the score: a scan in which
  // nothing could be checked has a low score and is still not "clean".
  var st=o.status||statOf(o.risk), color=colOf(st);
  var pillBg=st==='mal'?'rgba(244,73,94,.14)':st==='sus'?'var(--amber-dim)':st==='clean'?'rgba(67,224,138,.14)':'var(--cyan-dim)';
  var flagged=o.engines.filter(function(e){return e.status==='mal'||e.status==='sus';}).length;
  var h='<div class="rep-head"><div class="gauge-wrap">'+gauge(o.risk,color)+'<div class="gv"><b style="color:'+color+'">'+(o.risk==null?'—':Math.round(o.risk))+'</b><span>risk</span></div></div>'+
    '<div class="res-meta"><div class="res-verdict">'+esc(o.verdict)+' <span class="res-pill" style="color:'+color+';background:'+pillBg+'">'+(o.status==='na'?'NOT VERIFIED':statLabel(st))+'</span></div>'+
    '<div class="res-sub">'+esc(o.label)+'</div>'+
    (o.note?('<div class="res-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>'+esc(o.note)+'</div>'):'')+
    '</div></div>';
  h+='<div class="rep-sec">Detection Agents <b>'+flagged+' / '+o.engines.length+' flagged</b></div>';
  h+='<div class="engines">'+o.engines.map(engRow).join('')+'</div>';
  if(o.signals && o.signals.length){
    h+='<div class="rep-sec">Why</div>';
    h+=o.signals.map(function(s){ var ai=/^AI:/i.test(s); return '<div class="rsig'+(ai?' ai':'')+'"><span class="d"></span><span>'+(ai?('<b>AI</b> — '+esc(s.replace(/^AI:\s*/i,''))):esc(s))+'</span></div>'; }).join('');
  }
  h+='<div class="rep-sec">Intelligence</div>';
  h+='<div class="intel">'+o.intel.map(function(kv){ var vc=kv[2]||''; return '<div class="kv"><span class="k">'+esc(kv[0])+'</span><span class="v '+vc+'">'+esc(kv[1])+'</span></div>'; }).join('')+'</div>';
  document.getElementById('resBody').innerHTML=h;
  document.getElementById('resEmpty').style.display='none';
}

/* ---------- analysis routes (best-effort; never hard-fails) ---------- */
async function analyzeUrl(url, label){
  var scan=await be(cfInvoke('scan_url',{url:url}));
  var enrich=await be(cfInvoke('ml_url_enrich',{url:url}));
  var d=(scan&&scan.data)||{};
  var risk=Number.isFinite(d.riskScore)?Math.round(d.riskScore):null, cat=d.category||'unknown';
  var signals=Array.isArray(d.signals)?d.signals:[];
  var ext=(d.externalDomains||[]), backend=(d.backendRiskScore!=null)?Math.round(+d.backendRiskScore):null;
  var comp=(enrich&&enrich.components)||{}, bert=comp.bert_threat_score, dga=comp.dga_threat_score, mlmax=comp.ml_max_threat_score;
  var fused=enrich&&Number.isFinite(enrich.risk_score)?Math.round(enrich.risk_score):null;
  var overall=risk==null?fused:(fused==null?risk:Math.max(risk,fused));
  // "unknown" is the scanner saying nothing could be checked; a low score then
  // means "not looked at", so it is not shown as clean.
  var unknown=overall==null || ((d.verdict==='unknown'||!scan||scan.success===false) && (fused==null||overall<35));
  var cov=d.coverage||{};

  var engines=[{name:'CyberForge Orchestrator',icon:ICO.orch,score:unknown?null:risk,status:unknown?'na':statOf(risk),note:unknown?'nothing could be checked':cat}];
  if(backend!=null) engines.push({name:'Server reputation',icon:ICO.rep,score:backend,status:statOf(backend),note:'cloud threat-intel'});
  if(bert!=null) engines.push({name:'BERT URL classifier',icon:ICO.bert,score:Math.round(bert*100),status:statOf(Math.round(bert*100)),note:'transformer model'});
  if(dga!=null) engines.push({name:'DGA domain detector',icon:ICO.dga,score:Math.round(dga*100),status:statOf(Math.round(dga*100)),note:'entropy + pattern'});
  if(mlmax!=null) engines.push({name:'Agents threat ensemble',icon:ICO.ens,score:Math.round(mlmax*100),status:statOf(Math.round(mlmax*100)),note:'max across models'});
  var aiSig=signals.find(function(s){return /^AI:/i.test(s);});
  if(aiSig) engines.push({name:'AI explanation',icon:ICO.ai,score:null,status:'na',note:aiSig.replace(/^AI:\s*/i,'').slice(0,40)});

  var phishWhy=(cat+' '+signals.join(' ')+' '+(d.summary||'')).match(/phish\w*|credential\w*|login|password|steal\w*|sign-in/i);
  var evadeWhy=signals.join(' ').match(/cloak\w*|evasion|anti-bot/i);
  if(phishWhy) signals.push('Possible phishing technique, not confirmed: '+phishWhy[0]+' in the findings.');
  if(evadeWhy) signals.push('Possible evasion technique, not confirmed: '+evadeWhy[0]+' in the signals.');
  var host=label; try{ host=new URL(url).hostname; }catch(e){}
  var ipr=await be(cfInvoke('resolve_ip',{host:host}));
  var note=unknown?'Neither the Analysis Agents nor the page itself could be checked, so there is no verdict for this address.'
    :(enrich?null:'Cloud Agents enrichment was unavailable — verdict from the orchestrator + local analysis.');
  renderReport({label:label,risk:unknown?null:overall,status:unknown?'na':null,verdict:unknown?'Not enough evidence':verdictOf(overall),engines:engines,signals:signals,note:note,intel:[
    ['Type','URL'],['Host',host],
    ['Page',cov.page||'—', cov.page==='not observed'?'bad':''],
    ['Reputation',d.conflictingEvidence?'well-known site, but flagged':(d.reputation==='well_known'?'well-known site':d.reputation==='user_content'?'user-content host':'no reputation'), d.conflictingEvidence?'bad':''],
    ['Primary IP',(ipr&&ipr.success&&ipr.ip)||'—'],
    ['Category',cat+(enrich&&enrich.risk_level?(' · '+enrich.risk_level):''), overall>=50?'bad':(overall!=null&&overall<35?'good':'')],
    ['External host references',ext.length?ext.join(', '):'none reported'],
    ['Missing security headers',(d.missingHeaders||[]).join(', ')||'none reported'],
    ['Checked at',new Date().toLocaleString()],
    ['Scan ID',d.scanId||d.id||'not supplied'],
    ['Coverage',Object.keys(cov).map(function(k){return k+': '+cov[k];}).join('; ')||'not supplied'],
    ['Agents flagged',engines.filter(function(e){return e.status==='mal'||e.status==='sus';}).length+' / '+engines.length]
  ]});
}
async function analyzeIocScan(args, label, type){
  var sc=await be(cfInvoke('ml_ioc_scan',args));
  var d=(sc&&sc.data)||sc||{};
  var keys=['riskScore','risk','fusedScore','score','confidence','probability','threat_score'];
  var risk=null; for(var i=0;i<keys.length;i++){ var n=+d[keys[i]]; if(!isNaN(n) && d[keys[i]]!=null){ risk=n<=1?Math.round(n*100):Math.round(n); break; } }
  var cat=d.verdict||d.label||d.classification||d.category||(sc?'analyzed':'no data');
  var engines=[{name:'IOC inspection',icon:ICO.ens,score:risk,status:statOf(risk),note: risk==null?'Parsing only; no reputation verdict returned':'reported indicator score'}];
  var dga=(d.components&&d.components.dga_threat_score);
  if(dga!=null) engines.push({name:'DGA domain detector',icon:ICO.dga,score:Math.round(dga*100),status:statOf(Math.round(dga*100)),note:'entropy + pattern'});
  var note= sc?null:'No reputation data was returned for this indicator (the Analysis Agents and intel service may be offline).';
  renderReport({label:label,risk:risk,status:risk==null?'na':null,verdict:(risk==null?'No reputation data':verdictOf(risk)),engines:engines,signals:[],note:note,intel:[
    ['Type',type],['Indicator',label],
    ['Reputation', risk==null?'no data':(risk>=50?'flagged':'clean'), risk==null?'':(risk>=50?'bad':'good')],
    ['Classification',String(cat)]
  ]});
}
async function analyze(){
  var v=(input.value||'').trim(); if(!v||goBtn.disabled) return;
  goBtn.disabled=true;
  var d=detectType(v);
  goBtn.classList.add('busy'); goBtn.lastChild.textContent='Analyzing…';
  document.getElementById('resEmpty').style.display='none';
  document.getElementById('resBody').innerHTML='<div class="res-empty"><div style="display:inline-block;width:22px;height:22px;border:2.4px solid rgba(43,212,238,.25);border-top-color:var(--cyan);border-radius:50%;animation:spin .8s linear infinite;margin-bottom:10px"></div><br>Running '+(d.type||'auto').toUpperCase()+' analysis across the detection stack…</div>';
  try{
    if(d.type==='url') await analyzeUrl(/^https?:\/\//i.test(v)?v:'https://'+v, v);
    else if(d.type==='domain') await analyzeUrl('http://'+v, v);
    else if(d.type==='ip') await analyzeIocScan({ip:v}, v, 'IPv4 address');
    else if(d.type==='hash') await analyzeIocScan({hash:v}, v, 'File hash');
    else await analyzeUrl(/:\/\//.test(v)?v:('http://'+v), v);
  }catch(e){
    document.getElementById('resBody').innerHTML='<div class="res-empty">Could not complete the analysis: '+esc(String((e&&e.message)||e))+'.<br>Make sure you are signed in to CyberForge and try again.</div>';
  }
  goBtn.disabled=false; goBtn.classList.remove('busy'); goBtn.lastChild.textContent='Analyze';
}
goBtn.addEventListener('click',analyze);
input.addEventListener('keydown',function(e){ if(e.key==='Enter') analyze(); });

cfInvoke('ml_status').then(function(r){ var ok=r&&(r.health||r.transformers); var b=document.getElementById('mlState'); if(b) b.textContent= ok?'Agents online':'Agents offline'; }).catch(function(){ var b=document.getElementById('mlState'); if(b)b.textContent='Agents offline'; });
