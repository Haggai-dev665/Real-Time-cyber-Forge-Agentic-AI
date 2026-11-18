"""Twelve-slide defence: required guide, current measured results, native builds.

Reuses the existing native-shape/preview helpers without rebuilding older decks.
All new results are read from recorded training/evaluation/deployment evidence.
"""
import json
from pathlib import Path
import build_presentation as b
from PIL import Image, ImageDraw
from pptx.util import Inches

HERE=Path(__file__).resolve().parent;ROOT=HERE.parent
PREV=HERE/'previews-v4';PREV.mkdir(exist_ok=True)
b.PREV=PREV;b.HEAD='Calibri Light';b.FONTFILES[b.HEAD]='calibril.ttf'
BG,PANEL,CREAM,ORANGE,SAGE,MUTED,LINE=b.BG,b.PANEL,b.CREAM,b.ORANGE,b.SAGE,b.MUTED,b.LINE
HEAD,BODY,MONO=b.HEAD,b.BODY,b.MONO
b.prs.core_properties.title='CyberForge — Thesis Defence V4'
b.prs.core_properties.subject='Revised thesis and measured Qwen/desktop release evidence, 23 October 2026'
MODEL='494483e9a85362b5d0bd596f9040bbc0848c860a'
base=ROOT/'ml-services/llm_finetune/runs'
report=json.loads((base/f'v2-constrained-review/release-constrained/{MODEL}/release_report.json').read_text())
train=json.loads((base/'v2-train-report.json').read_text())
assert report['passed'] and report['models']['candidate']['all_facts']['n']==130


class Slide(b.Slide):
    def __init__(self,section,title,subtitle,source,notes):
        super().__init__(section,title,subtitle,source,notes)
        for shape in list(self.s.shapes):
            if shape.has_text_frame and shape.text==f'{self.n:02d} / 15':
                shape._element.getparent().remove(shape._element)
            elif shape.top==Inches(8.92):shape.width=Inches(14.6*self.n/12)
        self.draw.rectangle((1390,25,1550,72),fill='#'+BG)
        for box in b.boxes:
            if box['slide']==self.n and box['text']==f'{self.n:02d} / 15':box['text']=f'{self.n:02d} / 12'
        self.text(14,.32,1.3,.3,f'{self.n:02d} / 12',11,MUTED,MONO,align='right')
        self.draw.rectangle((70,892,1530,898),fill='#'+BG)
        self.draw.rectangle((70,892,70+1460*self.n/12,896),fill='#'+ORANGE)
        self.s.notes_slide.notes_text_frame.text=notes+'\n\nSource: '+source+'\n\nAdvance slides manually. Native staggered entrances and looping GIF accents play in Slide Show. Historical URL results, current model results and implementation checks have different meanings.'


def stamp(s,label,text,y=7.35):
    s.rect(.8,y,14.4,.64,PANEL,LINE,7,True)
    s.text(1.0,y+.17,2.0,.3,label,11,SAGE,MONO,7)
    s.text(3.1,y+.13,11.7,.4,text,17,CREAM,BODY,7)


def build():
    s=Slide('Thesis defence · Version 4','','','The University of Bamenda · COLTECH · Computer Engineering',
      'Candidate: Che Haggai Ngha Kang, UBA24PP134. Supervisor: Prof. Onabid Mathias Akong. The original thesis title-page date remains June 2026; this defence incorporates the documented 23 October 2026 implementation and Qwen release update. Explain that the current system is evidence-grounded, not a promise of universal autonomous protection.')
    s.text(.8,1.5,10,1.35,'CyberForge',68,CREAM,HEAD,0)
    s.text(.85,2.9,9.6,1.9,'A Real-Time Agentic AI System\nfor Web Threat Detection\nand User Protection',30,CREAM,HEAD,1)
    s.rect(.85,5.2,1.2,.045,ORANGE,group=1)
    s.text(.85,5.65,9,.5,'CHE HAGGAI NGHA KANG',25,ORANGE,HEAD,2)
    s.text(.85,6.35,9,1.0,'UBA24PP134 · Master’s in Computer Engineering\nInformation Technology and Cyber Security',18,MUTED,BODY,2)
    s.text(.85,7.55,10,.4,'Supervisor: Prof. ONABID MATHIAS AKONG',17,CREAM,BODY,3)
    s.picture(b.ASSETS/'orbit.gif',10.6,2.0,4.8,4.8,1)
    s.text(10.6,7.1,4.5,.8,'CURRENT SYSTEM + MEASURED RESULTS\n23 October 2026',11,SAGE,MONO,3,align='center')

    s=Slide('01 / Brief introduction','Brief introduction','A single workflow connects web-security evidence with understandable advice.','Revised thesis §§1.1, 1.6, 3.2',
      'CyberForge analyses submitted URLs and permitted browsing observations. Its architecture combines specialist analysis, model outputs, intelligence and retained context. The current desktop is Tauri 2/Rust with a Node.js backend and FastAPI inference. Observation is consent-based and platform-dependent. AI advice does not replace detector evidence or proof of enforcement.')
    s.text(.85,3.0,6.2,2.0,'From scattered signals\nto an inspectable\nsecurity decision.',35,CREAM,HEAD,1)
    s.text(.9,5.7,5.7,1.35,'URL evidence · contextual intelligence\nHuman-readable explanation\nSupported, approved response',20,MUTED,BODY,2)
    for i,(name,sub) in enumerate([('Observe','Submitted / permitted URL'),('Analyse','Available models + evidence'),('Explain','Attribution + reviewed sources')]):
        y=2.9+i*1.42;s.node(8.3,y,6.5,1.12,name,sub,i+1,color=ORANGE if i==2 else SAGE)
        if i<2:s.line(11.5,y+1.16,11.5,y+1.38,MUTED,i+1,True)
    stamp(s,'SCOPE','URL and web-context security; current product capabilities remain explicit.')

    s=Slide('02 / Problem statement','Problem statement','Accurate-looking output can still hide weak evidence or unsupported claims.','Revised thesis §§1.2, 4.10.2, 4.12',
      'The original study identifies false alarms, unexplained scores and disconnected context. Current Qwen review adds a concrete reliability problem: a keyword gate passed answers containing unsupported security mechanisms. The project therefore keeps model, source and execution provenance visible. Do not suggest that all current problems were already solved by fine-tuning alone.')
    for i,(num,title,body) in enumerate([
      ('01','False alerts weaken trust','A score needs coverage, context and a named decision policy.'),
      ('02','Fluent text can invent facts','Manual review caught unsupported claims after a keyword gate passed.'),
      ('03','Interfaces fragment evidence','History, models, explanations and action outcomes need shared provenance.')]):
        y=2.95+i*1.38;s.text(.9,y,.8,.65,num,30,ORANGE if i==1 else SAGE,MONO,i+1)
        s.text(2.0,y,5.7,.6,title,27,CREAM,HEAD,i+1);s.text(8.2,y+.03,6.6,.9,body,21,MUTED,BODY,i+1)
        s.line(2.0,y+1.12,14.9,y+1.12,LINE,i+1,width=.6)
    stamp(s,'DESIGN RESPONSE','Inspect evidence, constrain covered claims, and verify actual outcomes.')

    s=Slide('03 / Research questions','Research questions','How can coordinated analysers support explainable web-threat assessment?','Thesis §1.3; validity limits in §§3.9 and 4.12',
      'The general question is quoted in compressed form from the thesis. The four original specific questions cover decomposition/minimality, integration, aggregation and historical context. The smallest sufficient agent set remains unresolved: no controlled ablation was supplied. Memory reuse is implemented context, not evidence of online parameter learning.')
    for i,(name,question) in enumerate([
      ('Decomposition','How should URL analysis be divided, and what agent set is sufficient?'),
      ('Integration','How can URL, content, IOC, ATT&CK and intelligence signals be combined?'),
      ('Decision','How can aggregation limit false alerts while retaining strong threat evidence?'),
      ('Context','How can past observations support later threat assessment?')]):
        y=2.9+i*1.07;s.text(.9,y,.6,.5,str(i+1).zfill(2),24,SAGE,MONO,i+1)
        s.text(1.9,y,3.9,.55,name,25,CREAM,HEAD,i+1);s.text(5.8,y,9.2,.8,question,21,MUTED,BODY,i+1)
    stamp(s,'OPEN QUESTION','Agent minimality and causal improvement need a separate ablation study.')

    s=Slide('04 / Research objectives','Research objectives','Design, implement and evaluate a coordinated web-security system.','Thesis §1.4; current scope in §§4.11–4.12',
      'The original objectives are retained. Explain each as an implemented direction rather than a universal success claim: coordinated tasks, multiple evidence views, an explicit aggregation policy and contextual intelligence. The Qwen refinement supports explanation quality; it does not retrain the URL detectors or directly establish lower false positives.')
    for i,(title,body) in enumerate([
      ('Coordinate specialised tasks','Build an ordered workflow with concurrent independent analyses.'),
      ('Unify complementary evidence','Combine structural, content, behavioural and reputation signals.'),
      ('Make decisions inspectable','Expose the decision policy, coverage, uncertainty and action state.'),
      ('Retain useful context','Link observations with prior records and external threat intelligence.')]):
        y=2.9+i*1.05;s.rect(.9,y+.06,.06,.68,ORANGE if i==2 else SAGE,group=i+1)
        s.text(1.25,y,5.9,.55,title,26,CREAM,HEAD,i+1);s.text(7.45,y+.02,7.2,.82,body,21,MUTED,BODY,i+1)
    stamp(s,'EVALUATION','Historical detection, current model behaviour and implementation checks are separate.')

    s=Slide('05 / Brief literature review','Brief literature review','Prior work motivates the architecture and its reliability controls.','Thesis Chapter 2; Hu et al. (2021), arXiv:2106.09685',
      'Sources retained from the thesis: Sommer and Paxson (2010), Outside the Closed World, IEEE S&P; Khonji et al. (2013), Phishing detection survey; Devlin et al. (2019), BERT; Wooldridge (2009), multiagent systems; Yao et al. (2023), ReAct; Strom et al. (2018), MITRE ATT&CK design. Added methodological source: Hu et al. (2021), LoRA, arXiv:2106.09685. These motivate design and do not constitute a commercial or baseline performance comparison.')
    rows=[('Cybersecurity ML','Sommer & Paxson · 2010','Representative evaluation and asymmetric errors matter.'),('Hybrid detection','Khonji et al. · 2013 / BERT · 2019','Multiple signals and learned text representations.'),('Agents and evidence','Wooldridge · 2009 / ATT&CK · 2018','Bounded specialisation and a shared evidence vocabulary.'),('Model adaptation','Hu et al. · 2021 · LoRA','Train low-rank updates; evaluate outputs independently.')]
    for i,(theme,cite,meaning) in enumerate(rows):
        y=2.9+i*1.05;s.text(.9,y,3.6,.5,theme,24,CREAM,HEAD,i+1);s.text(4.65,y+.04,5.0,.4,cite,14,SAGE,MONO,i+1);s.text(9.9,y,5.0,.85,meaning,19,MUTED,BODY,i+1)
        s.line(.9,y+.9,14.9,y+.9,LINE,i+1,width=.6)
    stamp(s,'RESEARCH GAP','Reproducible integration with honest failures and usable explanations.')

    s=Slide('06 / Methods and materials used','Methods and materials used','1 of 3 · Current architecture and training/inference separation','Revised thesis §3.2, Figure 3.1; deployment receipts, 23 October 2026',
      'The diagram shows implemented service boundaries. Tauri 2/Rust provides the native desktop; Node.js 24/Express enforces authenticated scope; FastAPI serves inference. Qwen LoRA runs on NVIDIA L4 in separate HF Jobs, exporting accepted pinned weights. The inference Space remains cpu-basic. MongoDB, Appwrite integrations and local context have distinct storage roles. Limited CLI/MCP operations do not imply complete autonomous interfaces.')
    for i,(x,w,title,sub) in enumerate([
      (.85,4.2,'Tauri 2 / Rust','Desktop UI, keyring and consent'),
      (5.9,4.2,'Node.js 24 / Express','Authenticated backend + scope'),
      (10.95,4.2,'FastAPI Space','CPU inference + model readiness')]):
        s.node(x,3.0,w,1.45,title,sub,i+1,color=ORANGE if i==1 else SAGE)
    s.line(5.1,3.7,5.8,3.7,MUTED,2,True);s.line(10.15,3.7,10.85,3.7,MUTED,3,True)
    s.node(.85,5.55,4.2,1.35,'Shared CLI / MCP','Limited, granted Rust operations',4,color=SAGE)
    s.node(5.9,5.55,4.2,1.35,'Scoped storage','MongoDB + local / Appwrite',4,color=SAGE)
    s.node(10.95,5.55,4.2,1.35,'HF Jobs / NVIDIA L4','Separate LoRA + GGUF export',5,color=ORANGE)
    s.line(8.0,4.5,8.0,5.45,MUTED,4,True)
    s.line(13.0,5.45,13.0,4.5,SAGE,5,True)
    s.text(13.25,4.65,1.7,.6,'Pinned\nweights',12,SAGE,MONO,5)
    stamp(s,'LEARNING TYPES','Supervised URL models + LoRA; unsupervised anomaly scoring; separate rules.')

    s=Slide('06 / Methods and materials used','Methods and materials used','2 of 3 · Targeted Qwen adaptation in separate GPU Jobs','Revised thesis §§3.7.5–3.7.7; train_report.json; training Job 6adaa7a3…',
      f'The initial corpus has 5,417 training, 251 validation and 487 test examples. Initial adaptation used 678 steps. V2 corrects task-balanced replay and adds reviewed references: 2,462 training, 273 validation and the retained 487 legacy test items. V2 uses LoRA rank 16, alpha 32, dropout 0.05, learning rate 0.00002, batch 2, accumulation 8, maximum length 1,024 and 100 steps on NVIDIA L4. Recorded training runtime is {train["train_runtime_s"]:.2f} seconds, excluding setup/export. Validation loss is not factual accuracy, and before/after pairs from different dataset compositions cannot be compared as a controlled improvement percentage.')
    s.text(.9,2.9,4.6,1.0,'2,462 / 273',42,ORANGE,HEAD,1)
    s.text(.95,4.0,4.5,.7,'Training / validation examples',20,MUTED,BODY,1)
    s.text(.95,5.0,4.5,1.7,'100 optimisation steps\nLoRA rank 16 · LR 0.00002\nNVIDIA L4 · effective batch 16',21,CREAM,BODY,2)
    for i,(name,sub) in enumerate([('Validate data','Roles, uniqueness, answer budgets'),('Adapt answer tokens','Base frozen; low-rank weights train'),('Export and test','Merge → Q4_K_M → release gate')]):
        y=2.9+i*1.35;s.node(6.4,y,8.5,1.05,name,sub,i+2,color=SAGE)
        if i<2:s.line(10.65,y+1.1,10.65,y+1.3,MUTED,i+2,True)
    stamp(s,'V2 VALIDATION LOSS',f'{train["eval_loss_before"]:.6f} → {train["eval_loss_after"]:.6f}; target fit, not factual accuracy.')

    s=Slide('06 / Methods and materials used','Methods and materials used','3 of 3 · Grounded inference and an unchanged acceptance gate','Revised thesis §§3.7.8–3.7.9; security_knowledge.py; release_cases.py',
      'Current-question matching retrieves at most two references from 13 reviewed topics. GBNF constrains covered answers to full or concise reviewed passages, and a sentence checker handles unsupported or interrupted wording. Uncovered questions retain ordinary Qwen generation. The first keyword gate and later free-generation candidate were held after manual review; the 25% reference-replacement ceiling was not relaxed. Final tests include 39 original and 26 additional scenarios in two modes, totalling 130 cases, eight retrieval-negative controls and 240 legacy regression items per model. The 52 additional cases are part of 130, not extra. These are authored tests, not a blinded expert audit.')
    for i,(title,body) in enumerate([('Current question','Ignore remembered topics when selecting sources.'),('Reviewed library','13 topics · OWASP, MITRE, NIST and other primary sources.'),('Bounded generation','Qwen selects supported passages; citations are preserved.')]):
        x=.85+i*5.05;s.node(x,3.0,4.2,2.2,title,body,i+1,color=ORANGE if i==2 else SAGE)
        if i<2:s.line(x+4.25,4.1,x+4.95,4.1,MUTED,i+1,True)
    s.text(.95,5.8,14.2,.8,'Fixed gates + manual review + pinned release + live route checks',26,CREAM,HEAD,4)
    s.text(.95,6.65,14.0,.45,'Uncovered requests use ordinary model generation and can still hallucinate.',20,MUTED,BODY,5)
    stamp(s,'NOT ONLINE LEARNING','Retrieval and grammar constraints do not change model weights.')

    s=Slide('07 / Results','Results','1 of 2 · Final model behaviour, with explicit denominators','Revised thesis §4.10; release-constrained/494483e9…/release_report.json',
      'The final comparison passed all eight unchanged gate checks. Both previous and V2 models with the same source constraint pass 130/130 covered factual/support checks and need zero reference replacements. This perfect bounded score is not unaided recall. The V2 regression sample has 240 items; only 87 require risk labels, with 84 correct (96.55%) compared with 83/87 for the previous adapter. Three disagreements remain. Applicable analyst answers fit 80 words and applicable memory cases contain no invented hosts. There is no statistical-significance claim. Outputs reused under exact model/seed/prompt identity are not mock data, but mixed timings are not a new latency benchmark. The historical 300-URL result remains 284/300, 94.7%, and is not this score.')
    values=[('130 / 130','Covered factual / support checks','Constrained reviewed-passage selection'),('84 / 87','Applicable risk labels agree','96.55% · authored regression targets'),('0 / 130','Reference replacements','Under the final source constraint')]
    for i,(value,label,meaning) in enumerate(values):
        y=2.8+i*1.43;s.text(.9,y,4.7,.9,value,44,ORANGE if i==0 else CREAM,HEAD,i+1)
        s.text(6.0,y+.08,8.8,.5,label,26,CREAM,HEAD,i+1);s.text(6.0,y+.65,8.8,.5,meaning,19,MUTED,BODY,i+1)
        s.line(.9,y+1.23,14.9,y+1.23,LINE,i+1,width=.6)
    stamp(s,'INTERPRETATION','Both models passed the bounded factual set; this is not new URL-detection accuracy.')

    s=Slide('07 / Results','Results','2 of 2 · Deployment and the current desktop state','Revised thesis §4.11; v2-promotion.json; live-client-final.log; build record',
      'The model revision 494483e9a85362b5d0bd596f9040bbc0848c860a was loaded successfully by the Space. Backend release v53 and both chat routes were checked. The real backend ML client passed CSRF, MFA fatigue and Heartbleed tests. Observed generation times were 14.906, 14.107 and 20.298 seconds, a three-call sample only. The contextual route preserves references and reports null confidence/null risk score with unknown risk for a general question. The Windows debug desktop was compiled; 14 Python checks and 29 targeted backend/rendering tests pass, with an earlier 950-test backend run. A focused Chromium fixture tested source links and persistence. No signed-in native UI session, installer replacement or full navigation harness pass is claimed.')
    s.text(.9,2.95,6.1,.7,'Running services verified',29,CREAM,HEAD,1)
    s.text(.95,3.95,6.0,2.2,'Pinned Qwen V2 loaded\nBoth live chat routes passed\nCSRF · MFA fatigue · Heartbleed\nSource and engine labels preserved',22,MUTED,BODY,2)
    s.text(8.1,2.95,6.6,.7,'Desktop rebuilt and checked',29,CREAM,HEAD,3)
    s.text(8.15,3.95,6.2,2.2,'Tauri 2 / Rust Windows debug build\n14 current sidebar destinations\nSaved conversation references\nBackend Qwen is the default',22,MUTED,BODY,4)
    s.line(7.5,2.95,7.5,6.7,LINE,3,width=1)
    stamp(s,'EVIDENCE BOUNDARY','Live service checks + compiled desktop / browser fixture; native acceptance remains.')

    s=Slide('08 / Conclusion','Conclusion','An inspectable system with a deployed, bounded explanation pipeline.','Revised thesis Chapter 5; §§4.10–4.12; full references in notes',
      'Conclude with implemented contributions and qualified evidence. CyberForge integrates specialist URL analysis, scoped workflows, separately trained Qwen LoRA, reviewed-source constraints and provenance-aware desktop chat. The present evidence supports bounded deployment behaviour. It does not establish perfect general knowledge, renewed detector accuracy, long-run uptime, complete AI CLI/MCP operation, agent minimality or packaged cross-platform protection. Next research: independent expert review, broader source coverage, uncovered-generation correction, new detector evaluation and controlled ablations. Next engineering: installer/native acceptance and fuller authorised CLI/MCP operations. References: root thesis Chapters 1–5, ml-services/llm_finetune/V2_RELEASE.md, report and source artefacts; Hu et al. (2021), https://arxiv.org/abs/2106.09685; Qwen model card https://huggingface.co/Qwen/Qwen3.5-2B; HF Jobs docs https://huggingface.co/docs/hub/en/jobs-overview. No SlidesCarnival/Pexels material is used in V4; visual palette comes from local Cyberforge-landing/cyberforge.css.')
    s.text(.9,3.05,8.7,1.5,'Evidence first.\nClaims within measured limits.',36,CREAM,HEAD,1)
    s.text(.95,5.1,8.5,1.8,'Separate training and inference\nPreserve sources and model revisions\nKeep approval separate from advice',23,MUTED,BODY,2)
    s.text(10.2,3.05,4.6,.5,'NEXT VALIDATION',12,SAGE,MONO,3)
    s.text(10.2,3.8,4.6,2.9,'Independent factual review\nBroader source coverage\nUncovered-answer quality\nPackaged desktop acceptance\nFuller CLI / MCP scope',21,CREAM,BODY,3)
    stamp(s,'THANK YOU','Questions and discussion')


def save():
    assert len(b.slides)==12
    for s in b.slides:
        for shape in s.s.shapes:
            props=getattr(shape._element,'spPr',None)
            if props is not None and props.find('{http://schemas.openxmlformats.org/drawingml/2006/main}effectLst') is None:
                props.append(b.q('a:effectLst'))
        s.animate()
    path=HERE/'CyberForge - Thesis Defence v4.pptx';b.prs.save(path)
    b.slides[0].im.save(HERE/'CyberForge - Thesis Defence v4 - Preview.pdf',save_all=True,append_images=[s.im for s in b.slides[1:]],resolution=100)
    thumb=Image.new('RGB',(1600,4*328),'#'+BG);draw=ImageDraw.Draw(thumb)
    for i,s in enumerate(b.slides):
        x=10+(i%3)*533;y=8+(i//3)*328;thumb.paste(s.im.resize((512,288),Image.Resampling.LANCZOS),(x,y));draw.text((x,y+292),f'{i+1:02d}  '+(b.all_notes[i]['title'] or 'CyberForge'),font=b.font(10),fill='#'+CREAM)
    thumb.save(HERE/'Slide overview v4.png')
    (HERE/'speaker-notes-v4.json').write_text(json.dumps(b.all_notes,ensure_ascii=False,indent=2),encoding='utf8')
    (HERE/'layout-audit-v4.json').write_text(json.dumps(b.boxes,ensure_ascii=False,indent=2),encoding='utf8')
    print('Created',path,'with 12 slides, native entrances, transitions, speaker notes and looping accents.')


if __name__=='__main__':build();save()
