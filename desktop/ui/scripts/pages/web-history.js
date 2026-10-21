/* pages/web-history.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'HISTORY',search:'Filter browser history…'});
buildSidebar('history');
buildFooter({items:[{txt:'on-device history',cls:'sb-cyan'},{txt:'local-first',cls:'sb-amber'},{txt:'Collected',cls:'sb-green',spin:true}]});
fitWindow('win');

function cfInvoke(cmd,args){ try{ if(window.CF&&CF.invoke) return CF.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('Desktop runtime unavailable')); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function hostOf(u){ try{ return (String(u).split('://')[1]||String(u)).split('/')[0]; }catch(e){ return u; } }
function ago(ts){ if(!ts) return ''; var s=Math.max(0,Math.floor(Date.now()/1000)-ts); if(s<60)return s+'s ago'; if(s<3600)return Math.floor(s/60)+'m'; if(s<86400)return Math.floor(s/3600)+'h'; return Math.floor(s/86400)+'d'; }

var ALL=[], scanned=0, threats=0;
var listEl=document.getElementById('whList'), searchEl=document.getElementById('whSearch');

function rowHtml(it,i){
  var host=hostOf(it.url), badge=(it.browser||'?').slice(0,2).toUpperCase();
  return '<div class="hrow" data-i="'+i+'" data-url="'+esc(it.url).replace(/"/g,'&quot;')+'">'+
    '<div class="hbadge" title="'+esc(it.browser||'')+'">'+esc(badge)+'</div>'+
    '<div class="hinfo"><div class="ht">'+esc(it.title||host||it.url)+'</div><div class="hu">'+esc(it.url)+'</div></div>'+
    '<span class="hmeta">'+esc(it.browser||'')+(it.lastVisit?(' · '+ago(it.lastVisit)):'')+'</span>'+
    '<span class="hverdict" data-verdict></span>'+
    '<button class="hscan">Scan</button></div>';
}
function render(){
  var q=(searchEl.value||'').trim().toLowerCase();
  var list=ALL;
  if(q) list=ALL.filter(function(it){ return ((it.url||'')+' '+(it.title||'')+' '+(it.browser||'')).toLowerCase().indexOf(q)>=0; });
  if(!list.length){ listEl.innerHTML='<div class="wh-empty">'+(ALL.length?'No history matches “'+esc(q)+'”.':'No history in the current local snapshot. Check History access in Settings → Privacy, then refresh.')+'</div>'; return; }
  listEl.innerHTML=list.slice(0,400).map(function(it){ return rowHtml(it, ALL.indexOf(it)); }).join('');
  if(list.length>400){ var more=document.createElement('div'); more.className='wh-empty'; more.textContent='Showing first 400 of '+list.length+' — refine your filter to see more.'; listEl.appendChild(more); }
  bindRows();
}
function bindRows(){
  listEl.querySelectorAll('.hscan').forEach(function(btn){
    btn.addEventListener('click',function(e){ e.stopPropagation(); var row=btn.closest('.hrow'); scanRow(row, btn); });
  });
}
function scanRow(row, btn){
  var url=row.getAttribute('data-url'); if(!url) return;
  btn.classList.add('busy'); btn.textContent='…';
  cfInvoke('scan_url',{url:url}).then(function(r){
    var d=(r&&r.data)||{}; var risk=+d.riskScore||0; var cat=d.category||d.verdict||'';
    // "unknown" means nothing could be checked, which is not the same as clean
    var unknown=r.success===false||!Number.isFinite(d.riskScore)||(d.verdict==='unknown' && risk<40);
    var col=risk>=70?'var(--red)':risk>=40?'var(--amber)':unknown?'var(--faint)':'var(--green)';
    var bg=risk>=70?'rgba(244,73,94,.14)':risk>=40?'var(--amber-dim)':unknown?'rgba(255,255,255,.06)':'rgba(67,224,138,.14)';
    var v=row.querySelector('[data-verdict]');
    v.textContent=unknown?'NOT CHECKED':((risk>=70?'THREAT ':risk>=40?'SUSPECT ':'CLEAN ')+risk);
    v.style.color=col; v.style.background=bg; v.classList.add('show');
    btn.textContent='Re-scan'; btn.classList.remove('busy');btn.disabled=false;
    scanned++; if(risk>=50) threats++;
    document.getElementById('sScanned').textContent=scanned;
    document.getElementById('sThreats').textContent=threats;
  }).catch(function(e){
    btn.textContent='Scan'; btn.classList.remove('busy');btn.disabled=false;
    var v=row.querySelector('[data-verdict]'); v.textContent='ERR'; v.style.color='var(--faint)'; v.style.background='rgba(130,160,200,.1)'; v.classList.add('show');
  });
}
searchEl.addEventListener('input',render);

function load(){
  listEl.innerHTML='<div class="wh-empty">Reading your browser history…</div>';
  cfInvoke('get_collected_history').then(function(r){
    var d=(r&&r.data)||{}; ALL=d.history||[];
    var total=d.totalUnique||d.count||ALL.length;
    var byB=d.byBrowser||{}; var browsers=Object.keys(byB).filter(function(k){return byB[k]>0;}).length || new Set(ALL.map(function(x){return x.browser;})).size;
    document.getElementById('sTotal').textContent=total.toLocaleString();
    document.getElementById('sBrowsers').textContent=browsers;
    document.getElementById('whCount').textContent=ALL.length.toLocaleString()+' URLs';
    render();
  }).catch(function(e){ listEl.innerHTML='<div class="wh-empty">Couldn\'t read history: '+esc(String((e&&e.message)||e))+'</div>'; });
}
document.getElementById('whRefresh').addEventListener('click',load);
load();
