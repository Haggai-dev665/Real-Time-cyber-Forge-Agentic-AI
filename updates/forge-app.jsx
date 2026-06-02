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
  cables:    "https://images.unsplash.com/photo-1551703599-6b3e8379aa8d?w=1200&q=80&auto=format&fit=crop",
  circuit:   "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80&auto=format&fit=crop",
  // operators (avatars)
  ines:      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=85&auto=format&fit=crop",
  // architectural / Berlin
  berlin:    "https://images.unsplash.com/photo-1587330979470-3595ac045ab0?w=1200&q=80&auto=format&fit=crop",
};

// ───────────────────────────────────────────────────────── primitives ─────
const cx = (...c) => c.filter(Boolean).join(" ");

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
function Header() {
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
          {["Platform", "Threat Intel", "Operators", "Pricing", "Docs"].map(item => (
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
            <span>Deploy now</span>
            <ArrowRight />
          </button>
        </div>
      </div>

      {open && <Modal onClose={() => setOpen(false)} />}
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
function Hero() {
  const [hover, setHover] = useState(false);
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
            Forge a<br />
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 18 }}>
              <em style={{ fontStyle: "normal", color: "var(--orange)" }}>perimeter</em>
              <SparkLine />
            </span><br />
            adversaries<br />
            can&rsquo;t cross.
          </h1>

          <p style={{ maxWidth: 540, marginTop: 28, fontSize: 18, lineHeight: 1.5, color: "var(--dusty)", opacity: 0.78 }}>
            Cyber Forge is an autonomous defense fabric for cloud-native fleets. It instruments every workload, learns your baseline in 48 hours, and stops intrusions at machine speed — before a human dashboard would even render the alert.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
            <button
              onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
              style={{ ...btnPrimary, padding: "14px 22px", fontSize: 13, transform: hover ? "translateY(-1px)" : "none", background: hover ? "var(--dusty)" : "var(--orange)" }}
            >
              <span>Start a free assessment</span>
              <ArrowRight />
            </button>
            <button style={{ ...btnPrimary, background: "transparent", border: "1px solid var(--line-strong)", color: "var(--dusty)", padding: "14px 22px", fontSize: 13 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--sage)" }} />
              <span>Watch 90-sec demo</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: 40, marginTop: 56, paddingTop: 28, borderTop: "1px solid var(--line)" }}>
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
function CTA() {
  return (
    <section style={{ position: "relative", padding: "120px 28px", background: "var(--orange)", color: "var(--black)", overflow: "hidden", borderBottom: "1px solid var(--black)" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px)", backgroundSize: "80px 100%", pointerEvents: "none" }} />
      <img src={IMG.forge} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.18, mixBlendMode: "multiply" }} />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 56, alignItems: "end" }}>
        <h2 className="display" style={{ fontSize: "clamp(56px, 8vw, 132px)", margin: 0 }}>
          Bring us the<br />
          fleet. We&rsquo;ll<br />
          bring the <em style={{ fontStyle: "normal", textDecoration: "underline", textUnderlineOffset: 12, textDecorationThickness: 4 }}>anvil</em>.
        </h2>

        <div>
          <p style={{ fontSize: 17, lineHeight: 1.5, marginTop: 0 }}>
            48-hour pilot. Read-only mode. No agent touches production until you sign off on the baseline.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
            <button style={{ ...btnPrimary, background: "var(--black)", color: "var(--dusty)", padding: "16px 22px", fontSize: 13, justifyContent: "space-between" }}>
              <span>Book a pilot — 48h</span><ArrowRight />
            </button>
            <button style={{ ...btnPrimary, background: "transparent", color: "var(--black)", border: "1px solid var(--black)", padding: "16px 22px", fontSize: 13, justifyContent: "space-between" }}>
              <span>Talk to an operator</span><ArrowRight />
            </button>
          </div>
        </div>
      </div>
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

// ───────────────────────────────────────────────────────── modal ──────────
function Modal({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 100, display: "grid", placeItems: "center", backdropFilter: "blur(6px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 460, background: "var(--raisin)", border: "1px solid var(--line-strong)", padding: 32, position: "relative" }}>
        <Ticker>§ deploy.init</Ticker>
        <h3 className="display" style={{ fontSize: 32, margin: "10px 0 18px" }}>Forge a perimeter.</h3>
        <p style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.5, marginTop: 0 }}>Drop your work email — we&rsquo;ll send a 48h sandbox cluster and your assessment runbook.</p>
        <input placeholder="you@company.com" style={{ width: "100%", background: "transparent", border: "1px solid var(--line-strong)", padding: "14px 14px", color: "var(--dusty)", fontFamily: "JetBrains Mono, monospace", marginTop: 18, outline: "none", fontSize: 14 }} />
        <button style={{ ...btnPrimary, width: "100%", marginTop: 12, padding: "14px 18px", justifyContent: "space-between" }}>
          <span>Send sandbox credentials</span><ArrowRight />
        </button>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "1px solid var(--line)", color: "var(--dusty)", padding: "4px 10px", cursor: "pointer", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>esc</button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── tweaks ─────────
function Tweaks() {
  const [t, setTweak] = window.useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "#F69D39",
    "secondary": "#869B7E",
    "surface": "raisin",
    "showLiveFeed": true,
    "marqueeOn": true
  }/*EDITMODE-END*/);

  useEffect(() => {
    document.documentElement.style.setProperty("--orange", t.accent);
    document.documentElement.style.setProperty("--sage", t.secondary);
    if (t.surface === "raisin") {
      document.documentElement.style.setProperty("--raisin", "#1F1A1B");
    } else if (t.surface === "black") {
      document.documentElement.style.setProperty("--raisin", "#000000");
    } else {
      document.documentElement.style.setProperty("--raisin", "#EFE9DD");
      document.documentElement.style.setProperty("--dusty", "#1F1A1B");
      document.documentElement.style.setProperty("--line", "rgba(31,26,27,0.16)");
      document.documentElement.style.setProperty("--line-strong", "rgba(31,26,27,0.34)");
    }
  }, [t]);

  return (
    <window.TweaksPanel title="Tweaks">
      <window.TweakSection title="Palette">
        <window.TweakColor label="Primary accent" value={t.accent} onChange={v => setTweak("accent", v)} options={["#F69D39", "#E5573E", "#D8B65A", "#869B7E"]} />
        <window.TweakColor label="Secondary" value={t.secondary} onChange={v => setTweak("secondary", v)} options={["#869B7E", "#5E7A88", "#A89B7E", "#EFE9DD"]} />
      </window.TweakSection>
      <window.TweakSection title="Surface">
        <window.TweakRadio label="Mode" value={t.surface} onChange={v => setTweak("surface", v)} options={[{value:"raisin",label:"Raisin"},{value:"black",label:"Black"},{value:"dusty",label:"Dusty"}]} />
      </window.TweakSection>
      <window.TweakSection title="Animation">
        <window.TweakToggle label="Live threat feed" value={t.showLiveFeed} onChange={v => setTweak("showLiveFeed", v)} />
        <window.TweakToggle label="Marquee strip" value={t.marqueeOn} onChange={v => setTweak("marqueeOn", v)} />
      </window.TweakSection>
    </window.TweaksPanel>
  );
}

// ───────────────────────────────────────────────────────── app ────────────
function ForgeApp() {
  return (
    <div>
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
        @keyframes rowIn { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes forgePulse { from { transform: scale(1); opacity: 0.5; } to { transform: scale(2.4); opacity: 0; } }
        @keyframes fadeUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        section { animation: fadeUp 700ms cubic-bezier(.2,.7,.2,1) both; }
        section:nth-child(2) { animation-delay: 60ms; }
        section:nth-child(3) { animation-delay: 120ms; }
        button:hover { filter: brightness(1.05); }
      `}</style>
      <Header />
      <Hero />
      <Marquee />
      <Capabilities />
      <FieldStrip />
      <RuntimeView />
      <TrustQuote />
      <CTA />
      <Footer />
      <Tweaks />
    </div>
  );
}

window.ForgeApp = ForgeApp;
