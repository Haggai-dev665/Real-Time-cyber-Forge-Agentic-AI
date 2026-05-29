/* ============================================================
   CyberForge — HEADER (top bar) component
   Usage:  <div class="topbar" id="topbar"></div>
           buildHeader({ search, status, chips, threats, cta })
   ============================================================ */
(function(){
  const bolt='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>';
  const bell='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
  const moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>';
  const gear='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.4H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8Z"/></svg>';
  const user='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const shield='<svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/></svg>';
  const MARK='<svg class="cf-mark" viewBox="0 0 60 60" fill="none"><rect x="1" y="1" width="58" height="58" fill="none" stroke="var(--cream)" stroke-width="2"></rect><path d="M15 45 L30 13 L45 45 Z" fill="var(--brand-orange)"></path><path d="M23 45 L30 29 L37 45 Z" fill="#0e1420"></path><circle class="sage" cx="30" cy="45" r="3.2" fill="var(--sage)"></circle></svg>';
  const searchI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const threatI='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/></svg>';

  window.buildHeader=function(o){
    o=o||{};
    const search=o.search||'Search threats, IPs, domains, assets…';
    const status=o.status||'MONITORING';
    const chips=(o.chips!==undefined)?o.chips:
      '<div class="tb-chip"><span class="dot rec"></span>REC</div>'+
      '<div class="tb-chip"><span class="dot" style="background:var(--green)"></span>ON</div>';
    const cta=o.cta||'Quick Scan';
    const threats=o.threats?('<div class="pill-threats" id="tbThreats">'+threatI+' '+o.threats+' threats</div>'):'';
    const html=
      '<div class="lights"><i class="r"></i><i class="y"></i><i class="g"></i></div>'+
      '<div class="brand"><a class="logo-mark" href="threat-overview.html">'+MARK+'</a><div class="name"><b>Cyber<span class="fg">Forge</span></b><span>AI SECURITY</span></div></div>'+
      '<div class="tb-group">'+chips+'</div>'+
      '<div class="search">'+searchI+search+'<span class="kbd">⌘K</span></div>'+
      '<div class="tb-status"><div class="spinner sm"></div>'+status+'</div>'+
      threats+
      '<button class="btn-scan">'+bolt+cta+'</button>'+
      '<button class="icon-btn"><span class="badge"></span>'+bell+'</button>'+
      '<button class="icon-btn">'+moon+'</button>'+
      '<button class="icon-btn">'+gear+'</button>'+
      '<div class="avatar">'+user+'</div>';
    const el=document.getElementById('topbar');
    if(el){ el.className='topbar'; el.innerHTML=html;
      el.querySelectorAll('.btn-scan,.icon-btn,.avatar').forEach(b=>{
        if(window.attachRipple && b.classList.contains('btn-scan')) attachRipple(b);
      });
    }
  };
})();
