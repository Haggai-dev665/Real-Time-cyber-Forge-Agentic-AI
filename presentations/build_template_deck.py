"""Thesis-defence deck on the SlidesCarnival "Dark Modern Tech Startup Brand" template.

Template: https://www.slidescarnival.com/template/tech-startup-brand/154090 (CC BY 4.0; credited on
the last slide). Its master, theme and fonts are kept; its sample slides are removed and replaced
with the thesis content (Che Haggai Ngha Kang.docx, Chapters 1-5 and Appendix C), in the order of
the presentation guide. Photos are free Pexels photos (pexels.com/license), shown in monochrome as
the template does, and credited on the last slide.

Animated shapes carry their effect in their name ("label|fx=...;by=...;t=...;d=...;dur=...");
apply_animations.ps1 then has PowerPoint add the effects, the Morph transitions and full embedded fonts.

    python build_template_deck.py   -> _template-static.pptx
"""
import json, math, os, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / '.vendor'))
from PIL import Image, ImageOps, ImageEnhance, ImageFont
from lxml import etree
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

HERE = Path(__file__).parent
TEMPLATE = HERE / 'template' / 'tech-startup-brand.pptx'
PHOTOS = HERE / 'photos'
ASSETS = HERE / 'assets'
WORK = PHOTOS / 'mono'
WORK.mkdir(exist_ok=True)
OUT = HERE / '_template-static.pptx'

# template palette (sampled from its own renders)
BG, PANEL, LIFT, EDGE = '232325', '2A2A2D', '343437', '3A3A3D'
LIME, LIME_D = 'C1FF72', '9BD14F'
TEXT, SOFT, MUTE, DIM = 'EDEDED', 'BDBDC1', '8E8E93', '5C5C61'
RED = 'FF6B6B'
HEAD, BODY = 'Oswald', 'Titillium Web'
FONTDIR = Path(os.environ['LOCALAPPDATA']) / 'Microsoft' / 'Windows' / 'Fonts'
FONTFILES = {(HEAD, False): 'Oswald-Medium.ttf', (HEAD, True): 'Oswald-SemiBold.ttf',
             (BODY, False): 'TitilliumWeb-Regular.ttf', (BODY, True): 'TitilliumWeb-SemiBold.ttf'}

W, H = 20.0, 11.25
MX = 1.1                 # side margin
CW = W - 2 * MX          # content width
SECTIONS = ['Brief introduction', 'Problem statement', 'Research questions', 'Research objectives',
            'Brief literature review', 'Methods and materials used', 'Results', 'Conclusion']

prs = Presentation(TEMPLATE)
# drop the template's sample slides (their parts are then not written)
sldIdLst = prs.slides._sldIdLst
for sldId in list(sldIdLst):
    prs.part.drop_rel(sldId.rId)
    sldIdLst.remove(sldId)
# embed complete fonts on save, not subsets of the template's sample text
pres_el = prs.part._element
if pres_el.get('saveSubsetFonts') is not None:
    del pres_el.attrib['saveSubsetFonts']
BLANK = next(l for l in prs.slide_layouts if l.name == 'BLANK')
cp = prs.core_properties
cp.title = 'CyberForge: A Real-Time Agentic AI System for Web Threat Detection and User Protection'
cp.author = 'Che Haggai Ngha Kang'
cp.subject = "Master's dissertation defence, The University of Bamenda"
overflow = []
_n = {'i': 0}


def rgb(c):
    return RGBColor.from_string(c)


def spec(label, **kw):
    _n['i'] += 1
    return f'{label} {_n["i"]}' + ('|' + ';'.join(f'{k}={v}' for k, v in kw.items()) if kw else '')


# ---------------- measurement ----------------
_fc = {}


def _font(family, size, bold):
    key = (family, bold, round(size * 4))
    if key not in _fc:
        _fc[key] = ImageFont.truetype(str(FONTDIR / FONTFILES[(family, bold)]), max(1, round(size * 4)))
    return _fc[key]


def lines_needed(text, width_in, size, family, bold=False, caps=False):
    f = _font(family, size, bold)
    limit = width_in * 72 * 4
    n = 0
    for raw in (text.upper() if caps else text).split('\n'):
        line = ''
        n += 1
        for word in raw.split(' '):
            cand = (line + ' ' + word).strip()
            if line and f.getlength(cand) > limit:
                n += 1
                line = word
            else:
                line = cand
    return n


def text_w(text, size, family, bold=False):
    return _font(family, size, bold).getlength(text) / (72 * 4)


# ---------------- primitives ----------------
def P(text, size=21, color=SOFT, family=BODY, bold=False, after=None, before=None, align=None, spacing=None, runs=None, caps=False):
    d = dict(runs=runs or [(text, {})], size=size, color=color, family=family, bold=bold, after=after, before=before, caps=caps)
    if align:
        d['align'] = align
    if spacing:
        d['spacing'] = spacing
    return d


def tb(slide, x, y, w, h, paras, name='Text', anchor='top', align='left', inset=0.05, spacing=1.0, check=True, rot=0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    box.name = name
    if rot:
        box.rotation = rot
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    for side in ('margin_left', 'margin_right', 'margin_top', 'margin_bottom'):
        setattr(tf, side, Inches(inset))
    tf.vertical_anchor = {'top': MSO_ANCHOR.TOP, 'middle': MSO_ANCHOR.MIDDLE, 'bottom': MSO_ANCHOR.BOTTOM}[anchor]
    used = 0.0
    for i, p in enumerate(paras):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER, 'right': PP_ALIGN.RIGHT}[p.get('align', align)]
        para.line_spacing = p.get('spacing', spacing)
        if p.get('after') is not None:
            para.space_after = Pt(p['after'])
        if p.get('before') is not None:
            para.space_before = Pt(p['before'])
        size, family = p['size'], p['family']
        full = ''
        for text, o in p['runs']:
            r = para.add_run()
            r.text = text.upper() if p.get('caps') else text
            full += r.text
            f = r.font
            f.size = Pt(o.get('size', size))
            f.name = o.get('family', family)
            f.bold = o.get('bold', p['bold'])
            f.italic = o.get('italic', False)
            f.color.rgb = rgb(o.get('color', p['color']))
        n = lines_needed(full, w - 2 * inset, size, family, p['bold'])
        lh = 1.24 if family == HEAD else 1.32
        used += n * size * p.get('spacing', spacing) * lh / 72 + ((p.get('after') or 0) + (p.get('before') or 0)) / 72
    if check and used > h - 2 * inset + 0.03:
        overflow.append(f'slide {len(prs.slides)}: "{name.split("|")[0]}" needs {used:.2f} in, has {h:.2f} in')
    return box


def _effects(shape, shadow=None):
    """shadow: (color, alpha 0-100, blur pt, dist pt, dir deg)"""
    spPr = shape._element.spPr
    old = spPr.find(qn('a:effectLst'))
    if old is not None:
        spPr.remove(old)
    eff = etree.SubElement(spPr, qn('a:effectLst'))
    if shadow:
        color, alpha, blur, dist, deg = shadow
        sh = etree.SubElement(eff, qn('a:outerShdw'), blurRad=str(int(blur * 12700)), dist=str(int(dist * 12700)), dir=str(int(deg * 60000)), algn='ctr', rotWithShape='0')
        c = etree.SubElement(sh, qn('a:srgbClr'), val=color)
        etree.SubElement(c, qn('a:alpha'), val=str(alpha * 1000))


def rect(slide, x, y, w, h, fill=PANEL, line=None, name='Shape', radius=0.12, shape=MSO_SHAPE.ROUNDED_RECTANGLE, lw=0.75, shadow=None):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    s.name = name
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = min(0.5, radius / max(0.01, min(w, h)))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = rgb(fill)
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = rgb(line)
        s.line.width = Pt(lw)
    _effects(s, shadow)
    tf = s.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0)
    return s


def panel(slide, x, y, w, h, radius=0.35, fill=PANEL, name='Panel'):
    """The template's raised (neumorphic) panel: a light highlight up-left and a soft dark shadow down-right."""
    hi = rect(slide, x, y, w, h, fill=fill, name=name + ' light', radius=radius, shadow=(EDGE, 55, 16, 6, 225))
    lo = rect(slide, x, y, w, h, fill=fill, line='2F2F32', name=name, radius=radius, shadow=('0E0E10', 75, 22, 9, 45), lw=0.5)
    return [hi, lo]


def group(slide, shapes, name):
    g = slide.shapes.add_group_shape(shapes)
    g.name = name
    return g


def line(slide, x1, y1, x2, y2, color=DIM, width=1.5, name='Line', arrow=False):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.name = name
    c.line.color.rgb = rgb(color)
    c.line.width = Pt(width)
    if arrow:
        ln = c.line._get_or_add_ln()
        ln.append(ln.makeelement(qn('a:tailEnd'), {'type': 'triangle', 'w': 'med', 'len': 'med'}))
    return c


def oval(slide, x, y, d, fill=LIME, line=None, name='Dot', lw=1.25):
    return rect(slide, x, y, d, d, fill=fill, line=line, name=name, shape=MSO_SHAPE.OVAL, lw=lw)


def mono(photo_id, aspect, focus=(0.5, 0.5), tint=True):
    """A monochrome crop of a Pexels photo at the frame's aspect ratio (as the template's photos are)."""
    src = PHOTOS / f'px-{photo_id}.jpg'
    out = WORK / f'{photo_id}-{aspect:.3f}-{focus[0]:.2f}-{focus[1]:.2f}.jpg'
    if not out.exists():
        im = Image.open(src).convert('RGB')
        iw, ih = im.size
        if iw / ih > aspect:
            nw = int(ih * aspect); x0 = int((iw - nw) * focus[0]); im = im.crop((x0, 0, x0 + nw, ih))
        else:
            nh = int(iw / aspect); y0 = int((ih - nh) * focus[1]); im = im.crop((0, y0, iw, y0 + nh))
        g = ImageOps.grayscale(im)
        g = ImageEnhance.Contrast(g).enhance(1.12)
        g = ImageEnhance.Brightness(g).enhance(0.92)
        img = ImageOps.colorize(g, black='#0f0f11', white='#f0f0f0', mid='#7d7d80') if tint else g.convert('RGB')
        img.thumbnail((2000, 2000))
        img.save(out, quality=88)
    return out


def photo(slide, photo_id, x, y, w, h, name='Photo', radius=0.35, focus=(0.5, 0.5)):
    pic = slide.shapes.add_picture(str(mono(photo_id, w / h, focus)), Inches(x), Inches(y), Inches(w), Inches(h))
    pic.name = name
    if radius:
        pic.auto_shape_type = MSO_SHAPE.ROUNDED_RECTANGLE
        prst = pic._element.spPr.find(qn('a:prstGeom'))
        av = prst.find(qn('a:avLst'))
        if av is None:
            av = etree.SubElement(prst, qn('a:avLst'))
        for g in list(av):
            av.remove(g)
        etree.SubElement(av, qn('a:gd'), name='adj', fmla=f'val {int(50000 * min(1, radius / (min(w, h) / 2)))}')
    _effects(pic, ('0E0E10', 70, 22, 9, 45))
    return pic


def background(slide):
    f = slide.background.fill
    f.solid()
    f.fore_color.rgb = rgb(BG)


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


# ---------------- slide chrome ----------------
def progress(slide, current):
    """Eight section segments, top right; the current one is long and lime. Same names on every
    slide, so the Morph transition slides the highlight along as the talk moves on."""
    x = W - MX
    segs = []
    for i in range(8, 0, -1):
        on = i == current
        w = 1.2 if on else 0.34
        x -= w
        segs.append(rect(slide, x, 0.62, w, 0.13, fill=LIME if on else ('4A4A4E' if i < current else '303034'), name=f'!!seg{i}', radius=0.065))
        x -= 0.1
    tb(slide, x - 2.7, 0.47, 2.65, 0.42, [P(f'{current:02d} / 08', size=15, color=MUTE, family=HEAD, align='right')], name='!!segno', check=False)


def header(slide, section, title, sub=None, part=None, title_w=None):
    kicker = f'{section:02d}  ·  {SECTIONS[section - 1]}' + (f'  ·  {part}' if part else '')
    tb(slide, MX, 0.5, 9, 0.45, [P(kicker, size=16, color=LIME, family=BODY, bold=True, caps=True)],
       name=spec('Kicker', fx='wipe', dir='left', t='after', dur='0.5'), check=False)
    tb(slide, MX, 0.92, title_w or CW, 1.15, [P(title, size=54, color=TEXT, family=HEAD, caps=True)],
       name=spec('Title', fx='rise', by='char', t='with', d='0.1', dur='0.5'))
    if sub:
        tb(slide, MX, 2.0, title_w or CW, 0.55, [P(sub, size=21, color=MUTE)], name=spec('Subtitle', fx='fade', by='word', t='after', dur='0.5'))


def footer(slide, source, number):
    tb(slide, MX, 10.62, CW - 2, 0.38, [P(source, size=13, color=DIM)], name='Source', check=False)
    tb(slide, W - MX - 2, 10.62, 2, 0.38, [P(f'{number:02d}', size=13, color=DIM, family=HEAD, align='right')], name='Page', check=False)


def content(section, number, title, sub=None, part=None, source='', title_w=None):
    s = prs.slides.add_slide(BLANK)
    background(s)
    progress(s, section)
    header(s, section, title, sub, part, title_w)
    footer(s, source, number)
    return s


def card(slide, x, y, w, h, title, body, label=None, accent=LIME, ts=24, bs=19, fx='fly', d='0', dir='bottom', num=None):
    parts = panel(slide, x, y, w, h, radius=0.28, name='Card')
    ty = y + 0.3
    if num:
        parts.append(tb(slide, x + 0.32, ty - 0.08, w - 0.64, 0.8, [P(num, size=36, color=accent, family=HEAD)], name='Card num', check=False))
        ty += 0.72
    if label:
        parts.append(tb(slide, x + 0.32, ty, w - 0.64, 0.38, [P(label, size=14, color=accent, bold=True, caps=True)], name='Card label', check=False))
        ty += 0.42
    th = lines_needed(title.upper(), w - 0.72, ts, HEAD) * ts * 1.24 / 72 + 0.1
    parts.append(tb(slide, x + 0.32, ty, w - 0.64, th, [P(title, size=ts, color=TEXT, family=HEAD, caps=True)], name='Card title'))
    parts.append(tb(slide, x + 0.32, ty + th + 0.04, w - 0.64, h - (ty - y) - th - 0.3, [P(body, size=bs, color=SOFT, spacing=0.98)], name='Card body'))
    return group(slide, parts, spec('Card', fx=fx, dir=dir, t='after', d=d, dur='0.45'))


def chip(slide, x, y, text, fill=LIME, color=BG, size=14, name='Chip', h=0.46):
    w = text_w(text.upper(), size, BODY, True) + 0.44
    s = rect(slide, x, y, w, h, fill=fill, name=name, radius=h / 2)
    tf = s.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text.upper()
    r.font.size, r.font.name, r.font.bold = Pt(size), BODY, True
    r.font.color.rgb = rgb(color)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    return s, w


def bar(slide, x, y, w, h, frac, color=LIME, track='313135', name='Bar'):
    t = rect(slide, x, y, w, h, fill=track, name=spec(name + ' track', fx='fade', t='with', dur='0.2'), radius=h / 2)
    b = rect(slide, x, y, max(h, w * frac), h, fill=color, name=spec(name, fx='wipe', dir='left', t='after', dur='0.7'), radius=h / 2)
    return t, b


# ======================================================================================
# 1  TITLE
# ======================================================================================
s = prs.slides.add_slide(BLANK)
background(s)
photo(s, 37709121, 11.6, 0.0, 8.4, 11.25, name='!!photo', radius=0, focus=(0.4, 0.5))
rect(s, 11.6, 0, 1.6, 11.25, fill=BG, name='Fade edge', shape=MSO_SHAPE.RECTANGLE)
# soften the photo edge with a gradient strip
edge = s.shapes[-1]
edge.fill.gradient(); edge.fill.gradient_angle = 0
stops = edge.fill.gradient_stops
stops[0].color.rgb = rgb(BG); stops[0].position = 0
stops[1].color.rgb = rgb(BG); stops[1].position = 1.0
gs = edge.fill._xPr.find(qn('a:gradFill')).find(qn('a:gsLst'))
last = gs[-1].find(qn('a:srgbClr'))
etree.SubElement(last, qn('a:alpha'), val='0')
parts = panel(s, 0.9, 2.35, 11.6, 5.6, radius=1.1, name='Title panel')
group(s, parts, spec('Title panel', fx='fadedzoom', t='after', dur='0.6'))
logo = s.shapes.add_picture(str(ASSETS / 'image2.png'), Inches(0.95), Inches(0.62), height=Inches(1.15))
logo.name = spec('Logo', fx='fade', t='with', dur='0.5')
tb(s, 2.25, 0.72, 8.5, 1.0, [P('The University of Bamenda', size=19, color=TEXT, bold=True, caps=True, after=1),
                             P('College of Technology  ·  Department of Computer Engineering', size=16, color=MUTE)],
   name=spec('Institution', fx='fade', t='with', d='0.15', dur='0.5'))
tb(s, 1.65, 2.85, 10.2, 0.45, [P("Master's dissertation defence", size=17, color=LIME, bold=True, caps=True)], name=spec('Kicker', fx='wipe', dir='left', t='after', dur='0.5'), check=False)
tb(s, 1.55, 3.25, 10.4, 1.9, [P('CyberForge', size=112, color=TEXT, family=HEAD, caps=True)], name=spec('Deck title', fx='rise', by='char', t='after', dur='0.7'))
tb(s, 1.65, 5.2, 10.2, 1.3, [P('', runs=[('A real-time ', {}), ('agentic AI', {'color': LIME}), (' system for web threat detection and user protection', {})], size=30, color=SOFT, family=HEAD, spacing=1.0)],
   name=spec('Deck subtitle', fx='fade', by='word', t='after', dur='0.7'))
rect(s, 1.65, 6.75, 1.2, 0.09, fill=LIME, name=spec('Rule', fx='wipe', dir='left', t='after', dur='0.4'), radius=0.045)
tb(s, 1.65, 6.95, 10, 0.6, [P('Che Haggai Ngha Kang  ·  UBA24PP134', size=22, color=TEXT, family=HEAD, caps=True)], name=spec('Candidate', fx='rise', t='after', dur='0.4'), check=False)
tb(s, 0.95, 8.45, 10.8, 1.5, [P('Supervisor: Prof. Onabid Mathias Akong, Associate Professor', size=19, color=SOFT, after=4),
                              P("Master's in Computer Engineering — Information Technology and Cyber Security  ·  June 2026", size=17, color=MUTE)],
   name=spec('Supervisor', fx='fade', by='para', t='after', dur='0.4'))
notes(s, "Good morning. My dissertation is CyberForge, a real-time agentic AI system for web threat detection and user "
         "protection, supervised by Professor Onabid Mathias Akong. I will follow the structure: introduction, problem, "
         "research questions and objectives, a brief literature review, methods and materials, results, and the conclusion.")

# ======================================================================================
# 2  BRIEF INTRODUCTION
# ======================================================================================
s = content(1, 2, 'Brief introduction', 'Why web-threat detection needs more than one model', source='Thesis §1.1 Background of the Study', title_w=11)
photo(s, 5475752, 12.75, 1.15, 6.15, 4.25, name='!!photo', focus=(0.55, 0.5))
pts = [('The browser is the attack surface', 'Phishing, drive-by downloads, credential theft and malicious ads, as the boundary moved from firewall to browser (Provos et al., 2007; Khonji et al., 2013).'),
       ('Signatures fall behind', 'Fast-changing domains, hidden payloads and short-lived infrastructure defeat signature-based tools.'),
       ('Detection grew smarter', 'Machine learning, then deep learning and Transformers that read URLs in context (Devlin et al., 2019).'),
       ('From one model to agents', 'Specialised agents for detection, extraction, analysis and reporting, reasoning step by step like analysts (Yao et al., 2023).')]
y = 2.85
for i, (t, b) in enumerate(pts):
    tb(s, MX, y - 0.06, 1.0, 0.8, [P(f'0{i + 1}', size=34, color=LIME, family=HEAD)], name=spec('Point n', fx='fadedzoom', t='after', dur='0.3'), check=False)
    tb(s, MX + 1.05, y, 9.9, 1.75, [P(t, size=25, color=TEXT, family=HEAD, caps=True, after=2), P(b, size=19, color=SOFT, spacing=0.98)],
       name=spec('Point', fx='rise', by='para', t='with', dur='0.45'))
    y += 1.86
parts = panel(s, 12.75, 5.75, 6.15, 4.6, radius=0.4, name='Study')
parts.append(tb(s, 13.15, 6.0, 5.4, 0.42, [P('The present study', size=15, color=LIME, bold=True, caps=True)], name='Study label', check=False))
parts.append(tb(s, 13.15, 6.4, 5.4, 0.85, [P('CyberForge', size=40, color=TEXT, family=HEAD, caps=True)], name='Study title', check=False))
parts.append(tb(s, 13.15, 7.3, 5.45, 2.9, [P('A multi-platform, agent-based system that analyses URLs in real time and protects users while they browse. Specialised agents classify the URL, analyse the domain, inspect behaviour, look up threat intelligence and map attacker techniques, then agree one verdict.', size=18.5, color=SOFT, spacing=0.98)], name='Study body'))
group(s, parts, spec('Study', fx='fly', dir='right', t='after', dur='0.6'))
notes(s, "The web is now the main attack surface. Signature tools fall behind fast-changing domains, so research moved to "
         "machine learning, deep learning and Transformers, and now to systems of specialised agents. CyberForge is my "
         "response: specialised agents analyse each URL in real time and agree one explained verdict. Scope is URL and "
         "web-context security; kernel, firmware and enterprise lateral movement are out of scope (§1.6).")

# ======================================================================================
# 3  PROBLEM STATEMENT
# ======================================================================================
s = content(2, 3, 'Problem statement', 'Three persistent problems limit AI threat detection for ordinary users and small teams', source='Thesis §1.2 Problem Statement')
photo(s, 2036656, 14.55, 2.85, 4.35, 5.6, name='!!photo', focus=(0.5, 0.42))
probs = [('Too many false alarms', 'Single-model URL classifiers are prone to false positives. An early CyberForge heuristic rated every URL, google.com included, "medium risk" because of a +0.5 offset. Alert fatigue makes users ignore real threats.'),
         ('A number, not a story', 'A classifier gives a probability, but cannot list the indicators of compromise on the page, map script activity to a MITRE technique, or link the domain to earlier threat reports.'),
         ('No open, connected system', 'No widely deployed open system fans one browser event out to specialised analysers, keeps the result, reuses past visits and shows it on desktop and mobile. SOAR does, at enterprise cost.')]
cw3 = (13.05 - 0.6) / 3
for i, (t, b) in enumerate(probs):
    card(s, MX + i * (cw3 + 0.3), 2.85, cw3, 5.6, t, b, num=f'0{i + 1}', ts=26, bs=18.5)
parts = panel(s, MX, 8.8, CW, 1.45, radius=0.72, name='Answer')
parts.append(tb(s, MX + 0.6, 8.8, CW - 1.2, 1.45, [P('', runs=[('CyberForge answers with ', {}), ('specialist analysis', {'color': LIME}), (', ', {}), ('inspectable evidence', {'color': LIME}),
                                                          (' and ', {}), ('controlled sharing of results', {'color': LIME})], size=27, color=TEXT, family=HEAD, align='center')], name='Answer text', anchor='middle'))
group(s, parts, spec('Answer', fx='rise', t='after', dur='0.5'))
notes(s, "Three problems. First, false alarms: my own early heuristic returned 'medium' for every URL because of a +0.5 "
         "baseline offset, which shows how biases stay hidden until deployment. Second, explainability: a probability is not "
         "a story an analyst can act on. Third, no open architecture combines specialised analysers, memory and cross-device "
         "display; SOAR products do, but at enterprise scale.")

# ======================================================================================
# 4  RESEARCH QUESTIONS
# ======================================================================================
s = content(3, 4, 'Research questions', source='Thesis §1.3 Research Questions')
photo(s, 8386437, MX, 2.3, 4.6, 8.0, name='!!photo', focus=(0.5, 0.5))
gx = MX + 5.0
parts = panel(s, gx, 2.3, CW - 5.0, 2.45, radius=0.4, name='GRQ')
parts.append(tb(s, gx + 0.45, 2.52, 6, 0.4, [P('General question', size=15, color=LIME, bold=True, caps=True)], name='GRQ label', check=False))
parts.append(tb(s, gx + 0.45, 2.92, CW - 5.9, 1.75, [P('How can a multi-agent AI system, organised as a network of specialised analysers, be designed to provide real-time and explainable threat intelligence and protection for URLs and web resources across different platforms?', size=21, color=TEXT, spacing=0.98)], name='GRQ text'))
group(s, parts, spec('GRQ', fx='fadedzoom', t='after', dur='0.5'))
rqs = [('Decomposition', 'How can URL analysis be divided among different AI agents, and what is the smallest set of agents needed for a reliable threat assessment?'),
       ('Integration', 'How can URL classification, behavioural analysis, IOC extraction, MITRE ATT&CK mapping and threat-intelligence lookup be combined into one consistent, accurate system?'),
       ('Aggregation', 'What method can combine the agents\' results to reduce false alarms while still identifying serious threats when strong evidence is available?'),
       ('Historical context', 'How can historical browsing information improve detection, identify recurring malicious activity and strengthen protection over time?')]
y = 5.05
for i, (k, q) in enumerate(rqs):
    tb(s, gx, y, 1.3, 0.9, [P(f'RQ{i + 1}', size=34, color=LIME, family=HEAD)], name=spec('RQ n', fx='fadedzoom', t='after', dur='0.3'), check=False)
    tb(s, gx + 1.35, y + 0.05, 3.0, 0.7, [P(k, size=23, color=TEXT, family=HEAD, caps=True)], name=spec('RQ key', fx='rise', by='char', t='with', dur='0.35'))
    tb(s, gx + 4.45, y + 0.02, CW - 9.45, 1.25, [P(q, size=18.5, color=SOFT, spacing=0.98)], name=spec('RQ text', fx='fade', by='word', t='with', d='0.1', dur='0.6'))
    if i < 3:
        line(s, gx, y + 1.27, MX + CW, y + 1.27, color='38383C', width=1, name=spec('RQ rule', fx='wipe', dir='left', t='after', dur='0.25'))
    y += 1.36
notes(s, "The general question asks how a network of specialised analysers can give real-time, explainable protection across "
         "platforms. It breaks into four: decomposition, integration of the analysis types, aggregation that reduces false "
         "alarms without hiding strong threats, and the use of historical browsing context.")

# ======================================================================================
# 5  RESEARCH OBJECTIVES
# ======================================================================================
s = content(4, 5, 'Research objectives', source='Thesis §1.4 Objectives of the Study', title_w=12)
photo(s, 9783348, 13.55, 1.15, 5.35, 9.15, name='!!photo', focus=(0.5, 0.4))
parts = panel(s, MX, 2.3, 12.05, 2.4, radius=0.4, name='GO')
parts.append(tb(s, MX + 0.45, 2.5, 6, 0.4, [P('General objective', size=15, color=LIME, bold=True, caps=True)], name='GO label', check=False))
parts.append(tb(s, MX + 0.45, 2.9, 11.2, 1.75, [P('Design, implement and evaluate a multi-platform AI-driven system that monitors URLs in real time, detects and explains threats with cooperating agents, and gives timely alerts and protective feedback while keeping historical context and threat records.', size=20, color=TEXT, spacing=0.98)], name='GO text'))
group(s, parts, spec('GO', fx='fadedzoom', t='after', dur='0.5'))
objs = [('Multi-agent framework', 'Decompose URL analysis into coordinated tasks for reliable real-time assessments.', 'RQ1'),
        ('Unified detection', 'Combine content, behaviour, structure and threat intelligence for accuracy and consistency.', 'RQ2'),
        ('Decision aggregation', 'Cut false alerts while strong malicious indicators still trigger immediate warnings.', 'RQ3'),
        ('Contextual intelligence', 'Link current URL behaviour with known attack patterns and external threat databases.', 'RQ4')]
ow = (12.05 - 0.35) / 2
for i, (t, b, rq) in enumerate(objs):
    card(s, MX + (i % 2) * (ow + 0.35), 5.0 + (i // 2) * 2.72, ow, 2.5, t, b, label=f'Objective {i + 1}  →  {rq}', ts=23, bs=18)
notes(s, "The general objective is to design, implement and evaluate the system end to end. Each specific objective answers "
         "one research question: the agent framework, the unified detection approach, the aggregation that controls false "
         "alerts, and contextual threat intelligence.")

# ======================================================================================
# 6  LITERATURE REVIEW 1/2 (scrolling timeline)
# ======================================================================================
s = content(5, 6, 'Brief literature review', 'From rules to learning to cooperating agents', part='1 of 2', source='Thesis Chapter 2 (§2.2–2.9); full references on the final slide', title_w=13)
photo(s, 13695499, 14.45, 1.15, 4.45, 2.85, name='!!photo', focus=(0.5, 0.5))
stages = [('Rules & features', 'Mohammad et al., 2014'), ('Classical ML', 'Sahingoz et al., 2019'), ('Deep learning', 'Le et al., 2018; Devlin et al., 2019'), ('Hybrid + agents', 'Khonji et al., 2013; Yao et al., 2023')]
sw = (CW - 0.9) / 4
for i, (t, r) in enumerate(stages):
    x = MX + i * (sw + 0.3)
    parts = panel(s, x, 4.35, sw, 1.15, radius=0.57, fill=PANEL if i < 3 else '33402A', name='Stage')
    parts.append(tb(s, x + 0.2, 4.4, sw - 0.4, 0.6, [P(t, size=22, color=LIME if i == 3 else TEXT, family=HEAD, caps=True, align='center')], name='Stage title', check=False))
    parts.append(tb(s, x + 0.2, 4.96, sw - 0.4, 0.45, [P(r, size=14, color=MUTE, align='center')], name='Stage ref', check=False))
    group(s, parts, spec('Stage', fx='fly', dir='left', t='after', dur='0.35'))
works = [('2007', 'Provos et al.', 'Drive-by downloads on 1.3% of sampled pages; predicted short-lived domains and polymorphic scripts.'),
         ('2010', 'Sommer & Paxson', 'ML for intrusion detection must handle costly errors and be interpretable.'),
         ('2012', 'Antonakakis et al.', 'DGA domains look random: high entropy, few vowels, digit mixing.'),
         ('2013', 'Khonji et al.', 'Survey of 70+ phishing works: combine lexical, content and reputation features.'),
         ('2016', 'Liao et al.', 'Automatic IOC discovery from open threat reports; STIX/TAXII sharing.'),
         ('2018', 'Strom et al.', 'MITRE ATT&CK: a shared language for attacker tactics and techniques.'),
         ('2018', 'Le et al.', 'URLNet learns URL representations directly from raw text.'),
         ('2019', 'Devlin et al.', 'BERT: pre-train, then fine-tune; security-adapted variants followed.'),
         ('2023', 'Yao et al.', 'ReAct: reason, act, observe, repeat — the loop behind agents.'),
         ('2023', 'Park et al.', 'Generative Agents: memory keeps agents consistent over time.')]
iw, gap, ty0 = 3.6, 0.32, 5.95
parts = [line(s, MX, ty0 + 0.62, MX + len(works) * (iw + gap), ty0 + 0.62, color=LIME_D, width=2, name='Timeline')]
for i, (yr, who, what) in enumerate(works):
    x = MX + i * (iw + gap)
    parts.append(oval(s, x, ty0 + 0.5, 0.25, fill=LIME, name='Year dot'))
    parts.append(tb(s, x + 0.38, ty0 + 0.25, 1.6, 0.6, [P(yr, size=26, color=LIME, family=HEAD)], name='Year', check=False))
    parts += panel(s, x, ty0 + 1.1, iw, 3.3, radius=0.3, name='Work')
    parts.append(tb(s, x + 0.3, ty0 + 1.32, iw - 0.6, 0.6, [P(who, size=22, color=TEXT, family=HEAD, caps=True)], name='Work author'))
    parts.append(tb(s, x + 0.3, ty0 + 1.92, iw - 0.6, 2.35, [P(what, size=17.5, color=SOFT, spacing=0.98)], name='Work finding'))
strip = group(s, parts, spec('Timeline strip', fx='fade', t='after', dur='0.5', scroll=f'{-(len(works) * (iw + gap) - CW) / W:.4f}', sdur='8', sd='0.8'))
# the strip scrolls left past the margin; keep the page chrome above it
tree = s.shapes._spTree
for shp in list(s.shapes):
    if shp.name.startswith('!!') or shp.name.startswith('Kicker') or shp.name.startswith('Title') or shp.name.startswith('Subtitle'):
        tree.remove(shp._element); tree.append(shp._element)
notes(s, "The literature moves through four stages: hand-written rules, classical machine learning, deep learning and "
         "Transformers, and now hybrid designs and agents. The timeline scrolls through the works the design builds on: "
         "Provos on drive-by downloads, Sommer and Paxson's critique, Antonakakis on DGAs, Khonji's phishing survey, IOC "
         "extraction, MITRE ATT&CK, URLNet, BERT, ReAct and Generative Agents.")

# ======================================================================================
# 7  LITERATURE REVIEW 2/2: GAPS
# ======================================================================================
s = content(5, 7, 'Research gaps', 'Five gaps between research ideas and working systems', part='2 of 2', source='Thesis §2.10 Research Gaps', title_w=12)
photo(s, 5483240, 14.0, 1.15, 4.9, 9.15, name='!!photo', focus=(0.5, 0.5))
gaps = [('Few complete multi-agent security systems', 'Frameworks show the idea; few open systems apply it end to end.', 'A full working pipeline of connected agents'),
        ('Model and service failure', 'Systems rarely say when a model or service did not answer.', 'Capability readiness, explicit unknown states'),
        ('Accuracy over real false alarms', 'Lab scores hide how often safe sites are flagged (Sommer & Paxson, 2010).', 'Multi-signal aggregation for few false alarms'),
        ('Historical context unused', 'Past observations are rarely reused later (Park et al., 2023).', 'Memory supplies prior verdicts as context'),
        ('Hard to reproduce', 'Private data, closed systems, costly infrastructure.', 'Public tools and modular, testable services')]
y = 2.85
for i, (g, why, ans) in enumerate(gaps):
    tb(s, MX, y, 1.0, 0.8, [P(f'G{i + 1}', size=32, color=LIME, family=HEAD)], name=spec('Gap n', fx='fadedzoom', t='after', dur='0.25'), check=False)
    tb(s, MX + 1.0, y, 6.6, 1.45, [P(g, size=21, color=TEXT, family=HEAD, caps=True, after=1), P(why, size=16.5, color=MUTE, spacing=0.98)],
       name=spec('Gap', fx='rise', by='para', t='with', dur='0.4'))
    parts = panel(s, MX + 7.75, y + 0.08, 4.85, 1.12, radius=0.56, name='Answer')
    parts.append(tb(s, MX + 8.05, y + 0.08, 4.3, 1.12, [P(ans, size=17.5, color=LIME, align='center', spacing=0.95)], name='Answer text', anchor='middle'))
    group(s, parts, spec('Gap answer', fx='fly', dir='right', t='after', dur='0.4'))
    y += 1.5
notes(s, "Five gaps motivate the work: few complete multi-agent security systems, little honesty about model and service "
         "failure, a focus on accuracy rather than false alarms, unused historical context, and poor reproducibility. Each "
         "lime answer shows how CyberForge responds.")

# ======================================================================================
# 8  METHODS 1/6: ARCHITECTURE
# ======================================================================================
s = content(6, 8, 'System architecture', 'Four layers with a clear data flow', part='1 of 6', source='Thesis §3.2 System Architecture, Figure 3.1', title_w=12)
photo(s, 4508751, 14.55, 1.15, 4.35, 9.15, name='!!photo', focus=(0.5, 0.5))
layers = [('Client', 'Tauri 2 desktop · React Native/Expo companion · scoped Rust CLI · grant-controlled MCP tools'),
          ('Native & backend control', 'Shared Rust services, OS keyring, local ownership · Node.js 24/Express: authentication, workspaces, device and agent workflows'),
          ('Inference', 'FastAPI on Hugging Face Spaces: trained URL models, BERT, DGA rules, Qwen explanations, versioned contracts'),
          ('Persistence & intelligence', 'MongoDB records, selected Appwrite integrations, local stores and caches · AlienVault OTX, page fetching')]
y = 2.85
for i, (k, d) in enumerate(layers):
    parts = panel(s, MX, y, 8.75, 1.72, radius=0.3, name='Layer')
    parts.append(rect(s, MX + 0.25, y + 0.25, 2.75, 1.22, fill='33402A' if i % 2 == 0 else '2F2F33', name='Layer key bg', radius=0.3))
    parts.append(tb(s, MX + 0.3, y + 0.25, 2.65, 1.22, [P(k, size=19, color=LIME if i % 2 == 0 else TEXT, family=HEAD, caps=True, align='center', spacing=0.95)], name='Layer key', anchor='middle', check=False))
    parts.append(tb(s, MX + 3.25, y + 0.12, 5.3, 1.5, [P(d, size=16.5, color=SOFT, spacing=0.97)], name='Layer text', anchor='middle'))
    group(s, parts, spec('Layer', fx='fly', dir='left', t='after', dur='0.4'))
    y += 1.9
flow = [('Address', 'manual, or a consented observation'), ('Privacy & session checks', 'in the native layer'), ('Backend routes', 'pick the analysis service'), ('Labelled result', 'with coverage and failures')]
fx_, fy = MX + 9.15, 2.85
for i, (t, d) in enumerate(flow):
    parts = panel(s, fx_, fy, 3.9, 1.5, radius=0.3, fill='33402A' if i in (0, 3) else PANEL, name='Flow')
    parts.append(tb(s, fx_ + 0.25, fy + 0.18, 3.4, 1.2, [P(t, size=19, color=LIME if i in (0, 3) else TEXT, family=HEAD, caps=True, after=2), P(d, size=16, color=SOFT, spacing=0.95)], name='Flow text'))
    group(s, parts, spec('Flow', fx='rise', t='after', dur='0.35'))
    if i < 3:
        line(s, fx_ + 1.95, fy + 1.52, fx_ + 1.95, fy + 1.85, color=LIME, width=2, name=spec('Flow arrow', fx='wipe', dir='top', t='after', dur='0.12'), arrow=True)
    fy += 1.9
notes(s, "The architecture separates four layers: clients, native and backend control, inference, and persistence with "
         "intelligence. A request passes privacy and session checks in the native layer, the backend selects the service, "
         "and the user receives a source-labelled result that states its coverage and any failure.")

# ======================================================================================
# 9  METHODS 2/6: PIPELINE
# ======================================================================================
s = content(6, 9, 'Eight-agent pipeline', 'A three-stage directed acyclic graph, then a Reporter', part='2 of 6', source='Thesis §3.8, Table 3.1; historical blend Eq. 3.1', title_w=13)
photo(s, 8566526, 15.5, 1.15, 3.4, 1.55, name='!!photo', focus=(0.5, 0.35))
cols = [('Stage 1', 'URL & context, in parallel', [('URL Classifier', 'BERT label + confidence'), ('DGA Detector', 'entropy, character patterns'), ('Web Scraper', 'content, scripts, headers'), ('Memory Reader', 'past visits and verdicts')]),
        ('Stage 2', 'once the page is scraped', [('IOC Extractor', '10 patterns: IPs, URLs, hashes, CVEs'), ('Behavioural Analyser', 'eval/atob, hidden forms, trackers'), ('MITRE Mapper', '20 signals → ATT&CK')]),
        ('Stage 3', 'needs the extracted IOCs', [('Threat Intelligence', 'AlienVault OTX reputation')]),
        ('Reporter', 'combines every result', [('Reporter Agent', 'risk score, verdict, explanation, stored report')])]
colw = [4.25, 4.25, 3.9, 3.9]
cx = MX
for ci, (head, sub, agents) in enumerate(cols):
    w_ = colw[ci]
    parts = panel(s, cx, 2.9, w_, 1.25, radius=0.3, fill='33402A', name='Stage head')
    parts.append(tb(s, cx + 0.25, 2.95, w_ - 0.5, 1.15, [P(head, size=24, color=LIME, family=HEAD, caps=True), P(sub, size=16, color=SOFT)], name='Stage head text', anchor='middle', check=False))
    group(s, parts, spec('Stage head', fx='fly', dir='top', t='after', dur='0.35'))
    ay = 4.4
    for ai, (an, ad) in enumerate(agents):
        parts = panel(s, cx, ay, w_, 1.2, radius=0.28, name='Agent')
        parts.append(rect(s, cx + 0.22, ay + 0.3, 0.1, 0.6, fill=LIME, name='Agent tick', radius=0.05))
        parts.append(tb(s, cx + 0.5, ay + 0.1, w_ - 0.7, 1.05, [P(an, size=20, color=TEXT, family=HEAD, caps=True), P(ad, size=16, color=SOFT, spacing=0.92)], name='Agent text', anchor='middle'))
        group(s, parts, spec('Agent', fx='zoom' if ci == 0 else 'fly', dir='bottom', t='with' if ai else 'after', d=f'{ai * 0.08:.2f}', dur='0.35'))
        ay += 1.36
    if ci < 3:
        line(s, cx + w_ + 0.05, 3.52, cx + w_ + 0.32, 3.52, color=LIME, width=2.5, name=spec('DAG arrow', fx='wipe', dir='left', t='after', dur='0.25'), arrow=True)
    cx += w_ + 0.42
parts = panel(s, MX, 9.55, CW, 0.9, radius=0.45, name='Formula')
parts.append(tb(s, MX + 0.5, 9.55, CW - 1, 0.9, [P('', runs=[('Historical blend (Eq. 3.1)   ', {'color': LIME, 'family': HEAD}), ('risk = 0.6 × mean agent score + 0.4 × maximum agent score', {'color': TEXT}),
                                                     ('   — one strong signal still raises the verdict', {'color': MUTE})], size=19)], name='Formula text', anchor='middle'))
group(s, parts, spec('Formula', fx='wipe', dir='left', t='after', dur='0.6'))
notes(s, "Eight specialist agents run in three stages plus a Reporter. Stage one works on the URL alone, in parallel: the BERT "
         "URL classifier, the DGA detector, the web scraper and the memory reader. Stage two needs the scraped page: IOC "
         "extraction with ten patterns, behavioural analysis, and MITRE mapping with twenty signals. Stage three enriches "
         "IOCs from AlienVault OTX. The Reporter combines everything; the original blend weights the mean at 60% and the "
         "strongest signal at 40%, so one strong signal is not averaged away. The current ReportAgent uses a weighted "
         "evidence sum instead (§3.4).")

# ======================================================================================
# 10 METHODS 3/6: MATERIALS
# ======================================================================================
s = content(6, 10, 'Materials', 'Software, libraries, services, data and hardware', part='3 of 6', source='Thesis §3.6 Materials; Appendix C.3', title_w=12)
photo(s, 1921326, 14.55, 1.15, 4.35, 9.15, name='!!photo', focus=(0.5, 0.5))
quad = [('Software', 'Tauri 2 / Rust desktop', 'Node.js 24 + Express 4 backend · Python FastAPI on Hugging Face Spaces · React Native / Expo companion · Rust core, CLI and MCP'),
        ('Key libraries', 'transformers 4.40+', 'scikit-learn 1.8.0 · torch 2.2+ · llama-cpp-python 0.3.36 · huggingface_hub · pandas, NumPy · axios · node-appwrite'),
        ('Services', 'Hugging Face Spaces', 'MongoDB/Mongoose · Appwrite · AlienVault OTX · WebScrapper.live · Qwen3.5-2B GGUF via llama.cpp'),
        ('Data & models', 'BERT malware-url-detect', 'Qwen3.5-2B GGUF · MITRE ATT&CK v15 · OTX pulses · public phishing, malware-URL, Tranco top-1M and web-attack corpora')]
qw = (13.05 - 0.35) / 2
for i, (k, t, d) in enumerate(quad):
    card(s, MX + (i % 2) * (qw + 0.35), 2.85 + (i // 2) * 3.35, qw, 3.15, t, d, label=k, ts=23, bs=17.5)
parts = panel(s, MX, 9.55, 13.05, 0.9, radius=0.45, name='HW')
parts.append(tb(s, MX + 0.45, 9.55, 12.2, 0.9, [P('', runs=[('Hardware   ', {'color': LIME, 'family': HEAD}), ('Original development: Apple-silicon MacBook, 16 GB RAM, macOS Sonoma 14.6', {'color': SOFT})], size=18)], name='HW text', anchor='middle'))
group(s, parts, spec('Hardware', fx='wipe', dir='left', t='after', dur='0.5'))
notes(s, "The materials: a Tauri 2 and Rust desktop, a Node.js 24 Express backend, a Python FastAPI service on Hugging Face "
         "Spaces, a React Native companion, and a shared Rust core with a CLI and MCP adapter. Pretrained BERT and Qwen are "
         "used for inference only; the training data are public phishing, malware-URL, popularity and web-attack corpora.")

# ======================================================================================
# 11 METHODS 4/6: DEVELOPMENT
# ======================================================================================
s = content(6, 11, 'Development & calibration', 'Seven deployable iterations, then calibration', part='4 of 6', source='Thesis §3.7 Methodology; Appendix A', title_w=13)
photo(s, 5935794, 15.0, 1.15, 3.9, 1.55, name='!!photo', focus=(0.5, 0.5))
its = [('Foundation', 'repos, Heroku and Space, Appwrite, ML stub'), ('Single classifier', 'scraper → classifier → Gemini → alert'), ('False-positive fix', '+0.5 offset removed; model consensus'),
       ('Sandbox', 'IOC extractor, MITRE mapper, evidence locker'), ('Transformers', 'BERT URL classifier, entropy DGA'), ('Agentic DAG', 'eight agents, memory, LLM fallback'), ('UI integration', 'desktop polling, agent grid, dashboard')]
iw = (CW - 6 * 0.18) / 7
line(s, MX + iw / 2, 3.45, MX + CW - iw / 2, 3.45, color=LIME_D, width=2.5, name=spec('Track', fx='wipe', dir='left', t='after', dur='0.8'))
for i, (t, d) in enumerate(its):
    x = MX + i * (iw + 0.18)
    parts = [oval(s, x + iw / 2 - 0.42, 3.03, 0.84, fill=LIME if i == 2 else PANEL, line=None if i == 2 else EDGE, name='It dot')]
    _effects(parts[0], ('0E0E10', 70, 14, 5, 45))
    parts.append(tb(s, x + iw / 2 - 0.42, 3.03, 0.84, 0.84, [P(str(i + 1), size=26, color=BG if i == 2 else LIME, family=HEAD, align='center')], name='It n', anchor='middle', inset=0, check=False))
    parts.append(tb(s, x, 4.05, iw, 0.62, [P(t, size=18.5, color=TEXT, family=HEAD, caps=True, align='center', spacing=0.95)], name='It title'))
    parts.append(tb(s, x + 0.02, 4.68, iw - 0.04, 1.4, [P(d, size=16, color=SOFT, align='center', spacing=0.95)], name='It text'))
    group(s, parts, spec('Iteration', fx='rise', t='after', dur='0.3'))
cal = [('Risk-score calibration', '7 researcher-labelled URLs, from google.com to paypa1-secure-login.tk; the +0.5 offset removed and thresholds adjusted. A development check, not held-out evidence.'),
       ('DGA heuristic calibration', '30 legitimate and generated-looking domains; empirical threshold 0.45 on entropy and character patterns.'),
       ('LLM fallback verification', 'Gemini exhaustion → Mistral fallback → rule-based response, each exercised in the prototype.')]
c3 = (CW - 0.7) / 3
for i, (t, d) in enumerate(cal):
    card(s, MX + i * (c3 + 0.35), 6.25, c3, 4.05, t, d, label=f'Calibration {i + 1}', ts=23, bs=18)
notes(s, "Development was iterative: seven deployable iterations, each checked with representative URLs. Iteration three "
         "found the +0.5 baseline offset behind the 'medium risk for everything' defect. Calibration used seven labelled URLs "
         "for the risk score and thirty domains for the DGA threshold of 0.45; the explanation fallback was exercised from "
         "Gemini through Mistral to rules. These are development checks, separate from the evaluation set.")

# ======================================================================================
# 12 METHODS 5/6: LEARNING & TRAINING
# ======================================================================================
s = content(6, 12, 'Learning & training', 'Four kinds of learning, five training phases', part='5 of 6', source='Thesis Appendix C.3–C.4; §2.3.3', title_w=13)
photo(s, 37564550, 15.0, 1.15, 3.9, 1.55, name='!!photo', focus=(0.5, 0.5))
kinds = [('Supervised', 'Three gradient-boosted classifiers', 'Phishing, malware-serving URLs and web-attack payloads (SQLi/XSS), with scikit-learn.'),
         ('Unsupervised', 'Anomaly detection', 'IsolationForest on benign URL features: 200 trees, contamination 0.02. Anomaly is not proof of harm.'),
         ('Pretrained', 'BERT and Qwen', 'External BERT URL classifier; Qwen3.5-2B explanations through llama.cpp. Used, not fine-tuned.'),
         ('Rules & retrieval', 'Heuristics and memory', 'Entropy DGA rules, regex IOC extraction, memory as context. No online weight updates.')]
kw = (CW - 1.05) / 4
for i, (lab, t, d) in enumerate(kinds):
    card(s, MX + i * (kw + 0.35), 2.85, kw, 3.75, t, d, label=lab, ts=22, bs=17)
phases = [('1', 'Collect & clean', 'public corpora, normalise, de-duplicate'), ('2', 'Features & split', 'shared features; domain-grouped 20% test, 10% thresholds'),
          ('3', 'Fit', '≤300 iterations, learning rate 0.1, 31 leaves, seed 42'), ('4', 'Thresholds', 'at a 2% false-positive target, then held-out check'),
          ('5', 'Publish', 'only accepted models, with their metadata')]
pw = (CW - 4 * 0.3) / 5
for i, (n_, t, d) in enumerate(phases):
    x = MX + i * (pw + 0.3)
    parts = panel(s, x, 6.95, pw, 3.35, radius=0.3, fill='33402A' if i == 3 else PANEL, name='Phase')
    parts.append(tb(s, x + 0.3, 7.05, 1.2, 0.95, [P(n_, size=44, color=LIME, family=HEAD)], name='Phase n', check=False))
    parts.append(tb(s, x + 0.3, 8.0, pw - 0.6, 0.62, [P(t, size=21, color=TEXT, family=HEAD, caps=True)], name='Phase title'))
    parts.append(tb(s, x + 0.3, 8.62, pw - 0.6, 1.55, [P(d, size=16, color=MUTE, spacing=0.96)], name='Phase text'))
    group(s, parts, spec('Phase', fx='fly', dir='left', t='after', dur='0.3'))
notes(s, "Four kinds of learning are kept apart: supervised gradient-boosted classifiers (HistGradientBoostingClassifier), an "
         "unsupervised IsolationForest on benign URLs, pretrained BERT and Qwen used only for inference, and rules with "
         "memory retrieval. Training follows five phases, with domain-grouped splits so the same domain never sits in both "
         "training and test, and thresholds chosen for a 2% false-positive target.")

# ======================================================================================
# 13 METHODS 6/6: EVALUATION
# ======================================================================================
s = content(6, 13, 'Evaluation design', '300 URLs and four criteria set before testing', part='6 of 6', source='Thesis §3.9 Evaluation Methodology; §4.3', title_w=12)
photo(s, 5380792, 14.55, 1.15, 4.35, 9.15, name='!!photo', focus=(0.5, 0.5))
parts = panel(s, MX, 2.85, 5.6, 7.45, radius=0.4, name='Set')
parts.append(tb(s, MX + 0.45, 2.95, 5, 1.85, [P('300', size=120, color=LIME, family=HEAD)], name='Big', check=False))
parts.append(tb(s, MX + 0.45, 4.85, 5, 0.6, [P('URLs evaluated', size=24, color=TEXT, family=HEAD, caps=True)], name='Big label', check=False))
group(s, parts, spec('Set', fx='fadedzoom', t='after', dur='0.5'))
by = 5.8
for t, n_, c in [('Benign websites', 150, SOFT), ('Phishing websites', 100, LIME), ('Malware / DGA domains', 50, LIME_D)]:
    tb(s, MX + 0.45, by, 3.6, 0.45, [P(t, size=17, color=SOFT)], name=spec('Set label', fx='fade', t='after', dur='0.2'), check=False)
    bar(s, MX + 0.45, by + 0.5, 3.9 * n_ / 150, 0.34, 1.0, color=c, name='Set bar')
    tb(s, MX + 0.55 + 3.9 * n_ / 150, by + 0.36, 1, 0.55, [P(str(n_), size=22, color=TEXT, family=HEAD)], name=spec('Set value', fx='fade', t='after', dur='0.2'), check=False)
    by += 1.2
tb(s, MX + 0.45, 9.45, 5, 0.6, [P('Positive class = the 150 harmful URLs', size=15, color=MUTE)], name=spec('Positive', fx='fade', t='after', dur='0.3'), check=False)
crit = [('Functional correctness', 'Every agent returns its documented shape; the Reporter matches the expected verdicts.'),
        ('False-positive rate', 'Common benign sites (google.com, github.com, wikipedia.org…) judged clean or low risk 100% of the time.'),
        ('True-positive coverage', 'Curated phishing URLs judged suspicious or malicious at least 80% of the time.'),
        ('End-to-end latency', 'Mean over 100 requests: at most 10 s from a cold start, 4 s when warm.')]
for i, (t, d) in enumerate(crit):
    card(s, MX + 6.0, 2.85 + i * 1.9, 7.05, 1.72, t, d, ts=21, bs=16.5, dir='right')
notes(s, "The evaluation set has 300 URLs: 150 benign, 100 phishing and 50 malware or DGA domains, with the harmful URLs as the "
         "positive class. Four criteria were set before testing: functional correctness, false positives on common benign "
         "sites, coverage of curated phishing, and latency of at most ten seconds cold and four seconds warm.")

# ======================================================================================
# 14 RESULTS 1/4: DETECTION
# ======================================================================================
s = content(7, 14, 'Detection performance', '300-URL evaluation of the prototype', part='1 of 4', source='Thesis Tables 4.3 and 4.4 (historical prototype results)', title_w=13)
photo(s, 38808473, 15.0, 1.15, 3.9, 1.55, name='!!photo', focus=(0.5, 0.5))
mets = [('94.7%', 'Accuracy', '284 of 300 correct'), ('97.9%', 'Precision', 'alerts that were right'), ('91.3%', 'Recall', 'harmful sites caught'),
        ('98.0%', 'Specificity', 'safe sites left alone'), ('94.5%', 'F1 score', 'precision–recall balance'), ('2.0%', 'FP rate', '3 of 150 benign')]
mw = (CW - 5 * 0.3) / 6
for i, (v, k, d) in enumerate(mets):
    x = MX + i * (mw + 0.3)
    hot = i in (0, 5)
    parts = panel(s, x, 2.85, mw, 2.45, radius=0.3, fill='33402A' if hot else PANEL, name='Metric')
    parts.append(tb(s, x + 0.1, 2.98, mw - 0.2, 1.05, [P(v, size=46, color=LIME if hot else TEXT, family=HEAD, align='center')], name='Metric value', check=False))
    parts.append(tb(s, x + 0.1, 4.0, mw - 0.2, 0.55, [P(k, size=20, color=TEXT, family=HEAD, caps=True, align='center')], name='Metric key', check=False))
    parts.append(tb(s, x + 0.1, 4.5, mw - 0.2, 0.55, [P(d, size=15.5, color=SOFT, align='center')], name='Metric text', check=False))
    group(s, parts, spec('Metric', fx='fadedzoom', t='after', dur='0.35', pulse='1' if i == 0 else '0'))
tb(s, MX, 5.7, 7, 0.45, [P('Confusion matrix', size=16, color=LIME, bold=True, caps=True)], name=spec('CM label', fx='fade', t='after', dur='0.3'), check=False)
cells = [('137', 'True positives', True), ('13', 'False negatives', False), ('3', 'False positives', False), ('147', 'True negatives', True)]
for i, (v, k, good) in enumerate(cells):
    x = MX + 1.9 + (i % 2) * 3.0
    y = 6.25 + (i // 2) * 2.05
    parts = panel(s, x, y, 2.8, 1.85, radius=0.3, fill='33402A' if good else PANEL, name='Cell')
    parts.append(tb(s, x, y + 0.12, 2.8, 1.0, [P(v, size=44, color=LIME if good else TEXT, family=HEAD, align='center')], name='Cell value', check=False))
    parts.append(tb(s, x, y + 1.1, 2.8, 0.55, [P(k, size=15.5, color=MUTE, align='center')], name='Cell key', check=False))
    group(s, parts, spec('Cell', fx='zoom', t='after', dur='0.25'))
tb(s, MX, 6.65, 1.8, 1.0, [P('Actual harmful', size=15, color=MUTE, align='right')], name=spec('Axis', fx='fade', t='with', dur='0.3'), check=False)
tb(s, MX, 8.7, 1.8, 1.0, [P('Actual benign', size=15, color=MUTE, align='right')], name=spec('Axis', fx='fade', t='with', dur='0.3'), check=False)
tb(s, MX + 8.4, 5.7, 7, 0.45, [P('Detection by category', size=16, color=LIME, bold=True, caps=True)], name=spec('Cat label', fx='fade', t='after', dur='0.3'), check=False)
cy = 6.3
for t, ok, n_, pct in [('Safe (benign) websites', 147, 150, '98.0%'), ('Phishing websites', 92, 100, '92.0%'), ('Malware and DGA domains', 45, 50, '90.0%')]:
    tb(s, MX + 8.4, cy, 7, 0.5, [P('', runs=[(t, {'color': TEXT, 'family': HEAD}), (f'    {ok} / {n_}', {'color': MUTE})], size=20)], name=spec('Cat name', fx='fade', t='after', dur='0.2'), check=False)
    bar(s, MX + 8.4, cy + 0.6, 7.3, 0.4, ok / n_, name='Cat bar')
    tb(s, MX + 15.85, cy + 0.42, 1.9, 0.7, [P(pct, size=24, color=LIME, family=HEAD, align='right')], name=spec('Cat pct', fx='fade', t='with', d='0.4', dur='0.3'), check=False)
    cy += 1.35
notes(s, "On the 300-URL set the prototype classified 284 correctly: 94.7% accuracy, 97.9% precision, 91.3% recall, 98% "
         "specificity and F1 94.5%. Only three of 150 benign sites were flagged, a 2% false-positive rate. Benign detection was "
         "98%, phishing 92% and malware/DGA 90%. These are the historical prototype results; they were not re-run on the "
         "revised implementation.")

# ======================================================================================
# 15 RESULTS 2/4: SPEED
# ======================================================================================
s = content(7, 15, 'Processing speed', 'Where the 4.05 seconds go', part='2 of 4', source='Thesis Tables 4.1 and 4.2 (historical prototype results)', title_w=12)
stg = [('Stage 1 · URL & context', 850, 21), ('Stage 2 · Content analysis', 1200, 30), ('Stage 3 · Threat intelligence', 600, 15), ('Reporter · report generation', 1400, 34)]
sy = 2.95
for t, ms, pc in stg:
    tb(s, MX, sy, 4.6, 0.55, [P(t, size=20, color=TEXT, family=HEAD, caps=True)], name=spec('Speed label', fx='fade', t='after', dur='0.2'), check=False)
    bar(s, MX + 4.7, sy + 0.1, 5.4, 0.42, ms / 1400, color=LIME if ms >= 1200 else SOFT, name='Speed bar')
    tb(s, MX + 10.25, sy - 0.02, 2.8, 0.6, [P('', runs=[(f'{ms:,} ms', {'color': TEXT, 'family': HEAD}), (f'   {pc}%', {'color': MUTE})], size=21)], name=spec('Speed value', fx='fade', t='with', d='0.4', dur='0.3'), check=False)
    sy += 1.05
parts = panel(s, MX + 13.35, 2.75, CW - 13.35, 4.15, radius=0.4, fill='33402A', name='Total')
parts.append(tb(s, MX + 13.7, 2.95, 3.8, 0.45, [P('Mean end to end', size=15, color=LIME, bold=True, caps=True)], name='Total label', check=False))
parts.append(tb(s, MX + 13.7, 3.35, 3.9, 1.4, [P('4.05 s', size=72, color=TEXT, family=HEAD)], name='Total value', check=False))
parts.append(tb(s, MX + 13.7, 4.85, 3.8, 1.9, [P('Warm target 4.00 s: missed by 0.05 s', size=17, color=LIME, after=5), P('Cached repeat visits: under 100 ms, about 15% of queries', size=16, color=SOFT)], name='Total text'))
group(s, parts, spec('Total', fx='fly', dir='right', t='after', dur='0.5', pulse='1'))
tb(s, MX, 7.15, 8, 0.45, [P('Slowest agent in each stage', size=16, color=LIME, bold=True, caps=True)], name=spec('Agents label', fx='fade', t='after', dur='0.3'), check=False)
ag = [('URL Classifier', '720 ms', 'BERT, Stage 1', 5935794), ('Web Scraper', '900 ms', 'page acquisition', 1921326), ('Threat Intelligence', '600 ms', 'OTX lookups', 37564550), ('Reporter', '1,400 ms', 'scoring and explanation', 38808473)]
aw = (CW - 0.9) / 4
for i, (a, v, d, pid) in enumerate(ag):
    card(s, MX + i * (aw + 0.3), 7.7, aw, 2.6, a, d, num=v, ts=21, bs=16.5, fx='rise')
notes(s, "The mean end-to-end analysis took 4.05 seconds, 50 milliseconds over the strict four-second warm target, so I report "
         "that objective as not met. The Reporter, with the language-model explanation, is the largest share at 34%. Cached "
         "repeat visits returned in under 100 milliseconds.")

# ======================================================================================
# 16 RESULTS 3/4: RELIABILITY
# ======================================================================================
s = content(7, 16, 'Reliability', 'How dependably each agent and service answered', part='3 of 4', source='Thesis Tables 4.5 and 4.7 (historical test period; return-success and uptime, not accuracy)', title_w=13)
rel = [('URL Classifier', 99.5), ('DGA Detector', 100), ('Web Scraper', 96.0), ('Memory Reader', 100), ('IOC Extractor', 99.0), ('Behavioural Analyser', 98.5), ('MITRE Mapper', 99.0), ('Threat-Intel Enricher', 95.0), ('Reporter', 99.8)]
tb(s, MX, 2.8, 9, 0.45, [P('Agent reliability · usable result, not a timeout or error', size=15, color=LIME, bold=True, caps=True)], name=spec('Rel label', fx='fade', t='after', dur='0.3'), check=False)
ry = 3.35
for a, v in rel:
    tb(s, MX, ry, 3.4, 0.55, [P(a, size=18.5, color=TEXT, family=HEAD, caps=True)], name=spec('Rel name', fx='fade', t='after', dur='0.12'), check=False)
    bar(s, MX + 3.5, ry + 0.13, 5.0, 0.32, (v - 90) / 10, color=LIME if v >= 99 else SOFT, name='Rel bar')
    tb(s, MX + 8.65, ry, 1.3, 0.55, [P(f'{v:g}%', size=19, color=TEXT, family=HEAD)], name=spec('Rel value', fx='fade', t='with', dur='0.2'), check=False)
    ry += 0.74
tb(s, MX + 3.5, ry - 0.05, 5.0, 0.4, [P('scale 90% → 100%', size=13, color=DIM, align='right')], name=spec('Scale', fx='fade', t='after', dur='0.2'), check=False)
svc = [('Heroku backend', '99.9%', 'desktop retries'), ('Hugging Face Space', '99.2%', 'cached or heuristic result'), ('AlienVault OTX', '97.5%', 'scan continues unenriched'),
       ('Google Gemini', '98.0%', 'Mistral, then rules'), ('Appwrite Cloud', '99.7%', 'kept locally, synced later'), ('Redis cache', '99.9%', 'full pipeline instead')]
sx = MX + 10.4
tb(s, sx, 2.8, 7, 0.45, [P('External services · uptime · fallback', size=15, color=LIME, bold=True, caps=True)], name=spec('Svc label', fx='fade', t='after', dur='0.3'), check=False)
sy = 3.35
for n_, up, fb in svc:
    parts = panel(s, sx, sy, CW - 10.4, 1.0, radius=0.5, name='Service')
    parts.append(tb(s, sx + 0.35, sy, 3.2, 1.0, [P(n_, size=18.5, color=TEXT, family=HEAD, caps=True)], name='Svc name', anchor='middle', check=False))
    parts.append(tb(s, sx + 3.55, sy, 1.3, 1.0, [P(up, size=20, color=LIME, family=HEAD)], name='Svc up', anchor='middle', check=False))
    parts.append(tb(s, sx + 4.9, sy, CW - 15.55, 1.0, [P(fb, size=14.5, color=MUTE, spacing=0.92)], name='Svc fb', anchor='middle', check=False))
    group(s, parts, spec('Service', fx='fly', dir='right', t='after', dur='0.3'))
    sy += 1.13
notes(s, "Reliability is how often each agent returned a usable result, not its accuracy. All agents were above 95%; the web "
         "scraper and the OTX enricher depend on outside services and were lowest. Every external service had a fallback, "
         "so a scan degrades instead of failing; these uptime figures are from the original test period.")

# ======================================================================================
# 17 RESULTS 4/4: EXPLANATIONS & OBJECTIVES
# ======================================================================================
s = content(7, 17, 'Explanations & objectives', 'Explanation quality and every objective against its target', part='4 of 4', source='Thesis Tables 4.6 and 4.8; Figure 4.3 (historical interface)', title_w=14)
tb(s, MX, 2.8, 8, 0.45, [P('AI-written explanations · manual 1–10 ratings', size=15, color=LIME, bold=True, caps=True)], name=spec('Exp label', fx='fade', t='after', dur='0.3'), check=False)
ey = 3.4
for t, v, d in [('Factual accuracy', 9.5, 'correct MITRE techniques and IOCs'), ('Readability', 9.0, 'a non-expert could follow it'), ('Usefulness of advice', 8.8, 'clear next steps'), ('Speed', 8.5, 'Gemini ≈1.2 s, Mistral ≈2.0 s')]:
    tb(s, MX, ey, 4.0, 0.95, [P(t, size=20, color=TEXT, family=HEAD, caps=True), P(d, size=14.5, color=MUTE)], name=spec('Exp name', fx='fade', t='after', dur='0.15'), check=False)
    bar(s, MX + 4.1, ey + 0.2, 3.3, 0.36, v / 10, name='Exp bar')
    tb(s, MX + 7.55, ey + 0.02, 1.2, 0.7, [P(f'{v}', size=28, color=LIME, family=HEAD)], name=spec('Exp value', fx='fade', t='with', d='0.3', dur='0.2'), check=False)
    ey += 1.2
alert = s.shapes.add_picture(str(ASSETS / 'image11.png'), Inches(MX), Inches(8.0), height=Inches(2.3))
alert.name = spec('Alert', fx='fadedzoom', t='after', dur='0.4')
_effects(alert, ('0E0E10', 70, 20, 8, 45))
tb(s, MX + 2.75, 8.35, 5.8, 1.6, [P("The prototype's real-time alert, with Block, Protect and Allow. A historical interface illustration from the thesis.", size=15.5, color=MUTE, spacing=0.98)], name=spec('Alert caption', fx='fade', t='with', dur='0.3'))
ox = MX + 9.3
tb(s, ox, 2.8, 8, 0.45, [P('Objectives met · Table 4.8', size=15, color=LIME, bold=True, caps=True)], name=spec('Obj label', fx='fade', t='after', dur='0.3'), check=False)
oy = 3.4
for t, tgt, res, ok in [('Real-time analysis', 'warm mean ≤ 4.00 s', '4.05 s', False), ('Accurate detection', 'above 90% accuracy', '94.7%', True), ('Few false alarms', 'keep false alarms low', '2.0%', True),
                        ('Clear explanations', 'readable by non-experts', '9.0 / 10', True), ('Reliable integrations', 'stable cloud services', '97.5%+', True)]:
    parts = panel(s, ox, oy, CW - 9.3, 1.22, radius=0.4, name='Objective')
    parts.append(tb(s, ox + 0.35, oy + 0.08, 4.3, 1.06, [P(t, size=19, color=TEXT, family=HEAD, caps=True), P(tgt, size=14, color=MUTE)], name='Obj text', anchor='middle', check=False))
    parts.append(tb(s, ox + 4.55, oy, 1.9, 1.22, [P(res, size=22, color=TEXT, family=HEAD, align='right')], name='Obj result', anchor='middle', check=False))
    b, bw = chip(s, ox + CW - 9.3 - 1.75, oy + 0.38, 'Met' if ok else 'Not met', fill=LIME if ok else RED, size=13, h=0.46)
    b.left = Inches(ox + CW - 9.3 - 0.35 - bw)
    parts.append(b)
    group(s, parts, spec('Objective', fx='fly', dir='right', t='after', dur='0.3'))
    oy += 1.38
notes(s, "Explanations were rated 9.5 for factual accuracy and 9.0 for readability by non-experts; these are descriptive manual "
         "ratings, not a blinded user study. Against the targets, four of five objectives were met. Real-time analysis was "
         "not: 4.05 seconds against a strict 4.00-second target.")

# ======================================================================================
# 18 CONCLUSION
# ======================================================================================
s = content(8, 18, 'Conclusion', 'What the study shows, and what it does not', source='Thesis §5.1 Conclusion; §4.9', title_w=12)
photo(s, 36740854, 14.55, 1.15, 4.35, 9.15, name='!!photo', focus=(0.5, 0.5))
big = [('284/300', 'URLs classified correctly'), ('137', 'harmful URLs detected'), ('3', 'benign URLs falsely flagged'), ('4.05 s', 'mean end-to-end analysis')]
bw = (13.05 - 0.9) / 4
for i, (v, k) in enumerate(big):
    x = MX + i * (bw + 0.3)
    parts = panel(s, x, 2.85, bw, 2.35, radius=0.3, fill='33402A' if i == 0 else PANEL, name='Big')
    parts.append(tb(s, x + 0.25, 2.95, bw - 0.5, 1.15, [P(v, size=46, color=LIME if i == 0 else TEXT, family=HEAD)], name='Big value', check=False))
    parts.append(tb(s, x + 0.25, 4.1, bw - 0.5, 1.0, [P(k, size=16.5, color=SOFT, spacing=0.95)], name='Big key', check=False))
    group(s, parts, spec('Big', fx='fadedzoom', t='after', dur='0.35'))
concl = [('Contribution', 'Eight specialist analyses and a Reporter combine complementary evidence into one inspectable, explained verdict, with few false alarms.'),
         ('What it does not prove', 'No single-model ablation: no proof of superiority to one model, universal protection or current production performance.'),
         ('Where it is now', 'Verified identity and workspaces, five privacy choices, service authentication, device signing and explicit action states.')]
c3 = (13.05 - 0.7) / 3
for i, (t, d) in enumerate(concl):
    card(s, MX + i * (c3 + 0.35), 5.55, c3, 4.75, t, d, num=f'0{i + 1}', ts=23, bs=18)
notes(s, "To conclude: the integrated, explainable workflow classified 284 of 300 URLs correctly with only three false alarms, "
         "in a little over four seconds. The contribution is the integration of complementary evidence into one explained "
         "verdict. The limits are clear: there is no single-model ablation, and the historical results are not a "
         "measurement of the revised system. The current source adds the access, privacy and signing controls recommended "
         "after the prototype.")

# ======================================================================================
# 19 RECOMMENDATIONS & PERSPECTIVES
# ======================================================================================
s = content(8, 19, 'Recommendations', 'And perspectives for future research', source='Thesis §5.2 Recommendations; §5.3 Perspectives', title_w=12)
photo(s, 5380651, 14.55, 1.15, 4.35, 9.15, name='!!photo', focus=(0.35, 0.5))
recs = [('Security assurance', 'Test account switching, grant revocation, hostile input, replay, expiry and elevation prompts in the packaged product.'),
        ('Privacy & retention', 'Validate the five consent categories, URL redaction, deletion and sync withdrawal across every client.'),
        ('Model quality', 'Temporal and domain-held-out evaluation; isolated training; reviewed feedback, never unchecked retraining.'),
        ('Action scope', 'Verified rollback before broader automatic response; grow CLI and MCP only with permission contracts.')]
rw = (13.05 - 0.35) / 2
for i, (t, d) in enumerate(recs):
    card(s, MX + (i % 2) * (rw + 0.35), 2.85 + (i // 2) * 2.65, rw, 2.45, t, d, label=f'Recommendation {i + 1}', ts=22, bs=17.5)
parts = panel(s, MX, 8.25, 13.05, 2.05, radius=0.4, fill='33402A', name='Persp')
parts.append(tb(s, MX + 0.45, 8.42, 6, 0.42, [P('Perspectives', size=15, color=LIME, bold=True, caps=True)], name='Persp label', check=False))
parts.append(tb(s, MX + 0.45, 8.85, 12.2, 1.35, [P('Longer deployments with raw logs · agent ablations · independent regional and hosted-phishing corpora · a blinded explanation study · isolated training · richer CLI and MCP tools · packaged mobile capture · a real dynamic-execution sandbox', size=17.5, color=TEXT, spacing=0.98)], name='Persp text'))
group(s, parts, spec('Perspectives', fx='wipe', dir='left', t='after', dur='0.6'))
notes(s, "Four recommendations follow: test the security controls in the packaged product, validate the privacy and retention "
         "controls across all clients, strengthen model evaluation and isolate training, and widen automatic actions only "
         "after verified rollback. Future research should include ablations, independent corpora and a blinded study of the "
         "explanations.")

# ======================================================================================
# 20 THANK YOU, REFERENCES (credits roll) AND CREDITS
# ======================================================================================
credits = {}
try:
    credits = json.load(open(PHOTOS / 'credits.json', encoding='utf-8'))
except Exception:
    pass
s = prs.slides.add_slide(BLANK)
background(s)
photo(s, 9786322, 0, 0, 7.4, 11.25, name='!!photo', radius=0, focus=(0.5, 0.4))
parts = panel(s, 8.2, 1.1, 6.4, 5.2, radius=0.6, name='Thanks')
parts.append(tb(s, 8.6, 1.4, 5.8, 1.9, [P('Thank you', size=86, color=TEXT, family=HEAD, caps=True)], name='Thanks title', check=False))
parts.append(tb(s, 8.65, 3.3, 5.7, 0.7, [P('Questions and discussion', size=27, color=LIME, family=HEAD, caps=True)], name='Thanks sub', check=False))
parts.append(tb(s, 8.65, 4.2, 5.7, 1.9, [P('Che Haggai Ngha Kang  ·  UBA24PP134', size=19, color=TEXT, bold=True, after=3), P('Supervisor: Prof. Onabid Mathias Akong', size=17, color=SOFT, after=2), P('The University of Bamenda  ·  College of Technology', size=17, color=SOFT)], name='Thanks text'))
group(s, parts, spec('Thanks', fx='fadedzoom', t='after', dur='0.6'))
people = sorted({re.sub(r'\s+', ' ', v['photographer']).strip() for v in credits.values() if v.get('photographer')})
unnamed = any(not v.get('photographer') for v in credits.values())
credit_line = 'Photos from Pexels (pexels.com/license) by ' + ', '.join(people) + (' and other Pexels photographers.' if unnamed else '.')
tb(s, 8.2, 6.75, 6.4, 3.6, [P('Credits', size=15, color=LIME, bold=True, caps=True, after=4),
                            P('Template: "Dark Modern Tech Startup Brand" by SlidesCarnival (slidescarnival.com), CC BY 4.0, adapted.', size=14.5, color=SOFT, after=4),
                            P(credit_line, size=14.5, color=SOFT, after=4),
                            P('Interface illustration: the thesis, Figure 4.3.', size=14.5, color=SOFT)],
   name=spec('Credits', fx='fade', by='para', t='after', dur='0.4'))
refs = ['REFERENCES', '', 'Anderson & Roth (2018) — EMBER', 'Antonakakis et al. (2012) — DGA-based malware', 'Barnum (2012) — STIX', 'Brown et al. (2020) — few-shot language models',
        'Buczak & Guven (2016) — ML for intrusion detection', 'Cockburn (2001) — Writing effective use cases', 'Devlin et al. (2019) — BERT', 'Egele et al. (2012) — dynamic malware analysis',
        'Khonji et al. (2013) — phishing detection survey', 'Le et al. (2018) — URLNet', 'Liao et al. (2016) — IOC discovery', 'Mohammad et al. (2014) — phishing websites',
        'Park et al. (2023) — Generative Agents', 'Provos et al. (2007) — The ghost in the browser', 'Russell & Norvig (2020) — AI: A Modern Approach', 'Sahingoz et al. (2019) — ML phishing detection',
        'Sommer & Paxson (2010) — Outside the closed world', 'Strom et al. (2018) — MITRE ATT&CK', 'Tounsi & Rais (2018) — threat intelligence survey', 'Vaswani et al. (2017) — Attention is all you need',
        'Wei et al. (2022) — chain-of-thought prompting', 'Willems et al. (2007) — CWSandbox', 'Wooldridge (2009) — multiagent systems', 'Yao et al. (2023) — ReAct']
tb(s, 14.85, 1.1, 4.95, 9.3, [P(r, size=14.5 if i else 17, color=LIME if i == 0 else SOFT, family=HEAD if i == 0 else BODY, bold=False, align='center', spacing=1.1) for i, r in enumerate(refs)],
   name=spec('References roll', fx='credits', t='after', d='0.5', dur='24'), check=False)
notes(s, "Thank you. I welcome your questions. The references scroll on the right; the full list is in the dissertation.")

prs.save(OUT)
print(f'built {len(prs.slides)} slides -> {OUT.name}')
for o in overflow:
    print('  FIT ' + o)
