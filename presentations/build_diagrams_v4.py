"""Publication figures: self-contained HTML sources, SVG export, print PNGs.

Based on the installed diagram-design skill and the local Cyberforge-landing
palette. Text describes implemented paths; measurements come from saved reports.
"""
from pathlib import Path
import html, json, sys, subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / 'diagrams-v4'
OUT.mkdir(exist_ok=True)
SKILL = ROOT / '.claude/skills/diagram-design'
INK, MUTED, ORANGE, SAGE, PAPER, LINE = '#1F1A1B', '#5C5550', '#F69D39', '#869B7E', '#FFFFFF', '#C9C1B5'


class Figure:
    def __init__(self, slug, title, desc, kind, width=960, height=600):
        self.slug, self.title, self.desc, self.kind = slug, title, desc, kind
        self.w, self.h = width, height
        self.zones, self.edges, self.nodes = [], [], []
        self.text(32, 40, title, 27, bold=True)
        self.text(32, 70, 'CYBERFORGE  /  IMPLEMENTATION REVIEW · 23 OCTOBER 2026', 13, MUTED)

    def text(self, x, y, lines, size=20, color=INK, bold=False, anchor='start', layer=None):
        lines = lines.split('\n') if isinstance(lines, str) else lines
        parts = [f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{600 if bold else 400}" text-anchor="{anchor}">']
        for i, line in enumerate(lines):
            parts.append(f'<tspan x="{x}" dy="{0 if i == 0 else round(size*1.35,1)}">{html.escape(line)}</tspan>')
        parts.append('</text>')
        (layer if layer is not None else self.nodes).append(''.join(parts))

    def box(self, x, y, w, h, title, sub='', focal=False, tag=None, ellipse=False):
        fill = '#FFF3E3' if focal else '#FAF8F3'
        stroke = '#98601B' if focal else MUTED
        if ellipse:
            self.nodes.append(f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
            self.text(x+w/2, y+32, title, 21, bold=True, anchor='middle')
            if sub: self.text(x+w/2, y+60, sub, 16, MUTED, anchor='middle')
        else:
            self.nodes.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
            self.text(x+16, y+30, title, 21, bold=True)
            if sub: self.text(x+16, y+60, sub, 17, MUTED)
        if tag: self.text(x+w-12, y+20, tag, 11, MUTED, anchor='end')

    def path(self, d, dashed=False, marker='arrow', color=MUTED):
        self.edges.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.8"'+(' stroke-dasharray="6 5"' if dashed else '')+f' marker-end="url(#{self.slug}-{marker})"/>')

    def arrow(self, x1, y1, x2, y2, **kw):
        assert x1 == x2 or y1 == y2, 'Use a routed orthogonal path'
        self.path(f'M {x1} {y1} L {x2} {y2}', **kw)

    def label(self, x, y, text):
        assert len(text) <= 14
        width = max(40, len(text)*9+14)
        self.edges.append(f'<rect x="{x-width/2}" y="{y-15}" width="{width}" height="22" fill="{PAPER}"/>')
        self.text(x, y, text, 13, MUTED, anchor='middle', layer=self.edges)

    def foot(self, text):
        self.nodes.append(f'<line x1="32" y1="{self.h-60}" x2="{self.w-32}" y2="{self.h-60}" stroke="{LINE}"/>')
        self.text(32, self.h-34, text, 15, MUTED)

    def save(self):
        defs = f'''<defs><marker id="{self.slug}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="{MUTED}"/></marker>
        <marker id="{self.slug}-inherit" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M 1 1 L 11 6 L 1 11 z" fill="white" stroke="{MUTED}"/></marker></defs>'''
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="{self.slug}-title {self.slug}-desc" style="font-family:Arial,sans-serif"><title id="{self.slug}-title">{html.escape(self.title)}</title><desc id="{self.slug}-desc">{html.escape(self.desc)}</desc>{defs}<rect width="{self.w}" height="{self.h}" fill="{PAPER}"/>'+''.join(self.zones+self.edges+self.nodes)+'</svg>'
        page = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(self.title)}</title><style>body{{margin:0;background:white;color:{INK};font-family:Arial,sans-serif}}main{{max-width:100%;min-width:0}}.diagram-container{{width:100%;overflow-x:auto}}svg{{display:block;width:100%;min-width:{self.w}px}}@media print{{.diagram-container{{overflow-x:visible}}svg{{min-width:0}}}}</style></head><body><main><div class="diagram-container">{svg}</div></main></body></html>'
        (OUT/f'{self.slug}.html').write_text(page,encoding='utf-8')
        subprocess.run([sys.executable, str(SKILL/'scripts/export_svg.py'),'--system-fonts',str(OUT/f'{self.slug}.html'),str(OUT/f'{self.slug}.svg')],check=True,capture_output=True)
        return dict(slug=self.slug,title=self.title,type=self.kind,width=self.w,height=self.h)


def build():
    result=[]
    f=Figure('architecture','System architecture and deployment boundaries','Desktop requests reach authenticated backend services and a separate inference Space; training runs in isolated HF Jobs.','architecture')
    f.box(32,112,260,112,'Tauri 2 desktop','Native Rust + HTML/CSS/JS\nConsent · keyring · evidence')
    f.box(348,112,280,112,'Authenticated backend','Node.js 24 / Express\nVerified account + workspace',True)
    f.box(684,112,244,112,'Inference Space','FastAPI · CPU inference\nQwen V2 + URL models')
    f.box(32,344,260,112,'CLI / MCP adapters','Shared Rust operations\nGranted stdio tools only')
    f.box(348,344,280,112,'Scoped persistence','MongoDB · local memory\nSelected Appwrite records')
    f.box(684,344,244,112,'HF Jobs / NVIDIA L4','Separate LoRA training\nPrivate, pinned artefacts')
    f.arrow(292,168,348,168);f.arrow(628,168,684,168)
    f.path('M 292 388 H 312 Q 320 388 320 380 V 208 Q 320 200 328 200 H 348')
    f.arrow(488,224,488,344)
    f.arrow(808,344,808,224,dashed=True);f.label(862,290,'PINNED GGUF')
    f.foot('Solid: request / data path. Dashed: accepted model publication. Training does not run inside chat.')
    result.append(f.save())

    f=Figure('use-cases','Principal user interactions','An authenticated user can analyse, inspect, ask questions and approve supported actions; the owner runs training separately.','architecture')
    f.box(32,252,188,112,'Authenticated user','Own account / scope')
    f.box(320,112,320,80,'Submit permitted URL','Manual or consent-enabled sensor')
    f.box(320,232,320,80,'Inspect evidence','Verdict, source and missing coverage')
    f.box(320,352,320,80,'Ask the AI Assistant','Qwen / reviewed references')
    f.box(320,456,320,72,'Approve supported action','Applied receipt is checked')
    f.box(736,252,192,112,'Backend + ML','Scoped service calls')
    for y,port in [(152,276),(272,296),(392,316)]:
        if y==272:f.arrow(220,y+24,320,y+24)
        elif y==152:f.path('M 168 252 V 160 Q 168 152 176 152 H 320')
        else:f.path('M 168 364 V 384 Q 168 392 176 392 H 320')
    f.path('M 112 364 V 498 Q 112 506 120 506 H 320')
    f.arrow(640,272,736,272)
    f.path('M 640 152 H 824 Q 832 152 832 160 V 252')
    f.path('M 640 392 H 824 Q 832 392 832 384 V 364')
    f.foot('All interactions retain ownership and privacy controls. Training is an owner operation, not user browsing.')
    result.append(f.save())

    f=Figure('decision-flow','Analysis, approval and verified outcome','A URL passes consent and authentication checks, produces an attributed result and only then may lead to an approved device action.','flowchart',960,720)
    f.box(300,100,360,64,'Submitted / permitted URL',ellipse=True)
    f.box(300,204,360,80,'Validate consent and identity','Reject absent scope or permission')
    f.box(300,324,360,80,'Run the selected analysis','Keep coverage and source labels')
    f.nodes.append(f'<polygon points="480,444 636,500 480,556 324,500" fill="#FFF3E3" stroke="{MUTED}" stroke-width="1.6"/>')
    f.text(480,494,['Action needed','and approved?'],19,bold=True,anchor='middle')
    f.box(32,580,360,68,'Return evidence only','No action is claimed',ellipse=True)
    f.box(568,580,360,68,'Execute supported action','Record applied / failed receipt')
    f.arrow(480,164,480,204);f.arrow(480,284,480,324);f.arrow(480,404,480,444)
    f.path('M 324 500 H 220 Q 212 500 212 508 V 580');f.label(256,485,'NO')
    f.path('M 636 500 H 740 Q 748 500 748 508 V 580');f.label(696,485,'YES')
    f.foot('The language model explains evidence. It does not grant authority or prove that protection was applied.')
    result.append(f.save())

    f=Figure('class-model','Specialist-orchestrator class model','AgentOrchestrator coordinates concrete AgentBase subclasses; the figure shows representative classes rather than every implementation detail.','uml-class',960,720)
    def cls(x,y,w,name,attrs,ops,focal=False):
        h=148
        f.box(x,y,w,h,name,focal=focal)
        f.nodes.append(f'<path d="M {x} {y+44} H {x+w} M {x} {y+88} H {x+w}" stroke="{LINE}"/>')
        f.text(x+12,y+72,attrs,16,MUTED);f.text(x+12,y+116,ops,16,MUTED)
    cls(32,112,356,'AgentOrchestrator','- agents: specialist registry','+ analyze(input): report',True)
    cls(572,112,356,'AgentBase','+ name: string','+ execute(input)\n# _run(input)')
    cls(32,420,272,'URLClassifierAgent','BERT classifier client','# _run({url})')
    cls(344,420,272,'ThreatIntelAgent','OTX enrichment client','# _run({iocResult})')
    cls(656,420,272,'ReportAgent','Evidence + explanation','# _run({agents})')
    f.arrow(388,188,572,188,dashed=True);f.label(480,170,'COORDINATES')
    f.path('M 168 420 V 312 Q 168 304 176 304 H 648 Q 656 304 656 296 V 260',marker='inherit')
    f.path('M 480 420 V 336 Q 480 328 488 328 H 744 Q 752 328 752 320 V 260',marker='inherit')
    f.path('M 792 420 V 356 Q 792 348 800 348 H 840 Q 848 348 848 340 V 260',marker='inherit')
    f.text(32,610,'Hollow triangle: extends AgentBase. Dashed arrow: orchestration dependency.',16,MUTED)
    f.foot('Source: backend/src/services/agentOrchestrator.js. Other specialists are omitted for readability.')
    result.append(f.save())

    f=Figure('training','Qwen adaptation and controlled release','Private data preparation, supervised LoRA, GGUF export and evaluated promotion form a separate training workflow.','architecture',960,720)
    f.box(32,128,260,128,'1  Prepare + validate','Corrected, task-balanced targets\n2,462 train / 273 validation')
    f.box(348,128,264,128,'2  LoRA on NVIDIA L4','100 steps · rank 16\nLR 0.00002 · batch 2 × 8',True)
    f.box(668,128,260,128,'3  Merge + quantize','Pinned Qwen base + adapter\nQ4_K_M GGUF export')
    f.box(668,416,260,128,'4  Evaluate + review','130 factual / 240 regression\nFixed gate + actual answers')
    f.box(348,416,264,128,'5  Pin accepted revision','Space loads private GGUF\nHealth + both chat routes')
    f.box(32,416,260,128,'Preserve evidence','Reports, answers, revisions\nRejected candidates retained')
    f.arrow(292,192,348,192);f.arrow(612,192,668,192);f.arrow(800,256,800,416)
    f.arrow(668,480,612,480);f.arrow(348,480,292,480)
    f.text(32,320,'Training changes adapter weights; inference retrieval and grammar constraints do not.',20,MUTED)
    f.foot('Separate HF Jobs / private repositories. Validation loss is not an independent factual-accuracy metric.')
    result.append(f.save())

    f=Figure('grounding','Reference-grounded inference at runtime','Current-question retrieval selects reviewed passages for constrained decoding, while uncovered questions use ordinary generation.','flowchart',960,720)
    f.box(288,104,384,68,'Current question',ellipse=True)
    f.nodes.append(f'<polygon points="480,212 656,272 480,332 304,272" fill="#FFF3E3" stroke="{MUTED}" stroke-width="1.6"/>')
    f.text(480,266,['Reviewed topic','matched?'],20,bold=True,anchor='middle')
    f.box(32,376,408,112,'Constrained passage selection','Qwen chooses reviewed full sentences\n13-topic library · at most 2 references',True)
    f.box(568,376,360,112,'Ordinary Qwen generation','Uses permitted context\nCan still hallucinate')
    f.box(32,548,408,80,'Check wording + expose sources','Explicit reference replacement if needed')
    f.box(568,548,360,80,'Preserve engine attribution','No claim of general verification')
    f.arrow(480,172,480,212)
    f.path('M 304 272 H 244 Q 236 272 236 280 V 376');f.label(252,252,'YES')
    f.path('M 656 272 H 740 Q 748 272 748 280 V 376');f.label(704,252,'NO')
    f.arrow(236,488,236,548);f.arrow(748,488,748,548)
    f.foot('Primary-source links are shown in chat. This is bounded extraction, not unrestricted factual reasoning.')
    result.append(f.save())

    f=Figure('quality-results','Constrained generation resolved unsupported wording','The chart compares reference-substitution rates for the same 130 V2 scenario-mode cases under two serving policies.','bar')
    f.text(32,126,'Reference substitution on covered cases',22,bold=True)
    for i,(name,percent,count,color) in enumerate([('Sentence check only',56/130*100,'56 / 130',MUTED),('Constrained passages',0,'0 / 130','#98601B')]):
        y=200+i*132
        f.text(32,y,name,21,bold=True);f.text(32,y+30,count,18,MUTED)
        f.nodes.append(f'<rect x="348" y="{y-24}" width="524" height="40" fill="#F2EFE8"/>')
        if percent:f.nodes.append(f'<rect x="348" y="{y-24}" width="{524*percent/100:.2f}" height="40" fill="{color}"/>')
        else:f.nodes.append(f'<line x1="348" y1="{y-24}" x2="348" y2="{y+16}" stroke="{color}" stroke-width="3"/>')
        f.text(928,y+5,f'{percent:.2f}%',19,color,bold=True,anchor='end')
    for p in (0,25,50,75,100):f.text(348+524*p/100,420,str(p)+'%',15,MUTED,anchor='middle')
    f.text(32,474,'84 / 87 risk labels match the authored target (96.55%).',22,bold=True)
    f.text(32,510,'130 / 130 constrained factual/support checks passed; both model versions passed.',17,MUTED)
    f.foot('Same V2 weights. Serving controls changed. These are not measurements of unaided recall or URL accuracy.')
    result.append(f.save())

    f=Figure('live-response','Recorded live response and preserved provenance','An archived MFA-fatigue answer from the deployed service carries a model identifier, reviewed references and a generation constraint.','data-flow')
    receipt=json.loads((ROOT/'ml-services/llm_finetune/runs/v2-promotion.json').read_text())
    answer=receipt['live_verification']['analyst']['response'].lstrip('- ')
    import textwrap
    f.box(32,112,896,84,'Live analyst request','Explain MFA fatigue and how to respond.')
    f.text(48,244,textwrap.wrap(answer,90),20)
    f.nodes.append(f'<path d="M 32 408 H 928" stroke="{LINE}"/>')
    f.text(48,442,'Model: CyberForge Qwen3.5-2B V2 · pinned revision 494483e9…',18,bold=True)
    f.text(48,476,'Source: MITRE ATT&CK T1621 · knowledge policy 2026-10-23.3',18,MUTED)
    f.text(48,510,'Constraint: reviewed_passages · supported wording retained · not truncated',18,MUTED)
    f.foot('Source: archived authenticated service response, 23 October 2026. This is an evidence panel, not an app screenshot.')
    result.append(f.save())
    (OUT/'manifest.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('Built',len(result),'HTML / vector SVG figures in',OUT)


if __name__=='__main__':build()
