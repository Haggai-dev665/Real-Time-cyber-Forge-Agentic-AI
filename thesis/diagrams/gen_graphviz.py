#!/usr/bin/env python3
"""
CyberForge thesis diagrams — Graphviz (DOT) generators.

Graphviz gives us professional *orthogonal* edge routing (splines=ortho) and an
auto-layout engine that keeps connected elements close and never draws edges
through node bodies. We emit two .dot files (architecture + class) and render
them to .svg with `dot`. JPGs are produced from the SVGs by render.js (sharp).

Run:  python3 gen_graphviz.py   →   architecture_diagram.dot, class_diagram.dot
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# ── palette ──────────────────────────────────────────────────────────────────
INK      = "#16233D"
TEAL     = "#0E8FA3"; TEAL_DK = "#0A6B7B"; TEAL_LT = "#E3F4F6"
YELLOW   = "#F4C20D"; YELLOW_LT = "#FFF6DE"
ORANGE   = "#E8743B"
GREEN    = "#1F9D57"
PURPLE   = "#7C5CD6"
GREY     = "#5B6B82"
RED      = "#C0392B"
S1F, S1B = "#FCE6E2", "#C0392B"
S2F, S2B = "#DEF3E6", "#1E8449"
S3F, S3B = "#EBE2F7", "#6C3FBF"
INFF, INFB = "#DCEEF4", "#0A6B7B"
EXTF, EXTB = "#EEF2F7", "#5B6B82"


def htbox(title, sub="", tcolor=INK, tsize=13, ssize=9.5):
    """HTML label: bold title + optional muted subtitle."""
    s = (f'<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="1">'
         f'<TR><TD><FONT POINT-SIZE="{tsize}" COLOR="{tcolor}"><B>{title}</B>'
         f'</FONT></TD></TR>')
    if sub:
        s += (f'<TR><TD><FONT POINT-SIZE="{ssize}" COLOR="#5B6B82">{sub}'
              f'</FONT></TD></TR>')
    s += '</TABLE>>'
    return s


# ════════════════════════════════════════════════════════════════════════════
# 1) ARCHITECTURE
# ════════════════════════════════════════════════════════════════════════════
def architecture():
    L = []
    A = L.append
    A('digraph cyberforge_arch {')
    A('  graph [rankdir=TB, splines=ortho, compound=true, bgcolor="white",')
    A('         concentrate=true, nodesep=0.45, ranksep=0.9, pad=0.5, '
      'fontname="Helvetica-Bold",')
    A('         fontsize=22, labelloc=t, label="CyberForge \\u2014 Real-Time '
      'Agentic-AI Threat-Analysis Architecture\\n\\n"];')
    A('  node [shape=box, style="rounded,filled", fontname="Helvetica",')
    A('        fontsize=11, penwidth=1.6, margin="0.16,0.10", height=0.6];')
    A('  edge [fontname="Helvetica-Bold", fontsize=10, penwidth=1.9,')
    A('        color="#34495E", arrowsize=0.85];')

    def node(nid, title, sub="", fill="white", border=GREY, shape="box",
             style='"rounded,filled"'):
        A(f'  {nid} [label={htbox(title, sub)}, fillcolor="{fill}", '
          f'color="{border}", shape={shape}, style={style}];')

    def cluster(cid, label, color, bg, body):
        A(f'  subgraph cluster_{cid} {{')
        A(f'    label=<<B>{label}</B>>; fontsize=14; fontcolor="white";')
        A(f'    style="rounded,filled"; fillcolor="{bg}"; color="{color}"; '
          f'penwidth=2; margin=14;')
        # title chip via a styled label is hard; use colored cluster header
        for ln in body:
            A('    ' + ln)
        A('  }')

    # Layer 1 — clients
    A('  subgraph cluster_l1 {')
    A('    label=<<B>LAYER 1 \\u00b7 Users &amp; Client Channels</B>>;')
    A('    fontsize=14; fontcolor="#0A6B7B"; style="rounded,filled"; '
      'fillcolor="#F2F5F9"; color="#0A6B7B"; penwidth=2; margin=12;')
    node('user', 'End User', 'browses the web', '#FFFFFF', INK, shape='oval')
    node('analyst', 'Security Analyst', 'reviews verdicts', '#FFFFFF', INK,
         shape='oval')
    node('desktop', 'Electron Desktop Client',
         'renderer + main \\u00b7 floating agent panel', TEAL_LT, TEAL)
    node('browser', 'Web Browser', 'Chrome \\u00b7 Firefox \\u00b7 Edge',
         '#FFFFFF', TEAL)
    node('mobile', 'Mobile Client', 'React Native \\u2014 planned', '#FFFFFF',
         GREY)
    A('    {rank=same; user; analyst; browser; desktop; mobile;}')
    A('    user -> desktop [style=invis]; browser -> desktop [style=invis];')
    A('  }')

    # Layer 2 — backend
    A('  subgraph cluster_l2 {')
    A('    label=<<B>LAYER 2 \\u00b7 Back-end \\u2014 Node.js / Express on '
      'Heroku PaaS</B>>;')
    A('    fontsize=14; fontcolor="#0A6B7B"; style="rounded,filled"; '
      'fillcolor="#F2F5F9"; color="#0A6B7B"; penwidth=2; margin=12;')
    node('apigw', 'REST API Gateway',
         '/api/orchestrator \\u00b7 /sandbox \\u00b7 /cyberforge-ml \\u00b7 '
         'Auth/JWT', TEAL, 'white', shape='box', style='"filled"')
    A('    apigw [fontcolor="white"];')
    node('orch', 'Agent Orchestrator \\u2014 DAG Executor',
         'builds ScanContext \\u00b7 3 staged dispatches \\u00b7 ring buffer',
         YELLOW_LT, ORANGE)
    # agentic core
    A('    subgraph cluster_core {')
    A('      label=<<B>AGENTIC AI CORE \\u00b7 8 specialist agents</B>>;')
    A('      fontsize=12; fontcolor="#8A6D00"; style="rounded,filled"; '
      'fillcolor="#FFFBEC"; color="#F4C20D"; penwidth=2; margin=10;')
    node('a_url', '1 \\u00b7 URL Classifier', 'BERT phishing', S1F, S1B)
    node('a_dga', '2 \\u00b7 DGA Detector', 'Shannon entropy', S1F, S1B)
    node('a_scrap', '3 \\u00b7 Web Scraper', 'DOM \\u00b7 net \\u00b7 headers',
         S1F, S1B)
    node('a_mem', '4 \\u00b7 Memory Reader', 'domain history', S1F, S1B)
    node('a_ioc', '5 \\u00b7 IOC Extractor', '10 regex patterns', S2F, S2B)
    node('a_behav', '6 \\u00b7 Behavioural', 'net \\u00b7 JS \\u00b7 cookies',
         S2F, S2B)
    node('a_mitre', '7 \\u00b7 MITRE Mapper', '20-signal ATT&amp;CK', S2F, S2B)
    node('a_intel', '8 \\u00b7 Threat-Intel', 'OTX pulse lookup', S3F, S3B)
    node('reporter', 'R \\u00b7 Reporter Agent',
         'blended score \\u00b7 escalation \\u00b7 narrative', YELLOW_LT, GREEN)
    A('      {rank=same; a_url; a_dga; a_scrap; a_mem;}')
    A('      {rank=same; a_ioc; a_behav; a_mitre;}')
    A('      {rank=same; a_intel; reporter;}')
    A('    }')
    # memory layer
    A('    subgraph cluster_mem {')
    A('      label=<<B>MEMORY LAYER</B>>;')
    A('      fontsize=12; fontcolor="#0A6B7B"; style="rounded,filled"; '
      'fillcolor="#EAF4F6"; color="#0A6B7B"; penwidth=1.6; margin=10;')
    node('redis', 'Redis', 'session cache', TEAL_LT, TEAL_DK, shape='cylinder')
    node('vec', 'Pinecone / Chroma', 'embeddings', TEAL_LT, TEAL_DK,
         shape='cylinder')
    node('domain', 'Domain History', 'in-process Map', TEAL_LT, TEAL_DK,
         shape='cylinder')
    A('      {rank=same; redis; vec; domain;}')
    A('    }')
    A('  }')

    # Layer 3 — inference
    A('  subgraph cluster_l3 {')
    A('    label=<<B>LAYER 3 \\u00b7 Inference \\u2014 Python FastAPI on '
      'Hugging Face Space</B>>;')
    A('    fontsize=14; fontcolor="#0A6B7B"; style="rounded,filled"; '
      'fillcolor="#F2F5F9"; color="#0A6B7B"; penwidth=2; margin=12;')
    node('fastapi', 'FastAPI Gateway', 'app.py \\u00b7 lazy loaders', INFF,
         INFB)
    node('bert', 'URL-Phishing BERT', 'elftsdmr/malware-url-detect', '#FFFFFF',
         INFB)
    node('dgam', 'DGA Heuristic', 'entropy \\u00b7 vowel \\u00b7 digit',
         '#FFFFFF', INFB)
    node('llm', 'LLM Fallback Chain', 'Gemini \\u2192 Mistral \\u2192 heuristic',
         YELLOW_LT, PURPLE)
    A('    {rank=same; fastapi; bert; dgam; llm;}')
    A('  }')

    # Layer 4 — external
    A('  subgraph cluster_l4 {')
    A('    label=<<B>LAYER 4 \\u00b7 External Services &amp; Persistence</B>>;')
    A('    fontsize=14; fontcolor="#0A6B7B"; style="rounded,filled"; '
      'fillcolor="#F2F5F9"; color="#0A6B7B"; penwidth=2; margin=12;')
    node('appwrite', 'Appwrite Cloud', 'users \\u00b7 tasks \\u00b7 alerts',
         '#FBE7E5', RED, shape='cylinder')
    node('otx', 'AlienVault OTX', 'threat-intel pulses', '#FFFFFF', RED)
    node('webscr', 'WebScrapper.live', 'DOM \\u00b7 net \\u00b7 headers',
         '#FFFFFF', TEAL)
    node('gemini', 'Google Gemini API', 'primary LLM', '#FFFFFF', PURPLE)
    node('hfapi', 'HF Inference API', 'Mistral-7B', '#FFFFFF', PURPLE)
    node('pdf', 'PDF Reports', 'pdfkit export', '#FFFFFF', GREEN,
         shape='cylinder')
    A('    {rank=same; appwrite; otx; webscr; gemini; hfapi; pdf;}')
    A('  }')

    # ── edges ────────────────────────────────────────────────────────────────
    o = f'color="{ORANGE}", penwidth=2.4, fontcolor="{ORANGE}"'
    g = f'color="{GREEN}", penwidth=2.0, fontcolor="{GREEN}"'
    p = f'color="{PURPLE}", penwidth=2.0, fontcolor="{PURPLE}"'
    t = f'color="{TEAL}", penwidth=1.9, fontcolor="{TEAL_DK}"'
    r = f'color="{RED}", penwidth=1.9, fontcolor="{RED}"'
    A(f'  desktop -> apigw [label="1  HTTPS/TLS", {o}];')
    A(f'  browser -> desktop [label="poll 5s", color="#5B6B82", '
      f'style=dashed, constraint=false, penwidth=1.5];')
    A(f'  apigw -> orch [label="2  dispatch", {o}];')
    A(f'  orch -> a_url [label="3  Stage 1", {o}];')
    A(f'  orch -> a_dga [{o}]; orch -> a_scrap [{o}]; orch -> a_mem [{o}];')
    A(f'  a_url -> fastapi [taillabel="4 BERT", labelangle=0, '
      f'labeldistance=2.4, {o}];')
    A(f'  a_dga -> fastapi [{t}];')
    A(f'  fastapi -> bert [{t}]; fastapi -> dgam [{t}];')
    A(f'  a_scrap -> webscr [taillabel="5 scrape", labeldistance=2.4, {t}];')
    A(f'  a_mem -> domain [{t}]; a_mem -> redis [{t}];')
    A(f'  a_scrap -> a_ioc [label="6  page", {g}, style=dashed];')
    A(f'  a_scrap -> a_behav [{g}, style=dashed]; '
      f'a_scrap -> a_mitre [{g}, style=dashed];')
    A(f'  a_ioc -> a_intel [label="7  IOCs", {p}];')
    A(f'  a_intel -> otx [label="8  enrich", {r}];')
    # aggregation into reporter
    for a in ('a_url', 'a_dga', 'a_mem', 'a_behav', 'a_mitre', 'a_intel'):
        A(f'  {a} -> reporter [{g}, arrowhead=vee, constraint=false];')
    A(f'  reporter -> llm [label="9  narrative", {p}];')
    A(f'  llm -> gemini [{p}]; llm -> hfapi [{p}];')
    A(f'  reporter -> appwrite [label="persist", {r}];')
    A(f'  reporter -> pdf [{g}]; reporter -> redis [{g}, style=dashed, '
      f'label="write-back", constraint=false];')
    A(f'  reporter -> desktop [taillabel="consolidated\\nreport", '
      f'labeldistance=3, {g}, constraint=false, penwidth=2.4];')
    A('}')
    return "\n".join(L)


# ════════════════════════════════════════════════════════════════════════════
# 2) CLASS DIAGRAM
# ════════════════════════════════════════════════════════════════════════════
def _compartment(items, color="#16233D"):
    """Inner borderless table for an attribute/operation compartment."""
    if items:
        rows = "".join(
            f'<TR><TD ALIGN="LEFT"><FONT FACE="Menlo" POINT-SIZE="10" '
            f'COLOR="{color}">{x}</FONT></TD></TR>' for x in items)
    else:
        rows = '<TR><TD> </TD></TR>'
    return (f'<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" '
            f'CELLPADDING="1">{rows}</TABLE>')


def uml_node(nid, name, attrs, methods, header=TEAL, stereotype="",
             abstract=False):
    """A three-compartment UML class node (name / attributes / operations)."""
    nm = f'<I>{name}</I>' if abstract else f'<B>{name}</B>'
    head = ""
    if stereotype:
        head += (f'<FONT POINT-SIZE="9" COLOR="#EAF6F8"><I>{stereotype}</I>'
                 f'</FONT><BR/>')
    head += f'<FONT POINT-SIZE="13.5" COLOR="white">{nm}</FONT>'
    label = (
        f'<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="5" '
        f'COLOR="#5A6B82">'
        f'<TR><TD BGCOLOR="{header}" ALIGN="CENTER">{head}</TD></TR>'
        f'<TR><TD ALIGN="LEFT">{_compartment(attrs)}</TD></TR>'
        f'<TR><TD ALIGN="LEFT">{_compartment(methods, color="#1d3b2f")}</TD></TR>'
        f'</TABLE>>')
    return f'  {nid} [label={label}];'


def class_diagram():
    L = []
    A = L.append
    A('digraph cyberforge_class {')
    A('  graph [rankdir=TB, splines=ortho, bgcolor="white", nodesep=0.55,')
    A('         ranksep=0.9, pad=0.5, fontname="Helvetica-Bold", fontsize=22,')
    A('         labelloc=t, label="CyberForge \\u2014 Class Diagram '
      '(Agent-Orchestrator Subsystem)\\n\\n"];')
    A('  node [shape=plaintext, fontname="Helvetica"];')
    A('  edge [fontname="Helvetica", fontsize=10, penwidth=1.6, '
      'color="#5A6B82"];')

    NAVY = "#34507A"; ORG = "#B9770E"; GRN = "#1E8449"; PRP = "#6C3FBF"
    RD = "#A03A30"

    A(uml_node('Orchestrator', 'AgentOrchestrator',
        ['- agents: Map&lt;string,BaseAgent&gt;', '- memory: MemoryService',
         '- reporter: ReporterAgent', '- recentReports: Report[]'],
        ['+ analyze(url,sessionId,userId): Report',
         '+ stats(): OrchestratorStats', '+ recent(limit): Report[]',
         '- dispatchStage1/2/3(ctx): Promise[]', '- aggregate(ctx): Report'],
        header=ORG))
    A(uml_node('Base', 'BaseAgent', ['+ name: string', '+ role: string'],
        ['+ execute(ctx): AgentResult', '# _timed(fn): AgentResult'],
        header=TEAL_DK, stereotype='«abstract»', abstract=True))
    A(uml_node('Ctx', 'ScanContext',
        ['+ url, host: string', '+ sessionId, userId: string',
         '+ startedAt: number', '+ scrape: ScrapeResult',
         '+ agentResults: Map', '+ iocs: IOC[]', '+ mitre: MITRETechnique[]',
         '+ findings: string[]'], [], header=NAVY))
    A(uml_node('Mem', 'MemoryService',
        ['- domainHistory: Map', '- sessionMemory: Map', '- redis: RedisClient',
         '- vectorDB: VectorClient'],
        ['+ getDomain(host): DomainMemory', '+ recordVisit(host,verdict,score)',
         '+ getSession(sid): SessionMemory', '+ appendLLMContext(sid,msg)',
         '+ stats(): MemoryStats'], header=NAVY))
    A(uml_node('LLM', 'LLMFallbackChain', ['- providers: LLMProvider[]'],
        ['+ complete(prompt): LLMResponse', '- tryGemini(prompt)',
         '- tryMistral(prompt)', '- heuristic(ctx)'], header=PRP))
    A(uml_node('App', 'AppwriteService', [],
        ['+ createAlert(record)', '+ listAlerts(userId,limit)',
         '+ createAgentTask(task)'], header=RD))

    specs = [
        ('URLc', 'URLClassifierAgent', ['- mlServiceUrl: string'],
         ['+ execute(ctx)', '- callBert(url)']),
        ('DGAc', 'DGADetectorAgent', [], ['+ execute(ctx)', '- callDga(domain)']),
        ('Scr', 'WebScraperAgent', ['- scraperUrl, apiKey'],
         ['+ execute(ctx)', '- scrape(url)']),
        ('MemA', 'MemoryAgent', ['- memory: MemoryService'],
         ['+ execute(ctx)', '- readHistory(host)']),
        ('IOC', 'IOCExtractorAgent', ['- patterns: Map'],
         ['+ execute(ctx)', '- extract(text)', '- dedupe(iocs)']),
        ('Beh', 'BehaviouralAgent', [],
         ['+ execute(ctx)', '- inspectNet(reqs)', '- inspectJs(logs)']),
        ('MIT', 'MITREMapperAgent', ['- signals: Signal[]'],
         ['+ execute(ctx)', '- match(text)']),
        ('TI', 'ThreatIntelAgent', ['- otxClient: OTXClient'],
         ['+ execute(ctx)', '- enrich(ioc)']),
        ('Rep', 'ReporterAgent',
         ['- llmChain: LLMFallbackChain', '- appwrite: AppwriteService'],
         ['+ execute(ctx): Report', '- blendedScore(ctx)', '- escalate(v,ctx)',
          '- narrative(ctx)']),
    ]
    for nid, nm, at, me in specs:
        hdr = GRN if nid == 'Rep' else TEAL
        A(uml_node(nid, nm, at, me, header=hdr))
    A('  {rank=same; ' + '; '.join(s[0] for s in specs) + ';}')
    A('  {rank=same; Mem; Orchestrator; Ctx;}')
    A('  {rank=same; LLM; App;}')

    # ── relationships (ALL) ──────────────────────────────────────────────────
    # generalisation: specialists ▷ BaseAgent  (empty triangle)
    GEN = 'dir=back, arrowtail=empty, arrowsize=1.3, color="#5A6B82", penwidth=1.6'
    for nid, *_ in specs:
        A(f'  Base -> {nid} [{GEN}];')
    # aggregation: orchestrator ◇— BaseAgent
    A(f'  Orchestrator -> Base [dir=back, arrowtail=odiamond, arrowsize=1.4, '
      f'label="dispatches\\n1..*", penwidth=1.7, color="#5A6B82"];')
    # composition: orchestrator ◆— ReporterAgent
    A(f'  Orchestrator -> Rep [dir=back, arrowtail=diamond, arrowsize=1.4, '
      f'label="finalises", color="#B9770E", penwidth=1.7, fontcolor="#B9770E", '
      f'constraint=false];')
    # dependencies (dashed «...»)
    DEP = 'style=dashed, arrowhead=vee, arrowsize=0.9, penwidth=1.5'
    A(f'  Orchestrator -> Mem [{DEP}, label="«uses»", '
      f'color="#34507A", fontcolor="#34507A"];')
    A(f'  Orchestrator -> Ctx [{DEP}, label="«creates»", '
      f'color="#34507A", fontcolor="#34507A"];')
    A(f'  Base -> Ctx [{DEP}, label="reads / writes", color="#5A6B82", '
      f'constraint=false];')
    A(f'  MemA -> Mem [{DEP}, label="reads", color="#34507A", '
      f'fontcolor="#34507A", constraint=false];')
    A(f'  Rep -> LLM [{DEP}, label="«uses»", color="#6C3FBF", '
      f'fontcolor="#6C3FBF"];')
    A(f'  Rep -> App [{DEP}, label="persists via", color="#A03A30", '
      f'fontcolor="#A03A30"];')
    A(f'  Rep -> Mem [{DEP}, label="writes back", color="#1F9D57", '
      f'fontcolor="#1F9D57", constraint=false];')
    A('}')
    return "\n".join(L)


def glyphs(s):
    """Translate the \\uXXXX placeholders used above into real UTF-8 glyphs."""
    return (s.replace("\\u00b7", "·").replace("\\u2014", "—")
             .replace("\\u2192", "→").replace("\\u2026", "…"))


if __name__ == "__main__":
    with open(os.path.join(HERE, "architecture_diagram.dot"), "w",
              encoding="utf-8") as f:
        f.write(glyphs(architecture()))
    with open(os.path.join(HERE, "class_diagram.dot"), "w",
              encoding="utf-8") as f:
        f.write(glyphs(class_diagram()))
    print("wrote architecture_diagram.dot, class_diagram.dot")
