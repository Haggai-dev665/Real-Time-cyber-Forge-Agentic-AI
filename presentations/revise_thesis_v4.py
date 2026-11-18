"""Update the current thesis, preserving its Word layout and immutable backups.

Only selected text, new academic subsections and identified diagram parts change.
The front matter, section geometry, styles, headers/footers, mathematical formula
and historical experimental tables remain in their original package form.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import copy, hashlib, json, shutil, sys
sys.path.insert(0,str(Path(__file__).parent/'.vendor'))
from lxml import etree as E
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'presentations'
DOC=ROOT/'Che Haggai Ngha Kang.docx'
BACKUP=OUT/'Che Haggai Ngha Kang - Before V4 update.docx'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS={'w':W,'r':R,'a':'http://schemas.openxmlformats.org/drawingml/2006/main','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
Q=lambda name:'{'+W+'}'+name

REPLACE={
39: "CyberForge integrates specialised URL-security analysers, contextual evidence and human-readable explanations. Its historical prototype reported 284 correct decisions on 300 selected URLs (94.7% accuracy), a 2.0% false-positive rate and 4.05-second mean end-to-end latency; these measurements have not been reproduced for the revised system. The implementation reviewed on 23 October 2026 uses a Tauri 2/Rust desktop, a Node.js 24/Express backend and a FastAPI Hugging Face inference service. Three supervised URL classifiers, an unsupervised anomaly detector, pretrained BERT inference and rule-based extraction remain distinct components. Qwen3.5-2B was adapted through supervised low-rank fine-tuning in separate NVIDIA L4 Hugging Face Jobs, then exported as Q4_K_M GGUF. A targeted 100-step update used 2,462 training and 273 validation examples. The accepted serving pipeline adds a 13-topic reviewed reference library and constrained passage selection. It passed 130 of 130 covered factual/support checks; this measures bounded reference use rather than unaided factual recall. On a 240-item regression sample, 84 of 87 applicable risk labels matched authored targets (96.55%). The pinned model and both chat routes were verified live, while the Windows desktop was built and its reference interface checked in a browser fixture. Historical detection accuracy, current language-model evaluation and software verification are reported separately. Remaining limitations include uncovered-question hallucinations, limited independent evaluation, incomplete CLI/MCP feature coverage and unverified packaged cross-platform behaviour.",
43: "CyberForge associe des analyseurs spécialisés de sécurité des URL, des données contextuelles et des explications lisibles. Le prototype historique rapporte 284 classifications correctes sur 300 URL sélectionnées (94,7 %), un taux de faux positifs de 2,0 % et une latence moyenne de 4,05 secondes; ces résultats ne sont pas une nouvelle évaluation du système révisé. La version examinée le 23 octobre 2026 comprend un client Tauri 2/Rust, un backend Node.js 24/Express et un service FastAPI sur Hugging Face. Qwen3.5-2B a été adapté par apprentissage supervisé LoRA dans des tâches Hugging Face séparées, sur GPU NVIDIA L4, puis exporté au format GGUF Q4_K_M. La mise à jour ciblée utilise 2 462 exemples d’entraînement et 273 de validation sur 100 étapes. Le pipeline retenu ajoute une bibliothèque de références vérifiées couvrant 13 thèmes et une génération limitée à des passages approuvés. Les 130 contrôles factuels et de support sont réussis; ils mesurent cette extraction contrainte, et non la connaissance factuelle autonome. Sur 240 exemples de régression, 84 des 87 niveaux de risque applicables correspondent aux cibles rédigées (96,55 %). Le modèle déployé et les deux routes de dialogue ont été vérifiés en ligne; le client Windows a été compilé et son interface de références testée dans un navigateur contrôlé. Les performances historiques, l’évaluation du modèle et les vérifications logicielles restent distinctes. Les réponses hors bibliothèque, l’évaluation indépendante et la validation multiplateforme demeurent limitées.",
159:"Historical observations are retained as contextual evidence. Memory retrieval does not update weights. Model adaptation now occurs through a separate, supervised Qwen LoRA workflow in Hugging Face Jobs. Chapter 4 distinguishes historical detection measurements from the October 2026 language-model evaluation and current implementation verification.",
194:"Evaluation comprises three evidence categories: the historical 300-URL experiment, the current Qwen training and release evaluation, and software/integration checks. They have different datasets, denominators and purposes. No commercial comparison, cross-platform benchmark or production uptime guarantee is inferred from a model-quality score or successful build.",
257:"URLNet (Le et al., 2018) and BERT (Devlin et al., 2019) illustrate learned URL/text representations. CyberForge uses an externally pretrained BERT URL classifier and separately fitted gradient-boosted URL models. Its new language-model adaptation applies low-rank supervised updates to Qwen rather than proposing a novel Transformer architecture. LoRA freezes the pretrained base and learns smaller update matrices (Hu et al., 2021). This reduces the adaptation burden, but validation loss and fluent explanations still require task-specific evaluation.",
311:"Language models provide advisory explanations from supplied evidence. The deployed Space now loads a supervised LoRA-adapted Qwen3.5-2B GGUF model at an immutable revision. For 13 reviewed security topics, retrieval and a decoding grammar constrain answers to approved reference passages; other questions use ordinary generation. Response metadata identifies the model, reference sources and any substituted reference answer. An explanation is not independent detector evidence or proof of an executed action.",
312:"The historical prototype used Gemini, Mistral and a template fallback. Current desktop chat defaults to the authenticated backend Qwen route, even when an optional Hugging Face token is stored. The separate direct-provider path requires explicit configuration. Busy, failed or timed-out generation is reported honestly, and reviewed-reference substitution is distinguished from model-selected passages and unrelated rule/template summaries.",
339:"This chapter presents the architecture, materials and methods of CyberForge as reviewed on 23 October 2026. It separates URL-detection models, advisory language-model adaptation and application control workflows. The new methods include a reproducible Hugging Face Jobs pipeline, supervised Qwen LoRA training, GGUF export, reference-grounded inference and explicit release criteria. The historical eight-specialist design remains part of the research context rather than a claim that every current route executes the same pipeline.",
341:"The architecture, user interactions, decision flow and representative class relationships are shown in Figures 3.1–3.4. Separate diagrams explain offline Qwen training and runtime reference grounding. These views distinguish implemented service boundaries and permissions without treating planned CLI/MCP operations or unrestricted autonomous action as completed features.",
345:"Evaluation records the historical URL experiment separately from the current Qwen scenario and regression suites. Software tests, browser-fixture checks, desktop compilation and authenticated live service calls establish narrower implementation claims. Chapter 4 reports each result with its applicable denominator, source artefact and limitations.",
348:"The implementation separates desktop/native services, authenticated backend control, ML inference, persistent evidence and offline model training. The reviewed live release uses a FastAPI Space for CPU inference and separate Hugging Face Jobs for NVIDIA L4 LoRA training. Figure 3.1 makes this training/inference boundary explicit. Source availability, a successful build, live route verification and installed-product acceptance are treated as different evidence levels.",
353:"Inference and training layer: FastAPI Space serving fitted URL detectors, externally pretrained BERT and adapted Qwen V2; separate Hugging Face Jobs prepare data, train adapters, export GGUF and compare candidates.",
358:"Figure 3.1: Current architecture and deployment boundaries. The authenticated backend calls the inference Space; separate Hugging Face Jobs publish accepted, pinned model artefacts. Source: current implementation and release receipts, 23 October 2026.",
363:"The canonical service is ml-services/hf_space_deploy/app.py. Three supervised HistGradientBoostingClassifier models and a benign-only IsolationForest analyse URL features; BERT is a separate externally pretrained URL classifier. Qwen V2 provides advisory chat through llama-cpp-python. DGA and IOC functions use explicit rules. Capability metadata distinguishes loaded, loading, failed and unavailable components. Qwen training runs in separate Jobs; the existing four-detector owner-training route is a different mechanism.",
364:"Desktop explanations default to the backend Qwen service. Current-question matching retrieves at most two references from a 13-topic editorial library. Covered answers use constrained selection of reviewed sentences; an interrupted or unsupported answer may be replaced by an explicitly labelled reference response. Citations and engine metadata survive backend forwarding and saved conversations. Other generation remains unverified; signed evidence exports remain distinct from AI-written narratives.",
367:"Detection, proposal, approval, command delivery and verified application remain separate events. Shared desktop headers and footers report service readiness, stream state, data age and operations from available responses, with unavailable or stale states where appropriate. They do not turn a successful HTTP response into proof of complete protection.",
378:"The original prototype reported a 4.05-second mean per URL. Three live Qwen V2 requests took 14.906, 14.107 and 20.298 seconds during the recorded integration check; these measure chat generation on that deployment, not the original URL pipeline or an operational latency distribution. Separate workloads cannot be compared as a before/after speed improvement.",
382:"Figure 3.2: Current principal user interactions: permitted URL submission, evidence inspection, AI assistance and explicitly approved supported actions. Training remains a separate owner operation.",
383:"The use-case view identifies what a verified user may request and where the request is serviced. Browsing observation is optional and platform-dependent; manual analysis is also available. Viewing evidence, asking a question and approving a supported device action are different interactions, each retaining its scope and privacy controls.",
397:"Figure 3.3: Analysis-to-action decision flow. Permission checks precede analysis; a source-labelled result does not become an applied action without approval, a supported adapter and an execution receipt.",
421:"Figure 3.4: Representative current specialist-orchestrator classes and inheritance. AgentBase, AgentOrchestrator and three concrete specialists are shown; the remaining specialists and separate control-plane modules are omitted for readability.",
422:"AgentOrchestrator coordinates the registered specialist instances. Its analyze method accepts a URL and scoped identifiers, dispatches dependent stages and invokes ReportAgent. Recent in-process report buffers are caches, not durable audit records. The figure represents this implemented class family, not the complete desktop or control-plane object model.",
423:"AgentBase is the implemented specialist superclass. Its execute(input) wrapper records timing and handles the result of the subclass _run(input) method. URLClassifierAgent, DGADetectorAgent, WebScraperAgent, MemoryAgent, IOCExtractorAgent, BehavioralAgent, MITREMapperAgent, ThreatIntelAgent and ReportAgent implement the corresponding specialist work; the Reporter follows the eight analysers.",
425:"WebScraperAgent requests page evidence from the configured scraper integration. Returned content and metadata are passed as result records to the content-dependent specialists. A successful fetch does not itself establish malware execution, complete network coverage or a dynamically isolated virtual-machine sandbox.",
434:"Per-stage result objects carry data between specialist calls. These plain records should not be mistaken for a newly implemented ScanContext class. The orchestrator passes scraped evidence and extracted indicators to the consumers that require them, then supplies available results to the Reporter.",
438:"Historical development hardware was reported as an Apple-silicon MacBook with 16 GB RAM and macOS Sonoma 14.6. The current desktop was built in a Windows workspace. Recorded Qwen training used an NVIDIA L4 in Hugging Face Jobs; evaluation used CPU-upgrade, while the inference Space retained cpu-basic. These are recorded environments, not comparative hardware benchmarks or a claim of cross-platform release acceptance.",
448:"transformers 5.20.2, peft 0.21.2 and accelerate 1.15.0 in the recorded Qwen GPU job; inference requirements are maintained separately by the Space.",
450:"huggingface_hub 2.2.0 in the job launcher and llama-cpp-python 0.3.36 for the evaluated GGUF serving runtime.",
456:"Hugging Face Spaces and Jobs. The Space serves canonical FastAPI inference with service authentication. Separate private, revision-pinned CPU/GPU Jobs prepare and adapt Qwen. The existing owner-triggered four-detector trainer remains a distinct in-Space path and is not described as the LoRA workflow.",
460:"Explanation inference. Deployed CyberForge Qwen3.5-2B V2 in Q4_K_M GGUF, loaded by immutable revision; reviewed-topic extraction and source verification supplement the weights.",
461:"Additional explanation paths. Optional configured backend providers and an explicitly selected direct desktop provider remain separate paths. Storing an optional token does not automatically replace the backend Qwen default. Responses identify the engine that actually answered.",
464:"Pretrained sources: Qwen/Qwen3.5-2B at a pinned revision supplies the LoRA base; elftsdmr/malware-url-detect supplies the separate BERT URL path. The Qwen adapter is trained by the new workflow; BERT is not fine-tuned by that workflow. The earlier public Unsloth GGUF is retained as a historical baseline and rollback default, not the current live V2 weights.",
478:"Later implementation work added the authenticated desktop console, private service contracts and the Qwen Jobs pipeline. The recorded October 2026 sequence comprises CPU data preparation, a two-step GPU smoke test, full LoRA training, targeted V2 refinement, quantisation, scenario/regression evaluation, manual rejection of unsupported wording and controlled promotion of the final serving pipeline. Each stage has a saved receipt and immutable source or model revision.",
488:"Table 3.3 presents the retained eight-specialist pipeline and final Reporter. It is separate from the Qwen training configuration and release gates in Tables 3.1 and 3.2.",
490:"Table 3.3: The retained CyberForge eight-agent analysis pipeline and final Reporter.",
484:"The current verification exercises the deployed Qwen path, references, ordinary chat, analyst chat and contextual chat. It checks source labels, null uncalibrated confidence, supported wording, persistence of citations and busy/time-budget behavior. A model-selection response and a fixed reference replacement are labelled differently. Successful generation is not treated as evidence that a URL was scanned or an action applied.",
498:"The evaluation uses separate protocols for historical classification, current language-model behaviour and implementation verification. The four original criteria below are retained as historical targets. The additional Qwen method samples 240 legacy regression items and 65 reviewed security scenarios in both modes (130 scenario-mode cases), with eight retrieval-negative controls. Current inference controls and both model revisions are held explicit in the comparison.",
503:"The original experiment has no complete raw per-URL log or reproducible split manifest in the supplied thesis, so its figures remain reported historical results. Current Qwen outputs and reports are preserved separately. They establish bounded task behaviour, not refreshed URL-detection accuracy, commercial superiority, calibrated probabilities or a controlled agent ablation.",
506:"This chapter separates the reported historical URL experiment from the new Qwen fine-tuning, constrained-generation evaluation and current desktop/service verification. Tables 4.1–4.8 and Figures 4.1–4.13 remain historical records or interface illustrations. Sections 4.10–4.12 add the measured October 2026 results and their limitations; current performance is not inferred from old screenshots or old provider ratings.",
510:"Historical screenshots are retained to preserve the development record, with explicit historical captions. Current navigation, model routing, reference persistence and readiness controls are documented separately from those images. The release record includes real authenticated inference responses, browser-fixture checks and a Windows debug build; it does not include a driven, signed-in native desktop acceptance session.",
521:"Figure 4.1 is a historical dashboard illustration. The current sidebar separates Workspace, Security, Explore and Diagnostics. Shared console controls obtain scoped counts, backend/event-stream state and per-model readiness, retaining freshness and unavailable states. Displayed screenshot counters are not additional experimental observations.",
524:"Figure 4.2 is a historical Agent Core view. The current UI separates user-facing Agents and schedules from the Local runtime diagnostic screen; it does not imply that every durable run is an unrestricted eight-agent or LLM-planned workflow.",
547:"Figures 4.5 and 4.6 illustrate earlier model and signal views. Their current destinations are Model capabilities and Event stream under Diagnostics. The capability response describes individual readiness and limits rather than representing every component as trained, available or calibrated.",
553:"Table 4.6 retains the historical Gemini/Mistral explanation ratings. The current adapted Qwen pipeline was evaluated with explicit scenarios, regression items, source-support checks and recorded live calls, reported in Section 4.10. Historical 1-to-10 ratings are not Qwen accuracy scores.",
558:"The historical analysis and assistant views are retained in Figures 4.7 and 4.8. In the current console, Analyze groups URL inspection rather than claiming virtual-machine malware detonation. The AI Assistant routes through the backend Qwen service by default and stores engine and reference metadata with messages, restoring primary-source links when a conversation is reopened.",
567:"The original text attributed repeat responses below 100 ms and a 15% repeat share to caching. No raw workload or trace log is supplied for that claim. It is retained as a historical report, not a newly measured characteristic of the current Qwen or desktop paths.",
582:"Table 4.8 reviews the original objectives against historical evidence. Unsupported reliability and explanation claims are qualified rather than converted into current acceptance results. The new model and desktop checks have separate criteria and denominators in Sections 4.10 and 4.11.",
586:"The reported historical confusion counts support 94.7% accuracy and 2.0% false positives on the selected 300-URL set. They do not identify which component caused each error or establish agent superiority. The 4.05-second historical mean exceeds the strict 4.00-second warm target. These historical observations must remain distinct from the current Qwen and implementation results that follow.",
587:"The subsequent results examine supervised adaptation and controlled inference rather than re-running the URL experiment. No new URL-detection accuracy, operational uptime or cross-platform release result is inferred. The remaining original false positives and false negatives require per-indicator evidence and an independent re-evaluation.",
590:"This dissertation presents CyberForge's specialist analysis design, historical URL experiment and current evidence-grounded implementation. The updated system includes a Tauri/Rust desktop, authenticated backend workflows, a private inference service and a separately trained Qwen LoRA adapter. The contribution is an inspectable integration of models, contextual evidence, explanations and bounded authority rather than a claim of unrestricted autonomous protection.",
592:"The October 2026 release adds recorded NVIDIA L4 fine-tuning, private pinned artefacts, explicit release gates and reviewed-topic constrained generation. All 130 covered factual/support checks passed under the final constraint; 84/87 applicable regression risk labels agreed with authored targets. Both chat routes were checked live and the Windows desktop was built. These results support bounded deployment claims while leaving independent factual assessment, uncovered generation, detector re-evaluation and packaged cross-platform acceptance open.",
597:"Model quality and training. Extend independent, temporal and domain-held-out evaluation, review the three remaining risk-label disagreements and improve uncovered generation. Qwen training is already isolated in Hugging Face Jobs with revision-pinned promotion and preserved rejection reports; extend comparable isolation and atomic publication to the existing detector-training workflow. Reviewed user feedback may support later supervised batches, but no automatic online retraining is established.",
600:"Future research should investigate causal agent ablations, larger regional/hosted-phishing corpora, blinded explanation assessments and a broader reviewed-reference library. Product work includes fuller AI CLI/MCP coverage, packaged desktop/mobile acceptance and verified action rollback. The completed Qwen Jobs workflow and limited stdio CLI/MCP surface should neither be described as absent nor overstated as complete autonomous operation.",
634:"Appendix C: Current implementation and evidence boundary (23 October 2026)",
636:"This revision uses the current source and the saved October 2026 training, evaluation and deployment receipts. The original title page and historical experimental tables are retained. A separate pre-V4 DOCX backup preserves the immediately preceding document. Model-quality artefacts, live route evidence, compilation and browser-fixture results are identified separately; planned capabilities are not treated as delivered.",
638:"Desktop: Tauri 2/Rust with static HTML/CSS/JavaScript, OS credential storage, native telemetry and authenticated event streaming. The 14 sidebar destinations are grouped into Workspace, Security, Explore and Diagnostics; Settings adds privacy, diagnostics and integrations controls. Headers/footers expose live response states and freshness. The Assistant defaults to backend Qwen, retains primary-reference metadata and restores it with saved conversations. Sources: cf-sidebar.js, cf-console.js, cf-header.js, cyberforge-shared.js, pages/ai-assistance.js and src-tauri/src/ml.rs.",
644:"Supervised language-model adaptation: Qwen3.5-2B is now fine-tuned by LoRA in separate HF Jobs and served as a pinned GGUF. BERT remains externally pretrained inference. Reference retrieval and grammar constraints shape covered responses without changing weights; DGA/IOC logic remains rule-based. No reinforcement-learning or automatic online-weight-update loop is established.",
651:"Phase 5 — publish accepted detector artefacts. The existing detector trainer publishes accepted models and metadata through owner-authorised routes. Qwen has a distinct Jobs-based workflow: prepare, smoke-test, train/refine, merge/quantise, compare, review and pin an accepted model revision. Its recorded deployment includes model health and both chat routes. This completed Qwen process does not imply that every detector publication path now has independent durable workers or atomic whole-bundle rollback.",
654:"Current Qwen evidence is summarised in Sections 4.10–4.12: 130 constrained scenario-mode checks, 240 regression items with 87 applicable risk labels, saved actual answers and live route receipts. The Windows build and controlled browser test establish narrower implementation properties; cross-platform installed behaviour, long-run uptime, action enforcement and an independent expert factual benchmark remain unestablished by this release.",
}


def main():
    if not BACKUP.exists():shutil.copy2(DOC,BACKUP)
    with ZipFile(BACKUP) as z:files={n:z.read(n) for n in z.namelist()}
    tree=E.fromstring(files['word/document.xml']); body=tree.find('w:body',NS); original=list(body)
    rels=E.fromstring(files['word/_rels/document.xml.rels'])
    changes=[]; inserted=[]
    def text(p):return ''.join(p.itertext(Q('t')))
    def replace(p,value):
        runs=p.findall('w:r',NS)
        props=next((copy.deepcopy(r.find('w:rPr',NS)) for r in runs if r.find('w:rPr',NS) is not None),None)
        keep=[copy.deepcopy(c) for c in p if c.tag in (Q('bookmarkStart'),Q('bookmarkEnd'))]
        for c in list(p):
            if c.tag!=Q('pPr'):p.remove(c)
        for c in keep:
            if c.tag==Q('bookmarkStart'):p.append(c)
        run=E.SubElement(p,Q('r'))
        if props is not None:run.append(props)
        t=E.SubElement(run,Q('t'));t.set('{http://www.w3.org/XML/1998/namespace}space','preserve');t.text=value
        for c in keep:
            if c.tag==Q('bookmarkEnd'):p.append(c)
    for i,value in REPLACE.items():
        assert original[i].tag==Q('p'),i
        changes.append({'original_index':i,'before':text(original[i]),'after':value});replace(original[i],value)
    for i in (515,518,530,533,545,556,566,584):
        old=text(original[i]);replace(original[i],old.replace('Source: Author’s experimental results, 2026','Historical report; not remeasured in this revision'))
    for i in (523,526,538,541,549,551,560,562,570,572,576,578,580):
        old=text(original[i]);value=old.replace(': The ',': Historical interface illustration: the ',1)
        value=value.replace('presenting the detonation chamber','presenting the URL-analysis workspace')
        if i==580:value='Figure 4.13: Historical authentication view. The current native implementation uses OS credential storage; this image does not verify the new Windows build.'
        replace(original[i],value)
    # Qualify unsupported old objective outcomes; retain the actual confusion-count tables.
    cells=original[583].findall('w:tr',NS)
    for row in cells[1:]:
        vals=row.findall('w:tc',NS)
        name=text(vals[0])
        if name=='Clear explanations':replace(vals[3].find('w:p',NS),'Descriptive ratings only')
        if name=='Reliable integrations':
            replace(vals[2].find('w:p',NS),'Historical uptime claims; raw logs not supplied')
            replace(vals[3].find('w:p',NS),'Not independently established')
    def para(value,style='BodyText'):
        p=E.Element(Q('p'));pp=E.SubElement(p,Q('pPr'));st=E.SubElement(pp,Q('pStyle'));st.set(Q('val'),style)
        replace(p,value);return p
    def block(anchor,items):
        for item in items:
            node=para(item) if isinstance(item,str) else item
            anchor.addnext(node);anchor=node
            inserted.append(text(node)[:160])
        return anchor
    def heading(value):return para(value,'Heading3')
    def major(value):return para(value,'Heading2')
    def table(headers,rows,widths=None):
        widths=widths or [8504//len(headers)]*len(headers)
        tbl=E.Element(Q('tbl'));pr=E.SubElement(tbl,Q('tblPr'))
        tw=E.SubElement(pr,Q('tblW'));tw.set(Q('w'),'8504');tw.set(Q('type'),'dxa')
        layout=E.SubElement(pr,Q('tblLayout'));layout.set(Q('type'),'fixed')
        borders=E.SubElement(pr,Q('tblBorders'))
        for side in ('top','left','bottom','right','insideH','insideV'):
            e=E.SubElement(borders,Q(side));e.set(Q('val'),'single');e.set(Q('sz'),'4');e.set(Q('color'),'B7B7B7')
        margins=E.SubElement(pr,Q('tblCellMar'))
        for side in ('top','bottom','left','right'):
            e=E.SubElement(margins,Q(side));e.set(Q('w'),'80');e.set(Q('type'),'dxa')
        grid=E.SubElement(tbl,Q('tblGrid'))
        for width in widths:E.SubElement(grid,Q('gridCol')).set(Q('w'),str(width))
        for ri,row in enumerate([headers]+rows):
            tr=E.SubElement(tbl,Q('tr'));trpr=E.SubElement(tr,Q('trPr'));E.SubElement(trpr,Q('cantSplit'))
            if ri==0:E.SubElement(trpr,Q('tblHeader'))
            for ci,value in enumerate(row):
                tc=E.SubElement(tr,Q('tc'));tcp=E.SubElement(tc,Q('tcPr'));cw=E.SubElement(tcp,Q('tcW'));cw.set(Q('w'),str(widths[ci]));cw.set(Q('type'),'dxa')
                if ri==0:
                    sh=E.SubElement(tcp,Q('shd'));sh.set(Q('fill'),'EFE9DD')
                p=para(str(value));ppr=p.find('w:pPr',NS);sp=E.SubElement(ppr,Q('spacing'));sp.set(Q('after'),'60');sp.set(Q('line'),'240');sp.set(Q('lineRule'),'auto')
                jc=E.SubElement(ppr,Q('jc'));jc.set(Q('val'),'left')
                rp=E.Element(Q('rPr'));p.find('w:r',NS).insert(0,rp);E.SubElement(rp,Q('sz')).set(Q('val'),'20')
                if ri==0:E.SubElement(rp,Q('b'))
                tc.append(p)
        return tbl
    cap=lambda value:para(value,'TableCaption')
    figs=OUT/'diagrams-v4'
    used_ids={int(e.get('Id')[3:]) for e in rels if e.get('Id','').startswith('rId') and e.get('Id')[3:].isdigit()}
    next_id=max(used_ids)+1
    def figure(slug,caption,template_index=357):
        nonlocal next_id
        filename=f'v4-{slug}.png';img=Image.open(figs/f'{slug}.png');width=5.72*914400;height=width*img.height/img.width
        rel=E.SubElement(rels,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship');rid=f'rId{next_id}';next_id+=1
        rel.set('Id',rid);rel.set('Type',R+'/image');rel.set('Target','media/'+filename)
        files['word/media/'+filename]=(figs/f'{slug}.png').read_bytes()
        p=copy.deepcopy(original[template_index]);blip=p.find('.//a:blip',NS);blip.set('{'+R+'}embed',rid)
        for ext in p.findall('.//wp:extent',NS)+p.findall('.//a:xfrm/a:ext',NS):ext.set('cx',str(round(width)));ext.set('cy',str(round(height)))
        docpr=p.find('.//wp:docPr',NS);docpr.set('id',str(1000+next_id));docpr.set('name',slug);docpr.set('descr',caption)
        return [p,para(caption,'ImageCaption')]
    # Replace only the four identified diagrams, preserving their paragraph/caption styles.
    for idx,slug in [(357,'architecture'),(381,'use-cases'),(396,'decision-flow'),(420,'class-model')]:
        p=original[idx];rid=p.find('.//a:blip',NS).get('{'+R+'}embed');target=next(e.get('Target') for e in rels if e.get('Id')==rid)
        files['word/'+target]=(figs/f'{slug}.png').read_bytes();img=Image.open(figs/f'{slug}.png');cx=round(5.72*914400);cy=round(cx*img.height/img.width)
        for ext in p.findall('.//wp:extent',NS)+p.findall('.//a:xfrm/a:ext',NS):ext.set('cx',str(cx));ext.set('cy',str(cy))
        dp=p.find('.//wp:docPr',NS);dp.set('descr','Updated current-system diagram: '+slug)

    block(original[484],[
      heading('3.7.5 Qwen training data and partitioning'),
      'The initial SFT corpus contains 5,417 training, 251 validation and 487 test examples. It combines public URL samples scored by the deployed detectors, owner-provided security records and authored conversational or security tasks. Targets are rule-authored from visible evidence, not independent expert security verdicts. Source identifiers and construction metadata are retained in the dataset artefacts.',
      'For V2, task-balanced replay limits most training families to 100 records and corrects wording that had conflated supervised classifiers with the separate anomaly model. Reviewed primary-source reference instructions add 242 training and 22 validation examples. The final V2 counts are 2,462 training and 273 validation records; the 487-item legacy test split remains a regression source, not a new unseen dataset.',
      'Prompt uniqueness, message roles, non-empty answers, system-prompt consistency and analyst word budgets are validated before allocating a GPU. Exact release-scenario prompts do not enter V2 training. SSRF and session-reference instruction examples are omitted from the new reference-tuning additions; this is a limited transfer test, since the base model or earlier corpus may already contain those concepts.',
      heading('3.7.6 Supervised low-rank adaptation'),
      'LoRA adapts a pretrained model by learning low-rank update matrices while retaining the base weights (Hu et al., 2021). CyberForge trains text answers against the same non-thinking ChatML form used in serving. Input tokens are masked from the loss; only answer tokens contribute. This is supervised fine-tuning, not reinforcement learning, unsupervised detector fitting or continuous learning from conversations.',
      'The initial NVIDIA L4 run uses two epochs and 678 optimisation steps. V2 resumes the previous adapter at a pinned revision for a targeted 100-step update at a lower learning rate. The pretrained vision components and embeddings are frozen. Table 3.1 records the actual V2 configuration rather than a proposed experiment.',
      cap('Table 3.1: Recorded Qwen V2 refinement configuration (source: train_report.json).'),
      table(['Parameter','Recorded value'],[['Base','Qwen/Qwen3.5-2B; immutable base revision'],['Initial adapter','Previous CyberForge adapter, revision 9fcfd481…'],['Training / validation','2,462 / 273 examples'],['LoRA rank / alpha / dropout','16 / 32 / 0.05'],['Learning rate / steps','0.00002 / 100'],['Batch / accumulation','2 / 8 (effective batch 16)'],['Maximum sequence','1,024 tokens'],['Accelerator','NVIDIA L4 in a separate Hugging Face Job']], [3000,5504]),
      heading('3.7.7 Export, evaluation and controlled promotion'),
      'Figure 3.5 separates offline adaptation from inference. Revision-pinned source and data bundles are uploaded to private repositories; credentials travel through Job secrets. A two-step GPU smoke test precedes full training. Checkpoints and job receipts preserve progress and identify the exact source, model and environment used.',
      *figure('training','Figure 3.5: Qwen supervised adaptation, GGUF export, evaluated release and evidence preservation. The inference Space does not train during a chat request.'),
      'The selected adapter is merged into the pinned base and exported to GGUF, then importance-quantised to Q4_K_M. The llama.cpp revision is matched to the Space runtime, llama-cpp-python 0.3.36. Quantisation changes numerical representation; it is not another supervised training stage. The actual quantised artefact, rather than only the unmerged adapter, is evaluated before release.',
      'Promotion requires both the fixed automatic gate and review of actual answers. Rejected reports remain preserved. The accepted Space configuration pins repository, filename and model revision, then verifies loading and both chat routes. A rollback receipt preserves the previous variable state and source backup. This workflow applies to Qwen; the existing in-Space detector trainer has a different execution and publication path.',
      heading('3.7.8 Reviewed-reference retrieval and constrained decoding'),
      'The editorial library contains 13 short security summaries with primary links from OWASP, MITRE ATT&CK, NIST, OpenSSL and the US Postal Inspection Service. Current-question matching selects at most two references, excluding remembered conversation topics and explicit URL-scan requests. It is bounded local retrieval, not a live web search, CVE feed or reputation lookup.',
      *figure('grounding','Figure 3.6: Runtime grounding. Covered topics use constrained selection of reviewed passages; uncovered requests use ordinary Qwen generation and retain its limitations.'),
      'Initial prompt grounding and keyword checks did not prevent unsupported clauses. The final policy uses a GBNF grammar to restrict covered output to complete reviewed passages, followed by a sentence-support check that retains negation. Analyst alternatives fit 80 words. If incomplete or unsupported wording remains, an explicitly labelled reference response replaces it. The model therefore selects bounded source text rather than freely composing factual claims for these topics.',
      'Responses expose the knowledge revision, primary-reference links and generation_constraint=reviewed_passages. Model-selected passages, fixed reference replacements and ordinary model answers remain distinguishable. The backend preserves this metadata, and the desktop saves it with the conversation. Retrieval, context injection and grammar constraints do not update weights; ordinary requests outside the library can still hallucinate.',
      heading('3.7.9 Release evaluation design and fixed gates'),
      'The original scenario set contains 39 reviewed prompts in analyst and assistant modes (78 cases), frozen before V2 training. After manual review, 26 additional prompts in both modes add 52 cases. The final factual set therefore contains 130 cases, not 182. The extension is author-reviewed rather than an independent blinded benchmark. Eight negative controls test that unrelated or URL-scan inputs do not retrieve security references.',
      'A stratified 240-item sample from the 487 legacy test items measures risk formatting, authored-target agreement, concision, unverified indicators and remembered-host behaviour. Risk agreement applies to 87 items with expected risk labels. For the final comparison, 214 outputs per model are reused only when immutable weights, seed and the entire serialized prompt match and no reference decoding is involved; the 26 changed inputs are generated again. Mixed timing values are excluded from new latency comparisons.',
      cap('Table 3.2: Fixed Qwen release gates (source: release_cases.py; unchanged after results).'),
      table(['Measure','Acceptance condition'],[['Final factual checks','At least 95% in all and additional scenarios'],['Raw core-fact pattern checks','At least 80%; not an independent factual audit'],['Reference replacement','At most 25%'],['Matched harmful patterns','Zero'],['Retrieval / negative controls','All expected matches and no unrelated matches'],['Applicable risk labels','At least 90% authored-target agreement'],['Analyst concision','At least 98% within 80 words'],['Invented remembered hosts','At most 2% on applicable memory items']], [3500,5004]),
      'The final grammar changes the interpretation of a factual pass: it establishes supported extraction from the reviewed library, not unaided model recall. Comparison uses both the previous adapter and V2 with the same serving policy. No precision, recall or URL-detection accuracy is inferred from these language-model checks.'
    ])

    report=json.loads((ROOT/'ml-services/llm_finetune/runs/v2-constrained-review/release-constrained/494483e9a85362b5d0bd596f9040bbc0848c860a/release_report.json').read_text())
    assert report['passed'] and report['models']['candidate']['all_facts']['n']==130
    block(original[587],[
      major('4.10 Qwen fine-tuning and release results'),
      para('4.10.1 Training progression','Heading3'),
      'The recorded initial LoRA run completed 678 steps on NVIDIA L4. V2 continued the saved adapter for 100 targeted steps using the corrected, task-balanced corpus. Table 4.9 reports actual run values. Lower validation loss indicates closer fit to these authored targets; it is not a percentage of correct security answers.',
      cap('Table 4.9: Recorded Qwen training progression (source: initial and V2 train_report.json artefacts).'),
      table(['Measure','Initial SFT','Targeted V2'],[['Training / validation records','5,417 / 251','2,462 / 273'],['Optimisation steps','678 (2 epochs)','100 targeted steps'],['Learning rate','0.0001','0.00002'],['Validation loss before','2.623355','0.136654'],['Validation loss after','0.067666','0.066537'],['Training runtime','2,334 s','412.67 s'],['Accelerator','NVIDIA L4','NVIDIA L4']], [3100,2702,2702]),
      'The two before/after loss pairs use different training/validation compositions and cannot be interpreted as a controlled cross-run improvement percentage. Runtime excludes job setup and export. The final quantised weight revision is 494483e9a85362b5d0bd596f9040bbc0848c860a in the private CyberForge V2 model repository.',
      heading('4.10.2 Rejected candidates and interpretation of the final pass'),
      'The first V2 keyword-based release gate passed, but manual answer review found unsupported claims about CSRF, prepared statements, password managers, cryptojacking and session rotation. It was held. A stricter sentence-verification follow-up found 115/130 raw core-fact pattern matches but required 56/130 reference replacements (43.08%); the additional set required 17/52 replacements (32.69%). Both rates exceed the unchanged 25% ceiling. A passing job status was therefore not treated as acceptance.',
      *figure('quality-results','Figure 4.14: Reference-replacement rate for the same V2 weights: sentence checking alone versus final constrained passage generation. The change is a serving constraint, not another weight-training run.'),
      'The final comparison regenerated all 130 covered cases per model with the exact serving grammar. It passed all eight fixed gate checks. Every final candidate raw/served covered answer matched a permitted reviewed passage. Table 4.10 compares the previous adapter and V2 under this same policy, showing that the perfect covered score is primarily a property of source-constrained generation rather than evidence that V2 independently knows every fact.',
      cap('Table 4.10: Final serving-policy comparison (source: release-constrained/494483e9…/release_report.json).'),
      table(['Measure','Previous adapter','Qwen V2'],[['Covered factual/support cases','130 / 130','130 / 130'],['Additional cases (subset of 130)','52 / 52','52 / 52'],['Correct topic retrieval','130 / 130','130 / 130'],['Reference replacements','0 / 130','0 / 130'],['Matched harmful-answer patterns','0','0'],['Regression target risk agreement','83 / 87 (95.40%)','84 / 87 (96.55%)'],['Applicable analyst word limit','100% within 80 words','100% within 80 words'],['Invented remembered hosts','0 on applicable cases','0 on applicable cases']], [3600,2452,2452]),
      'Each model has 240 regression items; measures apply to their relevant subsets. The V2 risk metric is agreement with authored targets, not detector classification accuracy or probability calibration. Three labels still disagree. The saved outputs also include an uncovered XSS-related recommendation to parameterise inputs, illustrating why unsupported-domain generation still requires scrutiny. Zero matched harmful patterns in covered cases is not a general safety guarantee.',
      heading('4.10.3 Deployed model and actual service responses'),
      'The accepted weights are pinned in Che237/cyberforge. The recorded health response identifies the V2 repository, GGUF filename and exact weight revision, with loaded=true, loading=false and error=null. Space source f79b9e8c… and backend release v53 preserve the reference and engine labels. Uploading subsequent documentation does not change the pinned model weights.',
      *figure('live-response','Figure 4.15: Recorded authenticated MFA-fatigue response from the deployed service, with reviewed-reference provenance. The panel reproduces an actual archived response, not a desktop screenshot or synthetic result.'),
      'The backend ML client used by the desktop route answered CSRF, MFA fatigue and Heartbleed checks against V2, with correct primary-reference identifiers. Observed generation times were 14.906, 14.107 and 20.298 seconds. Three calls are insufficient to estimate mean service latency, tail latency or uptime, and cannot be compared directly with the historical 4.05-second URL pipeline.',
      'The analyst security-chat route returned supported MFA-fatigue text, references, the reviewed_passages constraint and fewer than 80 words. The contextual chat route returned supported CSRF text with preserved provenance and confidence=null, risk_score=null and risk_level=unknown for a general factual question. A greeting followed ordinary model_context generation without a reference match. These are recorded live integration observations, not fabricated dashboard data.',
      major('4.11 Current desktop implementation and verification'),
      'The current Windows client is Tauri 2/Rust with an HTML/CSS/JavaScript renderer. The revised sidebar has 14 destinations; Settings contains additional configuration panels. Table 4.11 maps current functions to their source or verification boundary. The older chapter screenshots remain explicitly historical and are not used to claim the appearance or operating state of this build.',
      cap('Table 4.11: Current desktop workspace and functional scope (source: sidebar, native commands and shared console components).'),
      table(['Area','Implemented functions and evidence boundary'],[['Workspace','Overview, Devices, Agents and AI Assistant; scoped counts, enrolled-device workflows, fixed-template runs and attributed chat.'],['Security','Analyze, Alerts & Incidents, Protection and Reports; source-labelled URL evidence, supported domain actions and deterministic evidence reports. Analyze is not a VM detonation service.'],['Explore','Browser Activity and Threat Intelligence; permitted observations, history/scans and configured intelligence sources. Capture and feed availability remain explicit.'],['Diagnostics','Local runtime, Event stream, Model capabilities and Memory; readiness, freshness and stored context. The diagnostics are distinct from user-facing agent runs.'],['Header / footer / Settings','Shared controls expose actual response states, refresh, filters, request age, backend/stream status, privacy and model readiness; unavailable data are not invented healthy values.'],['Assistant','Backend Qwen default; primary links and engine/grounding metadata persist with conversations. A stored optional token alone does not switch providers.'],['CLI / MCP boundary','Shared Rust operations and a limited grant-scoped stdio adapter exist; full autonomous AI CLI commands and broad MCP tools/transports are not certified complete.']], [2100,6404]),
      cap('Table 4.12: Verification evidence and its limits (sources: release log, test records and build artefact).'),
      table(['Evidence','Observed result','What it establishes'],[['Python contracts / grounding','14 tests passed','Prompt, source, metadata and CPU-stage contracts.'],['Backend targeted checks','29 tests passed','Answer-source forwarding and safe desktop reference rendering.'],['Earlier backend suite','950 tests passed','Earlier complete backend run; not a current detection benchmark.'],['Rust library / executable','Offline check and debug build passed','Windows compilation; not installed cross-platform release acceptance.'],['Focused Chromium fixture','Assistant source/link/layout and restored references passed','Controlled browser behaviour with fixture data, not a signed-in live desktop session.'],['Live deployment / chat','Pinned model loaded; both routes and real ML-client checks passed','Specific recorded endpoints and controlled requests, not long-run uptime or applied protection.']], [2100,2200,4204]),
      'The executable is desktop/src-tauri/target/debug/cyberforge-console.exe. Its SHA-256 is recorded in the release receipt. It was rebuilt, not installed over an existing application. The legacy root pytest shortcut and the older full navigation assertion were not represented as passing; the latter expects ten destinations while the current sidebar has fourteen. No newly measured operating-system action, installer acceptance or mobile parity is claimed.',
      major('4.12 Validity, limitations and summary'),
      'The training targets and security scenarios are authored within the project. The added scenarios were written after manual review, and are not an independently blinded expert test. Legacy outputs are partly reused under exact-input checks. Both models benefit from identical external reference constraints. These factors limit claims about generalisation, causal benefits of V2 weights and comparative latency.',
      'The evidence supports a deployed, revision-pinned Qwen pipeline, bounded reviewed-topic explanations and functioning backend/desktop integration contracts. It does not establish general factual correctness, new URL-detection accuracy, universal browser coverage, calibrated risk probability, complete autonomous CLI/MCP operation, continuous online learning or long-term production reliability. Broader reference coverage, independent evaluation and packaged native acceptance remain the next research and engineering steps.'
    ])
    # Keep the existing alphabetical bibliography and paragraph styles.
    block(original[609],[
      'ggml-org. (2026). GBNF grammar guide [Software documentation]. llama.cpp. https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md',
      'Hu, E. J., Shen, Y., Wallis, P., Allen-Zhu, Z., Li, Y., Wang, S., Wang, L., & Chen, W. (2021). LoRA: Low-rank adaptation of large language models (arXiv:2106.09685). https://arxiv.org/abs/2106.09685',
      'Hugging Face. (2026). Jobs overview [Technical documentation]. https://huggingface.co/docs/hub/en/jobs-overview'
    ])
    block(original[615],[
      'Qwen Team. (2026). Qwen3.5-2B [Model card]. Hugging Face. https://huggingface.co/Qwen/Qwen3.5-2B'
    ])
    block(original[654],[
      major('C.6 Qwen release provenance'),
      'Base revision: Qwen/Qwen3.5-2B@15852e8c16360a2fea060d615a32b45270f8a8fc. Initial adapter: 9fcfd481271b09218de9e1bd0c7e7b224c58dd41. Accepted V2 weights: Che237/cyberforge-qwen3.5-2b-v2-GGUF@494483e9a85362b5d0bd596f9040bbc0848c860a. Knowledge policy: 2026-10-23.3.',
      'Training Job: 6adaa7a3c191903149a77fb1. Final evaluation Job: 6adac192925af0e27d4f9a58. Evaluated source bundle: Che237/cyberforge-llm-sft-v2@ca4729eabf8b1bd02e17e413b7db00b751bcbb85. Final report: release-constrained/494483e9a85362b5d0bd596f9040bbc0848c860a/release_report.json.',
      'Local evidence: ml-services/llm_finetune/V2_RELEASE.md; TRAINING_STATUS.md; MODEL_CARD.md; runs/v2-promotion.json; runs/live-client-final.log; saved raw/served answers and train_report.json. Model/dataset repositories are private. Readers require authorised access to private artefacts; credentials are never included in this dissertation.',
      'The full inference pipeline, not the bare GGUF alone, is the accepted factual-use unit. Rejected keyword and free-generation reports remain available under separate release and release-grounded paths. Full model hashes and archived responses allow results to be inspected without claiming a new experimental run during this document revision.'
    ])
    # The original caption lists are two-column tables, not paragraphs/TOCs.
    # Retain their exact table geometry and cell formatting while refreshing rows.
    short_titles={
      'Figure 3.1':'Current architecture and deployment boundaries','Figure 3.2':'Principal user interactions',
      'Figure 3.3':'Analysis-to-action decision flow','Figure 3.4':'Representative specialist-orchestrator classes',
      'Figure 3.5':'Qwen adaptation and controlled release','Figure 3.6':'Reference-grounded inference',
      'Figure 4.14':'Reference replacement under two serving policies','Figure 4.15':'Recorded live answer and provenance',
      'Table 3.1':'Recorded Qwen V2 refinement configuration','Table 3.2':'Fixed Qwen release gates',
      'Table 3.3':'Retained eight-agent pipeline and final Reporter','Table 4.9':'Recorded Qwen training progression',
      'Table 4.10':'Final serving-policy comparison','Table 4.11':'Current desktop workspace and functional scope',
      'Table 4.12':'Verification evidence and limits'}
    for idx,style in ((146,'TableCaption'),(148,'ImageCaption')):
        index=original[idx];template=copy.deepcopy(index.find('w:tr',NS));captions=[]
        for p in body.findall('w:p',NS):
            if p.find(f'w:pPr/w:pStyle[@w:val="{style}"]',NS) is None:continue
            caption=text(p)
            if ':' not in caption:continue
            number,title=caption.split(':',1);title=short_titles.get(number,title.split(' (')[0].split('. Source:')[0])
            captions.append((number,title.strip()))
        for row in list(index.findall('w:tr',NS)):index.remove(row)
        for number,title in captions:
            row=copy.deepcopy(template)
            for cell,value in zip(row.findall('w:tc',NS),(number,title)):
                paragraphs=cell.findall('w:p',NS);replace(paragraphs[0],value)
                for p in paragraphs[1:]:cell.remove(p)
            index.append(row)
    # Ask Word to refresh the main TOC, caption indexes and page references.
    settings=E.fromstring(files['word/settings.xml'])
    upd=settings.find('w:updateFields',NS)
    if upd is None:upd=E.SubElement(settings,Q('updateFields'))
    upd.set(Q('val'),'true')
    for fc in tree.findall('.//w:fldChar',NS):
        if fc.get(Q('fldCharType'))=='begin':fc.set(Q('dirty'),'true')
    files['word/document.xml']=E.tostring(tree,xml_declaration=True,encoding='UTF-8',standalone=True)
    files['word/settings.xml']=E.tostring(settings,xml_declaration=True,encoding='UTF-8',standalone=True)
    files['word/_rels/document.xml.rels']=E.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
    temporary=OUT/'_thesis-v4-reviewed.docx'
    with ZipFile(temporary,'w',ZIP_DEFLATED) as z:
        for name,content in files.items():z.writestr(name,content)
    # Preservation checks precede replacing the user's named document.
    with ZipFile(BACKUP) as z:
        old=E.fromstring(z.read('word/document.xml'))
        assert [E.tostring(n) for n in old.findall('.//w:sectPr',NS)]==[E.tostring(n) for n in tree.findall('.//w:sectPr',NS)]
        for name in ('word/styles.xml','word/numbering.xml','word/footer1.xml','word/footer2.xml'):
            if name in files:assert files[name]==z.read(name),name
    shutil.copy2(temporary,DOC)
    log={'source_sha256':hashlib.sha256(BACKUP.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(DOC.read_bytes()).hexdigest(),'backup':str(BACKUP.relative_to(ROOT)),'date':'2026-10-23','paragraph_changes':changes,'new_blocks':inserted,'replaced_diagrams':4,'added_figures':4,'layout':'Original section geometry, styles, numbering, headers/footers and historical confusion tables retained.'}
    (OUT/'thesis-v4-revision-log.json').write_text(json.dumps(log,ensure_ascii=False,indent=2),encoding='utf8')
    print('Updated',DOC.name,'with',len(changes),'text replacements and',len(inserted),'new blocks; pre-V4 backup preserved.')


if __name__=='__main__':main()
