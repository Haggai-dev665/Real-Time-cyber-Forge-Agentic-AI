"""Create V5 by editing the actual V3 package, retaining its native typography/effects.

No PowerPoint renderer or new theme is used to rebuild the slides. The original
shape IDs, groups, run properties, embedded fonts, transitions and animation
trees survive unchanged. Only text, evidence chart values and the slide selection
change. Run native validation/export separately with review_defence_v5.ps1.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import posixpath
import re
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / '.vendor'))
from lxml import etree as E

SOURCE = HERE / 'CyberForge - Thesis Defence v3.pptx'
OUT = HERE / 'CyberForge - Thesis Defence v5.pptx'
KEEP = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 18, 20]
NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
}
P, A = NS['p'], NS['a']


def xml(data):
    return E.fromstring(data)


def serial(root):
    return E.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def shape(root, id):
    nodes = root.xpath(f'.//p:sp[p:nvSpPr/p:cNvPr/@id="{id}"]', namespaces=NS)
    assert len(nodes) == 1, id
    return nodes[0]


def replace(root, id, text):
    """Preserve every original paragraph/run and its exact typography properties."""
    sp = shape(root, id)
    paras = sp.findall('p:txBody/a:p', NS)
    lines = text.split('\n')
    assert len(lines) <= len(paras), (id, lines, len(paras))
    for i, para in enumerate(paras):
        runs = para.findall('a:r/a:t', NS)
        new = lines[i] if i < len(lines) else ''
        if not runs:
            if new:
                # Blank paragraphs retain their existing paragraph/end-run style.
                r = E.Element(f'{{{A}}}r')
                end = para.find('a:endParaRPr', NS)
                if end is not None:
                    prop = deepcopy(end); prop.tag = f'{{{A}}}rPr'; r.append(prop)
                E.SubElement(r, f'{{{A}}}t').text = new
                para.insert(len(para) - (1 if end is not None else 0), r)
            continue
        # Keep original style boundaries for mixed-colour runs, at word boundaries.
        lengths = [len(t.text or '') for t in runs]
        total = sum(lengths) or 1
        start = 0
        accumulated = 0
        for j, node in enumerate(runs):
            accumulated += lengths[j]
            if j == len(runs) - 1:
                stop = len(new)
            else:
                target = round(len(new) * accumulated / total)
                spaces = [m.end() for m in re.finditer(r'\s+', new) if m.end() >= start]
                stop = min(spaces, key=lambda n: abs(n - target)) if spaces else start
            node.text = new[start:stop]
            start = stop


def change_text(root, old, new):
    nodes = root.xpath('.//p:sp[p:txBody]', namespaces=NS)
    matches = [n for n in nodes if '\n'.join(''.join(p.itertext(f'{{{A}}}t')) for p in n.findall('p:txBody/a:p', NS)) == old]
    assert len(matches) == 1, (old, len(matches))
    id = matches[0].find('p:nvSpPr/p:cNvPr', NS).get('id')
    replace(root, id, new)


def set_bar(root, foreground_id, track_id, fraction):
    """Change the data geometry; keep the original wipe animation and shape ID."""
    track = shape(root, track_id).find('p:spPr/a:xfrm/a:ext', NS)
    fg = shape(root, foreground_id).find('p:spPr/a:xfrm/a:ext', NS)
    assert track is not None and fg is not None
    fg.set('cx', str(round(int(track.get('cx')) * fraction)))


NOTES = {
1: "Good morning. This is CyberForge, a real-time agentic AI system for web threat detection and user protection, supervised by Professor Onabid Mathias Akong. This fifteen-slide defence follows the requested eight-part guide. The dissertation's June 2026 title information is retained; implementation and training evidence has been updated through 23 October 2026. The exact V3 template, fonts and native animation sequences are retained.",
2: "The scope is URL and web-context security. Specialist analyses supply evidence to an aggregator and Reporter; this is not a formal consensus protocol and does not guarantee protection. Current implementation adds a fine-tuned Qwen assistant, with reviewed source links on covered security questions. Kernel, firmware and enterprise lateral movement are outside the evaluated scope.",
3: "The first problem is false alarms and their effect on trust. The early development offset is a historical debugging example, not a current defect. The second problem is inspectable explanations: a probability alone does not show sources or evidence. The third is integrating detection, state, failures and cross-device workflows. This is the motivation for this project, not a claim that no competing open-source system exists.",
4: "The general question and four specific questions are retained from the thesis: decomposition, integration, aggregation, and historical context. A smallest-agent-set comparison and a controlled memory ablation have not been completed, so those research questions are not claimed to be conclusively answered.",
5: "The general objective is to design, implement and evaluate CyberForge end to end. The specific objectives map to the four research questions. Implementation evidence does not by itself prove optimality or superiority. CLI and MCP are scoped interfaces, not a certified complete autonomous AI CLI or an unrestricted agent server.",
6: "This is V3's animated literature timeline. Rules and URL features lead to learned representations and agent workflows. Hu et al. (2021), LoRA, is added to explain the parameter-efficient Qwen update: https://arxiv.org/abs/2106.09685. Devlin et al. (2019) supports the pretrained BERT category; Yao et al. (2023) is conceptual agent-workflow background. CyberForge uses a staged DAG, not a claim to implement every ReAct feature. The research gap is inspectable integration with transparent failure and source states.",
8: "Four layers remain: client, native/backend control, inference, and persistence/intelligence. The desktop calls authenticated Node/Express routes, which call the Hugging Face FastAPI Space. Covered factual chat uses the pinned Qwen V2 GGUF plus the current-question reference retriever and constrained passage selection. Training runs in separate Hugging Face Jobs on an L4; the inference Space remains cpu-basic. MongoDB, selected Appwrite integration, local storage and AlienVault OTX have distinct roles. This architecture diagram does not claim all clients have equivalent acceptance coverage.",
9: "Eight specialist analyses plus a Reporter retain the three-stage DAG: URL classification, domain heuristic, page retrieval and memory; then IOC extraction, behaviour rules and MITRE mapping; then threat intelligence enrichment. The current ReportAgent uses a weighted evidence sum, not the thesis's historical 0.6 mean plus 0.4 maximum formula. Missing services and coverage are explicit. The Qwen assistant route is separate from the detector pipeline; training the chat model is not evidence of better URL classification.",
10: "Materials and current desktop state: Tauri 2/Rust with HTML/CSS/JavaScript, Node.js 24/Express and FastAPI; llama-cpp-python 0.3.36 serves Q4_K_M. Fourteen sidebar destinations are grouped as Workspace (Overview, Devices, Agents, AI Assistant), Security (Analyze, Alerts & Incidents, Protection, Reports), Explore (Browser Activity, Threat Intelligence), and Diagnostics (Local runtime, Event stream, Model capabilities, Memory), with separate settings panels. Header/footer controls use real backend/session/stream/model state, including unavailable and unknown states. Qwen is the default authenticated backend chat provider; optional direct DeepSeek requires an explicit environment setting. References and engine labels persist in saved conversations. CLI/MCP expose limited shared Rust operations and grant-scoped stdio tools. The installed application was not replaced and a signed-in native desktop acceptance session was not driven.",
12: "The diagram separates four learning categories. Three supervised HistGradientBoosting URL classifiers cover phishing, malware-serving URLs and web attack payloads. A benign-only IsolationForest supplies anomaly signals. External pretrained BERT is not fine-tuned in this work. Qwen3.5-2B has supervised answer-token LoRA adaptation; rules, retrieval and memory do not update weights and there is no reinforcement learning. Initial SFT used 5,417 train / 251 validation / 487 test examples, two epochs and 678 L4 steps; validation loss was 2.623355 to 0.067666. V2 starts from that adapter and uses 2,462 train / 273 validation / 487 retained test examples, including balanced replay and reviewed reference instructions. The V2 recipe is rank 16, alpha 32, dropout 0.05, learning rate 0.00002, microbatch 2 with accumulation 8 (effective 16), max sequence 1,024 and 100 L4 steps. Only answer tokens contribute to the objective; base, vision and embedding weights remain frozen. Training took 412.6691 seconds, excluding environment setup and export. Adapter merge and Q4_K_M GGUF export are followed by evaluation of the actual quantized artifact. The different datasets mean the initial and V2 loss pairs are not a controlled cross-run accuracy comparison. Sources: ml-services/llm_finetune/V2_RELEASE.md, TRAINING_STATUS.md; Hugging Face job 6adaa7a3c191903149a77fb1; pinned base Qwen/Qwen3.5-2B@15852e8c16360a2fea060d615a32b45270f8a8fc.",
13: "The final factual suite has 39 original questions in two modes (78) plus 26 additional questions in two modes (52), making 130 cases. The 52 additional cases are included in the 130, not a separate total to add again. Eight negative retrieval controls check that irrelevant memories and URL scans do not trigger factual references. Regression uses 240 legacy items per model, with only 87 eligible risk-label items. The original 487-item test split is retained; the release comparison evaluates a 240-item subset. Thresholds were fixed, and actual answers were reviewed after automated checks. The first keyword gate passed but manual review rejected unsupported clauses. A whole-sentence guard follow-up then needed 56/130 reference replacements (43.08%), exceeding the unchanged 25% ceiling. The final policy 2026-10-23.3 retrieves up to two current-question references from a thirteen-topic reviewed primary-source library, then uses GBNF decoding to select reviewed full or concise passages. This serving-policy change is separate from the completed weight update. Both comparison models receive the same constraint. These are author-reviewed open-book tests, not an independent blinded benchmark. Sources: V2_RELEASE.md; final job https://huggingface.co/jobs/Che237/6adac192925af0e27d4f9a58; grammar documentation https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md.",
14: "V2 training loss fell from 0.1366536319 to 0.0665373579 after 100 steps in 412.6691 training seconds. Loss measures fit to supplied answer targets, not factual accuracy. Final serving-policy comparison: BOTH previous and V2 adapters achieved 130/130 covered support/core-fact checks and correct retrieval, with 0/130 explicit reference substitutions and zero matched harmful-answer patterns. Thus the constrained factual score cannot be attributed to fine-tuning alone. Risk-label agreement was 83/87 (95.40%) for the previous adapter and 84/87 (96.55%) for V2: one additional agreed label, with three V2 disagreements remaining. All eight fixed acceptance checks passed; applicable analyst answers met the 80-word budget and applicable memory checks invented no hosts. Each model had 240 regression items. Of these, 214 outputs could be reused only where immutable weights, seed and the entire serialized prompt matched with no reference decoding; 26 changed inputs were regenerated. Mixed timings are not a new latency benchmark. The reviewed library has thirteen topics; uncovered questions use ordinary generation and can still hallucinate. The legacy uncovered XSS recommendation about parameterisation remains a known issue. The historical thesis URL set gave 284/300 correct (94.7%), TP137/TN147/FP3/FN13, mean4.05s; those raw logs were not reproduced and these are not current model results. Sources: V2_RELEASE.md and final constrained release report. Candidate weights Che237/cyberforge-qwen3.5-2b-v2-GGUF@494483e9a85362b5d0bd596f9040bbc0848c860a.",
15: "These bars show pass counts within different verification suites; they do not estimate end-user accuracy or prove all desktop workflows. Fourteen Python grounding/contract checks and twenty-nine focused backend/source/rendering checks passed; the earlier full backend suite passed950. Three real backend ML-client calls (CSRF, MFA fatigue, Heartbleed) passed against the pinned V2; observed generation times14.906,14.107,20.298seconds are just three observations, not a latency SLA. Both /api/v2/security-chat and /api/v2/chat passed live provenance checks. General questions correctly return confidence/risk_score null and risk_level unknown. Space /health showed the pinned model loaded with loading false/error null; Space source f79b9e8cd3c2f0fb98851789ca1124c3ce4ee930 and Heroku v53 commit a89fc37f2d327c68346ad1603ebfe39e4e317b09. This records the saved release checks, not a new live availability probe today. Rust offline check/build and the focused Chromium assistant fixture passed; the old full-navigation assertion is stale and not claimed passing. Debug desktop build is available; installer replacement and a signed-in native desktop acceptance session remain undone. CLI and grant-scoped MCP are limited, not a completed unrestricted autonomous AI product.",
18: "The contribution is an integrated evidence-labelled web-security workflow and a fine-tuned Qwen assistant with source-constrained covered answers. The old detector benchmark is distinct: historical284/300 correct, not re-run here; 4.05seconds missed a strict4.00second warm target. Current covered factual checks130/130 come from reviewed passages and grammar under both models, not general model accuracy. V2 risk agreement84/87 differs by only one item from the previous adapter, without an independent significance claim. The remaining work is independent blind evaluation, ablations, broader source coverage, uncovered-answer correction, and signed-in native desktop/installer acceptance. No claim of universal protection, complete autonomous CLI/MCP, or production-wide reliability is made.",
20: "Thank you. Questions and discussion. V3's original animated references roll and template/photo credits are retained. Added technical references include Hu et al.(2021), LoRA; the Qwen3.5-2B model card; Hugging Face Jobs documentation; and llama.cpp GBNF grammars. Local evidence is ml-services/llm_finetune/V2_RELEASE.md, TRAINING_STATUS.md and MODEL_CARD.md. This V5 uses the original V3 embedded Oswald/Titillium Web fonts, rich animation timelines and Morph transitions. Full immutable revisions and evaluation caveats are in these notes and the release records.",
}


def main():
    with ZipFile(SOURCE) as z:
        files = {n: z.read(n) for n in z.namelist()}
    original = dict(files)
    slides = {n: xml(files[f'ppt/slides/slide{n}.xml']) for n in KEEP}

    def update(n, values):
        for id, value in values.items():
            replace(slides[n], id, value)

    # Earlier guide sections keep the exact V3 layouts; remove overclaims.
    for sp in slides[2].xpath('.//p:sp[p:txBody]', namespaces=NS):
        paras = [''.join(p.itertext(f'{{{A}}}t')) for p in sp.findall('p:txBody/a:p', NS)]
        if paras and paras[0] == 'FROM ONE MODEL TO AGENTS':
            replace(slides[2], sp.find('p:nvSpPr/p:cNvPr', NS).get('id'),
                    'FROM ONE MODEL TO AGENTS\nSpecialist detection, extraction and reporting stages combine evidence into an explained verdict (Yao et al., 2023).')
        if sp.find('p:nvSpPr/p:cNvPr', NS).get('name') == 'Study body':
            replace(slides[2], sp.find('p:nvSpPr/p:cNvPr', NS).get('id'),
                    'An agent-based URL security system with desktop workflows and a fine-tuned Qwen assistant. Specialist analyses inspect the URL, domain, page behaviour and threat intelligence, then combine evidence into a labelled verdict. Covered chat answers retain reviewed source links.')
    for sp in slides[3].xpath('.//p:sp[p:txBody]', namespaces=NS):
        text = ''.join(sp.itertext(f'{{{A}}}t'))
        id = sp.find('p:nvSpPr/p:cNvPr', NS).get('id')
        if text == 'NO OPEN, CONNECTED SYSTEM':
            replace(slides[3], id, 'FRAGMENTED WORKFLOWS')
        if text.startswith('No widely deployed open system'):
            replace(slides[3], id, 'Detection, browsing context and explanations often live in separate tools. CyberForge needs to connect them, preserve evidence and expose unavailable services without inventing healthy results.')

    # The last two timeline entries are updated without altering the scrolling group.
    # Replace Park's memory entry with LoRA and put it before ReAct chronologically.
    timeline = [g for g in slides[6].xpath('.//p:grpSp', namespaces=NS)
                if g.find('p:nvGrpSpPr/p:cNvPr', NS).get('name', '').startswith('Timeline strip')][0]
    timeline_text = timeline.xpath('.//p:sp[p:txBody]', namespaces=NS)
    texts = [''.join(s.itertext(f'{{{A}}}t')) for s in timeline_text]
    for sp, old in zip(timeline_text, texts):
        id = sp.find('p:nvSpPr/p:cNvPr', NS).get('id')
        replacements = {
            '2023': None,
            'YAO ET AL.': 'HU ET AL.',
            'ReAct: reason, act, observe, repeat — the loop behind agents.': 'LoRA adapts low-rank matrices while keeping the base model frozen.',
            'PARK ET AL.': 'YAO ET AL.',
            'Generative Agents: memory keeps agents consistent over time.': 'ReAct links reasoning, actions and observations in language-model workflows.',
        }
        if old in replacements and replacements[old] is not None:
            replace(slides[6], id, replacements[old])
    # Source timeline has ten Year text boxes, the ninth belongs to LoRA.
    years = [s for s in timeline_text if s.find('p:nvSpPr/p:cNvPr', NS).get('name') == 'Year']
    replace(slides[6], years[8].find('p:nvSpPr/p:cNvPr', NS).get('id'), '2021')
    # Remove '1 of 2' now that the review is one slide.
    update(6, {11: '05  ·  BRIEF LITERATURE REVIEW'})

    # Methods 1/5: architecture. Preserve its staged animated vector diagram.
    update(8, {13: 'Authenticated clients, inference and separate training jobs',
               14: 'Thesis §3.2; §3.7.5–3.7.9; ml-services/llm_finetune/V2_RELEASE.md'})
    for old, new in [
        ('Tauri 2 desktop · React Native/Expo companion · scoped Rust CLI · grant-controlled MCP tools',
         'Tauri 2 desktop · companion client · scoped Rust CLI and grant-controlled MCP tools'),
        ('FastAPI on Hugging Face Spaces: trained URL models, BERT, DGA rules, Qwen explanations, versioned contracts',
         'FastAPI Space: URL models, BERT, rules and Qwen V2 GGUF · L4 training in separate HF Jobs'),
        ('LABELLED RESULT\nwith coverage and failures', 'LABELLED RESULT\nwith sources, coverage and failures'),
    ]:
        change_text(slides[8], old, new)

    # Methods 2/5: keep the V3 animated DAG, correct its historical formula.
    for sp in slides[9].xpath('.//p:sp[p:txBody]', namespaces=NS):
        id = sp.find('p:nvSpPr/p:cNvPr', NS).get('id')
        if sp.find('p:nvSpPr/p:cNvPr', NS).get('name') == 'Formula text':
            replace(slides[9], id, 'Current aggregation   Weighted evidence sum in ReportAgent; coverage and service failures stay explicit.')
    update(9, {14: 'Thesis §3.8; backend ReportAgent implementation; Qwen chat is a separate workflow'})

    # Methods 3/5: current desktop and materials, in V3's four-card composition.
    update(10, {
        12: 'DESKTOP & MATERIALS',
        13: 'Current application, serving stack and training hardware',
        14: 'Thesis §3.6; §4.11; V2_RELEASE.md (recorded verification, 23 October 2026)',
        19: 'DESKTOP APPLICATION', 20: 'TAURI 2 / RUST',
        21: '14 sidebar destinations: Workspace, Security, Explore and Diagnostics. Header/footer controls use real backend, session, stream and model state.',
        25: 'ASSISTANT EXPERIENCE', 26: 'QWEN + SOURCE LINKS',
        27: 'Authenticated backend chat by default. Engine labels and reviewed sources persist with conversations; unknown risk stays unknown.',
        31: 'SERVING STACK', 32: 'FASTAPI ON HF SPACES',
        33: 'Node.js 24 / Express backend · llama-cpp-python 0.3.36 · Q4_K_M GGUF · scikit-learn URL models · external BERT and OTX.',
        37: 'VERIFIED SCOPE', 38: 'SOURCE & DEBUG BUILD',
        39: 'Rust build and focused assistant browser check passed. Signed-in native acceptance and installer replacement remain. CLI/MCP operations are scoped.',
        43: 'Hardware   NVIDIA L4 for separate training Jobs; cpu-basic Space for inference. Training and serving are isolated.',
    })

    # Methods 4/5: five phases are now the actual Qwen process, not only URL training.
    update(12, {
        12: 'QWEN FINE-TUNING',
        13: 'Supervised answer-token LoRA, followed by a separate serving policy',
        14: 'Thesis §3.7.5–3.7.9; §4.10; V2_RELEASE.md; Hu et al. (2021), LoRA',
        19: 'SUPERVISED URL MODELS', 20: 'THREE CLASSIFIERS',
        21: 'Gradient-boosted phishing, malware-URL and web-attack classifiers. Their training is separate from Qwen.',
        25: 'UNSUPERVISED', 26: 'ANOMALY MODEL',
        27: 'Benign-only IsolationForest supplies anomaly signals. External BERT is pretrained; it was not fine-tuned here.',
        31: 'SUPERVISED LANGUAGE MODEL', 32: 'QWEN3.5-2B + LORA',
        33: 'Rank 16 · LR 0.00002 · effective batch 16 · 100 L4 steps. Answer tokens only; base weights stay frozen.',
        37: 'INFERENCE POLICY', 38: 'RETRIEVAL + GBNF',
        39: '13 reviewed topics; covered answers select source passages. Retrieval, memory and grammar do not train weights. No RL.',
        44: 'CURATE & SPLIT', 45: 'V2: 2,462 train / 273 validation; 487 legacy test retained.',
        50: 'ADAPT', 51: 'Continue prior SFT adapter; masked inputs; LoRA answer-token objective.',
        56: 'MERGE & EXPORT', 57: 'Pinned base + adapter; Q4_K_M GGUF; evaluate the serving artifact.',
        62: 'TEST & REVIEW', 63: 'Reject unsafe claims; fixed gates; reviewed-passage decoding for covered topics.',
        68: 'PIN & VERIFY', 69: 'Promote immutable weights; Space health, both chat routes and backend checks.',
    })

    # Methods 5/5: original animated dataset bars now count evaluation cases.
    update(13, {
        13: 'Compare both adapters under the same reference-constrained policy',
        14: 'Thesis §3.7.9; §4.10; final constrained evaluation job 6adac192925af0e27d4f9a58',
        19: '130', 20: 'COVERED CHAT CASES',
        22: 'Original: 39 × 2 modes', 25: '78',
        26: 'Added: 26 × 2 modes', 29: '52',
        30: 'Negative retrieval controls', 33: '8',
        34: '78 + 52 = 130; the 8 controls are separate.',
        37: 'REGRESSION COMPARISON',
        38: '240 legacy items per model; 87 have expected risk labels. Previous and V2 use the same serving constraint.',
        42: 'FIXED ACCEPTANCE GATES',
        43: 'Factual/support checks, retrieval, harmful patterns, ≤25% fallback, risk agreement, concision and memory checks.',
        47: 'MANUAL REVIEW MATTERS',
        48: 'Initial keyword pass rejected for unsafe clauses. Sentence guard needed 56/130 fallbacks (43.08%): held.',
        52: 'FINAL SERVING CONSTRAINT',
        53: 'GBNF selects reviewed passages for covered topics. This is an open-book system test, not unaided recall.',
    })
    # V3's dataset tracks themselves represent counts. Keep that convention:
    # scale both the track and fill on the same max78 axis, with labels after each.
    for fg, track, frac in [(24,23,1), (28,27,52/78), (32,31,8/78)]:
        ext = shape(slides[13],track).find('p:spPr/a:xfrm/a:ext',NS)
        ext.set('cx',str(round(3.9*frac*914400)))
        set_bar(slides[13], fg, track, 1)
    # V3's 120pt number had a short text frame. Fit its full font bounds without
    # altering the font, its size, the entrance effect or the surrounding layout.
    big = shape(slides[13],19).find('p:spPr/a:xfrm',NS)
    big.find('a:off',NS).set('y',str(round(2.85*914400)))
    big.find('a:ext',NS).set('cy',str(round(2.05*914400)))
    # Reposition the value labels after the actual data bars.
    for id, fraction in [(25,1), (29,52/78), (33,8/78)]:
        off = shape(slides[13],id).find('p:spPr/a:xfrm/a:off',NS)
        off.set('x',str(round((1.1 + .55 + 3.9*fraction)*914400)))

    # Results 1/2: actual training outcomes + bounded release checks.
    update(14, {
        12: 'FINE-TUNING & QUALITY',
        13: 'Loss measures target fit; factual checks measure the constrained system',
        14: 'V2_RELEASE.md; 130/130 also achieved by previous adapter with the same constraint; not general accuracy',
        19: '130/130', 20: 'COVERED CHECKS', 21: 'reviewed-passage output',
        25: '84/87', 26: 'RISK AGREEMENT', 27: '96.55%; three disagree',
        31: '0/130', 32: 'FALLBACKS', 33: 'explicit substitutions',
        37: '8/8', 38: 'RELEASE GATES', 39: 'fixed checks passed',
        43: '240', 44: 'REGRESSION', 45: 'legacy items per model',
        49: '13', 50: 'SOURCE TOPICS', 51: 'reviewed reference library',
        53: 'V2 TRAINING OUTCOMES',
        56: '0.1367', 57: 'Validation loss: before',
        61: '0.0665', 62: 'Validation loss: after',
        66: '100', 67: 'L4 training steps',
        71: '412.67 s', 72: 'Training time only',
        74: 'Target fit', 75: 'V2 update',
        76: 'SAME SERVING POLICY · PREVIOUS VS V2',
        77: 'Previous risk agreement    83 / 87', 80: '95.40%',
        81: 'V2 risk agreement    84 / 87', 84: '96.55%',
        85: 'Covered support checks    both 130 / 130', 88: '100%',
    })
    for fg, track, fraction in [(79,78,83/87), (83,82,84/87), (87,86,1)]:
        set_bar(slides[14],fg,track,fraction)

    # Results 2/2: actual verification suites; no invented current uptime figures.
    update(15, {
        12: 'INTEGRATION VERIFICATION',
        13: 'Saved release checks against the pinned model, backend and desktop source',
        14: 'V2_RELEASE.md; pass counts are scoped checks, not user accuracy or a signed-in native acceptance test',
        16: 'PYTHON GROUNDING CONTRACTS', 19: '14 / 14',
        20: 'FOCUSED SOURCE / UI CHECKS', 23: '29 / 29',
        24: 'EARLIER BACKEND SUITE', 27: '950 / 950',
        28: 'REAL BACKEND ML-CLIENT CALLS', 31: '3 / 3',
        34: 'BACKEND DEPLOYED', 35: 'v53',
        36: 'V2 GGUF revision pinned in the Space.\nBoth chat routes preserve reviewed source metadata.',
        38: 'CURRENT DESKTOP STATE & REMAINING WORK',
        41: '14 PAGES', 42: 'SIDEBAR & CONTROLS',
        43: 'Real session, model and stream state',
        47: 'PASSED', 48: 'ASSISTANT SOURCES',
        49: 'Focused browser fixture; saved links persist',
        53: 'SCOPED', 54: 'CLI & MCP',
        55: 'Shared Rust actions and grant-controlled tools',
        59: 'PENDING', 60: 'NATIVE ACCEPTANCE',
        61: 'Signed-in desktop session and installer update',
    })
    for fg, track in [(18,17),(22,21),(26,25),(30,29)]:
        set_bar(slides[15],fg,track,1)

    # Conclusion: show both time horizons clearly; preserve V3 photo/cards/effects.
    update(18, {
        13: 'An integrated prototype with bounded evidence and clear remaining work',
        14: 'Thesis Chapter 5; §4.10–4.12; historical URL results are not a fresh evaluation',
        19: '94.7%', 20: 'Historical URL accuracy; not re-run',
        24: '130/130', 25: 'Covered source-constrained checks',
        29: '84/87', 30: 'V2 risk-label agreement',
        34: '14', 35: 'Current sidebar destinations',
        40: 'CONTRIBUTION',
        41: 'A coordinated URL-security workflow and a fine-tuned Qwen assistant with inspectable evidence, source labels and persistent references.',
        46: 'EVIDENCE LIMITS',
        47: 'Covered answers are reference-constrained. Uncovered replies can hallucinate. No blind benchmark or proven superiority. The historical 4.05 s mean missed the 4 s target.',
        52: 'NEXT STEPS',
        53: 'Independent evaluation and ablations; broader reviewed sources; fix uncovered-answer errors; complete signed-in native acceptance and installer validation.',
    })

    # Update the existing reference roll, preserving its original duration and style.
    ref = shape(slides[20],10)
    paras = ref.findall('p:txBody/a:p',NS)
    reftext = [''.join(p.itertext(f'{{{A}}}t')) for p in paras]
    replacements = {
        'Brown et al. (2020) — few-shot language models': 'Hu et al. (2021) — LoRA (arXiv:2106.09685)',
        'Cockburn (2001) — Writing effective use cases': 'Qwen Team — Qwen3.5-2B model card',
        'Egele et al. (2012) — dynamic malware analysis': 'Hugging Face — Jobs documentation',
        'Willems et al. (2007) — CWSandbox': 'llama.cpp — GBNF grammars',
    }
    replace(slides[20],10,'\n'.join(replacements.get(t,t) for t in reftext))
    credits = shape(slides[20],9)
    lines = [''.join(p.itertext(f'{{{A}}}t')) for p in credits.findall('p:txBody/a:p',NS)]
    lines[-1] = 'V5: V3 template, fonts and animations retained. Evidence: V2_RELEASE.md, 23 October 2026.'
    replace(slides[20],9,'\n'.join(lines))

    # Page labels and guide parts, with exact V3 run formatting.
    method_nums = {8:1,9:2,10:3,12:4,13:5}
    for page,n in enumerate(KEEP,1):
        root = slides[n]
        for sp in root.xpath('.//p:sp[p:txBody]', namespaces=NS):
            cp=sp.find('p:nvSpPr/p:cNvPr',NS)
            if cp.get('name') == 'Page':
                replace(root,cp.get('id'),f'{page:02}')
            if cp.get('name','').startswith('Kicker'):
                if n in method_nums:
                    replace(root,cp.get('id'),f'06  ·  METHODS AND MATERIALS USED  ·  {method_nums[n]} OF 5')
                if n in (14,15):
                    replace(root,cp.get('id'),f'07  ·  RESULTS  ·  {1 if n==14 else 2} OF 2')
        files[f'ppt/slides/slide{n}.xml'] = serial(root)
        # Notes are updated in place; original note master/geometry survives.
        relname=f'ppt/slides/_rels/slide{n}.xml.rels'
        rels=xml(files[relname])
        noteref=next(r for r in rels if r.get('Type','').endswith('/notesSlide'))
        notepath=posixpath.normpath(posixpath.join('ppt/slides',noteref.get('Target')))
        nr=xml(files[notepath])
        body=next(s for s in nr.findall('.//p:sp',NS)
                  if s.find('p:nvSpPr/p:nvPr/p:ph',NS) is not None
                  and s.find('p:nvSpPr/p:nvPr/p:ph',NS).get('type')=='body')
        tx=body.find('p:txBody',NS)
        for child in list(tx):
            if child.tag==f'{{{A}}}p':tx.remove(child)
        para=E.SubElement(tx,f'{{{A}}}p');run=E.SubElement(para,f'{{{A}}}r')
        E.SubElement(run,f'{{{A}}}t').text=NOTES[n]
        files[notepath]=serial(nr)

    # Presentation order selects exactly fifteen V3 slides. Remove dropped roots
    # from the relationship graph so obsolete result slides are not in the package.
    pres=xml(files['ppt/presentation.xml'])
    rels=xml(files['ppt/_rels/presentation.xml.rels'])
    selected=[]
    lst=pres.find('p:sldIdLst',NS)
    for i,node in enumerate(list(lst),1):
        if i not in KEEP:
            rid=node.get(f'{{{NS["r"]}}}id');lst.remove(node)
            r=next(r for r in rels if r.get('Id')==rid);rels.remove(r)
        else:selected.append(node.get('id'))
    for sections in pres.xpath('.//*[local-name()="sectionLst"]'):
        for s in list(sections):
            for ids in list(s):
                for id in list(ids):
                    if id.get('id') not in selected:ids.remove(id)
            if not any(c.get('id') in selected for c in s.iter()):sections.remove(s)
    files['ppt/presentation.xml']=serial(pres)
    files['ppt/_rels/presentation.xml.rels']=serial(rels)
    app=xml(files['docProps/app.xml'])
    for e in app.iter():
        if E.QName(e).localname=='Slides':e.text=str(len(KEEP))
    files['docProps/app.xml']=serial(app)
    core=xml(files['docProps/core.xml'])
    for e in core:
        local=E.QName(e).localname
        if local=='title':e.text='CyberForge — Thesis Defence V5 (V3 template, verified Qwen fine-tuning)'
        if local=='modified':e.text=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    files['docProps/core.xml']=serial(core)

    # Keep only relationship-reachable parts, including all embedded font files.
    reachable={'[Content_Types].xml','_rels/.rels'}
    pending=['']
    while pending:
        part=pending.pop()
        rp=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels') if part else '_rels/.rels'
        if rp not in files:continue
        reachable.add(rp)
        for rel in xml(files[rp]):
            if rel.get('TargetMode')=='External':continue
            target=rel.get('Target')
            dest=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
            assert dest in files,(rp,dest)
            if dest not in reachable:
                reachable.add(dest);pending.append(dest)
    ct=xml(files['[Content_Types].xml'])
    for child in list(ct):
        if child.tag.endswith('Override') and child.get('PartName').lstrip('/') not in reachable:
            ct.remove(child)
    files['[Content_Types].xml']=serial(ct)
    with ZipFile(OUT,'w',ZIP_DEFLATED) as z:
        for name in sorted(reachable):z.writestr(name,files[name])

    report={'source':SOURCE.name,'source_sha256':sha(SOURCE.read_bytes()),
            'output':OUT.name,'output_sha256':sha(OUT.read_bytes()),
            'slides':len(KEEP),'fonts':['Oswald','Titillium Web'],
            'embedded_fonts_unchanged':True,'native_effects_unchanged':True,'details':[]}
    for n in KEEP:
        before=xml(original[f'ppt/slides/slide{n}.xml'])
        after=slides[n]
        b=before.find('p:timing',NS);a=after.find('p:timing',NS)
        assert E.tostring(b,method='c14n')==E.tostring(a,method='c14n'),('Animation changed',n)
        # Includes native Morph in AlternateContent; compare every non-text/non-data tree.
        transitions=lambda r:[E.tostring(t,method='c14n') for t in r.iter() if E.QName(t).localname=='transition']
        assert transitions(before)==transitions(after),('Transition changed',n)
        # Assert every original run/paragraph property survived identically.
        styles=lambda r:[E.tostring(e,method='c14n') for e in r.iter() if e.tag in (f'{{{A}}}rPr',f'{{{A}}}pPr',f'{{{A}}}endParaRPr')]
        assert styles(before)==styles(after),('Typography changed',n)
        report['details'].append({'slide':KEEP.index(n)+1,'v3_source_slide':n,'exact_animation_tree':True,'exact_run_styles':True,
                                  'native_effects':len(after.findall('.//p:cTn[@presetClass]',NS))})
    for name,data in original.items():
        if name.startswith('ppt/fonts/'):
            assert name in reachable and files[name]==data,name
    (HERE/'validation-v5-package.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    (HERE/'speaker-notes-v5.json').write_text(json.dumps([{'slide':i+1,'v3_source':n,'notes':NOTES[n]} for i,n in enumerate(KEEP)],indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
