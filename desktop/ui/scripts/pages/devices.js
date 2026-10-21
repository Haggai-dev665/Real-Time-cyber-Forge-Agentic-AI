/* pages/devices.html — this computer's enrollment and the workspace's devices (DEV-01/02).
   Every value from the backend or this computer is written with e() (CF.esc). */
buildHeader({status:'DEVICES',search:'Search…'});
buildSidebar('devices');
buildFooter({items:[{txt:'signed heartbeats',cls:'sb-cyan'},{txt:'approval required',cls:'sb-amber'}]});
fitWindow('win');

var e = CF.esc;
var THIS = null;      // device_status
var CLAIMED = null;   // what the last claim of this computer returned

function inv(cmd, args){ return CF.invoke(cmd, args || {}); }
function msg(err){ return String((err && err.message) || err || 'failed'); }
function $(id){ return document.getElementById(id); }
function when(t){ if(!t) return 'never'; var d=new Date(t); return isNaN(d) ? 'never' : d.toLocaleString(); }

/* ── this computer ─────────────────────────────────────────────────────── */

function renderThis(){
  var s = THIS || {};
  var state = s.state || (s.deviceId ? 'unknown' : 'not_enrolled');
  $('thisKv').innerHTML =
    '<span class="k">Status</span><span class="v"><span class="dv-pill '+e(state)+'">'+e(state.replace(/_/g,' '))+'</span></span>'+
    '<span class="k">Key fingerprint</span><span class="v dv-fp">'+e(s.keyFingerprint || 'no key')+'</span>'+
    '<span class="k">Device ID</span><span class="v">'+e(s.deviceId || '—')+'</span>'+
    '<span class="k">Installation</span><span class="v">'+e(s.installationId || '—')+'</span>'+
    '<span class="k">Key storage</span><span class="v">'+e(s.secureStorage === 'ok' ? 'system credential store' : 'unavailable')+'</span>'+
    '<span class="k">Key version</span><span class="v">'+e(s.keyVersion || '—')+'</span>'+
    '<span class="k">Telemetry outbox</span><span class="v">'+e(outboxText(s.outbox))+'</span>'+
    '<span class="k">Owned by</span><span class="v">'+e(ownerText(s.localOwner))+'</span>';

  var actions = $('thisActions'); actions.innerHTML = '';
  var note = $('thisNote'); note.innerHTML = '';
  if (s.secureStorage !== 'ok') {
    note.innerHTML = '<div class="dv-err">'+e(s.secureStorageError || 'The system credential store is not available, so this computer cannot keep a device key.')+'</div>';
    return;
  }
  if (!s.deviceId || state === 'revoked') {
    actions.appendChild(button('Enroll this computer', 'go', enrollThis));
    note.innerHTML = '<div class="dv-note">'+e(state === 'revoked'
      ? 'This computer was revoked. Enrolling again keeps its device record and gives it a new key, after your approval.'
      : 'This makes a key for this computer, kept in the system credential store, and adds it to your devices after you approve it.')+'</div>';
  } else if (state === 'pending_approval') {
    note.innerHTML = '<div class="dv-note">Waiting for approval. Compare the fingerprint above with the one in the list below, then approve it there.</div>';
  } else if (state === 'active') {
    actions.appendChild(button('Check in now', '', checkIn));
    actions.appendChild(button('Rotate key', '', rotateKey));
  }
  if (CLAIMED) {
    var same = CLAIMED.serverKeyFingerprint === CLAIMED.keyFingerprint;
    note.innerHTML += '<div class="dv-note">This computer\'s key: <span class="dv-fp">'+e(CLAIMED.keyFingerprint)+'</span><br>The server received: <span class="dv-fp">'+e(CLAIMED.serverKeyFingerprint)+'</span><br>'+
      e(same ? 'They match. Approve to finish.' : 'They do not match: do not approve. Enroll again.')+'</div>';
    if (same) actions.appendChild(button('Approve this computer', 'go', function(){ approve(CLAIMED.deviceId, CLAIMED.keyFingerprint); }));
  }
}

function button(label, cls, onClick){
  var b = document.createElement('button');
  b.className = 'dv-btn ' + (cls || '');
  b.textContent = label;
  b.addEventListener('click', function(){ b.disabled = true; Promise.resolve(onClick(b)).then(function(){ b.disabled = false; }, function(){ b.disabled = false; }); });
  return b;
}

function enrollThis(){
  $('thisNote').textContent = 'Enrolling…';
  return inv('device_enroll_this', {}).then(function(r){ CLAIMED = r; return refresh(); })
    .catch(function(err){ $('thisNote').innerHTML = '<div class="dv-err">'+e(msg(err))+'</div>'; });
}

/* queued · waiting for acknowledgement · sent · dropped (queue full at `limit`, older
   than the backend takes, or refused by it), and the backend's last refusal */
/* which copy of CyberForge runs this computer's device loop, outbox and hosts changes */
function ownerText(o){
  var state = o && o.state;
  if (state === 'this_app') return 'this window (device loop, signed messages, outbox, hosts file)';
  if (state === 'another_program') return 'another CyberForge program (another window, or cyberforge broker hold); this window changes none of it and takes over when that program closes';
  if (state === 'not_enforced') return 'not checked on this system ('+(o.reason || 'no broker')+')';
  return '—';
}

function outboxText(o){
  if (!o) return '—';
  var text = o.queued+' queued, '+o.inFlight+' awaiting acknowledgement, '+o.sent+' sent';
  if (o.dropped) text += ', '+o.dropped+' dropped (queue full at '+o.limit+', older than 7 days, or refused)';
  return text + (o.lastRefusal ? '. Last refused: '+o.lastRefusal : '');
}

function rotateKey(){
  $('thisNote').textContent = 'Rotating the key…';
  return inv('device_rotate_key').then(function(r){
    $('thisNote').innerHTML = '<div class="dv-note">Key rotated to version '+e(r.keyVersion)+'. New fingerprint: <span class="dv-fp">'+e(r.keyFingerprint)+'</span></div>';
    return refresh();
  }).catch(function(err){ $('thisNote').innerHTML = '<div class="dv-err">'+e(msg(err))+'</div>'; });
}

function checkIn(){
  return inv('device_heartbeat').then(refresh).catch(function(err){ $('thisNote').innerHTML = '<div class="dv-err">'+e(msg(err))+'</div>'; });
}

function approve(deviceId, fingerprint){
  return inv('device_approve', { deviceId: deviceId, keyFingerprint: fingerprint })
    .then(function(){ if (CLAIMED && CLAIMED.deviceId === deviceId) CLAIMED = null; return refresh(); })
    .catch(function(err){ if (CF.toast) CF.toast(msg(err), 'error'); });
}

/* ── another device ───────────────────────────────────────────────────── */

$('makeCode').addEventListener('click', function(){
  var out = $('codeOut'); out.textContent = 'Creating…';
  inv('device_enrollment_create').then(function(r){
    out.innerHTML = '<div class="dv-code">'+e(r.code)+'</div><div class="dv-note">Expires '+e(when(r.expiresAt))+'. It works once.</div>';
  }).catch(function(err){ out.innerHTML = '<div class="dv-err">'+e(msg(err))+'</div>'; });
});

$('claimBtn').addEventListener('click', function(){
  var out = $('claimOut'); out.textContent = 'Claiming…';
  inv('device_claim_code', { code: $('claimCode').value }).then(function(r){
    out.innerHTML = '<div class="dv-note">Claimed. Approve it on the account that showed the code, after checking this fingerprint there: <span class="dv-fp">'+e(r.keyFingerprint)+'</span></div>';
    return refresh();
  }).catch(function(err){ out.innerHTML = '<div class="dv-err">'+e(msg(err))+'</div>'; });
});

/* ── the workspace's devices ──────────────────────────────────────────── */

function renderList(data){
  var list = (data && data.devices) || [];
  $('dvCount').textContent = list.length + (list.length === 1 ? ' device' : ' devices');
  if (!list.length) { $('dvList').innerHTML = '<div class="dv-empty">No devices yet. Enroll this computer to add the first.</div>'; return; }
  $('dvList').innerHTML = list.map(function(d){
    var mine = THIS && THIS.deviceId === d.deviceId;
    return '<div class="dv-row" data-id="'+e(d.deviceId)+'">'+
      '<div class="dv-name"><b>'+e(d.displayName)+(mine ? ' (this computer)' : '')+'</b><span>'+e(d.kind)+' · last seen '+e(when(d.lastSeenAt))+'</span></div>'+
      '<span>'+e(d.platform)+'</span>'+
      '<span><span class="dv-pill '+e(d.state)+'">'+e(String(d.state).replace(/_/g,' '))+'</span></span>'+
      '<span><span class="dv-pill '+e(d.connection)+'">'+e(String(d.connection).replace(/_/g,' '))+'</span>'+
        (d.coverage === 'degraded' ? '<br><span class="dv-pill stale" title="what this device\'s own checks did not confirm">degraded: '+e((d.degradedBy || []).join(', '))+'</span>' : '')+'</span>'+
      '<span class="dv-fp" style="font-size:10.5px">'+e(d.keyFingerprint || '—')+'</span>'+
      '<span class="dv-acts"></span></div>';
  }).join('');
  list.forEach(function(d){
    var acts = document.querySelector('.dv-row[data-id="'+CSS.escape(d.deviceId)+'"] .dv-acts');
    if (!acts) return;
    if (d.state === 'pending_approval') acts.appendChild(button('Fingerprint matches — approve', 'go', function(){ return approve(d.deviceId, d.keyFingerprint); }));
    if (d.state === 'active' && ((d.capabilities && d.capabilities.advertised) || []).indexOf('hosts_blocking') >= 0) {
      acts.appendChild(button('Block or unblock a domain…', '', function(){ return startCommand(acts, d); }));
      acts.appendChild(button('Commands', '', function(){ return showCommands(d); }));
    }
    acts.appendChild(button('Rename', '', function(){ return startRename(acts, d); }));
    if (d.state === 'active' || d.state === 'pending_approval') acts.appendChild(revokeButton(d));
  });
}

/* A command is one exact action on one device; it counts as done only when that device's receipt says so. */
function startCommand(acts, d){
  var input = document.createElement('input');
  input.className = 'dv-input'; input.placeholder = 'example.com'; input.maxLength = 253;
  acts.innerHTML = ''; acts.appendChild(input);
  function sendAs(kind){
    return inv('device_command_send', { deviceId: d.deviceId, kind: kind, domain: input.value })
      .then(function(){ if (CF.toast) CF.toast('Sent. It shows as applied once '+d.displayName+' reports back.', 'ok'); return refresh().then(function(){ return showCommands(d); }); })
      .catch(function(err){ if (CF.toast) CF.toast(msg(err), 'error'); });
  }
  acts.appendChild(button('Block', 'warn', function(){ return sendAs('block_domain'); }));
  acts.appendChild(button('Unblock', '', function(){ return sendAs('unblock_domain'); }));
  acts.appendChild(button('Cancel', '', refresh));
  input.focus();
}

function showCommands(d){
  var row = document.querySelector('.dv-row[data-id="'+CSS.escape(d.deviceId)+'"]');
  if (!row) return;
  var box = row.nextElementSibling && row.nextElementSibling.classList.contains('dv-cmds') ? row.nextElementSibling : null;
  if (!box) { box = document.createElement('div'); box.className = 'dv-cmds dv-note'; box.style.padding = '4px 14px 10px'; row.after(box); }
  box.textContent = 'Loading commands…';
  return inv('device_commands_list', { deviceId: d.deviceId }).then(function(r){
    var list = (r && r.commands) || [];
    box.innerHTML = list.length ? list.map(function(c){
      return '<div>'+e(c.type === 'block_domain' ? 'Block ' : 'Unblock ')+'<b>'+e(c.domain)+'</b> · <span class="dv-pill '+e(c.state)+'">'+e(c.state)+'</span>'+
        (c.receipt ? ' · '+e(c.receipt.detail || c.receipt.status) : '')+' · '+e(when(c.createdAt))+'</div>';
    }).join('') : e('No commands sent to this device.');
  }).catch(function(err){ box.textContent = msg(err); });
}

function startRename(acts, d){
  var input = document.createElement('input');
  input.className = 'dv-input'; input.value = d.displayName; input.maxLength = 80;
  acts.innerHTML = ''; acts.appendChild(input);
  acts.appendChild(button('Save', 'go', function(){
    return inv('device_rename', { deviceId: d.deviceId, displayName: input.value }).then(refresh)
      .catch(function(err){ if (CF.toast) CF.toast(msg(err), 'error'); });
  }));
  acts.appendChild(button('Cancel', '', refresh));
  input.focus();
}

function revokeButton(d){
  var armed = false;
  var b = button('Revoke', 'warn', function(){
    if (!armed) { armed = true; b.textContent = 'Confirm revoke'; return; }
    return inv('device_revoke', { deviceId: d.deviceId }).then(refresh)
      .catch(function(err){ if (CF.toast) CF.toast(msg(err), 'error'); });
  });
  return b;
}

function refresh(){
  return inv('device_status').then(function(s){ THIS = s; }).catch(function(err){ THIS = { secureStorage: 'unavailable', secureStorageError: msg(err) }; })
    .then(function(){ renderThis(); return inv('devices_list'); })
    .then(renderList)
    .catch(function(err){ $('dvList').innerHTML = '<div class="dv-empty">'+e(msg(err))+'</div>'; });
}

refresh();
setInterval(refresh, 30000);
