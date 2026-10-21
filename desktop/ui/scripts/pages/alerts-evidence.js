/* pages/alerts-evidence.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'TRIAGE'});
buildSidebar('alerts');
buildFooter({items:[{txt:'alert queue',cls:'sb-amber'},{txt:'server-linked',cls:'sb-cyan'},{txt:'Live',cls:'sb-green',spin:true}]});
fitWindow('win');

const sevIco={crit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 10 18H2Z"/><path d="M12 9v5M12 17h.01"/></svg>',
  high:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  med:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  low:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>'};
let alerts=[];          // populated from REAL backend alerts (agent_alerts) + live ML scans
const seenOnScreen=new Set();
const evidence={};      // real evidence bundles keyed by alert id (none synthetic)
const evIco={mem:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 6V3M16 6V3M9 18v3M15 18v3"/></svg>',
  db:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.6 3.6 3 8 3s8-1.4 8-3V6"/></svg>',
  json:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2"/></svg>',
  img:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/></svg>',
  pcap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/></svg>'};

let filter='all', selected=0;
const alertsEl=document.getElementById('alerts');
function visible(){return filter==='all'?alerts:alerts.filter(a=>filter==='new'?a.st==='new'&&!seenOnScreen.has(a.realId||a.id):a.sev===filter);}
function renderAlerts(){
  const list=visible(), e=CF.esc;
  if(!list.includes(alerts[selected]))selected=list.length?alerts.indexOf(list[0]):-1; // alert fields come from the backend and the live feed: text, never markup (SEC-05)
  alertsEl.innerHTML=list.map((a)=>{
    const gi=alerts.indexOf(a);
    return '<div class="al '+e(a.sev)+(gi===selected?' sel':'')+'" data-i="'+gi+'"><span class="edge"></span>'+
    '<span class="sev">'+(sevIco[a.sev]||'')+'</span><div class="ainfo"><div class="at">'+e(a.t)+'</div>'+
    '<div class="am"><span>'+e(a.id)+'</span><span>'+e(a.host)+'</span><span>'+e(a.rule)+'</span></div></div>'+
    '<span class="astat '+e(a.st)+'">'+e(String(a.st).toUpperCase())+(seenOnScreen.has(a.realId||a.id)?' · SEEN HERE':'')+'</span></div>';
  }).join('') || ('<div style="padding:30px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:11px">'+(alerts.length?'No alerts match this filter':'No active alerts — queue is clear')+'</div>');
  alertsEl.querySelectorAll('.al').forEach(el=>el.addEventListener('click',()=>{selected=+el.dataset.i;renderAlerts();renderDetail();}));
}
function renderDetail(){
  const a=alerts[selected], e=CF.esc; if(!a){document.getElementById('adet').innerHTML='';renderEvidence(null);return;}
  document.getElementById('adet').innerHTML=
    '<div class="dh"><span class="di">'+(sevIco[a.sev]||'')+'</span><div><div class="dt">'+e(a.t)+'</div><div class="dm">'+e(a.id)+' · '+e(a.rule)+'</div></div></div>'+
    '<div><div class="drow"><span class="k">Severity</span><span class="v pill '+(a.sev==='crit'?'crit':a.sev==='low'?'low':'med')+'">'+e(String(a.sev).toUpperCase())+'</span></div>'+
    '<div class="drow"><span class="k">Host</span><span class="v">'+e(a.host)+'</span></div>'+
    '<div class="drow"><span class="k">Source</span><span class="v">'+e(a.src)+'</span></div>'+
    '<div class="drow"><span class="k">MITRE</span><span class="v" style="color:var(--amber-2)">'+e(a.mitre)+'</span></div>'+
    '<div class="drow"><span class="k">Score</span><span class="v" style="color:var(--cyan)">'+e(a.conf||'not given')+'</span></div>'+
    '<div class="drow"><span class="k">Status</span><span class="v"><span class="astat '+e(a.st)+'">'+e(String(a.st).toUpperCase())+(seenOnScreen.has(a.realId||a.id)?' · SEEN HERE':'')+'</span></span></div></div>'+
    '<div class="ag-note" style="font-family:var(--mono);font-size:9.5px;color:var(--faint);padding:4px 0">'+(a.realId?('State: '+e(String(a.wf||'new').replace(/_/g,' '))+' · saved for your account and audited'):'A live alert not yet stored: Acknowledge and Escalate mark it on this screen only.')+'</div>'+
    '<div class="dactions"><div class="abtn ack" data-act="ack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>Acknowledge</div>'+
    '<div class="abtn esc" data-act="esc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>Escalate</div></div>';
  document.querySelectorAll('#adet .abtn').forEach(b=>b.addEventListener('click',()=>{
    const target=alerts[selected], action=b.dataset.act==='ack'?'acknowledge':'escalate';
    // a stored alert's decision is saved and audited (DET-02); a live one not yet stored stays on this screen
    if(target.realId){
      CF.invoke('alert_state',{alertId:target.realId,action:action,note:null})
        .then(r=>{ target.wf=r.workflowState; target.st=r.workflowState==='escalated'?'esc':'ack'; renderAlerts(); renderDetail(); if(CF.toast) CF.toast('Saved: '+r.workflowState,'ok'); })
        .catch(err=>{ if(CF.toast) CF.toast(String((err&&err.message)||err),'error'); });
      return;
    }
    target.st=b.dataset.act==='ack'?'ack':'esc'; renderAlerts(); renderDetail();
  }));
  renderEvidence(a.realId||a.id);
}
function renderEvidence(id){
  // only evidence that was stored for this alert; none is invented
  const items=evidence[id]||[];
  document.getElementById('evCount').textContent=items.length+' items';
  const kev=document.getElementById('kEv'); if(kev) kev.textContent=items.length;
  const h=CF.esc;
  if(!items.length){ document.getElementById('evid').innerHTML='<div style="padding:18px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:10.5px">No linked evidence. Open Findings or Incidents to inspect stored evidence for those records.</div>'; return; }
  document.getElementById('evid').innerHTML=items.map(e=>
    '<div class="ev"><span class="ei">'+(evIco[e[3]]||'')+'</span><div class="einfo"><div class="en">'+h(e[0])+'</div><div class="em">'+h(e[1])+' · sha '+h(e[2])+'</div></div>'+
    '<span class="dl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></span></div>').join('');
}
renderAlerts(); renderDetail();
['kOpen','kCrit'].forEach(function(id){var e=document.getElementById(id); if(e)e.textContent='0';});
(function(){var oc=document.getElementById('openc'); if(oc)oc.textContent='0 open'; var ec=document.getElementById('evCount'); if(ec)ec.textContent='0 items';})();
document.querySelectorAll('#qfilters .qf').forEach(q=>q.addEventListener('click',()=>{
  document.querySelectorAll('#qfilters .qf').forEach(x=>x.classList.remove('on'));q.classList.add('on');filter=q.dataset.f;renderAlerts();renderDetail();
}));

// (no synthetic alert stream — alerts arrive from agent_alerts + live ML scans below)

// Ack All
document.querySelector('.btn-refresh').addEventListener('click',()=>{alerts.forEach(a=>seenOnScreen.add(a.realId||a.id));renderAlerts();renderDetail();if(CF.toast)CF.toast('Marked seen in this window. Stored workflow states are unchanged.','ok');});

// ===== REAL alert queue — agent_alerts (backend, when signed in) =====
function sevToCls(s){ s=String(s||'').toLowerCase();
  return s==='critical'?'crit':(s==='high'?'high':(s==='low'?'low':'med')); }
async function loadRealAlerts(){
  try{
    const r=await CF.invoke('agent_alerts'); const d=(r&&r.data)||{}; const list=d.alerts||[];
    {
      const chosen=(alerts[selected]||{}).realId||(alerts[selected]||{}).id;
      const mapped=list.map((a,i)=>({
        id:String(a.alert_id||a.$id||a.id||('live-'+i)),
        sev:sevToCls(a.severity),
        t:a.description||a.source||'Alert',
        host:a.deviceId||'desktop', rule:a.source||'agent',
        realId:a.alert_id||a.$id||null, wf:a.workflowState||'new',
        st:a.workflowState==='escalated'?'esc':(a.workflowState&&a.workflowState!=='new')?'ack':'new',
        mitre:'—', src:a.source||'agent',
        conf:(a.confidence!=null?Math.round(a.confidence*100)+'% confidence':(a.riskScore!=null?'risk '+a.riskScore+'/100':''))
      }));
      alerts.length=0; mapped.forEach(m=>alerts.push(m)); selected=Math.max(0,alerts.findIndex(a=>(a.realId||a.id)===chosen));
      renderAlerts(); renderDetail();
      const ko=document.getElementById('kOpen'); if(ko) ko.textContent=alerts.filter(a=>a.st==='new').length;
      const oc=document.getElementById('openc'); if(oc) oc.textContent=alerts.length+' open';
      const kc=document.getElementById('kCrit'); if(kc) kc.textContent=alerts.filter(a=>a.sev==='crit'&&a.st==='new').length;
    }
  }catch(e){ /* not signed in / preview → keep seed */ }
}
loadRealAlerts(); setInterval(loadRealAlerts,30000);

// Real-time: prepend live ML alerts/threats straight from the SSE feed.
function cfLiveAlert(d){
  if(!d) return;
  const sev=(d.severity==='high'||d.severity==='critical')?'crit':(d.severity==='low'?'low':'med');
  alerts.unshift({ id:'ALT-'+String(Date.now()).slice(-5), st:'new', sev,
    t:d.message||((d.verdict||'Threat')+' — '+(d.url||d.indicator||'')),
    host:'desktop', rule:d.category||'Agents scan', mitre:'—',
    src:d.url||d.indicator||'agent', conf:(d.riskScore!=null?'risk '+d.riskScore+'/100':'') });
  if(selected>=0) selected++;
  renderAlerts();
  const ko=document.getElementById('kOpen'); if(ko) ko.textContent=alerts.filter(a=>a.st==='new').length;
  const oc=document.getElementById('openc'); if(oc) oc.textContent=alerts.length+' open';
  const kc=document.getElementById('kCrit'); if(kc) kc.textContent=alerts.filter(a=>a.sev==='crit'&&a.st==='new').length;
}
window.addEventListener('cf:alert', e=>cfLiveAlert(e.detail));
window.addEventListener('cf:threat', e=>cfLiveAlert(e.detail));
