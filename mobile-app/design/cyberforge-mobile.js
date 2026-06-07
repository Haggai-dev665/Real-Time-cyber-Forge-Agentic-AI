/* ============================================================
   CyberForge Mobile — standalone app (vanilla JS, no framework)
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- icons ---------------- */
  const P = {
    shield: ["M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"],
    shieldCheck: ["M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z", "m9 12 2 2 4-4"],
    bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10 21a2 2 0 0 0 4 0"],
    bot: ["M4 7h16v12H4z", "M12 3v4M8 12h.01M16 12h.01M9 16h6"],
    phone: ["M7 2h10v20H7z", "M11 18h2"],
    desktop: ["M3 4h18v12H3z", "M8 20h8M12 16v4"],
    globe: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"],
    bolt: ["M13 2 3 14h7l-1 8 10-12h-7l1-8Z"],
    puzzle: ["M9 3a2 2 0 0 1 4 0c0 1 1 1 2 1h3v3c0 1 0 2 1 2a2 2 0 0 1 0 4c-1 0-1 1-1 2v3h-3c-1 0-2 0-2 1a2 2 0 0 1-4 0c0-1-1-1-2-1H3v-3c0-1 0-2-1-2a2 2 0 0 1 0-4c1 0 1-1 1-2V4h3c1 0 2 0 2-1Z"],
    check: ["M20 6 9 17l-5-5"],
    x: ["M18 6 6 18M6 6l12 12"],
    chevR: ["M9 6l6 6-6 6"],
    chevL: ["M15 6l-6 6 6 6"],
    refresh: ["M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5"],
    alert: ["m12 2 10 18H2Z", "M12 9v5M12 17h.01"],
    lock: ["M5 11h14v9H5z", "M8 11V8a4 4 0 0 1 8 0v3"],
    eye: ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"],
    activity: ["M3 12h4l2 6 4-12 2 6h6"],
    box: ["M3 7l9-4 9 4-9 4Z", "M3 7v10l9 4 9-4V7"],
    radar: ["M12 12 19 8M12 12v9", "M12 3a9 9 0 1 0 9 9"],
    nodes: ["M6 6h.01M18 6h.01M12 18h.01", "M7 7 11 16M17 7 13 16M8 6h8"],
    grid: ["M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
    file: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z", "M14 3v5h5"],
    clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 8v4l3 2"],
    cal: ["M4 5h16v16H4zM4 9h16M9 3v4M15 3v4"],
    brain: ["M12 3a4 4 0 0 0-4 4 4 4 0 0 0-1 7 4 4 0 0 0 5 4 4 4 0 0 0 5-4 4 4 0 0 0-1-7 4 4 0 0 0-4-4Z"],
    plug: ["M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v6"],
    gear: ["M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z", "M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0 1.6 1.6 0 0 0-2.7-1.1 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 3 13.4a2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.5-2.4 2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 10 4.6V3a2 2 0 0 1 4 0 1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8A1.6 1.6 0 0 0 19.4 9"],
    search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "m20 20-3.5-3.5"],
    spark: ["M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"],
    flask: ["M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"],
    eyeoff: ["M2 12s4-7 10-7c2 0 3.7.6 5.2 1.5M22 12s-4 7-10 7c-2 0-3.7-.6-5.2-1.5", "M3 3l18 18"],
    list: ["M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"],
  };
  function svg(key, o) {
    o = o || {};
    const s = o.size || 20, c = o.color || "currentColor", w = o.sw || 1.8;
    const paths = (P[key] || []).map(d => `<path d="${d}"/>`).join("");
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o.style ? ` style="${o.style}"` : ""}>${paths}</svg>`;
  }
  const C = {
    bg: "#070b14", text: "#e8eef8", dim: "#90a0b8", faint: "#5d6c84",
    amber: "#f5a623", amber2: "#ffb84d", cyan: "#2bd4ee", green: "#43e08a",
    red: "#f4495e", orange: "#f69d39", sage: "#869b7e", blue: "#5aa9e6", line: "rgba(132,162,205,0.16)",
  };
  const sevC = { critical: C.red, high: C.amber2, medium: C.cyan, low: C.sage };

  /* ---------------- data ---------------- */
  const NOTIFS = [
    { id: 1, sev: "critical", cat: "browser", title: "Malicious extension blocked", src: "free-prizes-login.xyz", time: "2m", unread: true,
      desc: "A browser extension tried to read saved credentials from Chrome and beacon them to an unclassified host.",
      tl: [["00:00", "Extension requested cookie access"], ["00:01", "Outbound TLS to 193.43.18.77"], ["00:02", "Credential store read attempt"], ["00:02", "Auto-blocked + session severed"]],
      iocs: [["domain", "free-prizes-login.xyz"], ["c2", "cdn-sync.duckdns.org"], ["family", "RedLine Stealer"]],
      rec: "Session severed automatically. Remove the extension on your desktop." },
    { id: 2, sev: "high", cat: "network", title: "Suspicious outbound connection", src: "10.42.7.118 → 5432", time: "14m", unread: true,
      desc: "A process opened an unexpected connection to an internal database port right after a browser download.",
      tl: [["00:00", "Download: svc_update.dll"], ["00:03", "Process spawned"], ["00:05", "Connect → 10.42.3.4:5432"], ["00:06", "Flagged for review"]],
      iocs: [["host", "10.42.7.118"], ["port", "5432 / postgres"], ["file", "svc_update.dll"]],
      rec: "Review the process on MacBook Pro and isolate if unrecognized." },
    { id: 3, sev: "medium", cat: "browser", title: "Tracker network expanded", src: "ads.tracker-net.io", time: "1h", unread: false,
      desc: "Three new third-party trackers were observed and added to the local block list.",
      tl: [["00:00", "New trackers detected ×3"], ["00:01", "Added to local blocklist"]],
      iocs: [["domain", "ads.tracker-net.io"], ["count", "3 trackers"]],
      rec: "No action needed — handled automatically." },
    { id: 4, sev: "low", cat: "network", title: "New device on network", src: "Wi-Fi · forge-home", time: "3h", unread: false,
      desc: "An unrecognized device joined your trusted Wi-Fi network.",
      tl: [["00:00", "DHCP lease 192.168.1.51"], ["00:01", "Fingerprinted: IoT camera"]],
      iocs: [["mac", "a4:cf:12:…:9b"], ["type", "IoT camera"]],
      rec: "Confirm this device is yours." },
  ];

  /* ---------------- state + timers ---------------- */
  const S = { connected: false, step: "intro", tab: "home", route: null, detail: null, resolved: null, filter: "all", toast: null, toastDone: false };
  let TI = [], TO = [], RAF = null;
  const every = (ms, fn) => { TI.push(setInterval(fn, ms)); };
  const after = (ms, fn) => { TO.push(setTimeout(fn, ms)); };
  function clearAll() { TI.forEach(clearInterval); TO.forEach(clearTimeout); TI = []; TO = []; if (RAF) cancelAnimationFrame(RAF), RAF = null; }

  /* ---------------- small builders ---------------- */
  const live = (c) => `<span class="live" style="--lc:${c};width:7px;height:7px"></span>`;
  function ring(v, size, sw, color, glow) {
    const r = (size - sw) / 2, CC = 2 * Math.PI * r;
    return `<div class="ringwrap" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(126,148,184,.14)" stroke-width="${sw}"/>
      <circle class="rv" data-t="${(CC*(1-v/100)).toFixed(2)}" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${CC.toFixed(2)}" stroke-dashoffset="${CC.toFixed(2)}" style="transition:stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1);${glow !== false ? `filter:drop-shadow(0 0 6px ${color})` : ""}"/></svg>`;
  }
  const ringClose = `</div>`;
  function mark(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 60 60" fill="none"><rect x="2" y="2" width="56" height="56" rx="13" fill="#101826" stroke="var(--line2)"/><path d="M16 44 L30 15 L44 44 Z" fill="${C.orange}"/><path d="M23.5 44 L30 30 L36.5 44 Z" fill="#101826"/><circle cx="30" cy="44" r="3" fill="${C.sage}"/></svg>`;
  }
  function spark(color, n) {
    n = n || 18; let pts = "";
    for (let i = 0; i < n; i++) pts += `${(i * (100 / (n - 1))).toFixed(1)},${(36 - Math.random() * 30).toFixed(1)} `;
    return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.4" opacity=".75"/></svg>`;
  }
  function bars(rows) {
    return rows.map(r => `<div style="padding:9px 14px"><div style="display:flex;justify-content:space-between;font-size:12.5px"><span>${r[0]}</span><span class="mono" style="color:${r[2]}">${r[1]}%</span></div><div class="barline"><i style="width:${r[1]}%;background:${r[2]}"></i></div></div>`).join("");
  }

  /* ---------------- status bar / frame ---------------- */
  function statusBar() {
    const t = new Date(); const hh = ((t.getHours() + 11) % 12) + 1;
    return `<div class="statusbar"><div>${hh}:${String(t.getMinutes()).padStart(2, "0")}</div>
      <div class="sb-r">${svg("activity", { size: 16, color: C.text, sw: 2 })}
      <svg viewBox="0 0 24 16" width="22" height="14" fill="none"><rect x="1" y="3" width="18" height="10" rx="2.5" stroke="${C.text}" stroke-width="1.4"/><rect x="3" y="5" width="13" height="6" rx="1" fill="${C.green}"/><rect x="20" y="6" width="2" height="4" rx="1" fill="${C.text}"/></svg></div></div>`;
  }

  /* ---------------- pairing flow ---------------- */
  function diagram(active, paired) {
    const node = (icon, lab, color, on, pulse) =>
      `<div class="dnode"><div class="ic${on ? " on" : ""}" style="--nc:${color}">${pulse ? `<span class="ping"></span>` : ""}${svg(icon, { size: 24, color: on ? color : C.faint })}</div><div class="lab${on ? " on" : ""}">${lab}</div></div>`;
    const link = (on) => `<div class="dlink">${on ? `<span class="flow-dot"></span>` : ""}</div>`;
    return `<div class="diagram">${node("phone", "This phone", C.cyan, true)}${link(active)}${node("puzzle", "Extension", C.amber2, active || paired, active)}${link(paired)}${node("desktop", "Desktop", paired ? C.green : C.faint, paired)}</div>`;
  }
  function flowHeader() {
    return `<div class="flow-h">${mark(32)}<div><div class="nm">Cyber<span class="fg">Forge</span></div><div class="sub">DEVICE PAIRING</div></div></div>`;
  }
  function flowScreen() {
    const s = S.step;
    let body = "";
    if (s === "intro") body = `
      ${diagram(false, false)}
      <div class="flow-body">
        <div class="kick" style="color:${C.amber2};letter-spacing:1.5px">STEP 1 · CONNECT</div>
        <h1>Sync with your <span style="color:${C.orange}">desktop</span></h1>
        <p>CyberForge mobile mirrors your desktop agent through the <b style="color:${C.text}">CyberForge browser extension</b>. Install it in this device's Chrome and we'll pair them securely.</p>
        <div class="card" style="padding:14px;margin-top:20px;display:flex;gap:12px;align-items:center">
          <div style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--cyanDim);color:${C.cyan};border:1px solid var(--line2)">${svg("lock", { size: 17, color: C.cyan })}</div>
          <div style="flex:1"><div style="font-size:13px;font-weight:600">End-to-end encrypted</div><div class="mono" style="font-size:10px;color:${C.faint}">No data leaves your devices</div></div>
        </div>
        <div style="flex:1"></div>
        <button class="bigbtn btn" data-act="check">${svg("eye", { size: 16, color: "#1a1206" })} Check for extension</button>
      </div>`;
    else if (s === "scanning") body = `<div class="flow-center">
      <div class="radar"><div class="rg" style="inset:0"></div><div class="rg" style="inset:18px"></div><div class="rg" style="inset:36px"></div><div class="sweep"></div><div style="position:absolute;inset:0;display:grid;place-items:center">${svg("puzzle", { size: 26, color: C.cyan })}</div></div>
      <div class="kick" style="color:${C.cyan};letter-spacing:1.5px;margin-top:18px">SCANNING BROWSER</div>
      <h2>Looking for the<br>CyberForge extension…</h2><p class="c">Checking Chrome on this device.</p></div>`;
    else if (s === "notfound") body = `<div class="flow-center">
      <div class="glyphbox" style="background:var(--amberDim)">${svg("puzzle", { size: 42, color: C.amber2 })}</div>
      <div class="kick" style="color:${C.amber2};letter-spacing:1.5px;margin-top:22px">NOT INSTALLED</div>
      <h2>Extension not found</h2><p class="c">Add CyberForge to Chrome to pair this phone with your desktop.</p>
      <div class="card" style="padding:13px;margin-top:20px;width:100%;display:flex;gap:11px;align-items:center">
        <div style="width:38px;height:38px;border-radius:9px;background:#0d1320;border:1px solid var(--line2);display:grid;place-items:center">${svg("globe", { size: 18, color: C.cyan })}</div>
        <div style="flex:1;text-align:left"><div style="font-size:13px;font-weight:600">CyberForge for Chrome</div><div class="mono" style="font-size:9.5px;color:${C.faint}">chrome web store · 4.9 ★ · verified</div></div>
      </div>
      <div style="flex:1"></div>
      <button class="bigbtn btn" data-act="addext">${svg("puzzle", { size: 16, color: "#1a1206" })} Add to Chrome</button></div>`;
    else if (s === "installing") body = `<div class="flow-center">
      <div class="spin" style="width:70px;height:70px;border-width:4px"></div>
      <div class="kick" style="color:${C.amber2};letter-spacing:1.5px;margin-top:22px">INSTALLING</div>
      <h2>Adding the extension…</h2><p class="c">Granting browser permissions.</p>
      <div class="bar"><i style="width:100%"></i></div></div>`;
    else if (s === "pairing") body = `<div class="flow-center">${diagram(true, false)}
      <div class="kick" style="color:${C.cyan};letter-spacing:1.5px">PAIRING</div>
      <h2>Connecting to desktop…</h2>
      <div class="card" style="padding:13px;margin-top:16px;width:100%;display:flex;gap:11px;align-items:center">
        <div style="width:38px;height:38px;border-radius:9px;background:var(--tile);border:1px solid var(--line2);display:grid;place-items:center">${svg("desktop", { size: 18, color: C.cyan })}</div>
        <div style="flex:1;text-align:left"><div style="font-size:13px;font-weight:600">MacBook Pro</div><div class="mono" style="font-size:9.5px;color:${C.faint}">forge-desktop · 192.168.1.24</div></div>
        <div class="spin" style="width:20px;height:20px"></div></div></div>`;
    else if (s === "done") body = `<div class="flow-center">
      <div class="success"><span class="ring"></span><div class="core"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="${C.green}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 25 L21 32 L35 17"/></svg></div></div>
      <div class="kick" style="color:${C.green};letter-spacing:1.5px;margin-top:22px">CONNECTED</div>
      <h2>Paired with desktop</h2><p class="c">This phone now mirrors your CyberForge agent in real time.</p>
      <div class="card" style="padding:13px;margin-top:18px;width:100%;display:flex;gap:11px;align-items:center;border-color:rgba(67,224,138,.3)">${svg("shieldCheck", { size: 20, color: C.green })}<div style="flex:1;text-align:left;font-size:13px;font-weight:600">Extension active · MacBook Pro online</div>${live(C.green)}</div>
      <div style="flex:1"></div>
      <button class="bigbtn green btn" data-act="enter">${svg("shield", { size: 16, color: "#04140b" })} Enter dashboard</button></div>`;
    return `<div class="flow">${flowHeader()}${body}</div>`;
  }

  /* ---------------- in-app shell ---------------- */
  function topbar(title, sub, liveOn, back) {
    return `<div class="topbar">${back ? `<button class="back btn" data-act="back">${svg("chevL", { size: 18 })}</button>` : ""}
      <div style="flex:1"><h1>${title}</h1><div class="tsub">${liveOn ? live(C.cyan) : ""}<span>${sub}</span></div></div>${back ? "" : mark(36)}</div>`;
  }

  /* ---------- HOME / dashboard ---------- */
  function dashboard() {
    const feed = [["Browser scan complete", "now", C.green], ["Blocked tracker · ads.tracker-net.io", "2m", C.amber2], ["Synced with MacBook Pro", "5m", C.cyan]];
    return `${topbar("Protected", "MacBook Pro · synced now", false)}
    <div class="scroll" id="feedScroll"><div style="padding:4px 18px 0;animation:mFadeUp .5s both">
      <div class="card" style="padding:22px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(120% 90% at 50% 0%,rgba(67,224,138,.08),var(--surface))">
        ${ring(96, 172, 14, C.green)}<div class="rc"><div class="mono" style="font-size:40px;font-weight:600;color:${C.green};line-height:1">96</div><div class="mono" style="font-size:9px;color:${C.faint};margin-top:3px">SECURITY SCORE</div></div>${ringClose}
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">${live(C.green)}<span class="mono" style="font-size:11px;color:${C.green}">All systems protected</span></div>
      </div>
      <div class="stats3" style="margin-top:14px">
        ${[["12", "blocked today", C.amber2, "shield"], ["0", "active threats", C.green, "check"], ["3", "devices", C.cyan, "desktop"]].map(s => `<div class="card stat">${svg(s[3], { size: 16, color: s[2], style: "margin:0 auto" })}<div class="v" style="color:${s[2]}">${s[0]}</div><div class="l">${s[1]}</div></div>`).join("")}
      </div>
      <div class="card" style="padding:14px;margin-top:14px;display:flex;align-items:center;gap:12px;border-color:rgba(43,212,238,.25)">
        <div style="position:relative;width:40px;height:40px;border-radius:11px;background:var(--cyanDim);border:1px solid var(--line2);display:grid;place-items:center">${svg("puzzle", { size: 19, color: C.cyan })}<span style="position:absolute;inset:-3px;border-radius:13px;border:1.4px solid ${C.cyan};opacity:.5;animation:mPing 2.4s ease-out infinite"></span></div>
        <div style="flex:1"><div style="font-size:13.5px;font-weight:600">Extension connected</div><div class="mono" style="font-size:10px;color:${C.faint}">Chrome · syncing live</div></div>${live(C.cyan)}
      </div>
      <div class="seclabel">Live activity</div>
      <div class="card" id="liveFeed" style="overflow:hidden">${feed.map((f, i) => feedRow(f, i === 0)).join("")}</div>
      <button class="tap" data-act="detail:1" style="width:100%;height:46px;border-radius:13px;margin-top:14px;border:1px solid var(--line2);background:var(--surface2);color:var(--text);font-weight:600;font-size:13.5px;display:flex;align-items:center;justify-content:center;gap:8px">${svg("alert", { size: 15, color: C.red })} View latest alert</button>
    </div></div>`;
  }
  const feedRow = (f, first) => `<div class="feedrow"${first ? ' style="animation:mSlideIn .4s both"' : ""}><span class="fdot" style="background:${f[2]};box-shadow:0 0 6px ${f[2]}"></span><span class="ft">${f[0]}</span><span class="fm">${f[1]}</span></div>`;

  /* ---------- ALERTS ---------- */
  function alerts() {
    const cats = [["all", "All"], ["critical", "Critical"], ["browser", "Browser"], ["network", "Network"]];
    const list = NOTIFS.filter(n => S.filter === "all" || n.sev === S.filter || n.cat === S.filter);
    return `${topbar("Alerts", NOTIFS.filter(n => n.unread).length + " unread · live", true)}
    <div class="chips">${cats.map(c => `<button class="chip btn${S.filter === c[0] ? " on" : ""}" data-act="chip:${c[0]}">${c[1]}</button>`).join("")}</div>
    <div class="scroll"><div style="padding:0 18px;display:flex;flex-direction:column;gap:11px">
      ${list.map((n, i) => `<button class="card tap alert" data-act="detail:${n.id}" style="--ac:${sevC[n.sev]};animation:mFadeUp .45s ${0.05 * i}s both">
        <div class="aic">${svg(n.cat === "browser" ? "globe" : n.cat === "network" ? "activity" : "alert", { size: 18, color: sevC[n.sev] })}</div>
        <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:7px"><span class="atitle">${n.title}</span>${n.unread ? `<span style="width:7px;height:7px;border-radius:99px;background:${C.amber2};flex:none"></span>` : ""}</div>
        <div class="asrc">${n.src}</div><div style="display:flex;align-items:center;gap:8px;margin-top:8px"><span class="pill" style="--ac:${sevC[n.sev]}">${n.sev}</span><span class="mono" style="font-size:9.5px;color:${C.faint}">${n.time} ago</span></div></div>
      </button>`).join("")}
    </div></div>`;
  }

  /* ---------- AGENT ---------- */
  function agentScreen() {
    return `${topbar("Agent", "agentic mode · mirroring desktop", true)}
    <div class="scroll"><div style="padding:2px 18px 0;animation:mFadeUp .5s both">
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:13px">
        <div style="position:relative;width:52px;height:52px;border-radius:15px;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,#3a2a12,#140d04);border:1px solid rgba(245,166,35,.4);color:${C.amber2}">${svg("bot", { size: 24, color: C.amber2 })}<span style="position:absolute;inset:-3px;border-radius:17px;border:1.5px solid transparent;border-top-color:${C.amber};animation:mSpin 2.4s linear infinite"></span></div>
        <div style="flex:1"><div style="font-size:15px;font-weight:600">CyberForge Agent</div><div class="mono" style="font-size:10px;color:${C.amber2}">v2.1 · 8 agents online</div></div>
        <span style="display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:9.5px;color:${C.green};background:rgba(67,224,138,.12);border:1px solid rgba(67,224,138,.3);padding:5px 9px;border-radius:6px">${live(C.green)}ACTIVE</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
        ${[["CPU", 82, C.amber], ["Throughput", 64, C.cyan]].map(g => `<div class="card" style="padding:13px 14px;display:flex;align-items:center;gap:12px">${ring(g[1], 46, 5, g[2], false)}<div class="rc"><span class="mono" style="font-size:10px;font-weight:600">${g[1]}%</span></div>${ringClose}<div><div style="font-size:12.5px;font-weight:600">${g[0]}</div><div class="mono" style="font-size:9px;color:${C.faint}">live</div></div></div>`).join("")}
      </div>
      <div class="seclabel">Live reasoning</div>
      <div class="card console" id="agentConsole"><div style="display:flex;align-items:center;gap:7px;padding-top:4px"><div class="spin" style="width:11px;height:11px;border-top-color:${C.cyan}"></div><span class="mono" style="font-size:10px;color:${C.faint}">reasoning…</span></div></div>
    </div></div>`;
  }
  function startAgentConsole() {
    const el = document.getElementById("agentConsole"); if (!el) return;
    const lines = [["think", "Evaluating 1,204 endpoint signals…"], ["act", "Querying threat-intel for IOC matches…"], ["obs", "3 endpoints show anomalous traffic"], ["think", "Pattern matches RedLine beaconing"], ["act", "Dispatched sandbox detonation"], ["obs", "Verdict: MALICIOUS · risk 87/100"], ["warn", "Recommending endpoint isolation"], ["obs", "No lateral movement detected"]];
    const kc = { think: C.cyan, act: C.amber2, obs: C.green, warn: C.red }, kl = { think: "THINK", act: "ACT", obs: "OBS", warn: "ALERT" };
    let i = 0;
    const push = () => {
      const l = lines[i % lines.length]; i++;
      const ts = new Date().toTimeString().slice(0, 8);
      const row = document.createElement("div"); row.className = "cl";
      row.innerHTML = `<span class="ts">${ts}</span><span class="tg" style="color:${kc[l[0]]}">${kl[l[0]]}</span><span class="mg">${l[1]}</span>`;
      el.insertBefore(row, el.lastElementChild);
      const rows = el.querySelectorAll(".cl"); if (rows.length > 11) rows[0].remove();
    };
    for (let k = 0; k < 5; k++) push();
    every(1400, push);
  }

  /* ---------- GLOBE ---------- */
  function globeScreen() {
    return `${topbar("Threat Globe", "live attack map · mirroring desktop", true)}
    <div class="scroll"><div style="padding:2px 18px 0;animation:mFadeUp .5s both">
      <div class="globe-stage"><canvas id="globeCv"></canvas>
        <div style="position:absolute;left:14px;bottom:12px;display:flex;gap:18px;font-family:var(--mono)">
          <div><div style="font-size:20px;font-weight:600;color:${C.red}" id="gT">318</div><div style="font-size:8px;color:${C.faint};letter-spacing:1px">ACTIVE</div></div>
          <div><div style="font-size:20px;font-weight:600;color:${C.green}" id="gB">2041</div><div style="font-size:8px;color:${C.faint};letter-spacing:1px">BLOCKED</div></div>
        </div></div>
      <div class="seclabel">Live attack stream</div>
      <div class="card" id="atkStream" style="overflow:hidden"></div>
      <div class="seclabel">Top origins</div>
      <div class="card">${bars([["Russia", 92, C.amber], ["China", 78, C.cyan], ["N. Korea", 54, C.sage], ["Iran", 41, C.amber2]])}</div>
    </div></div>`;
  }
  function startGlobe() {
    const cv = document.getElementById("globeCv"); if (!cv) return;
    const ctx = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
    function size() { const r = cv.parentElement.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return r; }
    let rb = size();
    const cx = () => rb.width / 2, cy = () => rb.height / 2, R = () => Math.min(rb.width, rb.height) * 0.36;
    const dots = []; for (let i = 0; i < 320; i++) { const th = Math.acos(2 * Math.random() - 1), ph = 2 * Math.PI * Math.random(); dots.push([th, ph]); }
    let rot = 0; const arcs = [];
    every(900, () => { arcs.push({ a: Math.random() * Math.PI * 2, t: 0, col: [C.red, C.amber, C.cyan][Math.floor(Math.random() * 3)] }); });
    function frame() {
      rot += 0.004; ctx.clearRect(0, 0, rb.width, rb.height);
      const r = R(), X = cx(), Y = cy();
      ctx.strokeStyle = "rgba(43,212,238,.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.stroke();
      dots.forEach(d => { const th = d[0], ph = d[1] + rot; const x = Math.sin(th) * Math.cos(ph), z = Math.sin(th) * Math.sin(ph), y = Math.cos(th); if (z < 0) return; ctx.fillStyle = `rgba(86,196,224,${(0.3 + z * 0.5).toFixed(2)})`; ctx.beginPath(); ctx.arc(X + x * r, Y - y * r, 1.5, 0, 7); ctx.fill(); });
      for (let i = arcs.length - 1; i >= 0; i--) { const a = arcs[i]; a.t += 0.02; if (a.t >= 1) { arcs.splice(i, 1); continue; } const ang = a.a, x1 = X + Math.cos(ang) * r * 1.4, y1 = Y + Math.sin(ang) * r * 1.4; const tt = a.t; const x = x1 + (X - x1) * tt, y = y1 + (Y - y1) * tt; ctx.fillStyle = a.col; ctx.globalAlpha = 1 - a.t * 0.4; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.fillStyle = "#13202f"; ctx.strokeStyle = "rgba(246,157,57,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 8, 0, 7); ctx.fill(); ctx.stroke();
      RAF = requestAnimationFrame(frame);
    }
    frame();
    // attack stream
    const el = document.getElementById("atkStream");
    const types = ["SQL Injection", "DDoS Probe", "Port Scan", "Brute Force", "Malware C2"], flags = ["🇷🇺", "🇨🇳", "🇰🇵", "🇮🇷", "🇧🇷"], sv = ["critical", "high", "medium"];
    const add = () => { const s = sv[Math.floor(Math.random() * (Math.random() < .4 ? 2 : 3))]; const row = document.createElement("div"); row.className = "feedrow"; row.style.animation = "mSlideIn .4s both"; row.innerHTML = `<span style="font-size:15px">${flags[Math.floor(Math.random() * flags.length)]}</span><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">${types[Math.floor(Math.random() * types.length)]}</div><div class="mono" style="font-size:9px;color:${C.faint}">${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.x.x</div></div><span class="pill" style="--ac:${sevC[s]}">${s}</span>`; el.insertBefore(row, el.firstChild); while (el.children.length > 6) el.lastChild.remove(); };
    for (let k = 0; k < 5; k++) add(); every(1600, add);
    every(1600, () => { const t = document.getElementById("gT"), b = document.getElementById("gB"); if (t) t.textContent = 300 + Math.floor(Math.random() * 30); if (b) b.textContent = +b.textContent + Math.floor(Math.random() * 4); });
  }

  /* ---------- MORE menu ---------- */
  const SUB = {
    sandbox: { t: "Sandbox", s: "detonation chamber", i: "flask", c: C.red },
    intel: { t: "Threat Intelligence", s: "IOC feeds · actors", i: "radar", c: C.amber2 },
    browser: { t: "Browser Intelligence", s: "sessions · trackers", i: "globe", c: C.cyan },
    assistant: { t: "AI Assistance", s: "ask the agent", i: "spark", c: C.orange },
    orchestrator: { t: "8-Agent Orchestrator", s: "multi-agent control", i: "nodes", c: C.amber2 },
    pipeline: { t: "Signal Pipeline", s: "ingest → reason", i: "activity", c: C.cyan },
    models: { t: "Model Inference", s: "served models", i: "brain", c: C.sage },
    tasks: { t: "Active Tasks", s: "queue · in flight", i: "check", c: C.green },
    scheduled: { t: "Scheduled", s: "automation jobs", i: "cal", c: C.cyan },
    memory: { t: "Memory", s: "knowledge graph", i: "brain", c: C.sage },
    investigations: { t: "Investigations", s: "open cases", i: "search", c: C.amber2 },
    timeline: { t: "Incident Timeline", s: "chronology", i: "clock", c: C.cyan },
    reports: { t: "Reports", s: "generated docs", i: "file", c: C.sage },
    integrations: { t: "Integrations", s: "data connectors", i: "plug", c: C.green },
    devices: { t: "Devices", s: "paired hardware", i: "desktop", c: C.cyan },
    settings: { t: "Settings", s: "account · agent policy", i: "gear", c: C.dim },
  };
  function moreMenu() {
    const featured = ["sandbox", "intel", "orchestrator", "browser"];
    const rest = ["assistant", "pipeline", "models", "tasks", "scheduled", "memory", "investigations", "timeline", "reports", "integrations", "devices", "settings"];
    return `${topbar("Explore", "every CyberForge screen", false)}
    <div class="scroll"><div style="animation:mFadeUp .5s both">
      <div class="seclabel" style="margin-left:22px">Featured</div>
      <div class="mgrid">${featured.map(k => { const m = SUB[k]; return `<button class="mtile tap" data-act="route:${k}" style="--mc:${m.c}"><div class="mi">${svg(m.i, { size: 19, color: m.c })}</div><div><div class="mt">${m.t}</div><div class="md">${m.s}</div></div></button>`; }).join("")}</div>
      <div class="seclabel" style="margin-left:22px">All screens</div>
      <div class="card menulist" style="margin:0 18px">${rest.map(k => { const m = SUB[k]; return `<button class="mrow tap" data-act="route:${k}" style="--mc:${m.c}"><div class="mi">${svg(m.i, { size: 16, color: m.c })}</div><div style="flex:1"><div style="font-size:13.5px;font-weight:600">${m.t}</div><div class="mono" style="font-size:9.5px;color:${C.faint}">${m.s}</div></div>${svg("chevR", { size: 16, color: C.faint })}</button>`; }).join("")}</div>
    </div></div>`;
  }

  /* ---------- SUB-SCREENS ---------- */
  function subScreen(k) {
    const m = SUB[k];
    const head = topbar(m.t, m.s, ["intel", "orchestrator", "browser", "pipeline", "tasks"].includes(k), true);
    return head + `<div class="scroll"><div style="padding:2px 18px 0;animation:mFadeUp .5s both">${(SUBBODY[k] || (() => `<div class="card" style="padding:20px;text-align:center;color:${C.dim}">${m.t}</div>`))()}</div></div>`;
  }
  function statTiles(arr) { return `<div class="stats3">${arr.map(s => `<div class="card stat"><div class="v" style="color:${s[2]}">${s[0]}</div><div class="l">${s[1]}</div></div>`).join("")}</div>`; }
  const SUBBODY = {
    sandbox: () => `${statTiles([["1", "running", C.amber2], ["87", "risk", C.red], ["6", "events", C.cyan]])}
      <div class="seclabel">Detonation chamber</div>
      <div class="card" style="padding:18px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(120% 90% at 50% 0%,rgba(244,73,94,.07),var(--surface))">
        <div style="position:relative;width:96px;height:96px;display:grid;place-items:center">
          <span style="position:absolute;inset:0;border-radius:99px;border:2px solid transparent;border-top-color:${C.amber};animation:mSpin 2.4s linear infinite"></span>
          <span style="position:absolute;inset:14px;border-radius:99px;border:2px solid transparent;border-bottom-color:${C.cyan};animation:mSpin 3.4s linear infinite reverse"></span>
          ${svg("shield", { size: 32, color: C.amber2 })}</div>
        <div class="mono" style="font-size:11px;color:${C.dim};margin-top:14px">analyzing svc_update.dll…</div></div>
      <div class="seclabel">Behavior timeline</div>${timelineCard([["+1.1s", "Outbound TLS to 193.43.18.*", C.amber2], ["+2.8s", "Registry persistence added", C.amber2], ["+3.6s", "Process injection → explorer", C.red], ["+4.3s", "C2 beacon · duckdns.org", C.red]])}
      <div class="card" style="padding:14px;margin-top:14px;display:flex;align-items:center;gap:10px;border-color:rgba(244,73,94,.3)">${svg("alert", { size: 18, color: C.red })}<div style="flex:1;font-size:13px;font-weight:600;color:${C.red}">Verdict: MALICIOUS · RedLine Stealer</div></div>`,
    intel: () => `${statTiles([["2.4M", "IOCs", C.amber2], ["14", "feeds", C.cyan], ["38", "actors", C.red]])}
      <div class="seclabel">Live indicators</div><div class="card" id="iocList" style="overflow:hidden"></div>
      <div class="seclabel">Tracked actor</div>
      <div class="card" style="padding:15px">
        <div style="display:flex;align-items:center;gap:12px"><div style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgba(244,73,94,.08);border:1px solid rgba(244,73,94,.3);color:${C.red}">${svg("shield", { size: 22, color: C.red })}</div><div><div style="font-size:15px;font-weight:600">Crimson Drift</div><div class="mono" style="font-size:10px;color:${C.faint}">FORGE-C04 · financial</div></div></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">${["T1566 Phishing", "T1059 Exec", "T1071 C2", "T1555 Creds"].map(t => `<span class="mono" style="font-size:9px;padding:4px 8px;border-radius:5px;background:var(--tile);border:1px solid var(--line);color:${C.dim}">${t}</span>`).join("")}</div></div>`,
    browser: () => `${statTiles([["1", "session", C.cyan], ["3", "trackers", C.amber2], ["0", "threats", C.green]])}
      <div class="seclabel">Active session</div>
      <div class="card" style="padding:14px;display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:11px;background:var(--cyanDim);border:1px solid var(--line2);display:grid;place-items:center">${svg("globe", { size: 19, color: C.cyan })}</div><div style="flex:1"><div style="font-size:13.5px;font-weight:600">Google Chrome</div><div class="mono" style="font-size:10px;color:${C.faint}">v148 · 1 tab monitored</div></div>${live(C.green)}</div>
      <div class="seclabel">HTTP activity</div><div class="card" id="httpList" style="overflow:hidden"></div>`,
    assistant: () => `<div class="card" style="padding:16px">
        <div style="display:flex;gap:10px;margin-bottom:12px">${svg("spark", { size: 18, color: C.orange })}<div style="font-size:13.5px;font-weight:600">Ask CyberForge</div></div>
        <div style="background:var(--tile);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:13px;color:${C.dim};line-height:1.5">What changed in my security posture today?</div>
        <div style="margin-top:10px;padding:12px;border-radius:12px;background:var(--amberDim);border:1px solid rgba(245,166,35,.25);font-size:13px;line-height:1.55"><b>3 changes:</b> blocked a malicious extension, added 3 trackers to your blocklist, and verified the desktop sync. No active threats remain.</div></div>
      <div class="seclabel">Suggested</div>
      <div class="card menulist">${["Summarize today's alerts", "Explain the RedLine detection", "Run a full device sweep"].map(q => `<button class="mrow tap" style="--mc:${C.orange}"><div class="mi">${svg("spark", { size: 15, color: C.orange })}</div><span style="flex:1;font-size:13px">${q}</span>${svg("chevR", { size: 15, color: C.faint })}</button>`).join("")}</div>`,
    orchestrator: () => `${statTiles([["8/8", "agents", C.green], ["14", "tasks", C.amber2], ["1.8k", "msg/s", C.cyan]])}
      <div class="seclabel">Agent roster</div>
      <div class="card menulist">${[["Perception", "correlating signals", C.cyan, 78], ["Sandbox", "detonating sample", C.red, 91], ["Containment", "awaiting approval", C.amber2, 18], ["Forensics", "acquiring dump", C.cyan, 44]].map(a => `<div class="mrow"><div class="mi" style="--mc:${a[2]}">${svg("bot", { size: 15, color: a[2] })}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${a[0]}</div><div class="mono" style="font-size:9.5px;color:${C.faint}">${a[1]}</div></div><span class="mono" style="font-size:11px;font-weight:600;color:${a[2]}">${a[3]}%</span></div>`).join("")}</div>`,
    pipeline: () => `<div class="seclabel">Signal pipeline</div>
      <div class="card" style="padding:6px 0">${[["Ingest", "1,204/s", C.green], ["Normalize", "1,198/s", C.green], ["Analyze", "running", C.amber2], ["Reason", "queued", C.faint]].map((p, i) => `<div class="listrow"><span style="width:9px;height:9px;border-radius:99px;background:${p[2]};box-shadow:0 0 6px ${p[2]}"></span><span style="flex:1;font-size:13px">${p[0]}</span><span class="mono" style="font-size:10px;color:${C.faint}">${p[1]}</span></div>`).join("")}</div>
      <div class="seclabel">Throughput</div><div class="card" style="padding:14px">${spark(C.cyan)}</div>`,
    models: () => `${statTiles([["4", "served", C.green], ["18ms", "p50", C.cyan], ["99.9%", "uptime", C.amber2]])}
      <div class="seclabel">Active models</div><div class="card">${bars([["threat-classifier-v4", 96, C.green], ["anomaly-detector", 88, C.cyan], ["url-reputation", 74, C.amber2]])}</div>`,
    tasks: () => `<div class="seclabel">In flight</div>
      <div class="card menulist">${[["Correlate telemetry", "running", C.amber2], ["Sandbox: svc_update.dll", "94%", C.amber2], ["Incident report #2207", "queued", C.faint], ["Sweep · 1,204 hosts", "done", C.green]].map(t => `<div class="mrow"><span style="width:8px;height:8px;border-radius:99px;background:${t[2]};box-shadow:0 0 6px ${t[2]}"></span><span style="flex:1;font-size:13px">${t[0]}</span><span class="mono" style="font-size:10px;color:${C.faint}">${t[1]}</span></div>`).join("")}</div>`,
    scheduled: () => `<div class="seclabel">Automation jobs</div>
      <div class="card menulist">${[["Full fleet sweep", "every 6h", true], ["Threat-intel sync", "hourly", true], ["Weekly report", "Mon 09:00", true], ["Model retrain", "paused", false]].map(j => `<div class="mrow"><div class="mi" style="--mc:${C.cyan}">${svg("cal", { size: 15, color: j[2] ? C.cyan : C.faint })}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${j[0]}</div><div class="mono" style="font-size:9.5px;color:${C.faint}">${j[1]}</div></div><span class="toggle${j[2] ? "" : " off"}"></span></div>`).join("")}</div>`,
    memory: () => `${statTiles([["48k", "nodes", C.amber2], ["3", "types", C.cyan], ["99%", "recall", C.green]])}
      <div class="seclabel">Recent memories</div>
      <div class="card menulist">${[["RedLine C2 pattern", "semantic", C.cyan], ["WS-4471 incident", "episodic", C.amber2], ["Isolation playbook", "procedural", C.green]].map(mm => `<div class="mrow"><div class="mi" style="--mc:${mm[2]}">${svg("brain", { size: 15, color: mm[2] })}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${mm[0]}</div><div class="mono" style="font-size:9.5px;color:${C.faint}">${mm[1]}</div></div></div>`).join("")}</div>`,
    investigations: () => `<div class="seclabel">Open cases</div>
      <div class="card menulist">${[["RedLine credential theft", "critical", C.red], ["Anomalous DB access", "high", C.amber2], ["Tracker proliferation", "low", C.sage]].map(c => `<button class="mrow tap" data-act="detail:1"><div class="mi" style="--mc:${c[2]}">${svg("search", { size: 15, color: c[2] })}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${c[0]}</div><div class="mono" style="font-size:9.5px;color:${C.faint}">case #220${Math.floor(Math.random() * 9)}</div></div><span class="pill" style="--ac:${c[2]}">${c[1]}</span></button>`).join("")}</div>`,
    timeline: () => `<div class="seclabel">Incident chronology</div>${timelineCard([["09:31", "Malicious download detected", C.red], ["09:31", "Process injection blocked", C.red], ["09:32", "Session severed", C.amber2], ["09:33", "Endpoint scanned — clean", C.green], ["09:34", "Report generated", C.cyan]])}`,
    reports: () => `<div class="seclabel">Generated reports</div>
      <div class="card menulist">${[["Daily posture summary", "today 09:00", C.green], ["RedLine incident #2207", "2h ago", C.red], ["Weekly executive brief", "Mon", C.cyan]].map(r => `<button class="mrow tap"><div class="mi" style="--mc:${r[2]}">${svg("file", { size: 15, color: r[2] })}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${r[0]}</div><div class="mono" style="font-size:9.5px;color:${C.faint}">${r[1]}</div></div>${svg("chevR", { size: 15, color: C.faint })}</button>`).join("")}</div>`,
    integrations: () => `${statTiles([["9", "connected", C.green], ["18k", "events/s", C.amber2], ["3.2TB", "today", C.cyan]])}
      <div class="seclabel">Connected sources</div>
      <div class="card menulist">${[["CrowdStrike", "4.2k/s", C.red], ["Palo Alto", "3.8k/s", C.amber2], ["Okta", "1.1k/s", C.cyan], ["AWS CloudTrail", "2.9k/s", C.sage]].map(s => `<div class="mrow"><div class="mi" style="--mc:${s[2]};font-family:var(--mono);font-weight:700;font-size:12px;color:${s[2]}">${s[0][0]}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${s[0]}</div><div class="mono" style="font-size:9.5px;color:${C.green}">connected</div></div><span class="mono" style="font-size:10px;color:${C.faint}">${s[1]}</span></div>`).join("")}</div>`,
    devices: () => `<div class="card" style="padding:16px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(120% 90% at 50% 0%,rgba(43,212,238,.07),var(--surface))">
        <div style="display:flex;align-items:center;gap:0">${devNode("phone", C.cyan)}${bridge()}${devNode("puzzle", C.amber2, true)}${bridge()}${devNode("desktop", C.green)}</div>
        <div class="mono" style="font-size:10px;color:${C.dim};margin-top:12px;text-align:center">Phone ↔ Extension ↔ Desktop · <span style="color:${C.green}">live bridge</span></div></div>
      <div class="seclabel">Paired devices</div>
      <div class="card menulist">${[["iPhone 15 Pro", "this device", C.cyan, true], ["MacBook Pro", "forge-desktop", C.green, true], ["Chrome Extension", "v2.1 bridge", C.amber2, true], ["iPad Air", "last seen 2d", C.faint, false]].map(d => `<div class="mrow" style="opacity:${d[3] ? 1 : .55}"><div class="mi" style="--mc:${d[2]}">${svg(d[0].includes("Extension") ? "puzzle" : d[0].includes("MacBook") ? "desktop" : "phone", { size: 15, color: d[2] })}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${d[0]}</div><div class="mono" style="font-size:9.5px;color:${C.faint}">${d[1]}</div></div>${d[3] ? live(d[2]) : `<span class="mono" style="font-size:9px;color:${C.faint}">offline</span>`}</div>`).join("")}</div>`,
    settings: () => `<div class="seclabel">Agent autonomy</div>
      <div class="card" style="padding:16px;background:linear-gradient(180deg,var(--amberDim),var(--surface));border-color:rgba(245,166,35,.25)">
        <div class="mono" style="font-size:13px;color:${C.amber2};font-weight:600">Level 3 · Supervised</div>
        <div style="font-size:12px;color:${C.dim};margin-top:4px;line-height:1.5">Agents stage responses automatically but need your approval before containment.</div>
        <div style="height:6px;border-radius:4px;background:rgba(130,160,200,.15);margin-top:14px;position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:75%;border-radius:4px;background:linear-gradient(90deg,${C.orange},${C.amber2})"></div><div style="position:absolute;left:75%;top:50%;width:16px;height:16px;border-radius:99px;background:#fff;border:3px solid ${C.orange};transform:translate(-50%,-50%)"></div></div></div>
      <div class="seclabel">Notifications</div>
      <div class="card">${[["Critical alerts", true], ["Browser vulnerabilities", true], ["Daily digest", false], ["Agent approvals", true]].map(o => `<div class="listrow"><span style="flex:1;font-size:13px">${o[0]}</span><button class="toggle btn${o[1] ? "" : " off"}" data-act="toggle"></button></div>`).join("")}</div>
      <div class="seclabel">Account</div>
      <div class="card"><div class="kv"><span class="k">Signed in</span><span class="v">jordan@acme-corp.io</span></div><div class="kv"><span class="k">Plan</span><span class="v" style="color:${C.amber2}">Enterprise</span></div><div class="kv"><span class="k">Version</span><span class="v">2.0.0</span></div></div>`,
  };
  function timelineCard(rows) {
    return `<div class="card timeline" style="padding:6px 14px">${rows.map((t, i) => `<div class="te"><span class="tt" style="color:${t[2]}">${t[0]}</span><span class="tk"><b style="background:${i === rows.length - 1 ? t[2] : C.faint};box-shadow:${i === rows.length - 1 ? `0 0 6px ${t[2]}` : "none"}"></b>${i < rows.length - 1 ? "<span></span>" : ""}</span><span class="tx">${t[1]}</span></div>`).join("")}</div>`;
  }
  function devNode(icon, color, pulse) { return `<div style="position:relative;width:54px;height:54px;border-radius:15px;display:grid;place-items:center;background:color-mix(in oklab,${color} 13%,transparent);border:1px solid ${color};color:${color}">${pulse ? `<span style="position:absolute;inset:-4px;border-radius:17px;border:1.4px solid ${color};opacity:.5;animation:mPing 2s ease-out infinite"></span>` : ""}${svg(icon, { size: 22, color })}</div>`; }
  function bridge() { return `<div style="width:26px;height:2px;background:var(--line);position:relative;overflow:hidden;margin:0 2px"><span style="position:absolute;top:0;bottom:0;width:50%;background:linear-gradient(90deg,transparent,${C.cyan},transparent);animation:mFlow 1.3s linear infinite"></span></div>`; }
  function startSub(k) {
    if (k === "intel") { const el = document.getElementById("iocList"); if (!el) return; const ty = ["IP", "DOMAIN", "HASH", "URL"], sv = ["critical", "high", "medium", "low"]; const add = () => { const s = sv[Math.floor(Math.random() * 4)]; const row = document.createElement("div"); row.className = "feedrow"; row.style.animation = "mSlideIn .4s both"; row.innerHTML = `<span style="width:7px;height:7px;border-radius:99px;background:${sevC[s]};flex:none"></span><span class="mono" style="flex:1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${["193.43.18.77", "cdn-sync.duckdns.org", "9f86d0…0a08", "free-prizes.xyz"][Math.floor(Math.random() * 4)]}</span><span class="mono" style="font-size:8.5px;color:${C.faint}">${ty[Math.floor(Math.random() * 4)]}</span>`; el.insertBefore(row, el.firstChild); while (el.children.length > 6) el.lastChild.remove(); }; for (let i = 0; i < 5; i++) add(); every(900, add); }
    if (k === "browser") { const el = document.getElementById("httpList"); if (!el) return; const m = ["GET", "POST"], h = ["api.acme-corp.io", "cdn.site.net", "duckdns.org", "fonts.gstatic.com"]; const add = () => { const bad = Math.random() < .2; const row = document.createElement("div"); row.className = "feedrow"; row.style.animation = "mSlideIn .4s both"; row.innerHTML = `<span class="mono" style="font-size:9px;color:${C.cyan};width:30px;flex:none">${m[Math.floor(Math.random() * 2)]}</span><span class="mono" style="flex:1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${bad ? C.red : C.text}">${h[Math.floor(Math.random() * 4)]}</span><span class="mono" style="font-size:9px;color:${bad ? C.red : C.green}">${bad ? "blocked" : "200"}</span>`; el.insertBefore(row, el.firstChild); while (el.children.length > 6) el.lastChild.remove(); }; for (let i = 0; i < 5; i++) add(); every(1100, add); }
  }

  /* ---------- detail sheet ---------- */
  function sheet() {
    const d = NOTIFS.find(n => n.id === S.detail); if (!d) return "";
    const c = sevC[d.sev];
    const actions = S.resolved
      ? `<div class="card" style="padding:14px;margin-top:16px;display:flex;align-items:center;gap:10px;border-color:rgba(67,224,138,.3);animation:mScaleIn .3s both">${svg("check", { size: 18, color: C.green })}<span style="font-size:13.5px;font-weight:600;color:${C.green}">${S.resolved}</span></div>`
      : `<div class="actrow"><button class="actbtn btn" data-act="resolve:Endpoint isolated" style="background:linear-gradient(180deg,${C.red},#c43146)">${svg("shield", { size: 15, color: "#fff" })} Isolate</button><button class="actbtn btn" data-act="resolve:Alert dismissed" style="background:var(--surface2);border:1px solid var(--line2);color:var(--text)">Dismiss</button></div>`;
    return `<div class="sheet-scrim" data-act="closesheet"></div><div class="sheet">
      <div style="background:linear-gradient(180deg,color-mix(in oklab,${c} 15%,transparent),transparent);padding:14px 20px 4px"><div class="grab"></div>
        <div style="display:flex;align-items:center;gap:12px"><div style="position:relative;width:50px;height:50px;border-radius:14px;display:grid;place-items:center;background:color-mix(in oklab,${c} 15%,transparent);border:1px solid color-mix(in oklab,${c} 40%,transparent);color:${c}">${svg("alert", { size: 24, color: c })}<span style="position:absolute;inset:-3px;border-radius:16px;border:1.4px solid ${c};opacity:.5;animation:mPing 2s ease-out infinite"></span></div>
        <div style="flex:1"><span class="pill" style="--ac:${c}">${d.sev}</span><h2 style="font-family:var(--sans);font-size:19px;font-weight:600;margin:6px 0 0;line-height:1.2">${d.title}</h2></div></div></div>
      <div style="padding:8px 20px 24px">
        <p style="color:${C.dim};font-size:13.5px;line-height:1.55;margin:10px 0 0">${d.desc}</p>
        <div class="card" style="padding:13px;margin-top:16px;display:flex;align-items:center;gap:10px">${svg("globe", { size: 16, color: C.cyan })}<div style="flex:1;min-width:0"><div class="mono" style="font-size:9px;color:${C.faint}">SOURCE</div><div class="mono" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.src}</div></div></div>
        <div class="seclabel">Event timeline</div>${timelineCard(d.tl.map(t => [t[0], t[1], c]))}
        <div class="seclabel">Indicators</div><div class="card" style="overflow:hidden">${d.iocs.map(io => `<div class="ioc"><span class="k">${io[0]}</span><span class="v">${io[1]}</span></div>`).join("")}</div>
        <div class="card" style="padding:14px;margin-top:16px;background:linear-gradient(180deg,var(--amberDim),var(--surface));border-color:rgba(245,166,35,.28)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${svg("bot", { size: 15, color: C.amber2 })}<span class="mono" style="font-size:10px;color:${C.amber2};letter-spacing:1px">AGENT RECOMMENDATION</span></div><p style="margin:0;font-size:13px;line-height:1.5;color:${C.text}">${d.rec}</p></div>
        ${actions}
      </div></div>`;
  }

  /* ---------- toast ---------- */
  function toast() {
    const d = NOTIFS.find(n => n.id === S.toast); if (!d) return "";
    const c = sevC[d.sev];
    return `<div class="toast tap" data-act="toast-open" style="--ac:${c}"><div style="width:34px;height:34px;border-radius:9px;flex:none;display:grid;place-items:center;background:color-mix(in oklab,${c} 15%,transparent);color:${c}">${svg("alert", { size: 17, color: c })}</div><div style="flex:1;min-width:0"><div style="display:flex;gap:7px;align-items:center"><span class="mono" style="font-size:8.5px;color:${c};font-weight:600">CYBERFORGE</span><span class="mono" style="font-size:8.5px;color:${C.faint}">now</span></div><div style="font-size:12.5px;font-weight:600;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.title}</div></div>${svg("chevR", { size: 16, color: C.faint })}</div>`;
  }

  /* ---------- bottom nav ---------- */
  function bnav() {
    const tabs = [["home", "Home", "shield"], ["alerts", "Alerts", "bell"], ["agent", "Agent", "bot"], ["globe", "Globe", "globe"], ["more", "More", "grid"]];
    const unread = NOTIFS.filter(n => n.unread).length;
    const activeTab = S.route ? "more" : S.tab;
    return `<div class="bnav">${tabs.map(t => {
      const on = activeTab === t[0];
      return `<button class="nb btn${on ? " on" : ""}" data-act="tab:${t[0]}"><div style="position:relative">${svg(t[2], { size: 23, color: on ? C.amber2 : C.faint, sw: on ? 2 : 1.8 })}${t[0] === "alerts" && unread ? `<span class="badge">${unread}</span>` : ""}</div><span class="lbl">${t[1]}</span>${on ? `<span class="udot"></span>` : ""}</button>`;
    }).join("")}</div>`;
  }

  /* ---------------- render ---------------- */
  function render() {
    clearAll();
    const app = document.getElementById("app");
    let inner;
    if (!S.connected) {
      inner = flowScreen();
    } else {
      let screen;
      if (S.route) screen = subScreen(S.route);
      else if (S.tab === "home") screen = dashboard();
      else if (S.tab === "alerts") screen = alerts();
      else if (S.tab === "agent") screen = agentScreen();
      else if (S.tab === "globe") screen = globeScreen();
      else if (S.tab === "more") screen = moreMenu();
      inner = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;background:var(--bg);padding-top:52px"><div style="flex:1;display:flex;flex-direction:column;min-height:0">${screen}</div>${bnav()}${S.toast ? toast() : ""}${S.detail ? sheet() : ""}</div>`;
    }
    app.innerHTML = `<div class="notch"><i class="cam"></i><i></i></div>${statusBar()}${inner}<div class="home-ind"></div>`;
    afterRender();
  }
  function afterRender() {
    // animate rings
    document.querySelectorAll(".rv").forEach(c => requestAnimationFrame(() => { setTimeout(() => c.style.strokeDashoffset = c.dataset.t, 60); }));
    // per-screen timers
    if (S.connected && !S.route) {
      if (S.tab === "agent") startAgentConsole();
      if (S.tab === "globe") startGlobe();
      if (S.tab === "home") {
        const fe = document.getElementById("liveFeed");
        const msgs = [["Endpoint heartbeat ok", C.green], ["Blocked C2 · duckdns.org", C.red], ["Browser session verified", C.green], ["Model baseline updated", C.cyan]];
        every(3800, () => { if (!fe) return; const m = msgs[Math.floor(Math.random() * msgs.length)]; const row = document.createElement("div"); row.innerHTML = feedRow([m[0], "now", m[1]], true); fe.insertBefore(row.firstChild, fe.firstChild); while (fe.children.length > 6) fe.lastChild.remove(); });
      }
    }
    if (S.connected && S.route) startSub(S.route);
    // flow auto-advance
    if (!S.connected) {
      if (S.step === "scanning") after(2400, () => { S.step = "notfound"; render(); });
      if (S.step === "installing") after(2600, () => { S.step = "pairing"; render(); });
      if (S.step === "pairing") after(2600, () => { S.step = "done"; render(); });
    }
    // demo push toast once after entering dashboard
    if (S.connected && !S.toastDone) { S.toastDone = true; after(4200, () => { S.toast = 2; render(); after(6000, () => { if (S.toast) { S.toast = null; render(); } }); }); }
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act;
    if (a === "check") { S.step = "scanning"; render(); }
    else if (a === "addext") { S.step = "installing"; render(); }
    else if (a === "enter") { S.connected = true; S.tab = "home"; render(); }
    else if (a.startsWith("tab:")) { const tab = a.slice(4); if (tab === "more") { S.tab = "more"; S.route = null; } else { S.tab = tab; S.route = null; } render(); }
    else if (a === "back") { S.route = null; S.tab = "more"; render(); }
    else if (a.startsWith("route:")) { S.route = a.slice(6); render(); }
    else if (a.startsWith("detail:")) { S.detail = +a.slice(7); S.resolved = null; render(); }
    else if (a === "closesheet") { S.detail = null; render(); }
    else if (a.startsWith("resolve:")) { S.resolved = a.slice(8); render(); }
    else if (a.startsWith("chip:")) { S.filter = a.slice(5); render(); }
    else if (a === "toast-open") { S.detail = S.toast; S.toast = null; S.resolved = null; render(); }
    else if (a === "toggle") { t.classList.toggle("off"); }
  });

  /* ---------------- scale + boot ---------------- */
  function fit() {
    const d = document.getElementById("device");
    const s = Math.min(window.innerWidth / 402, window.innerHeight / 874, 1.15);
    d.style.transform = `scale(${s})`;
  }
  window.addEventListener("resize", fit);
  document.addEventListener("DOMContentLoaded", () => { fit(); render(); setInterval(() => { const sb = document.querySelector(".statusbar div"); if (sb) { const t = new Date(); sb.textContent = (((t.getHours() + 11) % 12) + 1) + ":" + String(t.getMinutes()).padStart(2, "0"); } }, 10000); });
})();
