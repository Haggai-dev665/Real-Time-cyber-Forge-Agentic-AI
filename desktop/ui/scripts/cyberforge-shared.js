/* ============================================================
   CyberForge — shared utilities (used by all screens)
   Sidebar / header / footer live in cf-sidebar.js / cf-header.js / cf-footer.js
   ============================================================ */
function fitWindow(id){
  const w=document.getElementById(id);
  function fit(){ const s=Math.min(window.innerWidth/1440, window.innerHeight/824); w.style.transform='scale('+s+')'; }
  window.addEventListener('resize',fit); fit();
}

function startClock(id){
  const el=document.getElementById(id); if(!el)return;
  let s=0; setInterval(()=>{ s++; const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
    el.textContent=h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); },1000);
}

/* ripple helper for buttons */
function attachRipple(el){
  el.addEventListener('click',e=>{
    const r=el.getBoundingClientRect(),s=document.createElement('span');s.className='ripple';
    const size=Math.max(r.width,r.height);s.style.width=s.style.height=size+'px';
    s.style.left=(e.clientX-r.left)+'px';s.style.top=(e.clientY-r.top)+'px';
    el.appendChild(s);setTimeout(()=>s.remove(),600);
  });
}

/* convenience: build the whole shell at once */
function buildShell(opts){
  opts=opts||{};
  if(window.buildHeader) buildHeader(opts.header||{});
  if(window.buildSidebar) buildSidebar(opts.active||'');
  if(window.buildFooter) buildFooter(opts.footer||{});
  if(opts.win) fitWindow(opts.win);
}
