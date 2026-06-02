"""Architecture diagram for CyberForge (thesis §3.2).

A five-layer, boxed reference architecture in the enterprise style of the
sample brief: teal infrastructure bars, a highlighted agentic core, padlocked
TLS/HTTPS trust boundaries between layers, and a numbered pipeline (1-8 → R).
"""
from svgkit import (Canvas, INK, INK_SOFT, WHITE, TEAL, TEAL_DK, TEAL_LT,
                    YELLOW, YELLOW_LT, PANEL_BG, PANEL_BD, CARD_BG, CARD_BD,
                    ORANGE, GREEN, GREY, PURPLE, STAGE1, STAGE2, STAGE3,
                    INFER, EXT)

W, H = 1720, 1960
c = Canvas(W, H)

# ── title ────────────────────────────────────────────────────────────────────
c.text(W / 2, 46, "CyberForge — Real-Time Agentic-AI Threat-Analysis Architecture",
       size=27, color=INK, weight="bold", anchor="middle")
c.text(W / 2, 74, "Five-layer system · 8-agent DAG orchestrator · LLM fallback chain · "
       "Heroku PaaS + Hugging Face Spaces",
       size=14, color=INK_SOFT, anchor="middle")

PL, PR = 90, 1630            # panel content left / right
IW = PR - PL                 # inner width (1540)
CL, CR = 110, 1610           # core content left / right

# ════════════════════════════════════════════════════════════════════════════
# LAYER 1 — Users & Client Channels
# ════════════════════════════════════════════════════════════════════════════
L1Y, L1H = 110, 200
c.panel(60, L1Y, 1600, L1H, "LAYER 1", "Users & Client Channels")
amid = L1Y + L1H / 2 + 4
c.actor(200, amid, "End User", color=INK)
c.actor(380, amid, "Security\nAnalyst", color=INK)

ch_y, ch_h = L1Y + 52, 92
desktop = (920, ch_y, 360, ch_h)
c.node(580, ch_y, 300, ch_h, ["Web Browser"], sub="Chrome · Firefox · Edge",
       accent=TEAL, tsize=14)
c.node(*desktop, ["Electron Desktop Client"], sub="renderer + main · floating agent panel",
       fill=TEAL_LT, bd=TEAL, accent=TEAL, tsize=14)
c.node(1320, ch_y, 290, ch_h, ["Mobile Client"], sub="React Native — planned",
       accent=GREY, tsize=14)
c.text(580 + 150, ch_y - 8, "poll active-tab URL every 5 s", size=10.5,
       color=INK_SOFT, anchor="middle", weight="bold")

# ════════════════════════════════════════════════════════════════════════════
# trust boundary 1  (clients → back-end)
# ════════════════════════════════════════════════════════════════════════════
L2Y, L2H = 388, 840
c.line(1100, L1Y + L1H, 1100, L2Y, color=ORANGE, sw=2.6, dash="2 0")
c.secure_label(1180, (L1Y + L1H + L2Y) / 2, "HTTPS / TLS")
c.badge(1100, (L1Y + L1H + L2Y) / 2, 1, color=ORANGE)
c.text(1215, (L1Y + L1H + L2Y) / 2 - 6, "POST /api/orchestrator/analyze",
       size=11, color=INK_SOFT, anchor="start", weight="bold")

# ════════════════════════════════════════════════════════════════════════════
# LAYER 2 — Back-end (Heroku) — contains the agentic core + memory
# ════════════════════════════════════════════════════════════════════════════
c.panel(60, L2Y, 1600, L2H, "LAYER 2",
        "Back-end — Node.js / Express on Heroku PaaS")

# API gateway bar
gb_y = L2Y + 24
c.bar(PL, gb_y, IW, 44,
      "REST API Gateway   ·   /api/orchestrator   /api/sandbox   "
      "/api/cyberforge-ml   /api/agent   ·   Auth / JWT", size=13.5)

# orchestrator
orch = (560, gb_y + 60, 600, 56)
c.node(*orch, ["Agent Orchestrator — DAG Executor"],
       sub="builds ScanContext · 3 staged dispatches · 50-report ring buffer",
       fill="#FFF6DE", bd=YELLOW, accent=ORANGE, tsize=14)
c.line(PL + IW / 2, gb_y + 44, orch[0] + orch[2] / 2, orch[1], color=ORANGE,
       sw=2.4)
c.badge(orch[0] + orch[2] / 2, gb_y + 52, 2, color=ORANGE)

# yellow agentic core
core_y = orch[1] + orch[3] + 18
core_h = 386
c.rect(86, core_y, 1548, core_h, fill=YELLOW_LT, stroke=YELLOW, rx=12, sw=2.2)
c.rect(102, core_y - 15, 360, 30, fill=YELLOW, stroke="none", rx=8, sw=0)
c.text(118, core_y + 5, "AGENTIC AI CORE · 8 specialist agents",
       size=13, color="#5A4500", weight="bold")

def row4(y, h, items):
    w, n = 330, 4
    gap = (CR - CL - n * w) / (n - 1)
    out = []
    for i, kw in enumerate(items):
        x = CL + i * (w + gap)
        c.node(x, y, w, h, kw["t"], sub=kw.get("s"), num=kw["n"],
               fill=kw["f"], bd=kw["b"], accent=kw["a"], tsize=13)
        out.append((x + w / 2, y, x, w))
    return out

def row3(y, h, items):
    w, n = 440, 3
    gap = (CR - CL - n * w) / (n - 1)
    out = []
    for i, kw in enumerate(items):
        x = CL + i * (w + gap)
        c.node(x, y, w, h, kw["t"], sub=kw.get("s"), num=kw["n"],
               fill=kw["f"], bd=kw["b"], accent=kw["a"], tsize=13)
        out.append((x + w / 2, y, x, w))
    return out

s1f, s1b, s1a = STAGE1
s2f, s2b, s2a = STAGE2
s3f, s3b, s3a = STAGE3

# Stage 1
c.text(CL, core_y + 30, "STAGE 1 — parallel · URL-string & domain context",
       size=12, color=s1a, weight="bold")
st1 = row4(core_y + 40, 82, [
    {"t": ["URL Classifier"], "s": "BERT phishing", "n": 1, "f": s1f, "b": s1b, "a": s1a},
    {"t": ["DGA Detector"], "s": "Shannon entropy", "n": 2, "f": s1f, "b": s1b, "a": s1a},
    {"t": ["Web Scraper"], "s": "DOM · net · headers", "n": 3, "f": s1f, "b": s1b, "a": s1a},
    {"t": ["Memory Reader"], "s": "domain history", "n": 4, "f": s1f, "b": s1b, "a": s1a},
])
# Stage 2
c.text(CL, core_y + 150, "STAGE 2 — parallel · scraped page content",
       size=12, color=s2a, weight="bold")
st2 = row3(core_y + 160, 78, [
    {"t": ["IOC Extractor"], "s": "10 regex patterns", "n": 5, "f": s2f, "b": s2b, "a": s2a},
    {"t": ["Behavioural Analyser"], "s": "net · JS · cookies", "n": 6, "f": s2f, "b": s2b, "a": s2a},
    {"t": ["MITRE Mapper"], "s": "20-signal ATT&CK", "n": 7, "f": s2f, "b": s2b, "a": s2a},
])
# Stage 3 + Reporter
c.text(CL, core_y + 264, "STAGE 3 — enrichment   →   REPORTER — aggregation",
       size=12, color=s3a, weight="bold")
ti = (160, core_y + 274, 560, 76)
rep = (890, core_y + 274, 560, 76)
c.node(*ti, ["Threat-Intel Enricher"], sub="OTX pulse lookup per IOC", num=8,
       fill=s3f, bd=s3b, accent=s3a, tsize=13)
c.node(*rep, ["Reporter Agent"],
       sub="blended score · verdict escalation · narrative", num="R",
       num_color=GREEN, fill="#FFF6DE", bd=YELLOW, accent=GREEN, tsize=13)

# fan-out from orchestrator into stage 1
for cx, _, _, _ in st1:
    c.line(orch[0] + orch[2] / 2, orch[1] + orch[3], cx, core_y + 40,
           color=ORANGE, sw=1.6)
# stage1 → stage2 (scrape feeds page agents)
c.line(st1[2][0], core_y + 40 + 82, st2[1][0], core_y + 160, color=s2a,
       sw=1.8, dash="5 4")
c.text(st2[1][0] + 8, core_y + 150, "scrape", size=10, color=s2a,
       anchor="start", weight="bold")
# stage2 → threat intel
c.line(st2[0][0], core_y + 160 + 78, ti[0] + ti[2] / 2, ti[1], color=s3a,
       sw=1.8, dash="5 4")
c.text(ti[0] + ti[2] / 2 + 8, core_y + 264, "IOCs", size=10, color=s3a,
       anchor="start", weight="bold")
# threat intel → reporter
c.line(ti[0] + ti[2], ti[1] + ti[3] / 2, rep[0], rep[1] + rep[3] / 2,
       color=GREEN, sw=2.0)

# Memory layer bar + stores
mem_y = core_y + core_h + 20
c.bar(PL, mem_y, IW, 40, "MEMORY LAYER   ·   in-process domain map  +  Redis "
      "session cache  +  vector store", fill=TEAL_DK, size=13)
my = mem_y + 120
for cx, lines in [(360, ["Redis", "session cache"]),
                  (805, ["Pinecone / ChromaDB", "embeddings"]),
                  (1250, ["Domain History", "in-process Map"])]:
    c.cylinder(cx, my, 250, 92, TEAL_LT, TEAL_DK, lines, lsize=12)
# memory reader ↔ memory layer
c.line(st1[3][0], core_y + 40 + 82, 1250, my - 46, color=TEAL_DK, sw=1.6,
       dash="4 4")
c.line(rep[0] + rep[2] / 2, rep[1] + rep[3], 805, my - 46, color=GREEN,
       sw=1.6, dash="4 4")
c.text(820, my - 60, "recordVisit", size=10, color=GREEN, anchor="start",
       weight="bold")

# ════════════════════════════════════════════════════════════════════════════
# trust boundary 2 (back-end → inference)
# ════════════════════════════════════════════════════════════════════════════
L3Y, L3H = L2Y + L2H + 60, 250
c.line(640, L2Y + L2H, 640, L3Y, color=ORANGE, sw=2.4)
c.secure_label(560, (L2Y + L2H + L3Y) / 2, "HTTPS")
c.text(660, (L2Y + L2H + L3Y) / 2 - 4, "/api/v2/url-classify · /dga-detect",
       size=11, color=INK_SOFT, anchor="start", weight="bold")

# ════════════════════════════════════════════════════════════════════════════
# LAYER 3 — Inference (Hugging Face Space, FastAPI)
# ════════════════════════════════════════════════════════════════════════════
c.panel(60, L3Y, 1600, L3H, "LAYER 3",
        "Inference — Python FastAPI on Hugging Face Space")
inf_y, inf_h = L3Y + 70, 110
inf_f, inf_b, inf_a = INFER
c.node(110, inf_y, 300, inf_h, ["FastAPI Gateway"],
       sub="app.py · lazy model loaders", fill=inf_f, bd=inf_b, accent=inf_a,
       tsize=14)
fapi = (110 + 150, inf_y + inf_h / 2)
c.node(470, inf_y, 340, inf_h, ["URL-Phishing BERT"],
       sub="elftsdmr/malware-url-detect", fill=WHITE, bd=inf_b, accent=inf_a,
       tsize=14)
c.node(860, inf_y, 320, inf_h, ["DGA Heuristic"],
       sub="entropy · vowel · digit · run", fill=WHITE, bd=inf_b, accent=inf_a,
       tsize=14)
c.node(1230, inf_y, 380, inf_h, ["LLM Fallback Chain"],
       sub="Gemini → Mistral-7B → heuristic", fill="#FFF6DE", bd=YELLOW,
       accent=PURPLE, tsize=14)
llm = (1230 + 190, inf_y + inf_h / 2)
c.line(410, inf_y + inf_h / 2, 470, inf_y + inf_h / 2, color=inf_a, sw=1.8)
c.line(410, inf_y + inf_h / 2 + 18, 860, inf_y + inf_h - 6, color=inf_a,
       sw=1.6, dash="4 4")
# reporter → LLM chain
c.line(rep[0] + rep[2] / 2, rep[1] + rep[3], llm[0], inf_y, color=PURPLE,
       sw=1.8, dash="6 4")
c.badge(llm[0], inf_y - 10, 9, color=PURPLE)
c.text(llm[0] + 18, inf_y - 8, "narrative", size=10.5, color=PURPLE,
       anchor="start", weight="bold")

# ════════════════════════════════════════════════════════════════════════════
# trust boundary 3 (→ external services)
# ════════════════════════════════════════════════════════════════════════════
L4Y, L4H = L3Y + L3H + 58, 300
c.line(980, L3Y + L3H, 980, L4Y, color=GREY, sw=2.0, dash="6 5")
c.secure_label(1060, (L3Y + L3H + L4Y) / 2, "TLS")

# ════════════════════════════════════════════════════════════════════════════
# LAYER 5 — External Services & Persistence
# ════════════════════════════════════════════════════════════════════════════
c.panel(60, L4Y, 1600, L4H, "LAYER 4",
        "External Services & Persistence")
ext_y = L4Y + 78
ex_f, ex_b, ex_a = EXT
# cylinders for data stores, cards for APIs
slots = [235, 485, 735, 985, 1235, 1485]
c.cylinder(slots[0], ext_y + 46, 230, 96, "#FBE7E5", "#C0392B",
           ["Appwrite Cloud", "users · agents", "tasks · alerts"], lsize=11.5)
c.node(slots[1] - 115, ext_y, 230, 100, ["AlienVault OTX"],
       sub="threat-intel pulses", fill=WHITE, bd=ex_b, accent="#C0392B", tsize=13)
c.node(slots[2] - 115, ext_y, 230, 100, ["WebScrapper.live"],
       sub="DOM · net · headers", fill=WHITE, bd=ex_b, accent=TEAL, tsize=13)
c.node(slots[3] - 115, ext_y, 230, 100, ["Google Gemini", "API"],
       sub="primary LLM", fill=WHITE, bd=ex_b, accent=PURPLE, tsize=13)
c.node(slots[4] - 115, ext_y, 230, 100, ["HF Inference API"],
       sub="Mistral-7B-Instruct", fill=WHITE, bd=ex_b, accent=PURPLE, tsize=13)
c.node(slots[5] - 115, ext_y, 230, 100, ["PDF Reports"],
       sub="pdfkit export", fill=WHITE, bd=ex_b, accent=GREEN, tsize=13)

# cross-layer service calls (representative, kept sparse for legibility)
c.line(st1[2][0], core_y + 40 + 82, slots[2], ext_y, color=TEAL, sw=1.4,
       dash="3 4", marker=True)   # web scraper → webscrapper.live
c.line(ti[0] + ti[2] / 2, ti[1] + ti[3], slots[1], ext_y, color="#C0392B",
       sw=1.4, dash="3 4")        # threat intel → OTX
c.line(llm[0] - 60, inf_y + inf_h, slots[3], ext_y, color=PURPLE, sw=1.4,
       dash="3 4")                # llm → gemini
c.line(llm[0] + 30, inf_y + inf_h, slots[4], ext_y, color=PURPLE, sw=1.4,
       dash="3 4")                # llm → hf inference
c.line(rep[0] + 80, rep[1] + rep[3], slots[0], ext_y + 0, color="#C0392B",
       sw=1.6)                    # reporter → appwrite persist

# ── return path: consolidated report back to the client ──────────────────────
rx = 1690
c.path(f"M {rep[0]+rep[2]} {rep[1]+rep[3]/2} H {rx} V {desktop[1]+desktop[3]/2} "
       f"H {desktop[0]+desktop[2]}", color=GREEN, sw=2.4, marker=True)
c.text(rx - 6, (rep[1] + desktop[1]) / 2, "consolidated report → dashboard / "
       "sandbox / floating panel / toast", size=11.5, color=GREEN,
       weight="bold", anchor="end")
c.badge(rx, rep[1] + rep[3] / 2, "R", color=GREEN)

# ── legend ───────────────────────────────────────────────────────────────────
lx, ly = 1180, L4Y + L4H - 86
c.rect(lx, ly, 470, 70, fill=WHITE, stroke=PANEL_BD, rx=10, sw=1.4)
c.text(lx + 16, ly + 22, "Legend", size=12.5, color=INK, weight="bold")
def leg(x, y, color, label, dash=None):
    c.line(x, y, x + 30, y, color=color, sw=2.6, dash=dash, marker=True)
    c.text(x + 38, y + 4, label, size=11, color=INK_SOFT, anchor="start")
leg(lx + 16, ly + 44, ORANGE, "numbered pipeline step")
leg(lx + 230, ly + 44, GREEN, "aggregate / persist / return")
leg(lx + 16, ly + 62, GREY, "service call", dash="3 4")
c.lock(lx + 245, ly + 60, s=12, color=TEAL_DK)
c.text(lx + 262, ly + 64, "TLS-secured trust boundary", size=11,
       color=INK_SOFT, anchor="start")

c.save("/Users/Dadaicon/Documents/GitHub/Real-Time-cyber-Forge-Agentic-AI/"
       "thesis/diagrams/architecture_diagram.svg")
print("architecture_diagram.svg written")
