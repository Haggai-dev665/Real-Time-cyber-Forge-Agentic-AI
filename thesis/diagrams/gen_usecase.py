"""Use-case diagram for CyberForge (thesis §3.3, UC-01 'Analyse Browsed URL').

UML use-case style: primary actors left, a system boundary holding the
user-facing use cases, the canonical UC-01 with its <<include>> pipeline
sub-cases and <<extend>> points, and secondary (system) actors on the right.
"""
from svgkit import (Canvas, INK, INK_SOFT, WHITE, TEAL, TEAL_DK, TEAL_LT,
                    YELLOW, YELLOW_LT, PANEL_BD, ORANGE, GREEN, GREY, PURPLE)

W, H = 1840, 1180
c = Canvas(W, H)

c.text(W / 2, 46, "CyberForge — Use-Case Diagram (UC-01 · Analyse Browsed URL)",
       size=26, color=INK, weight="bold", anchor="middle")
c.text(W / 2, 73, "Primary actors · system boundary · «include» pipeline "
       "sub-cases · «extend» points · secondary system actors",
       size=13.5, color=INK_SOFT, anchor="middle")

# ── system boundary ──────────────────────────────────────────────────────────
BX, BY, BW, BH = 250, 100, 1320, 1040
c.rect(BX, BY, BW, BH, fill="#F7FAFC", stroke=TEAL_DK, rx=18, sw=2.4)
c.rect(BX + 18, BY - 16, 270, 32, fill=TEAL_DK, stroke="none", rx=8, sw=0)
c.text(BX + 32, BY + 5, "«system»  CyberForge Platform", size=14,
       color=WHITE, weight="bold")

# ── primary actors (left) ────────────────────────────────────────────────────
c.actor(110, 470, "End User", color=INK, scale=1.1)
c.actor(110, 800, "Security\nAnalyst", color=INK, scale=1.1)

# ── secondary / system actors (right) ────────────────────────────────────────
sec = {
    "hf":   (1760, 250, "Hugging Face\nSpace"),
    "scr":  (1760, 430, "WebScrapper\n.live"),
    "otx":  (1760, 610, "AlienVault\nOTX"),
    "llm":  (1760, 790, "Gemini /\nHF LLM"),
    "app":  (1760, 980, "Appwrite\nCloud"),
}
for x, y, lbl in sec.values():
    c.actor(x, y, lbl, color=INK_SOFT, scale=1.0)

# ── use-case ovals ───────────────────────────────────────────────────────────
RX, RY = 96, 40
# Column A — user-facing
A = 420
ucA = {
    "open":  (A, 210, ["Open URL in", "Browser"]),
    "submit":(A, 330, ["Manually Submit", "URL / File"]),
    "verdict":(A, 470, ["Receive", "Consolidated", "Verdict"]),
    "inspect":(A, 600, ["Inspect", "Detailed Report"]),
    "locker":(A, 730, ["Browse", "Evidence Locker"]),
    "pdf":   (A, 860, ["Export PDF", "Scan Report"]),
    "auth":  (A, 990, ["Authenticate"]),
}
for k, (x, y, ls) in ucA.items():
    c.oval(x, y, RX, RY, ls, fill=TEAL_LT, stroke=TEAL_DK, size=12)

# Column B — core + extends
B = 760
c.oval(B, 300, 132, 58, ["UC-01", "Analyse Browsed", "URL"], fill=YELLOW_LT,
       stroke=ORANGE, size=14, sw=2.6)
uc01 = (B, 300)
c.oval(B, 540, RX, RY, ["Generate", "Report"], fill="#EDE6FA", stroke=PURPLE,
       size=12)
gen = (B, 540)
c.oval(B, 720, 92, 38, ["Notify", "(toast)"], fill="#FBE7E5", stroke="#C0392B",
       size=11.5, tag="«extend»")
c.oval(B, 900, 96, 38, ["Escalate", "Verdict"], fill="#FBE7E5",
       stroke="#C0392B", size=11.5, tag="«extend»")

# Column C — pipeline sub-use-cases (included by UC-01)
C = 1180
ucC = {
    "classify":(C, 165, ["Classify URL", "(BERT)"]),
    "dga":     (C, 280, ["Detect DGA", "(entropy)"]),
    "scrape":  (C, 395, ["Scrape Page"]),
    "memory":  (C, 510, ["Read Memory"]),
    "ioc":     (C, 625, ["Extract IOCs"]),
    "behav":   (C, 740, ["Analyse", "Behaviour"]),
    "mitre":   (C, 855, ["Map MITRE", "ATT&CK"]),
    "intel":   (C, 970, ["Enrich", "Threat-Intel"]),
}
for k, (x, y, ls) in ucC.items():
    c.oval(x, y, 90, 36, ls, fill=WHITE, stroke=TEAL, size=11.5)

# ── actor → use-case associations (solid) ────────────────────────────────────
def assoc(ax, ay, ux, uy, rx=RX):
    c.line(ax, ay, ux - rx, uy, color=INK_SOFT, sw=1.7, marker=False)

for k in ("open", "submit", "verdict", "inspect", "pdf", "auth"):
    x, y, _ = ucA[k]
    assoc(150, 470, x, y)
for k in ("inspect", "locker", "submit"):
    x, y, _ = ucA[k]
    assoc(150, 800, x, y)

# secondary actor associations
def sassoc(key, ux, uy, urx=90):
    x, y, _ = sec[key]
    c.line(ux + urx, uy, x - 36, y, color=GREY, sw=1.6, marker=False)
sassoc("hf", *ucC["classify"][:2])
sassoc("hf", *ucC["dga"][:2])
sassoc("scr", *ucC["scrape"][:2])
sassoc("otx", *ucC["intel"][:2])
sassoc("llm", gen[0], gen[1], urx=RX)
# Appwrite ← Generate Report (persist) and ← Browse Locker
c.line(gen[0] + RX, gen[1] + 20, sec["app"][0] - 36, sec["app"][1] - 10,
       color=GREY, sw=1.6, marker=False)
lx, ly, _ = ucA["locker"]
c.path(f"M {lx} {ly+RY} C {lx+200} {ly+200}, {sec['app'][0]-260} "
       f"{sec['app'][1]+10}, {sec['app'][0]-36} {sec['app'][1]+10}",
       color=GREY, sw=1.6, marker=False)

# ── «include» : triggers → UC-01 ─────────────────────────────────────────────
ox, oy, _ = ucA["open"]
sx, sy, _ = ucA["submit"]
c.conn(ox + RX, oy + 10, uc01[0] - 132, uc01[1] - 24, "«include»", dash="6 4",
       color=ORANGE)
c.conn(sx + RX, sy, uc01[0] - 132, uc01[1] + 4, "«include»", dash="6 4",
       color=ORANGE)

# ── «include» : UC-01 → Generate Report ──────────────────────────────────────
c.conn(uc01[0], uc01[1] + 58, gen[0], gen[1] - RY, "«include»", dash="6 4",
       color=PURPLE)

# ── «include» : UC-01 → each pipeline sub-case ───────────────────────────────
for k, (x, y, _) in ucC.items():
    c.conn(uc01[0] + 132, uc01[1], x - 90, y, dash="6 4", color=TEAL,
           sw=1.4)
c.text(uc01[0] + 200, uc01[1] - 60, "«include»  (8 specialist agents)",
       size=11, color=TEAL_DK, weight="bold", anchor="middle", italic=True)

# ── «extend» : Notify → Receive Verdict ; Escalate → Generate Report ─────────
vx, vy, _ = ucA["verdict"]
c.conn(B - 92, 720, vx + RX, vy + 18, "«extend»", dash="6 4", color="#C0392B")
c.text(B - 6, 760, "[risk ≥ 30]", size=10, color="#C0392B", anchor="middle",
       italic=True)
c.conn(B - 96, 900, gen[0], gen[1] + RY, "«extend»", dash="6 4",
       color="#C0392B")
c.text(B + 4, 838, "[memory elevated]", size=10, color="#C0392B",
       anchor="middle", italic=True)

# verdict/report are produced by UC-01 (association, solid)
c.line(uc01[0] - 132, uc01[1] + 30, vx + RX, vy - 18, color=INK_SOFT, sw=1.5,
       marker=False)

# ── legend ───────────────────────────────────────────────────────────────────
lx0, ly0 = BX + 24, BY + BH - 92
c.rect(lx0, ly0, 360, 78, fill=WHITE, stroke=PANEL_BD, rx=10, sw=1.4)
c.text(lx0 + 16, ly0 + 22, "Legend", size=12.5, color=INK, weight="bold")
c.line(lx0 + 16, ly0 + 42, lx0 + 52, ly0 + 42, color=INK_SOFT, sw=1.7,
       marker=False)
c.text(lx0 + 60, ly0 + 46, "actor association", size=11, color=INK_SOFT,
       anchor="start")
c.conn(lx0 + 200, ly0 + 42, lx0 + 236, ly0 + 42, dash="6 4", color=TEAL)
c.text(lx0 + 244, ly0 + 46, "«include»", size=11, color=TEAL_DK,
       anchor="start", italic=True)
c.conn(lx0 + 16, ly0 + 64, lx0 + 52, ly0 + 64, dash="6 4", color="#C0392B")
c.text(lx0 + 60, ly0 + 68, "«extend» (conditional)", size=11, color="#C0392B",
       anchor="start", italic=True)

c.save("/Users/Dadaicon/Documents/GitHub/Real-Time-cyber-Forge-Agentic-AI/"
       "thesis/diagrams/use_case_diagram.svg")
print("use_case_diagram.svg written")
