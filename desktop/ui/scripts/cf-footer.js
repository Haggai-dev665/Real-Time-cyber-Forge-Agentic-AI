/* ============================================================
   CyberForge — FOOTER (status bar) component
   Usage:  <div class="statusbar" id="statusbar"></div>
           buildFooter({ items:[{txt,cls,spin}], version })
   ============================================================ */
(function(){
  const clk='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  window.buildFooter=function(o){
    o=o||{};
    const items=o.items||[
      {txt:'CPU 0%',cls:'sb-amber'},
      {txt:'MEM 0%',cls:'sb-cyan'},
      {txt:'7 nodes online',cls:'sb-cyan'},
      {txt:'System nominal',cls:'sb-green',spin:true}
    ];
    let h='<div class="sb-pill"><span class="dot"></span>AGENT</div>'+
      '<div class="sb-item" style="margin-left:12px">'+clk+'<span id="clk">0:00:00</span></div>';
    items.forEach(it=>{
      const sp=it.spin?'<div class="spinner sm" style="width:10px;height:10px;border-top-color:var(--green);border-color:rgba(67,224,138,.25)"></div>':'';
      h+='<div class="sb-item '+(it.cls||'')+'"'+(it.id?' id="'+it.id+'"':'')+'>'+sp+it.txt+'</div>';
    });
    h+='<div class="sb-item">'+(o.version||'v2.0.0')+'</div>';
    const el=document.getElementById('statusbar');
    if(el){ el.className='statusbar'; el.innerHTML=h; if(window.startClock) startClock('clk'); }
  };
})();
