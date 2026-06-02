/* global React */
const { useState, useEffect, useRef } = React;

// ── curated CDN imagery (Unsplash) ─────────────────────────────────────────
const IMG = {
  // moody forge / sparks / hot steel
  forge:     "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1400&q=80&auto=format&fit=crop",
  sparks:    "https://images.unsplash.com/photo-1542228262-3d663b306a53?w=1400&q=80&auto=format&fit=crop",
  anvil:     "https://images.unsplash.com/photo-1565128939078-c1a2dabbc92e?w=1400&q=80&auto=format&fit=crop",
  // dark infra / server / data
  datacenter:"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80&auto=format&fit=crop",
  cables:    "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&q=80&auto=format&fit=crop",
  circuit:   "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80&auto=format&fit=crop",
  // operators (avatars)
  ines:      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=85&auto=format&fit=crop",
  // architectural / Berlin
  berlin:    "https://images.unsplash.com/photo-1587330979470-3595ac045ab0?w=1200&q=80&auto=format&fit=crop",
};

// ───────────────────────────────────────────────────────── primitives ─────
const cx = (...c) => c.filter(Boolean).join(" ");

// scroll-reveal hook — adds .in when element enters viewport
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.hasAttribute("data-reveal") ? [el] : el.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    targets.forEach(t => io.observe(t));
    return () => io.disconnect();
  }, []);
  return ref;
}

// count-up number that animates when scrolled into view
function CountUp({ to, suffix = "", prefix = "", dur = 1400, decimals = 0 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf, started = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !started) {
          started = true;
          const t0 = performance.now();
          const step = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(to * eased);
            if (p < 1) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, dur]);
  return <span ref={ref}>{prefix}{val.toFixed(decimals)}{suffix}</span>;
}

// ── OS detection ────────────────────────────────────────────────────────────
function detectOS() {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent || "";
  const plat = navigator.platform || "";
  const touch = navigator.maxTouchPoints || 0;
  if (/iPhone|iPad|iPod/.test(ua) || (plat === "MacIntel" && touch > 1)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Win/.test(plat) || /Windows/.test(ua)) return "Windows";
  if (/Mac/.test(plat) || /Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(plat) || /Linux/.test(ua)) return "Linux";
  return "Unknown";
}

const OS_META = {
  Windows: { label: "Windows", kind: "desktop", file: "CyberForge-Setup-4.12.exe", size: "84 MB", note: "Windows 10/11 · 64-bit" },
  macOS:   { label: "macOS",   kind: "desktop", file: "CyberForge-4.12.dmg",       size: "92 MB", note: "Universal · Apple Silicon + Intel" },
  Linux:   { label: "Linux",   kind: "desktop", file: "CyberForge-4.12.AppImage",  size: "88 MB", note: ".AppImage · .deb · .rpm" },
  iOS:     { label: "iOS",     kind: "mobile",  file: "App Store",                 size: "",       note: "iOS 16+ · iPhone & iPad" },
  Android: { label: "Android", kind: "mobile",  file: "Google Play",               size: "",       note: "Android 10+" },
  Unknown: { label: "your device", kind: "desktop", file: "CyberForge",            size: "",       note: "Pick your platform below" },
};

function OSIcon({ os, size = 16, color = "currentColor" }) {
  const s = { width: size, height: size, display: "block", flex: "none" };
  switch (os) {
    case "Windows":
      return (<svg viewBox="0 0 24 24" style={s} fill={color} aria-hidden><path d="M3 5.6 10.4 4.5v7.1H3V5.6Zm0 12.8 7.4 1.1v-7H3v5.9ZM11.3 4.4 21 3v8.6h-9.7V4.4Zm0 15.2L21 21v-8.5h-9.7v7.1Z"/></svg>);
    case "macOS":
    case "iOS":
      return (<svg viewBox="0 0 24 24" style={s} fill={color} aria-hidden><path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7 1.9-1 2.6-2c.8-1.2 1.2-2.3 1.2-2.4-.1 0-2.3-.9-2.3-3.3ZM14.2 6.2c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2Z"/></svg>);
    case "Android":
      return (<svg viewBox="0 0 24 24" style={s} fill={color} aria-hidden><path d="M6 9v7a1.5 1.5 0 0 0 1.5 1.5H8V21a1 1 0 0 0 2 0v-3.5h2V21a1 1 0 0 0 2 0v-3.5h.5A1.5 1.5 0 0 0 18 16V9H6Zm-2.5 0A1.25 1.25 0 0 0 2.25 10.25v4.5a1.25 1.25 0 0 0 2.5 0v-4.5A1.25 1.25 0 0 0 3.5 9Zm17 0a1.25 1.25 0 0 0-1.25 1.25v4.5a1.25 1.25 0 0 0 2.5 0v-4.5A1.25 1.25 0 0 0 20.5 9ZM15.3 4l1-1.5a.3.3 0 0 0-.5-.3L14.7 3.7a6.3 6.3 0 0 0-5.4 0L8.2 2.2a.3.3 0 1 0-.5.3L8.7 4A5.5 5.5 0 0 0 6 8.2h12A5.5 5.5 0 0 0 15.3 4ZM9.5 6.6a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2Zm5 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2Z"/></svg>);
    case "Linux":
      return (<svg viewBox="0 0 24 24" style={s} fill={color} aria-hidden><path d="M12 2c-2 0-3 1.7-3 3.6 0 1.3.1 2-.6 3-.8 1-2.4 2.6-2.4 5.2 0 .9.3 1.6.2 2.3-.1.6-.7 1-1 1.6-.3.7.1 1.3.8 1.6.8.3 2 .4 2.8 1.1.7.6 1.4 1 2.2 1s1.5-.4 2.2-1c.8-.7 2-.8 2.8-1.1.7-.3 1.1-.9.8-1.6-.3-.6-.9-1-1-1.6-.1-.7.2-1.4.2-2.3 0-2.6-1.6-4.2-2.4-5.2-.7-1-.6-1.7-.6-3C15 3.7 14 2 12 2Zm-1.4 4.1c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm2.8 0c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9ZM12 9c.8 0 1.8.5 1.8.9 0 .3-1 .8-1.8.8s-1.8-.5-1.8-.8c0-.4 1-.9 1.8-.9Z"/></svg>);
    default:
      return (<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="1.6" aria-hidden><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" strokeLinecap="square"/></svg>);
  }
}

function Ticker({ children, className }) {
  return (
    <span className={cx("mono", className)} style={{ fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--dusty)", opacity: 0.62 }}>
      {children}
    </span>
  );
}

function Dot({ color = "var(--sage)", pulse = true, size = 8 }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: 999, background: color }} />
      {pulse && (
        <span style={{ position: "absolute", inset: -2, borderRadius: 999, background: color, opacity: 0.35, animation: "forgePulse 1.8s ease-out infinite" }} />
      )}
    </span>
  );
}

// ───────────────────────────────────────────────────────── header ─────────
function Header({ os }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "color-mix(in oklab, var(--raisin) 86%, transparent)",
      backdropFilter: "blur(14px) saturate(140%)",
      borderBottom: "1px solid var(--line)"
    }}>
      {/* hairline status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 28px", borderBottom: "1px solid var(--line)", fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--dusty)", opacity: 0.7 }}>
        <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Dot color="var(--sage)" /> SOC · operational</span>
          <span style={{ opacity: 0.55 }}>uptime 99.998%</span>
          <span style={{ opacity: 0.55 }}>threats neutralized · 2,481 today</span>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <span>{time}</span>
          <span style={{ opacity: 0.55 }}>v4.12 · stable</span>
        </div>
      </div>

      {/* primary nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px" }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
          <LogoMark />
          <span className="display" style={{ fontSize: 20, letterSpacing: "-0.04em" }}>
            Cyber<span style={{ color: "var(--orange)" }}>Forge</span>
          </span>
        </a>

        <nav style={{ display: "flex", gap: 28 }}>
          {["Platform", "Threat Intel", "Operators", "Docs"].map(item => (
            <a key={item} href="#" style={{ position: "relative", color: "var(--dusty)", textDecoration: "none", fontSize: 14, opacity: 0.85, padding: "6px 0" }}
              onMouseEnter={e => e.currentTarget.querySelector(".underline").style.transform = "scaleX(1)"}
              onMouseLeave={e => e.currentTarget.querySelector(".underline").style.transform = "scaleX(0)"}
            >
              {item}
              <span className="underline" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: "var(--orange)", transform: "scaleX(0)", transformOrigin: "left", transition: "transform 320ms cubic-bezier(.2,.7,.2,1)" }} />
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="#" style={{ fontSize: 14, color: "var(--dusty)", opacity: 0.8, textDecoration: "none" }}>Sign in</a>
          <button onClick={() => setOpen(true)} style={btnPrimary}>
            <OSIcon os={os} size={14} color="var(--black)" />
            <span>{os && OS_META[os] && OS_META[os].kind === "desktop" ? "Download for " + OS_META[os].label : "Download"}</span>
          </button>
        </div>
      </div>

      {open && <DownloadModal os={os} onClose={() => setOpen(false)} />}
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      <rect x="1" y="1" width="28" height="28" fill="none" stroke="var(--dusty)" strokeWidth="1" />
      <path d="M7 22 L15 6 L23 22 Z" fill="var(--orange)" />
      <path d="M11 22 L15 14 L19 22 Z" fill="var(--raisin)" />
      <circle cx="15" cy="22" r="1.6" fill="var(--sage)" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </svg>
  );
}

const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 8,
  background: "var(--orange)", color: "var(--black)",
  border: "none", padding: "10px 16px",
  fontFamily: "JetBrains Mono, monospace", fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 600,
  cursor: "pointer", transition: "transform 160ms ease, background 160ms ease",
};

// ───────────────────────────────────────────────────────── hero ───────────
function Hero({ os }) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const meta = OS_META[os] || OS_META.Unknown;
  const isMobile = meta.kind === "mobile";
  return (
    <section style={{ position: "relative", padding: "72px 28px 40px", borderBottom: "1px solid var(--line)", overflow: "hidden" }}>
      <BackdropGrid />

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 56, position: "relative" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 10px", border: "1px solid var(--line-strong)", borderRadius: 999, marginBottom: 32 }}>
            <Dot color="var(--orange)" />
            <Ticker>v4.12 · forge runtime ships with quantum-safe key rotation</Ticker>
          </div>

          <h1 className="display" style={{ fontSize: "clamp(56px, 7.8vw, 116px)", margin: 0 }}>
            Your fleet&rsquo;s<br />
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 18 }}>
              <em style={{ fontStyle: "normal", color: "var(--orange)" }}>perimeter</em>
              <SparkLine />
            </span><br />
            in one<br />
            download.
          </h1>

          <p style={{ maxWidth: 540, marginTop: 28, fontSize: 18, lineHeight: 1.5, color: "var(--dusty)", opacity: 0.78 }}>
            Cyber Forge is an autonomous defense fabric for your endpoints and fleets. Install the desktop agent or the mobile companion app — it learns your baseline in 48 hours and stops intrusions at machine speed, right from your device.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
            <button
              onClick={() => setOpen(true)}
              onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
              style={{ ...btnPrimary, padding: "14px 22px", fontSize: 13, transform: hover ? "translateY(-1px)" : "none", background: hover ? "var(--dusty)" : "var(--orange)" }}
            >
              <OSIcon os={os} size={15} color="var(--black)" />
              <span>{isMobile ? "Get the " + meta.label + " app" : "Download for " + meta.label}</span>
            </button>
            <button onClick={() => setOpen(true)} style={{ ...btnPrimary, background: "transparent", border: "1px solid var(--line-strong)", color: "var(--dusty)", padding: "14px 22px", fontSize: 13 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--sage)" }} />
              <span>All platforms</span>
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            <Ticker>{isMobile ? meta.note : "Detected " + meta.label + " · " + meta.note + (meta.size ? " · " + meta.size : "")} · free 48h trial</Ticker>
          </div>

          <div style={{ display: "flex", gap: 40, marginTop: 44, paddingTop: 28, borderTop: "1px solid var(--line)" }}>
            {[
              ["00:00:11", "median detect-to-contain"],
              ["48hr", "to full baseline"],
              ["73%", "fewer false positives"],
            ].map(([num, label]) => (
              <div key={label}>
                <div className="display" style={{ fontSize: 32, color: "var(--dusty)" }}>{num}</div>
                <Ticker>{label}</Ticker>
              </div>
            ))}
          </div>
        </div>

        <ThreatPanel />
      </div>
      {open && <DownloadModal os={os} onClose={() => setOpen(false)} />}
    </section>
  );
}

function BackdropGrid() {
  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: "linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)",
      backgroundSize: "80px 80px",
      maskImage: "radial-gradient(ellipse at 30% 40%, black 0%, transparent 75%)",
      WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 0%, transparent 75%)",
      opacity: 0.7,
    }} />
  );
}

function SparkLine() {
  return (
    <svg width="120" height="44" viewBox="0 0 120 44" style={{ overflow: "visible" }}>
      <path d="M2 32 L18 28 L34 30 L46 14 L62 18 L78 8 L94 22 L118 6" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="118" cy="6" r="4" fill="var(--orange)" />
      <circle cx="118" cy="6" r="9" fill="none" stroke="var(--orange)" strokeWidth="1" opacity="0.5">
        <animate attributeName="r" values="4;14;4" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// live-ish threat panel
function ThreatPanel() {
  const seed = useRef([
    { t: "—:—", ip: "104.196.22.71", region: "FRA·1", kind: "lateral", sev: "critical" },
    { t: "—:—", ip: "52.30.181.4", region: "DUB·2", kind: "exfil", sev: "high" },
    { t: "—:—", ip: "13.114.7.182", region: "TYO·3", kind: "brute", sev: "med" },
    { t: "—:—", ip: "172.58.142.9", region: "SJC·1", kind: "scan", sev: "low" },
    { t: "—:—", ip: "203.0.113.55", region: "SYD·2", kind: "phish", sev: "high" },
  ]);
  const [rows, setRows] = useState(seed.current);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1800);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const now = new Date();
    const stamp = now.toTimeString().slice(0, 8);
    const kinds = ["lateral", "exfil", "brute", "scan", "phish", "c2 beacon", "deserialize"];
    const sevs = ["critical", "high", "med", "low"];
    const regions = ["FRA·1","DUB·2","TYO·3","SJC·1","SYD·2","IAD·4","BOM·1"];
    const ip = `${rand(1,223)}.${rand(0,255)}.${rand(0,255)}.${rand(0,255)}`;
    const next = { t: stamp, ip, region: regions[rand(0,regions.length-1)], kind: kinds[rand(0,kinds.length-1)], sev: sevs[rand(0,sevs.length-1)] };
    setRows(r => [next, ...r].slice(0, 6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const sevColor = { critical: "var(--orange)", high: "var(--orange)", med: "var(--sage)", low: "var(--dusty)" };
  const sevOpacity = { critical: 1, high: 0.7, med: 1, low: 0.45 };

  return (
    <div style={{
      position: "relative", background: "var(--black)", color: "var(--dusty)",
      border: "1px solid var(--line-strong)",
      padding: 0, overflow: "hidden",
      boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Dot color="var(--orange)" />
          <Ticker>LIVE · global threat feed</Ticker>
        </div>
        <Ticker>forge://ops/feed</Ticker>
      </div>

      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "70px 1fr 70px 90px 80px", gap: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--dusty)", opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.5 }}>
        <span>time</span><span>source</span><span>region</span><span>kind</span><span>sev</span>
      </div>

      <div style={{ maxHeight: 240, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div key={`${r.t}-${r.ip}-${i}`}
            style={{
              padding: "10px 16px", display: "grid", gridTemplateColumns: "70px 1fr 70px 90px 80px", gap: 10,
              fontFamily: "JetBrains Mono, monospace", fontSize: 12,
              borderBottom: "1px solid var(--line)",
              animation: i === 0 ? "rowIn 420ms cubic-bezier(.2,.7,.2,1)" : "none",
              background: i === 0 ? "color-mix(in oklab, var(--orange) 8%, transparent)" : "transparent",
            }}>
            <span style={{ opacity: 0.6 }}>{r.t}</span>
            <span>{r.ip}</span>
            <span style={{ opacity: 0.7 }}>{r.region}</span>
            <span style={{ color: "var(--sage)" }}>{r.kind}</span>
            <span style={{ color: sevColor[r.sev], opacity: sevOpacity[r.sev], textTransform: "uppercase", letterSpacing: 0.5 }}>● {r.sev}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Ticker>auto-contain · enabled</Ticker>
        <span className="mono" style={{ fontSize: 11, color: "var(--orange)" }}>+ {2481 + rows.length * 7} today</span>
      </div>
    </div>
  );
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ───────────────────────────────────────────────────────── marquee ────────
function Marquee() {
  const items = [
    "ZERO-TRUST FABRIC",
    "★",
    "RUNTIME ATTESTATION",
    "★",
    "POST-QUANTUM READY",
    "★",
    "AUTONOMOUS RESPONSE",
    "★",
    "SOC2 · ISO27001 · FEDRAMP HIGH",
    "★",
    "FORGED IN BERLIN",
    "★",
  ];
  return (
    <div style={{ overflow: "hidden", background: "var(--orange)", color: "var(--black)", borderTop: "1px solid var(--black)", borderBottom: "1px solid var(--black)" }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "marquee 38s linear infinite", padding: "14px 0", fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 22, letterSpacing: "-0.02em" }}>
        {[...items, ...items, ...items].map((t, i) => (
          <span key={i} style={{ paddingInline: 24, display: "inline-flex", alignItems: "center" }}>
            {t === "★" ? <Star /> : t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Star() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "inline-block" }}>
      <path d="M7 0 L8.5 5.5 L14 7 L8.5 8.5 L7 14 L5.5 8.5 L0 7 L5.5 5.5 Z" fill="var(--black)" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────── capabilities ───
function Capabilities() {
  const items = [
    {
      n: "01",
      title: "Behavioral fingerprinting",
      body: "Every process, syscall, and lateral hop is hashed into a behavioral signature. Drift from baseline triggers containment in under 11 seconds.",
      stat: "1.2M events/sec/node",
    },
    {
      n: "02",
      title: "Autonomous response",
      body: "The runtime decides, isolates, rolls back. Operators arrive to a contained incident with a timeline, blast-radius graph, and one button: confirm.",
      stat: "0 SOC analyst clicks",
    },
    {
      n: "03",
      title: "Post-quantum keystore",
      body: "ML-KEM and ML-DSA rotated every 8 hours across your fleet. Stockpiled adversary captures decrypt to noise.",
      stat: "NIST FIPS 203 / 204",
    },
  ];
  return (
    <section style={{ padding: "96px 28px 80px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 56, marginBottom: 56 }}>
        <Ticker>§ 02 — capability surface</Ticker>
        <h2 className="display" style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: 0, maxWidth: 800 }}>
          Three primitives. <span style={{ color: "var(--sage)" }}>One contract:</span> nothing crosses the perimeter without a fight.
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid var(--line-strong)" }}>
        {items.map(it => (
          <CapCard key={it.n} {...it} />
        ))}
      </div>
    </section>
  );
}

function CapCard({ n, title, body, stat }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: 32, borderRight: "1px solid var(--line)",
        background: hov ? "color-mix(in oklab, var(--orange) 6%, transparent)" : "transparent",
        transition: "background 240ms ease",
        position: "relative",
        minHeight: 340,
        display: "flex", flexDirection: "column", gap: 24,
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Ticker className="mono">{n}</Ticker>
        <div style={{
          width: 32, height: 32, border: "1px solid var(--line-strong)",
          display: "grid", placeItems: "center",
          transition: "transform 320ms cubic-bezier(.2,.7,.2,1), background 240ms ease",
          transform: hov ? "rotate(45deg)" : "rotate(0)",
          background: hov ? "var(--orange)" : "transparent",
          color: hov ? "var(--black)" : "var(--dusty)",
        }}>
          <ArrowRight />
        </div>
      </div>

      <h3 className="display" style={{ fontSize: 28, margin: 0, maxWidth: 260 }}>{title}</h3>
      <p style={{ margin: 0, color: "var(--dusty)", opacity: 0.72, lineHeight: 1.55, fontSize: 15 }}>{body}</p>

      <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px dashed var(--line-strong)" }}>
        <Ticker>{stat}</Ticker>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── runtime view ───
function FieldStrip() {
  const cards = [
    { img: IMG.datacenter, eyebrow: "Region·eu-central-1", title: "Sovereign deploys",  meta: "Frankfurt · 7 racks · air-gapped" },
    { img: IMG.cables,     eyebrow: "Region·us-east-4",   title: "Hot-metal mesh",     meta: "Ashburn · 12 racks · active" },
    { img: IMG.circuit,    eyebrow: "Region·ap-south-1",  title: "Edge attestation",   meta: "Mumbai · 6 racks · active" },
  ];
  return (
    <section style={{ padding: "96px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 40, gap: 24 }}>
        <div>
          <Ticker>§ 02b — field</Ticker>
          <h2 className="display" style={{ fontSize: "clamp(36px, 4.4vw, 64px)", margin: "14px 0 0", maxWidth: 720 }}>
            Forged in seven regions. <span style={{ color: "var(--sage)" }}>Listening in all of them.</span>
          </h2>
        </div>
        <a href="#" style={{ color: "var(--dusty)", textDecoration: "none", display: "inline-flex", gap: 10, alignItems: "center", paddingBottom: 6, borderBottom: "1px solid var(--line-strong)", fontSize: 13 }}>
          <span>See coverage map</span><ArrowRight />
        </a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        {cards.map(c => <FieldCard key={c.title} {...c} />)}
      </div>
    </section>
  );
}

function FieldCard({ img, eyebrow, title, meta }) {
  const [hov, setHov] = useState(false);
  return (
    <article
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: "relative", overflow: "hidden", border: "1px solid var(--line)", background: "var(--black)", aspectRatio: "4/5" }}
    >
      <img src={img} alt="" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        filter: hov ? "grayscale(0) contrast(1.05) saturate(1.1)" : "grayscale(0.85) contrast(1.1)",
        transform: hov ? "scale(1.04)" : "scale(1)",
        transition: "transform 900ms cubic-bezier(.2,.7,.2,1), filter 600ms ease",
      }} />
      <div style={{ position: "absolute", inset: 0, background: hov
        ? "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%)"
        : "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.92) 100%)", transition: "background 320ms" }} />
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: "absolute", top: 14, left: 14, color: "var(--orange)" }}>
        <path d="M0 0 H10 M0 0 V10" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: "absolute", top: 14, right: 14, color: "var(--orange)" }}>
        <path d="M22 0 H12 M22 0 V10" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <div style={{ position: "absolute", top: 18, right: 44 }}>
        <Ticker>{eyebrow}</Ticker>
      </div>
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 18, color: "var(--dusty)" }}>
        <Ticker>{meta}</Ticker>
        <h3 className="display" style={{ margin: "8px 0 0", fontSize: 30, lineHeight: 1 }}>{title}</h3>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid rgba(239,233,221,0.22)" }}>
          <Ticker>online · attested</Ticker>
          <span style={{ width: 28, height: 28, border: "1px solid rgba(239,233,221,0.3)", display: "grid", placeItems: "center", color: hov ? "var(--black)" : "var(--dusty)", background: hov ? "var(--orange)" : "transparent", transition: "all 280ms" }}>
            <ArrowRight />
          </span>
        </div>
      </div>
    </article>
  );
}

function RuntimeView() {
  return (
    <section style={{ padding: "96px 28px", background: "var(--black)", borderBottom: "1px solid var(--line)", color: "var(--dusty)", position: "relative", overflow: "hidden" }}>
      <BackdropGrid />
      <img src={IMG.sparks} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.18, mixBlendMode: "screen", filter: "hue-rotate(-10deg) saturate(0.7)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, position: "relative" }}>
        <div>
          <Ticker>§ 03 — runtime</Ticker>
          <h2 className="display" style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: "16px 0 24px" }}>
            One agent.<br />
            <span style={{ color: "var(--orange)" }}>Six milliseconds.</span><br />
            Every workload.
          </h2>
          <p style={{ maxWidth: 480, fontSize: 17, lineHeight: 1.55, opacity: 0.78 }}>
            Drop the forge agent into your container image or daemonset. It self-attests against a hardware root of trust, joins the mesh, and starts shipping signals before the first probe finishes its first scan.
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: "32px 0 0", display: "grid", gap: 14 }}>
            {[
              "eBPF-based — zero kernel module install",
              "6.4 MB binary, statically linked",
              "Air-gapped mode for sovereign deployments",
              "Works on x86, ARM64, RISC-V",
            ].map(li => (
              <li key={li} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 16, height: 1, background: "var(--orange)" }} />
                <span style={{ fontSize: 15, opacity: 0.85 }}>{li}</span>
              </li>
            ))}
          </ul>
        </div>

        <TerminalDemo />
      </div>
    </section>
  );
}

function TerminalDemo() {
  const lines = [
    { p: "$", t: "forge init --cluster prod-eu-1", c: "var(--dusty)" },
    { p: ">", t: "attesting hardware root of trust ........ ok", c: "var(--sage)" },
    { p: ">", t: "negotiating ML-KEM-1024 session ......... ok", c: "var(--sage)" },
    { p: ">", t: "loading baseline (847 workloads) ........ ok", c: "var(--sage)" },
    { p: ">", t: "joining mesh forge://eu-central-1 ....... ok", c: "var(--sage)" },
    { p: "$", t: "forge watch --severity high+", c: "var(--dusty)" },
    { p: "!", t: "[14:22:07] lateral movement detected — pod=api-7f", c: "var(--orange)" },
    { p: ">", t: "  └─ source: 10.42.7.118 → 10.42.3.4:5432", c: "var(--dusty)", o: 0.65 },
    { p: ">", t: "  └─ action: isolated · rollback queued · ticket #4291", c: "var(--sage)" },
    { p: "✓", t: "contained in 00:00:09.327", c: "var(--sage)" },
  ];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= lines.length) {
      const r = setTimeout(() => setShown(0), 4200);
      return () => clearTimeout(r);
    }
    const t = setTimeout(() => setShown(s => s + 1), 480);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  return (
    <div style={{ border: "1px solid var(--line-strong)", background: "var(--raisin)", fontFamily: "JetBrains Mono, monospace", fontSize: 13, lineHeight: 1.7, color: "var(--dusty)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--line)", background: "var(--black)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--orange)" }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--sage)" }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--dusty)", opacity: 0.4 }} />
        </div>
        <Ticker>~/forge — zsh</Ticker>
        <Ticker>120×32</Ticker>
      </div>
      <div style={{ padding: 18, minHeight: 320 }}>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 10, opacity: l.o ?? 1 }}>
            <span style={{ color: l.c, opacity: 0.7, width: 12 }}>{l.p}</span>
            <span style={{ color: l.c }}>{l.t}</span>
          </div>
        ))}
        {shown < lines.length && shown > 0 && (
          <span style={{ display: "inline-block", width: 8, height: 14, background: "var(--orange)", marginTop: 2, animation: "blink 0.9s steps(2) infinite" }} />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── trust / quote ──
function TrustQuote() {
  return (
    <section style={{ padding: "96px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 56 }}>
        <div>
          <Ticker>§ 04 — operators</Ticker>
          <h2 className="display" style={{ fontSize: 40, margin: "16px 0 0" }}>
            Trusted by teams who can&rsquo;t afford a 3am incident.
          </h2>
          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, border: "1px solid var(--line)" }}>
            {["northbank.fi", "rocketlab", "kestrel.gov", "axion.bio", "hexa.io", "PRIME·77"].map((name, i) => (
              <div key={name} style={{ padding: "26px 18px", borderRight: i % 2 === 0 ? "1px solid var(--line)" : "none", borderTop: i > 1 ? "1px solid var(--line)" : "none", textAlign: "center", fontFamily: "Space Grotesk", fontSize: 16, fontWeight: 600, opacity: 0.78, letterSpacing: "-0.02em" }}>
                {name}
              </div>
            ))}
          </div>
        </div>

        <figure style={{ margin: 0 }}>
          <Ticker>case · 003</Ticker>
          <blockquote className="display" style={{ fontSize: "clamp(28px, 3vw, 44px)", margin: "18px 0 32px", lineHeight: 1.12 }}>
            &ldquo;We replaced four SIEM contracts and two EDR vendors with one Forge deployment. Mean-time-to-contain went from <span style={{ color: "var(--orange)" }}>14 minutes</span> to <span style={{ color: "var(--sage)" }}>under 10 seconds</span>. The SOC sleeps now.&rdquo;
          </blockquote>
          <figcaption style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <div style={{ width: 56, height: 56, border: "1px solid var(--line-strong)", overflow: "hidden", flex: "0 0 56px", position: "relative" }}>
              <img src={IMG.ines} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.4) contrast(1.05)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, color-mix(in oklab, var(--orange) 25%, transparent))", mixBlendMode: "multiply" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Inés Castellanos</div>
              <Ticker>CISO · Northbank · 12,400 engineers</Ticker>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────── CTA ────────────
function CTA({ os }) {
  const [open, setOpen] = useState(false);
  const meta = OS_META[os] || OS_META.Unknown;
  return (
    <section style={{ position: "relative", padding: "120px 28px", background: "var(--orange)", color: "var(--black)", overflow: "hidden", borderBottom: "1px solid var(--black)" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px)", backgroundSize: "80px 100%", pointerEvents: "none" }} />
      <img src={IMG.forge} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.18, mixBlendMode: "multiply" }} />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 56, alignItems: "end" }}>
        <h2 className="display" style={{ fontSize: "clamp(56px, 8vw, 132px)", margin: 0 }}>
          Download it.<br />
          Point it at the<br />
          fleet. Forge the <em style={{ fontStyle: "normal", textDecoration: "underline", textUnderlineOffset: 12, textDecorationThickness: 4 }}>anvil</em>.
        </h2>

        <div>
          <p style={{ fontSize: 17, lineHeight: 1.5, marginTop: 0 }}>
            Free 48-hour trial. Read-only mode. The agent watches and learns before it ever acts — on desktop or mobile.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
            <button onClick={() => setOpen(true)} style={{ ...btnPrimary, background: "var(--black)", color: "var(--dusty)", padding: "16px 22px", fontSize: 13, justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><OSIcon os={os} size={15} color="var(--dusty)" />{meta.kind === "mobile" ? "Get the " + meta.label + " app" : "Download for " + meta.label}</span><ArrowRight />
            </button>
            <button onClick={() => setOpen(true)} style={{ ...btnPrimary, background: "transparent", color: "var(--black)", border: "1px solid var(--black)", padding: "16px 22px", fontSize: 13, justifyContent: "space-between" }}>
              <span>All platforms · desktop &amp; mobile</span><ArrowRight />
            </button>
          </div>
        </div>
      </div>
      {open && <DownloadModal os={os} onClose={() => setOpen(false)} />}
    </section>
  );
}

// ───────────────────────────────────────────────────────── footer ─────────
function Footer() {
  const cols = [
    ["Platform", ["Runtime", "Threat intel", "Forensics", "Policy engine", "Air-gap mode"]],
    ["Solutions", ["Financial services", "Public sector", "Healthcare", "Critical infra", "Startups"]],
    ["Company", ["About", "Careers · 14", "Press", "Security disclosures", "Trust center"]],
    ["Resources", ["Docs", "Threat reports", "Changelog · 4.12", "Status", "Contact"]],
  ];
  return (
    <footer style={{ background: "var(--raisin)", padding: "72px 28px 32px", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(4, 1fr)", gap: 40, paddingBottom: 56, borderBottom: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
            <LogoMark />
            <span className="display" style={{ fontSize: 22 }}>Cyber<span style={{ color: "var(--orange)" }}>Forge</span></span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.7, maxWidth: 280 }}>
            Forged in Berlin. Operating from 7 regions. SOC2 Type II · ISO 27001 · FedRAMP High authorized.
          </p>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--line-strong)" }}>
            <Dot color="var(--sage)" /><Ticker>all systems operational</Ticker>
          </div>
        </div>

        {cols.map(([h, items]) => (
          <div key={h}>
            <div style={{ marginBottom: 18 }}><Ticker>{h}</Ticker></div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {items.map(i => (
                <li key={i}>
                  <a href="#" style={{ color: "var(--dusty)", textDecoration: "none", fontSize: 14, opacity: 0.82 }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--orange)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--dusty)"; }}>
                    {i}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* big wordmark */}
      <div style={{ padding: "48px 0 12px", textAlign: "center", lineHeight: 0.85, letterSpacing: "-0.05em" }}>
        <div className="display" style={{ fontSize: "clamp(80px, 16vw, 240px)", color: "transparent", WebkitTextStroke: "1px var(--line-strong)" }}>
          CYBER<span style={{ WebkitTextStroke: "1px var(--orange)" }}>·</span>FORGE
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 28, borderTop: "1px solid var(--line)" }}>
        <Ticker>© 2026 Cyber Forge GmbH — Schönhauser Allee 12, 10119 Berlin</Ticker>
        <div style={{ display: "flex", gap: 22 }}>
          <Ticker>privacy</Ticker><Ticker>terms</Ticker><Ticker>responsible disclosure</Ticker>
        </div>
      </div>
    </footer>
  );
}

// ───────────────────────────────────────────────────────── download modal ─
function DownloadModal({ os, onClose }) {
  const detected = OS_META[os] && os !== "Unknown" ? os : null;
  const desktops = ["Windows", "macOS", "Linux"];
  const mobiles = ["iOS", "Android"];
  const [picked, setPicked] = useState(detected || "Windows");
  const [downloading, setDownloading] = useState(false);
  const meta = OS_META[picked];
  const isMobile = meta.kind === "mobile";

  const start = () => {
    if (isMobile) return;
    setDownloading(true);
    setTimeout(() => setDownloading(false), 2400);
  };

  const PlatformBtn = ({ k }) => {
    const m = OS_META[k];
    const active = picked === k;
    return (
      <button onClick={() => { setPicked(k); setDownloading(false); }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          padding: "16px 8px", cursor: "pointer", background: active ? "color-mix(in oklab, var(--orange) 12%, transparent)" : "transparent",
          border: active ? "1px solid var(--orange)" : "1px solid var(--line-strong)",
          color: "var(--dusty)", transition: "all 180ms ease", position: "relative",
        }}>
        {k === detected && (
          <span className="mono" style={{ position: "absolute", top: -8, right: -1, fontSize: 8, background: "var(--sage)", color: "var(--black)", padding: "2px 5px", letterSpacing: 0.4, textTransform: "uppercase" }}>You</span>
        )}
        <OSIcon os={k} size={24} color={active ? "var(--orange)" : "var(--dusty)"} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
      </button>
    );
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "grid", placeItems: "center", backdropFilter: "blur(6px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: "92vw", background: "var(--raisin)", border: "1px solid var(--line-strong)", padding: 30, position: "relative" }}>
        <Ticker>§ download.init</Ticker>
        <h3 className="display" style={{ fontSize: 30, margin: "10px 0 6px" }}>Install Cyber<span style={{ color: "var(--orange)" }}>Forge</span>.</h3>
        <p style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.5, margin: "0 0 22px" }}>
          {detected ? `We detected ${OS_META[detected].label}. ` : ""}Choose your platform — desktop agent or mobile companion.
        </p>

        <div style={{ marginBottom: 8 }}><Ticker>Desktop</Ticker></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
          {desktops.map(k => <PlatformBtn key={k} k={k} />)}
        </div>
        <div style={{ marginBottom: 8 }}><Ticker>Mobile</Ticker></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 24 }}>
          {mobiles.map(k => <PlatformBtn key={k} k={k} />)}
        </div>

        <div style={{ border: "1px solid var(--line)", padding: 16, marginBottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <OSIcon os={picked} size={28} color="var(--orange)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{isMobile ? `CyberForge for ${meta.label}` : meta.file}</div>
            <Ticker>{meta.note}{meta.size ? " · " + meta.size : ""}</Ticker>
          </div>
        </div>

        {isMobile ? (
          <button style={{ ...btnPrimary, width: "100%", padding: "15px 18px", justifyContent: "center", gap: 10 }}>
            <OSIcon os={picked} size={15} color="var(--black)" />
            <span>Get it on {picked === "iOS" ? "the App Store" : "Google Play"}</span>
          </button>
        ) : (
          <button onClick={start} disabled={downloading} style={{ ...btnPrimary, width: "100%", padding: "15px 18px", justifyContent: "center", gap: 10, opacity: downloading ? 0.8 : 1 }}>
            {downloading ? (
              <>
                <span style={{ width: 13, height: 13, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "var(--black)", borderRadius: 999, animation: "spin 0.7s linear infinite" }} />
                <span>Preparing {meta.label} build…</span>
              </>
            ) : (
              <>
                <OSIcon os={picked} size={15} color="var(--black)" />
                <span>Download for {meta.label} · {meta.size}</span>
              </>
            )}
          </button>
        )}
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <Ticker>SHA-256 signed · SOC2 · auto-updates</Ticker>
        </div>

        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "1px solid var(--line)", color: "var(--dusty)", padding: "4px 10px", cursor: "pointer", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>esc</button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── app showcase ──
function AppShowcase({ os }) {
  const ref = useReveal();
  const meta = OS_META[os] || OS_META.Unknown;
  return (
    <section ref={ref} style={{ padding: "100px 28px", borderBottom: "1px solid var(--line)", position: "relative", overflow: "hidden" }}>
      <BackdropGrid />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
        {/* device mocks */}
        <div className="reveal" style={{ position: "relative", minHeight: 440 }}>
          {/* desktop window */}
          <div className="float-y" style={{ position: "relative", border: "1px solid var(--line-strong)", background: "var(--black)", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", borderBottom: "1px solid var(--line)", background: "var(--raisin)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--orange)" }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--sage)" }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--dusty)", opacity: 0.35 }} />
              <span className="mono" style={{ marginLeft: 8, fontSize: 10, opacity: 0.55, textTransform: "uppercase", letterSpacing: 0.5 }}>CyberForge — Threat Overview</span>
            </div>
            <div style={{ position: "relative", padding: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, minHeight: 230 }}>
              {/* scan line */}
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 40, background: "linear-gradient(180deg, transparent, color-mix(in oklab, var(--sage) 22%, transparent))", borderBottom: "1px solid color-mix(in oklab, var(--sage) 60%, transparent)", animation: "scanDown 3.4s linear infinite", pointerEvents: "none" }} />
              {[["00:00:09","contain"],["2,481","blocked"],["99.99%","uptime"]].map(([n,l]) => (
                <div key={l} style={{ border: "1px solid var(--line)", padding: "12px 12px" }}>
                  <div className="display" style={{ fontSize: 22, color: "var(--orange)" }}>{n}</div>
                  <Ticker>{l}</Ticker>
                </div>
              ))}
              <div style={{ gridColumn: "1 / -1", border: "1px solid var(--line)", padding: 12 }}>
                <Ticker>live threat feed</Ticker>
                <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
                  {[["104.196.22.71","lateral","var(--orange)"],["52.30.181.4","exfil","var(--orange)"],["13.114.7.182","scan","var(--sage)"]].map((r,i) => (
                    <div key={i} className="mono" style={{ display: "grid", gridTemplateColumns: "1fr 70px 16px", gap: 8, fontSize: 11, opacity: 0.85 }}>
                      <span>{r[0]}</span><span style={{ color: "var(--sage)" }}>{r[1]}</span><span style={{ color: r[2] }}>●</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* phone */}
          <div className="float-y-sm" style={{ position: "absolute", right: -6, bottom: -20, width: 150, border: "1px solid var(--line-strong)", borderRadius: 22, background: "var(--raisin)", boxShadow: "0 24px 50px -18px rgba(0,0,0,0.85)", overflow: "hidden" }}>
            <div style={{ height: 22, display: "grid", placeItems: "center" }}><span style={{ width: 42, height: 5, borderRadius: 999, background: "var(--line-strong)" }} /></div>
            <div style={{ padding: "0 12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <LogoMark />
                <span className="display" style={{ fontSize: 13 }}>Cyber<span style={{ color: "var(--orange)" }}>Forge</span></span>
              </div>
              <div style={{ border: "1px solid var(--line)", padding: 10, marginBottom: 8 }}>
                <Ticker>device · secure</Ticker>
                <div className="display" style={{ fontSize: 26, color: "var(--sage)", marginTop: 4 }}>OK</div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {["browser · clean","network · clean","2 alerts handled"].map((t,i) => (
                  <div key={i} className="mono" style={{ fontSize: 9, display: "flex", gap: 7, alignItems: "center", opacity: 0.82 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: i === 2 ? "var(--orange)" : "var(--sage)" }} />{t}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: "8px 0", textAlign: "center", background: "var(--orange)", color: "var(--black)", fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 600 }}>Forge active</div>
            </div>
          </div>
        </div>

        {/* copy */}
        <div>
          <div className="reveal"><Ticker>§ 01b — one platform</Ticker></div>
          <h2 className="reveal reveal-d1 display" style={{ fontSize: "clamp(38px, 4.6vw, 66px)", margin: "14px 0 22px" }}>
            Command center on desktop. <span style={{ color: "var(--sage)" }}>Sentinel in your pocket.</span>
          </h2>
          <p className="reveal reveal-d2" style={{ fontSize: 17, lineHeight: 1.55, opacity: 0.78, maxWidth: 520, margin: 0 }}>
            The desktop app is your full operations console — live feeds, sandbox detonation, the 8-agent orchestrator. The mobile app keeps the same agent watching your device on the move, pushing a vulnerability alert the instant something tries the door.
          </p>
          <ul className="reveal reveal-d3" style={{ listStyle: "none", padding: 0, margin: "30px 0 0", display: "grid", gap: 14 }}>
            {[
              ["Native desktop apps for Windows, macOS & Linux", "desktop"],
              ["Companion apps for iOS & Android", "mobile"],
              ["One account — state syncs across every device", "sync"],
              ["Offline-first; no telemetry leaves your machine", "shield"],
            ].map(([li, k]) => (
              <li key={li} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 26, height: 26, border: "1px solid var(--line-strong)", display: "grid", placeItems: "center", color: "var(--orange)", flex: "none" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" strokeLinecap="square" /></svg>
                </span>
                <span style={{ fontSize: 15, opacity: 0.9 }}>{li}</span>
              </li>
            ))}
          </ul>
          <div className="reveal reveal-d4" style={{ marginTop: 30 }}>
            <Ticker>{meta.kind === "mobile" ? "tap Download above for the " + meta.label + " app" : "your " + meta.label + " build is ready up top"}</Ticker>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────── how it works ───
function HowItWorks() {
  const ref = useReveal();
  const steps = [
    { n: "01", t: "Download & install", b: "Grab the signed app for your OS or the mobile companion. Install in under a minute — no kernel modules, no config files.", tag: "≈ 60 seconds" },
    { n: "02", t: "Learn your baseline", b: "The agent watches in read-only mode, mapping normal behavior across processes, browsers, and network for 48 hours.", tag: "48 hours, read-only" },
    { n: "03", t: "Defend autonomously", b: "Flip to active. Drift from baseline is contained at machine speed — you confirm the timeline after the fact.", tag: "< 10s detect-to-contain" },
  ];
  return (
    <section ref={ref} style={{ padding: "100px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 56, marginBottom: 56 }}>
        <div className="reveal"><Ticker>§ 03 — how it works</Ticker></div>
        <h2 className="reveal reveal-d1 display" style={{ fontSize: "clamp(36px, 4.6vw, 64px)", margin: 0, maxWidth: 760 }}>
          From download to <span style={{ color: "var(--orange)" }}>autonomous defense</span> in three moves.
        </h2>
      </div>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, borderTop: "1px solid var(--line-strong)" }}>
        {/* animated connecting line */}
        <svg aria-hidden style={{ position: "absolute", top: -1, left: 0, width: "100%", height: 2, overflow: "visible" }} preserveAspectRatio="none" viewBox="0 0 100 2">
          <line x1="0" y1="1" x2="100" y2="1" stroke="var(--orange)" strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset="1" style={{ animation: "drawLine 1.6s ease forwards" }} />
        </svg>
        {steps.map((s, i) => (
          <div key={s.n} className={cx("reveal", "hover-lift", `reveal-d${i+1}`)} style={{ padding: 30, borderRight: i < 2 ? "1px solid var(--line)" : "none", minHeight: 280, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="display" style={{ fontSize: 40, color: "var(--orange)" }}>{s.n}</span>
              <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
              <StepGlyph i={i} />
            </div>
            <h3 className="display" style={{ fontSize: 26, margin: 0 }}>{s.t}</h3>
            <p style={{ margin: 0, opacity: 0.72, lineHeight: 1.55, fontSize: 15 }}>{s.b}</p>
            <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px dashed var(--line-strong)" }}><Ticker>{s.tag}</Ticker></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepGlyph({ i }) {
  const c = "var(--sage)";
  if (i === 0) return (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" strokeLinecap="square" /></svg>);
  if (i === 1) return (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="square" /></svg>);
  return (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z" /><path d="m9 12 2 2 4-4" strokeLinecap="square" /></svg>);
}

// ───────────────────────────────────────────────────────── metrics band ───
function MetricsBand() {
  const ref = useReveal();
  const stats = [
    { to: 2.1, suffix: "M", label: "endpoints forged", decimals: 1 },
    { to: 9.3, suffix: "s", label: "median detect-to-contain", decimals: 1 },
    { to: 73, suffix: "%", label: "fewer false positives" },
    { to: 7, suffix: "", label: "regions, air-gapped" },
  ];
  return (
    <section ref={ref} style={{ padding: "72px 28px", background: "var(--black)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, border: "1px solid var(--line)" }}>
        {stats.map((s, i) => (
          <div key={s.label} className={cx("reveal", `reveal-d${i+1}`)} style={{ padding: "30px 24px", borderRight: i < 3 ? "1px solid var(--line)" : "none", textAlign: "center" }}>
            <div className="display" style={{ fontSize: "clamp(38px,4vw,58px)", color: i % 2 ? "var(--sage)" : "var(--orange)" }}>
              <CountUp to={s.to} suffix={s.suffix} decimals={s.decimals || 0} />
            </div>
            <div style={{ marginTop: 8 }}><Ticker>{s.label}</Ticker></div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────── platform marquee
function PlatformMarquee() {
  const items = ["WINDOWS", "·", "macOS", "·", "LINUX", "·", "iOS", "·", "ANDROID", "·", "DOCKER", "·", "KUBERNETES", "·", "ARM64", "·", "RISC-V", "·"];
  return (
    <div style={{ overflow: "hidden", background: "var(--raisin-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "marqueeRev 32s linear infinite", padding: "16px 0", fontFamily: "JetBrains Mono, monospace", fontWeight: 500, fontSize: 14, letterSpacing: 1, color: "var(--dusty)", opacity: 0.62 }}>
        {[...items, ...items, ...items].map((t, i) => (
          <span key={i} style={{ paddingInline: 20, color: t === "·" ? "var(--orange)" : "inherit" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── FAQ ────────────
function FAQ() {
  const ref = useReveal();
  const qs = [
    ["Is it really free to start?", "Yes — a full 48-hour trial in read-only mode, no card required. The agent learns your baseline before it ever takes an action, and you can uninstall cleanly at any time."],
    ["What does the desktop app collect?", "System inventory, process and network telemetry, and (optionally) local browser history — analyzed entirely on-device. Nothing leaves your machine without an explicit sync you control."],
    ["Do the desktop and mobile apps share state?", "One account ties them together. The desktop console is your full ops center; the mobile app mirrors device posture and pushes vulnerability alerts wherever you are."],
    ["How fast is detection?", "Median detect-to-contain is under 10 seconds. Behavioral drift triggers isolation locally — no round-trip to a cloud dashboard required."],
    ["Which platforms are supported?", "Windows 10/11, macOS (Apple Silicon + Intel), and major Linux distros on desktop; iOS 16+ and Android 10+ on mobile. x86, ARM64, and RISC-V are all supported."],
  ];
  const [open, setOpen] = useState(0);
  return (
    <section ref={ref} style={{ padding: "100px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 56 }}>
        <div>
          <div className="reveal"><Ticker>§ 06 — questions</Ticker></div>
          <h2 className="reveal reveal-d1 display" style={{ fontSize: "clamp(34px,4vw,56px)", margin: "14px 0 0" }}>
            Everything you&rsquo;d ask before you <span style={{ color: "var(--orange)" }}>install</span>.
          </h2>
        </div>
        <div className="reveal reveal-d1" style={{ borderTop: "1px solid var(--line-strong)" }}>
          {qs.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "24px 4px", background: "transparent", border: "none", color: "var(--dusty)", cursor: "pointer", textAlign: "left", fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
                  <span>{q}</span>
                  <span style={{ flex: "none", width: 28, height: 28, border: "1px solid var(--line-strong)", display: "grid", placeItems: "center", color: isOpen ? "var(--black)" : "var(--orange)", background: isOpen ? "var(--orange)" : "transparent", transition: "all 240ms ease", transform: isOpen ? "rotate(45deg)" : "none" }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 1v12M1 7h12" strokeLinecap="square" /></svg>
                  </span>
                </button>
                <div style={{ overflow: "hidden", maxHeight: isOpen ? 200 : 0, transition: "max-height 360ms cubic-bezier(.2,.7,.2,1)" }}>
                  <p style={{ margin: 0, padding: "0 4px 24px", maxWidth: 620, opacity: 0.74, lineHeight: 1.6, fontSize: 15 }}>{a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────── app ────────────
function ForgeApp() {
  const [os, setOs] = useState("Unknown");
  useEffect(() => { setOs(detectOS()); }, []);
  return (
    <div>
      <Header os={os} />
      <Hero os={os} />
      <Marquee />
      <AppShowcase os={os} />
      <Capabilities />
      <HowItWorks />
      <MetricsBand />
      <FieldStrip />
      <RuntimeView />
      <PlatformMarquee />
      <FAQ />
      <TrustQuote />
      <CTA os={os} />
      <Footer os={os} />
    </div>
  );
}

window.ForgeApp = ForgeApp;

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ForgeApp />);
