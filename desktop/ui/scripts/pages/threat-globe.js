/* pages/threat-globe.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'PUBLIC INTEL'});
buildSidebar('globe');
buildFooter({items:[{txt:'threat globe',cls:'sb-cyan'},{txt:'public intelligence',cls:'sb-amber'},{txt:'AlienVault OTX',cls:'sb-green'}]});
fitWindow('win');

/* ===================== REAL GLOBE (d3 + world atlas) + LIVE OTX INTEL =====================
   Real Earth (vendored d3-geo + world atlas), live AlienVault OTX data fetched
   through the Rust `otx_fetch` command, which asks the signed-in backend for it.
   This page holds no OTX key: the backend does. OTX has no
   attack-origin geography, so Rust geolocates the malicious IP indicators
   (ip-api.com) → approximate ORIGINS; the pulse's targeted_countries are the
   DESTINATIONS (country centres). An arc is drawn only when one pulse names
   both ends. The AI agent learns each pulse into local memory via `memory_save`.

   Labelling (DET-04): everything from OTX is shown as public intelligence with
   its own publication age, never as attacks happening now. The user's own scans,
   threats and alerts go to the separate "On your devices" panel.
   ======================================================================================= */

(function(){
  function cfInvoke(cmd,args){ try{ var T=window.__TAURI__||(window.parent&&window.parent.__TAURI__); if(T&&T.core&&T.core.invoke) return CF.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('no tauri')); }
  function esc(s){ return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c];}); }
  function prettyName(n){ return String(n||'').replace(/\b\w/g,function(c){return c.toUpperCase();}); }
  function ccToFlag(cc){ cc=String(cc||'').toUpperCase(); if(!/^[A-Z]{2}$/.test(cc)) return '🌐';
    return String.fromCodePoint(0x1F1E6+cc.charCodeAt(0)-65, 0x1F1E6+cc.charCodeAt(1)-65); }

  if(typeof d3==='undefined' || typeof topojson==='undefined' || !window.__WORLD110M){
    console.warn('[globe] vendored d3/topojson/atlas not loaded'); return;
  }

  // ---- world geometry (real countries) ----
  const world=window.__WORLD110M;
  const countries=topojson.feature(world, world.objects.countries).features;
  const borders=topojson.mesh(world, world.objects.countries, function(a,b){return a!==b;});
  const graticule=d3.geoGraticule10();

  const norm=function(s){ return String(s||'').toLowerCase().replace(/[^a-z]/g,''); };
  // OTX uses long ISO names; map them onto the atlas' short names.
  const ALIAS={ russianfederation:'russia', unitedkingdomofgreatbritainandnorthernireland:'unitedkingdom',
    unitedstates:'unitedstatesofamerica', usa:'unitedstatesofamerica', us:'unitedstatesofamerica',
    republicofkorea:'southkorea', koreasouth:'southkorea', democraticpeoplesrepublicofkorea:'northkorea',
    koreanorth:'northkorea', iranislamicrepublicof:'iran', czechrepublic:'czechia', syrianarabrepublic:'syria',
    taiwanprovinceofchina:'taiwan', boliviaplurinationalstateof:'bolivia', venezuelabolivarianrepublicof:'venezuela',
    moldovarepublicof:'moldova', tanzaniaunitedrepublicof:'unitedrepublicoftanzania',
    laopeoplesdemocraticrepublic:'laos', vietnam:'vietnam', uae:'unitedarabemirates', hongkong:'china' };
  const centroidByName={};
  countries.forEach(function(f){ var nm=norm(f.properties&&f.properties.name); if(nm){ centroidByName[nm]=d3.geoCentroid(f); } });
  function resolveCentroid(name){ var k=norm(name); if(centroidByName[k]) return centroidByName[k];
    if(ALIAS[k]&&centroidByName[ALIAS[k]]) return centroidByName[ALIAS[k]];
    var hit=Object.keys(centroidByName).find(function(x){return x.length>4&&(x.indexOf(k)>=0||k.indexOf(x)>=0);});
    return hit?centroidByName[hit]:null; }

  // ---- canvas ----
  const cvs=document.getElementById('world'), ctx=cvs.getContext('2d');
  let W=0,H=0,dpr=Math.min(window.devicePixelRatio||1,2);
  function resize(){ var r=cvs.parentElement.getBoundingClientRect(); W=r.width;H=r.height;
    cvs.width=W*dpr;cvs.height=H*dpr;cvs.style.width=W+'px';cvs.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
  resize(); window.addEventListener('resize',resize);

  let mode='globe', yaw=0, heat=false;
  let projection=d3.geoOrthographic(), path=d3.geoPath(projection,ctx);
  function setProjection(){ var pad=14, R=Math.min(W,H)*0.46, cx=W/2, cy=H/2;
    if(mode==='globe'){ projection=d3.geoOrthographic().clipAngle(90).scale(R).translate([cx,cy]).rotate([yaw,-16]); }
    else { projection=d3.geoNaturalEarth1(); projection.fitExtent([[pad,pad],[W-pad,H-pad]],{type:'Sphere'}); }
    path=d3.geoPath(projection,ctx); }
  function viewCenter(){ var inv=projection.invert&&projection.invert([W/2,H/2]); return inv||[-yaw,16]; }
  function visible(pt){ if(mode!=='globe') return true; return d3.geoDistance(pt, viewCenter())<Math.PI/2-0.02; }
  function projVisible(pt){ if(!visible(pt)) return null; var p=projection(pt); return p||null; }

  // ---- state from OTX ----
  let intensity={}, maxInt=1;        // dest country intensity (choropleth)
  let destMarkers=[], originMarkers=[], attacks=[], rings=[], pulses=[];
  const SEVC={crit:'#f4495e', med:'#f5a623', low:'#2bd4ee'};
  const baseLand='#23493a';
  function intColor(k){ var v=(intensity[k]||0)/maxInt; if(v<=0) return baseLand;
    return d3.interpolateRgb('#2f6d4a','#f4495e')(Math.min(1,(heat?0.15:0.25)+v*(heat?1:0.85))); }

  function drawGC(a,t0,t1){ ctx.beginPath(); var started=false;
    for(var t=t0;t<=t1+1e-4;t+=0.03){ var pt=a.interp(Math.min(1,Math.max(0,t))); if(!visible(pt)){started=false;continue;}
      var p=projection(pt); if(!p){started=false;continue;} if(started)ctx.lineTo(p[0],p[1]); else ctx.moveTo(p[0],p[1]); started=true; }
    ctx.stroke(); }

  function drawArcs(now){
    attacks.forEach(function(a){
      var phase=((((now-a.t0)/a.dur)%1)+1)%1;
      if(phase < a.lastPhase){ rings.push({c:a.b, color:a.color, t0:now}); }   // missile arrived → impact ring
      a.lastPhase=phase;
      // faint full route
      ctx.strokeStyle=a.color; ctx.globalAlpha=0.10; ctx.lineWidth=0.8; drawGC(a,0,1);
      // bright travelling trail
      ctx.globalAlpha=0.92; ctx.lineWidth=1.7; drawGC(a, Math.max(0,phase-0.16), phase);
      // travelling head ("missile")
      var hp=projVisible(a.interp(phase));
      if(hp){ ctx.globalAlpha=1; ctx.fillStyle=a.color; ctx.beginPath(); ctx.arc(hp[0],hp[1],2.6,0,7); ctx.fill();
        ctx.globalAlpha=0.35; ctx.beginPath(); ctx.arc(hp[0],hp[1],6,0,7); ctx.fill(); }
      ctx.globalAlpha=1;
    });
    rings=rings.filter(function(r){ var t=(now-r.t0)/700; if(t>=1)return false; var p=projVisible(r.c); if(!p)return true;
      ctx.strokeStyle=r.color; ctx.globalAlpha=1-t; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(p[0],p[1],Math.max(0.1,3+t*16),0,7); ctx.stroke(); ctx.globalAlpha=1; return true; });
  }

  function drawScene(now){
    setProjection(); ctx.clearRect(0,0,W,H);
    var cx=W/2,cy=H/2,R=Math.min(W,H)*0.46;
    if(mode==='globe'){ var ga=ctx.createRadialGradient(cx,cy,R*0.7,cx,cy,R*1.32);
      ga.addColorStop(0,'rgba(43,212,238,.10)'); ga.addColorStop(1,'rgba(43,212,238,0)');
      ctx.fillStyle=ga; ctx.beginPath(); ctx.arc(cx,cy,R*1.32,0,7); ctx.fill(); }
    ctx.beginPath(); path({type:'Sphere'});
    if(mode==='globe'){ var og=ctx.createRadialGradient(cx-R*0.3,cy-R*0.35,R*0.2,cx,cy,R);
      og.addColorStop(0,'#16395a'); og.addColorStop(0.7,'#0b1f33'); og.addColorStop(1,'#06101c'); ctx.fillStyle=og; }
    else ctx.fillStyle='#0b1f33';
    ctx.fill();
    ctx.beginPath(); path(graticule); ctx.strokeStyle='rgba(126,148,184,.10)'; ctx.lineWidth=0.6; ctx.stroke();
    for(var i=0;i<countries.length;i++){ ctx.beginPath(); path(countries[i]);
      ctx.fillStyle=intColor(norm(countries[i].properties&&countries[i].properties.name)); ctx.fill(); }
    ctx.beginPath(); path(borders); ctx.strokeStyle='rgba(150,180,210,.18)'; ctx.lineWidth=0.5; ctx.stroke();
    if(mode==='globe'){ ctx.beginPath(); path({type:'Sphere'}); ctx.strokeStyle='rgba(43,212,238,.35)'; ctx.lineWidth=1.2; ctx.stroke(); }

    drawArcs(now);

    // origin markers (malicious infra) — amber
    originMarkers.forEach(function(m){ var p=projVisible(m.p); if(!p) return;
      ctx.fillStyle='#f5a623'; ctx.beginPath(); ctx.arc(p[0],p[1],2.2,0,7); ctx.fill();
      ctx.globalAlpha=0.3; ctx.beginPath(); ctx.arc(p[0],p[1],4.5,0,7); ctx.fill(); ctx.globalAlpha=1; });
    // destination markers (targeted countries) — red rings
    destMarkers.forEach(function(m){ var p=projVisible(m.p); if(!p) return;
      var rr=3+Math.min(6,(m.count/maxInt)*6); var pr=((now/900)+(Math.abs(m.p[0])%7))%1;
      ctx.strokeStyle='rgba(244,73,94,'+(1-pr).toFixed(2)+')'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(p[0],p[1],Math.max(0.1,rr+pr*12),0,7); ctx.stroke();
      ctx.fillStyle='rgba(244,73,94,.30)'; ctx.beginPath(); ctx.arc(p[0],p[1],rr+3,0,7); ctx.fill();
      ctx.fillStyle='#f4495e'; ctx.beginPath(); ctx.arc(p[0],p[1],rr,0,7); ctx.fill(); });
  }

  function frame(now){ if(W<2||H<2){requestAnimationFrame(frame);return;}
    if(mode==='globe') yaw+=0.09; drawScene(now); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);

  document.querySelectorAll('.gl-tab').forEach(function(t){ t.addEventListener('click',function(){
    document.querySelectorAll('.gl-tab').forEach(function(x){x.classList.remove('active');}); t.classList.add('active');
    heat=(t.dataset.mode==='heat'); mode=(t.dataset.mode==='globe')?'globe':'map'; }); });

  // ---- build attacks (origin→destination) from pulses + geolocated IPs ----
  function ingest(results, ipGeo){
    ipGeo=ipGeo||{};
    intensity={}; destMarkers=[]; originMarkers=[]; attacks=[]; rings=[]; pulses=[];
    var destMap={}, originMap={}, originCC={}, base=(window.performance&&performance.now())||Date.now();
    function sevOf(p){ var s=(p.name||'')+' '+(p.tags||[]).join(' '); return /(ransom|apt|zero.?day|critical|wiper|exploit|c2|botnet)/i.test(s)?'crit':'med'; }
    function addOrigin(g){ var key=g.lat.toFixed(1)+','+g.lon.toFixed(1); if(!originMap[key]) originMap[key]={p:[g.lon,g.lat],cc:g.cc,country:g.country,count:0}; originMap[key].count++;
      if(g.country){ originCC[g.country]=originCC[g.country]||{cc:g.cc,n:0}; originCC[g.country].n++; } return originMap[key]; }
    function addDest(name,c){ var k=norm(name); intensity[k]=(intensity[k]||0)+1; if(!destMap[k]) destMap[k]={name:name,p:c,count:0}; destMap[k].count++; return destMap[k]; }

    // global pools for fallbacks (so single-sided pulses still animate from REAL points)
    var globalDest=[], globalOrigin=[];
    results.forEach(function(p){ (p.targeted_countries||[]).forEach(function(n){ var c=resolveCentroid(n); if(c) globalDest.push({name:n,p:c}); });
      (p.indicators||[]).forEach(function(ind){ var g=ipGeo[ind.indicator]; if(g&&g.lat!=null) globalOrigin.push({p:[g.lon,g.lat],cc:g.cc,country:g.country}); }); });

    results.forEach(function(p){
      var sev=sevOf(p), col=SEVC[sev]||SEVC.med;
      var origins=[]; (p.indicators||[]).forEach(function(ind){ var g=ipGeo[ind.indicator];
        if(g&&g.lat!=null){ var o=addOrigin(g); origins.push(o); } });
      var dests=[]; (p.targeted_countries||[]).forEach(function(n){ var c=resolveCentroid(n); if(c){ var dd=addDest(n,c); dests.push(dd); } });
      var techniques=(p.attack_ids||[]).map(function(a){ return typeof a==='string'?a:(a&&(a.display_name||a.id)); }).filter(Boolean);
      var malware=(p.malware_families||[]).map(function(m){ return (m&&(m.display_name||m.id))||m; }).filter(Boolean);
      var when=Date.parse(p.modified||p.created||'');
      pulses.push({ id:p.id||p.name, name:p.name||'Untitled pulse', adversary:p.adversary||'', malware:malware, techniques:techniques,
        tags:p.tags||[], origins:origins.map(function(o){return o.country;}), dests:dests.map(function(d){return d.name;}), sev:sev,
        at:isNaN(when)?null:when });

      function arc(aPt,bPt){ if(attacks.length>=80) return; attacks.push({ interp:d3.geoInterpolate(aPt,bPt), a:aPt, b:bPt,
        color:col, t0:base-Math.random()*1800, dur:1600+Math.random()*1400, lastPhase:0 }); }
      // An arc is drawn only when the same pulse names both ends. A pulse with
      // origins and no targets, or targets and no origins, keeps its markers and
      // gets no arc. (Such a pulse used to be joined to a random end taken from
      // another pulse, or its target countries were joined to each other.)
      if(origins.length && dests.length){ origins.forEach(function(o){ dests.slice(0,2).forEach(function(d){ arc(o.p,d.p); }); }); }
    });

    destMarkers=Object.keys(destMap).map(function(k){return destMap[k];});
    originMarkers=Object.keys(originMap).map(function(k){return originMap[k];});
    maxInt=Math.max.apply(null,[1].concat(Object.keys(intensity).map(function(k){return intensity[k];})));
    window.__realThreats=pulses.map(function(p){ return { type:(p.malware[0]||p.techniques[0]||'threat'),
      severity:p.sev==='crit'?'critical':'medium', source:p.origins[0]||p.adversary||'OTX', target:p.dests[0]||'', url:p.name }; });
    renderPanels(originCC);
  }

  function renderPanels(originCC){
    // Top Origins = real attack-origin countries (geolocated malicious IPs)
    var top=Object.keys(originCC).map(function(c){return {name:c, cc:originCC[c].cc, n:originCC[c].n};}).sort(function(a,b){return b.n-a.n;}).slice(0,6);
    var max=top.length?top[0].n:1;
    var o=document.getElementById('origins');
    if(o) o.innerHTML= top.length? top.map(function(m,i){
      return '<div class="origin'+(i?' row-div':'')+'"><span class="rank">'+(i+1)+'</span><span class="flag">'+ccToFlag(m.cc)+'</span>'+
        '<span class="nm">'+esc(prettyName(m.name).slice(0,12))+'</span><span class="track"><i style="width:'+Math.round(m.n/max*100)+'%"></i></span>'+
        '<span class="ct">'+m.n+'</span></div>'; }).join('')
      : '<div style="padding:18px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:11px">Loading OTX intel…</div>';

    var counts={};
    pulses.forEach(function(p){ var src=p.malware.length?p.malware:(p.techniques.length?p.techniques:p.tags);
      (src||[]).slice(0,3).forEach(function(x){ var k=String(x).slice(0,18); counts[k]=(counts[k]||0)+1; }); });
    var ent=Object.keys(counts).map(function(k){return [k,counts[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var tot=ent.reduce(function(s,e){return s+e[1];},0)||1;
    var cols=['var(--red)','var(--amber)','var(--cyan)','var(--amber-2)','var(--sage)'];
    var v=document.getElementById('vectors');
    if(v) v.innerHTML= ent.length? ent.map(function(e,i){ var pc=Math.round(e[1]/tot*100);
      return '<div class="typ'+(i?' row-div':'')+'"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'+
        '<span class="nm">'+esc(e[0])+'</span><span class="bar"><i style="width:'+pc+'%;background:'+cols[i%5]+'"></i></span><span class="pc">'+pc+'%</span></div>'; }).join('') : '';

    var mt=document.getElementById('mTotal'), mb=document.getElementById('mBlocked'), mn=document.getElementById('mNodes');
    if(mt) mt.textContent=pulses.length; if(mb) mb.textContent=originMarkers.length; if(mn) mn.textContent=destMarkers.length;
    var rate=document.getElementById('rate'); if(rate) rate.textContent=pulses.length+' pulses · fetched '+new Date(fetchedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    renderPulses();
  }

  // ---- the pulses, newest first, each with its own publication age ----
  var fetchedAt=Date.now();
  function ago(ms){ if(ms==null) return 'date unknown'; var m=Math.max(0,Math.round((Date.now()-ms)/60000));
    if(m<60) return m+'m ago'; var h=Math.round(m/60); if(h<48) return h+'h ago'; return Math.round(h/24)+'d ago'; }
  function pulseRow(p){
    var origin=p.origins[0]||p.adversary||'', dest=p.dests[0]||''; var tech=p.techniques[0]||'';
    var route=(origin?prettyName(origin):'?')+' → '+(dest?prettyName(dest):'not named');
    var cls=p.sev==='crit'?'crit':'med';
    var el=document.createElement('div'); el.className='atk '+cls;
    el.innerHTML='<span class="edge"></span><span class="flag">🛰️</span><div class="who"><b></b><span class="ip"></span></div><span class="when"></span>';
    el.querySelector('b').textContent=p.name;
    el.querySelector('.ip').textContent=((tech?(tech+' · '):'')+route).slice(0,46);
    el.querySelector('.when').textContent=ago(p.at);
    el.title='OTX pulse: '+p.name+(p.at?(' · updated '+new Date(p.at).toLocaleString()):'');
    return el; }
  function renderPulses(){ var stream=document.getElementById('stream'); if(!stream) return;
    stream.textContent='';if(!filteredPulses().length){stream.textContent='No pulses match the current search.';}
    filteredPulses().sort(function(a,b){ return (b.at||0)-(a.at||0); }).forEach(function(p){ stream.appendChild(pulseRow(p)); });
    var newest=pulses.reduce(function(m,p){ return Math.max(m,p.at||0); },0);
    var age=document.getElementById('pulseAge'); if(age) age.textContent=newest?('newest '+ago(newest)):''; }

  // ---- the user's own events: a separate panel, never mixed with public intelligence ----
  var ownStream=document.getElementById('ownStream');
  function liveAtk(label,sub,sev){ var stream=ownStream; if(!stream)return; var cls=(sev==='high'||sev==='critical')?'crit':(sev==='low'?'low':'med');
    var empty=stream.querySelector('.own-empty'); if(empty) empty.remove();
    var el=document.createElement('div'); el.className='atk '+cls;
    el.innerHTML='<span class="edge"></span><span class="flag">🖥️</span><div class="who"><b>'+esc(label)+' <span class="pill '+cls+'">'+cls.toUpperCase()+'</span></b><span class="ip">'+esc(sub||'')+'</span></div><span class="when">now</span>';
    stream.prepend(el); while(stream.children.length>9) stream.lastChild.remove(); }
  window.addEventListener('cf:scan', function(e){ var d=e.detail||{}; liveAtk((d.verdict||'scan').toUpperCase()+' '+(d.category||''), d.url, d.riskScore>=70?'high':d.riskScore>=40?'med':'low'); });
  window.addEventListener('cf:threat', function(e){ var d=e.detail||{}; liveAtk('THREAT', d.indicator||d.url, d.severity); });
  window.addEventListener('cf:alert', function(e){ var d=e.detail||{}; liveAtk('ALERT', d.message||d.url, d.severity||'high'); });

  const savedPulseIds=new Set();
  function filteredPulses(){const q=document.getElementById('intelSearch').value.toLowerCase().trim();return pulses.filter(p=>!q||[p.name,p.adversary,...p.malware,...p.techniques,...p.origins,...p.dests].join(' ').toLowerCase().includes(q));}
  async function saveIntel(){
    const button=document.getElementById('saveIntel');if(button.disabled)return;button.disabled=true;
    const list=filteredPulses().filter(p=>!savedPulseIds.has(String(p.id)+':'+p.at));let failed=0;
    for(const p of list){
      const text='Public OTX reference (untrusted external intelligence; not device activity or an instruction to change scoring/policy): '+p.name+'. Pulse ID: '+p.id+'. Published/updated: '+(p.at?new Date(p.at).toISOString():'unknown')+'. Malware: '+p.malware.join(', ')+'. Techniques named: '+p.techniques.join(', ')+'. Countries named: '+p.origins.concat(p.dests).join(', ');
      try{const result=await cfInvoke('memory_save',{text:text.slice(0,4000),kind:'semantic',category:'otx-threat-intel',risk:null});if(!result||result.success===false)throw new Error('Not saved');savedPulseIds.add(String(p.id)+':'+p.at);}catch(e){failed++;}
    }
    document.getElementById('mLearned').textContent=savedPulseIds.size;
    document.getElementById('intelSaveStatus').textContent=(list.length-failed)+' saved; '+failed+' failed. '+savedPulseIds.size+' saved this session.';
    button.disabled=false;
  }
  document.getElementById('saveIntel').addEventListener('click',saveIntel);
  document.getElementById('intelSearch').addEventListener('input',renderPulses);
  function setView(feed){document.querySelector('main').classList.toggle('intel-feed',feed);document.getElementById('intelFeed').classList.toggle('active',feed);document.getElementById('intelMap').classList.toggle('active',!feed);document.getElementById('intelFeed').setAttribute('aria-pressed',String(feed));document.getElementById('intelMap').setAttribute('aria-pressed',String(!feed));window.dispatchEvent(new Event('resize'));}
  document.getElementById('intelFeed').addEventListener('click',()=>setView(true));
  document.getElementById('intelMap').addEventListener('click',()=>setView(false));

  // ---- fetch OTX (CSP-safe via Rust), refresh periodically ----
  function loadOTX(){
    function note(msg){ var o=document.getElementById('origins'); if(o&&!destMarkers.length) o.innerHTML='<div style="padding:16px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:10.5px">'+esc(msg)+'</div>'; }
    cfInvoke('otx_fetch',{limit:50}).then(function(r){
      if(r&&r.success&&Array.isArray(r.results)&&r.results.length){ fetchedAt=Date.now(); ingest(r.results, r.ip_geo||{}); }
      else { note('OTX: '+((r&&r.error)||'no pulses returned')); }
    }).catch(function(e){ var m=String((e&&e.message)||e);
      console.warn('[globe] otx_fetch failed', e);
      // 'no tauri' = opened outside the desktop app; otherwise show the real error.
      note(/no tauri/i.test(m) ? 'Open this inside the CyberForge desktop app (not a browser).' : ('OTX call failed: '+m));
    });
  }
  // Instant paint from the loading-screen prewarm (otx_fetch + geolocation is
  // slow) so the globe already has pulses when you navigate here; loadOTX then
  // refreshes live.
  try{ var _pg=JSON.parse(localStorage.getItem('cf_pre_globe')||'null');
    if(_pg&&_pg.payload&&_pg.payload.success&&Array.isArray(_pg.payload.results)&&_pg.payload.results.length&&(Date.now()-_pg.ts)<1800000){
      fetchedAt=_pg.ts; ingest(_pg.payload.results, _pg.payload.ip_geo||{});
    } }catch(e){}
  loadOTX(); setInterval(loadOTX, 180000);
  var rb=document.querySelector('.btn-refresh'); if(rb) rb.addEventListener('click', loadOTX);
})();
