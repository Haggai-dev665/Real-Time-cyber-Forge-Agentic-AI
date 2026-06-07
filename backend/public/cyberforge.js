/* global React */
const { useState, useEffect, useRef } = React;

// ── local illustrations (copied from the CyberForge desktop app) ────────────
const ILLU = {
  inspect: "ilu1.svg",   // otp-security — every request inspected
  identity: "ilu2.svg",  // palm-recognition — learns YOUR device, on-device
};

// ───────────────────────────────────────────────────────── primitives ─────
const cx = (...c) => c.filter(Boolean).join(" ");

// viewport hook — drives every responsive layout decision
function useIsMobile(bp = 820) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return m;
}

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
  Windows: { label: "Windows", kind: "desktop", file: "CyberForge-Setup-1.0.exe", size: "78 MB", note: "Windows 10/11 · 64-bit" },
  macOS:   { label: "macOS",   kind: "desktop", file: "CyberForge-1.0.dmg",       size: "84 MB", note: "Apple Silicon + Intel" },
  Linux:   { label: "Linux",   kind: "desktop", file: "CyberForge-1.0.AppImage",  size: "80 MB", note: ".AppImage · .deb" },
  iOS:     { label: "iOS",     kind: "mobile",  file: "App Store",                size: "",      note: "iOS 16+ · iPhone & iPad" },
  Android: { label: "Android", kind: "mobile",  file: "Google Play",              size: "",      note: "Android 10+" },
  Unknown: { label: "your device", kind: "desktop", file: "CyberForge",           size: "",      note: "Pick your platform below" },
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

function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
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

const NAV = [["Platform", "#platform"], ["Features", "#features"], ["Security", "#security"], ["FAQ", "#faq"]];

// ───────────────────────────────────────────────────────── header ─────────
function Header({ os }) {
  const mob = useIsMobile();
  const [dl, setDl] = useState(false);
  const [menu, setMenu] = useState(false);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const time = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const meta = OS_META[os] || OS_META.Unknown;

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 60,
      background: "color-mix(in oklab, var(--raisin) 88%, transparent)",
      backdropFilter: "blur(14px) saturate(140%)",
      borderBottom: "1px solid var(--line)"
    }}>
      {!mob && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 28px", borderBottom: "1px solid var(--line)", fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--dusty)", opacity: 0.7 }}>
          <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Dot color="var(--sage)" /> agent · on-device &amp; active</span>
            <span style={{ opacity: 0.55 }}>local-first · nothing leaves your machine</span>
          </div>
          <div style={{ display: "flex", gap: 22 }}>
            <span>{time}</span>
            <span style={{ opacity: 0.55 }}>v1.0 · stable</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mob ? "13px 18px" : "18px 28px" }}>
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
          <LogoMark />
          <span className="display" style={{ fontSize: 20, letterSpacing: "-0.04em" }}>
            Cyber<span style={{ color: "var(--orange)" }}>Forge</span>
          </span>
        </a>

        {!mob && (
          <nav style={{ display: "flex", gap: 28 }}>
            {NAV.map(([item, href]) => (
              <a key={item} href={href} style={{ position: "relative", color: "var(--dusty)", textDecoration: "none", fontSize: 14, opacity: 0.85, padding: "6px 0" }}
                onMouseEnter={e => e.currentTarget.querySelector(".underline").style.transform = "scaleX(1)"}
                onMouseLeave={e => e.currentTarget.querySelector(".underline").style.transform = "scaleX(0)"}
              >
                {item}
                <span className="underline" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: "var(--orange)", transform: "scaleX(0)", transformOrigin: "left", transition: "transform 320ms cubic-bezier(.2,.7,.2,1)" }} />
              </a>
            ))}
          </nav>
        )}

        {!mob ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="#download" style={{ fontSize: 14, color: "var(--dusty)", opacity: 0.8, textDecoration: "none" }}>Sign in</a>
            <button onClick={() => setDl(true)} style={btnPrimary}>
              <OSIcon os={os} size={14} color="var(--black)" />
              <span>{meta.kind === "desktop" ? "Download for " + meta.label : "Download"}</span>
            </button>
          </div>
        ) : (
          <button onClick={() => setMenu(true)} aria-label="Open menu" style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--dusty)", width: 42, height: 38, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M0 1h18M0 7h18M0 13h18" strokeLinecap="square" /></svg>
          </button>
        )}
      </div>

      {mob && menu && <MobileMenu os={os} onClose={() => setMenu(false)} onDownload={() => { setMenu(false); setDl(true); }} />}
      {dl && <DownloadModal os={os} onClose={() => setDl(false)} />}
    </header>
  );
}

function MobileMenu({ os, onClose, onDownload }) {
  const meta = OS_META[os] || OS_META.Unknown;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--raisin)", display: "flex", flexDirection: "column", animation: "fadeUp 220ms ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LogoMark />
          <span className="display" style={{ fontSize: 20 }}>Cyber<span style={{ color: "var(--orange)" }}>Forge</span></span>
        </div>
        <button onClick={onClose} aria-label="Close menu" style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--dusty)", width: 42, height: 38, display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 2l12 12M14 2 2 14" strokeLinecap="square" /></svg>
        </button>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", padding: "10px 18px" }}>
        {NAV.map(([item, href]) => (
          <a key={item} href={href} onClick={onClose} className="display" style={{ fontSize: 34, color: "var(--dusty)", textDecoration: "none", padding: "16px 0", borderBottom: "1px solid var(--line)" }}>{item}</a>
        ))}
        <a href="#download" onClick={onClose} style={{ fontSize: 15, color: "var(--dusty)", opacity: 0.8, textDecoration: "none", padding: "20px 0" }}>Sign in</a>
      </nav>
      <div style={{ marginTop: "auto", padding: 18, borderTop: "1px solid var(--line)" }}>
        <button onClick={onDownload} style={{ ...btnPrimary, width: "100%", justifyContent: "center", padding: "16px", fontSize: 13 }}>
          <OSIcon os={os} size={15} color="var(--black)" />
          <span>{meta.kind === "mobile" ? "Get the " + meta.label + " app" : "Download for " + meta.label}</span>
        </button>
        <div style={{ marginTop: 12, textAlign: "center" }}><Ticker>local-first · on-device · free to start</Ticker></div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── hero ───────────
function Hero({ os }) {
  const mob = useIsMobile();
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const meta = OS_META[os] || OS_META.Unknown;
  const isMobile = meta.kind === "mobile";
  return (
    <section id="top" style={{ position: "relative", padding: mob ? "44px 18px 36px" : "72px 28px 40px", borderBottom: "1px solid var(--line)", overflow: "hidden" }}>
      <BackdropGrid />
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1.15fr 0.85fr", gap: mob ? 36 : 56, position: "relative" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 10px", border: "1px solid var(--line-strong)", borderRadius: 999, marginBottom: mob ? 22 : 32 }}>
            <Dot color="var(--orange)" />
            <Ticker>v1.0 · AI security console for your devices</Ticker>
          </div>

          <h1 className="display" style={{ fontSize: mob ? "clamp(40px, 12vw, 58px)" : "clamp(52px, 6.6vw, 104px)", margin: 0 }}>
            Security that{" "}
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 16 }}>
              <em style={{ fontStyle: "normal", color: "var(--orange)" }}>lives</em>
              {!mob && <SparkLine />}
            </span>{!mob && <br />}{" "}
            on your device.
          </h1>

          <p style={{ maxWidth: 540, marginTop: mob ? 20 : 28, fontSize: mob ? 16 : 18, lineHeight: 1.55, color: "var(--dusty)", opacity: 0.78 }}>
            CyberForge is an AI security console for your computer and phone. It scans every link and download in real time, runs an autonomous agent that contains threats the instant they appear, and analyzes everything <strong style={{ color: "var(--dusty)", opacity: 1 }}>on-device</strong> — nothing is uploaded to a cloud you don&rsquo;t control.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: mob ? 26 : 36, flexWrap: "wrap" }}>
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
            <Ticker>{isMobile ? meta.note : "Detected " + meta.label + " · " + meta.note + (meta.size ? " · " + meta.size : "")} · free to start</Ticker>
          </div>

          <div style={{ display: "flex", gap: mob ? 22 : 40, marginTop: mob ? 32 : 44, paddingTop: 28, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
            {[
              ["< 10s", "detect-to-contain"],
              ["4", "ML detection models"],
              ["100%", "runs on-device"],
            ].map(([num, label]) => (
              <div key={label}>
                <div className="display" style={{ fontSize: mob ? 26 : 32, color: "var(--dusty)" }}>{num}</div>
                <Ticker>{label}</Ticker>
              </div>
            ))}
          </div>
        </div>

        <ThreatPanel mob={mob} />
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
    <svg width="110" height="40" viewBox="0 0 120 44" style={{ overflow: "visible" }}>
      <path d="M2 32 L18 28 L34 30 L46 14 L62 18 L78 8 L94 22 L118 6" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="118" cy="6" r="4" fill="var(--orange)" />
      <circle cx="118" cy="6" r="9" fill="none" stroke="var(--orange)" strokeWidth="1" opacity="0.5">
        <animate attributeName="r" values="4;14;4" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// live-ish scan feed (generated locally — illustrates the real-time URL engine)
function ThreatPanel({ mob }) {
  const seed = useRef([
    { t: "—:—", url: "secure-login-update.account-verify.co", kind: "phishing", sev: "critical" },
    { t: "—:—", url: "cdn.fast-invoice.app/inv-2291.pdf", kind: "malware", sev: "high" },
    { t: "—:—", url: "tracker.adsync-metrics.io/px", kind: "tracker", sev: "med" },
    { t: "—:—", url: "github.com/login", kind: "clean", sev: "low" },
    { t: "—:—", url: "api.weatherbit.io/v2/current", kind: "clean", sev: "low" },
  ]);
  const [rows, setRows] = useState(seed.current);
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 1900); return () => clearInterval(i); }, []);
  useEffect(() => {
    const stamp = new Date().toTimeString().slice(0, 8);
    const pool = [
      { url: "login.micros0ft-account.help/auth", kind: "phishing", sev: "critical" },
      { url: "download.codec-pack-pro.net/setup.exe", kind: "malware", sev: "high" },
      { url: "wp-content.payment-portal.cc/pay", kind: "phishing", sev: "high" },
      { url: "static.cloudflare.com/cf.js", kind: "clean", sev: "low" },
      { url: "beacon.analytics-edge.io/c2", kind: "c2 beacon", sev: "critical" },
      { url: "mail.google.com/mail/u/0", kind: "clean", sev: "low" },
      { url: "unpkg.com/react@18/umd/react.js", kind: "clean", sev: "low" },
      { url: "files.drive-share.support/doc.scr", kind: "malware", sev: "high" },
    ];
    const next = { t: stamp, ...pool[rand(0, pool.length - 1)] };
    setRows(r => [next, ...r].slice(0, 6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const sevColor = { critical: "var(--orange)", high: "var(--orange)", med: "var(--sage)", low: "var(--sage)" };
  const sevOpacity = { critical: 1, high: 0.7, med: 1, low: 0.45 };
  const cols = mob ? "1fr 64px 62px" : "62px 1fr 78px 70px";

  return (
    <div style={{ position: "relative", background: "var(--black)", color: "var(--dusty)", border: "1px solid var(--line-strong)", overflow: "hidden", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Dot color="var(--orange)" /><Ticker>LIVE · on-device scan feed</Ticker></div>
        <Ticker>browser intelligence</Ticker>
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: cols, gap: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--dusty)", opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {!mob && <span>time</span>}<span>request</span><span>verdict</span><span>action</span>
      </div>
      <div style={{ maxHeight: 240, overflow: "hidden" }}>
        {rows.map((r, i) => {
          const blocked = r.sev === "critical" || r.sev === "high";
          return (
            <div key={`${r.t}-${r.url}-${i}`} style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: cols, gap: 10, fontFamily: "JetBrains Mono, monospace", fontSize: mob ? 10.5 : 12, borderBottom: "1px solid var(--line)", animation: i === 0 ? "rowIn 420ms cubic-bezier(.2,.7,.2,1)" : "none", background: i === 0 ? "color-mix(in oklab, var(--orange) 8%, transparent)" : "transparent" }}>
              {!mob && <span style={{ opacity: 0.6 }}>{r.t}</span>}
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.url}</span>
              <span style={{ color: sevColor[r.sev], opacity: sevOpacity[r.sev], textTransform: "uppercase", letterSpacing: 0.3 }}>● {r.kind}</span>
              <span style={{ color: blocked ? "var(--orange)" : "var(--sage)", letterSpacing: 0.3 }}>{blocked ? "blocked" : "allowed"}</span>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Ticker>auto-contain · enabled</Ticker>
        <span className="mono" style={{ fontSize: 11, color: "var(--orange)" }}>{rows.filter(r => r.sev === "critical" || r.sev === "high").length} blocked now</span>
      </div>
    </div>
  );
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ───────────────────────────────────────────────────────── marquee ────────
function Marquee() {
  const items = ["REAL-TIME URL SCANNING", "★", "BROWSER INTELLIGENCE", "★", "ON-DEVICE AI", "★", "AUTONOMOUS RESPONSE", "★", "LOCAL-FIRST · NO CLOUD", "★", "DEEPSEEK ASSISTANT", "★", "DESKTOP + MOBILE", "★"];
  return (
    <div style={{ overflow: "hidden", background: "var(--orange)", color: "var(--black)", borderTop: "1px solid var(--black)", borderBottom: "1px solid var(--black)" }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "marquee 38s linear infinite", padding: "13px 0", fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 20, letterSpacing: "-0.02em" }}>
        {[...items, ...items, ...items].map((t, i) => (
          <span key={i} style={{ paddingInline: 22, display: "inline-flex", alignItems: "center" }}>{t === "★" ? <Star /> : t}</span>
        ))}
      </div>
    </div>
  );
}

function Star() {
  return (<svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "inline-block" }}><path d="M7 0 L8.5 5.5 L14 7 L8.5 8.5 L7 14 L5.5 8.5 L0 7 L5.5 5.5 Z" fill="var(--black)" /></svg>);
}

// ───────────────────────────────────────────────────────── app showcase ──
function AppShowcase({ os }) {
  const mob = useIsMobile();
  const ref = useReveal();
  const meta = OS_META[os] || OS_META.Unknown;
  return (
    <section id="platform" ref={ref} style={{ padding: mob ? "64px 18px" : "100px 28px", borderBottom: "1px solid var(--line)", position: "relative", overflow: "hidden" }}>
      <BackdropGrid />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 44 : 56, alignItems: "center" }}>
        <div className="reveal" style={{ position: "relative", minHeight: mob ? 360 : 440, order: mob ? 2 : 1 }}>
          <div className="float-y" style={{ position: "relative", border: "1px solid var(--line-strong)", background: "var(--black)", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", borderBottom: "1px solid var(--line)", background: "var(--raisin)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--orange)" }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--sage)" }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--dusty)", opacity: 0.35 }} />
              <span className="mono" style={{ marginLeft: 8, fontSize: 10, opacity: 0.55, textTransform: "uppercase", letterSpacing: 0.5 }}>CyberForge — Threat Overview</span>
            </div>
            <div style={{ position: "relative", padding: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, minHeight: 230 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 40, background: "linear-gradient(180deg, transparent, color-mix(in oklab, var(--sage) 22%, transparent))", borderBottom: "1px solid color-mix(in oklab, var(--sage) 60%, transparent)", animation: "scanDown 3.4s linear infinite", pointerEvents: "none" }} />
              {[["< 10s", "contain"], ["4", "ML models"], ["100%", "on-device"]].map(([n, l]) => (
                <div key={l} style={{ border: "1px solid var(--line)", padding: "12px 12px" }}>
                  <div className="display" style={{ fontSize: 22, color: "var(--orange)" }}>{n}</div>
                  <Ticker>{l}</Ticker>
                </div>
              ))}
              <div style={{ gridColumn: "1 / -1", border: "1px solid var(--line)", padding: 12 }}>
                <Ticker>live scan feed</Ticker>
                <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
                  {[["account-verify.co", "phishing", "var(--orange)"], ["invoice.app/inv.pdf", "malware", "var(--orange)"], ["github.com/login", "clean", "var(--sage)"]].map((r, i) => (
                    <div key={i} className="mono" style={{ display: "grid", gridTemplateColumns: "1fr 70px 16px", gap: 8, fontSize: 11, opacity: 0.85 }}>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r[0]}</span><span style={{ color: "var(--sage)" }}>{r[1]}</span><span style={{ color: r[2] }}>●</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="float-y-sm" style={{ position: "absolute", right: mob ? 2 : -6, bottom: -20, width: 150, border: "1px solid var(--line-strong)", borderRadius: 22, background: "var(--raisin)", boxShadow: "0 24px 50px -18px rgba(0,0,0,0.85)", overflow: "hidden" }}>
            <div style={{ height: 22, display: "grid", placeItems: "center" }}><span style={{ width: 42, height: 5, borderRadius: 999, background: "var(--line-strong)" }} /></div>
            <div style={{ padding: "0 12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><LogoMark size={18} /><span className="display" style={{ fontSize: 13 }}>Cyber<span style={{ color: "var(--orange)" }}>Forge</span></span></div>
              <div style={{ border: "1px solid var(--line)", padding: 10, marginBottom: 8 }}><Ticker>device · secure</Ticker><div className="display" style={{ fontSize: 26, color: "var(--sage)", marginTop: 4 }}>OK</div></div>
              <div style={{ display: "grid", gap: 6 }}>
                {["browser · clean", "network · clean", "2 alerts handled"].map((t, i) => (
                  <div key={i} className="mono" style={{ fontSize: 9, display: "flex", gap: 7, alignItems: "center", opacity: 0.82 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: i === 2 ? "var(--orange)" : "var(--sage)" }} />{t}</div>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: "8px 0", textAlign: "center", background: "var(--orange)", color: "var(--black)", fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 600 }}>agent active</div>
            </div>
          </div>
        </div>

        <div style={{ order: mob ? 1 : 2 }}>
          <div className="reveal"><Ticker>§ 01 — one platform</Ticker></div>
          <h2 className="reveal reveal-d1 display" style={{ fontSize: mob ? "clamp(32px,8.5vw,42px)" : "clamp(38px, 4.6vw, 66px)", margin: "14px 0 22px" }}>
            Full console on desktop. <span style={{ color: "var(--sage)" }}>Sentinel in your pocket.</span>
          </h2>
          <p className="reveal reveal-d2" style={{ fontSize: mob ? 16 : 17, lineHeight: 1.55, opacity: 0.78, maxWidth: 520, margin: 0 }}>
            The desktop app is your full operations console — threat overview, browser intelligence, the URL sandbox, the AI assistant, and the Security-Functions policy engine. The mobile companion keeps the same agent watching your phone and pushes an alert the instant something tries the door.
          </p>
          <ul className="reveal reveal-d3" style={{ listStyle: "none", padding: 0, margin: "30px 0 0", display: "grid", gap: 14 }}>
            {[
              "Native desktop apps for Windows, macOS & Linux",
              "Companion apps for iOS & Android",
              "One account — posture syncs across your devices",
              "Local-first: analysis runs on your machine",
            ].map(li => (
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

// ───────────────────────────────────────────────────────── capabilities ───
function Capabilities() {
  const mob = useIsMobile();
  const items = [
    { n: "01", title: "Real-time detection", body: "Every link, download, and browser request is scored on-device against four ML models — phishing, malware, anomaly, and web-attack. Anything suspicious is detonated in the sandbox before it can touch your data.", stat: "4 ML models · on-device" },
    { n: "02", title: "Autonomous response", body: "Security Functions decide what happens the instant a threat fires: block the request, alert you, or secure the system. You set the policy once; the agent enforces it without waiting on a click.", stat: "block · alert · secure" },
    { n: "03", title: "Local-first privacy", body: "Your system, browser, and history are analyzed entirely on your machine. The model that protects you is yours — nothing is uploaded unless you explicitly choose to sync it.", stat: "0 data sent to the cloud" },
  ];
  return (
    <section id="security" style={{ padding: mob ? "64px 18px" : "96px 28px 80px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 2fr", gap: mob ? 18 : 56, marginBottom: mob ? 36 : 56 }}>
        <Ticker>§ 02 — capability surface</Ticker>
        <h2 className="display" style={{ fontSize: mob ? "clamp(30px,8vw,40px)" : "clamp(40px, 5vw, 72px)", margin: 0, maxWidth: 800 }}>
          Three jobs. <span style={{ color: "var(--sage)" }}>One contract:</span> nothing reaches you without a verdict.
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3, 1fr)", borderTop: "1px solid var(--line-strong)" }}>
        {items.map((it, i) => <CapCard key={it.n} {...it} last={i === items.length - 1} mob={mob} />)}
      </div>
    </section>
  );
}

function CapCard({ n, title, body, stat, last, mob }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: mob ? 24 : 32, borderRight: !mob && !last ? "1px solid var(--line)" : "none", borderBottom: mob && !last ? "1px solid var(--line)" : "none", background: hov ? "color-mix(in oklab, var(--orange) 6%, transparent)" : "transparent", transition: "background 240ms ease", position: "relative", minHeight: mob ? "auto" : 340, display: "flex", flexDirection: "column", gap: mob ? 18 : 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Ticker className="mono">{n}</Ticker>
        <div style={{ width: 32, height: 32, border: "1px solid var(--line-strong)", display: "grid", placeItems: "center", transition: "transform 320ms cubic-bezier(.2,.7,.2,1), background 240ms ease", transform: hov ? "rotate(45deg)" : "rotate(0)", background: hov ? "var(--orange)" : "transparent", color: hov ? "var(--black)" : "var(--dusty)" }}>
          <ArrowRight />
        </div>
      </div>
      <h3 className="display" style={{ fontSize: 26, margin: 0, maxWidth: 260 }}>{title}</h3>
      <p style={{ margin: 0, color: "var(--dusty)", opacity: 0.72, lineHeight: 1.55, fontSize: 15 }}>{body}</p>
      <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px dashed var(--line-strong)" }}><Ticker>{stat}</Ticker></div>
    </div>
  );
}

// ───────────────────────────────────────────── illustrated features (ilu) ──
function IlluFeatures() {
  const mob = useIsMobile();
  const ref = useReveal();
  const blocks = [
    { img: ILLU.inspect, eyebrow: "browser intelligence", title: "Every request, inspected.", body: "CyberForge watches the links you open and the requests your apps make, scoring each one in real time. Suspicious URLs are pulled into the sandbox and detonated before anything reaches your browser — no extension store, no cloud round-trip.", points: ["Real-time URL & download scanning", "Sandbox detonation of suspicious links", "Phishing, malware & web-attack models"], flip: false },
    { img: ILLU.identity, eyebrow: "on-device intelligence", title: "It learns your machine — not the cloud.", body: "The agent maps your device's normal behavior across processes, network, and browsing, then treats drift from that baseline as the signal. The intelligence that protects you runs locally and stays with you.", points: ["48-hour baseline, fully on-device", "Behavioral drift = the trigger", "Your data never leaves unless you sync it"], flip: true },
  ];
  return (
    <section id="features" ref={ref} style={{ padding: mob ? "64px 18px" : "96px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ marginBottom: mob ? 40 : 56 }}>
        <div className="reveal"><Ticker>§ 02b — how it sees</Ticker></div>
        <h2 className="reveal reveal-d1 display" style={{ fontSize: mob ? "clamp(30px,8vw,40px)" : "clamp(36px, 4.4vw, 64px)", margin: "14px 0 0", maxWidth: 820 }}>
          Built to watch the things that <span style={{ color: "var(--orange)" }}>actually</span> attack you.
        </h2>
      </div>
      <div style={{ display: "grid", gap: mob ? 48 : 72 }}>
        {blocks.map((b) => (
          <div key={b.title} className="reveal" style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : (b.flip ? "0.9fr 1.1fr" : "1.1fr 0.9fr"), gap: mob ? 28 : 56, alignItems: "center" }}>
            <IlluFrame img={b.img} order={mob ? 1 : (b.flip ? 2 : 1)} />
            <div style={{ order: mob ? 2 : (b.flip ? 1 : 2) }}>
              <Ticker>{b.eyebrow}</Ticker>
              <h3 className="display" style={{ fontSize: mob ? "clamp(26px,7vw,34px)" : "clamp(30px,3.4vw,48px)", margin: "12px 0 16px", maxWidth: 460 }}>{b.title}</h3>
              <p style={{ margin: 0, fontSize: mob ? 15.5 : 17, lineHeight: 1.6, opacity: 0.78, maxWidth: 520 }}>{b.body}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "26px 0 0", display: "grid", gap: 12 }}>
                {b.points.map(p => (
                  <li key={p} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ width: 16, height: 1, background: "var(--orange)", flex: "none" }} />
                    <span style={{ fontSize: 14.5, opacity: 0.86 }}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IlluFrame({ img, order }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ order, position: "relative", border: "1px solid var(--line-strong)", background: "radial-gradient(120% 120% at 30% 20%, var(--raisin-2), var(--black))", aspectRatio: "1 / 1", overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)", backgroundSize: "44px 44px", opacity: 0.5, pointerEvents: "none" }} />
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: "absolute", top: 14, left: 14, color: "var(--orange)" }}><path d="M0 0 H10 M0 0 V10" stroke="currentColor" strokeWidth="1.2" /></svg>
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: "absolute", bottom: 14, right: 14, color: "var(--orange)" }}><path d="M22 22 H12 M22 22 V12" stroke="currentColor" strokeWidth="1.2" /></svg>
      <img src={img} alt="" style={{ position: "relative", width: "76%", height: "76%", objectFit: "contain", transform: hov ? "scale(1.04)" : "scale(1)", transition: "transform 700ms cubic-bezier(.2,.7,.2,1)", filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.5))" }} />
    </div>
  );
}

// ───────────────────────────────────────────────────────── how it works ───
function HowItWorks() {
  const mob = useIsMobile();
  const ref = useReveal();
  const steps = [
    { n: "01", t: "Download & install", b: "Grab the signed app for your OS or the mobile companion. Install in under a minute — no config files, no browser extensions to wire up.", tag: "≈ 60 seconds" },
    { n: "02", t: "Learn your baseline", b: "The agent watches in read-only mode, mapping normal behavior across processes, browsers, and network so it knows what 'you' looks like.", tag: "48 hours, read-only" },
    { n: "03", t: "Defend autonomously", b: "Flip Security Functions to active. Drift from baseline is contained on-device — blocked, alerted, or quarantined — and you review the timeline after.", tag: "< 10s detect-to-contain" },
  ];
  return (
    <section style={{ padding: mob ? "64px 18px" : "100px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 2fr", gap: mob ? 18 : 56, marginBottom: mob ? 36 : 56 }}>
        <div className="reveal"><Ticker>§ 03 — how it works</Ticker></div>
        <h2 className="reveal reveal-d1 display" style={{ fontSize: mob ? "clamp(30px,8vw,40px)" : "clamp(36px, 4.6vw, 64px)", margin: 0, maxWidth: 760 }}>
          From download to <span style={{ color: "var(--orange)" }}>autonomous defense</span> in three moves.
        </h2>
      </div>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3,1fr)", gap: 0, borderTop: "1px solid var(--line-strong)" }}>
        {steps.map((s, i) => (
          <div key={s.n} className={cx("reveal", "hover-lift", `reveal-d${i + 1}`)} style={{ padding: mob ? 24 : 30, borderRight: !mob && i < 2 ? "1px solid var(--line)" : "none", borderBottom: mob && i < 2 ? "1px solid var(--line)" : "none", minHeight: mob ? "auto" : 280, display: "flex", flexDirection: "column", gap: 18 }}>
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
  const mob = useIsMobile();
  const ref = useReveal();
  const stats = [
    { to: 4, suffix: "", label: "ML detection models" },
    { to: 10, prefix: "<", suffix: "s", label: "detect-to-contain" },
    { to: 100, suffix: "%", label: "runs on-device" },
    { to: 5, suffix: "", label: "platforms · desktop + mobile" },
  ];
  return (
    <section ref={ref} style={{ padding: mob ? "48px 18px" : "72px 28px", background: "var(--black)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4,1fr)", gap: 0, border: "1px solid var(--line)" }}>
        {stats.map((s, i) => (
          <div key={s.label} className={cx("reveal", `reveal-d${(i % 4) + 1}`)} style={{ padding: mob ? "24px 16px" : "30px 24px", borderRight: (!mob && i < 3) || (mob && i % 2 === 0) ? "1px solid var(--line)" : "none", borderBottom: mob && i < 2 ? "1px solid var(--line)" : "none", textAlign: "center" }}>
            <div className="display" style={{ fontSize: mob ? "clamp(30px,9vw,40px)" : "clamp(38px,4vw,58px)", color: i % 2 ? "var(--sage)" : "var(--orange)" }}>
              <CountUp to={s.to} prefix={s.prefix || ""} suffix={s.suffix} />
            </div>
            <div style={{ marginTop: 8 }}><Ticker>{s.label}</Ticker></div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────── runtime view ───
function RuntimeView() {
  const mob = useIsMobile();
  return (
    <section style={{ padding: mob ? "64px 18px" : "96px 28px", background: "var(--black)", borderBottom: "1px solid var(--line)", color: "var(--dusty)", position: "relative", overflow: "hidden" }}>
      <BackdropGrid />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(700px 380px at 78% 20%, color-mix(in oklab, var(--orange) 10%, transparent), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 36 : 56, position: "relative", alignItems: "center" }}>
        <div>
          <Ticker>§ 04 — the agent</Ticker>
          <h2 className="display" style={{ fontSize: mob ? "clamp(30px,8vw,42px)" : "clamp(38px, 5vw, 70px)", margin: "16px 0 24px" }}>
            One agent.<br /><span style={{ color: "var(--orange)" }}>On your device.</span><br />Always watching.
          </h2>
          <p style={{ maxWidth: 480, fontSize: mob ? 16 : 17, lineHeight: 1.55, opacity: 0.78 }}>
            CyberForge runs the detection models, the URL sandbox, and the policy engine locally. When a request scores as a threat, the agent acts on your policy in milliseconds — no dashboard round-trip, no waiting on the cloud.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "32px 0 0", display: "grid", gap: 14 }}>
            {["Four ML models loaded on-device", "Real-time URL & download scanning", "Policy engine: block · alert · secure", "DeepSeek-powered AI security assistant"].map(li => (
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
    { p: "$", t: "cyberforge watch --device this", c: "var(--dusty)" },
    { p: ">", t: "loading models: phishing · malware · anomaly · web-attack  ok", c: "var(--sage)" },
    { p: ">", t: "baseline ready — browser + network + process", c: "var(--sage)" },
    { p: "$", t: "open https://secure-login-update.account-verify.co", c: "var(--dusty)" },
    { p: "!", t: "[url scan] phishing score 0.94 — credential harvest", c: "var(--orange)" },
    { p: ">", t: "  └─ sandbox: clone of accounts.google.com login", c: "var(--dusty)", o: 0.65 },
    { p: ">", t: "  └─ policy: BLOCK request · alert raised · logged", c: "var(--sage)" },
    { p: "✓", t: "blocked in 00:00:00.412 — nothing reached the browser", c: "var(--sage)" },
  ];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= lines.length) { const r = setTimeout(() => setShown(0), 4200); return () => clearTimeout(r); }
    const t = setTimeout(() => setShown(s => s + 1), 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  return (
    <div style={{ border: "1px solid var(--line-strong)", background: "var(--raisin)", fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, lineHeight: 1.7, color: "var(--dusty)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--line)", background: "var(--black)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--orange)" }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--sage)" }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--dusty)", opacity: 0.4 }} />
        </div>
        <Ticker>cyberforge — agent</Ticker>
      </div>
      <div style={{ padding: 18, minHeight: 300 }}>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 10, opacity: l.o ?? 1 }}>
            <span style={{ color: l.c, opacity: 0.7, width: 12, flex: "none" }}>{l.p}</span>
            <span style={{ color: l.c, wordBreak: "break-all" }}>{l.t}</span>
          </div>
        ))}
        {shown < lines.length && shown > 0 && (<span style={{ display: "inline-block", width: 8, height: 14, background: "var(--orange)", marginTop: 2, animation: "blink 0.9s steps(2) infinite" }} />)}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────── platform marquee ───
function PlatformMarquee() {
  const items = ["WINDOWS", "·", "macOS", "·", "LINUX", "·", "iOS", "·", "ANDROID", "·"];
  return (
    <div style={{ overflow: "hidden", background: "var(--raisin-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "marqueeRev 30s linear infinite", padding: "16px 0", fontFamily: "JetBrains Mono, monospace", fontWeight: 500, fontSize: 14, letterSpacing: 1, color: "var(--dusty)", opacity: 0.62 }}>
        {[...items, ...items, ...items, ...items].map((t, i) => (<span key={i} style={{ paddingInline: 20, color: t === "·" ? "var(--orange)" : "inherit" }}>{t}</span>))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── FAQ ────────────
function FAQ() {
  const mob = useIsMobile();
  const ref = useReveal();
  const qs = [
    ["Is it really free to start?", "Yes — install and run the agent in read-only mode at no cost. It learns your baseline before it ever takes an action, and you can uninstall cleanly at any time."],
    ["What does the desktop app collect?", "System inventory, process and network telemetry, and (optionally) local browser history — all analyzed on-device. Nothing leaves your machine without an explicit sync you control."],
    ["Do the desktop and mobile apps share state?", "One account ties them together. The desktop console is your full ops center; the mobile app mirrors device posture and pushes alerts wherever you are."],
    ["How fast is detection?", "Detect-to-contain is typically under 10 seconds. URL and behavioral scoring run locally, so there's no round-trip to a cloud dashboard before the agent acts."],
    ["Which platforms are supported?", "Windows 10/11, macOS (Apple Silicon + Intel), and major Linux distros on desktop; iOS 16+ and Android 10+ on mobile."],
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" ref={ref} style={{ padding: mob ? "64px 18px" : "100px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 2fr", gap: mob ? 24 : 56 }}>
        <div>
          <div className="reveal"><Ticker>§ 06 — questions</Ticker></div>
          <h2 className="reveal reveal-d1 display" style={{ fontSize: mob ? "clamp(28px,7.5vw,38px)" : "clamp(34px,4vw,56px)", margin: "14px 0 0" }}>
            Everything you&rsquo;d ask before you <span style={{ color: "var(--orange)" }}>install</span>.
          </h2>
        </div>
        <div className="reveal reveal-d1" style={{ borderTop: "1px solid var(--line-strong)" }}>
          {qs.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "22px 4px", background: "transparent", border: "none", color: "var(--dusty)", cursor: "pointer", textAlign: "left", fontFamily: "Space Grotesk, sans-serif", fontSize: mob ? 17 : 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
                  <span>{q}</span>
                  <span style={{ flex: "none", width: 28, height: 28, border: "1px solid var(--line-strong)", display: "grid", placeItems: "center", color: isOpen ? "var(--black)" : "var(--orange)", background: isOpen ? "var(--orange)" : "transparent", transition: "all 240ms ease", transform: isOpen ? "rotate(45deg)" : "none" }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 1v12M1 7h12" strokeLinecap="square" /></svg>
                  </span>
                </button>
                <div style={{ overflow: "hidden", maxHeight: isOpen ? 240 : 0, transition: "max-height 360ms cubic-bezier(.2,.7,.2,1)" }}>
                  <p style={{ margin: 0, padding: "0 4px 22px", maxWidth: 620, opacity: 0.74, lineHeight: 1.6, fontSize: 15 }}>{a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────── trust strip ────
function TrustStrip() {
  const mob = useIsMobile();
  const points = [
    ["On-device by default", "Detection, scanning, and the AI assistant run locally. The cloud is opt-in, never the default."],
    ["Honest about data", "You can see exactly what's collected and turn off browser-history access entirely. No silent telemetry."],
    ["Yours to remove", "No agents buried in the kernel. Uninstall cleanly whenever you want and the device is exactly as it was."],
  ];
  return (
    <section style={{ padding: mob ? "64px 18px" : "96px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 820, marginBottom: mob ? 40 : 56 }}>
        <Ticker>§ 05 — why people install it</Ticker>
        <h2 className="display" style={{ fontSize: mob ? "clamp(28px,7.5vw,38px)" : "clamp(34px,4vw,58px)", margin: "14px 0 0" }}>
          For people who&rsquo;d rather not hand their security to <span style={{ color: "var(--orange)" }}>someone else&rsquo;s cloud</span>.
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3,1fr)", gap: 0, border: "1px solid var(--line)" }}>
        {points.map(([t, b], i) => (
          <div key={t} style={{ padding: mob ? 24 : 30, borderRight: !mob && i < 2 ? "1px solid var(--line)" : "none", borderBottom: mob && i < 2 ? "1px solid var(--line)" : "none", display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ width: 30, height: 30, border: "1px solid var(--line-strong)", display: "grid", placeItems: "center", color: "var(--sage)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z" /><path d="m9 12 2 2 4-4" strokeLinecap="square" /></svg>
            </span>
            <h3 className="display" style={{ fontSize: 22, margin: "4px 0 0" }}>{t}</h3>
            <p style={{ margin: 0, opacity: 0.74, lineHeight: 1.55, fontSize: 14.5 }}>{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────── CTA ────────────
function CTA({ os }) {
  const mob = useIsMobile();
  const [open, setOpen] = useState(false);
  const meta = OS_META[os] || OS_META.Unknown;
  return (
    <section id="download" style={{ position: "relative", padding: mob ? "72px 18px" : "120px 28px", background: "var(--orange)", color: "var(--black)", overflow: "hidden", borderBottom: "1px solid var(--black)" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: mob ? "1fr" : "1.4fr 1fr", gap: mob ? 32 : 56, alignItems: "end" }}>
        <h2 className="display" style={{ fontSize: mob ? "clamp(42px,12vw,60px)" : "clamp(52px, 7.5vw, 120px)", margin: 0 }}>
          Download it.<br />Point it at your<br />device. <em style={{ fontStyle: "normal", textDecoration: "underline", textUnderlineOffset: 10, textDecorationThickness: 4 }}>Forge</em> it.
        </h2>
        <div>
          <p style={{ fontSize: mob ? 16 : 17, lineHeight: 1.5, marginTop: 0 }}>
            Free to start, read-only at first. The agent watches and learns before it ever acts — on desktop or mobile.
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
  const mob = useIsMobile();
  const cols = [
    ["Platform", ["Threat overview", "Browser intelligence", "URL sandbox", "Security functions", "Reports"]],
    ["Apps", ["Windows", "macOS", "Linux", "iOS", "Android"]],
    ["Company", ["About", "Privacy", "Security disclosures", "Contact"]],
    ["Resources", ["Docs", "FAQ", "Changelog · 1.0", "Status"]],
  ];
  return (
    <footer style={{ background: "var(--raisin)", padding: mob ? "48px 18px 28px" : "72px 28px 32px", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1.4fr repeat(4, 1fr)", gap: mob ? 28 : 40, paddingBottom: mob ? 40 : 56, borderBottom: "1px solid var(--line)" }}>
        <div style={{ gridColumn: mob ? "1 / -1" : "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
            <LogoMark />
            <span className="display" style={{ fontSize: 22 }}>Cyber<span style={{ color: "var(--orange)" }}>Forge</span></span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.7, maxWidth: 300 }}>
            An AI security console for your devices. Local-first, on-device, cross-platform — desktop and mobile.
          </p>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--line-strong)" }}>
            <Dot color="var(--sage)" /><Ticker>agent · on-device &amp; active</Ticker>
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
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--dusty)"; }}>{i}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ padding: mob ? "32px 0 12px" : "48px 0 12px", textAlign: "center", lineHeight: 0.85, letterSpacing: "-0.05em" }}>
        <div className="display" style={{ fontSize: "clamp(56px, 16vw, 240px)", color: "transparent", WebkitTextStroke: "1px var(--line-strong)" }}>
          CYBER<span style={{ WebkitTextStroke: "1px var(--orange)" }}>·</span>FORGE
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: mob ? "column" : "row", gap: mob ? 14 : 0, justifyContent: "space-between", paddingTop: 28, borderTop: "1px solid var(--line)" }}>
        <Ticker>© 2026 CyberForge — local-first AI security</Ticker>
        <div style={{ display: "flex", gap: 22 }}><Ticker>privacy</Ticker><Ticker>terms</Ticker><Ticker>responsible disclosure</Ticker></div>
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

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const start = () => { if (isMobile) return; setDownloading(true); setTimeout(() => setDownloading(false), 2400); };

  const PlatformBtn = ({ k }) => {
    const m = OS_META[k];
    const active = picked === k;
    return (
      <button onClick={() => { setPicked(k); setDownloading(false); }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 8px", cursor: "pointer", background: active ? "color-mix(in oklab, var(--orange) 12%, transparent)" : "transparent", border: active ? "1px solid var(--orange)" : "1px solid var(--line-strong)", color: "var(--dusty)", transition: "all 180ms ease", position: "relative" }}>
        {k === detected && (<span className="mono" style={{ position: "absolute", top: -8, right: -1, fontSize: 8, background: "var(--sage)", color: "var(--black)", padding: "2px 5px", letterSpacing: 0.4, textTransform: "uppercase" }}>You</span>)}
        <OSIcon os={k} size={24} color={active ? "var(--orange)" : "var(--dusty)"} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
      </button>
    );
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "grid", placeItems: "center", backdropFilter: "blur(6px)", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: "100%", background: "var(--raisin)", border: "1px solid var(--line-strong)", padding: 28, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <Ticker>§ download.init</Ticker>
        <h3 className="display" style={{ fontSize: 28, margin: "10px 0 6px" }}>Install Cyber<span style={{ color: "var(--orange)" }}>Forge</span>.</h3>
        <p style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.5, margin: "0 0 22px" }}>
          {detected ? `We detected ${OS_META[detected].label}. ` : ""}Choose your platform — desktop agent or mobile companion.
        </p>
        <div style={{ marginBottom: 8 }}><Ticker>Desktop</Ticker></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>{desktops.map(k => <PlatformBtn key={k} k={k} />)}</div>
        <div style={{ marginBottom: 8 }}><Ticker>Mobile</Ticker></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 24 }}>{mobiles.map(k => <PlatformBtn key={k} k={k} />)}</div>
        <div style={{ border: "1px solid var(--line)", padding: 16, marginBottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <OSIcon os={picked} size={28} color="var(--orange)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{isMobile ? `CyberForge for ${meta.label}` : meta.file}</div>
            <Ticker>{meta.note}{meta.size ? " · " + meta.size : ""}</Ticker>
          </div>
        </div>
        {isMobile ? (
          <button style={{ ...btnPrimary, width: "100%", padding: "15px 18px", justifyContent: "center", gap: 10 }}>
            <OSIcon os={picked} size={15} color="var(--black)" /><span>Get it on {picked === "iOS" ? "the App Store" : "Google Play"}</span>
          </button>
        ) : (
          <button onClick={start} disabled={downloading} style={{ ...btnPrimary, width: "100%", padding: "15px 18px", justifyContent: "center", gap: 10, opacity: downloading ? 0.8 : 1 }}>
            {downloading ? (<><span style={{ width: 13, height: 13, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "var(--black)", borderRadius: 999, animation: "spin 0.7s linear infinite" }} /><span>Preparing {meta.label} build…</span></>) : (<><OSIcon os={picked} size={15} color="var(--black)" /><span>Download for {meta.label}{meta.size ? " · " + meta.size : ""}</span></>)}
          </button>
        )}
        <div style={{ marginTop: 12, textAlign: "center" }}><Ticker>signed · local-first · auto-updates</Ticker></div>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "1px solid var(--line)", color: "var(--dusty)", padding: "4px 10px", cursor: "pointer", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>esc</button>
      </div>
    </div>
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
      <IlluFeatures />
      <HowItWorks />
      <MetricsBand />
      <RuntimeView />
      <PlatformMarquee />
      <FAQ />
      <TrustStrip />
      <CTA os={os} />
      <Footer />
    </div>
  );
}

window.ForgeApp = ForgeApp;

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ForgeApp />);
