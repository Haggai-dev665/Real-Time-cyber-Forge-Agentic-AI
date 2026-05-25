"""Class diagram of the CyberForge orchestrator subsystem (thesis §3.4).

UML class diagram: AgentOrchestrator aggregates BaseAgent; nine specialist
agents generalise BaseAgent; ScanContext is the shared data carrier; the
ReporterAgent collaborates with the service classes (MemoryService,
LLMFallbackChain, AppwriteService).
"""
from svgkit import (Canvas, INK, INK_SOFT, WHITE, TEAL, TEAL_DK, YELLOW,
                    ORANGE, GREEN, GREY, PURPLE, PANEL_BD)

W, H = 2180, 1500
c = Canvas(W, H)

c.text(W / 2, 46, "CyberForge — Class Diagram (Agent-Orchestrator Subsystem)",
       size=26, color=INK, weight="bold", anchor="middle")
c.text(W / 2, 73, "Generalisation (▷) · aggregation (◇) · dependency (⇢) — "
       "backend/src/agent/", size=13.5, color=INK_SOFT, anchor="middle")

NAVY, GREEN_H, PURPLE_H, ORANGE_H = "#34507A", "#1E8449", "#6C3FBF", "#B9770E"

# ── top band ─────────────────────────────────────────────────────────────────
mem = c.uml(70, 110, 360, "MemoryService", header=NAVY,
            attrs=["-domainHistory: Map", "-sessionMemory: Map",
                   "-redis: RedisClient", "-vectorDB: VectorClient"],
            methods=["+getDomain(host): DomainMemory",
                     "+recordVisit(host,verdict,score)",
                     "+getSession(sid): SessionMemory",
                     "+appendLLMContext(sid,msg)", "+stats(): MemoryStats"])

orch = c.uml(800, 92, 470, "AgentOrchestrator", header=ORANGE_H,
             attrs=["-agents: Map<string,BaseAgent>", "-memory: MemoryService",
                    "-reporter: ReporterAgent", "-recentReports: Report[]"],
             methods=["+analyze(url,sessionId,userId): Report",
                      "+stats(): OrchestratorStats", "+recent(limit): Report[]",
                      "-dispatchStage1/2/3(ctx): Promise[]",
                      "-aggregate(ctx): Report"])

ctx = c.uml(1740, 110, 380, "ScanContext", header=NAVY,
            attrs=["+url, host: string", "+sessionId, userId: string",
                   "+startedAt: number", "+scrape: ScrapeResult",
                   "+agentResults: Map", "+iocs: IOC[]",
                   "+mitre: MITRETechnique[]", "+findings: string[]"],
            methods=[])

# ── abstract base ────────────────────────────────────────────────────────────
base = c.uml(890, 430, 300, "BaseAgent", header=TEAL_DK, abstract=True,
             stereotype="«abstract»",
             attrs=["+name: string", "+role: string"],
             methods=["+execute(ctx): AgentResult", "#_timed(fn): AgentResult"])

# ── specialist agents row ────────────────────────────────────────────────────
specs = [
    ("URLClassifierAgent", ["-mlServiceUrl: string"],
     ["+execute(ctx)", "-callBert(url)"]),
    ("DGADetectorAgent", [],
     ["+execute(ctx)", "-callDga(domain)"]),
    ("WebScraperAgent", ["-scraperUrl, apiKey"],
     ["+execute(ctx)", "-scrape(url)"]),
    ("MemoryAgent", ["-memory: MemoryService"],
     ["+execute(ctx)", "-readHistory(host)"]),
    ("IOCExtractorAgent", ["-patterns: Map"],
     ["+execute(ctx)", "-extract(text)", "-dedupe(iocs)"]),
    ("BehaviouralAgent", [],
     ["+execute(ctx)", "-inspectNet(reqs)", "-inspectJs(logs)"]),
    ("MITREMapperAgent", ["-signals: Signal[]"],
     ["+execute(ctx)", "-match(text)"]),
    ("ThreatIntelAgent", ["-otxClient: OTXClient"],
     ["+execute(ctx)", "-enrich(ioc)"]),
    ("ReporterAgent", ["-llmChain: LLMChain", "-appwrite: AppwriteService"],
     ["+execute(ctx): Report", "-blendedScore(ctx)", "-escalate(v,ctx)",
      "-narrative(ctx)"]),
]
n = len(specs)
sw = 218
gap = (W - 140 - n * sw) / (n - 1)
sy = 690
boxes = []
for i, (nm, at, me) in enumerate(specs):
    x = 70 + i * (sw + gap)
    hdr = GREEN_H if nm == "ReporterAgent" else TEAL
    b = c.uml(x, sy, sw, nm, header=hdr, attrs=at, methods=me)
    boxes.append(b)
rep = boxes[-1]
memag = boxes[3]

# ── collaborator service classes (near Reporter) ─────────────────────────────
llm = c.uml(1430, 1120, 350, "LLMFallbackChain", header=PURPLE_H,
            attrs=["-providers: LLMProvider[]"],
            methods=["+complete(prompt): LLMResponse", "-tryGemini(prompt)",
                     "-tryMistral(prompt)", "-heuristic(ctx)"])
appw = c.uml(1820, 1120, 300, "AppwriteService", header="#A03A30",
             attrs=[],
             methods=["+createAlert(record)", "+listAlerts(userId,limit)",
                      "+createAgentTask(task)"])

# ════════════════════════════════════════════════════════════════════════════
# relationships
# ════════════════════════════════════════════════════════════════════════════
# AgentOrchestrator ◇— BaseAgent  (aggregation: diamond at orchestrator)
c.body.append(
    f'<line x1="{base["cx"]:.1f}" y1="{base["y"]:.1f}" '
    f'x2="{orch["cx"]:.1f}" y2="{orch["y"]+orch["h"]:.1f}" '
    f'stroke="{INK_SOFT}" stroke-width="1.8" marker-end="url(#diamond)"/>')
c.text(base["cx"] + 14, (base["y"] + orch["y"] + orch["h"]) / 2,
       "dispatches  1..*", size=10.5, color=INK_SOFT, anchor="start",
       weight="bold")

# Orchestrator ⇢ MemoryService (uses)
c.conn(orch["left"][0], orch["cy"], mem["right"][0], mem["cy"], "«uses»",
       dash="6 4", color=INK_SOFT)
# Orchestrator ⇢ ScanContext (creates)
c.conn(orch["right"][0], orch["cy"], ctx["left"][0], ctx["cy"], "«creates»",
       dash="6 4", color=INK_SOFT)

# BaseAgent ⇢ ScanContext (reads & writes)
c.conn(base["right"][0], base["cy"] - 10, ctx["bottom"][0] - 60,
       ctx["y"] + ctx["h"], "reads / writes ctx", dash="6 4", color=GREY)

# Generalisation: each specialist ▷ BaseAgent
for b in boxes:
    c.body.append(
        f'<path d="M {b["cx"]:.1f} {b["y"]:.1f} '
        f'L {b["cx"]:.1f} {(b["y"]+base["y"]+base["h"])/2:.1f} '
        f'L {base["cx"]:.1f} {(b["y"]+base["y"]+base["h"])/2:.1f} '
        f'L {base["cx"]:.1f} {base["y"]+base["h"]:.1f}" '
        f'fill="none" stroke="#5A6B82" stroke-width="1.5" '
        f'marker-end="url(#tri)"/>')

# MemoryAgent ⇢ MemoryService
c.conn(memag["top"][0], memag["y"], mem["bottom"][0], mem["y"] + mem["h"],
       "reads", dash="6 4", color=NAVY, sw=1.5)

# ReporterAgent ⇢ LLMFallbackChain / AppwriteService / MemoryService
c.conn(rep["bottom"][0] - 30, rep["y"] + rep["h"], llm["top"][0],
       llm["y"], "«uses»", dash="6 4", color=PURPLE, sw=1.6)
c.conn(rep["bottom"][0] + 30, rep["y"] + rep["h"], appw["top"][0],
       appw["y"], "persists via", dash="6 4", color="#A03A30", sw=1.6)
c.path(f"M {rep['left'][0]} {rep['cy']+30} C {rep['left'][0]-200} "
       f"{rep['cy']+260}, {mem['cx']+260} {mem['y']+mem['h']+360}, "
       f"{mem['cx']} {mem['y']+mem['h']}", color=GREEN, sw=1.6,
       dash="6 4", marker=True)
c.text(mem['cx'] + 30, mem['y'] + mem['h'] + 40, "writes back",
       size=10.5, color=GREEN, anchor="start", weight="bold", italic=True)

# ── legend ───────────────────────────────────────────────────────────────────
lx, ly = 70, 1290
c.rect(lx, ly, 720, 150, fill=WHITE, stroke=PANEL_BD, rx=10, sw=1.4)
c.text(lx + 18, ly + 26, "Legend — UML relationships", size=13, color=INK,
       weight="bold")
c.body.append(f'<line x1="{lx+24}" y1="{ly+58}" x2="{lx+90}" y2="{ly+58}" '
              f'stroke="#5A6B82" stroke-width="1.6" marker-end="url(#tri)"/>')
c.text(lx + 100, ly + 62, "generalisation (inherits BaseAgent)", size=11.5,
       color=INK_SOFT, anchor="start")
c.body.append(f'<line x1="{lx+24}" y1="{ly+92}" x2="{lx+90}" y2="{ly+92}" '
              f'stroke="#5A6B82" stroke-width="1.8" '
              f'marker-end="url(#diamond)"/>')
c.text(lx + 100, ly + 96, "aggregation (orchestrator owns agents)", size=11.5,
       color=INK_SOFT, anchor="start")
c.conn(lx + 24, ly + 126, lx + 90, ly + 126, dash="6 4", color=INK_SOFT)
c.text(lx + 100, ly + 130, "dependency  «uses» / «creates» / persists",
       size=11.5, color=INK_SOFT, anchor="start")
c.text(lx + 430, ly + 62, "+  public      -  private      #  protected",
       size=11.5, color=INK_SOFT, anchor="start", family="Menlo, monospace")
c.text(lx + 430, ly + 92, "Stage 1: URL · DGA · Scraper · Memory", size=11,
       color=TEAL_DK, anchor="start")
c.text(lx + 430, ly + 112, "Stage 2: IOC · Behavioural · MITRE", size=11,
       color=TEAL_DK, anchor="start")
c.text(lx + 430, ly + 132, "Stage 3: Threat-Intel    →    Reporter",
       size=11, color=GREEN_H, anchor="start")

c.save("/Users/Dadaicon/Documents/GitHub/Real-Time-cyber-Forge-Agentic-AI/"
       "thesis/diagrams/class_diagram.svg")
print("class_diagram.svg written")
