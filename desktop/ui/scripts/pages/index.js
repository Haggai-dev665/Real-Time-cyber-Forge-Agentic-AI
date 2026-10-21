/* index.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
(function(){
  function go(url){ window.location.replace(url); }
  try{
    var T = window.__TAURI__;
    if(T && T.core && typeof T.core.invoke === 'function'){
      T.core.invoke('is_installed')
        .then(function(r){ go(r && r.installed ? 'pages/loading.html' : 'pages/Installer.html'); })
        .catch(function(){ go('pages/loading.html'); });
      return;
    }
  }catch(e){}
  go('pages/loading.html');
})();
