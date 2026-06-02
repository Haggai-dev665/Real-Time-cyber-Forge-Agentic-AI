fitWindow('win');
cfMarkSVG && (document.getElementById('railMark').innerHTML=cfMarkSVG());

/* ============ TAURI BRIDGE + REAL SYSTEM PROFILE ============ */
/* The installer reads REAL OS / hardware / browser facts from the Rust backend
   (window.__TAURI__, exposed app-wide via withGlobalTauri) instead of the old
   hard-coded placeholders. In a plain browser preview the bridge is absent, so
   we fall back to a light user-agent profile and the wizard still runs end to
   end. Nothing here is uploaded — every value is computed locally by Rust. */
const TAURI=(function(){ try{ return (window.__TAURI__&&window.__TAURI__.core)?window.__TAURI__:null; }catch(e){ return null; } })();
function INV(cmd,args){
  if(TAURI&&TAURI.core&&TAURI.core.invoke){ try{ return TAURI.core.invoke(cmd,args||{}); }catch(e){ return Promise.reject(e); } }
  return Promise.reject(new Error('tauri-unavailable'));
}
let PROFILE=null, BROWSERS=null, USEREMAIL='', pathResult=null;

/* OS-aware fallback when the Rust bridge isn't present (browser preview) */
function uaProfile(){
  const ua=navigator.userAgent||'', plat=((navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||'');
  const hay=plat+' '+ua;
  let kind='windows',os='Windows',dir='C:\\Users\\You\\AppData\\Local\\Programs\\CyberForge',pathLabel='user Path environment variable';
  if(/Mac|iPhone|iPad/i.test(hay)){ kind='macos';os='macOS';dir='~/Applications/CyberForge';pathLabel='~/.zprofile (PATH export)'; }
  else if(/Linux|X11/i.test(hay)&&!/Android/i.test(ua)){ kind='linux';os='Linux';dir='~/.local/share/CyberForge';pathLabel='~/.profile (PATH export)'; }
  const sep=kind==='windows'?'\\':'/';
  const arch=/arm|aarch/i.test(hay)?'arm64':'x64';
  return { os:{name:os,pretty:os,version:'',arch:arch,family:kind},
    cpu:{brand:'Processor',cores:(navigator.hardwareConcurrency||4),arch:arch},
    memory:{label:(navigator.deviceMemory?navigator.deviceMemory+' GB':'on-device')},
    storage:{label:'on-device'}, network:{interfaces:'—'}, hostname:'this device',
    install:{dir:dir,bin:dir+sep+'bin',pathLabel:pathLabel,kind:kind} };
}
function P(){ return PROFILE||uaProfile(); }

/* `<dir>/bin` for display, mirroring the Rust join_bin (OS separator, no double bin) */
function binOf(dir){
  if(!dir) return '';
  const win=dir.indexOf('\\')>=0||/^[A-Za-z]:/.test(dir);
  const sep=win?'\\':'/';
  const d=dir.replace(/[\\/]+$/,'');
  const last=(d.split(/[\\/]/).pop()||'').toLowerCase();
  return last==='bin'?d:d+sep+'bin';
}
/* the PATH line shown on the final summary, reflecting the REAL add_to_path result */
function pathDoneText(){
  if(!state.path) return 'PATH registration skipped';
  if(pathResult&&pathResult.success) return pathResult.alreadyPresent?'CLI already on system PATH':'CLI added to system PATH';
  if(pathResult&&!pathResult.success) return 'PATH not updated — add the bin folder manually';
  return 'CLI registered on system PATH';
}

/* Detailed, plain-language license & privacy terms — local-first, no cloud. */
const TERMS_HTML=`
  <h4>CyberForge License &amp; Privacy Terms</h4>
  <p class="td-meta">Version 2.0 · Effective May 2026 · Local-First Edition</p>
  <p><b>Plain-language summary.</b> CyberForge is an on-device security agent. Everything it reads about your computer — your operating system, hardware, installed browsers, browser history and network activity — is collected and analysed <b>locally, on this machine</b>. CyberForge does <b>not</b> upload, sell or store your system or browsing data in the cloud. The network is used only for your account sign-in and for downloading threat-intelligence updates.</p>

  <h5>1. What CyberForge reads on this device</h5>
  <p>To calibrate detection and protect you in real time, the agent reads — locally:</p>
  <ul>
    <li><b>System profile</b> — operating system and version, CPU, memory, storage capacity and active network interfaces.</li>
    <li><b>Installed &amp; running browsers</b> — which browsers exist on this machine and whether they are currently open.</li>
    <li><b>Browser history</b> — visited-site records are read from your browser's local history database to flag malicious or compromised domains. History is analysed in place and is <b>never copied off this device</b>.</li>
    <li><b>System &amp; network signals</b> — process, file and connection events used for behavioural threat detection.</li>
  </ul>

  <h5>2. Local-only processing — no cloud storage of your data</h5>
  <p>All analysis runs inside the CyberForge agent on this computer. Your system inventory, browser history and network logs are kept in a local, on-device store. They are <b>not</b> transmitted to CyberForge servers or any third party, and they are <b>not</b> retained in any cloud database. If a future feature would ever send any of this data off the device, CyberForge will ask for your explicit, separate approval first.</p>

  <h5>3. What does leave this device</h5>
  <p>Only two things use the network: (a) your account credentials when you sign in, sent securely to the CyberForge authentication service; and (b) anonymous threat-intelligence indicators (such as a suspicious-domain hash) that you may <i>optionally</i> share to improve detection. Your raw history and system data are never part of this.</p>

  <h5>4. Adding CyberForge to your system PATH</h5>
  <p>If you keep the &ldquo;Add CyberForge to system PATH&rdquo; option enabled, the installer adds CyberForge's <code>bin</code> folder to your <b>user</b> PATH so you can run the <code>cyberforge</code> command from any terminal. This change applies to your user account only, requires no administrator rights, and can be reversed at any time by removing the entry from your environment variables.</p>

  <h5>5. Your controls</h5>
  <p>You choose which local sources are monitored, how you are alerted and how often reports are generated. You can pause monitoring, disable any source, export your local data, or uninstall CyberForge — which removes the on-device store — at any time from Settings.</p>

  <h5>6. Data retention</h5>
  <p>Local telemetry is retained only on this device, under your control, and is overwritten on a rolling basis. Uninstalling CyberForge deletes the on-device store.</p>

  <h5>7. License &amp; warranty</h5>
  <p>CyberForge grants you a personal, non-transferable license to run this software on devices you own or control. The software is provided &ldquo;as is&rdquo;, without warranty of any kind. CyberForge is a defensive security tool; you are responsible for using it only on systems you are authorised to monitor.</p>

  <p class="td-foot">By enabling the toggles below you confirm that you have read and accept these terms, and that you consent to on-device analysis of the signals described above — processed locally and never stored in the cloud.</p>
`;

/* ============ ILLUSTRATIONS ============ */
const ILL={
  welcome(host){ forgeIllustration(host,290); },
  license(host){ imgIllus(host,'ilu1','rgba(246,157,57,.18)'); },
  location(host){
    const dir=(P().install&&P().install.dir)||'';
    const shown=(dir.length>32?'…'+dir.slice(-31):dir).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    host.innerHTML='<svg class="ill-svg" viewBox="0 0 300 300"><circle class="spin-slow" cx="150" cy="150" r="118" fill="none" stroke="rgba(43,212,238,.14)" stroke-width="1" stroke-dasharray="4 8"/>'+
      '<g class="bobf"><path d="M70 110 h60 l14 16 h66 a8 8 0 0 1 8 8 v66 a8 8 0 0 1 -8 8 H70 a8 8 0 0 1 -8 -8 v-82 a8 8 0 0 1 8 -8 Z" fill="#0f1726" stroke="var(--brand-orange)" stroke-width="2"/>'+
      '<rect x="96" y="150" width="108" height="14" rx="4" fill="rgba(246,157,57,.18)"/></g>'+
      '<g class="spin-fast" style="transform-origin:222px 96px"><circle cx="222" cy="96" r="16" fill="#13202f" stroke="var(--sage)" stroke-width="2"/><path d="M222 86v20M212 96h20" stroke="var(--sage)" stroke-width="2.5" stroke-linecap="round"/></g>'+
      '<text x="150" y="232" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="var(--faint)">'+shown+'</text></svg>';
  },
  scan(host){ imgIllus(host,'ilu2','rgba(43,212,238,.16)'); },
  alerts(host){
    host.innerHTML='<svg class="ill-svg" viewBox="0 0 300 300"><circle class="spin-med" cx="150" cy="150" r="116" fill="none" stroke="rgba(246,157,57,.16)" stroke-width="1" stroke-dasharray="5 9"/>'+
      '<circle class="pulse-c" cx="150" cy="150" r="60" fill="none" stroke="var(--brand-orange)" stroke-width="2" style="transform-origin:150px 150px"/>'+
      '<g class="bobf"><path d="M150 96 a30 30 0 0 1 30 30 c0 30 14 38 14 38 H106 s14 -8 14 -38 a30 30 0 0 1 30 -30 Z" fill="#0f1726" stroke="var(--brand-orange)" stroke-width="2.5"/>'+
      '<path d="M140 170 a10 10 0 0 0 20 0" fill="none" stroke="var(--brand-orange)" stroke-width="2.5" stroke-linecap="round"/>'+
      '<circle cx="184" cy="104" r="13" fill="var(--red)"/><text x="184" y="109" text-anchor="middle" font-family="JetBrains Mono" font-size="13" font-weight="700" fill="#fff">!</text></g></svg>';
  },
  reports(host){
    host.innerHTML='<svg class="ill-svg" viewBox="0 0 300 300"><circle class="spin-slow" cx="150" cy="150" r="118" fill="none" stroke="rgba(140,155,126,.16)" stroke-width="1" stroke-dasharray="3 7"/>'+
      '<g class="bobf"><rect x="92" y="86" width="116" height="140" rx="10" fill="#0f1726" stroke="var(--border-3)" stroke-width="2"/>'+
      '<rect x="108" y="180" width="14" height="30" rx="3" fill="var(--sage)"/><rect x="130" y="162" width="14" height="48" rx="3" fill="var(--cyan)"/>'+
      '<rect x="152" y="148" width="14" height="62" rx="3" fill="var(--brand-orange)"/><rect x="174" y="170" width="14" height="40" rx="3" fill="var(--amber-2)"/>'+
      '<line x1="108" y1="112" x2="180" y2="112" stroke="rgba(140,155,126,.5)" stroke-width="3" stroke-linecap="round"/>'+
      '<line x1="108" y1="128" x2="160" y2="128" stroke="rgba(126,148,184,.35)" stroke-width="3" stroke-linecap="round"/></g>'+
      '<g class="spin-fast" style="transform-origin:196px 96px"><circle cx="196" cy="96" r="17" fill="#13202f" stroke="var(--amber-2)" stroke-width="2"/><path d="M196 88v8l5 4" stroke="var(--amber-2)" stroke-width="2.5" stroke-linecap="round" fill="none"/></g></svg>';
  },
  sync(host){
    host.innerHTML='<svg class="ill-svg" viewBox="0 0 300 300"><circle class="spin-slow" cx="150" cy="150" r="120" fill="none" stroke="rgba(43,212,238,.12)" stroke-width="1" stroke-dasharray="4 8"/>'+
      '<line class="flow" x1="80" y1="84" x2="150" y2="150" stroke="var(--cyan)" stroke-width="2"/>'+
      '<line class="flow" x1="220" y1="84" x2="150" y2="150" stroke="var(--sage)" stroke-width="2"/>'+
      '<line class="flow" x1="76" y1="216" x2="150" y2="150" stroke="var(--brand-orange)" stroke-width="2"/>'+
      '<line class="flow" x1="224" y1="216" x2="150" y2="150" stroke="var(--blue)" stroke-width="2"/>'+
      node(80,84,'var(--cyan)','M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18')+
      node(220,84,'var(--sage)','M4 17 8 5l4 12M14 9l3 8 3-8')+
      node(76,216,'var(--brand-orange)','M5 7h14M5 12h14M5 17h9')+
      node(224,216,'var(--blue)','M4 6h16v10H4zM9 20h6')+
      '<circle class="pulse-c" cx="150" cy="150" r="34" fill="none" stroke="var(--brand-orange)" stroke-width="2" style="transform-origin:150px 150px"/>'+
      '<circle cx="150" cy="150" r="30" fill="#13202f" stroke="var(--brand-orange)" stroke-width="2.5"/>'+
      cfMarkSVG().replace('<svg ','<svg x="128" y="128" width="44" height="44" ')+'</svg>';
  },
  installing(host){
    host.innerHTML='<svg class="ill-svg" viewBox="0 0 300 300"><circle class="spin-med" cx="150" cy="150" r="118" fill="none" stroke="rgba(246,157,57,.2)" stroke-width="1.5" stroke-dasharray="40 22"/>'+
      '<circle class="spin-fast" cx="150" cy="150" r="92" fill="none" stroke="rgba(43,212,238,.25)" stroke-width="1.5" stroke-dasharray="10 20"/>'+
      '<g class="spin-slow" style="transform-origin:150px 150px"><circle cx="150" cy="32" r="5" fill="var(--brand-orange)"/></g>'+
      forgeMark()+'</svg>';
  },
  done(host){
    host.innerHTML='<svg class="ill-svg" viewBox="0 0 300 300"><circle class="spin-slow" cx="150" cy="150" r="120" fill="none" stroke="rgba(67,224,138,.2)" stroke-width="1.5" stroke-dasharray="38 18"/>'+
      '<circle class="pulse-c" cx="150" cy="150" r="64" fill="none" stroke="var(--green)" stroke-width="2" style="transform-origin:150px 150px"/>'+
      '<circle cx="150" cy="150" r="58" fill="rgba(67,224,138,.08)" stroke="var(--green)" stroke-width="2.5"/>'+
      '<path class="draw-c" d="M124 150 L143 169 L178 132" fill="none" stroke="var(--green)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:90;stroke-dashoffset:90;animation:fdraw .8s .3s ease forwards"/></svg>';
  }
};
function node(x,y,col,d){return '<g class="bobf" style="animation-delay:-'+(Math.random()*2)+'s"><circle cx="'+x+'" cy="'+y+'" r="20" fill="#0f1726" stroke="'+col+'" stroke-width="2"/><g transform="translate('+(x-9)+','+(y-9)+')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg></g></g>';}
function forgeMark(){return cfMarkSVG().replace('<svg ','<svg x="118" y="118" width="64" height="64" ');}
/* image illustration (assets/iluN.svg) framed by two orbiting rings to match
   the wizard's animated aesthetic. Paths resolve from pages/ → ../assets/. */
function imgIllus(host,name,ringCol){
  host.innerHTML=
    '<div class="ill-img-wrap">'+
      '<svg class="ill-ring spin-slow" viewBox="0 0 300 300"><circle cx="150" cy="150" r="142" fill="none" stroke="'+ringCol+'" stroke-width="1" stroke-dasharray="4 8"/></svg>'+
      '<svg class="ill-ring spin-med" viewBox="0 0 300 300"><circle cx="150" cy="150" r="120" fill="none" stroke="'+ringCol+'" stroke-width="1.4" stroke-dasharray="30 18"/></svg>'+
      '<img class="ill-img bobf" src="../assets/'+name+'.svg" alt="" draggable="false"/>'+
    '</div>';
}

/* ============ STEP DEFINITIONS ============ */
const check='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const steps=[
  {key:'welcome',rail:'Welcome',rd:'introduction',illus:'welcome',badge:'CyberForge Installer',
   h:'Install <span class="fg">CyberForge</span> on this machine',
   p:'CyberForge is an AI-native threat intelligence platform. Its agentic core continuously watches your endpoints, browsers, and network — detecting, detonating, and containing threats in real time. This wizard will configure the agent, set up monitoring, and connect your local data sources.'},
  {key:'license',rail:'License & Terms',rd:'local-first',illus:'license',badge:'Step 1 · License & Privacy',
   h:'Review the <span class="fg">CyberForge</span> license &amp; privacy terms',
   p:'CyberForge runs entirely on this device. Please read the terms below — they explain, in plain language, what is read from your machine, that it is processed locally, and that your system, browser and history data are never stored in the cloud.',
   body:`<div class="terms-wrap fade-seq">
     <div class="terms-doc" id="termsDoc">${TERMS_HTML}</div>
     <label class="toggle-row" style="cursor:pointer" data-req><span class="tr-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg></span><div style="flex:1"><div class="tr-t">I accept the CyberForge License &amp; Privacy Terms</div><div class="tr-d">Local-only processing · v2.0 · updated May 2026</div></div><span class="tgl off" data-tgl="lic"></span></label>
     <label class="toggle-row" style="cursor:pointer;animation-delay:.08s"><span class="tr-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/></svg></span><div style="flex:1"><div class="tr-t">I consent to on-device analysis of my system &amp; browser signals</div><div class="tr-d">Read &amp; analysed locally — never uploaded or stored in the cloud</div></div><span class="tgl off" data-tgl="consent"></span></label>
   </div>`},
  {key:'location',rail:'Location & PATH',rd:'install dir',illus:'location',badge:'Step 2 · Destination',
   h:'Choose the <span class="fg">install location</span>',
   p:'Select where CyberForge will be installed on this device. We can also register the cyberforge command on your system PATH so you can run scans from any terminal.',
   body:`<div class="fade-seq">
     <div class="pathbox" style="animation-delay:0s"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h6l2 2h8v9H4z"/></svg><input id="instPath" value="" placeholder="Install directory" spellcheck="false"/><span class="browse">Browse…</span></div>
     <div class="hint" style="animation-delay:.05s"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16v-4M12 8h.01"/><circle cx="12" cy="12" r="9"/></svg>Requires ~1.4 GB · <span id="diskHint">checking disk…</span></div>
     <div class="toggle-row" style="animation-delay:.1s"><span class="tr-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 17 6-6-6-6M12 19h8"/></svg></span><div style="flex:1"><div class="tr-t">Add CyberForge to system PATH</div><div class="tr-d">Adds <span id="binPath" style="font-family:var(--mono);color:var(--amber-2)">…\\bin</span> to your <span id="pathLabelTxt">user PATH</span></div></div><span class="tgl" data-tgl="path"></span></div>
     <div class="toggle-row" style="animation-delay:.15s"><span class="tr-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg></span><div style="flex:1"><div class="tr-t">Launch agent service at startup</div><div class="tr-d">Run CyberForge Sentinel as a background service</div></div><span class="tgl" data-tgl="startup"></span></div>
   </div>`},
  {key:'scan',rail:'System Scan',rd:'collect data',illus:'scan',badge:'Step 3 · System Profile',
   h:'Collecting <span class="fg">system data</span>',
   p:'CyberForge is profiling this machine to calibrate detection baselines. This inventory stays on-device and tunes the agent to your hardware, OS, and installed software.',
   body:`<div class="scan-list" id="scanList"></div>`,
   gate:'scan'},
  {key:'alerts',rail:'Vulnerability Alerts',rd:'notify me',illus:'alerts',badge:'Step 4 · Browser Protection',
   h:'How should we <span class="fg">alert you</span>?',
   p:'When CyberForge detects a browser vulnerability — a malicious extension, a compromised session, a drive-by exploit — how would you like to be notified? Choose all that apply.',
   body:`<div class="cw-form fade-seq">
     ${optHTML('alert','desktop','Desktop notification','Instant native pop-up on this machine','<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',true,true)}
     ${optHTML('alert','sound','Audible siren','Play an alert tone for critical findings','<path d="M11 5 6 9H2v6h4l5 4zM15 9a5 5 0 0 1 0 6M19 5a10 10 0 0 1 0 14"/>',false,true)}
     ${optHTML('alert','email','Email','Send to <span id="alertEmail">your account email</span>','<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',true,true)}
     ${optHTML('alert','block','Auto-block & quarantine','Sever the session immediately, then notify','<path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>',true,true)}
   </div>`},
  {key:'reports',rail:'Report Cadence',rd:'schedule',illus:'reports',badge:'Step 5 · Reporting',
   h:'How often should we <span class="fg">generate reports</span>?',
   p:'CyberForge compiles posture, incidents, and agent activity into audit-ready reports. Pick a default cadence — you can always export on demand or change this later in Settings.',
   body:`<div class="seg" id="repSeg">
     ${segHTML('hourly','Hourly','realtime ops','<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}
     ${segHTML('daily','Daily','9:00 AM','<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',true)}
     ${segHTML('weekly','Weekly','Mondays','<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 15h3"/>')}
     ${segHTML('monthly','Monthly','1st of month','<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M7 15h2M11 15h2M15 15h2"/>')}
   </div>
   <div class="cw-form" style="margin-top:14px">
     <div class="toggle-row"><span class="tr-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg></span><div style="flex:1"><div class="tr-t">Include executive PDF summary</div><div class="tr-d">One-page posture overview for leadership</div></div><span class="tgl" data-tgl="pdf"></span></div>
   </div>`},
  {key:'sync',rail:'Sync Sources',rd:'local data',illus:'sync',badge:'Step 6 · Local Sync',
   h:'Sync your <span class="fg">local sources</span>',
   p:'CyberForge can monitor local signals to spot threats early. Browser history is analyzed entirely on-device; system, network, and connectivity logs are correlated to detect anomalies. Choose what to sync.',
   body:`<div class="cw-form fade-seq">
     ${optHTML('sync','browser','Browser history (local)','Analyze visited domains on-device for malicious sites — never uploaded','<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/>',true,true)}
     ${optHTML('sync','syslog','System logs','Process, file, and registry events for behavioral detection','<path d="M4 6h16M4 12h16M4 18h10"/>',true,true)}
     ${optHTML('sync','network','Network logs','Connection flows and DNS queries from active interfaces','<rect x="2" y="3" width="20" height="6" rx="1"/><rect x="2" y="15" width="20" height="6" rx="1"/><path d="M6 6h.01M6 18h.01"/>',true,true)}
     ${optHTML('sync','conn','Connectivity events','Wi-Fi, VPN, and device attach/detach telemetry','<path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M2 9a16 16 0 0 1 20 0"/><circle cx="12" cy="20" r="1"/>',true,true)}
   </div>`},
  {key:'install',rail:'Install',rd:'writing files',illus:'installing',badge:'Step 7 · Installing',
   h:'Forging your <span class="fg">CyberForge</span> install',
   p:'Applying your configuration — writing program files, registering the agent service, wiring PATH variables, and initializing local sync. This will only take a moment.',
   body:`<div class="inst-bar"><div class="ib-top"><span id="instPhase">Preparing…</span><b id="instPct">0%</b></div><div class="track"><i id="instFill"></i></div></div><div class="inst-log" id="instLog"></div>`,
   gate:'install'},
  {key:'done',rail:'Finish',rd:'ready',illus:'done',badge:'Installation complete',
   h:'CyberForge is <span class="fg">installed & live</span>',
   p:'The agent is running, your sources are syncing, and monitoring is active. Step into the console to watch CyberForge defend this machine in real time.',
   body:`<div class="cw-form fade-seq" style="max-width:520px">
     <div class="sysrow done" style="animation-delay:0s"><svg class="sr-ic" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="m4 17 6-6-6-6M12 19h8"/></svg><span class="sr-l" id="donePath">CLI registered on system PATH</span><span class="sr-st"><svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
     <div class="sysrow done" style="animation-delay:.08s"><svg class="sr-ic" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/></svg><span class="sr-l" id="doneAlert">Browser vulnerability alerts active</span><span class="sr-st"><svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
     <div class="sysrow done" style="animation-delay:.16s"><svg class="sr-ic" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span class="sr-l" id="doneRep">Reports scheduled · daily</span><span class="sr-st"><svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
     <div class="sysrow done" style="animation-delay:.24s"><svg class="sr-ic" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/></svg><span class="sr-l" id="doneSync">Local sync online · 4 sources</span><span class="sr-st"><svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
   </div>`}
];

function optHTML(group,key,t,d,path,sel,multi){
  return `<div class="opt-card${sel?' sel':''}" data-group="${group}" data-key="${key}" data-multi="${multi?1:0}">
    <span class="oc-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>
    <div style="flex:1"><div class="oc-t">${t}</div><div class="oc-d">${d}</div></div>
    <span class="oc-check">${check}</span></div>`;
}
function segHTML(key,t,d,path,sel){
  return `<div class="sg${sel?' sel':''}" data-seg="${key}"><svg class="sgi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg><div class="sgt">${t}</div><div class="sgd">${d}</div></div>`;
}

/* ============ STATE + RENDER ============ */
const state={lic:false,consent:false,path:true,startup:true,alert:['desktop','email','block'],report:'daily',sync:['browser','syslog','network','conn'],pdf:false,installDir:'',installEdited:false};
let i=0,maxReached=0;
const railEl=document.getElementById('steps'),illusEl=document.getElementById('illus'),copyEl=document.getElementById('copy'),
      backEl=document.getElementById('back'),nextEl=document.getElementById('next'),pgzEl=document.getElementById('pgz');

function renderRail(){
  railEl.innerHTML=steps.map((s,k)=>{
    const cls=k<i?'done':(k===i?'active':'');
    const dot=k<i?check:(k+1);
    return `<div class="st ${cls}">${k<steps.length-1?'<span class="connline"></span>':''}<span class="sdot">${dot}</span><div><div class="sl">${s.rail}</div><div class="sd">${s.rd}</div></div></div>`;
  }).join('');
}

let scanTimer=null,instTimer=null;
function render(){
  const s=steps[i];
  ILL[s.illus](illusEl);
  copyEl.innerHTML=`<span class="badge">${s.badge}</span><h1>${s.h}</h1><p>${s.p}</p>${s.body||''}`;
  renderRail();
  pgzEl.textContent='Step '+(i+1)+' of '+steps.length;
  backEl.disabled=i===0;
  // wire body interactions
  wireBody(s);
  // nav button label + gating
  updateNext(s);
  if(s.gate==='scan') runScan();
  if(s.gate==='install') runInstall();
}

function updateNext(s){
  nextEl.removeAttribute('href');
  let label='Continue',icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  if(s.key==='welcome')label='Begin Setup';
  if(s.key==='install'){label='Installing…';}
  if(s.key==='done'){label='Enter Console';nextEl.setAttribute('href','login.html');}
  nextEl.innerHTML=label+icon;
  // disable rules
  let dis=false;
  if(s.key==='license'&&!(state.lic&&state.consent))dis=true;
  if(s.key==='scan'&&!scanComplete)dis=true;
  if(s.key==='install'&&!instComplete)dis=true;
  nextEl.toggleAttribute('disabled',dis);
}

function wireBody(s){
  // toggles
  copyEl.querySelectorAll('[data-tgl]').forEach(t=>t.addEventListener('click',()=>{
    t.classList.toggle('off');const key=t.dataset.tgl;state[key]=!t.classList.contains('off');
    if(s.key==='license')updateNext(s);
  }));
  // multi-select option cards
  copyEl.querySelectorAll('.opt-card').forEach(c=>c.addEventListener('click',()=>{
    const g=c.dataset.group,k=c.dataset.key;
    c.classList.toggle('sel');
    const arr=state[g];const idx=arr.indexOf(k);
    if(c.classList.contains('sel')){if(idx<0)arr.push(k);}else{if(idx>=0)arr.splice(idx,1);}
  }));
  // segmented (single)
  copyEl.querySelectorAll('.sg').forEach(sg=>sg.addEventListener('click',()=>{
    copyEl.querySelectorAll('.sg').forEach(x=>x.classList.remove('sel'));sg.classList.add('sel');state.report=sg.dataset.seg;
  }));
  copyEl.querySelectorAll('.browse').forEach(b=>b.addEventListener('click',()=>{
    const inp=b.parentElement.querySelector('input');inp.style.borderColor='';inp.focus();
  }));
  // location step — fill OS-aware install path / PATH bin / disk from the real profile
  if(s.key==='location'){
    const pr=P();
    if(!state.installEdited)state.installDir=pr.install.dir;   // follow the live profile until the user types
    const ip=document.getElementById('instPath');
    if(ip){ ip.value=state.installDir;
      ip.addEventListener('input',()=>{ state.installEdited=true; state.installDir=ip.value; const bp=document.getElementById('binPath'); if(bp)bp.textContent=binOf(ip.value); }); }
    const bp=document.getElementById('binPath'); if(bp)bp.textContent=binOf(state.installDir)||pr.install.bin;
    const pl=document.getElementById('pathLabelTxt'); if(pl)pl.textContent=pr.install.pathLabel;
    const dh=document.getElementById('diskHint'); if(dh)dh.textContent=pr.storage.label||'on-device';
  }
  // alerts step — address the email channel to the signed-in user
  if(s.key==='alerts'){
    const em=document.getElementById('alertEmail'); if(em&&USEREMAIL)em.textContent=USEREMAIL;
  }
  // done summary reflects choices
  if(s.key==='done'){
    const dp=document.getElementById('donePath');if(dp)dp.textContent=pathDoneText();
    const a=document.getElementById('doneAlert');if(a)a.textContent='Browser alerts · '+state.alert.length+' channel'+(state.alert.length!==1?'s':'')+' active';
    const r=document.getElementById('doneRep');if(r)r.textContent='Reports scheduled · '+state.report;
    const sy=document.getElementById('doneSync');if(sy)sy.textContent='Local sync online · '+state.sync.length+' source'+(state.sync.length!==1?'s':'');
  }
}

/* ===== system scan animation ===== */
let scanComplete=false;
function runScan(){
  scanComplete=false;updateNext(steps[i]);
  // Pull REAL machine facts (Rust get_system_profile + detect_browsers). The
  // animation below reveals them row by row; values are computed once here.
  const pr=P(), B=BROWSERS||{};
  const brNames=(B.browsers||[]).map(x=>x.name);
  const brValue=brNames.length?brNames.join(' · '):'none detected';
  const histCount=(B.withHistory!=null)?B.withHistory:(B.browsers||[]).filter(x=>x.historyAvailable).length;
  const osValue=pr.os.pretty+(pr.os.version?(' · '+pr.os.version):'');
  const cpuValue=(pr.cpu.brand&&pr.cpu.brand!=='Processor'?pr.cpu.brand+' · ':'')+(pr.cpu.cores||'?')+' cores · '+(pr.cpu.arch||'');
  const nv=pr.network.interfaces;
  const netValue=(nv==null||nv===''||nv==='—')?'detected':(nv+' active');
  const rows=[
    ['<path d="M4 4h16v12H4zM8 20h8M10 16v4"/>','Operating system',osValue],
    ['<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/>','Processor',cpuValue],
    ['<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7v10M10 7v10M14 7v10M18 7v10"/>','Memory',pr.memory.label||'on-device'],
    ['<path d="M4 7h6l2 2h8v9H4z"/>','Storage',pr.storage.label||'on-device'],
    ['<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>','Network interfaces',netValue],
    ['<path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/>','Installed browsers',brValue],
    ['<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>','Browser history sources',histCount+(histCount===1?' source':' sources')+' · on-device'],
    ['<rect x="4" y="4" width="16" height="16" rx="2"/>','Security baseline','calibrated']
  ];
  const list=document.getElementById('scanList');
  list.innerHTML=rows.map((r,k)=>`<div class="sysrow ${k===0?'':'wait'}" data-k="${k}"><svg class="sr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${r[0]}</svg><span class="sr-l">${r[1]}</span><span class="sr-v" data-v>scanning…</span><span class="sr-st"><span class="sp"></span><svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>`).join('');
  const items=[...list.children];let k=0;
  clearInterval(scanTimer);
  scanTimer=setInterval(()=>{
    if(k>=items.length){clearInterval(scanTimer);scanComplete=true;updateNext(steps[i]);return;}
    const row=items[k];row.classList.remove('wait');
    setTimeout(()=>{row.classList.add('done');row.querySelector('[data-v]').textContent=rows[k][2];
      if(items[k+1])items[k+1].classList.remove('wait');k++;},520);
  },560);
}

/* ===== install animation ===== */
let instComplete=false;
function runInstall(){
  instComplete=false;updateNext(steps[i]);
  const pr=P();
  // Real action: register CyberForge on the user PATH (Rust add_to_path). Fire it
  // once at the start; its result feeds the log line + the final summary row.
  pathResult=null;
  if(state.path){
    INV('add_to_path',{installDir:state.installDir||''})
      .then(r=>{pathResult=r;})
      .catch(e=>{pathResult={success:false,error:String((e&&e.message)||e)};});
  }
  const pathBin=binOf(state.installDir)||pr.install.bin;
  const phases=[
    ['Extracting program files','1,842 files'],
    ['Registering CyberForge Sentinel service','service ok'],
    state.path?['Adding CyberForge to your '+(pr.install.kind==='windows'?'user PATH':'shell PATH'),pathBin]:['Skipping PATH registration','skipped'],
    ['Provisioning local threat database','48k IOCs'],
    ['Initializing browser vulnerability monitor',state.alert.length+' channels'],
    ['Scheduling report engine',state.report],
    ['Linking local sync sources',state.sync.length+' sources'],
    ['Starting agent core','agentic mode'],
    ['Verifying installation integrity','SHA-256 ok']
  ];
  const fill=document.getElementById('instFill'),pct=document.getElementById('instPct'),phaseEl=document.getElementById('instPhase'),log=document.getElementById('instLog');
  let p=0,k=0;log.innerHTML='';
  clearInterval(instTimer);
  instTimer=setInterval(()=>{
    p+=Math.random()*7+6;if(p>100)p=100;
    fill.style.width=p+'%';pct.textContent=Math.round(p)+'%';
    const idx=Math.min(phases.length-1,Math.floor(p/100*phases.length));
    while(k<=idx&&k<phases.length){
      phaseEl.textContent=phases[k][0]+'…';
      const now=new Date();const ts=String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
      const el=document.createElement('div');el.className='il';
      el.innerHTML='<span class="t">'+ts+'</span><span style="color:var(--dim)">'+phases[k][0]+'</span><span class="ok">'+phases[k][1]+'</span>';
      log.appendChild(el);while(log.children.length>6)log.firstChild.remove();k++;
    }
    if(p>=100){clearInterval(instTimer);phaseEl.textContent='Installation complete';instComplete=true;updateNext(steps[i]);
      INV('mark_installed',{installDir:state.installDir||''}).catch(()=>{});   // one-time gate: never run the wizard again
      setTimeout(()=>{if(steps[i].key==='install'){go(1);}},700);}
  },360);
}

/* ===== navigation ===== */
function go(dir){
  const s=steps[i];
  // gate forward
  if(dir>0){
    if(s.key==='license'&&!(state.lic&&state.consent))return;
    if(s.key==='scan'&&!scanComplete)return;
    if(s.key==='install'&&!instComplete)return; // block manual skip only WHILE installing; allow the auto-advance once done
  }
  const ni=i+dir;if(ni<0||ni>=steps.length)return;
  i=ni;maxReached=Math.max(maxReached,i);render();
}
nextEl.addEventListener('click',e=>{if(steps[i].key==='done')return;e.preventDefault();go(1);});
backEl.addEventListener('click',()=>go(-1));

/* Boot: render instantly with the user-agent fallback so the window never hangs,
   then pull the REAL machine profile, installed browsers (+ history) and the
   signed-in user from Rust in the background. The local profile/browser calls
   are fast and land well before the user reaches the data-driven steps; the
   user lookup is a network call, so it never blocks the UI. */
function refreshIfDataStep(){
  const key=steps[i].key;
  if(key==='location'||key==='alerts') render();   // scan is excluded so its animation isn't restarted
}
function boot(){
  render();
  INV('get_system_profile').then(r=>{ if(r&&r.data){ PROFILE=r.data; refreshIfDataStep(); } }).catch(()=>{});
  INV('detect_browsers').then(b=>{ if(b&&b.data){ BROWSERS=b.data; refreshIfDataStep(); } }).catch(()=>{});
  INV('auth_get_user').then(u=>{ if(u&&u.user&&u.user.email){ USEREMAIL=u.user.email; const em=document.getElementById('alertEmail'); if(em)em.textContent=USEREMAIL; } }).catch(()=>{});
}
boot();