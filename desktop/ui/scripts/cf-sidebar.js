/* ============================================================
   CyberForge — SIDEBAR component (shared across all screens)
   Usage:  <aside class="sidebar" id="sidebar"></aside>
           buildSidebar('overview')   // active key
   ============================================================ */
(function(){
  if(!document.getElementById('cfNavigationStyles')){
    const css=document.createElement('link');css.id='cfNavigationStyles';css.rel='stylesheet';css.href='../styles/cf-navigation.css';document.head.appendChild(css);
  }
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

  const svg=body=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+body+'</svg>';
  I.dashboard=svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>');
  I.monitor=svg('<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5M8 21h8"/>');
  I.chat=svg('<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z"/><path d="M7 8h10M7 12h7"/>');
  I.browser=svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M7 5.5h.01M10 5.5h.01"/>');
  I.memory=svg('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>');
  I.gear=svg('<path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>');
  const groups=[
    ['Workspace',[
      ['overview','Overview','threat-overview.html',I.dashboard],
      ['devices','Devices','devices.html',I.monitor],
      ['agents','Agents','agents.html',I.nodes],
      ['assistant','AI Assistant','ai-assistance.html',I.chat]
    ]],
    ['Security',[
      ['analyzer','Analyze','analyzer.html',I.search],
      ['alerts','Alerts & Incidents','alerts-evidence.html',I.bell],
      ['security','Protection','security-functions.html',I.shield],
      ['reports','Reports','reports.html',I.doc]
    ]],
    ['Explore',[
      ['browser','Browser Activity','browser-intelligence.html',I.browser],
      ['globe','Threat Intelligence','threat-globe.html',I.globe]
    ]],
    // The pages of Settings > Diagnostics, and the assistant's saved memory.
    ['Diagnostics',[
      ['agentcore','Local runtime','agent-core.html',I.cpu],
      ['pipeline','Event stream','signal-pipeline.html',I.flow],
      ['models','Model capabilities','model-inference.html',I.brain],
      ['memory','Memory','memory.html',I.memory]
    ]]
  ];
  // Old URLs remain valid; related workflows share a parent and local navigation.
  const parents={sandbox:'analyzer',scheduled:'agents',history:'browser',invest:'alerts',incident:'alerts'};
  const tabs={
    agents:[['agents','Agents & runs','agents.html'],['scheduled','Schedules','scheduled.html']],
    browser:[['browser','Observed pages','browser-intelligence.html'],['history','History & scans','web-history.html']],
    alerts:[['alerts','Alerts','alerts-evidence.html'],['invest','Findings','investigations.html'],['incident','Incidents & timeline','incident-timeline.html']]
  };
  function link(item,active){
    const [key,label,href,icon]=item;
    return '<a class="nav-item'+(key===active?' active':'')+'" href="'+href+'" aria-label="'+label+'" title="'+label+'"'+(key===active?' aria-current="page"':'')+'>'+(icon||'')+'<span class="lbl">'+label+'</span></a>';
  }
  window.buildSidebar=function(active){
    const el=document.getElementById('sidebar'); if(!el)return;
    const parent=parents[active]||active;
    el.setAttribute('aria-label','Main navigation');
    el.innerHTML='<button type="button" class="nav-item nav-toggle" id="cfNavToggle" aria-controls="cfNavLinks">'+I.chev+'<span class="lbl">Collapse sidebar</span></button>'+
      '<nav id="cfNavLinks" class="nav-links" aria-label="Workspace destinations">'+groups.map(([label,items])=>'<div class="nav-sec">'+label+'</div>'+items.map(item=>link(item,parent)).join('')).join('')+'</nav>'+
      '<button type="button" id="cfNavSettings" class="nav-item nav-settings'+(parent==='settings'?' active':'')+'" aria-label="Settings" title="Settings" aria-haspopup="dialog">'+I.gear+'<span class="lbl">Settings</span></button>';
    el.querySelectorAll('svg').forEach(icon=>icon.setAttribute('aria-hidden','true'));
    const toggle=el.querySelector('#cfNavToggle');
    function setCollapsed(collapsed){
      el.classList.toggle('collapsed',collapsed);
      const body=el.closest('.body'); if(body)body.classList.toggle('sidebar-collapsed',collapsed);
      const label=collapsed?'Expand sidebar':'Collapse sidebar';
      toggle.setAttribute('aria-expanded',String(!collapsed)); toggle.setAttribute('aria-label',label); toggle.title=label;
      toggle.querySelector('.lbl').textContent=label;
    }
    let preference=null;try{preference=localStorage.getItem('cf_sidebar_collapsed');}catch(e){}
    let collapsed=preference===null?window.innerWidth<1100:preference==='true';
    window.addEventListener('resize',function(){if(preference===null)setCollapsed(window.innerWidth<1100);});
    setCollapsed(collapsed);
    toggle.addEventListener('click',function(){ collapsed=!el.classList.contains('collapsed');setCollapsed(collapsed);preference=String(collapsed);try{localStorage.setItem('cf_sidebar_collapsed',String(collapsed));}catch(e){}window.dispatchEvent(new Event('resize')); });
    el.querySelector('#cfNavSettings').addEventListener('click',()=>window.openCfSettings&&window.openCfSettings(['agentcore','pipeline','models'].includes(parent)?'diagnostics':'account'));
    const main=document.querySelector('main.main'), head=main&&main.querySelector('.main-head');
    if(main&&tabs[parent]){
      const previous=document.getElementById('cfWorkspaceTabs'); if(previous)previous.remove();
      const nav=document.createElement('nav');nav.id='cfWorkspaceTabs';nav.className='workspace-tabs';nav.setAttribute('aria-label','Related views');
      nav.innerHTML=tabs[parent].map(item=>link(item,active)).join('');
      if(head)head.after(nav);else main.prepend(nav);
    }
  };
})();
