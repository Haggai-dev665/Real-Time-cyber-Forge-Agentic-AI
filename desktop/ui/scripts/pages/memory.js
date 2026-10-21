/* pages/memory.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'MEMORY'});
buildSidebar('memory');
buildFooter({items:[{txt:'local vector store',cls:'sb-amber'},{txt:'sync: not attempted',cls:'sb-cyan',id:'sbSync'}]});
fitWindow('win');

/* ===== memory map =====
   One dot per stored memory (the newest 160), coloured by kind and larger for a
   higher recorded risk. A line joins a memory to the previous one in the same
   category, which is the only association the store holds. Where a dot sits is
   layout, not data. A dot lights up when a search on this page returns it.
   (46 random dots with random links, and a pulse every 0.65 s, used to be drawn.) */
(function(){
  const cvs=document.getElementById('graph'),ctx=cvs.getContext('2d');
  let W=0,H=0,dpr=Math.min(window.devicePixelRatio||1,2);
  function resize(){const r=cvs.parentElement.getBoundingClientRect();W=r.width;H=r.height;
    cvs.width=W*dpr;cvs.height=H*dpr;cvs.style.width=W+'px';cvs.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  resize();window.addEventListener('resize',resize);
  const COL={episodic:'#f5a623',semantic:'#2bd4ee',procedural:'#43e08a'};
  let filter=null; window.__memFilter=function(t){filter=t;};
  let nodes=[], edges=[], signature=null;
  window.__setMemGraph=function(mems,total){
    mems=(mems||[]).slice(0,160);
    const keyOf=m=>String(m.id!=null?m.id:((m.ts||0)+':'+String(m.text||'').slice(0,40)));
    const sig=mems.map(keyOf).join('|');
    if(sig===signature) return; signature=sig;
    const kept={}; nodes.forEach(n=>{kept[n.key]=n;});
    const lastInCategory={}; edges=[];
    nodes=mems.map((m,i)=>{
      const key=keyOf(m);
      const n=kept[key]||{x:0.08+Math.random()*0.84,y:0.08+Math.random()*0.84,vx:(Math.random()-.5)*0.0005,vy:(Math.random()-.5)*0.0005,pulse:0};
      n.key=key; n.kind=COL[m.kind]?m.kind:'episodic'; n.text=String(m.text||''); n.r=2.5+Math.min(3.5,Math.max(0,+m.risk||0)/30);
      const cat=m.category||''; if(cat){ if(lastInCategory[cat]!=null) edges.push([lastInCategory[cat],i]); lastInCategory[cat]=i; }
      return n;
    });
    const gN=document.getElementById('gNodes'); if(gN) gN.textContent=nodes.length;
    const note=document.getElementById('gNote');
    if(note) note.textContent=!nodes.length?'no memories yet':((total>nodes.length?('newest '+nodes.length+' of '+total):(nodes.length+' memor'+(nodes.length===1?'y':'ies')))+' · linked by category');
  };
  window.__memMatched=function(texts){ const hit=new Set(texts); nodes.forEach(n=>{ if(hit.has(n.text)) n.pulse=1; }); };
  function frame(){
    if(W<2){requestAnimationFrame(frame);return;}
    ctx.clearRect(0,0,W,H);
    nodes.forEach(n=>{n.x+=n.vx;n.y+=n.vy;if(n.x<0.05||n.x>0.95)n.vx*=-1;if(n.y<0.05||n.y>0.95)n.vy*=-1;n.pulse*=0.985;});
    edges.forEach(e=>{const a=nodes[e[0]],b=nodes[e[1]]; if(!a||!b) return;
      ctx.strokeStyle='rgba(126,148,184,'+(0.07+Math.max(a.pulse,b.pulse)*0.4).toFixed(2)+')';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke();});
    nodes.forEach(n=>{const c=COL[n.kind];const x=n.x*W,y=n.y*H,rr=n.r+n.pulse*3;
      const dim=filter&&filter!==n.kind;
      ctx.globalAlpha=dim?0.16:1;
      if(n.pulse>0.1&&!dim){ctx.fillStyle=c;ctx.globalAlpha=n.pulse*0.3;ctx.beginPath();ctx.arc(x,y,rr+6,0,7);ctx.fill();ctx.globalAlpha=1;}
      ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,rr,0,7);ctx.fill();ctx.globalAlpha=1;});
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* recent memories */
const memTypes={episodic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  semantic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  procedural:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7l5 5-5 5M13 17h6"/></svg>'};
let memData=[];  // populated from the real local vector memory (memory_list)
const memsEl=document.getElementById('mems');
// A memory's text holds URLs, page titles and model summaries: text, never markup (SEC-05)
function memRow(m){const h=CF.esc;return '<div class="mrow '+h(m[0])+'"><span class="mi">'+(memTypes[m[0]]||'')+'</span>'+
  '<div class="mc"><div class="mt">'+h(m[1])+'</div><div class="mm"><span>'+h(m[2])+'</span></div></div><span class="conf">'+h(m[3])+'</span></div>';}
let memFilter='all';
function renderMems(){
  const list=memFilter==='all'?memData:memData.filter(m=>m[0]===memFilter);
  memsEl.innerHTML=list.map(memRow).join('');
}
renderMems();
document.querySelectorAll('#mfilters .mchip').forEach(c=>c.addEventListener('click',()=>{
  document.querySelectorAll('#mfilters .mchip').forEach(x=>x.classList.remove('on'));
  c.classList.add('on'); memFilter=c.dataset.f; renderMems();
  if(window.__memFilter) window.__memFilter(memFilter==='all'?null:memFilter);
}));

/* searches made on this page
   Each line is a search that was run: what was asked, how many memories came
   back and how long it took. The agent's own recalls are not reported to this
   page, so none are shown. (A line naming a memory picked at random used to be
   added every 1.4 seconds.) */
const recallEl=document.getElementById('recall');
let searchCount=0;
recallEl.innerHTML='<div style="padding:18px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:11px">No searches yet<br><span style="font-size:9px">type in the search box above · the agent\'s own recalls are not reported here</span></div>';
function addRecall(query,count,ms){
  if(!searchCount) recallEl.innerHTML='';
  searchCount++;
  const el=document.createElement('div');el.className='rc';
  const now=new Date();const ts=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  el.innerHTML='<svg class="rci" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'+
    '<span class="rcn"></span><span class="rct">'+ts+'</span>';
  el.querySelector('.rcn').textContent='"'+String(query).slice(0,30)+'" · '+count+' found · '+ms+' ms';
  recallEl.prepend(el);while(recallEl.children.length>30)recallEl.lastChild.remove();
  const head=document.getElementById('recps'); if(head) head.textContent=searchCount+' search'+(searchCount===1?'':'es')+' this session';
  const k=document.getElementById('kRec'); if(k) k.innerHTML=ms+'<span style="font-size:13px;color:var(--faint)">ms</span>';
  const note=document.getElementById('kRecNote'); if(note) note.textContent=count+' found at '+ts;
}

/* ===========================================================
   REAL vector memory — local Rust store (memory_list), synced to
   the backend /api/memory. Scans auto-write episodic memories.
   =========================================================== */
(function(){
  function cfInvoke(cmd,args){ try{ var T=window.__TAURI__||(window.parent&&window.parent.__TAURI__); if(T&&T.core&&T.core.invoke) return CF.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('no tauri')); }
  function ago(ts){ var s=Math.max(0,Math.floor(Date.now()/1000)-(ts||0)); if(s<60)return s+'s ago'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }
  var searching=false, searchT=null;
  function toRows(arr){ return (arr||[]).map(function(m){
    var meta=(m.category||'unclassified')+' · '+(m.ts?new Date(m.ts*1000).toLocaleString():'time unknown')+(m.url?' · '+m.url:'')+(m.id?' · ID '+m.id:'');
    var conf=(m.risk!=null)?('risk '+m.risk):'';
    return [(m.kind||'episodic'), m.text, meta, conf];
  }); }
  function pollMemory(){
    return cfInvoke('memory_list',{limit:200}).then(function(r){
      var d=(r&&r.data)||{};
      // While the user is searching, keep their results on screen but still
      // refresh the counters below.
      if(!searching){ memData=toRows(d.memories); renderMems(); }
      var total=d.total||0;
      var mt=document.getElementById('memTotal'); if(mt) mt.textContent=total+(total===1?' mem':' mems');
      var le=document.getElementById('legEp'); if(le) le.textContent=(d.episodic||0);
      var ls=document.getElementById('legSe'); if(ls) ls.textContent=(d.semantic||0);
      var lp=document.getElementById('legPr'); if(lp) lp.textContent=(d.procedural||0);
      var kMem=document.getElementById('kMem'); if(kMem) kMem.textContent=total.toLocaleString();
      var kDim=document.getElementById('kDim'); if(kDim && d.dim!=null) kDim.textContent=String(d.dim);
      if(window.__setMemGraph) window.__setMemGraph(d.memories||[], total);
      var tot=(d.episodic||0)+(d.semantic||0)+(d.procedural||0)||1;
      var uEp=document.getElementById('uEp'),uSe=document.getElementById('uSe'),uPr=document.getElementById('uPr');
      // the bar is the split of the store by kind; it is empty when the store is
      var parts=(d.episodic||0)+(d.semantic||0)+(d.procedural||0);
      if(uEp) uEp.style.width=(parts?(d.episodic||0)/tot*100:0).toFixed(1)+'%';
      if(uSe) uSe.style.width=(parts?(d.semantic||0)/tot*100:0).toFixed(1)+'%';
      if(uPr) uPr.style.width=(parts?(d.procedural||0)/tot*100:0).toFixed(1)+'%';
    }).catch(function(e){memsEl.textContent='Saved context unavailable: '+String(e.message||e);});
  }
  window.addEventListener('cf:refresh-page',function(e){const task=pollMemory();if(e.detail)e.detail.waitUntil(task);});
  pollMemory(); setInterval(pollMemory,5000);

  // Search the FULL memory store (semantic recall via memory_search) so the user
  // can find any scan / intel / report / analysis the AI can also see.
  var searchEl=document.getElementById('memSearch');
  if(searchEl){
    searchEl.addEventListener('input',function(){
      var q=searchEl.value.trim(); clearTimeout(searchT);
      if(!q){ searching=false; pollMemory(); return; }
      searching=true;
      searchT=setTimeout(function(){
        var asked=performance.now();
        cfInvoke('memory_search',{query:q, topK:60}).then(function(r){
          var res=(r&&r.data&&r.data.results)||[];
          addRecall(q, res.length, Math.round(performance.now()-asked));
          if(window.__memMatched) window.__memMatched(res.map(function(m){ return String(m.text||''); }));
          memData=toRows(res);
          if(!memData.length) memData=[['episodic','No matching memory for “'+q.replace(/[<>]/g,'')+'”','try another term','']];
          renderMems();
        }).catch(function(){});
      },220);
    });
  }

  // The result of each sync with the backend is shown; it used to be discarded
  // while the footer said "synced".
  function sync(){
    function show(word,note){ var now=new Date(); var at=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      var k=document.getElementById('kSync'); if(k) k.textContent=word;
      var n=document.getElementById('kSyncNote'); if(n) n.textContent=note+' · '+at;
      var sb=document.getElementById('sbSync'); if(sb) sb.textContent='sync: '+word.toLowerCase()+' '+at; }
    cfInvoke('memory_sync').then(function(r){
      if(r&&r.success) show('OK', (r.pushed||0)+' sent');
      else show('Not done', (r&&r.message)||'no reason given');
    }).catch(function(e){ show('Failed', String((e&&e.message)||e).slice(0,40)); });
  }
  sync(); setInterval(sync,30000);
})();

document.getElementById('contextPrivacy').addEventListener('click',function(){window.openCfSettings('privacy');});
