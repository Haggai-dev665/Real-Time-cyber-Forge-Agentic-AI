/* pages/agents.html — agent definitions, runs and proposals (AGT-02, AGT-04, AGT-05, AGT-07).
   Everything goes through the agents_call command; every value is written with e() (CF.esc). */
buildHeader({status:'AGENTS',search:'Search…'});
buildSidebar('agents');
buildFooter({items:[{txt:'observe by default',cls:'sb-cyan'},{txt:'you approve each action',cls:'sb-amber'}]});
fitWindow('win');

var e = CF.esc;
var TEMPLATES = [];
var DEVICES = [];
var SELECTED = null;   // agentId
var RUN = null;        // runId shown

function $(id){ return document.getElementById(id); }
function call(op, id, body){ return CF.invoke('agents_call', { op: op, id: id || null, body: body || null }); }
function msg(err){ return String((err && err.message) || err || 'failed'); }
function when(t){ if(!t) return '—'; var d=new Date(t); return isNaN(d) ? '—' : d.toLocaleString(); }
function newKey(){ var a=new Uint8Array(12); crypto.getRandomValues(a); return Array.prototype.map.call(a,function(b){return ('0'+b.toString(16)).slice(-2);}).join(''); }
function button(label, cls, onClick){
  var b = document.createElement('button');
  b.className = 'ag-btn ' + (cls || ''); b.textContent = label;
  b.addEventListener('click', function(){ b.disabled = true; Promise.resolve(onClick()).then(function(){ b.disabled = false; }, function(){ b.disabled = false; }); });
  return b;
}
function toastError(err){ if (CF.toast) CF.toast(msg(err), 'error'); }

/* ── proposals ─────────────────────────────────────────────────────────── */

function renderProposals(list){
  var box = $('proposals');
  var open = list.filter(function(a){ return a.state === 'proposed'; });
  var decided = list.filter(function(a){ return a.state !== 'proposed'; }).slice(0, 8);
  box.innerHTML = '<h2>Proposals to decide</h2>' + (open.length ? '' : '<div class="ag-note">Nothing waiting. Agents in assist mode propose actions here; nothing is done until you approve.</div>');
  open.forEach(function(a){
    var item = document.createElement('div'); item.className = 'ag-item';
    item.innerHTML = '<b>Block '+e(a.domain)+'</b><span>'+e(a.reason)+'</span><br><span>device '+e(a.deviceId)+' · expires '+e(when(a.expiresAt))+'</span><div class="acts"></div>';
    var acts = item.querySelector('.acts');
    acts.appendChild(button('Approve', 'go', function(){ return call('approve', a.actionId).then(refresh).catch(toastError); }));
    acts.appendChild(button('Reject', '', function(){ return call('reject', a.actionId).then(refresh).catch(toastError); }));
    box.appendChild(item);
  });
  if (decided.length) {
    var past = document.createElement('div');
    past.innerHTML = '<div class="ag-note">Decided</div>' + decided.map(function(a){
      var out = a.outcome ? a.outcome.state + (a.outcome.receipt ? ' — ' + (a.outcome.receipt.detail || a.outcome.receipt.status) : '') : '';
      return '<div class="ag-note">'+e(a.domain)+' · <span class="ag-pill '+e(a.state)+'">'+e(a.state)+'</span>'+(out ? ' · device: '+e(out) : '')+'</div>';
    }).join('');
    box.appendChild(past);
  }
}

/* ── the list ──────────────────────────────────────────────────────────── */

function renderList(agents){
  var box = $('agentList');
  if (!agents.length) { box.innerHTML = '<div class="ag-empty">No agents yet.</div>'; return; }
  box.innerHTML = agents.map(function(a){
    return '<div class="ag-item'+(a.agentId === SELECTED ? ' sel' : '')+'" data-id="'+e(a.agentId)+'"><b>'+e(a.name)+'</b>'+
      '<span>'+e(a.templateName)+' · v'+e(a.version)+' · '+e(a.config.mode)+'</span> <span class="ag-pill '+e(a.state)+'">'+e(a.state)+'</span></div>';
  }).join('');
  box.querySelectorAll('.ag-item').forEach(function(el){ el.addEventListener('click', function(){ SELECTED = el.dataset.id; RUN = null; refresh(); }); });
}

/* ── one agent ─────────────────────────────────────────────────────────── */

function deviceName(id){ var d = DEVICES.filter(function(x){ return x.deviceId === id; })[0]; return d ? d.displayName : id; }

function renderDetail(agent, runs){
  var box = $('detail'); box.innerHTML = '';
  var card = document.createElement('div'); card.className = 'card ag-card';
  var c = agent.config;
  card.innerHTML = '<h2>'+e(agent.name)+' <span class="ag-pill '+e(agent.state)+'">'+e(agent.state)+'</span></h2>'+
    '<div class="ag-kv">'+
      '<span class="k">Template</span><span class="v">'+e(agent.templateName)+'</span>'+
      '<span class="k">Version</span><span class="v">'+e(agent.version)+'</span>'+
      '<span class="k">Mode</span><span class="v">'+e(c.mode === 'assist' ? 'assist: proposes, you approve' : 'observe: findings only')+'</span>'+
      '<span class="k">Tools</span><span class="v">'+e(c.tools.join(', '))+'</span>'+
      '<span class="k">May propose</span><span class="v">'+e(c.proposals.length ? c.proposals.join(', ') : 'nothing')+'</span>'+
      '<span class="k">Devices</span><span class="v">'+e(c.deviceIds.length ? c.deviceIds.map(deviceName).join(', ') : (agent.templateId === 'device_health' ? 'all' : 'none'))+'</span>'+
      '<span class="k">Targets</span><span class="v">'+e(c.targets.length ? c.targets.join(', ') : '—')+'</span>'+
      '<span class="k">Schedule</span><span class="v">'+e(c.schedule.kind === 'interval' ? 'every '+c.schedule.everyMinutes+' minutes' : 'when you run it')+'</span>'+
      '<span class="k">Budget</span><span class="v">'+e(c.budget.maxSteps+' steps, '+c.budget.timeoutSeconds+' s')+'</span>'+
      '<span class="k">Validation</span><span class="v">'+e(agent.validation.ok ? 'passes for version '+agent.version : (agent.validation.errors.length ? agent.validation.errors.join('; ') : 'not validated for this version'))+'</span>'+
    '</div><div class="acts"></div><div class="note"></div>';
  var acts = card.querySelector('.acts');
  var act = function(op, label, cls){ acts.appendChild(button(label, cls, function(){ return call(op, agent.agentId).then(refresh).catch(toastError); })); };
  if (agent.state === 'draft' || agent.state === 'ready') act('validate', 'Validate');
  if (agent.state === 'ready') act('activate', 'Activate', 'go');
  if (agent.state === 'active') {
    acts.appendChild(button('Run now', 'go', function(){ return call('run', agent.agentId, { idempotencyKey: newKey() }).then(function(r){ RUN = r.runId; return refresh(); }).catch(toastError); }));
    act('pause', 'Pause');
  }
  if (agent.state === 'paused') act('resume', 'Resume', 'go');
  if (agent.state !== 'archived') acts.appendChild(button('Edit', '', function(){ editForm(agent); }));
  acts.appendChild(button('Clone as draft', '', function(){ return call('clone', agent.agentId, { idempotencyKey: newKey() }).then(function(r){ SELECTED = r.agentId; return refresh(); }).catch(toastError); }));
  if (agent.state !== 'archived') act('archive', 'Archive', 'warn');
  box.appendChild(card);

  var runsCard = document.createElement('div'); runsCard.className = 'card ag-card';
  runsCard.innerHTML = '<h2>Runs</h2>' + (runs.length ? runs.map(function(r){
    return '<div class="ag-item'+(r.runId === RUN ? ' sel' : '')+'" data-run="'+e(r.runId)+'"><span class="ag-pill '+e(r.state)+'">'+e(r.state)+'</span> <span>'+e(r.trigger)+' · v'+e(r.agentVersion)+' · '+e(when(r.createdAt))+'</span><br><span>'+e(r.outcome || '')+'</span></div>';
  }).join('') : '<div class="ag-empty">No runs yet.</div>');
  runsCard.querySelectorAll('[data-run]').forEach(function(el){ el.addEventListener('click', function(){ RUN = el.dataset.run; refresh(); }); });
  box.appendChild(runsCard);

  var shown = runs.filter(function(r){ return r.runId === RUN; })[0];
  if (shown) box.appendChild(runCard(shown));

  var history = document.createElement('div'); history.className = 'card ag-card';
  history.innerHTML = '<h2>Configuration history</h2>' + (agent.history || []).map(function(h){
    return '<div class="ag-note">v'+e(h.version)+' · '+e(when(h.at))+' · '+e(diffText(h.diff))+'</div>';
  }).join('');
  box.appendChild(history);
}

/* plain text (escaped where it is written) */
function diffText(diff){
  if (!diff) return 'created';
  var parts = Object.keys(diff).map(function(k){
    var d = diff[k];
    return k === 'mode' ? 'mode '+d.from+' → '+d.to : k+(d.added.length ? ' +'+d.added.join(', +') : '')+(d.removed.length ? ' −'+d.removed.join(', −') : '');
  });
  return parts.length ? parts.join('; ') : 'no permission change';
}
function findingText(f){
  if (f.kind === 'url_verdict') return f.target+': '+f.verdict+' (score '+f.score+', '+f.modelsAnswered+' models, '+f.engine+')';
  if (f.kind === 'indicators') return f.target+': '+f.indicators.map(function(i){ return i.type+' '+i.value; }).join(', ');
  if (f.kind === 'device_health') return f.displayName+': '+f.connection+', coverage '+f.coverage+(f.degradedBy && f.degradedBy.length ? ' ('+f.degradedBy.join(', ')+')' : '');
  return JSON.stringify(f);
}

/* the run as it happened: each step, what it found, and how it ended */
function runCard(run){
  var card = document.createElement('div'); card.className = 'card ag-card';
  card.innerHTML = '<h2>Run '+e(run.runId.slice(0, 8))+' <span class="ag-pill '+e(run.state)+'">'+e(run.state)+'</span></h2>'+
    '<div class="ag-note">'+e(run.outcome || 'in progress')+' · started '+e(when(run.startedAt))+' · ended '+e(when(run.endedAt))+(run.attempts > 1 ? ' · attempt '+e(run.attempts) : '')+'</div>'+
    (run.retryOf ? '<div class="ag-note">Retry of run '+e(run.retryOf.slice(0, 8))+': only its failed or skipped checks</div>' : '')+
    run.steps.map(function(s){
      return '<div class="ag-step"><span class="t">'+e(s.tool)+'</span><span>'+e((s.input && s.input.target) || '')+' — '+e(s.summary || '')+'</span><span><span class="ag-pill '+e(s.status === 'completed' ? 'completed' : s.status === 'skipped' ? 'partial' : 'failed')+'">'+e(s.status)+'</span></span></div>';
    }).join('')+
    (run.findings.length ? '<div class="ag-note" style="margin-top:8px">Findings</div>'+run.findings.map(function(f){
      return '<div class="ag-note">'+e(findingText(f))+'</div>';
    }).join('') : '')+'<div class="acts"></div>';
  if (run.state === 'queued' || run.state === 'leased' || run.state === 'running') {
    card.querySelector('.acts').appendChild(button('Cancel run', 'warn', function(){ return call('run_cancel', run.runId).then(refresh).catch(toastError); }));
  }
  // AGT-07: repeat only what failed or was skipped, while the agent is at the same version
  if ((run.state === 'partial' || run.state === 'failed') && run.retryableSteps > 0) {
    card.querySelector('.acts').appendChild(button('Retry failed checks ('+run.retryableSteps+')', 'go', function(){
      return call('run_retry', run.runId, { idempotencyKey: newKey() }).then(function(r){ RUN = r.runId; if (CF.toast) CF.toast('Retry queued', 'ok'); return refresh(); }).catch(toastError);
    }));
  }
  return card;
}

/* ── create and edit ───────────────────────────────────────────────────── */

function formHtml(t, config){
  var c = config || { mode: 'observe', proposals: [], deviceIds: [], targets: [], schedule: { kind: 'on_demand' }, objective: '' };
  var devices = DEVICES.filter(function(d){ return d.state === 'active'; });
  return (t.needsTargets ? '<label class="ag-field"><span>Addresses or domains, one per line</span><textarea data-f="targets">'+e(c.targets.join('\n'))+'</textarea></label>' : '')+
    '<label class="ag-field"><span>Objective (optional)</span><input data-f="objective" maxlength="500" value="'+e(c.objective || '')+'" /></label>'+
    '<label class="ag-field"><span>Mode</span><select data-f="mode">'+t.modes.map(function(m){ return '<option value="'+e(m)+'"'+(c.mode === m ? ' selected' : '')+'>'+e(m === 'assist' ? 'assist — proposes, you approve' : 'observe — findings only')+'</option>'; }).join('')+'</select></label>'+
    (t.proposals.length ? '<label class="ag-field"><span>May propose</span><select data-f="proposals"><option value="">nothing</option>'+t.proposals.map(function(p){ return '<option value="'+e(p)+'"'+(c.proposals.indexOf(p) >= 0 ? ' selected' : '')+'>'+e(p)+'</option>'; }).join('')+'</select></label>' : '')+
    '<div class="ag-field"><span>Devices</span>'+(devices.length ? devices.map(function(d){
      return '<label class="ag-note"><input type="checkbox" data-device="'+e(d.deviceId)+'"'+(c.deviceIds.indexOf(d.deviceId) >= 0 ? ' checked' : '')+' /> '+e(d.displayName)+'</label>';
    }).join('') : '<div class="ag-note">No approved devices. Enroll one on the Devices page.</div>')+'</div>'+
    '<label class="ag-field"><span>Schedule</span><select data-f="schedule"><option value="0">when I run it</option>'+[60, 360, 1440].map(function(m){ return '<option value="'+m+'"'+(c.schedule.everyMinutes === m ? ' selected' : '')+'>every '+(m < 1440 ? m/60+' hour'+(m > 60 ? 's' : '') : 'day')+'</option>'; }).join('')+'</select></label>';
}

function readForm(box, t){
  var get = function(f){ var el = box.querySelector('[data-f="'+f+'"]'); return el ? el.value : ''; };
  var every = parseInt(get('schedule'), 10) || 0;
  var config = {
    objective: get('objective').trim(),
    mode: get('mode') || 'observe',
    proposals: get('proposals') ? [get('proposals')] : [],
    deviceIds: Array.prototype.filter.call(box.querySelectorAll('[data-device]'), function(x){ return x.checked; }).map(function(x){ return x.dataset.device; }),
    schedule: every ? { kind: 'interval', everyMinutes: every } : { kind: 'on_demand' }
  };
  if (t.needsTargets) config.targets = get('targets').split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
  if (config.mode === 'observe') config.proposals = [];
  return config;
}

function newForm(){
  var box = $('detail'); box.innerHTML = '';
  var card = document.createElement('div'); card.className = 'card ag-card';
  var options = TEMPLATES.map(function(t){ return '<option value="'+e(t.id)+'"'+(t.available ? '' : ' disabled')+'>'+e(t.name + (t.available ? '' : ' — not available: '+t.reason))+'</option>'; }).join('');
  card.innerHTML = '<h2>New agent</h2><label class="ag-field"><span>Template</span><select data-f="template">'+options+'</select></label>'+
    '<div class="ag-note tdesc"></div><label class="ag-field"><span>Name</span><input data-f="name" maxlength="80" value="My agent" /></label><div class="tform"></div><div class="acts"></div><div class="err"></div>';
  box.appendChild(card);
  var key = newKey(); // one key per form, so a double click creates one agent
  var sel = card.querySelector('[data-f="template"]');
  var draw = function(){
    var t = TEMPLATES.filter(function(x){ return x.id === sel.value; })[0];
    card.querySelector('.tdesc').textContent = t ? t.description + ' ' + t.limits : '';
    card.querySelector('.tform').innerHTML = t && t.available ? formHtml(t) : '';
  };
  sel.value = (TEMPLATES.filter(function(t){ return t.available; })[0] || {}).id || ''; draw();
  sel.addEventListener('change', draw);
  card.querySelector('.acts').appendChild(button('Save as draft', 'go', function(){
    var t = TEMPLATES.filter(function(x){ return x.id === sel.value; })[0];
    return call('create', null, { templateId: t.id, name: card.querySelector('[data-f="name"]').value, idempotencyKey: key, config: readForm(card, t) })
      .then(function(a){ SELECTED = a.agentId; return refresh(); })
      .catch(function(err){ card.querySelector('.err').innerHTML = '<div class="ag-err">'+e(msg(err))+'</div>'; });
  }));
  card.querySelector('.acts').appendChild(button('Cancel', '', refresh));
}

function editForm(agent){
  var t = TEMPLATES.filter(function(x){ return x.id === agent.templateId; })[0];
  var box = $('detail'); box.innerHTML = '';
  var card = document.createElement('div'); card.className = 'card ag-card';
  card.innerHTML = '<h2>Edit '+e(agent.name)+' (version '+e(agent.version)+')</h2><label class="ag-field"><span>Name</span><input data-f="name" maxlength="80" value="'+e(agent.name)+'" /></label>'+formHtml(t, agent.config)+
    '<div class="ag-note">Giving the agent more reach (a tool, a proposal, a device or a target) sends a running agent back to ready: you activate it again.</div><div class="acts"></div><div class="err"></div>';
  box.appendChild(card);
  card.querySelector('.acts').appendChild(button('Save', 'go', function(){
    return call('update', agent.agentId, { expectedVersion: agent.version, name: card.querySelector('[data-f="name"]').value, config: readForm(card, t) })
      .then(function(r){ if (r.widened && CF.toast) CF.toast('Saved as version '+r.version+'. It gives the agent more reach, so activate it again.', 'ok'); return refresh(); })
      .catch(function(err){ card.querySelector('.err').innerHTML = '<div class="ag-err">'+e(msg(err))+'</div>'; });
  }));
  card.querySelector('.acts').appendChild(button('Cancel', '', refresh));
}

/* ── refresh ───────────────────────────────────────────────────────────── */

function refresh(){
  return Promise.all([
    call('list'), call('actions'),
    CF.invoke('devices_list').then(function(d){ DEVICES = (d && d.devices) || []; }).catch(function(){ DEVICES = []; })
  ]).then(function(r){
    var agents = (r[0] && r[0].agents) || [];
    renderList(agents);
    renderProposals((r[1] && r[1].actions) || []);
    if (!SELECTED) return;
    return Promise.all([call('get', SELECTED), call('runs', SELECTED)]).then(function(d){ renderDetail(d[0], (d[1] && d[1].runs) || []); });
  }).catch(function(err){ $('agentList').innerHTML = '<div class="ag-empty">'+e(msg(err))+'</div>'; });
}

$('newAgent').addEventListener('click', newForm);

/* ── find a run (AGT-07) ───────────────────────────────────────────────── */
function searchRuns(q){
  var box = $('runResults');
  box.innerHTML = '<div class="ag-empty">Searching…</div>';
  var looksLikeDevice = /^dev[-_]/i.test(q) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(q);
  var query = looksLikeDevice ? { q: q, deviceId: q } : { q: q };
  return call('run_search', null, query).then(function(r){
    var found = (r && r.runs) || [];
    // a device ID or a run ID can match either way; show the union
    if (looksLikeDevice) return call('run_search', null, { q: q }).then(function(r2){
      var seen = {}; return found.concat((r2 && r2.runs) || []).filter(function(x){ if (seen[x.runId]) return false; seen[x.runId] = true; return true; });
    });
    return found;
  }).then(function(found){
    box.innerHTML = found.length ? found.slice(0, 30).map(function(x){
      return '<div class="ag-item" data-pick="'+e(x.agentId)+'|'+e(x.runId)+'"><span class="ag-pill '+e(x.state)+'">'+e(x.state)+'</span> <span>'+e(x.agentName || 'agent')+' · '+e(x.trigger)+' · '+e(when(x.createdAt))+'</span><div class="ag-note">'+e(x.outcome || '')+'</div></div>';
    }).join('') : '<div class="ag-empty">No run matches.</div>';
    box.querySelectorAll('[data-pick]').forEach(function(el){ el.addEventListener('click', function(){
      var p = el.dataset.pick.split('|'); SELECTED = p[0]; RUN = p[1]; refresh();
    }); });
  }).catch(function(err){ box.innerHTML = '<div class="ag-empty">'+e(msg(err))+'</div>'; });
}
$('runSearchForm').addEventListener('submit', function(ev){ ev.preventDefault(); var q = $('runQ').value.trim(); if (q) searchRuns(q); });
var armed = false;
$('pauseAll').addEventListener('click', function(){
  var b = $('pauseAll');
  if (!armed) { armed = true; b.textContent = 'Confirm: pause every agent'; setTimeout(function(){ armed = false; b.textContent = 'Pause all agents'; }, 5000); return; }
  armed = false; b.textContent = 'Pause all agents';
  call('pause_all').then(function(r){ if (CF.toast) CF.toast(r.paused+' agent(s) paused.'+(r.note ? ' '+r.note : ''), 'ok'); return refresh(); }).catch(toastError);
});

call('templates').then(function(t){ TEMPLATES = (t && t.templates) || []; }).catch(function(){ TEMPLATES = []; }).then(refresh);
setInterval(function(){ if (!document.querySelector('.ag-field')) refresh(); }, 10000); // not while a form is open
