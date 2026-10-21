/* pages/signal-pipeline.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'EVENT STREAM'});
buildSidebar('pipeline');
buildFooter({items:[{txt:'received events',cls:'sb-cyan'},{txt:'events from the server',cls:'sb-amber'},{txt:'counts since this page opened',cls:'sb-green'}]});
fitWindow('win');

/* Every number on this page comes from the events the backend sends this app
   (re-broadcast by cf-realtime.js) or from agent_status. Counts start at zero
   when the page opens. A stage with no source (Normalize) says so. */
const STAGES=['ingest','analyze','reason'];
const seen={ingest:[],analyze:[],reason:[]};   // event times per stage
const total={ingest:0,analyze:0,reason:0};
let lastAny=0, paused=false, shown=0;

function set(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function clock(t){ const d=new Date(t); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'); }

function refresh(){
  const now=Date.now();
  STAGES.forEach(k=>{
    while(seen[k].length && now-seen[k][0]>60000) seen[k].shift();
    set('n-'+k,String(total[k])); set('m-'+k,String(seen[k].length));
    const last=seen[k][seen[k].length-1]; set('t-'+k,last?clock(last):'—');
    const st=document.getElementById('st-'+k); if(st){ const busy=last&&now-last<10000; st.textContent=busy?'ACTIVE':'IDLE'; st.className='st '+(busy?'active':'idle'); }
  });
  const sc=document.querySelectorAll('.scount');
  if(sc[0]) sc[0].textContent=String(total.ingest); if(sc[1]) sc[1].textContent=String(total.analyze); if(sc[2]) sc[2].textContent=String(total.reason);
  const recent=STAGES.reduce((n,k)=>n+seen[k].filter(t=>now-t<=10000).length,0);
  const r=(recent/10).toFixed(1);
  set('thru', r+' events/s');
  const ki=document.getElementById('kIngest'); if(ki) ki.innerHTML=CF.esc(r)+'<span style="font-size:13px;color:var(--faint)">/s</span>';
  set('flowState', lastAny?(now-lastAny<10000?'receiving events':'last event '+clock(lastAny)):'waiting for events');
}

(function(){
  const stream=document.getElementById('evstream');
  function row(stageK,label){
    const now=Date.now(); lastAny=now; total[stageK]++; seen[stageK].push(now); refresh();
    if(paused||!stream) return;
    const el=document.createElement('div'); el.className='evr';
    el.innerHTML='<span class="et"></span><span class="eid"></span><span class="es"></span><span class="estage '+stageK+'">'+({ingest:'AGENT',analyze:'SCAN',reason:'FINDING / ALERT'}[stageK])+'</span>';
    el.querySelector('.et').textContent=clock(now);
    el.querySelector('.eid').textContent='#'+(++shown);
    el.querySelector('.es').textContent=label;
    stream.prepend(el); while(stream.children.length>40) stream.lastChild.remove();
    set('flowCount', shown+' events');
  }
  window.addEventListener('cf:agent', e=>{ const d=e.detail||{}; row('ingest','agent · '+(d.type||'activity')+(d.url?' '+d.url:'')); });
  window.addEventListener('cf:scan',  e=>{ const d=e.detail||{}; row('analyze','scored '+((d.verdict||'').toUpperCase())+' · '+(d.url||'')); });
  window.addEventListener('cf:threat',e=>{ const d=e.detail||{}; row('reason','threat · '+(d.indicator||d.url||'')); });
  window.addEventListener('cf:alert', e=>{ const d=e.detail||{}; row('reason','alert · '+(d.message||d.url||'')); });
  if(stream&&!stream.children.length){ const w=document.createElement('div'); w.className='evr'; w.style.color='var(--faint)'; w.textContent='No events since this page opened.'; stream.appendChild(w); }
  const pb=document.getElementById('pauseBtn');
  if(pb) pb.addEventListener('click',()=>{ paused=!paused; pb.lastChild.textContent=paused?'Resume list':'Pause list'; });
})();

// backend status: round trip of the latest check, and whether it answered
async function tele(){
  try{ const s=await CF.invoke('agent_status'); const d=(s&&s.data)||{};
    const kl=document.getElementById('kLat');
    if(kl) kl.innerHTML=d.latencyMs!=null?(CF.esc(+d.latencyMs||0)+'<span style="font-size:13px;color:var(--faint)">ms</span>'):'—';
    set('kBack', d.backendOk?'yes':'no');
    set('kEnrich', d.threatCount!=null?String(d.threatCount):'—');
  }catch(e){ set('kBack','unknown'); }
}
refresh(); setInterval(refresh,1000);
tele(); setInterval(tele,5000);
window.addEventListener('cf:metrics', tele);
