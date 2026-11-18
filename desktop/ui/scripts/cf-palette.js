/* ============================================================
   CyberForge — command palette, tray hand-off, file-drop guard
   and notices. Loaded by every workspace page after the sidebar.

   Ctrl+K (or the button beside the search box) opens a palette
   of every page in the sidebar plus the common actions; typing
   filters it, Enter runs the selection. Everything here is built
   with DOM nodes and textContent: no outside text becomes HTML.
   ============================================================ */
(function(){
  if(window.__cfPalette) return; window.__cfPalette=true;

  var onAnalyzer=/analyzer\.html$/i.test(location.pathname);
  function el(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
  function go(href){ location.href=href; }

  /* ---------- notices ---------- */
  var host=null;
  function notice(message,actionLabel,action){
    if(!host){ host=el('div','cf-toasts'); host.setAttribute('role','status'); host.setAttribute('aria-live','polite'); document.body.appendChild(host); }
    var t=el('div','cf-toast'); t.appendChild(el('span','cf-toast-msg',message));
    if(actionLabel&&action){ var b=el('button','cf-toast-act',actionLabel); b.type='button'; b.addEventListener('click',function(){ dismiss(); action(); }); t.appendChild(b); }
    host.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('in'); });
    var timer=setTimeout(dismiss,5200);
    function dismiss(){ clearTimeout(timer); t.classList.remove('in'); t.classList.add('out'); setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },260); }
    return dismiss;
  }
  window.CFNotice=notice;

  /* ---------- scan a file: from the tray menu or anywhere ---------- */
  function scanFileAction(){ if(onAnalyzer) window.dispatchEvent(new Event('cf:scan-file')); else go('analyzer.html#scan-file'); }
  try{ if(window.CF&&CF.listen) CF.listen('cf-tray',function(p){ if(p&&p.action==='scan-file') scanFileAction(); }); }catch(e){}

  // With the window's own drag-and-drop off (so pages receive dropped files), a file
  // dropped on a page that does not take files would replace the page. It is stopped
  // here, and the user is pointed to Analyze.
  if(!onAnalyzer){
    var isFiles=function(e){ return !!(e.dataTransfer&&Array.prototype.indexOf.call(e.dataTransfer.types||[],'Files')>=0); };
    document.addEventListener('dragover',function(e){ if(isFiles(e)){ e.preventDefault(); e.dataTransfer.dropEffect='none'; } });
    document.addEventListener('drop',function(e){ if(!isFiles(e)) return; e.preventDefault(); notice('Files are scanned on the Analyze page.','Open Analyze',function(){ go('analyzer.html#scan-file'); }); });
  }

  /* ---------- palette ---------- */
  var RECENT_KEY='cf-palette-recent';
  function recent(){ try{ return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]').slice(0,5); }catch(e){ return []; } }
  function remember(id){ try{ var r=recent().filter(function(x){ return x!==id; }); r.unshift(id); localStorage.setItem(RECENT_KEY,JSON.stringify(r.slice(0,5))); }catch(e){} }
  function click(sel){ var b=document.querySelector(sel); if(b) b.click(); }
  function motionReduced(){ return document.documentElement.getAttribute('data-motion')==='reduce'; }

  function baseItems(){
    var items=[];
    document.querySelectorAll('#sidebar a.nav-item').forEach(function(a){
      var label=(a.getAttribute('aria-label')||a.textContent||'').trim(); if(!label) return;
      var sec=a.closest('.nav-group'); var group=sec&&sec.querySelector('.nav-sec');
      items.push({id:'page:'+a.getAttribute('href'),kind:'Page',label:label,hint:group?group.textContent.trim():'',current:a.classList.contains('active'),run:function(){ go(a.getAttribute('href')); }});
    });
    items.push(
      {id:'act:scan-file',kind:'Action',label:'Scan a file',hint:'Analyze',run:scanFileAction},
      {id:'act:lookup',kind:'Action',label:'Look up a domain',hint:'Top bar  /',run:function(){ var i=document.getElementById('cfSearch'); if(i){ i.focus(); i.select&&i.select(); } }},
      {id:'act:settings',kind:'Action',label:'Open settings',hint:'Account, privacy, status',run:function(){ click('.nav-settings'); }},
      {id:'act:sidebar',kind:'Action',label:'Collapse or expand the sidebar',hint:'Layout',run:function(){ click('.nav-toggle'); }},
      {id:'act:motion',kind:'Action',label:motionReduced()?'Turn animations back on':'Reduce animations',hint:'Display',run:function(){
        var on=!motionReduced();
        if(on) document.documentElement.setAttribute('data-motion','reduce'); else document.documentElement.removeAttribute('data-motion');
        try{ localStorage.setItem('cf-reduce-motion',on?'1':'0'); }catch(e){}
        notice(on?'Animations reduced.':'Animations on.');
      }},
      {id:'act:reload',kind:'Action',label:'Reload this page',hint:'',run:function(){ location.reload(); }}
    );
    return items;
  }
  function looksLikeIndicator(q){
    return /^https?:\/\//i.test(q)||/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(q)||/^(\d{1,3}\.){3}\d{1,3}$/.test(q)||/^[a-f0-9]{32}([a-f0-9]{8})?([a-f0-9]{24})?$/i.test(q);
  }
  // Higher is better; -1 hides the item. Whole-substring matches beat scattered letters.
  function score(label,q){
    var l=label.toLowerCase(); if(!q) return 0;
    var at=l.indexOf(q); if(at>=0) return 200-at-(l.length-q.length)*0.1;
    var i=0,gaps=0,last=-1;
    for(var k=0;k<l.length&&i<q.length;k++){ if(l[k]===q[i]){ if(last>=0) gaps+=k-last-1; last=k; i++; } }
    return i===q.length?100-gaps:-1;
  }

  var ov=null, input=null, list=null, shown=[], active=0, lastFocus=null;
  function build(){
    ov=el('div','cf-kbar'); ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','Command palette'); ov.hidden=true;
    var box=el('div','cf-kbar-box');
    var field=el('div','cf-kbar-field');
    input=el('input','cf-kbar-input'); input.type='text'; input.placeholder='Go to a page, run an action, or paste an address to analyse…';
    input.setAttribute('role','combobox'); input.setAttribute('aria-expanded','true'); input.setAttribute('aria-controls','cfKbarList'); input.setAttribute('autocomplete','off'); input.spellcheck=false;
    field.appendChild(input); field.appendChild(el('kbd','cf-kbar-esc','Esc'));
    list=el('div','cf-kbar-list'); list.id='cfKbarList'; list.setAttribute('role','listbox');
    var foot=el('div','cf-kbar-foot','↑ ↓ to move · Enter to run · Esc to close');
    box.appendChild(field); box.appendChild(list); box.appendChild(foot); ov.appendChild(box); document.body.appendChild(ov);
    ov.addEventListener('mousedown',function(e){ if(e.target===ov) close(); });
    input.addEventListener('input',render);
    input.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'){ e.preventDefault(); move(1); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); move(-1); }
      else if(e.key==='Enter'){ e.preventDefault(); runAt(active); }
      else if(e.key==='Escape'){ e.preventDefault(); close(); }
      else if(e.key==='Tab'){ e.preventDefault(); }
    });
  }
  function render(){
    var q=input.value.trim(), ql=q.toLowerCase(), items=baseItems();
    if(q){
      shown=items.map(function(it){ return {it:it,s:score(it.label,ql)}; }).filter(function(x){ return x.s>=0; })
        .sort(function(a,b){ return b.s-a.s; }).map(function(x){ return x.it; });
      if(looksLikeIndicator(q)) shown.unshift({id:'act:analyze',kind:'Analyze',label:'Analyze '+q,hint:'URL, domain, IP or hash',run:function(){ go('analyzer.html?q='+encodeURIComponent(q)); }});
    }else{
      var r=recent(); shown=items.slice().sort(function(a,b){ var ia=r.indexOf(a.id), ib=r.indexOf(b.id); return (ia<0?99:ia)-(ib<0?99:ib); });
    }
    active=0; list.textContent='';
    if(!shown.length){ list.appendChild(el('div','cf-kbar-empty','Nothing matches. Paste an address to analyse it.')); input.removeAttribute('aria-activedescendant'); return; }
    var r2=q?[]:recent();
    shown.forEach(function(it,i){
      var row=el('div','cf-kbar-row'); row.id='cfKbarRow'+i; row.setAttribute('role','option'); row.style.setProperty('--i',Math.min(i,10));
      row.appendChild(el('span','cf-kbar-kind cf-k-'+it.kind.toLowerCase(),it.kind));
      row.appendChild(el('span','cf-kbar-label',it.label));
      var meta=it.current?'You are here':(r2.indexOf(it.id)>=0?'Recent':it.hint);
      if(meta) row.appendChild(el('span','cf-kbar-hint',meta));
      row.addEventListener('mousemove',function(){ if(active!==i) select(i); });
      row.addEventListener('click',function(){ runAt(i); });
      list.appendChild(row);
    });
    select(0);
  }
  function select(i){
    var rows=list.querySelectorAll('.cf-kbar-row'); if(!rows.length) return;
    active=(i+rows.length)%rows.length;
    rows.forEach(function(r,k){ r.classList.toggle('on',k===active); r.setAttribute('aria-selected',k===active?'true':'false'); });
    input.setAttribute('aria-activedescendant','cfKbarRow'+active);
    rows[active].scrollIntoView({block:'nearest'});
  }
  function move(d){ select(active+d); }
  function runAt(i){ var it=shown[i]; if(!it) return; remember(it.id); close(); it.run(); }
  function open(){
    if(!ov) build();
    lastFocus=document.activeElement; ov.hidden=false; input.value=''; render();
    requestAnimationFrame(function(){ ov.classList.add('in'); input.focus(); });
  }
  function close(){
    if(!ov||ov.hidden) return;
    ov.classList.remove('in'); setTimeout(function(){ ov.hidden=true; },140);
    if(lastFocus&&lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
  }
  window.CFPalette={open:open,close:close};

  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='k'||e.key==='K')){ e.preventDefault(); e.stopImmediatePropagation(); if(ov&&!ov.hidden) close(); else open(); }
  },true);

  // A visible way in, beside the search box.
  var searchBox=document.getElementById('cfSearchBox');
  if(searchBox&&searchBox.parentNode&&!document.getElementById('cfKbarBtn')){
    var b=el('button','cf-kbar-btn'); b.id='cfKbarBtn'; b.type='button'; b.title='Command palette (Ctrl+K)'; b.setAttribute('aria-label','Open the command palette');
    b.appendChild(el('span','cf-kbar-btn-l','Commands')); b.appendChild(el('kbd',null,'Ctrl K'));
    b.addEventListener('click',open);
    searchBox.parentNode.insertBefore(b,searchBox.nextSibling);
  }
})();
