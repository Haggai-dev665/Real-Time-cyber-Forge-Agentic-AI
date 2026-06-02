/* ============================================================
   CyberForge — SIDEBAR component (shared across all screens)
   Usage:  <aside class="sidebar" id="sidebar"></aside>
           buildSidebar('overview')   // active key
   ============================================================ */
(function(){
  const I={
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/></svg>',
    chev:'<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>',
    globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>',
    box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>',
    nodes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.5 7.5 11 16M16.5 7.5 13 16M8 6h8"/></svg>',
    branch:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    brain:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a4 4 0 0 0-4 4 4 4 0 0 0-1 7 4 4 0 0 0 5 4 4 4 0 0 0 5-4 4 4 0 0 0-1-7 4 4 0 0 0-4-4Z"/></svg>',
    flow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 6 4-12 2 6h6"/></svg>',
    cpu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
    history:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
    sliders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
    bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    timeline:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><path d="M5 8v8M9 6h11M9 18h7M9 12h9"/></svg>',
    doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>'
  };
  const ic={
    ingest:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    db:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.6 3.6 3 8 3s8-1.4 8-3V6"/></svg>'
  };

  function navItem(o,active){
    const a=active===o.k?' active':'';
    const tag=o.tag?'<span class="tag '+o.tag.c+'">'+o.tag.t+'</span>':'';
    return '<a class="nav-item'+a+'" href="'+(o.href||'#')+'">'+o.icon+'<span class="lbl">'+o.label+'</span>'+tag+'</a>';
  }
  function sub(label,href,opts){
    opts=opts||{};
    const on=opts.on?' on':'';
    const badge=opts.badge!==undefined?'<span style="margin-left:auto;font-size:9px;color:var(--faint)">'+opts.badge+'</span>':'';
    return '<a class="subitem'+on+'" href="'+(href||'#')+'"><span class="pip"></span>'+label+badge+'</a>';
  }
  function secHead(label,icon,chev){
    return '<div class="nav-sec">'+(icon||'')+' '+label+(chev?' '+I.chev:'')+'</div>';
  }

  window.buildSidebar=function(active){
    let h='';
    // INTELLIGENCE
    h+=secHead('INTELLIGENCE',I.shield,true);
    h+=navItem({k:'overview',label:'Threat Overview',href:'Threat Overview.html',icon:I.clock},active);
    h+=navItem({k:'globe',label:'Threat Globe',href:'Threat Globe.html',icon:I.globe,tag:{t:'LIVE',c:'live'}},active);
    h+=navItem({k:'sandbox',label:'Sandbox',href:'Sandbox.html',icon:I.box,tag:{t:'NEW',c:'new'}},active);
    h+=navItem({k:'browser',label:'Browser Intelligence',href:'Browser Intelligence.html',icon:I.globe,tag:{t:'0',c:'zero'}},active);
    h+=navItem({k:'assistant',label:'AI Assistance',href:'AI Assistance.html',icon:I.spark,tag:{t:'AI',c:'ai'}},active);
    h+=navItem({k:'orchestrator',label:'8-Agent Orchestrator',href:'#',icon:I.nodes,tag:{t:'8',c:'num'}},active);
    h+=navItem({k:'pipeline',label:'Signal Pipeline',href:'Signal Pipeline.html',icon:I.flow},active);

    // MODEL INFERENCE
    h+=secHead('MODEL INFERENCE',I.cpu,false);
    h+='<div class="subnav">'+
      sub('Active Models','Model Inference.html',{on:true})+
      sub('Training','Model Inference.html')+
      sub('Datasets','Model Inference.html')+'</div>';

    // AGENT SYSTEM
    h+=secHead('AGENT SYSTEM',I.branch,true);
    h+=navItem({k:'agentcore',label:'Agent Core',href:'Agent Core.html',icon:I.branch,tag:{t:'ACTIVE',c:'act'}},active);
    h+=navItem({k:'tasks',label:'Active Tasks',href:'#',icon:I.check,tag:{t:'0',c:'zero'}},active);
    h+=navItem({k:'scheduled',label:'Scheduled',href:'Scheduled.html',icon:I.cal},active);
    h+=navItem({k:'memory',label:'Memory',href:'Memory.html',icon:I.brain},active);

    // HTTP HISTORY
    h+=secHead('HTTP HISTORY',I.history,false);
    h+='<div class="subnav">'+
      sub('HTTP History','Browser Intelligence.html')+
      sub('WebSocket','Browser Intelligence.html')+
      sub('Intercept','Browser Intelligence.html',{badge:'5'})+'</div>';
    h+=navItem({k:'floating',label:'Floating Agent Center',href:'#',icon:I.sliders},active);

    // SECURITY OPERATIONS
    h+=secHead('SECURITY OPERATIONS',I.bell,true);
    h+=navItem({k:'alerts',label:'Alerts & Evidence',href:'Alerts & Evidence.html',icon:I.bell,tag:{t:'0',c:'zero'}},active);
    h+='<div class="subnav">'+
      sub('Critical','Alerts & Evidence.html',{badge:'0'})+
      sub('High','Alerts & Evidence.html')+
      sub('Evidence','Alerts & Evidence.html')+'</div>';
    h+=navItem({k:'invest',label:'Investigations',href:'Investigations.html',icon:I.search},active);
    h+='<div class="subnav">'+sub('Active','Investigations.html',{on:true})+sub('Closed','Investigations.html')+'</div>';
    h+=navItem({k:'incident',label:'Incident Timeline',href:'Incident Timeline.html',icon:I.timeline},active);
    h+='<div class="subnav">'+sub('Today','Incident Timeline.html',{on:true})+sub('This Week','Incident Timeline.html')+'</div>';

    // REPORTS
    h+=secHead('REPORTS',I.doc,true);
    h+=navItem({k:'reports',label:'Reports',href:'Reports.html',icon:I.doc,tag:{t:'12',c:'num'}},active);
    h+='<div class="subnav">'+
      sub('Generated','Reports.html',{on:true})+
      sub('Templates','Reports.html')+
      sub('Scheduled Reports','Reports.html')+'</div>';

    const el=document.getElementById('sidebar');
    if(el) el.innerHTML=h;
  };
})();
