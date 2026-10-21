/* pages/incident-timeline.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'INCIDENT'});
buildSidebar('incident');
buildFooter({items:[{txt:'incident timeline',cls:'sb-amber'},{txt:'your threats',cls:'sb-cyan'},{txt:'refreshes every 30 s',cls:'sb-green'}]});
fitWindow('win');

/* time since detection — shown only when a real incident is active */
(function(){ var ck=document.getElementById('ck'); if(ck) ck.textContent='—'; })();

/* event feed */
const evIco={crit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 10 18H2Z"/><path d="M12 9v5M12 17h.01"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>'};
const seed=[];   // populated from REAL backend threats/alerts (loadIncidents)
const feed=document.getElementById('feed');
function evRow(e){
  // titles, descriptions and phases come from backend threats: text, never markup (SEC-05)
  const c=e[2]||e[1], h=CF.esc;
  return '<div class="tev '+h(c)+'"><span class="ttime">'+h(e[0])+'</span><span class="tnode">'+(evIco[c]||'')+'</span>'+
    '<div class="ttx"><b>'+h(e[3]||e[2])+'</b><div class="td">'+h(e[4]||e[3])+'</div><div class="tm">source: '+h(e[5]||e[4])+'</div></div></div>';
}
function render(){
  if(!seed.length){ feed.innerHTML='<div style="padding:34px 20px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:11px">No incidents recorded<br><span style="font-size:9px">events appear here as the agent confirms threats &amp; alerts</span></div>'; return; }
  feed.innerHTML='<div class="daygroup">Selected incident · most recent events</div>'+seed.map(evRow).join('');
}
render();

// Incidents (DET-02): the account's findings grouped by host, each with one
// timeline. Choosing one shows its timeline in the event feed; Resolve resolves
// each of its open findings through the audited workflow.
let INCIDENTS=[], CHOSEN=decodeURIComponent(location.hash.slice(1))||null;
function renderRecent(){
  const box=document.getElementById('incs'); if(!box) return;
  box.textContent='';
  if(!INCIDENTS.length){ const e=document.createElement('div'); e.style.cssText='padding:18px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:10.5px'; e.textContent='No incidents in the last 30 days.'; box.appendChild(e); return; }
  INCIDENTS.slice(0,12).forEach(inc=>{
    const r=document.createElement('div'); r.style.cssText='padding:9px 12px;border-top:1px solid var(--border);font-size:11.5px;cursor:pointer'+(inc.incidentId===CHOSEN?';background:rgba(43,212,238,.06)':'');
    const t=document.createElement('div'); t.style.color='var(--text)'; t.textContent=inc.host+' · '+inc.findings.length+' finding'+(inc.findings.length===1?'':'s');
    const m=document.createElement('div'); m.style.cssText='font-family:var(--mono);font-size:9.5px;color:var(--faint);margin-top:2px';
    m.textContent=inc.severity+' · '+inc.state+' · seen '+inc.occurrences+'× · last '+new Date(inc.lastSeenAt).toLocaleString()+' · '+(inc.evidence||[]).length+' evidence item'+((inc.evidence||[]).length===1?'':'s');
    r.appendChild(t); r.appendChild(m);
    if((inc.evidence||[]).length){
      const ex=document.createElement('button'); ex.className='btn-refresh'; ex.style.cssText='margin-top:6px;margin-right:6px'; ex.textContent='Export evidence';
      ex.title='Saves the stored evidence about this host, with a signed manifest, to Downloads';
      ex.addEventListener('click',ev=>{ ev.stopPropagation(); ex.disabled=true;
        CF.invoke('incident_evidence',{incidentId:inc.incidentId})
          .then(x=>{ if(CF.toast) CF.toast(x.saved?('Saved '+x.items+' item'+(x.items===1?'':'s')+(x.signed?' with a signed manifest':'')+' to '+x.path):'No stored evidence','ok'); })
          .catch(err=>{ if(CF.toast) CF.toast(String((err&&err.message)||err),'error'); }).then(()=>{ ex.disabled=false; }); });
      r.appendChild(ex);
    }
    r.addEventListener('click',()=>{ CHOSEN=inc.incidentId;history.replaceState(null,'','#'+encodeURIComponent(CHOSEN)); showIncident(inc); renderRecent(); });
    if(inc.state==='open'){
      const b=document.createElement('button'); b.className='btn-refresh'; b.style.marginTop='6px'; b.textContent='Resolve incident ('+inc.openFindings+' open)';
      b.addEventListener('click',ev=>{ ev.stopPropagation(); b.disabled=true;
        CF.invoke('incident_resolve',{incidentId:inc.incidentId,note:null})
          .then(x=>{ if(CF.toast) CF.toast(x.resolved.length+' finding'+(x.resolved.length===1?'':'s')+' resolved','ok'); return loadIncidentGroups(); })
          .catch(err=>{ if(CF.toast) CF.toast(String((err&&err.message)||err),'error'); b.disabled=false; }); });
      r.appendChild(b);
    }
    box.appendChild(r);
  });
}
function showIncident(inc){
  seed.length=0;
  inc.timeline.slice().reverse().slice(0,14).forEach(e=>{
    const d=new Date(e.at); const ts=d.toLocaleString();
    seed.push([ts,'info','info',e.event,(e.details||'')+' · '+e.threatId,inc.host]);
  });
  render();
  const head=document.querySelector('.phase-head b'); if(head) head.textContent='Incident on '+inc.host+' · '+inc.state;
  const ckm=document.querySelector('.ckm'); if(ckm) ckm.textContent=inc.state==='open'?'Open incident':'Closed incident';
  const ck=document.getElementById('ck'); if(ck){ const ms=Date.now()-new Date(inc.firstSeenAt).getTime(); const h=Math.floor(ms/3600000), mi=Math.floor(ms/60000)%60; ck.textContent=inc.state==='open'?(h+'h '+String(mi).padStart(2,'0')+'m'):'—'; }
}
async function loadIncidentGroups(){
  try{
    const r=await CF.invoke('incidents_list'); INCIDENTS=(r&&r.incidents)||[];
    const chosen=INCIDENTS.find(i=>i.incidentId===CHOSEN)||(CHOSEN?null:INCIDENTS[0]);
    if(chosen){CHOSEN=chosen.incidentId;showIncident(chosen);}else{seed.length=0;render();const head=document.querySelector('.phase-head b');if(head)head.textContent=CHOSEN?'Selected incident is no longer available':'Select an incident';}
    renderRecent();
    const kv=document.querySelectorAll('.kpi .kv');
    if(kv[0])kv[0].textContent=INCIDENTS.filter(i=>i.state==='open').length;
    if(kv[1])kv[1].textContent=INCIDENTS.filter(i=>i.state!=='open').length;
    if(kv[2])kv[2].textContent=INCIDENTS.length;
    const oc=document.getElementById('openCount'); if(oc) oc.textContent=INCIDENTS.filter(i=>i.state==='open').length+' open incidents';
  }catch(e){document.getElementById('openCount').textContent='Refresh unavailable';document.getElementById('incs').textContent='Could not load incidents: '+String(e.message||e);}
}
const toReports=document.getElementById('toReports'); if(toReports) toReports.addEventListener('click',()=>{ location.href='reports.html'; });
loadIncidentGroups(); setInterval(loadIncidentGroups,30000);
['cf:threat','cf:alert'].forEach(name=>window.addEventListener(name,loadIncidentGroups));
