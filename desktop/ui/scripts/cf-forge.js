/* ============================================================
   CyberForge — animated brand illustration + wordmark helpers
   ============================================================ */
(function(){
  // the brand mark (square + forge triangle + sage dot), themeable
  function markSVG(cls){
    return '<svg class="'+(cls||'')+'" viewBox="0 0 60 60" fill="none">'+
      '<rect class="sq" x="1" y="1" width="58" height="58" fill="none" stroke="var(--cream)" stroke-width="2"></rect>'+
      '<path class="tri" d="M15 45 L30 13 L45 45 Z" fill="var(--brand-orange)"></path>'+
      '<path class="triIn" d="M23 45 L30 29 L37 45 Z" fill="#0a0e18"></path>'+
      '<circle class="sage" cx="30" cy="45" r="3.2" fill="var(--sage)"></circle></svg>';
  }
  window.cfMarkSVG=markSVG;

  // wordmark: mark + "CyberForge" + AI SECURITY
  window.cfWordmark=function(host){
    host.innerHTML=
      '<span class="wm-mark">'+markSVG()+'</span>'+
      '<div><div class="wm-text">Cyber<span class="fg">Forge</span></div><div class="wm-sub">AI SECURITY</div></div>';
  };

  // big animated forge illustration: orbiting rings + ember sparks + building mark
  window.forgeIllustration=function(host,size){
    size=size||240;
    const rings=
      '<svg class="forge-rings" viewBox="0 0 220 220" fill="none">'+
        '<circle class="ringA" cx="110" cy="110" r="100" stroke="rgba(140,155,126,.35)" stroke-width="1.4" stroke-dasharray="42 26"></circle>'+
        '<circle class="ringB" cx="110" cy="110" r="80" stroke="rgba(43,212,238,.35)" stroke-width="1.2" stroke-dasharray="10 22"></circle>'+
        '<g class="orbit"><circle cx="110" cy="10" r="4" fill="var(--brand-orange)"></circle></g>'+
        '<g class="orbit2"><circle cx="110" cy="30" r="3" fill="var(--sage)"></circle></g>'+
        '<g class="orbit"><circle cx="210" cy="110" r="2.5" fill="rgba(43,212,238,.8)"></circle></g>'+
      '</svg>';
    host.innerHTML='<div class="forge" style="width:'+size+'px;height:'+size+'px">'+rings+markSVG('forge-mark')+'<div class="embers"></div></div>';
    const em=host.querySelector('.embers');
    for(let i=0;i<16;i++){const s=document.createElement('span');s.className='ember';
      s.style.left=(12+Math.random()*76)+'%';
      s.style.animationDelay=(Math.random()*3.5)+'s';
      s.style.animationDuration=(2.4+Math.random()*2.8)+'s';
      s.style.setProperty('--dx',(Math.random()*36-18)+'px');
      em.appendChild(s);}
  };

  // replay the mark build animation (re-trigger CSS animations)
  window.replayForge=function(host){
    const m=host.querySelector('.forge-mark'); if(!m)return;
    m.querySelectorAll('.sq,.tri,.triIn,.sage').forEach(el=>{el.style.animation='none';void el.offsetWidth;el.style.animation='';});
  };

  function fit(id){const w=document.getElementById(id||'win');if(!w)return;
    function f(){const s=window.innerWidth/1440;            // fill viewport width — no side bands
      w.style.transformOrigin='top left';w.style.transform='scale('+s+')';
      const stage=w.parentElement;if(stage)stage.style.height=(824*s)+'px';}   // real height → scrollable
    window.addEventListener('resize',f);f();}
  window.fitWindow=fit;
})();
