/* pages/model-inference.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'MODELS'});
buildSidebar('models');
buildFooter({items:[{txt:'Service metadata',cls:'sb-cyan'},{txt:'Per-capability readiness',cls:'sb-green'},{txt:'Agents: checking…',id:'sbMl'}]});
fitWindow('win');

function renderCapabilities(response){
  const box=document.getElementById('models'); box.textContent='';
  const data=response&&response.success===true&&response.data;
  const entries=data&&data.available===true&&Array.isArray(data.capabilities)?data.capabilities:null;
  if(!entries){box.textContent=(response&&response.message)||'No capability report. Overall health does not establish individual model readiness.';document.getElementById('gpus').textContent='Service metadata unavailable';document.getElementById('datasets').textContent='Training metadata unavailable';return;}
  const kinds={trained_model:'Trained detector',transformer:'Transformer',heuristic:'Heuristic',reference_list:'Reference list',language_model:'Language model'};
  entries.forEach(function(item){
    const row=document.createElement('div');row.className='model';
    const info=document.createElement('div');info.className='minfo';
    const title=document.createElement('div');title.className='mn';title.textContent=item.id+' · '+(kinds[item.kind]||'Unknown type');
    const state=document.createElement('span');state.className='mstatus '+(item.readiness==='ready'?'serving':'idle');state.textContent=item.readiness||'unknown';title.appendChild(state);
    const note=document.createElement('div');note.className='mv';note.style.whiteSpace='normal';
    note.textContent=[item.model||'Model identifier not reported',item.reason,item.trainedAt?'Trained '+item.trainedAt:null,item.resultKind?'Result: '+item.resultKind:null,item.answersWithoutModel?'Without model: '+item.answersWithoutModel:null,Object.keys(item.limits||{}).map(k=>k+': '+item.limits[k]).join('; ')].filter(Boolean).join(' · ');
    info.append(title,note);row.appendChild(info);box.appendChild(row);
  });
  if(!entries.length)box.textContent='The service reports no capabilities.';
  document.getElementById('gpus').textContent='Source: '+(data.source||'Analysis Agents')+' · service version '+(data.serviceVersion||'not supplied')+' · checked '+(data.checkedAt||'unknown')+'. '+(data.notOffered||[]).map(x=>x.what+': '+x.note).join(' ');
  const training=data.training||{};
  document.getElementById('datasets').textContent=[training.who,training.note,training.separateFromInference?'Training is separate from inference.':null].filter(Boolean).join(' ')||'No training metadata supplied. Saving context does not train a model.';
}

// Scans seen on the live feed in the last 60 seconds, in twelve 5-second
// columns. Every column is a count of events that arrived; with none, the
// chart says so. (A line drawn from random numbers stood here.)
const scanBuckets=new Array(12).fill(0);
function drawScans(){
  const svg=document.getElementById('thrChart'); const W=640,H=160,pad=8;
  const total=scanBuckets.reduce((a,b)=>a+b,0);
  document.getElementById('thrState').textContent=total?(total+' in the last 60 s'):'none yet';
  let grid=''; for(let g=0;g<=3;g++){const gy=pad+g*(H-pad*2)/3;grid+='<line x1="0" y1="'+gy+'" x2="'+W+'" y2="'+gy+'" stroke="rgba(126,148,184,.08)"/>';}
  if(!total){
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.innerHTML=grid+'<text x="'+(W/2)+'" y="'+(H/2+5)+'" text-anchor="middle" fill="var(--faint)" font-family="JetBrains Mono,monospace" font-size="13">No scans seen in the last 60 seconds</text>';
    return;
  }
  svg.setAttribute('preserveAspectRatio','none');
  const top=Math.max.apply(null,scanBuckets), bw=(W-pad*2)/scanBuckets.length;
  svg.innerHTML=grid+scanBuckets.map((v,i)=>{ const h=v?Math.max(4,(v/top)*(H-pad*2)):0;
    return '<rect x="'+(pad+i*bw+3).toFixed(1)+'" y="'+(H-pad-h).toFixed(1)+'" width="'+(bw-6).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="var(--amber)" opacity=".85"><title>'+v+' scan'+(v===1?'':'s')+'</title></rect>'; }).join('');
}
drawScans(); setInterval(()=>{ scanBuckets.shift(); scanBuckets.push(0); drawScans(); },5000);

// REAL ML status → drive the header, KPIs, and model badges from ml_status
// (Rust → backend → HF Space). Replaces the previous synthetic KPI jitter.
async function refreshStatus(){
  // Three outcomes are shown apart: healthy, degraded (it answered, and not as
  // healthy), and unavailable (no answer). None of them is filled in with a default.
  function show(state, loaded){
    const word={healthy:'Healthy',degraded:'Degraded',unavailable:'Unavailable'}[state];
    const ind=document.querySelector('.live-ind'); if(ind) ind.innerHTML='<span class="dot"></span>'+word;
    const ips=document.getElementById('ips'); if(ips) ips.textContent='Analysis Agents: '+word.toLowerCase();
    const kLat=document.getElementById('kLat'); if(kLat) kLat.textContent=word;
    const now=new Date(); const at=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const note=document.getElementById('kLatNote'); if(note) note.textContent='checked at '+at;
    const kAcc=document.getElementById('kAcc'); if(kAcc) kAcc.textContent=(loaded!=null?String(loaded):'—');
    const ms=document.getElementById('modelsState'); if(ms) ms.textContent='service '+word.toLowerCase();
    const sb=document.getElementById('sbMl'); if(sb) sb.textContent='Agents: '+word.toLowerCase();

  }
  try{
    await CFConsole.refresh(false);
    const report=CFConsole.capabilities();
    renderCapabilities(report?{success:true,data:report}:null);
    if(!report){show('unavailable',null);return;}
    const loaded=Array.isArray(report.capabilities)?report.capabilities.filter(c=>c.readiness==='ready').length:null;
    const ok=loaded!==null&&loaded===report.capabilities.length&&loaded>0;
    show(ok?'healthy':'degraded',loaded);
  }catch(e){ show('unavailable',null);renderCapabilities(null); }
}
refreshStatus(); setInterval(refreshStatus,30000);
// Each scan that arrives on the live feed is counted once, here and in the chart.
let _inf=0;
window.addEventListener('cf:scan',function(){ _inf++; var k=document.getElementById('kIps'); if(k) k.textContent=String(_inf);
  scanBuckets[scanBuckets.length-1]++; drawScans(); });
