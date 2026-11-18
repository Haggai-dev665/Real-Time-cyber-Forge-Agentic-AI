"""Create V9 by editing the V5 package, keeping its fonts, effects and Morph.

Changes from V5:
  * New slide 9, "What each agent does": the eight specialist agents of the
    multi-agent pipeline as cards (stage, what the agent does, what it hands on
    and how many points it can add), and how the Reporter turns those points
    into a verdict. Built from slide 8's own card groups, so it keeps their
    typography and entrance animations. Content is taken from
    backend/src/services/agentOrchestrator.js.
  * Slide 8 corrected: the MITRE Mapper runs in Stage 3 (it needs the
    extracted IOCs), as in agentOrchestrator.js, not in Stage 2.
  * Thank-you slide: the closing photo is a tech photo (Pexels 5380651, Tima
    Miroshnichenko, monitors showing a security alert), cropped and toned
    like every other photo in the deck.
  * Slide 7, "System architecture", redrawn as a four-tier diagram (user's
    device, backend, ML service, data and intelligence), sixteen named
    components, request arrows between tiers, and an offline-training lane.
    Built from the slide's own layer and flow groups, so the entrance
    sequence is kept.
  * Literature review split into two slides with more points: four eras of
    detection research (papers, findings, limits), then threat intelligence,
    agents and language models, and the thesis's four research gaps with
    CyberForge's response. The self-scrolling timeline is gone.
  * Slide 8 is now "Multi-agent architecture": orchestrator, the three stages
    with their real data dependencies, the service each agent calls, the data
    passed between stages, the results bus and the Reporter's five steps.
  * Every rebuilt slide reveals on the presenter's click only (no timers).
  * V9: the literature review covers the evolution from chatbots to agentic AI,
    agentic AI, multi-agent architecture, and AI and agentic AI in
    cybersecurity; the reference roll gains the works it cites; slide 11 names
    the T4 GPU that now serves inference.
  * Speaker notes are removed from the deck and written, slide by slide, to
    "CyberForge - Thesis Defence v8 - Speaker notes.md".
  * Section counters and page numbers follow the new slide.

V5 is left untouched. Run review_defence_v9.ps1 for the native render.
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / '.vendor'))
from lxml import etree as E
from PIL import Image, ImageOps, ImageEnhance

SOURCE = HERE / 'CyberForge - Thesis Defence v5.pptx'
OUT = HERE / 'CyberForge - Thesis Defence v9.pptx'
NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
    'ct': 'http://schemas.openxmlformats.org/package/2006/content-types',
}
P, A = NS['p'], NS['a']
EMU = 914400
PIPELINE = 'ppt/slides/slide9.xml'          # deck slide 8, "Eight-agent pipeline"
ARCH = 'ppt/slides/slide8.xml'              # deck slide 7, "System architecture"
NOTES_MD = HERE / 'CyberForge - Thesis Defence v9 - Speaker notes.md'
AGENTS = 'ppt/slides/slide21.xml'           # new deck slide 9
THANKS = 'ppt/slides/slide20.xml'           # deck slide 16
# deck order after the insert: (part number, new page number)
LIT2 = 'ppt/slides/slide22.xml'             # new deck slide 7, literature review 2 of 2
ORDER = [1, 2, 3, 4, 5, 6, 22, 8, 9, 21, 10, 12, 13, 14, 15, 18, 20]
METHODS = {8: 1, 9: 2, 21: 3, 10: 4, 12: 5, 13: 6}

# ── the eight agents, as agentOrchestrator.js implements them ──
CARD_GROUPS = [25, 30, 35, 40, 50, 55, 60, 70]   # slide 8's eight agent groups
CARDS = [
    ('01  ·  STAGE 1', 'URL CLASSIFIER',
     'Sends the full address to the BERT phishing and malware classifier on the ML service.',
     'Malicious or benign, with confidence. Up to 30 points.'),
    ('02  ·  STAGE 1', 'DGA DETECTOR',
     'Checks whether the host name looks machine-generated, as malware domains often are.',
     'Generated or legitimate. Up to 10 points when flagged.'),
    ('03  ·  STAGE 1', 'WEB SCRAPER',
     'Opens the page in a real browser: forms, scripts, cookies, redirects, requests, TLS, headers.',
     'Page evidence for Stage 2. Up to 35 points.'),
    ('04  ·  STAGE 1', 'MEMORY READER',
     "Recalls the domain's past visits, last verdict and indicators seen before.",
     'A history multiplier: up to +50% for a domain flagged before.'),
    ('05  ·  STAGE 2', 'IOC EXTRACTOR',
     'Pulls indicators from the address, page and requests: domains, IPs, URLs, hashes, wallets.',
     'Up to 100 unique IOCs. 8 points at 8 or more.'),
    ('06  ·  STAGE 2', 'BEHAVIOURAL ANALYSER',
     'Judges what the page does: password forms without HTTPS, forms posting elsewhere, obfuscated scripts.',
     'Behaviour findings. Up to 25 points.'),
    ('07  ·  STAGE 3', 'MITRE MAPPER',
     "Matches the page's signals and the extracted IOCs to MITRE ATT&CK techniques.",
     'Techniques and an attack chain. 15 points at 3 or more.'),
    ('08  ·  STAGE 3', 'THREAT INTELLIGENCE',
     'Looks up to five extracted IPs, domains and hashes in AlienVault OTX threat reports.',
     '"Known bad" if listed: 40 points, the strongest signal.'),
]
AGENTS_NOTES = (
    'The eight specialists each read one kind of evidence. Stage 1 runs four in parallel: the URL classifier '
    '(a BERT model on the ML service), the DGA detector (does the host name look machine-generated), the web '
    'scraper (the page loaded in a real browser) and the memory reader (what we saw on this domain before). '
    'Stage 2 needs the scraped page: the IOC extractor collects domains, IPs, URLs, hashes and wallets, and the '
    'behavioural analyser judges forms, scripts and redirects. Stage 3 needs the IOCs: the MITRE mapper names '
    'ATT&CK techniques and the threat-intelligence agent checks up to five indicators in AlienVault OTX. '
    'The Reporter then adds the points (URL model up to 30, page evidence up to 35, DGA up to 10, behaviour up '
    'to 25, OTX known-bad 40, three or more ATT&CK techniques 15, eight or more IOCs 8), applies the domain-history '
    'multiplier (up to +50%), caps the total at 100 and maps it to a verdict: 65 malicious, 35 suspicious, 15 low risk. '
    'A page that could not be observed can never be called clean; it is reported as unknown. One agent failing does '
    'not stop the others; the failure is listed in the report. The language model only writes the explanation; '
    'it does not decide the score. Source: backend/src/services/agentOrchestrator.js.'
)
PIPELINE_NOTES_OLD = 'then IOC extraction, behaviour rules and MITRE mapping; then threat intelligence enrichment.'
PIPELINE_NOTES_NEW = 'then IOC extraction and behaviour rules; then MITRE mapping and threat intelligence enrichment, which both need the extracted IOCs.'

THANKS_PHOTO = ('5380651', 0.658, (0.80, 0.50))


def parse(data):
    return E.fromstring(data)


def serial(root):
    return E.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)


def emu(inches):
    return int(round(inches * EMU))


def by_id(root, id, tag='*'):
    nodes = root.xpath(f'.//p:{tag}[*/p:cNvPr/@id="{id}"]', namespaces=NS)
    assert len(nodes) == 1, id
    return nodes[0]


def named(root, name):
    nodes = root.xpath(f'.//p:sp[p:nvSpPr/p:cNvPr/@name="{name}"]', namespaces=NS)
    assert len(nodes) == 1, name
    return nodes[0]


def set_xfrm(xfrm, x, y, w, h, child=False):
    values = {'off': {'x': x, 'y': y}, 'ext': {'cx': w, 'cy': h}}
    if child:
        values.update(chOff={'x': x, 'y': y}, chExt={'cx': w, 'cy': h})
    for tag, attrs in values.items():
        node = xfrm.find(f'a:{tag}', NS)
        for k, v in attrs.items():
            node.set(k, str(v))


def place_card(group, x, y, w, h, top=False):
    """Move and resize an agent card group (light, card, tick, text) to x, y, w, h (EMU)."""
    set_xfrm(group.find('p:grpSpPr/a:xfrm', NS), x, y, w, h, child=True)
    for sp in group.findall('p:sp', NS):
        name = sp.find('p:nvSpPr/p:cNvPr', NS).get('name')
        xfrm = sp.find('p:spPr/a:xfrm', NS)
        if name in ('Agent light', 'Agent'):
            set_xfrm(xfrm, x, y, w, h)
        elif name == 'Agent tick':
            set_xfrm(xfrm, x + emu(0.22), y + (emu(0.3) if top else (h - emu(0.6)) // 2), emu(0.1), emu(0.6))
        elif name == 'Agent text':
            pad = emu(0.15) if top else emu(0.1)
            set_xfrm(xfrm, x + emu(0.5), y + pad, w - emu(0.7), h - 2 * pad)
            if top:
                xfrm.getparent().getparent().find('p:txBody/a:bodyPr', NS).set('anchor', 't')


def run(rpr, text, **attrs):
    r = E.Element(f'{{{A}}}r')
    prop = deepcopy(rpr)
    prop.attrib.update({k: str(v) for k, v in attrs.items() if k in ('sz', 'b')})
    if 'color' in attrs:
        prop.find('a:solidFill/a:srgbClr', NS).set('val', attrs['color'])
    if 'font' in attrs:
        prop.find('a:latin', NS).set('typeface', attrs['font'])
    r.append(prop)
    E.SubElement(r, f'{{{A}}}t').text = text
    return r


def para(ppr, runs, before=0):
    p = E.Element(f'{{{A}}}p')
    pp = deepcopy(ppr)
    if before:
        sb = E.Element(f'{{{A}}}spcBef'); E.SubElement(sb, f'{{{A}}}spcPts').set('val', str(before))
        pp.append(sb)
    p.append(pp)
    for r in runs:
        p.append(r)
    return p


def fill(sp, paragraphs):
    body = sp.find('p:txBody', NS)
    for old in body.findall('a:p', NS):
        body.remove(old)
    for p in paragraphs:
        body.append(p)


def set_text(sp, old, new):
    """Replace text inside one run of a shape, keeping the run's style."""
    for t in sp.iter(f'{{{A}}}t'):
        if t.text and old in t.text:
            t.text = t.text.replace(old, new)
            return
    raise AssertionError((old, new))


def drop_animations(slide, gone):
    """Remove the entrance effects of deleted shapes, then any groups left empty."""
    timing = slide.find('p:timing', NS)
    if timing is None:
        return
    for tgt in timing.xpath('.//p:spTgt', namespaces=NS):
        if tgt.get('spid') in gone:
            effect = tgt
            # climb to the effect node (the par whose cTn carries presetClass)
            while not (effect.tag == f'{{{P}}}par' and effect.find('p:cTn', NS).get('presetClass')):
                effect = effect.getparent()
            if effect.getparent() is not None:
                effect.getparent().remove(effect)
    changed = True
    while changed:
        changed = False
        for lst in timing.xpath('.//p:childTnLst', namespaces=NS):
            if len(lst) == 0:
                par = lst.getparent().getparent()   # cTn -> par
                if par.tag == f'{{{P}}}par' and par.getparent() is not None:
                    par.getparent().remove(par); changed = True
    for bld in timing.xpath('.//p:bldP', namespaces=NS):
        if bld.get('spid') in gone:
            bld.getparent().remove(bld)


def mono_photo(photo_id, aspect, focus):
    src = HERE / 'photos' / f'px-{photo_id}.jpg'
    out = HERE / 'photos' / 'mono' / f'{photo_id}-{aspect:.3f}-{focus[0]:.2f}-{focus[1]:.2f}.jpg'
    if not out.exists():
        im = Image.open(src).convert('RGB'); iw, ih = im.size
        if iw / ih > aspect:
            nw = int(ih * aspect); x0 = int((iw - nw) * focus[0]); im = im.crop((x0, 0, x0 + nw, ih))
        else:
            nh = int(iw / aspect); y0 = int((ih - nh) * focus[1]); im = im.crop((0, y0, iw, y0 + nh))
        g = ImageOps.grayscale(im)
        g = ImageEnhance.Contrast(g).enhance(1.12)
        g = ImageEnhance.Brightness(g).enhance(0.92)
        img = ImageOps.colorize(g, black='#0f0f11', white='#f0f0f0', mid='#7d7d80')
        img.thumbnail((2000, 2000)); img.save(out, quality=88)
    return out


def build_agents_slide(slide):
    # header
    set_text(named(slide, 'Kicker 94'), '2 OF 5', '3 OF 6')
    set_text(named(slide, 'Title 95'), 'EIGHT-AGENT PIPELINE', 'WHAT EACH AGENT DOES')
    sub = named(slide, 'Subtitle 96')
    sub_t = list(sub.iter(f'{{{A}}}t'))
    sub_t[0].text = 'Eight specialists each read one kind of evidence; the Reporter turns their points into one verdict'
    for t in sub_t[1:]:
        t.text = ''
    src = named(slide, 'Source')
    src_t = list(src.iter(f'{{{A}}}t'))
    src_t[0].text = 'backend/src/services/agentOrchestrator.js: eight specialist agents and ReportAgent; Thesis §3.8'
    for t in src_t[1:]:
        t.text = ''

    # styles taken from slide 8's own runs
    stage_text = by_id(slide, 19, 'sp')
    lime = stage_text.find('.//a:r/a:rPr', NS)
    agent_text = by_id(slide, 24, 'sp')
    name_rpr, desc_rpr = [r.find('a:rPr', NS) for r in agent_text.findall('.//a:r', NS)][:2]
    name_ppr, desc_ppr = [p.find('a:pPr', NS) for p in agent_text.findall('p:txBody/a:p', NS)][:2]
    formula = by_id(slide, 84, 'grpSp')
    f_text = by_id(slide, 83, 'sp')
    f_runs = [r.find('a:rPr', NS) for r in f_text.findall('.//a:r', NS)]
    f_ppr = f_text.find('p:txBody/a:p/a:pPr', NS)
    name_rpr, desc_rpr, lime, f_runs = deepcopy(name_rpr), deepcopy(desc_rpr), deepcopy(lime), [deepcopy(r) for r in f_runs]
    name_ppr, desc_ppr, f_ppr = deepcopy(name_ppr), deepcopy(desc_ppr), deepcopy(f_ppr)

    # remove the stage heads, arrows and the Reporter box; keep the eight agents and the strip
    gone = {'20', '45', '65', '75', '80', '41', '61', '71'}
    tree = slide.find('p:cSld/p:spTree', NS)
    for child in list(tree):
        ids = child.xpath('./*/p:cNvPr/@id', namespaces=NS)
        if ids and ids[0] in gone:
            tree.remove(child)
    drop_animations(slide, gone)

    # 4 × 2 grid of cards
    left, top, gap = 1.1, 2.9, 0.3
    w = (17.8 - 3 * gap) / 4
    h = 2.78
    for i, (gid, (tag, name, does, gives)) in enumerate(zip(CARD_GROUPS, CARDS)):
        group = by_id(slide, gid, 'grpSp')
        group.find('p:nvGrpSpPr/p:cNvPr', NS).set('name', f'Agent card {i + 1}')
        col, row = i % 4, i // 4
        place_card(group, emu(left + col * (w + gap)), emu(top + row * (h + gap)), emu(w), emu(h), top=True)
        text = group.xpath('./p:sp[p:nvSpPr/p:cNvPr/@name="Agent text"]', namespaces=NS)[0]
        fill(text, [
            para(name_ppr, [run(lime, tag, sz=1400)]),
            para(name_ppr, [run(name_rpr, name, sz=2000)], before=200),
            para(desc_ppr, [run(desc_rpr, does, sz=1600)], before=700),
            para(desc_ppr, [run(lime, 'OUTPUT  ', sz=1500), run(desc_rpr, gives, sz=1600, color='EDEDED')], before=700),
        ])

    # the Reporter strip
    fy, fh = top + 2 * h + gap + 0.22, 1.45
    set_xfrm(formula.find('p:grpSpPr/a:xfrm', NS), emu(1.1), emu(fy), emu(17.8), emu(fh), child=True)
    for sp in formula.findall('p:sp', NS):
        nm = sp.find('p:nvSpPr/p:cNvPr', NS).get('name')
        xfrm = sp.find('p:spPr/a:xfrm', NS)
        if nm == 'Formula text':
            set_xfrm(xfrm, emu(1.6), emu(fy), emu(16.8), emu(fh))
        else:
            set_xfrm(xfrm, emu(1.1), emu(fy), emu(17.8), emu(fh))
            sp.find('p:spPr/a:prstGeom/a:avLst/a:gd', NS).set('fmla', 'val 30000')
    lime_f, text_f, grey_f = f_runs
    fill(f_text, [
        para(f_ppr, [run(lime_f, 'REPORTER   ', sz=1900),
                     run(text_f, 'Adds the points (capped at 100) and applies the history multiplier:  ', sz=1700),
                     run(lime_f, '65+ malicious  ·  35+ suspicious  ·  15+ low risk', sz=1700)]),
        para(f_ppr, [run(grey_f, 'An unobserved page is "unknown", never "clean". A failed agent is listed, not read as safe. '
                                 'The language model only writes the explanation; the report is stored.', sz=1500, color='BDBDC1')],
             before=300),
    ])


def fix_pipeline(slide):
    """MITRE Mapper runs in Stage 3 with Threat Intelligence (both need the IOCs)."""
    mitre = by_id(slide, 60, 'grpSp')
    ti = by_id(slide, 70, 'grpSp').find('p:grpSpPr/a:xfrm', NS)
    below = by_id(slide, 55, 'grpSp').find('p:grpSpPr/a:xfrm', NS)
    x = int(ti.find('a:off', NS).get('x')); w = int(ti.find('a:ext', NS).get('cx'))
    y = int(below.find('a:off', NS).get('y')); h = int(below.find('a:ext', NS).get('cy'))
    place_card(mitre, x, y, w, h)


# ── deck slide 7: the system architecture ──
TIERS = [  # (group id, tag, title, subtitle, [(name, detail, highlight)])
    (22, '01  ·  USER\'S DEVICE', 'DESKTOP APP', 'Tauri 2: Rust core and web interface', [
        ('14-PAGE INTERFACE', 'Analyze, Live Agent, Assistant, Alerts', False),
        ('PRIVACY & CONSENT GATES', 'nothing leaves without permission', False),
        ('LIVE AGENT', 'its own browser, with an empty profile', True),
        ('LOCAL STORE & KEYCHAIN', 'local memory; tokens in the OS keyring', False),
    ]),
    (28, '02  ·  BACKEND', 'API SERVER', 'Node.js 24 and Express on Heroku', [
        ('AUTH & ROUTE GUARDS', 'a signed session on every route', False),
        ('AGENT ORCHESTRATOR', '8 agents in 3 stages, then a Reporter', True),
        ('ASSISTANT GATEWAY', 'streams answers, names the engine', False),
        ('MEMORY SERVICE', 'domain history, sessions and alerts', False),
    ]),
    (34, '03  ·  ML SERVICE', 'INFERENCE API', 'FastAPI on a Hugging Face Space', [
        ('URL MODELS', 'phishing, malware, anomaly, web attack', False),
        ('BERT CLASSIFIER & DGA', 'transformer URL model, domain detector', False),
        ('FILE MALWARE MODEL', 'LightGBM on EMBER2024 features', False),
        ('QWEN3.5-2B + LoRA', 'assistant grounded in reviewed sources', True),
    ]),
    (40, '04  ·  DATA & INTELLIGENCE', 'STORES & FEEDS', 'services the backend reads and writes', [
        ('MONGODB ATLAS', 'users, scans and reports', False),
        ('APPWRITE', 'alerts and device records', False),
        ('ALIENVAULT OTX', 'reputation of extracted IOCs', False),
        ('PAGE SCANNER', 'rendered-page evidence for agents', False),
    ]),
]
LANE = [  # offline training: (group id, step, name, detail)
    (44, '1', 'CURATE DATA', '2,462 train / 273 validation'),
    (49, '2', 'LoRA FINE-TUNE', 'NVIDIA L4 on Hugging Face Jobs'),
    (54, '3', 'EXPORT & GATE', 'GGUF Q4_K_M; release checks'),
    (59, '4', 'PUBLISH', 'pinned revision, read by tier 03'),
]
LANE_ARROWS = [45, 50, 55]
ARCH_NOTES = (
    'CyberForge has four tiers. Tier 1 is the Tauri 2 desktop app on the user\'s computer: a Rust core with a web '
    'interface of fourteen pages. The Rust core enforces the privacy consent gates (no address or text leaves the '
    'computer for a feature the user has not allowed), keeps tokens in the operating-system keyring, keeps local '
    'memory and history, and runs the Live Agent, which browses a page in its own browser with an empty profile. '
    'Tier 2 is the Node.js 24 / Express backend on Heroku. Every route needs a signed session. It hosts the agent '
    'orchestrator (eight specialist agents in three stages, then the Reporter), the assistant gateway (which streams '
    'answers and says which engine produced them) and the memory service. Tier 3 is the ML service, a FastAPI '
    'application on a Hugging Face Space that only accepts calls carrying the backend\'s service key: the four '
    'scikit-learn URL models, the BERT URL classifier, the DGA detector, the LightGBM file-malware model trained on '
    'EMBER2024 features, and the fine-tuned Qwen3.5-2B assistant, grounded in a reviewed reference library. Tier 4 '
    'is data and intelligence: MongoDB Atlas for users, scans and reports, Appwrite for alerts and device records, '
    'AlienVault OTX for IOC reputation and the rendered-page scanner that gives the agents page evidence. Training '
    'is kept apart from serving: data is curated, the LoRA update runs as a Hugging Face Job on an NVIDIA L4, the '
    'model is exported to GGUF and gated by release checks, and the ML service loads a pinned revision from the '
    'model repository. Sources: desktop/src-tauri, backend/src, ml-services/hf_space_deploy, ml-services/llm_finetune.'
)


def _id_name(el, id, name):
    c = el.find('.//p:cNvPr', NS)
    c.set('id', str(id)); c.set('name', name)
    return el


def _shape(tpl, id, name, x, y, w, h, fill=None, radius=None):
    sp = _id_name(deepcopy(tpl), id, name)
    set_xfrm(sp.find('p:spPr/a:xfrm', NS), emu(x), emu(y), emu(w), emu(h))
    if fill:
        sp.find('p:spPr/a:solidFill/a:srgbClr', NS).set('val', fill)
    if radius is not None:
        sp.find('p:spPr/a:prstGeom/a:avLst/a:gd', NS).set('fmla', f'val {radius}')
    return sp


def _text(tpl, id, name, x, y, w, h, paragraphs, anchor='t'):
    sp = _id_name(deepcopy(tpl), id, name)
    set_xfrm(sp.find('p:spPr/a:xfrm', NS), emu(x), emu(y), emu(w), emu(h))
    sp.find('p:txBody/a:bodyPr', NS).set('anchor', anchor)
    fill(sp, paragraphs)
    return sp


def _arrow(tpl, id, name, x1, y, x2):
    cx = _id_name(deepcopy(tpl), id, name)
    xf = cx.find('p:spPr/a:xfrm', NS)
    set_xfrm(xf, emu(min(x1, x2)), emu(y), emu(abs(x2 - x1)), 0)
    if x2 < x1:
        xf.set('flipH', '1')   # points left
    return cx


def _group(id, name, children):
    g = E.Element(f'{{{P}}}grpSp')
    nv = E.SubElement(g, f'{{{P}}}nvGrpSpPr')
    c = E.SubElement(nv, f'{{{P}}}cNvPr'); c.set('id', str(id)); c.set('name', name)
    E.SubElement(nv, f'{{{P}}}cNvGrpSpPr'); E.SubElement(nv, f'{{{P}}}nvPr')
    boxes = []
    for ch in children:
        xf = ch.find('p:spPr/a:xfrm', NS)
        x, y = int(xf.find('a:off', NS).get('x')), int(xf.find('a:off', NS).get('y'))
        w, h = int(xf.find('a:ext', NS).get('cx')), int(xf.find('a:ext', NS).get('cy'))
        boxes.append((x, y, x + w, y + h))
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    pr = E.SubElement(g, f'{{{P}}}grpSpPr')
    xf = E.SubElement(pr, f'{{{A}}}xfrm')
    for tag, a, b in (('off', 'x', 'y'), ('ext', 'cx', 'cy'), ('chOff', 'x', 'y'), ('chExt', 'cx', 'cy')):
        n = E.SubElement(xf, f'{{{A}}}{tag}')
        n.set(a, str(x0 if tag in ('off', 'chOff') else x1 - x0)); n.set(b, str(y0 if tag in ('off', 'chOff') else y1 - y0))
    for ch in children:
        g.append(ch)
    return g


def build_architecture(slide):
    set_text(named(slide, 'Subtitle 82'), 'Authenticated clients, inference and separate training jobs',
             'Four tiers from the user\'s device to the models; training runs separately')
    src_t = [t for t in named(slide, 'Source').iter(f'{{{A}}}t') if t.text]
    src_t[0].text = 'desktop/src-tauri; backend/src; ml-services/hf_space_deploy; ml-services/llm_finetune; Thesis §3.2'
    for t in src_t[1:]:
        t.text = ''
    for t in named(slide, 'Title 81').iter(f'{{{A}}}t'):
        pass

    # templates from the slide itself
    layer = by_id(slide, 22, 'grpSp')
    t_light = layer.xpath('./p:sp[p:nvSpPr/p:cNvPr/@name="Layer light"]', namespaces=NS)[0]
    t_card = layer.xpath('./p:sp[p:nvSpPr/p:cNvPr/@name="Layer"]', namespaces=NS)[0]
    t_chip = layer.xpath('./p:sp[p:nvSpPr/p:cNvPr/@name="Layer key bg"]', namespaces=NS)[0]
    t_text = layer.xpath('./p:sp[p:nvSpPr/p:cNvPr/@name="Layer text"]', namespaces=NS)[0]
    flow = by_id(slide, 44, 'grpSp')
    t_flow_text = flow.xpath('./p:sp[p:nvSpPr/p:cNvPr/@name="Flow text"]', namespaces=NS)[0]
    t_arrow = by_id(slide, 45, 'cxnSp')
    t_light, t_card, t_chip, t_text, t_flow_text, t_arrow = map(deepcopy, (t_light, t_card, t_chip, t_text, t_flow_text, t_arrow))
    oswald = t_flow_text.find('.//a:r/a:rPr', NS)          # Oswald 19, lime
    body = t_text.find('.//a:r/a:rPr', NS)                 # Titillium Web 16.5, grey
    ppr = t_text.find('p:txBody/a:p/a:pPr', NS)

    def osw(text, sz, color='EDEDED'):
        return run(oswald, text, sz=sz, color=color)

    def tit(text, sz, color='BDBDC1'):
        return run(body, text, sz=sz, color=color, font='Titillium Web')

    tree = slide.find('p:cSld/p:spTree', NS)
    nid = iter(range(300, 1000))

    # the photo goes: the diagram needs the full width
    photo = by_id(slide, 16, 'pic')
    tree.remove(photo)
    drop_animations(slide, {'16'})

    # ── four tiers ──
    top, H, gap = 2.75, 5.9, 0.55
    W = (17.8 - 3 * gap) / 4
    chip_h, chip_gap, chips_top = 1.0, 0.1, 1.42
    for i, (gid, tag, title, sub, chips) in enumerate(TIERS):
        x = 1.1 + i * (W + gap)
        kids = [
            _shape(t_light, next(nid), 'Tier light', x, top, W, H, radius=7000),
            _shape(t_card, next(nid), 'Tier', x, top, W, H, radius=7000),
            _text(t_text, next(nid), 'Tier head', x + 0.28, top + 0.16, W - 0.45, 1.2, [
                para(ppr, [osw(tag, 1400, 'C1FF72')]),
                para(ppr, [osw(title, 2300)], before=100),
                para(ppr, [tit(sub, 1450)], before=100),
            ]),
        ]
        for k, (name, detail, hot) in enumerate(chips):
            cy = top + chips_top + k * (chip_h + chip_gap)
            kids.append(_shape(t_chip, next(nid), 'Component', x + 0.2, cy, W - 0.4, chip_h,
                               fill='33402A' if hot else '333337', radius=20000))
            kids.append(_text(t_text, next(nid), 'Component text', x + 0.38, cy, W - 0.68, chip_h, [
                para(ppr, [osw(name, 1550, 'C1FF72' if hot else 'EDEDED')]),
                para(ppr, [tit(detail, 1350, 'D6D6D9' if hot else 'BDBDC1')]),
            ], anchor='ctr'))
        if i:
            ay = top + chips_top + 1.5 * (chip_h + chip_gap) + chip_h / 2 - 0.55
            kids.append(_arrow(t_arrow, next(nid), 'Tier arrow', x - gap + 0.09, ay, x - 0.09))
            kids.append(_arrow(t_arrow, next(nid), 'Tier arrow back', x - 0.09, ay + 0.3, x - gap + 0.09))
        old = by_id(slide, gid, 'grpSp')
        new = _group(gid, f'Tier {i + 1}', kids)
        old.addprevious(new); tree.remove(old)

    # ── offline-training lane ──
    ly, lh = top + H + 0.25, 1.4
    key_w, box_gap = 2.75, 0.5
    bx0 = 1.1 + key_w + 0.3
    bw = (18.9 - bx0 - 3 * box_gap) / 4
    for j, (gid, step, name, detail) in enumerate(LANE):
        x = bx0 + j * (bw + box_gap)
        kids = []
        if j == 0:
            kids += [
                _shape(t_chip, next(nid), 'Lane key', 1.1, ly, key_w, lh, fill='33402A', radius=22000),
                _text(t_text, next(nid), 'Lane key text', 1.3, ly, key_w - 0.35, lh, [
                    para(ppr, [osw('OFFLINE TRAINING', 1800, 'C1FF72')]),
                    para(ppr, [tit('separate from serving', 1350, 'D6D6D9')]),
                ], anchor='ctr'),
            ]
        kids += [
            _shape(t_light, next(nid), 'Lane light', x, ly, bw, lh, radius=22000),
            _shape(t_card, next(nid), 'Lane step', x, ly, bw, lh, radius=22000),
            _text(t_text, next(nid), 'Lane text', x + 0.25, ly, bw - 0.4, lh, [
                para(ppr, [osw(step + '   ', 1700, 'C1FF72'), osw(name, 1700)]),
                para(ppr, [tit(detail, 1350)]),
            ], anchor='ctr'),
        ]
        old = by_id(slide, gid, 'grpSp')
        new = _group(gid, f'Lane {j + 1}', kids)
        old.addprevious(new); tree.remove(old)
    for j, aid in enumerate(LANE_ARROWS):
        x_end = bx0 + j * (bw + box_gap) + bw
        old = by_id(slide, aid, 'cxnSp')
        new = _arrow(t_arrow, aid, f'Lane arrow {j + 1}', x_end + 0.09, ly + lh / 2, x_end + box_gap - 0.09)
        old.addprevious(new); tree.remove(old)
    # the arrows now point right: wipe them in from the left
    for eff in slide.xpath('.//p:timing//p:animEffect', namespaces=NS):
        if eff.find('.//p:spTgt', NS).get('spid') in {str(a) for a in LANE_ARROWS}:
            eff.set('filter', 'wipe(left)')


def notes_text(notes_root):
    body = notes_root.xpath('.//p:sp[.//p:ph/@type="body"]/p:txBody', namespaces=NS)
    if not body:
        return ''
    return '\n\n'.join(''.join(t.text or '' for t in p.iter(f'{{{A}}}t')) for p in body[0].findall('a:p', NS)).strip()


def clear_notes(notes_root):
    body = notes_root.xpath('.//p:sp[.//p:ph/@type="body"]/p:txBody', namespaces=NS)
    if body:
        paras = body[0].findall('a:p', NS)
        for p in paras[1:]:
            body[0].remove(p)
        for r in paras[0].findall('a:r', NS) + paras[0].findall('a:fld', NS) + paras[0].findall('a:br', NS):
            paras[0].remove(r)


def slide_title(root):
    for name in ('Title', 'Thanks title'):
        for sp in root.xpath(f'.//p:sp[starts-with(p:nvSpPr/p:cNvPr/@name, "{name}")]', namespaces=NS):
            text = ' '.join(''.join(t.text or '' for t in p.iter(f'{{{A}}}t')) for p in sp.iter(f'{{{A}}}p')).strip()
            if text:
                return ' '.join(text.split())
    return ''



# ── click-only animation ──
def click_timing(slide, clicks):
    """Replace the slide's animation with one fade-in per click; nothing runs on a timer."""
    ids = iter(range(3, 10000))
    parts = []
    for spids in clicks:
        effects = []
        for k, spid in enumerate(spids):
            node = 'clickEffect' if k == 0 else 'withEffect'
            effects.append(
                f'<p:par><p:cTn id="{next(ids)}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="{node}">'
                f'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
                f'<p:set><p:cBhvr><p:cTn id="{next(ids)}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
                f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
                f'<p:to><p:strVal val="visible"/></p:to></p:set>'
                f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{next(ids)}" dur="450"/>'
                f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>')
        parts.append(
            f'<p:par><p:cTn id="{next(ids)}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>'
            f'<p:par><p:cTn id="{next(ids)}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
            + ''.join(effects) + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>')
    xml_ = (f'<p:timing xmlns:p="{P}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
            f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
            + ''.join(parts) +
            '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
            '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
            '</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>')
    new = E.fromstring(xml_)
    old = slide.find('p:timing', NS)
    if old is not None:
        old.addprevious(new); old.getparent().remove(old)
    else:
        slide.append(new)


# ── shared drawing kit, taken from the original architecture slide ──
class Kit:
    def __init__(self, arch_original):
        layer = by_id(arch_original, 22, 'grpSp')
        pick = lambda g, n: deepcopy(g.xpath(f'./p:sp[p:nvSpPr/p:cNvPr/@name="{n}"]', namespaces=NS)[0])
        self.light, self.card = pick(layer, 'Layer light'), pick(layer, 'Layer')
        self.chip_tpl, self.text = pick(layer, 'Layer key bg'), pick(layer, 'Layer text')
        flow_text = pick(by_id(arch_original, 44, 'grpSp'), 'Flow text')
        self.arrow = deepcopy(by_id(arch_original, 45, 'cxnSp'))
        self.oswald = flow_text.find('.//a:r/a:rPr', NS)
        self.body = self.text.find('.//a:r/a:rPr', NS)
        self.ppr = self.text.find('p:txBody/a:p/a:pPr', NS)
        self.ids = iter(range(400, 5000))

    def osw(self, text, sz, color='EDEDED'):
        return run(self.oswald, text, sz=sz, color=color)

    def tit(self, text, sz, color='BDBDC1'):
        return run(self.body, text, sz=sz, color=color, font='Titillium Web')

    def p(self, runs, before=0):
        return para(self.ppr, runs, before=before)

    def box(self, x, y, w, h, radius=12000, name='Card'):
        return [_shape(self.light, next(self.ids), name + ' light', x, y, w, h, radius=radius),
                _shape(self.card, next(self.ids), name, x, y, w, h, radius=radius)]

    def chip(self, x, y, w, h, fill='333337', radius=20000, name='Chip'):
        return _shape(self.chip_tpl, next(self.ids), name, x, y, w, h, fill=fill, radius=radius)

    def words(self, x, y, w, h, paragraphs, anchor='t', name='Text'):
        return _text(self.text, next(self.ids), name, x, y, w, h, paragraphs, anchor=anchor)

    def line(self, x1, y, x2, name='Arrow'):
        return _arrow(self.arrow, next(self.ids), name, x1, y, x2)

    def elbow(self, x1, y1, x2, y2, name='Link'):
        cx = _id_name(deepcopy(self.arrow), next(self.ids), name)
        geom = cx.find('p:spPr/a:prstGeom', NS)
        geom.set('prst', 'bentConnector3')
        av = geom.find('a:avLst', NS)
        gd = E.SubElement(av, f'{{{A}}}gd'); gd.set('name', 'adj1'); gd.set('fmla', 'val 50000')
        xf = cx.find('p:spPr/a:xfrm', NS)
        set_xfrm(xf, emu(x1), emu(min(y1, y2)), emu(x2 - x1), emu(abs(y2 - y1)))
        if y2 < y1:
            xf.set('flipV', '1')
        return cx

    def group(self, name, kids):
        gid = next(self.ids)
        return gid, _group(gid, name, kids)


def clear_content(slide, keep_names=('Kicker', 'Title', 'Subtitle', 'Source', 'Page', '!!seg')):
    tree = slide.find('p:cSld/p:spTree', NS)
    for child in list(tree):
        c = child.find('./*/p:cNvPr', NS)
        if c is None:
            continue
        if not any(c.get('name', '').startswith(k) for k in keep_names):
            tree.remove(child)
    return tree


def header(slide, title=None, subtitle=None, source=None, kicker=None):
    def setall(sp, text):
        ts = [t for t in sp.iter(f'{{{A}}}t') if t.text]
        ts[0].text = text
        for t in ts[1:]:
            t.text = ''
    pick = lambda prefix: slide.xpath(f'.//p:sp[starts-with(p:nvSpPr/p:cNvPr/@name, "{prefix}")]', namespaces=NS)[0]
    if kicker: setall(pick('Kicker'), kicker)
    if title: setall(pick('Title'), title)
    if subtitle: setall(pick('Subtitle'), subtitle)
    if source: setall(pick('Source'), source)


# ── literature review ──
LIT1 = [  # (years, era, highlight, [(who, finding)], limit)
    ('2007 – 2014', 'RULES & FEATURES', False, [
        ('Provos et al., 2007', 'Drive-by downloads on 1.3% of sampled pages; predicted short-lived domains and polymorphic scripts.'),
        ('Mohammad, Thabtah & McCluskey, 2014', 'Hand-made URL and HTML features (length, "@", IP hosts, hidden iframes) work in controlled tests.'),
    ], 'Rigid: once attackers learn the rules, they change the URL.'),
    ('2010 – 2019', 'CLASSICAL ML', False, [
        ('Sommer & Paxson, 2010', 'Intrusion detection faces costly errors, scarce ground truth and output analysts cannot act on.'),
        ('Buczak & Guven, 2016', 'Survey: concept drift, class imbalance and generalisation limit deployed models.'),
        ('Sahingoz et al., 2019', 'Random forests on lexical URL features reach very high accuracy.'),
    ], 'Bound by feature engineering; one score, many false alarms.'),
    ('2017 – 2021', 'DEEP LEARNING', False, [
        ('Vaswani et al., 2017', 'Self-attention Transformers replace recurrent and convolutional models.'),
        ('Le et al., 2018', 'URLNet learns URL representations directly from raw text.'),
        ('Devlin et al., 2019', 'BERT: pre-train once, fine-tune per task.'),
        ('Hu et al., 2021', 'LoRA adapts a frozen model with small low-rank updates.'),
    ], 'Opaque: a probability, not evidence an analyst can check.'),
    ('2012 – 2018', 'SPECIALISED SIGNALS', True, [
        ('Antonakakis et al., 2012', 'DGA domains look random (high entropy, few vowels, mixed digits); detect whole families.'),
        ('Khonji et al., 2013', 'Survey of 70+ works: combining lexical, content and reputation features works best.'),
        ('Anderson & Roth, 2018', 'EMBER: an open feature set and benchmark for malware files.'),
    ], 'Each signal sees only one part of an attack.'),
]
LIT2_COLS = [
    ('§2.6 – 2.7, §2.9.3', 'THREAT INTELLIGENCE', [
        ('Liao et al., 2016', 'IOCs extracted automatically from open threat reports.'),
        ('Barnum, 2012', 'STIX: a structured language for sharing threat information.'),
        ('Tounsi & Rais, 2018', 'Shared knowledge of malicious domains, IPs and infrastructure.'),
        ('Strom et al., 2018', 'MITRE ATT&CK: tactics and techniques with IDs, a common language.'),
    ], 'IOC extractor, MITRE mapper and the OTX lookup.'),
    ('§2.8, §2.9.1', 'AGENTS & LANGUAGE MODELS', [
        ('Wooldridge, 2009; Russell & Norvig, 2020', 'Many agents, each with one job, solve what one system cannot.'),
        ('Wei et al., 2022', 'Step-by-step reasoning improves multi-step analysis.'),
        ('Yao et al., 2023', 'ReAct: reason, act, observe, then reason again.'),
        ('Park et al., 2023', 'Generative agents keep memory and act consistently over time.'),
    ], 'Eight specialist agents in a dependency graph, with domain memory.'),
]
GAPS = [
    ('FEW COMPLETE MULTI-AGENT SECURITY SYSTEMS', 'Agent frameworks mostly stop at demos and partial workflows.',
     'A working end-to-end URL pipeline: eight agents and a Reporter.'),
    ('SILENT MODEL AND SERVICE FAILURE', 'A model that fails can look like a "safe" result.',
     'Explicit unavailable and unknown states; fallbacks name their source.'),
    ('ACCURACY OVER FALSE ALARMS', 'Lab F1 scores hide how often safe sites are flagged (Sommer & Paxson, 2010).',
     'Signals from several agents combined into one verdict.'),
    ('HISTORY RARELY REUSED', 'Each visit is usually judged on its own.',
     'Domain memory raises the score of a site flagged before; its effect is not yet measured.'),
]
LIT1_NOTES = (
    'The literature shows detection moving through four kinds of approach. Rules and hand-made features came first: '
    'Provos et al. (2007) found drive-by downloads on 1.3% of sampled pages and predicted short-lived domains and '
    'polymorphic scripts; Mohammad, Thabtah and McCluskey (2014) showed URL and HTML features work under controlled '
    'conditions, but attackers change URLs once they know the rules. Classical machine learning learned from data: '
    'Sommer and Paxson (2010) warned about costly errors, missing ground truth and output analysts cannot use; Buczak and '
    'Guven (2016) list concept drift and imbalance; Sahingoz et al. (2019) report very high accuracy for random forests on '
    'lexical URL features, still bound by feature engineering. Deep learning removed hand-made features: Transformers '
    '(Vaswani et al., 2017), URLNet (Le et al., 2018), BERT (Devlin et al., 2019) and LoRA (Hu et al., 2021), which we use '
    'for the assistant; but a probability alone is not evidence. Specialised signals matter too: DGA detection '
    '(Antonakakis et al., 2012), the survey by Khonji et al. (2013), which finds combined lexical, content and reputation '
    'features work best, and the EMBER malware benchmark (Anderson & Roth, 2018). The lesson for CyberForge: no single '
    'signal is enough, so several specialists must be combined. Click once per column. Source: thesis Chapter 2, §2.2–2.5.'
)
LIT2_NOTES = (
    'Two further lines of work shape the design. Threat intelligence gives shared names for evidence: IOC extraction from '
    'reports (Liao et al., 2016), STIX for sharing (Barnum, 2012), threat-intelligence practice (Tounsi & Rais, 2018) and '
    'MITRE ATT&CK (Strom et al., 2018); CyberForge\'s IOC extractor, MITRE mapper and OTX lookup follow this. Agents and '
    'language models give the structure: multi-agent systems (Wooldridge, 2009; Russell & Norvig, 2020), step-by-step '
    'reasoning (Wei et al., 2022), ReAct\'s reason-act-observe loop (Yao et al., 2023) and agents with memory (Park et al., '
    '2023). The thesis names four gaps (§2.10): few complete multi-agent security systems, silent failure of models and '
    'services, a focus on accuracy instead of false alarms, and little reuse of history. CyberForge answers each, and for the '
    'fourth we are explicit that the effect of memory has not yet been measured. Click once per column, then once per gap.'
)


def lit_column(kit, x, y, w, h, tag, title, items, foot_label, foot, hot=False):
    kids = kit.box(x, y, w, h, radius=9000, name='Era')
    kids.append(kit.words(x + 0.28, y + 0.18, w - 0.45, 1.05, [
        kit.p([kit.osw(tag, 1350, 'C1FF72')]),
        kit.p([kit.osw(title, 2100, 'C1FF72' if hot else 'EDEDED')], before=100),
    ], name='Era head'))
    paras = []
    for i, (who, what) in enumerate(items):
        paras.append(kit.p([kit.osw(who, 1700, 'EDEDED')], before=0 if i == 0 else 1500))
        paras.append(kit.p([kit.tit(what, 1550)], before=150))
    kids.append(kit.words(x + 0.28, y + 1.3, w - 0.45, h - 3.05, paras, name='Era works'))
    fy = y + h - 1.62
    kids.append(kit.chip(x + 0.2, fy, w - 0.4, 1.42, fill='33402A' if hot else '333337', name='Era limit'))
    kids.append(kit.words(x + 0.36, fy, w - 0.68, 1.42, [
        kit.p([kit.osw(foot_label, 1350, 'C1FF72')]),
        kit.p([kit.tit(foot, 1500, 'EDEDED')], before=100),
    ], anchor='ctr', name='Era limit text'))
    return kids


def shrink_photo(slide, w=2.27, h=1.45):
    pic = slide.xpath('.//p:pic[p:nvPicPr/p:cNvPr/@name="!!photo"]', namespaces=NS)
    if pic:
        set_xfrm(pic[0].find('p:spPr/a:xfrm', NS), emu(18.9 - w), emu(1.15), emu(w), emu(h))


def build_literature_1(slide, kit):
    tree = clear_content(slide, keep_names=('Kicker', 'Title', 'Subtitle', 'Source', 'Page', '!!seg', '!!photo'))
    shrink_photo(slide)
    header(slide, kicker='05  ·  BRIEF LITERATURE REVIEW  ·  1 OF 2',
           subtitle='Detection research: from fixed rules to learned models, and why one signal is not enough',
           source='Thesis Chapter 2 (§2.2–2.5); full references on the final slide')
    top, h, gap = 2.85, 7.5, 0.3
    w = (17.8 - 3 * gap) / 4
    clicks = []
    for i, (years, era, hot, items, limit) in enumerate(LIT1):
        gid, g = kit.group(f'Era {i + 1}', lit_column(kit, 1.1 + i * (w + gap), top, w, h, years, era, items, 'LIMIT', limit, hot))
        tree.append(g); clicks.append([gid])
    click_timing(slide, clicks)


def build_literature_2(slide, kit):
    tree = clear_content(slide, keep_names=('Kicker', 'Title', 'Subtitle', 'Source', 'Page', '!!seg', '!!photo'))
    shrink_photo(slide)
    header(slide, kicker='05  ·  BRIEF LITERATURE REVIEW  ·  2 OF 2',
           subtitle='Threat intelligence, agents and language models, and the gaps CyberForge addresses',
           source='Thesis Chapter 2 (§2.6–2.10); full references on the final slide')
    top, h = 2.85, 7.5
    clicks = []
    for i, (tag, title, items, use) in enumerate(LIT2_COLS):
        gid, g = kit.group(f'Field {i + 1}', lit_column(kit, 1.1 + i * 4.7, top, 4.4, h, tag, title, items, 'IN CYBERFORGE', use))
        tree.append(g); clicks.append([gid])
    gx, gw = 10.5, 8.4
    row_h, row_gap, rows_top = 1.38, 0.14, top + 1.28
    panel = kit.box(gx, top, gw, h, radius=6000, name='Gaps')
    panel.append(kit.words(gx + 0.3, top + 0.18, gw - 0.5, 1.0, [
        kit.p([kit.osw('THESIS §2.10', 1350, 'C1FF72')]),
        kit.p([kit.osw('RESEARCH GAPS  →  CYBERFORGE', 2100)], before=100),
    ], name='Gaps head'))
    for k, (title, prior, ours) in enumerate(GAPS):
        ry = rows_top + k * (row_h + row_gap)
        kids = [kit.chip(gx + 0.2, ry, gw - 0.4, row_h, fill='333337', radius=16000, name='Gap'),
                kit.words(gx + 0.42, ry, gw - 0.75, row_h, [
                    kit.p([kit.osw(f'GAP {k + 1}   ', 1500, 'C1FF72'), kit.osw(title, 1500)]),
                    kit.p([kit.tit('Prior work: ', 1350, '8E8E93'), kit.tit(prior, 1350)], before=150),
                    kit.p([kit.tit('CyberForge: ', 1350, 'C1FF72'), kit.tit(ours, 1350, 'EDEDED')], before=50),
                ], anchor='ctr', name='Gap text')]
        if k == 0:
            kids = panel + kids
        gid, g = kit.group(f'Gap {k + 1}', kids)
        tree.append(g); clicks.append([gid])
    click_timing(slide, clicks)


# ── multi-agent architecture ──
MULTI_NOTES = (
    'This is how the agents work together. A URL visit goes to the orchestrator (agentOrchestrator.analyze). It runs the '
    'agents as a dependency graph in three stages: each stage runs its agents in parallel, and the next stage waits for the '
    'results it needs. Stage 1 needs no input: the URL classifier asks the BERT model on the ML service, the DGA detector '
    'checks the host name, the web scraper loads the page through the rendered-page scanner, and the memory reader '
    'recalls the domain\'s history. Stage 2 needs the scraped page: the IOC extractor collects domains, IPs, URLs, hashes '
    'and wallets from the page and its requests, and the behavioural analyser judges forms, scripts, cookies and redirects. '
    'Stage 3 needs the IOCs: the MITRE mapper names ATT&CK techniques, and the threat-intelligence agent checks up to five '
    'IOCs in AlienVault OTX. Every agent is timed and wrapped, so one crash cannot stop the others; a failed agent is kept '
    'in the results as failed and reported as a gap. All eight results go to the Reporter, which weighs the evidence, '
    'applies the domain-history multiplier, decides the verdict, has the language-model chain write the explanation (the '
    'model never sets the score) and stores the alert, the domain memory and a vector record. Click once per stage, then '
    'for the design notes, then for the Reporter. Source: backend/src/services/agentOrchestrator.js.'
)
STAGE_NODES = {  # column: [(row, name, role, uses)]
    1: [(0, 'URL CLASSIFIER', 'phishing or malware label', 'ML service · BERT'),
        (1, 'DGA DETECTOR', 'machine-generated host name?', 'ML service · DGA model'),
        (2, 'WEB SCRAPER', 'the page in a real browser', 'rendered-page scanner'),
        (3, 'MEMORY READER', 'this domain\'s history', 'memory service')],
    2: [(1, 'IOC EXTRACTOR', 'domains, IPs, URLs, hashes', 'page + its requests'),
        (2, 'BEHAVIOURAL ANALYSER', 'forms, scripts, redirects', 'rules on page evidence')],
    3: [(1, 'MITRE MAPPER', 'ATT&CK techniques', 'page signals + IOCs'),
        (2, 'THREAT INTELLIGENCE', 'known-bad indicators', 'AlienVault OTX')],
}
STAGE_HEADS = {1: ('STAGE 1', 'in parallel · needs nothing'), 2: ('STAGE 2', 'waits for the page'), 3: ('STAGE 3', 'waits for the IOCs')}


def build_multiagent(slide, kit):
    tree = clear_content(slide)
    header(slide, title='MULTI-AGENT ARCHITECTURE',
           subtitle='An orchestrator runs eight specialist agents as a dependency graph; a Reporter decides',
           source='backend/src/services/agentOrchestrator.js (AgentOrchestrator, eight agents, ReportAgent); Thesis §3.8')
    top, bottom = 2.85, 10.35
    ox, ow = 1.1, 2.85
    sx = {1: 4.35, 2: 8.2, 3: 12.05}
    sw = 3.45
    rx, rw = 15.9, 3.0
    row0, row_step, node_h = 3.77, 1.3, 1.12
    ry = lambda k: row0 + k * row_step
    rc = lambda k: ry(k) + node_h / 2

    def node(col, k, name, role, uses):
        x = sx[col]
        return kit.box(x, ry(k), sw, node_h, radius=16000, name='Agent') + [
            kit.words(x + 0.25, ry(k), sw - 0.35, node_h, [
                kit.p([kit.osw(name, 1550)]),
                kit.p([kit.tit(role, 1300)], before=0),
                kit.p([kit.tit('→ ' + uses, 1250, 'C1FF72')], before=0),
            ], anchor='ctr', name='Agent text')]

    def stage_head(col):
        t, sub = STAGE_HEADS[col]
        x = sx[col]
        return [kit.chip(x, top, sw, 0.72, fill='33402A', radius=30000, name='Stage'),
                kit.words(x + 0.25, top, sw - 0.35, 0.72, [kit.p([kit.osw(t + '   ', 1600, 'C1FF72'), kit.tit(sub, 1300, 'D6D6D9')])],
                          anchor='ctr', name='Stage text')]

    clicks = []
    # click 1: orchestrator, fan-out, stage 1
    orch = kit.box(ox, top, ow, bottom - top, radius=8000, name='Orchestrator')
    items = [('INPUT', 'URL, session and user'),
             ('SCHEDULING', 'each stage runs in parallel; the next stage waits'),
             ('ISOLATION', 'every agent is timed and wrapped; one crash cannot stop the rest'),
             ('HONESTY', 'a failed agent is a reported gap, never "safe"'),
             ('OUTPUT', 'one report: verdict, score, findings, coverage')]
    paras = [kit.p([kit.osw('ORCHESTRATOR', 2000, 'C1FF72')]), kit.p([kit.tit('agentOrchestrator.analyze(url)', 1200, '8E8E93')], before=50)]
    for label, text in items:
        paras += [kit.p([kit.osw(label, 1600)], before=1500), kit.p([kit.tit(text, 1450)], before=80)]
    orch.append(kit.words(ox + 0.22, top + 0.2, ow - 0.34, bottom - top - 0.4, paras, name='Orchestrator text'))
    for k in range(4):
        orch.append(kit.line(ox + ow + 0.06, rc(k), sx[1] - 0.06, name='Fan-out'))
    kids = orch + stage_head(1)
    for k, *rest in STAGE_NODES[1]:
        kids += node(1, k, *rest)
    gid, g = kit.group('Stage 1', kids); tree.append(g); clicks.append([gid])
    # click 2: stage 2 and its inputs from the scraper
    kids = stage_head(2)
    for k, *rest in STAGE_NODES[2]:
        kids += node(2, k, *rest)
    x1, x2 = sx[1] + sw + 0.04, sx[2] - 0.04
    kids += [kit.elbow(x1, rc(2), x2, rc(1), name='page → IOC'), kit.line(x1, rc(2), x2, name='page → behaviour')]
    gid, g = kit.group('Stage 2', kids); tree.append(g); clicks.append([gid])
    # click 3: stage 3 and its inputs from the IOC extractor
    kids = stage_head(3)
    for k, *rest in STAGE_NODES[3]:
        kids += node(3, k, *rest)
    x1, x2 = sx[2] + sw + 0.04, sx[3] - 0.04
    kids += [kit.line(x1, rc(1), x2, name='IOC → MITRE'), kit.elbow(x1, rc(1), x2, rc(2), name='IOC → OTX')]
    gid, g = kit.group('Stage 3', kids); tree.append(g); clicks.append([gid])
    # click 4: design notes in the free rows of stages 2–3
    nx, nw = sx[2], sx[3] + sw - sx[2]
    notes = [(0, 'WHY A DEPENDENCY GRAPH', 'Independent agents run together, so a visit waits for the slowest agent in each stage, not for all eight in turn.'),
             (3, 'DATA PASSED BETWEEN STAGES', '1 → 2: the page evidence (forms, scripts, cookies, requests).  2 → 3: up to 100 unique IOCs.  No input: that agent fails and the gap is reported.')]
    kids = []
    for k, t, body in notes:
        kids += [kit.chip(nx, ry(k), nw, node_h, fill='333337', radius=16000, name='Design note'),
                 kit.words(nx + 0.25, ry(k), nw - 0.4, node_h, [kit.p([kit.osw(t, 1450, 'C1FF72')]), kit.p([kit.tit(body, 1300, 'D6D6D9')], before=50)],
                           anchor='ctr', name='Design note text')]
    gid, g = kit.group('Design notes', kids); tree.append(g); clicks.append([gid])
    # click 5: results bus and the Reporter
    by = ry(3) + node_h + 0.26
    kids = [kit.chip(sx[1], by, sx[3] + sw - sx[1], bottom - by, fill='33402A', radius=30000, name='Results bus'),
            kit.words(sx[1] + 0.3, by, sx[3] + sw - sx[1] - 0.5, bottom - by, [
                kit.p([kit.osw('RESULTS BUS   ', 1550, 'C1FF72'),
                       kit.tit('every agent returns { agent, status, ms, result }; failed agents stay in the list as failed', 1350, 'EDEDED')])],
                anchor='ctr', name='Results bus text'),
            kit.line(sx[3] + sw + 0.06, by + (bottom - by) / 2, rx - 0.06, name='Bus → Reporter')]
    rep_ = kit.box(rx, top, rw, bottom - top, radius=8000, name='Reporter')
    steps = [('1  WEIGH', 'URL model 30 · page 35 · behaviour 25 · OTX 40 · ATT&CK 15 · DGA 10 · IOCs 8'),
             ('2  ADJUST', '× domain history (up to +50%), cap at 100'),
             ('3  DECIDE', '65+ malicious · 35+ suspicious · 15+ low risk; unobserved page = unknown'),
             ('4  EXPLAIN', 'the LLM chain writes the summary; it never sets the score'),
             ('5  STORE', 'alert if risk ≥ 25, domain memory, vector record')]
    paras = [kit.p([kit.osw('REPORTER', 2000, 'C1FF72')]), kit.p([kit.tit('ReportAgent', 1200, '8E8E93')], before=50)]
    for label, text in steps:
        paras += [kit.p([kit.osw(label, 1600)], before=1300), kit.p([kit.tit(text, 1450)], before=80)]
    rep_.append(kit.words(rx + 0.22, top + 0.2, rw - 0.34, bottom - top - 0.4, paras, name='Reporter text'))
    gid, g = kit.group('Reporter', kids + rep_); tree.append(g); clicks.append([gid])
    click_timing(slide, clicks)


def duplicate_slide(files, src_n, new_n, after_n):
    """Copy slide src_n (and its notes) to a new part slide{new_n}, placed after slide{after_n}."""
    files[f'ppt/slides/slide{new_n}.xml'] = files[f'ppt/slides/slide{src_n}.xml']
    rels_src = files[f'ppt/slides/_rels/slide{src_n}.xml.rels'].decode('utf-8')
    note = re.search(r'notesSlide(\d+)\.xml', rels_src).group(1)
    files[f'ppt/slides/_rels/slide{new_n}.xml.rels'] = rels_src.replace(f'notesSlide{note}.xml', f'notesSlide{new_n}.xml').encode('utf-8')
    files[f'ppt/notesSlides/notesSlide{new_n}.xml'] = files[f'ppt/notesSlides/notesSlide{note}.xml']
    files[f'ppt/notesSlides/_rels/notesSlide{new_n}.xml.rels'] = files[f'ppt/notesSlides/_rels/notesSlide{note}.xml.rels'].replace(
        f'slides/slide{src_n}.xml'.encode(), f'slides/slide{new_n}.xml'.encode())
    ct = parse(files['[Content_Types].xml'])
    for part, kind in ((f'/ppt/slides/slide{new_n}.xml', 'slide'), (f'/ppt/notesSlides/notesSlide{new_n}.xml', 'notesSlide')):
        o = E.SubElement(ct, f'{{{NS["ct"]}}}Override')
        o.set('PartName', part); o.set('ContentType', f'application/vnd.openxmlformats-officedocument.presentationml.{kind}+xml')
    files['[Content_Types].xml'] = serial(ct)
    rels = parse(files['ppt/_rels/presentation.xml.rels'])
    rid = 'rId%d' % (max(int(r.get('Id')[3:]) for r in rels) + 1)
    rel = E.SubElement(rels, f'{{{NS["pr"]}}}Relationship')
    rel.set('Id', rid); rel.set('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'); rel.set('Target', f'slides/slide{new_n}.xml')
    files['ppt/_rels/presentation.xml.rels'] = serial(rels)
    pres = parse(files['ppt/presentation.xml'])
    lst = pres.find('p:sldIdLst', NS)
    rel_of = {r.get('Id'): r.get('Target') for r in rels}
    after = next(s_ for s_ in lst if rel_of[s_.get(f'{{{NS["r"]}}}id')] == f'slides/slide{after_n}.xml')
    new = E.Element(f'{{{P}}}sldId'); new.set('id', str(max(int(s_.get('id')) for s_ in lst) + 1)); new.set(f'{{{NS["r"]}}}id', rid)
    after.addnext(new)
    files['ppt/presentation.xml'] = serial(pres)


def set_notes(files, n, text):
    part = f'ppt/notesSlides/notesSlide{n}.xml'
    root = parse(files[part])
    body = root.xpath('.//p:sp[.//p:ph/@type="body"]/p:txBody', namespaces=NS)[0]
    ts = [t for t in body.iter(f'{{{A}}}t')]
    ts[0].text = text
    for t in ts[1:]:
        t.text = ''
    files[part] = serial(root)


def slide_order(files):
    rels = parse(files['ppt/_rels/presentation.xml.rels'])
    rel_of = {r.get('Id'): r.get('Target') for r in rels}
    lst = parse(files['ppt/presentation.xml']).find('p:sldIdLst', NS)
    return [int(re.search(r'slide(\d+)\.xml', rel_of[s_.get(f'{{{NS["r"]}}}id')]).group(1)) for s_ in lst]


# ── V9 literature review: chatbots → agentic AI → multi-agent → cybersecurity ──
EVOLUTION = [  # (years, stage, what changed, references)
    ('1966 →', 'RULE-BASED CHATBOTS', 'Scripted pattern matching: ELIZA rephrased the user\'s words. No understanding, no actions.', 'Weizenbaum, 1966'),
    ('2017 – 2020', 'LARGE LANGUAGE MODELS', 'Transformers and pre-training: one model writes, summarises and answers many tasks.', 'Vaswani et al., 2017; Brown et al., 2020'),
    ('2022', 'INSTRUCTION-TUNED ASSISTANTS', 'Tuned with human feedback to follow instructions in conversation. Still only answers.', 'Ouyang et al., 2022'),
    ('2022 – 2023', 'REASONING & TOOLS', 'Step-by-step reasoning, reason–act–observe loops and learned tool calls.', 'Wei et al., 2022; Yao et al., 2023; Schick et al., 2023'),
    ('2023 →', 'AGENTIC AI', 'Goal-driven systems that plan, act through tools, remember and finish multi-step work.', 'Park et al., 2023; Wang et al., 2024'),
]
AGENTIC_DEF = ('Given a goal rather than a single prompt, an agentic system plans the steps, acts through tools, '
               'observes the results and adapts, with limited human supervision.')
AGENTIC_TRAITS = [
    ('PLANNING', 'breaks a goal into steps and revises them as results arrive', 'Yao et al., 2023'),
    ('TOOL USE & ACTION', 'calls search, code, APIs or other models, not only text', 'Schick et al., 2023'),
    ('MEMORY', 'keeps observations across steps and sessions to stay consistent', 'Park et al., 2023'),
    ('OVERSIGHT', 'needs limits, approvals and logs, because its actions have effects', 'Shavit et al., 2023'),
]
MAS_BLOCKS = [
    ('MANY AGENTS, ONE GOAL', 'Several agents, each with one role, cooperate on a problem too large for one system.',
     'Wooldridge, 2009; Russell & Norvig, 2020', False),
    ('HOW AGENTS ARE COORDINATED', 'In sequence, all in parallel, or as a dependency graph where each agent waits only for the inputs it needs.',
     'Thesis §2.8.3', False),
    ('LLM MULTI-AGENT FRAMEWORKS', 'Role-playing agents (CAMEL), conversing agents (AutoGen) and software-team workflows (MetaGPT).',
     'Li et al., 2023; Wu et al., 2023; Hong et al., 2024; survey: Guo et al., 2024', False),
    ('IN CYBERFORGE', 'Eight specialist agents in a three-stage dependency graph; a Reporter combines their evidence.',
     'Slides 9–10', True),
]
SEC_BLOCKS = [
    ('MACHINE LEARNING FOR DETECTION', 'Learned URL, malware and intrusion detectors, held back by false alarms and output analysts cannot act on.',
     'Sommer & Paxson, 2010; Khonji et al., 2013; Buczak & Guven, 2016', False),
    ('SHARED THREAT KNOWLEDGE', 'IOC extraction, threat-intelligence feeds and MITRE ATT&CK give evidence common names.',
     'Liao et al., 2016; Tounsi & Rais, 2018; Strom et al., 2018', False),
    ('LLM AGENTS IN SECURITY', 'Agents now plan penetration tests and exploit known vulnerabilities; defenders need agents too.',
     'Deng et al., 2024; Fang et al., 2024', False),
    ('NEW RISKS', 'An agent that reads web content can be steered by instructions hidden in it, so its actions need limits.',
     'Greshake et al., 2023', False),
    ('THE GAP CYBERFORGE FILLS', 'Few complete, open multi-agent systems protect users in real time with checkable evidence and honest failure states.',
     'Thesis §2.10', True),
]
LIT1_NOTES_V9 = (
    'This slide traces how conversational AI became agentic AI. It started with rule-based chatbots: ELIZA (Weizenbaum, 1966) '
    'matched patterns and rephrased the user\'s words, with no understanding and no ability to act. Transformers (Vaswani et al., '
    '2017) and large pre-trained models such as GPT-3 (Brown et al., 2020) let one model write, summarise and answer across many tasks. '
    'Instruction tuning with human feedback (Ouyang et al., 2022) produced the conversational assistants people now know as chatbots, '
    'but they still only answer. Reasoning and tools came next: step-by-step reasoning (Wei et al., 2022), the ReAct loop of '
    'reason, act and observe (Yao et al., 2023), and models that learn to call tools (Schick et al., 2023). Agentic AI is the result: '
    'systems given a goal rather than a single prompt, which plan, act through tools, observe and adapt, with memory (Park et al., 2023) '
    'and limited human supervision (Wang et al., 2024; Xi et al., 2023). Four properties make a system agentic: planning, tool use and '
    'action, memory, and oversight, because an agent\'s actions have real effects and need limits, approvals and logs (Shavit et al., 2023). '
    'CyberForge\'s agents act on evidence (fetching pages, querying models and threat feeds) but take no action on the user\'s behalf '
    'without consent. Click once per stage of the timeline, once for the definition, then once per property (10 clicks).'
)
LIT2_NOTES_V9 = (
    'Multi-agent architecture: instead of one system doing everything, several agents with one role each cooperate on a larger '
    'problem (Wooldridge, 2009; Russell & Norvig, 2020). They can run in sequence, all in parallel, or as a dependency graph where each '
    'agent waits only for the inputs it needs; CyberForge uses the graph. Language-model frameworks have revived the idea: role-playing '
    'agents in CAMEL (Li et al., 2023), conversing agents in AutoGen (Wu et al., 2023) and software-team workflows in MetaGPT '
    '(Hong et al., 2024), surveyed by Guo et al. (2024). In CyberForge, eight specialist agents run in three stages and a Reporter '
    'combines their evidence. AI in cybersecurity: machine-learning detectors for URLs, malware and intrusions work, but false alarms '
    'and output analysts cannot act on have held them back (Sommer & Paxson, 2010; Khonji et al., 2013; Buczak & Guven, 2016). Shared '
    'threat knowledge gives evidence common names: IOC extraction (Liao et al., 2016), threat intelligence (Tounsi & Rais, 2018) and '
    'MITRE ATT&CK (Strom et al., 2018). Agentic AI is now used on both sides: LLM agents plan penetration tests (Deng et al., 2024) and '
    'can exploit known vulnerabilities (Fang et al., 2024), so defenders need agents too; but agents that read web content can be '
    'steered by instructions hidden in it (Greshake et al., 2023), so their actions must be limited. The gap (thesis §2.10): few '
    'complete, open multi-agent systems protect users in real time with checkable evidence and honest failure states. Click once per '
    'block: four on the left, then five on the right (9 clicks).'
)
NEW_REFERENCES = [
    'Brown et al. (2020) — GPT-3: few-shot learners',
    'Deng et al. (2024) — PentestGPT',
    'Fang et al. (2024) — LLM agents exploit one-day flaws',
    'Greshake et al. (2023) — indirect prompt injection',
    'Guo et al. (2024) — LLM multi-agent survey',
    'Hong et al. (2024) — MetaGPT',
    'Li et al. (2023) — CAMEL',
    'Ouyang et al. (2022) — instruction tuning with feedback',
    'Schick et al. (2023) — Toolformer',
    'Shavit et al. (2023) — governing agentic AI',
    'Wang et al. (2024) — LLM-based autonomous agents',
    'Weizenbaum (1966) — ELIZA',
    'Wu et al. (2023) — AutoGen',
    'Xi et al. (2023) — rise of LLM-based agents',
]
FULL_CITATIONS = [
    'Brown, T. et al. (2020). Language models are few-shot learners. *Advances in Neural Information Processing Systems*, 33.',
    'Deng, G. et al. (2024). PentestGPT: Evaluating and harnessing large language models for automated penetration testing. *33rd USENIX Security Symposium*.',
    'Fang, R., Bindu, R., Gupta, A. & Kang, D. (2024). LLM agents can autonomously exploit one-day vulnerabilities. arXiv:2404.08144.',
    "Greshake, K. et al. (2023). Not what you've signed up for: Compromising real-world LLM-integrated applications with indirect prompt injection. *ACM Workshop on Artificial Intelligence and Security (AISec)*.",
    'Guo, T. et al. (2024). Large language model based multi-agents: A survey of progress and challenges. *IJCAI 2024*.',
    'Hong, S. et al. (2024). MetaGPT: Meta programming for a multi-agent collaborative framework. *ICLR 2024*.',
    'Li, G. et al. (2023). CAMEL: Communicative agents for "mind" exploration of large language model society. *NeurIPS 2023*.',
    'Ouyang, L. et al. (2022). Training language models to follow instructions with human feedback. *Advances in Neural Information Processing Systems*, 35.',
    'Schick, T. et al. (2023). Toolformer: Language models can teach themselves to use tools. *NeurIPS 2023*.',
    'Shavit, Y. et al. (2023). Practices for governing agentic AI systems. OpenAI white paper.',
    'Wang, L. et al. (2024). A survey on large language model based autonomous agents. *Frontiers of Computer Science*, 18(6), 186345.',
    'Weizenbaum, J. (1966). ELIZA: A computer program for the study of natural language communication between man and machine. *Communications of the ACM*, 9(1), 36–45.',
    'Wu, Q. et al. (2023). AutoGen: Enabling next-gen LLM applications via multi-agent conversation. arXiv:2308.08155.',
    'Xi, Z. et al. (2023). The rise and potential of large language model based agents: A survey. arXiv:2309.07864.',
]
HARDWARE_OLD = 'L4 for separate training Jobs; cpu-basic Space for inference. Training and serving are isolated.'
HARDWARE_NEW = 'L4 for separate training Jobs; NVIDIA T4 GPU Space for inference. Training and serving are isolated.'
DESKTOP_NOTES_ADD = (' Inference runs on the Hugging Face Space with an NVIDIA T4 GPU (since November 2026); training runs separately '
                     'as Hugging Face Jobs on an NVIDIA L4.')


def block_kids(kit, x, y, w, h, title, body, refs, hot):
    return [kit.chip(x, y, w, h, fill='33402A' if hot else '333337', radius=14000, name='Block'),
            kit.words(x + 0.25, y, w - 0.4, h, [
                kit.p([kit.osw(title, 1550, 'C1FF72' if hot else 'EDEDED')]),
                kit.p([kit.tit(body, 1400, 'EDEDED' if hot else 'D6D6D9')], before=60),
                kit.p([kit.tit(refs, 1200, 'C1FF72' if hot else '8E8E93')], before=60),
            ], anchor='ctr', name='Block text')]


def build_lit_evolution(slide, kit):
    tree = clear_content(slide, keep_names=('Kicker', 'Title', 'Subtitle', 'Source', 'Page', '!!seg', '!!photo'))
    shrink_photo(slide)
    header(slide, kicker='05  ·  BRIEF LITERATURE REVIEW  ·  1 OF 2',
           subtitle='From common chatbots to agentic AI, and what makes a system agentic',
           source='Thesis Chapter 2 (§2.8–2.9) and the added works on the final slide')
    clicks = []
    top, h, gap = 2.85, 3.45, 0.38
    w = (17.8 - 4 * gap) / 5
    for i, (years, stage, what, refs) in enumerate(EVOLUTION):
        x = 1.1 + i * (w + gap)
        hot = i == len(EVOLUTION) - 1
        kids = kit.box(x, top, w, h, radius=12000, name='Stage')
        kids.append(kit.words(x + 0.25, top + 0.18, w - 0.4, h - 0.36, [
            kit.p([kit.osw(years, 1550, 'C1FF72')]),
            kit.p([kit.osw(stage, 2050, 'C1FF72' if hot else 'EDEDED')], before=150),
            kit.p([kit.tit(what, 1650, 'D6D6D9')], before=700),
            kit.p([kit.tit(refs, 1300, '8E8E93')], before=900),
        ], name='Stage text'))
        if i:
            kids.append(kit.line(x - gap + 0.05, top + h / 2, x - 0.05, name='Evolution arrow'))
        gid, g = kit.group(f'Evolution {i + 1}', kids)
        tree.append(g); clicks.append([gid])
    # what makes AI agentic
    py, ph = top + h + 0.3, 10.35 - (top + h + 0.3)
    panel = kit.box(1.1, py, 17.8, ph, radius=7000, name='Agentic')
    panel.append(kit.words(1.4, py + 0.25, 4.7, ph - 0.5, [
        kit.p([kit.osw('WHAT MAKES AI AGENTIC', 1400, 'C1FF72')]),
        kit.p([kit.osw('AGENTIC AI', 2400)], before=100),
        kit.p([kit.tit(AGENTIC_DEF, 1450, 'D6D6D9')], before=300),
        kit.p([kit.tit('Wang et al., 2024; Xi et al., 2023', 1200, '8E8E93')], before=300),
    ], name='Agentic text'))
    gid, g = kit.group('Agentic AI', panel); tree.append(g); clicks.append([gid])
    cx0, cw, cgap = 6.4, (18.6 - 6.4 - 0.3) / 2, 0.3
    chh = (ph - 0.5 - 0.25) / 2
    for k, (title, body, refs) in enumerate(AGENTIC_TRAITS):
        x = cx0 + (k % 2) * (cw + cgap)
        y = py + 0.25 + (k // 2) * (chh + 0.25)
        gid, g = kit.group(f'Trait {k + 1}', block_kids(kit, x, y, cw, chh, title, body, refs, False))
        tree.append(g); clicks.append([gid])
    click_timing(slide, clicks)


def build_lit_agents_security(slide, kit):
    tree = clear_content(slide, keep_names=('Kicker', 'Title', 'Subtitle', 'Source', 'Page', '!!seg', '!!photo'))
    shrink_photo(slide)
    header(slide, kicker='05  ·  BRIEF LITERATURE REVIEW  ·  2 OF 2',
           subtitle='Multi-agent architecture, and AI and agentic AI in cybersecurity',
           source='Thesis Chapter 2 (§2.2–2.10) and the added works on the final slide')
    clicks = []
    top, bottom, pw = 2.85, 10.35, 8.75
    for side, (x, tag, title, blocks) in enumerate((
            (1.1, 'COOPERATING AGENTS', 'MULTI-AGENT ARCHITECTURE', MAS_BLOCKS),
            (1.1 + pw + 0.3, 'DETECTION, INTELLIGENCE AND AGENTS', 'AI & AGENTIC AI IN CYBERSECURITY', SEC_BLOCKS))):
        panel = kit.box(x, top, pw, bottom - top, radius=6000, name='Topic')
        panel.append(kit.words(x + 0.3, top + 0.18, pw - 0.5, 1.0, [
            kit.p([kit.osw(tag, 1400, 'C1FF72')]),
            kit.p([kit.osw(title, 2100)], before=100),
        ], name='Topic head'))
        btop, bgap = top + 1.3, 0.16
        bh = (bottom - 0.2 - btop - (len(blocks) - 1) * bgap) / len(blocks)
        for k, (t, body, refs, hot) in enumerate(blocks):
            kids = block_kids(kit, x + 0.2, btop + k * (bh + bgap), pw - 0.4, bh, t, body, refs, hot)
            if k == 0:
                kids = panel + kids
            gid, g = kit.group(f'{title.title()} {k + 1}', kids)
            tree.append(g); clicks.append([gid])
    click_timing(slide, clicks)


def update_references(slide):
    """Add the new works to the reference roll, alphabetically, at a size that fits."""
    roll = slide.xpath('.//p:sp[starts-with(p:nvSpPr/p:cNvPr/@name, "References roll")]', namespaces=NS)[0]
    body = roll.find('p:txBody', NS)
    paras = body.findall('a:p', NS)
    entries = [p for p in paras if ''.join(t.text or '' for t in p.iter(f'{{{A}}}t')).strip() and
               ''.join(t.text or '' for t in p.iter(f'{{{A}}}t')).strip() != 'REFERENCES']
    template = deepcopy(entries[0])
    texts = [''.join(t.text or '' for t in p.iter(f'{{{A}}}t')) for p in entries]
    for p in entries:
        body.remove(p)
    for text in sorted(set(texts + NEW_REFERENCES), key=lambda t: t.lower()):
        p = deepcopy(template)
        ts = list(p.iter(f'{{{A}}}t')); ts[0].text = text
        for t in ts[1:]:
            t.text = ''
        p.find('a:pPr/a:lnSpc/a:spcPct', NS).set('val', '100000')
        for r in p.iter(f'{{{A}}}rPr'):
            r.set('sz', '1150')
        body.append(p)


def main():
    files = {}
    with ZipFile(SOURCE) as z:
        for info in z.infolist():
            files[info.filename] = z.read(info.filename)

    # ── new slides: agent detail (after slide 8) and literature review 2 of 2 (after slide 6) ──
    duplicate_slide(files, 9, 21, 9)
    duplicate_slide(files, 6, 22, 6)
    assert slide_order(files) == ORDER, slide_order(files)
    kit = Kit(parse(files[ARCH]))

    # ── the new slide and the corrected pipeline slide ──
    slide = parse(files[AGENTS]); build_agents_slide(slide)
    click_timing(slide, [[25, 30, 35, 40], [50, 55, 60, 70], [84]])
    files[AGENTS] = serial(slide)
    set_notes(files, 21, AGENTS_NOTES + ' Click once for Stage 1, once for Stages 2 and 3, once for the Reporter.')
    pipe = parse(files[PIPELINE]); build_multiagent(pipe, kit); files[PIPELINE] = serial(pipe)
    set_notes(files, 9, MULTI_NOTES)
    lit = parse(files['ppt/slides/slide6.xml']); build_lit_evolution(lit, kit); files['ppt/slides/slide6.xml'] = serial(lit)
    set_notes(files, 6, LIT1_NOTES_V9)
    lit = parse(files[LIT2]); build_lit_agents_security(lit, kit); files[LIT2] = serial(lit)
    set_notes(files, 22, LIT2_NOTES_V9)
    # slide 11: the GPU that now serves inference
    desk = files['ppt/slides/slide10.xml'].decode('utf-8')
    assert desk.count(HARDWARE_OLD) == 1
    files['ppt/slides/slide10.xml'] = desk.replace(HARDWARE_OLD, HARDWARE_NEW).encode('utf-8')
    note10 = re.search(r'notesSlides/(notesSlide\d+)\.xml', files['ppt/slides/_rels/slide10.xml.rels'].decode('utf-8')).group(1)
    nroot = parse(files[f'ppt/notesSlides/{note10}.xml'])
    set_notes(files, int(note10[len('notesSlide'):]), notes_text(nroot).replace('\n\n', ' ') + DESKTOP_NOTES_ADD)

    arch = parse(files[ARCH]); build_architecture(arch)
    click_timing(arch, [[22], [28], [34], [40], [44, 45, 49, 50, 54, 55, 59]])
    files[ARCH] = serial(arch)
    notes8 = parse(files['ppt/notesSlides/notesSlide8.xml'])
    body = notes8.xpath('.//p:sp[.//p:ph/@type="body"]/p:txBody', namespaces=NS)[0]
    ts = [t for t in body.iter(f'{{{A}}}t')]; ts[0].text = ARCH_NOTES + ' Click once per tier, then once for the training lane.'
    for t in ts[1:]:
        t.text = ''
    files['ppt/notesSlides/notesSlide8.xml'] = serial(notes8)

    # ── section counters and page numbers ──
    for page, n in enumerate(ORDER, 1):
        part = f'ppt/slides/slide{n}.xml'
        root = parse(files[part])
        if n in METHODS:
            kicker = root.xpath('.//p:sp[starts-with(p:nvSpPr/p:cNvPr/@name, "Kicker")]', namespaces=NS)[0]
            for t in kicker.iter(f'{{{A}}}t'):
                if t.text and re.search(r'\d OF 5', t.text):
                    t.text = re.sub(r'\d OF 5', f'{METHODS[n]} OF 6', t.text)
        pages = root.xpath('.//p:sp[p:nvSpPr/p:cNvPr/@name="Page"]', namespaces=NS)
        if pages:
            ts = [t for t in pages[0].iter(f'{{{A}}}t') if t.text]
            ts[0].text = f'{page:02d}'
        files[part] = serial(root)

    # ── thank-you photo ──
    photo = mono_photo(*THANKS_PHOTO)
    rels20 = files['ppt/slides/_rels/slide20.xml.rels'].decode('utf-8')
    old = re.search(r'Target="\.\./media/(image\d+\.jpg)"', rels20).group(1)
    users = [n for n, d in files.items() if n.endswith('.rels') and f'media/{old}'.encode() in d]
    assert users == ['ppt/slides/_rels/slide20.xml.rels'], users
    del files[f'ppt/media/{old}']
    files['ppt/media/image35.jpg'] = photo.read_bytes()
    files['ppt/slides/_rels/slide20.xml.rels'] = rels20.replace(f'media/{old}', 'media/image35.jpg').encode('utf-8')
    thanks = files[THANKS].decode('utf-8')
    thanks, n = re.subn(r'(name="!!photo" descr=")[^"]*"', r'\g<1>' + photo.name + '"', thanks)
    assert n == 1
    old_credit = 'V5: V3 template, fonts and animations retained.'
    assert thanks.count(old_credit) == 1
    thanks_root = parse(thanks.encode('utf-8')); update_references(thanks_root); thanks = serial(thanks_root).decode('utf-8')
    thanks = thanks.replace(old_credit, 'V9: V3 template, fonts and animations retained; agent detail from agentOrchestrator.js.')
    files[THANKS] = thanks.encode('utf-8')

    # ── speaker notes: out of the deck, into a Markdown file ──
    lines = ['# CyberForge — Thesis Defence v9: speaker notes', '',
             'What to say on each slide of *CyberForge - Thesis Defence v9.pptx*, with the evidence behind it.',
             'These notes were moved out of the PowerPoint file; the deck itself no longer carries speaker notes.', '']
    for page, n in enumerate(ORDER, 1):
        slide_root = parse(files[f'ppt/slides/slide{n}.xml'])
        rels_n = files[f'ppt/slides/_rels/slide{n}.xml.rels'].decode('utf-8')
        m = re.search(r'notesSlides/(notesSlide\d+\.xml)', rels_n)
        text = ''
        if m:
            part = f'ppt/notesSlides/{m.group(1)}'
            notes_root = parse(files[part])
            text = notes_text(notes_root).replace('This fifteen-slide defence', 'This seventeen-slide defence')
            clear_notes(notes_root)
            files[part] = serial(notes_root)
        lines += [f'## Slide {page} — {slide_title(slide_root).title() or ("Title: Cyberforge" if page == 1 else "Untitled")}', '', text or '_No notes._', '']
    lines += ['## Works added to the deck in V9', '',
              'Cited on slides 6 and 7 and listed on the final slide. They are not in thesis Chapter 2 yet; add them to the bibliography if the slides stay as they are.', '']
    lines += ['- ' + c for c in FULL_CITATIONS] + ['']
    NOTES_MD.write_text('\n'.join(lines), encoding='utf-8')

    # ── document properties ──
    app = files['docProps/app.xml'].decode('utf-8')
    app = re.sub(r'<Slides>\d+</Slides>', f'<Slides>{len(ORDER)}</Slides>', app)
    app = re.sub(r'<Notes>\d+</Notes>', f'<Notes>{len(ORDER)}</Notes>', app)
    files['docProps/app.xml'] = app.encode('utf-8')

    with ZipFile(SOURCE) as z:
        order = [i.filename for i in z.infolist() if i.filename in files]
    order += [n for n in files if n not in order]
    with ZipFile(OUT, 'w', ZIP_DEFLATED) as z:
        for n in order:
            z.writestr(n, files[n])
    print('wrote', OUT.name, len(ORDER), 'slides')


if __name__ == '__main__':
    main()
