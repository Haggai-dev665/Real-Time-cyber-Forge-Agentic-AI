/* pages/investigations.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'INVESTIGATING'});
buildSidebar('invest');
buildFooter({items:[{txt:'investigations',cls:'sb-amber'},{txt:'stored findings',cls:'sb-cyan'},{txt:'refreshes every 30 s',cls:'sb-green'}]});
fitWindow('win');

const cases=[];   // built from REAL backend threats (loadInvestigations / get_threats)
const entIco={host:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="9" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
  domain:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/></svg>',
  file:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>',
  ip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>'};
const stepIco={done:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>',
  active:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>',
  todo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>'};

let tab='active', selected=0;
function visibleCases(){return cases.filter(c=>c.st===tab);}
function renderCases(){
  const list=visibleCases();
  if(!list[selected]) selected=0;
  const e=CF.esc; // case fields come from backend threats: text, never markup (SEC-05)
  document.getElementById('cases').innerHTML=list.map((c,i)=>
    '<div class="cs'+(i===selected?' sel':'')+'" data-i="'+i+'"><div class="ct">'+e(c.n)+' <span class="cstat '+(c.st==='closed'?'closed':'active')+'">'+e(String(c.st).toUpperCase())+'</span></div>'+
    '<div class="cm"><span class="pill '+(c.sev==='crit'?'crit':c.sev==='low'?'low':'med')+'">'+e(String(c.sev).toUpperCase())+'</span><span>'+e(c.id)+'</span><span>'+e(c.alerts)+' alerts</span><span>'+e(c.opened)+'</span></div>'+
    '</div>').join('') || '<div style="padding:30px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:11px">No '+e(tab)+' findings</div>';
  document.querySelectorAll('#cases .cs').forEach(el=>el.addEventListener('click',()=>{selected=+el.dataset.i;history.replaceState(null,'','#'+encodeURIComponent(visibleCases()[selected].id));renderCases();renderCase();}));
}
function renderCase(){
  const c=visibleCases()[selected]; if(!c){document.getElementById('cdHead').innerHTML='';document.getElementById('steps').innerHTML='';const acts=document.getElementById('caseActs');if(acts)acts.remove();return;}
  const e=CF.esc;
  document.getElementById('cdHead').innerHTML=
    '<span class="ci '+(c.run?'run':'')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>'+
    '<div class="cinfo"><div class="cn">'+e(c.n)+'</div><div class="cmeta"><span>'+e(c.id)+'</span><span>'+e(c.assignee)+'</span><span>'+e(c.alerts)+' linked alerts</span><span class="pill '+(c.sev==='crit'?'crit':c.sev==='low'?'low':'med')+'">'+e(String(c.sev).toUpperCase())+'</span></div></div>'+
    '<div style="text-align:right;font-family:var(--mono)"><div style="font-size:22px;font-weight:600;color:var(--amber-2)">'+e(c.status.replace(/_/g,' '))+'</div><div style="font-size:9px;color:var(--faint);letter-spacing:1px">FINDING STATE</div></div>';
  document.getElementById('steps').innerHTML=c.steps.map(s=>
    '<div class="step '+e(s[0])+'"><span class="sn">'+(stepIco[s[0]]||'')+'</span><div class="stx"><b>'+e(s[1])+'</b><div class="sd">'+e(s[2])+'</div><div class="stime">'+e(s[3])+'</div></div></div>').join('');
  document.getElementById('entities').innerHTML=c.ents.map(n=>
    '<div class="ent"><span class="eni" style="color:'+(n[2]==='c2'||n[2]==='phishing'||n[2]==='payload'?'#ff7185':'var(--cyan)')+'">'+(entIco[n[0]]||'')+'</span><span class="enn">'+e(n[1])+'</span><span class="ent-type">'+e(String(n[2]).toUpperCase())+'</span></div>').join('');
  document.getElementById('iocs').innerHTML=c.iocs.map(i=>'<span class="ioc-pill"><span class="d"></span>'+e(i)+'</span>').join('');
  renderActions(c);
}

/* The finding's workflow (DET-02): only the steps its state allows; each is
   checked, kept in its timeline and audited by the backend. */
const NEXT={ detected:['acknowledge','investigate','resolve','false_positive'], acknowledged:['investigate','resolve','false_positive'],
  investigating:['resolve','false_positive'], confirmed:['investigate','resolve','false_positive'],
  resolved:['reopen'], false_positive:['reopen'], dismissed:['reopen'], mitigated:['reopen'] };
const LABEL={ acknowledge:'Acknowledge', investigate:'Investigate (assign to me)', resolve:'Resolve', false_positive:'False positive', reopen:'Reopen' };
function renderActions(c){
  const host=document.getElementById('steps').parentElement; if(!host) return;
  let box=document.getElementById('caseActs');
  if(!box){ box=document.createElement('div'); box.id='caseActs'; box.style.cssText='display:flex;flex-wrap:wrap;gap:8px;padding:10px 0'; host.appendChild(box); }
  box.textContent='';
  const note=document.createElement('div'); note.style.cssText='width:100%;font-family:var(--mono);font-size:10px;color:var(--faint)';
  if(!c.threatId){ note.textContent='This one comes from the agent alerts, which have no workflow yet.'; box.appendChild(note); return; }
  note.textContent='State: '+c.status.replace(/_/g,' ')+' · seen '+c.occurrences+' time'+(c.occurrences===1?'':'s')+' · severity stays as detected';
  box.appendChild(note);
  if(c.guidance){
    const g=document.createElement('div'); g.style.cssText='width:100%;font-size:11.5px;color:var(--dim);line-height:1.5';
    const why=document.createElement('div'); why.textContent='Why this matters: '+c.guidance.whyItMatters;
    const nxt=document.createElement('div'); nxt.textContent='Next step: '+c.guidance.nextStep;
    g.appendChild(why); g.appendChild(nxt); box.appendChild(g);
  }
  (NEXT[c.status]||[]).forEach(action=>{
    const b=document.createElement('button'); b.className='btn-refresh'; b.textContent=LABEL[action];
    b.addEventListener('click',()=>{ b.disabled=true;
      CF.invoke('finding_state',{threatId:c.threatId,action:action,note:null})
        .then(()=>{ if(CF.toast) CF.toast(LABEL[action]+': done','ok'); return loadInvestigations(); })
        .catch(err=>{ if(CF.toast) CF.toast(String((err&&err.message)||err),'error'); b.disabled=false; }); });
    box.appendChild(b);
  });
  // an exception for this category and target, on this account only, with a reason and an expiry
  if(c.status!=='excepted'){
    const form=document.createElement('form'); form.style.cssText='width:100%;display:flex;gap:6px;align-items:center;margin-top:4px';
    const reason=document.createElement('input'); reason.placeholder='Reason this target is expected'; reason.maxLength=500; reason.style.cssText='flex:1;min-width:0'; reason.setAttribute('aria-label','Exception reason');
    const days=document.createElement('select'); [7,30,90].forEach(d=>{ const o=document.createElement('option'); o.value=d; o.textContent=d+' days'; days.appendChild(o); }); days.setAttribute('aria-label','Exception length');
    const go=document.createElement('button'); go.type='submit'; go.className='btn-refresh'; go.textContent='Except this target';
    form.appendChild(reason); form.appendChild(days); form.appendChild(go);
    form.addEventListener('submit',ev=>{ ev.preventDefault(); go.disabled=true;
      CF.invoke('finding_exception',{threatId:c.threatId,reason:reason.value,days:+days.value})
        .then(x=>{ if(CF.toast) CF.toast('Exception until '+new Date(x.expiresAt).toLocaleDateString()+': later detections up to '+x.maxSeverity+' are recorded, not raised','ok'); })
        .catch(err=>{ if(CF.toast) CF.toast(String((err&&err.message)||err),'error'); }).then(()=>{ go.disabled=false; }); });
    box.appendChild(form);
  }
}
renderCases(); renderCase();
// counts fill from get_threats; Mean Resolve has no source and stays "—"
document.querySelectorAll('#tabs .tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('#tabs .tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');tab=t.dataset.t;selected=0;renderCases();renderCase();
}));

// ===== REAL cases — built from live threats (get_threats) =====
function threatToCase(x,i){
  const det=x.detection||{}; const sev=String(x.severity||'medium').toLowerCase();
  const sv=sev==='critical'?'crit':(sev==='high'?'high':(sev==='low'?'low':'med'));
  const st=['resolved','dismissed','mitigated','false_positive','closed'].includes(String(x.status||'').toLowerCase())?'closed':'active';
  const ind=x.indicator||x.url||'';
  const etype=/^https?:/.test(ind)?'domain':(/^[0-9.]+$/.test(ind)?'ip':(/^[a-f0-9]{32,}$/i.test(ind)?'file':'domain'));
  // Only what the threat records: no assignee, progress or mitigation is invented.
  const risk=(x.riskScore!=null?x.riskScore:null);
  const opened=new Date(det.timestamp||x.createdAt||0);
  const steps=[
    ['done','Detection',((x.source||det.source||'a scan'))+' recorded '+(x.type||x.category||'a threat'),''],
    [risk!=null?'done':'todo','Risk',risk!=null?('risk score '+risk):'not scored',''],
    [st==='closed'?'done':'todo', st==='closed'?'Closed':'Response', st==='closed'?('marked '+String(x.status||'closed').replace(/_/g,' ')):'no response recorded yet','']
  ];
  return {
    id:String(x.threatId||x.id||x._id||'No stored ID'),
    n:(x.title||x.type||x.category||ind||'Threat'),
    sev:sv, st:st, 
    threatId:x.threatId||null, status:String(x.status||'detected'), occurrences:x.occurrences||1, guidance:x.guidance||null,
    assignee:(x.analysis&&x.analysis.analyst_assigned)?'assigned to you':'unassigned', alerts:(Array.isArray(x.indicators)?x.indicators.length:1),
    opened:isNaN(opened.getTime())||!opened.getTime()?'date unknown':opened.toLocaleString(), run:false,
    steps:steps,
    ents: ind?[[etype, ind, (x.category||'indicator')]]:[],
    iocs: [ind].filter(Boolean)
  };
}
async function loadInvestigations(){
  try{
    const r=await CF.invoke('get_threats'); const d=(r&&r.data)||{}; const arr=d.threats||[];
    {
      const chosen=(visibleCases()[selected]||{}).id||decodeURIComponent(location.hash.slice(1));
      cases.length=0; arr.map(threatToCase).forEach(c=>cases.push(c));
      const target=cases.find(c=>c.id===chosen);if(target)tab=target.st;
      document.querySelectorAll('#tabs .tab').forEach(t=>t.classList.toggle('on',t.dataset.t===tab));
      selected=Math.max(0,visibleCases().findIndex(c=>c.id===chosen)); renderCases(); renderCase();
      const kv=document.querySelectorAll('.kpi .kv');
      const open=cases.filter(c=>c.st==='active');
      if(kv[0]) kv[0].textContent=open.length;
      if(kv[1]) kv[1].textContent=cases.length-open.length;
      if(kv[2]) kv[2].textContent=(d.total||arr.length);
      const crit=open.filter(c=>c.sev==='crit').length;
      const kd=document.getElementById('kdActive'); if(kd) kd.textContent=crit+' critical';
      const ac=document.getElementById('activeCount'); if(ac) ac.textContent=open.length+' open';
    }
  }catch(e){document.getElementById('activeCount').textContent='Refresh unavailable';}
}
loadInvestigations(); setInterval(loadInvestigations,30000);
window.addEventListener('cf:threat', e=>{ const x=e.detail||{}; cases.unshift(threatToCase(x,cases.length));
  if(cases.length>40)cases.pop(); renderCases(); });
