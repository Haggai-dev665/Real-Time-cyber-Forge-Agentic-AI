/* Actual activity restored from the account-isolated native journal. */
buildHeader({status:'EVENT STREAM'});buildSidebar('pipeline');
buildFooter({items:[{txt:'Desktop + backend events',cls:'sb-cyan'},{txt:'Recent activity in memory',cls:'sb-amber'},{txt:'500 events · up to one hour',cls:'sb-green'}]});
fitWindow('win');
const stages=['ingest','analyze','reason'],events=new Map();
let paused=false,loading=true,error='';
function set(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function clock(t){return new Date(t).toLocaleTimeString();}
function category(t){return /^(scan:|ml:)/.test(t)?'analyze':/^(alert:|threat:|finding:)/.test(t)?'reason':'ingest';}
function recent(){return [...events.values()].sort((a,b)=>b.ts-a.ts);}
function receive(e,quiet){
  if(!e||!e.id||!e.type||!Number.isFinite(+e.ts))return;
  events.set(e.id,{...e,ts:+e.ts});recent().slice(500).forEach(e=>events.delete(e.id));
  if(!quiet){refresh();if(!paused)render();}
}
function refresh(){
  const now=Date.now();for(const [id,e] of events)if(now-e.ts>3600000)events.delete(id);
  const list=recent();
  stages.forEach(k=>{
    const matching=list.filter(e=>category(e.type)===k),last=matching[0],busy=last&&now-last.ts<10000;
    set('n-'+k,String(matching.length));set('m-'+k,String(matching.filter(e=>now-e.ts<=60000).length));set('t-'+k,last?clock(last.ts):'—');
    const badge=document.getElementById('st-'+k);if(badge){badge.textContent=busy?'ACTIVE':'IDLE';badge.className='st '+(busy?'active':'idle');}
    const hero=document.querySelector('[data-stage="'+k+'"]');if(hero){hero.classList.toggle('on',!!busy);hero.querySelector('.scount').textContent=matching.length;}
  });
  const rate=(list.filter(e=>now-e.ts<=10000).length/10).toFixed(1);set('kIngest',rate+'/s');set('thru',rate+' events/s');
  const live=CF.realtime&&CF.realtime.connected,why=CF.realtime&&CF.realtime.reason;
  set('flowState',loading?'Loading recent activity…':error||(live?'Backend connected · local activity live':'Local activity live · backend '+(why||'not connected')));
  set('flowCount',list.length+' retained'+(paused?' · list paused':''));
}
function render(){
  const box=document.getElementById('evstream');if(!box)return;
  const filter=(document.getElementById('eventFilter').value||'').toLowerCase();
  const list=recent().filter(e=>JSON.stringify([e.type,e.data,e.source]).toLowerCase().includes(filter));box.replaceChildren();
  if(!list.length){const el=document.createElement('div');el.className='evr';el.textContent=loading?'Reading recent activity…':error||(filter?'No events match this filter.':'No activity recorded yet. Run a URL scan or use the app; actual desktop and server events appear here.');box.appendChild(el);return;}
  for(const e of list){
    const d=e.data||{},row=document.createElement('div');row.className='evr';
    const stamp=document.createElement('span');stamp.className='et';stamp.textContent=clock(e.ts);
    const label=document.createElement('span');label.className='es';label.textContent=[e.type,d.type,d.message,d.verdict,d.url||d.indicator,d.status,d.reason].filter(Boolean).join(' · ');label.title=label.textContent;
    const source=document.createElement('span');source.className='estage '+category(e.type);source.textContent=e.source==='desktop'?'DESKTOP':'BACKEND';row.append(stamp,label,source);box.appendChild(row);
  }
}
async function restore(){
  loading=true;error='';refresh();
  try{if(CF.realtime){CF.realtime.start();await CF.realtime.ready;}const r=await CF.invoke('stream_history');if(!r||!Array.isArray(r.events))throw new Error('This build does not expose the event journal.');r.events.forEach(e=>receive(e,true));}
  catch(e){error='Recent activity unavailable: '+String(e.message||e);}
  finally{loading=false;refresh();if(!paused)render();}
}
window.addEventListener('cf:event',e=>receive(e.detail));window.addEventListener('cf:stream-status',refresh);
document.getElementById('pauseBtn').addEventListener('click',()=>{paused=!paused;const b=document.getElementById('pauseBtn');b.lastChild.textContent=paused?'Resume list':'Pause list';b.setAttribute('aria-pressed',String(paused));refresh();if(!paused)render();});
document.getElementById('eventFilter').addEventListener('input',()=>{if(!paused)render();});document.getElementById('reloadEvents').addEventListener('click',restore);
async function telemetry(){try{const s=await CF.invoke('agent_status'),d=(s&&s.data)||{};set('kLat',d.latencyMs==null?'—':d.latencyMs+' ms');set('kBack',d.backendOk===true?'reachable':d.backendOk===false?'offline':'unknown');set('kEnrich',d.threatCount==null?'—':String(d.threatCount));}catch(e){set('kBack','unknown');}}
function refreshEventPage(){return Promise.all([restore(),telemetry()]);}
refresh();render();restore();telemetry();const refreshTimer=setInterval(refresh,1000),telemetryTimer=setInterval(telemetry,15000);
window.addEventListener('pagehide',()=>{clearInterval(refreshTimer);clearInterval(telemetryTimer);},{once:true});
