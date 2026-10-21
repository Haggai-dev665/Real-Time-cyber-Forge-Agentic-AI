/* pages/scheduled.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'SCHEDULER'});
buildSidebar('scheduled');
buildFooter({items:[{txt:'scheduled agents',cls:'sb-amber'},{txt:'run by the server worker',cls:'sb-cyan'},{txt:'refreshes every 30 s',cls:'sb-green'}]});
fitWindow('win');

/* What is scheduled: the account's agents on an interval schedule (AGT-04).
   The backend worker makes one run per schedule slot; this page lists those
   agents, the start of each one's next slot, and their recent runs, and can
   pause, resume or run one now. Nothing here is a local timer: a job that is
   not an agent is not shown, because nothing would run it. */
const e=CF.esc; // agent names and run outcomes come from the backend: text, never markup (SEC-05)
let agents=[], runs=[];

function call(op,id,body){ return CF.invoke('agents_call',{op:op,id:id||null,body:body||null}); }
function key(){ const b=new Uint8Array(12); crypto.getRandomValues(b); return Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''); }
function periodMs(a){ const s=a.config&&a.config.schedule; return s&&s.kind==='interval'&&s.everyMinutes?s.everyMinutes*60000:null; }
function nextSlot(a,now){ const p=periodMs(a); return p?(Math.floor(now/p)+1)*p:null; }
function fmtIn(ms){ const s=Math.max(0,Math.round(ms/1000)); const m=Math.floor(s/60), h=Math.floor(m/60);
  return h?(h+'h '+String(m%60).padStart(2,'0')+'m'):(String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0')); }
function every(a){ const m=a.config.schedule.everyMinutes; return m%1440===0?('every '+(m/1440)+' d'):m%60===0?('every '+(m/60)+' h'):('every '+m+' min'); }
function ago(t){ const m=Math.floor((Date.now()-new Date(t).getTime())/60000); if(m<1)return 'just now'; if(m<60)return m+'m ago'; const h=Math.floor(m/60); return h<24?h+'h ago':Math.floor(h/24)+'d ago'; }
function set(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function ring(svg,frac,color){const cx=23,cy=23,r=18,sw=4,C=2*Math.PI*r;
  svg.innerHTML='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="rgba(126,148,184,.16)" stroke-width="'+sw+'"/>'+
  '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" '+
  'stroke-dasharray="'+(C*frac).toFixed(1)+' '+C+'" transform="rotate(-90 '+cx+' '+cy+')"/>';}

function renderJobs(){
  const box=document.getElementById('jobs');
  if(!agents.length){
    box.innerHTML='<div class="sch-empty">No agent is on a schedule. In Agents, give an agent an interval schedule and activate it; it then runs here once per interval.</div>';
    return;
  }
  box.innerHTML=agents.map((a,i)=>
    '<div class="job"><div class="ring-wrap"><svg width="46" height="46" viewBox="0 0 46 46" id="jr'+i+'"></svg><span class="rt" id="jt'+i+'">—</span></div>'+
    '<div class="jinfo"><div class="jn">'+e(a.name)+' <span class="recur daily">'+e(every(a).toUpperCase())+'</span></div><div class="jc">'+e(a.templateName||a.templateId)+' · v'+e(a.version)+'</div></div>'+
    '<div class="jnext"><div class="nx">'+(a.state==='active'?'active':e(a.state))+'</div><div class="nl">'+(a.state==='active'?'next slot':'not running')+'</div></div>'+
    '<div class="jrun" data-i="'+i+'" title="Run now"'+(a.state==='active'?'':' style="opacity:.35;pointer-events:none"')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 14 8-14 8Z"/></svg></div>'+
    '<div class="jtoggle'+(a.state==='active'?'':' off')+'" data-i="'+i+'" title="'+(a.state==='active'?'Pause':'Resume')+'"></div></div>').join('');
  box.querySelectorAll('.jrun').forEach(b=>b.addEventListener('click',()=>{ const a=agents[+b.dataset.i]; b.classList.add('busy');
    call('run',a.agentId,{idempotencyKey:key()}).then(()=>{ if(window.CF&&CF.toast) CF.toast('Run requested','ok'); load(); })
      .catch(err=>{ if(window.CF&&CF.toast) CF.toast(String((err&&err.message)||err),'error'); }).then(()=>b.classList.remove('busy')); }));
  box.querySelectorAll('.jtoggle').forEach(t=>t.addEventListener('click',()=>{ const a=agents[+t.dataset.i];
    if(a.state!=='active'&&a.state!=='paused') return;
    call(a.state==='active'?'pause':'resume',a.agentId).then(load).catch(err=>{ if(window.CF&&CF.toast) CF.toast(String((err&&err.message)||err),'error'); }); }));
  tick();
}

function tick(){
  const now=Date.now(); let soonest=null;
  agents.forEach((a,i)=>{
    const sv=document.getElementById('jr'+i), tx=document.getElementById('jt'+i); if(!sv||!tx) return;
    const next=a.state==='active'?nextSlot(a,now):null;
    if(next){ const p=periodMs(a); ring(sv,1-(next-now)/p,(next-now)<30000?'var(--red)':'var(--amber)'); tx.textContent=fmtIn(next-now); soonest=soonest==null?next:Math.min(soonest,next); }
    else { ring(sv,0,'rgba(130,160,200,.2)'); tx.textContent='—'; }
  });
  set('nextrun', soonest?('Next slot in '+fmtIn(soonest-now)):'No slot scheduled');
  renderUpNext(now);
}

function renderUpNext(now){
  const up=agents.filter(a=>a.state==='active').map(a=>({a:a,at:nextSlot(a,now)})).sort((x,y)=>x.at-y.at);
  const box=document.getElementById('upnext');
  box.innerHTML=up.length?up.map((u,i)=>
    '<div class="up'+(i===0?' soon':'')+'"><span class="ut">'+e(new Date(u.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))+'</span><span class="un"></span>'+
    '<div class="ub"><div class="ut2">'+e(u.a.name)+'</div><div class="ud">'+e(every(u.a))+' · the worker starts it within seconds of the slot</div></div></div>').join('')
    :'<div class="sch-empty">Nothing is due.</div>';
}

function renderRuns(){
  const box=document.getElementById('runlog');
  if(!runs.length){ box.innerHTML='<div class="sch-empty">No runs yet.</div>'; }
  else box.innerHTML=runs.slice(0,30).map(r=>{
    const ok=r.state==='completed', bad=r.state==='failed'||r.state==='cancelled';
    return '<div class="rl"><span class="rok" style="background:'+(ok?'var(--green)':bad?'#f87171':'var(--amber)')+';box-shadow:none"></span>'+
      '<span class="rn">'+e(r.agentName)+' · '+e(r.trigger)+' · '+e(r.state)+'</span><span class="rd">'+e(ago(r.createdAt))+(r.outcome?(' · '+e(String(r.outcome).slice(0,80))):'')+'</span></div>'; }).join('');
  // the cards, from these runs only
  const today=new Date(); today.setHours(0,0,0,0);
  const todays=runs.filter(r=>new Date(r.createdAt)>=today);
  const ended=runs.filter(r=>['completed','partial','failed','cancelled'].includes(r.state));
  const timed=ended.filter(r=>r.startedAt&&r.endedAt);
  set('kRuns', String(todays.length));
  set('kRunsNote', todays.filter(r=>r.state==='failed').length+' failed');
  set('kRate', ended.length?(Math.round(ended.filter(r=>r.state==='completed').length/ended.length*1000)/10+'%'):'—');
  set('kRateNote', ended.length?('of the last '+ended.length+' finished runs'):'no finished runs yet');
  set('kDur', timed.length?((timed.reduce((s,r)=>s+(new Date(r.endedAt)-new Date(r.startedAt)),0)/timed.length/1000).toFixed(1)+' s'):'—');
}

async function load(){
  try{
    const list=await call('list'); const all=(list&&list.agents)||[];
    agents=all.filter(a=>periodMs(a)&&a.state!=='archived');
    const active=agents.filter(a=>a.state==='active').length;
    set('kActive', String(active)); set('kActiveNote', (agents.length-active)+' paused or not active');
    set('jobCount', agents.length+' scheduled'); set('schedState', active?(active+' active'):'none active');
    renderJobs();
    const lists=await Promise.all(agents.map(a=>call('runs',a.agentId).then(r=>((r&&r.runs)||[]).map(x=>Object.assign({agentName:a.name},x))).catch(()=>[])));
    runs=[].concat(...lists).sort((x,y)=>new Date(y.createdAt)-new Date(x.createdAt));
    renderRuns();
  }catch(err){
    const m=String((err&&err.message)||err);
    document.getElementById('jobs').innerHTML='<div class="sch-empty">'+e(/sign in/i.test(m)?'Sign in to see scheduled agents.':('Could not load agents: '+m))+'</div>';
  }
}
const newJob=document.getElementById('newJob'); if(newJob) newJob.addEventListener('click',()=>{ location.href='agents.html'; });
load(); setInterval(load,30000); setInterval(tick,1000);
