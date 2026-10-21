/* Shared footer: data comes from the live console, never default telemetry. */
(function(){
  window.buildFooter=function(options){
    if(window.CFConsole){CFConsole.mountFooter(options);return;}
    const host=document.getElementById('statusbar');if(!host)return;
    host.replaceChildren();host.className='statusbar';
    const note=document.createElement('span');note.textContent='CyberForge';host.append(note);
    const version=document.createElement('span');version.className='sb-item';version.textContent='Version unavailable';host.append(version);
    const app=window.__TAURI__&&window.__TAURI__.app;
    if(app&&app.getVersion)app.getVersion().then(v=>{version.textContent='v'+v;}).catch(()=>{});
  };
})();
