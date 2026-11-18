"""Create V10 from V9: slides 13-16 brought up to date with the live model.

V9 is left untouched (it may be open in PowerPoint). Only text, one bar width
and the speaker notes of slides 13-16 change, so fonts, layout and animations
are V9's.

Evidence (all re-measured or re-read on 2026-11-18, saved in the repo):
  * Live assistant: ml-services/eval/assistant_eval.mjs with assistant_cases.json
    (33 questions x 2 runs) -> results/assistant-2026-11-18T22-43-58.json; every
    answer reviewed in the .review.md next to it.
  * Live ML features: backend/scripts/check-ml-integration.js ->
    results/integration-2026-11-18.txt (9/9).
  * Backend gate: npm run validate:updates (628 + 364 = 992 tests passed).
  * Release grounding contracts (Oct-23 policy): python -m unittest test_grounding
    test_contracts in ml-services/llm_finetune -> 10 of 14 pass against today's code.
  * Desktop browser check: desktop/scripts/check-navigation.cjs passed, 20 pages.
  * URL models in service (trained 2026-10-13, confirmed by the Space's /health):
    holdout in each model's metadata.json in Che237/cyberforge-models
    (URLs from sites not in the training rows).
  * Heroku release v55 (2026-11-18).

Run review_defence_v10.ps1 for the native render.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE / '.vendor'))
from lxml import etree as E

SOURCE = HERE / 'CyberForge - Thesis Defence v9.pptx'
OUT = HERE / 'CyberForge - Thesis Defence v10.pptx'
NOTES_IN = HERE / 'CyberForge - Thesis Defence v9 - Speaker notes.md'
NOTES_OUT = HERE / 'CyberForge - Thesis Defence v10 - Speaker notes.md'
EVAL = ROOT / 'ml-services/eval/results/assistant-2026-11-18T22-43-58.json'
INTEGRATION = ROOT / 'ml-services/eval/results/integration-2026-11-18.txt'
NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
A = NS['a']

# ── the measurements, checked against the saved results below ──
LIVE = dict(cases=66, own=57, answered=66, covered=50, retrieval=44, median_s='5.9', thinking_s='4.5')
REVIEW = dict(correct=58, covered=46, uncovered='7/10', followup='3/4')   # from the .review.md
PHISH = dict(acc='86.5%', n='71,691', precision='95.2%', recall='67.7%', fpr='2.1%', auc='0.956')


def check_evidence():
    data = json.loads(EVAL.read_text(encoding='utf-8'))
    s, meta = data['summary']['all'], data['meta']
    assert meta['model']['revision'].startswith('494483e'), meta['model']
    assert s['cases'] == LIVE['cases'] and s['answered'] == LIVE['answered']
    assert s['own_pass'] == LIVE['own'], s['own_pass']
    assert s['covered']['cases'] == LIVE['covered'] and s['covered']['retrieval_ok'] == LIVE['retrieval']
    assert f"{s['median_wall_ms'] / 1000:.1f}" == LIVE['median_s'], s['median_wall_ms']
    assert f"{s['median_thinking_ms'] / 1000:.1f}" == LIVE['thinking_s'], s['median_thinking_ms']
    assert s['forbidden_hits'] == 0
    assert 'all 9 checks passed' in INTEGRATION.read_text(encoding='utf-8')
    review = EVAL.with_suffix('.review.md').read_text(encoding='utf-8')
    assert '**58/66 (87.9%)**' in review and '46/50 (92.0%)' in review and '7/10 (70.0%)' in review


# (part, shape id, old text as runs per paragraph, new text as runs per paragraph)
EDITS = [
    # ── slide 13: evaluation design ──
    (13, 13, [['Compare both adapters under the same reference-constrained policy']],
             [['Release test of the V2 weights, then a fresh test of the live assistant']]),
    (13, 14, [['Thesis §3.7.9; §4.10; final constrained evaluation job 6adac192925af0e27d4f9a58']],
             [['Thesis §3.7.9; §4.10; release job 6adac192925af0e27d4f9a58; live suite ml-services/eval/assistant_cases.json']]),
    (13, 20, [['COVERED CHAT CASES']], [['RELEASE CHAT CASES']]),
    (13, 37, [['REGRESSION COMPARISON']], [['RELEASE REGRESSION & GATES']]),
    (13, 38, [['240 legacy items per model; 87 have expected risk labels. Previous and V2 use the same serving constraint.']],
             [['240 legacy items per model (87 risk-labelled); fixed gates: facts, retrieval, harm, ≤25% fallback.']]),
    (13, 42, [['FIXED ACCEPTANCE GATES']], [['MANUAL REVIEW MATTERS']]),
    (13, 43, [['Factual/support checks, retrieval, harmful patterns, ≤25% fallback, risk agreement, concision and memory checks.']],
             [['Release: keyword pass rejected for unsafe clauses; sentence guard needed 56/130 fallbacks (43.08%).']]),
    (13, 47, [['MANUAL REVIEW MATTERS']], [['LIVE TEST · 18 NOV 2026']]),
    (13, 48, [['Initial keyword pass rejected for unsafe clauses. Sentence guard needed 56/130 fallbacks (43.08%): held.']],
             [['33 questions × 2 runs on the T4 Space: 25 library topics, 5 outside it, 2 follow-ups, 1 greeting.']]),
    (13, 52, [['FINAL SERVING CONSTRAINT']], [['TWO SERVING POLICIES']]),
    (13, 53, [['GBNF selects reviewed passages for covered topics. This is an open-book system test, not unaided recall.']],
             [['Release: GBNF chose reviewed passages. Live: own words, checked after; scored before facts are added.']]),

    # ── slide 14: quality ──
    (14, 13, [['Loss measures target fit; factual checks measure the constrained system']],
             [['Live answers from the V2 weights today; release checks and training below']]),
    (14, 14, [['V2_RELEASE.md; 130/130 also achieved by previous adapter with the same constraint; not general accuracy']],
             [['Live: ml-services/eval/results/assistant-2026-11-18T22-43-58 (+ review); release: V2_RELEASE.md; author-reviewed, not blind']]),
    (14, 19, [['130/130']], [[f"{LIVE['own']}/{LIVE['cases']}"]]),
    (14, 20, [['COVERED CHECKS']], [['AUTOMATIC CHECK']]),
    (14, 21, [['reviewed-passage output']], [["model's own words"]]),
    (14, 25, [['84/87']], [[f"{REVIEW['correct']}/{LIVE['cases']}"]]),
    (14, 26, [['RISK AGREEMENT']], [['CORRECT ON REVIEW']]),
    (14, 27, [['96.55%; three disagree']], [['all 66 answers read']]),
    (14, 31, [['0/130']], [[f"{REVIEW['covered']}/{LIVE['covered']}"]]),
    (14, 32, [['FALLBACKS']], [['LIBRARY TOPICS']]),
    (14, 33, [['explicit substitutions']], [['correct on review']]),
    (14, 37, [['8/8']], [[REVIEW['uncovered']]]),
    (14, 38, [['RELEASE GATES']], [['OUTSIDE LIBRARY']]),
    (14, 39, [['fixed checks passed']], [['unaided; can be wrong']]),
    (14, 43, [['240']], [[f"{LIVE['median_s']} s"]]),
    (14, 44, [['REGRESSION']], [['MEDIAN ANSWER']]),
    (14, 45, [['legacy items per model']], [[f"{LIVE['thinking_s']} s thinking; T4 GPU"]]),
    (14, 49, [['13']], [['47']]),
    (14, 51, [['reviewed reference library']], [['reviewed; 13 at release']]),
    (14, 76, [['SAME SERVING POLICY · PREVIOUS VS V2']], [['V2 RELEASE TEST · 23 OCT · PREVIOUS VS V2']]),

    # ── slide 15: integration ──
    (15, 13, [['Saved release checks against the pinned model, backend and desktop source']],
             [['Re-run on 18 Nov 2026 against the live Space, backend and desktop source']]),
    (15, 14, [['V2_RELEASE.md; pass counts are scoped checks, not user accuracy or a signed-in native acceptance test']],
             [['ml-services/eval/results/integration-2026-11-18.txt; validate:updates; check-navigation.cjs; scoped checks, not user accuracy']]),
    (15, 16, [['PYTHON GROUNDING CONTRACTS']], [['LIVE ML FEATURE CHECKS']]),
    (15, 19, [['14 ', '/ 14']], [['9 ', '/ 9']]),
    (15, 20, [['FOCUSED SOURCE / UI CHECKS']], [['BACKEND TEST GATE']]),
    (15, 23, [['29 ', '/ 29']], [['992 ', '/ 992']]),
    (15, 24, [['EARLIER BACKEND SUITE']], [['OCT-23 GROUNDING CONTRACTS']]),
    (15, 27, [['950 ', '/ 950']], [['10 ', '/ 14']]),
    (15, 28, [['REAL BACKEND ML-CLIENT CALLS']], [['LIVE ASSISTANT ANSWERS']]),
    (15, 31, [['3 ', '/ 3']], [['66 ', '/ 66']]),
    (15, 35, [['v53']], [['v55']]),
    (15, 36, [['V2 GGUF revision pinned in the Space.'], ['Both chat routes preserve reviewed source metadata.']],
             [['Live Space: V2 GGUF 494483e on a T4 GPU.'], ['Heroku release of 18 Nov 2026.']]),
    (15, 41, [['14 PAGES']], [['20 PAGES']]),
    (15, 42, [['SIDEBAR & CONTROLS']], [['BROWSER CHECK']]),
    (15, 43, [['Real session, model and stream state']], [['Every page passed, stubbed native commands']]),

    # ── slide 16: conclusion ──
    (18, 14, [['Thesis Chapter 5; §4.10–4.12; historical URL results are not a fresh evaluation']],
             [['Thesis Ch. 5; model metadata 2026-10-13; ml-services/eval/results 2026-11-18; 94.7% = historical 300-URL test']]),
    (18, 19, [['94.7%']], [[PHISH['acc']]]),
    (18, 20, [['Historical URL accuracy; not re-run']], [[f"Phishing-URL model; {PHISH['n']} held-out URLs"]]),
    (18, 24, [['130/130']], [[f"{REVIEW['correct']}/{LIVE['cases']}"]]),
    (18, 25, [['Covered source-constrained checks']], [['Live assistant answers correct on review']]),
    (18, 30, [['V2 risk-label agreement']], [['V2 risk-label agreement (release)']]),
    (18, 34, [['14']], [['9/9']]),
    (18, 35, [['Current sidebar destinations']], [['Live ML features verified 18 Nov']]),
    (18, 47, [['Covered answers are reference-constrained. Uncovered replies can hallucinate. No blind benchmark or proven superiority. The historical 4.05 s mean missed the 4 s target.']],
             [[f"Phishing recall {PHISH['recall']} at {PHISH['fpr']} false alarms. Answers outside the library can be wrong ({REVIEW['uncovered']}). Reviews are the author's, not blind. Historical 94.7% and 4.05 s not re-run."]]),
    (18, 53, [['Independent evaluation and ablations; broader reviewed sources; fix uncovered-answer errors; complete signed-in native acceptance and installer validation.']],
             [['Blind evaluation and ablations; fix retrieval misses and repetition loops; raise phishing recall; update grounding contracts; signed-in native acceptance.']]),
]

# slide 15, third bar (grey "Speed bar 211", id 26): 10 of 14 contracts
PARTIAL_BAR = (15, 26, 10 / 14)

NOTES = {
    13: (
        "Two evaluations, kept apart. First, the V2 release test of 23 October 2026, unchanged: 39 original questions in two modes (78) "
        "plus 26 added questions in two modes (52) make 130 covered cases, with 8 negative retrieval controls on top. Regression used 240 "
        "legacy items per model, 87 with risk labels, under fixed acceptance gates. Manual review rejected the first keyword pass; a "
        "whole-sentence guard then needed 56/130 reference replacements (43.08%), above the unchanged 25% ceiling, so the release policy "
        "(2026-10-23.3) used GBNF decoding to choose reviewed passages from a thirteen-topic library. Second, a fresh test of the live "
        "assistant on 18 November 2026, after the serving policy changed on 17 November: the assistant now reasons first (think=auto), "
        "answers in its own words with up to two retrieved references from a 47-topic library, and is checked afterwards. An answer that "
        "misses a reference's core facts gets them appended under 'From the reviewed sources'; one that contradicts a reference is "
        "replaced. GBNF still bounds scan explanations. The live suite has 33 questions: 25 on library topics, 5 outside the library, 2 "
        "follow-ups that need the earlier turns, and a greeting. Each has required-fact patterns written for the eval, independently of "
        "the library's own checks. It was run twice because answers are sampled. Each answer is scored on the model's own words, before "
        "any supplement, and on the served answer, and every answer was then read. Both tests use the same weights, "
        "Che237/cyberforge-qwen3.5-2b-v2-GGUF at 494483e. Sources: V2_RELEASE.md; job 6adac192925af0e27d4f9a58; "
        "ml-services/eval/assistant_cases.json and assistant_eval.mjs."
    ),
    14: (
        "Top row: the live assistant on 18 November 2026, 66 answers (33 questions, two runs) from the V2 weights on the T4 GPU. All 66 "
        "were answered, with no forbidden statement such as advising to pay a ransom. 57/66 (86.4%) pass the automatic required-fact "
        "check on the model's own words; the served answer, with the reviewed supplement, passes 58/66. Reading every answer: 58/66 "
        "(87.9%) are correct. The two measures disagree on 7 answers. Four automatic failures are correct but phrased differently, for "
        "example 'change it on the real site' instead of 'change your password'. Three automatic passes are wrong: a repetition loop on "
        "the smishing follow-up, a garbled SIM-swap answer, and Log4Shell with the wrong affected versions. On library topics 46/50 are "
        "correct (92%). The four wrong ones come from two retrieval misses: the MFA-fatigue question retrieved the general MFA reference "
        "instead, and the sextortion question retrieved nothing. Retrieval found the right reference for 22 of 25 library questions in "
        "both runs. Outside the library 7/10 are correct: the model is unaided there and once gave EternalBlue's CVE for Log4Shell. "
        "Follow-ups that need history: 3/4. The median full answer takes 5.9 s, of which about 4.5 s is reasoning, and the answer "
        "streams as it is written; the 90th percentile is 6.6 s. The review was done answer by answer and is saved; it is the author's "
        "review, not a blind one. Bottom: the V2 release (23 October) is unchanged. Training loss fell from 0.1367 to 0.0665 in 100 L4 "
        "steps, 412.67 s. Loss measures fit to the training targets, not factual accuracy. Under the release's constrained policy both "
        "the previous and the V2 adapter scored 130/130 covered checks, so that score cannot be credited to fine-tuning alone. Risk-label "
        "agreement was 83/87 (95.40%) for the previous adapter and 84/87 (96.55%) for V2, all eight release gates passed, and each model "
        "had 240 regression items. The library has grown from 13 topics at release to 47. Sources: "
        "ml-services/eval/results/assistant-2026-11-18T22-43-58.json and .review.md; V2_RELEASE.md."
    ),
    15: (
        "Every bar was re-run on 18 November 2026. Live ML feature checks, 9/9: backend/scripts/check-ml-integration.js calls each ML "
        "feature the desktop uses through the backend's own client code against the live Space. Results: the fine-tuned Qwen on CUDA; "
        "the capability report (9); the BERT URL classifier flags a PayPal-lookalike address as malware (91.6); the DGA detector; the "
        "deep scan rates it critical (86.5); the IOC scan; the assistant as JSON and streamed with reasoning and history; and the "
        "file-malware model calls notepad.exe benign (0.029). Backend test gate, 992/992: npm run validate:updates (628 security and "
        "364 contract tests). The 14 Python grounding contracts written for the October release policy now pass 10 of 14 against "
        "today's code. Three failures are the intended November changes: the new assistant prompt, the assistant no longer being forced "
        "to the reviewed passage, and a question now retrieving both MFA references. The fourth is a real gap, listed as next work: with "
        "47 references, 349 of 1,081 two-topic pairs have no reviewed passage that fits the 80-word scan-explanation budget. Live "
        "assistant answers 66/66 is the evaluation on the previous slide. The live Space serves Che237/cyberforge-qwen3.5-2b-v2-GGUF at "
        "494483e on a T4 GPU; the backend is Heroku release v55 of 18 November. Desktop: the headless-Chrome browser check passed on "
        "all 20 pages, with native commands stubbed. The assistant's sources and the scoped CLI and MCP tools are unchanged. A "
        "signed-in native desktop session and an installer update are still not done. These are scoped pass counts, not user accuracy."
    ),
    16: (
        "Contribution: an integrated, evidence-labelled web-security workflow and a fine-tuned Qwen assistant that answers from reviewed "
        "sources and shows them. The URL figure is now the model in service, not the old benchmark. The phishing-URL classifier, "
        "retrained on 13 October 2026, is 86.5% accurate on 71,691 held-out URLs from sites it never saw in training. It has 95.2% "
        "precision, 67.7% recall, a 2.1% false-positive rate and AUC 0.956: when it flags a site it is usually right, but it misses about "
        "a third of phishing URLs on its own. That is why the agents combine it with page evidence, BERT, DGA and threat intelligence. "
        "The malware-URL model is 98.4% accurate (precision 89.2%, recall 90.5%) and the web-attack model 99.8%. The thesis's 94.7% is "
        "the historical 300-URL test of the original prototype (284/300; 4.05 s mean, 0.05 s over the 4 s target); it was not re-run "
        "and is not a measurement of today's system. Assistant: 58/66 live answers correct on review. 84/87 is the V2 release's "
        "risk-label agreement, one more than the previous adapter, with no significance claim. All 9 live ML features verified on 18 "
        "November. Limits: low phishing recall on its own; answers outside the reviewed library can be wrong (7/10, including a "
        "hallucinated CVE); the reviews are the author's, not blind. Next: blind evaluation and ablations; fix the three retrieval misses "
        "and the repetition loops; raise phishing recall; bring the grounding contracts up to the November policy and fix the long "
        "two-topic explanations; signed-in native acceptance. No claim of universal protection or production-wide reliability is made. "
        "Sources: phishing_detection, malware_detection and web_attack_detection metadata.json in Che237/cyberforge-models (trained "
        "2026-10-13, confirmed in service by the Space's /health); thesis Table 4.3."
    ),
}


def parse(data):
    return E.fromstring(data)


def serial(root):
    return E.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)


def shape(root, sid):
    found = root.xpath(f'.//p:sp[p:nvSpPr/p:cNvPr/@id="{sid}"]', namespaces=NS)
    assert len(found) == 1, sid
    return found[0]


def set_runs(sp, old, new):
    paras = [p for p in sp.iter(f'{{{A}}}p') if ''.join(t.text or '' for t in p.iter(f'{{{A}}}t')).strip()]
    got = [[t.text for t in p.iter(f'{{{A}}}t')] for p in paras]
    assert got == old, (got, old)
    for p, runs in zip(paras, new):
        ts = list(p.iter(f'{{{A}}}t'))
        assert len(ts) == len(runs), (runs, len(ts))
        for t, text in zip(ts, runs):
            t.text = text


def main():
    check_evidence()
    files = {}
    with ZipFile(SOURCE) as z:
        names = [i.filename for i in z.infolist()]
        for n in names:
            files[n] = z.read(n)
    roots = {n: parse(files[f'ppt/slides/slide{n}.xml']) for n in (13, 14, 15, 18)}
    for part, sid, old, new in EDITS:
        set_runs(shape(roots[part], sid), old, new)
    part, sid, ratio = PARTIAL_BAR
    ext = shape(roots[part], sid).find('.//a:xfrm/a:ext', NS)
    ext.set('cx', str(round(int(ext.get('cx')) * ratio)))
    for n, root in roots.items():
        files[f'ppt/slides/slide{n}.xml'] = serial(root)
    with ZipFile(OUT, 'w', ZIP_DEFLATED) as z:
        for n in names:
            z.writestr(n, files[n])

    # speaker notes: V9's file with slides 13-16 rewritten
    md = NOTES_IN.read_text(encoding='utf-8').replace('Thesis Defence v9', 'Thesis Defence v10')
    for page, text in NOTES.items():
        md, count = re.subn(rf'(## Slide {page} — [^\n]*\n\n)(.*?)(\n\n## Slide )', lambda m: m.group(1) + text + m.group(3), md, count=1, flags=re.S)
        assert count == 1, page
    NOTES_OUT.write_text(md, encoding='utf-8')
    print('wrote', OUT.name, 'and', NOTES_OUT.name)


if __name__ == '__main__':
    main()
