// The desktop app must not show a result, a figure or a control state that
// nothing produced (SEC-06, UX-03; findings F13, F14; B07, B08). These checks
// read the desktop sources, so a shortcut removed here cannot quietly return.
const fs = require('fs');
const path = require('path');

const desktop = path.join(__dirname, '..', '..', '..', 'desktop');
const { readPage } = require('../helpers/desktopPage');
const read = relative => readPage(path.join(desktop, relative)).replace(/\r\n/g, '\n');
// A backend-only checkout (the deployed slug) has no desktop sources to check.
const describeDesktop = fs.existsSync(desktop) ? describe : describe.skip;

function sourcesUnder(relative, extensions) {
  const found = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.includes(path.extname(entry.name))) found.push(full);
    }
  };
  walk(path.join(desktop, relative));
  return found;
}

describeDesktop('the desktop scanner', () => {
  const agent = () => read('src-tauri/src/agent.rs');

  test('has no list of domains whose scans are forced to clean', () => {
    expect(agent()).not.toMatch(/is_trusted_domain/);
    expect(agent()).not.toMatch(/fn\s+\w*trusted\w*\s*\(/);
  });

  test('says "unknown" when nothing was checked, and "benign" only when something was', () => {
    const verdict = agent().match(/fn scan_verdict\(risk: i64, checked: bool\)[\s\S]*?\n}\n/);
    expect(verdict).not.toBeNull();
    expect(verdict[0]).toMatch(/else if checked \{\s*"benign"\s*\} else \{\s*"unknown"/);
  });

  test('keeps the backend\'s score for a well-known site instead of lowering it', () => {
    const result = agent().match(/fn well_known_result\([\s\S]*?\n}\n/);
    expect(result).not.toBeNull();
    expect(result[0]).toMatch(/\(backend_risk, category, signals\)/);
    expect(result[0]).toMatch(/conflicting evidence/);
  });

  test('the pages show an unknown verdict as not checked, not as clean', () => {
    for (const page of ['analyzer.html', 'web-history.html']) {
      expect(read(`ui/pages/${page}`)).toMatch(/verdict==='unknown'/);
    }
  });
});

describeDesktop('the Agent Core page', () => {
  const page = () => read('ui/pages/agent-core.html');

  test('draws nothing from random numbers', () => {
    expect(page()).not.toMatch(/Math\.random/);
  });

  test('has no switch that only changes its own appearance', () => {
    expect(page()).not.toMatch(/classList\.toggle\('off'\)/);
    expect(page()).not.toMatch(/<div class="toggle/);
  });

  test('does not advance its step display on a timer', () => {
    expect(page()).not.toMatch(/setInterval\(advanceChain/);
  });

  test('ships no sample tasks or preset figures', () => {
    for (const invented of ['svc_update.dll', '1,204 hosts', 'claude-sentinel', '68k / 200k', '1h 12m', 'data-rg="82"']) {
      expect(page()).not.toContain(invented);
    }
  });

  test('its pause control is named for the display, which is all it pauses', () => {
    expect(page()).toMatch(/Pause display/);
    expect(page()).not.toMatch(/<\/svg>Pause<\/button>/);
  });

  test('quick actions with nothing behind them are marked unavailable', () => {
    expect(page()).toContain('Unavailable capabilities</summary>');
    expect(page()).toContain('Device isolation and snapshots are not implemented');
    expect(page()).not.toMatch(/<div class="qa na"/);
    expect(page()).not.toMatch(/data-act="(Isolating|Generating|Snapshot)/);
  });
});

describeDesktop('saving a site to the list', () => {
  test('is not called protection anywhere in the interface', () => {
    const offenders = sourcesUnder('ui', ['.html', '.js']).filter(file => {
      const text = fs.readFileSync(file, 'utf8');
      return />Protect</.test(text) || /✓ Protected/.test(text) || /secure tunnel/i.test(text) || /open safely/.test(text);
    });
    expect(offenders.map(file => path.relative(desktop, file))).toEqual([]);
  });

  test('the command reports that nothing is enforced and promises no tunnel', () => {
    const command = read('src-tauri/src/blocking.rs').match(/pub async fn protect_site[\s\S]*?\n}\n/);
    expect(command).not.toBeNull();
    expect(command[0]).toMatch(/"enforced": false/);
    expect(command[0]).not.toMatch(/tunnel|encrypt|egress/i);
  });
});

describeDesktop('the Model Inference page', () => {
  const page = () => read('ui/pages/model-inference.html');

  test('draws nothing from random numbers and ships no preset rate, latency or accuracy', () => {
    expect(page()).not.toMatch(/Math\.random/);
    for (const invented of ['4.8k', '4,820', '98.6%', '~40ms', 'GPU batch', '5 served', '4 serving']) {
      expect(page()).not.toContain(invented);
    }
  });

  test('tells "no answer" apart from "healthy" and from "degraded"', () => {
    expect(page()).toMatch(/show\('unavailable',null\)/);
    expect(page()).toMatch(/show\(ok\?'healthy':'degraded',loaded\)/);
  });
});

describeDesktop('the Sandbox page', () => {
  const page = () => read('ui/pages/sandbox.html');

  test('does not claim a virtual machine, a snapshot or kernel hooks', () => {
    for (const claim of ['Win11', 'SNAPSHOT v04', 'ISOLATED', 'isolated VM', 'syscall', '4 vCPU', 'memory snapshot', 'Detonating in']) {
      expect(page()).not.toContain(claim);
    }
    expect(page()).toMatch(/no virtual machine/);
  });

  test('invents no process number and moves no activity bar at random', () => {
    expect(page()).not.toMatch(/'PID '\+/);
    expect(page()).toContain("location.replace('analyzer.html'");
    expect(page()).not.toContain("cfInvoke('scan_url'");
  });
});

describeDesktop('the Memory page', () => {
  const page = () => read('ui/pages/memory.html');

  test('ships no preset totals, rates or latencies', () => {
    for (const invented of ['48,210', '+312 today', '1,536', '128k', '55 recalls/min', '142 recalls/min', 'recall <1ms']) {
      expect(page()).not.toContain(invented);
    }
  });

  test('adds no recall line on a timer', () => {
    expect(page()).not.toMatch(/setInterval\((addRecall|recall)\b/);
  });
});

describeDesktop('the Threat Globe and the setup wizard', () => {
  test('the globe joins no pulse to an end taken at random from another', () => {
    expect(read('ui/pages/threat-globe.html')).not.toMatch(/global(Dest|Origin)\[\(Math\.random\(\)/);
  });

  test('the wizard lists only steps it carries out', () => {
    const wizard = read('ui/scripts/installer.js');
    for (const invented of ['1,842 files', '48k IOCs', 'SHA-256 ok', 'service ok', "'calibrated'"]) {
      expect(wizard).not.toContain(invented);
    }
    expect(wizard).toMatch(/INV\('add_to_path'/);
    expect(wizard).toMatch(/INV\('mark_installed'/);
  });
});

// 16.85: the pages the audit found still showing numbers written into the page.
describeDesktop('the Incident Timeline and Investigations pages', () => {
  test('ship no preset incident, case or timing', () => {
    const incident = read('ui/pages/incident-timeline.html');
    for (const invented of ['INC-2207', 'RedLine Stealer', 'WS-4471', 'MTTR 1h 48m', '00:24:18', '>23<', 'rolling 30d', '0 escalated']) {
      expect(incident).not.toContain(invented);
    }
    const cases = read('ui/pages/investigations.html');
    for (const invented of ['3 active', 'avg resolve 2.4h', '26 resolved', 'AI-accelerated', '>41<', '>28<']) {
      expect(cases).not.toContain(invented);
    }
  });

  test('time to respond or resolve is marked as not measured', () => {
    expect(read('ui/pages/incident-timeline.html')).toContain('not measured: no resolution times recorded');
    expect(read('ui/pages/investigations.html')).toContain('not measured: no resolution times recorded');
  });

  test('a case invents no assignee, progress or mitigation', () => {
    const cases = read('ui/pages/investigations.html');
    expect(cases).not.toMatch(/assignee:'CyberForge Agent'/);
    expect(cases).not.toContain('Mitigation in progress');
    expect(cases).not.toMatch(/40\+risk\/2/);
  });

  test('no response phase is animated as under way', () => {
    expect(read('ui/pages/incident-timeline.html')).not.toMatch(/containment connector/);
  });
});

describeDesktop('the Scheduled page', () => {
  test('lists the account\'s scheduled agents, not a preset list of jobs', () => {
    const page = read('ui/pages/scheduled.html');
    for (const invented of ['Fleet Threat Sweep', 'Model Retrain', 'Compliance Report', 'Backup Evidence Locker', '99.7%', '>214<', 'Next run in 00:42']) {
      expect(page).not.toContain(invented);
    }
    expect(page).toMatch(/call\('list'\)/);
    expect(page).toMatch(/call\('runs',a\.agentId\)/);
  });

  test('"run now" and the switch call the backend', () => {
    const page = read('ui/pages/scheduled.html');
    expect(page).toMatch(/call\('run',a\.agentId,\{idempotencyKey:key\(\)\}\)/);
    expect(page).toMatch(/call\(a\.state==='active'\?'pause':'resume',a\.agentId\)/);
  });
});

describeDesktop('the Signal Pipeline page', () => {
  test('ships no preset rate, latency, rule count or trend', () => {
    const page = read('ui/pages/signal-pipeline.html');
    for (const invented of ['12,480', '12.4k', '11.9k', '142 rules', '7 collectors', '+18% vs avg', '3.2M', 'end-to-end p95', 'data-u=']) {
      expect(page).not.toContain(invented);
    }
  });

  test('the server check is labelled as what it is', () => {
    const page = read('ui/pages/signal-pipeline.html');
    expect(page).toContain('Server round trip');
    expect(page).not.toMatch(/kBack'?\)?\.textContent=d\.backendOk\?'0'/);
  });
});

describeDesktop('the Browser Intelligence, Alerts and Model Inference pages', () => {
  test('ship no preset traffic, queue, triage time, evidence or dataset', () => {
    const browser = read('ui/pages/browser-intelligence.html');
    for (const invented of ['1,240 req/min', '>1.2k<', '5 held', 'Requests / min']) expect(browser).not.toContain(invented);
    expect(browser).not.toMatch(/https\?\['200','ok'\]/); // no status code nobody saw
    const alerts = read('ui/pages/alerts-evidence.html');
    for (const invented of ['11 open', '>38<', '>48<', 'triage_summary.md', 'alert_context.json']) expect(alerts).not.toContain(invented);
    const models = read('ui/pages/model-inference.html');
    for (const invented of ['4.2 TB', 'Network Flows', 'Auth Events', 'Endpoint Telemetry']) expect(models).not.toContain(invented);
  });
});

// 16.86: the live surfaces shared by every page do not cover it (checklist "do not obscure primary tasks").
describeDesktop('the live surfaces on every page', () => {
  const live = () => read('ui/scripts/cf-live.js');

  test('the connection pill sits in the page\'s top bar, not over it', () => {
    expect(live()).toMatch(/const bar = document\.querySelector\('\.topbar'\);\s*if \(bar\) \{ pill\.classList\.add\('inbar'\); bar\.appendChild\(pill\); \}/);
    expect(live()).toMatch(/#cf-live-pill\.inbar\{position:static;/);
  });

  test('the activity list is hidden until opened, opens above the agent button, and Escape closes it', () => {
    expect(live()).toMatch(/#cf-live-rail\.collapsed\{display:none\}/);
    expect(live()).toMatch(/#cf-live-rail\{position:fixed;right:16px;bottom:110px;/);
    expect(live()).toMatch(/e\.key === 'Escape' && !rail\.classList\.contains\('collapsed'\)\) toggleRail\(false\)/);
  });

  test('at most three toasts show at once, and each can be dismissed', () => {
    const shared = read('ui/scripts/cyberforge-shared.js');
    expect(shared).toMatch(/while\(box\.children\.length>3\) box\.firstChild\.remove\(\);/);
    expect(shared).toMatch(/t\.addEventListener\('click',function\(\)\{ t\.remove\(\); \}\);/);
  });

  test('Escape puts the agent panel away', () => {
    expect(read('ui/scripts/cf-agent.js')).toMatch(/e\.key === 'Escape' && frame && !frame\.classList\.contains\('cf-hidden'\)\) minimize\(\);/);
  });

  test('the header shows no recording or status chip unless the page passes one', () => {
    const header = read('ui/scripts/cf-header.js');
    expect(header).toMatch(/const chips=\(o\.chips!==undefined\)\?o\.chips:'';/);
    expect(header).not.toContain('<span class="dot rec"></span>REC');
  });
});

// 16.91: the finding workflow on the desktop (DET-02).
describeDesktop('the finding workflow on the desktop', () => {
  test('Investigations moves a finding through the backend workflow, offering only the steps its state allows', () => {
    const page = read('ui/pages/investigations.html');
    expect(page).toMatch(/CF\.invoke\('finding_state',\{threatId:c\.threatId,action:action,note:null\}\)/);
    expect(page).toContain("resolved:['reopen'], false_positive:['reopen']");
  });

  test('Alerts saves Acknowledge and Escalate for stored alerts, and says when one stays on screen', () => {
    const page = read('ui/pages/alerts-evidence.html');
    expect(page).toMatch(/CF\.invoke\('alert_state',\{alertId:target\.realId,action:action,note:null\}\)/);
    expect(page).toContain('saved for your account and audited');
    expect(page).toContain('A live alert not yet stored: Acknowledge and Escalate mark it on this screen only.');
    expect(page).toContain('Mark all seen</button>');
    expect(page).not.toContain('Ack All</button>');
  });
});

// 16.93: incidents on the desktop (DET-02).
describeDesktop('incidents on the desktop', () => {
  test('Incident Timeline lists the grouped incidents and resolves one through the backend', () => {
    const page = read('ui/pages/incident-timeline.html');
    expect(page).toMatch(/CF\.invoke\('incidents_list'\)/);
    expect(page).toMatch(/CF\.invoke\('incident_resolve',\{incidentId:inc\.incidentId,note:null\}\)/);
    expect(page).not.toContain('INC-2207');
  });
});

// 16.97: the evidence report on the desktop (DET-04).
describeDesktop('the evidence report on the desktop', () => {
  test('Reports offers a signed evidence report from the backend, written without a language model', () => {
    const page = read('ui/pages/reports.html');
    expect(page).toMatch(/CF\.invoke\('evidence_report',\{from:from\.toISOString\(\),to:now\.toISOString\(\),tz:tz\}\)/);
    expect(page).toContain('Evidence report (your account');
    expect(page).toContain("h:'Limits of this report'");
    expect(page).toContain("h:'Evidence appendix'");
  });
});

describe('the console footer', () => {
  const footer = () => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', 'ui', 'scripts', 'cf-console.js'), 'utf8');

  test('reads sign-in from the answer, not from the answer existing', () => {
    // auth_is_authenticated answers { authenticated, user }; an object is always truthy
    expect(footer()).toContain("if(!signed||signed.authenticated!==true){clear();return;}");
  });

  test('says what failed: unreachable, sign in again, or a server version without the route', () => {
    const source = footer();
    expect(source).toMatch(/function serverState\(summary\)\{[\s\S]*?status==null\)return 'unreachable'[\s\S]*?status===404\)return 'connected'[\s\S]*?status===401\|\|summary\.status===403\)return 'sign in again'/);
    expect(source).toMatch(/function engineState\(ml\)\{[\s\S]*?status===401\|\|ml\.status===403\)return 'sign in again'/);
    expect(source).not.toMatch(/\?'connected':'unavailable'/);
  });

  test('names the server and the Analysis Agents as the user sees them', () => {
    const source = footer();
    expect(source).toContain("'Server: checking'");
    expect(source).toContain("'Agents: checking'");
    expect(source).not.toMatch(/'Backend: |'ML: /);
  });
});

describe('the AI assistant page', () => {
  const file = rel => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', 'ui', rel), 'utf8');

  test('has no DeepSeek or Hugging Face token field', () => {
    const page = file('pages/ai-assistance.html');
    const script = file('scripts/pages/ai-assistance.js');
    for (const text of ['hfKeyInput', 'cf-keybar', 'ctxKey', 'Your HF token']) expect(page + script).not.toContain(text);
    expect(script).not.toMatch(/set_hf_token|hf_token_status|showKeyBar/);
  });

  test('sends a context the Analysis Agents can read in time', () => {
    const script = file('scripts/pages/ai-assistance.js');
    expect(script).toContain('var MAX_MEMORIES=6, MAX_MEMORY_CHARS=220, MAX_TURNS=4, MAX_TURN_CHARS=200;');
    expect(script).toMatch(/clipText\(m\.text,MAX_MEMORY_CHARS\)/);
    // the "grounded in N memories" note counts the memories actually sent
    expect(script).toMatch(/const mems=found\.slice\(0,MAX_MEMORIES\);/);
  });
});

describe('the AI assistant is a conversation first', () => {
  const script = () => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', 'ui', 'scripts', 'pages', 'ai-assistance.js'), 'utf8');

  test('small talk goes as itself; questions about the user\'s data bring their memory', () => {
    const src = script();
    // the page's own decision, evaluated as written
    const decide = new Function(`${src.match(/var DATA_TERMS=.*;/)[0]}\n${src.match(/var ADDRESS=.*?;/)[0]}\n${src.match(/function wantsMemory\(q\)\{.*\}/)[0]}\nreturn wantsMemory;`)();
    for (const q of ['hi', 'hello there', 'thanks!', 'how are you?', 'what can you do?', 'tell me a joke.']) expect({ q, memory: decide(q) }).toEqual({ q, memory: false });
    for (const q of ['which of my scans were risky?', 'is example.com safe?', 'check https://x.io/login', 'summarise my threat intel', 'what is phishing?']) expect({ q, memory: decide(q) }).toEqual({ q, memory: true });
    expect(src).toMatch(/const found=wantsMemory\(q\)\?await gatherMemory\(q\):\[\];/);
  });

  test('a follow-up carries the last couple of exchanges', () => {
    expect(script()).toMatch(/c\.messages\.slice\(0,-1\)\.slice\(-MAX_TURNS\)/);
  });

  test('the ML service answers the assistant as a chat assistant, and background work as an analyst', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'ml-services', 'hf_space_deploy', 'app.py'), 'utf8');
    expect(app).toMatch(/ASSISTANT_PROMPT = \([\s\S]*?reply "\s*"to greetings and small talk/);
    expect(app).toContain('system = self.ASSISTANT_PROMPT if interactive else self.SYSTEM_PROMPT');
  });
});

describe('the floating agent panel', () => {
  test('its icon opens the panel on every page (it is not a link to the assistant)', () => {
    const agent = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', 'ui', 'scripts', 'cf-agent.js'), 'utf8');
    expect(agent).toContain("fab.addEventListener('click', open);");
    expect(agent).not.toContain("location.href='ai-assistance.html'");
    expect(agent).toContain("frame.setAttribute('src', '../components/agent-panel.html');");
    // every app screen loads it
    expect(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', 'ui', 'scripts', 'cyberforge-shared.js'), 'utf8')).toContain("s.src='../scripts/cf-agent.js';");
  });
});

describe('Settings > Integrations', () => {
  const desktop = rel => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', rel), 'utf8');

  test('shows whether the CLI is really installed, from the program itself', () => {
    const header = desktop('ui/scripts/cf-header.js');
    expect(header).toContain("inv('cli_status')");
    const native = desktop('src-tauri/src/integrations.rs');
    // only the program beside this app, with fixed arguments
    expect(native).toContain('exe.parent()?.join(cli_name())');
    expect(native).toContain('command.arg("--json").arg("--non-interactive").args(args)');
    expect(native).toContain('envelope_of(cli, &["version"], 5)');
    expect(native).toContain('Some("cyberforge.cli.v1")');
  });

  test('lists only commands that exist, and manages real MCP grants', () => {
    const header = desktop('ui/scripts/cf-header.js');
    const section = header.slice(header.indexOf('function secIntegrations'), header.indexOf('var RENDER={'));
    for (const command of ['cyberforge status', 'cyberforge auth login', 'cyberforge models status', 'cyberforge scan url', 'cyberforge broker status', 'cyberforge mcp grant create', 'cyberforge mcp grant list', 'cyberforge mcp config']) expect(section).toContain(command);
    expect(section).not.toMatch(/cyberforge (ai|agents|devices|findings|incidents) /);
    expect(section).not.toContain('not built yet');
    expect(section).toContain("inv('mcp_grants')");
    expect(section).toContain("inv('mcp_grant_create',{name:name.trim(),allowScan:scan,days:days})");
    expect(section).toContain("inv('mcp_grant_revoke',{id:btn.getAttribute('data-revoke')})");
    // address analysis is off unless the user ticks it
    expect(section).toContain('<input type="checkbox" id="cfMcpScan"/>');
  });
});

describe('Overview page', () => {
  const desktop = rel => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', rel), 'utf8');

  test('shows skeletons, not invented zeros, until real data arrives; no countdown it cannot keep', () => {
    const page = desktop('ui/pages/threat-overview.html');
    const stats = page.slice(page.indexOf('<div class="stats">'), page.indexOf('<div class="viz">'));
    expect(stats.match(/<div class="num sk">/g)).toHaveLength(4);
    expect(page).not.toContain('Next in 3s');
    expect(page).toContain('id="feedSkel"');
    expect(page).toContain('id="healthSkel"');
    const script = desktop('ui/scripts/pages/threat-overview.js');
    for (const command of ["'get_threats'", "'agent_status'", "'devices_list'", "'privacy_get'"]) expect(script).toContain(command);
  });

  test('the chart is drawn at its real size, so text and points are never stretched', () => {
    const page = desktop('ui/pages/threat-overview.html');
    const script = desktop('ui/scripts/pages/threat-overview.js');
    expect(page).not.toMatch(/id="volChart"[^>]*preserveAspectRatio="none"/);
    expect(script).toContain("svg.setAttribute('viewBox','0 0 '+W+' '+H)");
    // the empty state is page text, not text inside the scaled drawing
    expect(page).toContain('<div class="ov-chart-empty" id="volEmpty">');
  });

  test('motion is one-shot and honours both reduced-motion settings', () => {
    const page = desktop('ui/pages/threat-overview.html');
    expect(page).toContain('@media (prefers-reduced-motion:reduce)');
    expect(page).toContain('html[data-motion="reduce"] .ov-reveal');
    const script = desktop('ui/scripts/pages/threat-overview.js');
    expect(script).toContain("document.documentElement.getAttribute('data-motion')==='reduce'");
    // a newer value cancels a count still running
    expect(script).toContain('cancelAnimationFrame(el._raf)');
    // only threats not seen before animate in
    expect(script).toContain("var fresh=!first&&!seenThreats[key];");
  });
});

describe('Overview: live browsing and agent work', () => {
  const desktop = rel => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', rel), 'utf8');

  test('browsing and agent work come from the real commands, live, with no stand-in data', () => {
    const script = desktop('ui/scripts/pages/threat-overview.js');
    for (const call of ["CF.invoke('get_browser_history',{limit:8})", "CF.invoke('get_active_urls')", "CF.invoke('get_last_scan')",
      "CF.invoke('agents_call',{op:'run_search',id:null,body:{}})", "CF.invoke('agents_call',{op:'list',id:null,body:null})"]) expect(script).toContain(call);
    // the 3 s telemetry carries the latest scan and running browsers; live events re-pull at once
    expect(script).toContain("T.event.listen('cf-telemetry', function(e){ applyThreats(e.payload); applyLive(e.payload); })");
    expect(script).toContain("window.addEventListener('cf:scan'");
    expect(script).toContain("window.addEventListener('cf:agent'");
    // the console's Refresh data button refreshes them too
    expect(script).toContain('pullThreats(), pullBrowsing(), pullAgents(),');
    // no invented rows: the page holds no sample titles, hosts or agent names
    expect(script).not.toMatch(/example\.(com|net)|Phishing watch|lorem/i);
  });

  test('history switched off in Privacy is said plainly, with the way to turn it on', () => {
    const script = desktop('ui/scripts/pages/threat-overview.js');
    expect(script).toContain('/PRIVACY_OFF/.test(');
    expect(script).toContain("'History access is off'");
    expect(script).toContain("window.openCfSettings('privacy')");
    // a run state from the server only ever picks one of the fixed classes
    expect(script).toContain('Object.prototype.hasOwnProperty.call(RUN_CLS,state)');
  });
});

describe('Sidebar > Diagnostics', () => {
  const desktop = rel => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', rel), 'utf8');

  test('every page in Settings > Diagnostics is in the sidebar, with Memory; the floating monitor stays in Settings', () => {
    const header = desktop('ui/scripts/cf-header.js');
    const section = header.slice(header.indexOf('function secDiagnostics'), header.indexOf('function secIntegrations'));
    const sidebar = desktop('ui/scripts/cf-sidebar.js');
    const group = sidebar.slice(sidebar.indexOf("['Diagnostics',["), sidebar.indexOf(']]', sidebar.indexOf("['Diagnostics',[")));
    const pages = [...section.matchAll(/href="([a-z-]+\.html)"/g)].map(m => m[1]);
    expect(pages).toEqual(['agent-core.html', 'signal-pipeline.html', 'model-inference.html', 'devices.html']);
    for (const page of pages) expect(sidebar).toContain(`'${page}'`);
    expect([...group.matchAll(/'([a-z-]+\.html)'/g)].map(m => m[1])).toEqual(['agent-core.html', 'signal-pipeline.html', 'model-inference.html', 'memory.html']);
    expect(group).not.toContain('Floating monitor');
    expect(section).toContain("new Event('cf:open-runtime-monitor')");
    // these pages are their own sidebar entries, not children of Settings or the assistant
    expect(sidebar).not.toMatch(/agentcore:'settings'|pipeline:'settings'|models:'settings'|memory:'assistant'/);
  });
});

describe('Navigation between pages', () => {
  const desktop = rel => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', rel), 'utf8');
  const pagesDir = path.join(__dirname, '..', '..', '..', 'desktop', 'ui', 'pages');
  const workspace = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html') && fs.readFileSync(path.join(pagesDir, f), 'utf8').includes('id="sidebar"'));

  test('every workspace page paints its final layout first: shell class and navigation styles in the head, first paint after the chrome is built', () => {
    expect(workspace.length).toBeGreaterThanOrEqual(18);
    for (const file of workspace) {
      const page = fs.readFileSync(path.join(pagesDir, file), 'utf8');
      const head = page.slice(0, page.indexOf('</head>'));
      const ok = page.includes('<html lang="en" class="cf-desktop-shell">') &&
        head.includes('<link rel="stylesheet" id="cfNavigationStyles" href="../styles/cf-navigation.css" />') &&
        head.includes('<link rel="expect" href="#cf-ready" blocking="render" />') &&
        page.lastIndexOf('<script') < page.indexOf('<span id="cf-ready" hidden></span>');
      expect({ file, ok }).toEqual({ file, ok: true });
    }
    // the sidebar does not add the stylesheet a second time
    expect(desktop('ui/scripts/cf-sidebar.js')).toContain("if(!document.getElementById('cfNavigationStyles'))");
  });

  test('pages crossfade with the chrome held still, and reduced motion turns it off', () => {
    const css = desktop('ui/styles/cf-navigation.css');
    expect(css).toContain('@view-transition{navigation:auto}');
    for (const name of ['cf-topbar', 'cf-sidebar', 'cf-statusbar']) expect(css).toContain(`view-transition-name:${name}`);
    expect(css).toContain('@media (prefers-reduced-motion:reduce){@view-transition{navigation:none}}');
    // the Overview's entrance plays once per session, not at every visit
    expect(desktop('ui/pages/threat-overview.html')).toContain('html.ov-seen .ov-reveal{animation:none;opacity:1;transform:none}');
    expect(desktop('ui/scripts/pages/threat-overview.js')).toContain("sessionStorage.getItem('cf_ov_seen')");
  });
});
