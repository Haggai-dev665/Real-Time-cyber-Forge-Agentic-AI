/* pages/threat-alert.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
    var T = window.__TAURI__;
    function inv(cmd, args){ try{ return T.core.invoke(cmd, args||{}); }catch(e){ return Promise.reject(e); } }
    function closeWin(){ try{ T.window.getCurrentWindow().close(); }catch(e){ try{ window.close(); }catch(_){} } }
    var host = '';
    var note = document.getElementById('note');

    function esc(s){ return String(s==null?'':s).replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];}); }

    inv('get_pending_threat').then(function(t){
      if(!t || !t.host){ return; }
      host = t.host;
      document.getElementById('host').textContent = t.host;
      document.getElementById('host').title = t.url || t.host;
      document.getElementById('risk').textContent = 'RISK ' + (t.risk!=null?t.risk:'—');
      if(t.message) document.getElementById('msg').innerHTML =
        esc(t.message).replace(esc(t.host), function(){ return '<b>'+esc(t.host)+'</b>'; }); // a function: "$" in a host is not a pattern
    }).catch(function(){});

    function done(txt){ note.textContent = txt; ['btnBlock','btnProtect','btnAllow'].forEach(function(id){ document.getElementById(id).disabled=true; }); setTimeout(closeWin, 1600); }
    function act(btn, cmd, ok){
      if(!host){ closeWin(); return; }
      btn.disabled = true; var orig = btn.firstChild.textContent; btn.firstChild.textContent = '…';
      inv(cmd, {domain: host}).then(function(r){ done(ok(r)); })
        .catch(function(){ btn.disabled=false; btn.firstChild.textContent=orig; note.textContent='Action unavailable — open CyberForge to retry.'; });
    }
    document.getElementById('btnBlock').addEventListener('click', function(){
      act(this, 'block_site', function(r){ return (r&&r.enforced) ? (host+' is now blocked on this computer (hosts file).') : (host+' added to the blocklist (needs admin to enforce).'); });
    });
    document.getElementById('btnProtect').addEventListener('click', function(){
      act(this, 'protect_site', function(r){ return (r&&r.note) ? r.note : (host+' saved to your list. Nothing else changes.'); });
    });
    document.getElementById('btnAllow').addEventListener('click', function(){
      act(this, 'allow_site', function(r){ if(r&&r.stillBlocked) return host+' is still blocked: '+(r.message||'the hosts file could not be changed')+'.'; return host+' allowed'+((r&&r.wasUnblocked)?' and unblocked':'')+'. It is still scanned.'; });
    });
    document.getElementById('closeBtn').addEventListener('click', closeWin);
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeWin(); });
  
