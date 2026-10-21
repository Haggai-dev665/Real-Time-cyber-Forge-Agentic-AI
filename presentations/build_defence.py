"""Build the thesis-defence deck (static layout) from the thesis at the repository root.

Content is taken from "Che Haggai Ngha Kang.docx" (chapters 1-5 and Appendix C), in the
order of the presentation guide. Animations are not written here: every animated shape
carries its effect in its name ("label|fx=...;by=...;t=...;d=...;dur=...;dir=..."), and
apply_animations.ps1 asks PowerPoint itself to add the effects and Morph transitions,
so the animation data is PowerPoint's own.

    python build_defence.py            -> _defence-static.pptx (input to apply_animations.ps1)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / '.vendor'))
from PIL import ImageFont
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

HERE = Path(__file__).parent
ASSETS = HERE / 'assets'
OUT = HERE / '_defence-static.pptx'

# Brand palette (cyberforge-landing/cyberforge.css)
RAISIN, PANEL, IVORY, ORANGE, SAGE, INK = '1F1A1B', '2A2425', 'EFE9DD', 'F69D39', '869B7E', '0B0908'
PAPER, CARD, RULE, BODYC, MUTE, FAINT = 'EFE9DD', 'F8F4ED', 'DCD2C3', '4A4244', '857A72', '6E6466'
RED, DEEP = 'D9534F', 'C77A1E'
HEAD, BODY, MONO = 'Bahnschrift', 'Calibri', 'Consolas'
FONTS = {HEAD: 'C:/Windows/Fonts/bahnschrift.ttf', BODY: 'C:/Windows/Fonts/calibri.ttf', MONO: 'C:/Windows/Fonts/consola.ttf'}
BOLDF = {BODY: 'C:/Windows/Fonts/calibrib.ttf', HEAD: 'C:/Windows/Fonts/bahnschrift.ttf', MONO: 'C:/Windows/Fonts/consolab.ttf'}

W, H = 13.333, 7.5
RAIL = 1.05            # dark section rail on content slides
X0 = 1.55              # content left edge
CW = W - X0 - 0.6      # content width
SECTIONS = ['Brief introduction', 'Problem statement', 'Research questions', 'Research objectives',
            'Brief literature review', 'Methods and materials used', 'Results', 'Conclusion']

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(W), Inches(H)
cp = prs.core_properties
cp.title = 'CyberForge: A Real-Time Agentic AI System for Web Threat Detection and User Protection'
cp.author = 'Che Haggai Ngha Kang'
cp.subject = "Master's dissertation defence, The University of Bamenda"
BLANK = prs.slide_layouts[6]
overflow = []
_seq = {'n': 0}


def rgb(c):
    return RGBColor.from_string(c)


def spec(label, **kw):
    """A shape name carrying its animation for apply_animations.ps1."""
    _seq['n'] += 1
    if not kw:
        return f'{label} {_seq["n"]}'
    return f'{label} {_seq["n"]}|' + ';'.join(f'{k}={v}' for k, v in kw.items())


# ---------------- text measurement (to catch overflow before PowerPoint does) ----------------
_fc = {}


def _font(family, size, bold):
    key = (family, round(size * 4), bold)
    if key not in _fc:
        path = (BOLDF if bold else FONTS)[family]
        _fc[key] = ImageFont.truetype(path, max(1, round(size * 4)))
    return _fc[key]


def lines_needed(text, width_in, size, family, bold=False):
    f = _font(family, size, bold)
    limit = width_in * 72 * 4          # points * 4 (font loaded at size*4 px)
    n = 0
    for raw in text.split('\n'):
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


def tb(slide, x, y, w, h, paras, name='Text', anchor='top', align='left', inset=0.04, spacing=1.08, check=True):
    """paras: list of dicts {runs:[(text, opts)], size, family, bold, color, after, before, align}"""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    box.name = name
    tf = box.text_frame
    tf.word_wrap = True
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
        size, family = p.get('size', 16), p.get('family', BODY)
        full = ''
        for text, o in p['runs']:
            r = para.add_run()
            r.text = text
            full += text
            f = r.font
            f.size = Pt(o.get('size', size))
            f.name = o.get('family', family)
            f.bold = o.get('bold', p.get('bold', False))
            f.italic = o.get('italic', False)
            f.color.rgb = rgb(o.get('color', p.get('color', BODYC)))
        n = lines_needed(full, w - 2 * inset, size, family, p.get('bold', False))
        used += n * size * p.get('spacing', spacing) * 1.2 / 72 + ((p.get('after') or 0) + (p.get('before') or 0)) / 72
    if check and used > h - 2 * inset + 0.02:
        overflow.append(f'slide {len(prs.slides)}: "{name}" needs {used:.2f} in, has {h:.2f} in')
    return box


def P(text, size=16, color=BODYC, family=BODY, bold=False, after=None, before=None, align=None, spacing=None, runs=None):
    d = {'runs': runs or [(text, {})], 'size': size, 'color': color, 'family': family, 'bold': bold, 'after': after, 'before': before}
    if align:
        d['align'] = align
    if spacing:
        d['spacing'] = spacing
    return d


def box(slide, x, y, w, h, fill=CARD, line=RULE, name='Card', radius=0.05, shape=MSO_SHAPE.ROUNDED_RECTANGLE, lw=0.75):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    s.name = name
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
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
    s.shadow.inherit = False
    tf = s.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0)
    return s


def oval(slide, x, y, d, fill=None, line=None, name='Dot', lw=1.0):
    return box(slide, x, y, d, d, fill=fill, line=line, name=name, shape=MSO_SHAPE.OVAL, lw=lw)


def line(slide, x1, y1, x2, y2, color=RULE, width=1.25, name='Line', arrow=False):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.name = name
    c.line.color.rgb = rgb(color)
    c.line.width = Pt(width)
    if arrow:
        ln = c.line._get_or_add_ln()
        from pptx.oxml.ns import qn
        tail = ln.makeelement(qn('a:tailEnd'), {'type': 'triangle', 'w': 'med', 'len': 'med'})
        ln.append(tail)
    return c


def background(slide, color):
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = rgb(color)


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


# ---------------- slide chrome ----------------
def rail(slide, current):
    """The dark section rail: the eight section numbers form one strip that is moved so the
    current section sits beside the marker. Same names on every slide, so Morph scrolls it."""
    panel = box(slide, 0, 0, RAIL, H, fill=RAISIN, line=None, name='!!railpanel', shape=MSO_SHAPE.RECTANGLE)
    mark_y = 3.45
    box(slide, RAIL - 0.08, mark_y, 0.08, 0.6, fill=ORANGE, line=None, name='!!railmark', shape=MSO_SHAPE.RECTANGLE)
    step = 0.78
    for i in range(1, 9):
        y = mark_y + (i - current) * step
        on = i == current
        tb(slide, 0.05, y - (0.0 if on else -0.08), RAIL - 0.2, 0.6,
           [P(f'{i:02d}', size=26 if on else 15, color=ORANGE if on else FAINT, family=HEAD, bold=on, align='center')],
           name=f'!!rail{i}', anchor='middle', check=False)
    # a faint ring that drifts from slide to slide (Morph)
    return panel


def header(slide, section, title, sub=None, part=None):
    kicker = f'{section:02d}  ·  {SECTIONS[section - 1].upper()}' + (f'  ·  {part}' if part else '')
    tb(slide, X0, 0.42, CW, 0.32, [P(kicker, size=11.5, color=DEEP, family=MONO, bold=True)],
       name=spec('Kicker', fx='wipe', dir='left', t='after', dur='0.5'), check=False)
    tb(slide, X0, 0.72, CW, 0.75, [P(title, size=34, color=RAISIN, family=HEAD, bold=True)],
       name=spec('Title', fx='rise', by='char', t='with', d='0.1', dur='0.5'))
    if sub:
        tb(slide, X0, 1.42, CW, 0.45, [P(sub, size=16, color=MUTE)], name=spec('Subtitle', fx='fade', by='word', t='after', dur='0.5'))


def footer(slide, source, number):
    line(slide, X0, 7.0, W - 0.6, 7.0, color=RULE, width=0.75, name='Footer rule')
    tb(slide, X0, 7.04, CW - 1.2, 0.3, [P(source, size=9.5, color=MUTE)], name='Source', check=False)
    tb(slide, W - 1.8, 7.04, 1.2, 0.3, [P(f'{number:02d} / 20', size=9.5, color=MUTE, family=MONO, align='right')], name='Page', check=False)


def orb(slide, x, y, d, color='E2D7C6'):
    oval(slide, x, y, d, fill=None, line=color, name='!!orb', lw=1.25)
    oval(slide, x + d * 0.18, y + d * 0.18, d * 0.64, fill=None, line=color, name='!!orb2', lw=0.75)


def content_slide(section, number, title, sub=None, part=None, orb_at=(10.6, -1.2, 3.6), source=''):
    s = prs.slides.add_slide(BLANK)
    background(s, PAPER)
    orb(s, *orb_at)
    rail(s, section)
    header(s, section, title, sub, part)
    footer(s, source, number)
    return s


def card(slide, x, y, w, h, title, body, accent=ORANGE, label=None, o=None, title_size=18, body_size=14.5, fx='fly', d='0'):
    """A card with an accent bar, a title and body text; all three animate as one group."""
    shapes = []
    shapes.append(box(slide, x, y, w, h, name='Card bg'))
    shapes.append(box(slide, x, y, w, 0.07, fill=accent, line=None, name='Card accent', shape=MSO_SHAPE.RECTANGLE))
    ty = y + 0.2
    if label:
        shapes.append(tb(slide, x + 0.22, ty, w - 0.44, 0.3, [P(label, size=10.5, color=DEEP if accent == ORANGE else '5E7257', family=MONO, bold=True)], name='Card label', check=False))
        ty += 0.32
    th = lines_needed(title, w - 0.52, title_size, HEAD, True) * title_size * 1.25 / 72 + 0.08
    shapes.append(tb(slide, x + 0.22, ty, w - 0.44, th, [P(title, size=title_size, color=RAISIN, family=HEAD, bold=True)], name='Card title'))
    shapes.append(tb(slide, x + 0.22, ty + th, w - 0.44, h - (ty - y) - th - 0.12, [P(body, size=body_size, color=BODYC, spacing=1.05)], name='Card body'))
    g = slide.shapes.add_group_shape(shapes)
    g.name = spec('Card', fx=fx, dir='bottom', t='after', d=d, dur='0.45')
    return g


def chip(slide, x, y, text, fill=RAISIN, color=IVORY, size=11, name='Chip', pad=0.16, h=0.34, family=MONO):
    f = _font(family, size, True)
    w = f.getlength(text) / (72 * 4) + 2 * pad
    s = box(slide, x, y, w, h, fill=fill, line=None, name=name, radius=0.5)
    tf = s.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text
    r.font.size, r.font.name, r.font.bold = Pt(size), family, True
    r.font.color.rgb = rgb(color)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    return s, w


# ======================================================================================
# 1  TITLE
# ======================================================================================
s = prs.slides.add_slide(BLANK)
background(s, RAISIN)
oval(s, 8.55, 1.0, 5.4, fill=None, line='3A3233', name='!!orb', lw=1.25)
oval(s, 9.52, 1.97, 3.46, fill=None, line='3A3233', name='!!orb2', lw=0.75)
# eight agent nodes on the orbit, around a shield
import math
cx, cy, R = 11.25, 3.7, 2.7
for i in range(8):
    a = -math.pi / 2 + i * math.tau / 8
    oval(s, cx + R * math.cos(a) - 0.13, cy + R * math.sin(a) - 0.13, 0.26, fill=ORANGE if i % 2 == 0 else SAGE, line=None,
         name=spec('Agent node', fx='zoom', t='after' if i else 'after', d='0', dur='0.25'))
def poly(slide, pts, ox, oy, close=True):
    fb = slide.shapes.build_freeform(Inches(ox + pts[0][0]), Inches(oy + pts[0][1]), scale=1.0)
    fb.add_line_segments([(Inches(ox + x), Inches(oy + y)) for x, y in pts[1:]], close=close)
    return fb.convert_to_shape()
sh_pts = [(0.75, 0.0), (1.5, 0.28), (1.5, 0.85), (1.32, 1.28), (0.75, 1.72), (0.18, 1.28), (0.0, 0.85), (0.0, 0.28)]
shield = poly(s, sh_pts, cx - 0.75, cy - 0.86)
shield.fill.solid(); shield.fill.fore_color.rgb = rgb(ORANGE); shield.line.fill.background(); shield.shadow.inherit = False
check = poly(s, [(0.42, 0.86), (0.66, 1.1), (1.1, 0.6)], cx - 0.75, cy - 0.86, close=False)
check.fill.background(); check.line.color.rgb = rgb(RAISIN); check.line.width = Pt(7); check.shadow.inherit = False
sg = s.shapes.add_group_shape([shield, check])
sg.name = spec('Shield', fx='fadedzoom', t='after', dur='0.6')
ring = oval(s, cx - 1.75, cy - 1.75, 3.5, fill=None, line=ORANGE, name=spec('Scan ring', fx='wheel', t='with', dur='1.2'), lw=2)
logo = s.shapes.add_picture(str(ASSETS / 'image2.png'), Inches(0.8), Inches(0.55), height=Inches(0.95))
logo.name = spec('University logo', fx='fade', t='with', dur='0.6')
tb(s, 1.9, 0.62, 6.2, 0.9, [P('THE UNIVERSITY OF BAMENDA', size=12, color=IVORY, family=MONO, bold=True, after=2),
                             P('College of Technology  ·  Department of Computer Engineering', size=12, color='B9AFA2')],
   name=spec('Institution', fx='fade', t='with', d='0.2', dur='0.6'))
tb(s, 0.8, 1.95, 7.6, 1.38, [P('CyberForge', size=72, color=IVORY, family=HEAD, bold=True)], name=spec('Deck title', fx='rise', by='char', t='after', dur='0.6'))
tb(s, 0.8, 3.25, 7.4, 1.25, [P('A Real-Time Agentic AI System for Web Threat Detection and User Protection', size=26, color=ORANGE, family=HEAD, spacing=1.0)],
   name=spec('Deck subtitle', fx='fade', by='word', t='after', dur='0.6'))
box(s, 0.8, 4.75, 0.9, 0.05, fill=SAGE, line=None, name=spec('Divider', fx='wipe', dir='left', t='after', dur='0.4'), shape=MSO_SHAPE.RECTANGLE)
tb(s, 0.8, 4.95, 7.4, 1.6, [P('CHE HAGGAI NGHA KANG', size=20, color=IVORY, family=HEAD, bold=True, after=2),
                            P('Registration number UBA24PP134', size=14, color='B9AFA2', after=8),
                            P("Master's in Computer Engineering — Information Technology and Cyber Security", size=14, color='B9AFA2')],
   name=spec('Candidate', fx='rise', by='para', t='after', dur='0.45'))
tb(s, 0.8, 6.55, 7.6, 0.6, [P('Supervisor: Prof. Onabid Mathias Akong, Associate Professor   ·   June 2026', size=13, color=IVORY)],
   name=spec('Supervisor', fx='fade', t='after', dur='0.5'))
notes(s, "Good morning. My dissertation is CyberForge, a real-time agentic AI system for web threat detection and user "
         "protection, supervised by Professor Onabid Mathias Akong. I will follow the structure: introduction, problem, "
         "research questions and objectives, a brief literature review, methods and materials, results, and the conclusion.")

# ======================================================================================
# 2  BRIEF INTRODUCTION
# ======================================================================================
s = content_slide(1, 2, 'Brief introduction', 'Why web-threat detection needs more than one model', source='Thesis §1.1 Background of the Study')
pts = [('The browser is the attack surface', 'Phishing, drive-by downloads, credential theft and malicious ads now dominate, as the boundary moved from the firewall to the browser (Provos et al., 2007; Khonji et al., 2013).'),
       ('Signatures fall behind', 'Fast-changing domains, hidden payloads and short-lived infrastructure defeat signature-based tools.'),
       ('Detection grew smarter', 'From machine learning to deep learning and Transformers that read URLs in context (Devlin et al., 2019; Buczak & Guven, 2016).'),
       ('From one model to cooperating agents', 'Specialised agents for detection, extraction, analysis and reporting decide better together, as analysts reason step by step (Yao et al., 2023; Strom et al., 2018).')]
y = 2.1
for i, (t, b) in enumerate(pts):
    oval(s, X0, y + 0.07, 0.34, fill=ORANGE if i % 2 == 0 else SAGE, line=None, name=spec('Point dot', fx='zoom', t='after', dur='0.25'))
    tb(s, X0 + 0.07, y + 0.07, 0.22, 0.34, [P(str(i + 1), size=12, color=RAISIN, family=HEAD, bold=True, align='center')], name=spec('Point n', fx='fade', t='with', dur='0.25'), anchor='middle', inset=0, check=False)
    tb(s, X0 + 0.55, y, 5.75, 1.15, [P(t, size=18, color=RAISIN, family=HEAD, bold=True, after=3), P(b, size=14, color=BODYC, spacing=1.04)],
       name=spec('Point', fx='rise', by='para', t='with', dur='0.45'))
    if i < 3:
        line(s, X0 + 0.17, y + 0.45, X0 + 0.17, y + 1.18, color=RULE, width=1.5, name=spec('Point link', fx='wipe', dir='top', t='after', dur='0.3'))
    y += 1.18
g = box(s, 8.05, 2.1, 4.68, 4.6, fill=RAISIN, line=None, name=spec('CyberForge panel', fx='fly', dir='right', t='after', dur='0.6'), radius=0.04)
tb(s, 8.35, 2.32, 4.1, 0.4, [P('THE PRESENT STUDY', size=11, color=ORANGE, family=MONO, bold=True)], name=spec('Panel kicker', fx='fade', t='after', dur='0.3'), check=False)
tb(s, 8.35, 2.7, 4.1, 0.65, [P('CyberForge', size=30, color=IVORY, family=HEAD, bold=True)], name=spec('Panel title', fx='rise', by='char', t='after', dur='0.5'))
tb(s, 8.35, 3.38, 4.12, 2.3, [P('A multi-platform, agent-based system that analyses URLs in real time and protects users while they browse.', size=15.5, color=IVORY, after=8),
                              P('Specialised agents classify the URL, analyse the domain, inspect behaviour, look up threat intelligence and map adversary techniques, then agree one verdict.', size=14, color='CFC6B8')],
   name=spec('Panel body', fx='fade', by='word', t='after', dur='0.6'))
cx0 = 8.35
for t in ['URL', 'Domain', 'Behaviour', 'Threat intel', 'ATT&CK']:
    c, wdt = chip(s, cx0, 6.1, t, fill=PANEL, color=ORANGE, size=10, name=spec('Agent chip', fx='zoom', t='after', dur='0.2'))
    cx0 += wdt + 0.08
notes(s, "The web is now the main attack surface. Signature tools fall behind fast-changing domains, so research moved to "
         "machine learning, deep learning and Transformers, and now to systems of specialised agents. CyberForge is my "
         "response: specialised agents analyse each URL in real time and agree one explained verdict. Scope is URL and "
         "web-context security; kernel, firmware and enterprise lateral movement are out of scope (§1.6).")

# ======================================================================================
# 3  PROBLEM STATEMENT
# ======================================================================================
s = content_slide(2, 3, 'Problem statement', 'Three persistent problems limit AI-based threat detection for ordinary users and small teams',
                  orb_at=(10.2, 4.6, 3.8), source='Thesis §1.2 Problem Statement')
probs = [('PROBLEM 1', 'Too many false alarms', 'Single-model URL classifiers are prone to false positives. An early CyberForge heuristic rated every URL — google.com and github.com included — "medium risk" because of a +0.5 offset. Alert fatigue makes users ignore genuine threats.'),
         ('PROBLEM 2', 'A number, not a story', 'A classifier outputs a probability, but cannot list the indicators of compromise on the page, map script activity to a MITRE technique, or link the domain to earlier threat reports.'),
         ('PROBLEM 3', 'No open, connected architecture', 'No widely deployed open system fans one browser event out to specialised analysers, keeps the result, reuses past visits and shows it on desktop and mobile. SOAR platforms do, at enterprise price and complexity.')]
cw3 = (CW - 0.5) / 3
for i, (lab, t, b) in enumerate(probs):
    card(s, X0 + i * (cw3 + 0.25), 2.15, cw3, 3.55, t, b, accent=ORANGE if i != 1 else SAGE, label=lab, body_size=14.5)
band = box(s, X0, 5.95, CW, 0.82, fill=RAISIN, line=None, name=spec('Answer band', fx='wipe', dir='left', t='after', dur='0.6'), radius=0.12)
tb(s, X0 + 0.3, 5.95, CW - 0.6, 0.82, [P('', runs=[('CyberForge answers with ', {'color': IVORY}), ('specialist analysis', {'color': ORANGE, 'bold': True}),
                                               (', ', {'color': IVORY}), ('inspectable evidence', {'color': ORANGE, 'bold': True}),
                                               (' and ', {'color': IVORY}), ('controlled sharing of results', {'color': ORANGE, 'bold': True}), ('.', {'color': IVORY})], size=17)],
   name=spec('Answer', fx='fade', by='word', t='after', dur='0.5'), anchor='middle')
notes(s, "Three problems. First, false alarms: my own early heuristic returned 'medium' for every URL because of a +0.5 "
         "baseline offset, which shows how biases stay hidden until deployment. Second, explainability: a probability is not "
         "a story an analyst can act on. Third, no open architecture combines specialised analysers, memory and cross-device "
         "display; SOAR products do, but at enterprise scale.")

# ======================================================================================
# 4  RESEARCH QUESTIONS
# ======================================================================================
s = content_slide(3, 4, 'Research questions', orb_at=(10.9, -1.6, 3.4), source='Thesis §1.3 Research Questions')
box(s, X0, 1.6, CW, 1.35, fill=RAISIN, line=None, name=spec('GRQ band', fx='wipe', dir='left', t='after', dur='0.5'), radius=0.08)
tb(s, X0 + 0.3, 1.72, 2.2, 0.3, [P('GENERAL QUESTION', size=11, color=ORANGE, family=MONO, bold=True)], name=spec('GRQ label', fx='fade', t='after', dur='0.3'), check=False)
tb(s, X0 + 0.3, 2.02, CW - 0.6, 0.9, [P('How can a multi-agent AI system, organised as a network of specialised analysers, be designed to provide real-time and explainable threat intelligence and protection for URLs and web resources across different platforms?', size=16.5, color=IVORY, spacing=1.04)],
   name=spec('GRQ', fx='fade', by='word', t='after', dur='0.9'))
rqs = [('Decomposition', 'How can the analysis of a URL be divided among different AI agents, and what is the smallest set of agents needed for a reliable threat assessment?'),
       ('Integration', 'How can URL classification, behavioural analysis, IOC extraction, MITRE ATT&CK mapping and threat-intelligence lookup be combined into one system with consistent, accurate assessments?'),
       ('Aggregation', 'What method can combine the agents\' results to reduce false alarms while still identifying serious threats when strong evidence is available?'),
       ('Historical context', 'How can historical browsing information improve threat detection, identify recurring malicious activity and strengthen user protection over time?')]
y = 3.2
for i, (k, q) in enumerate(rqs):
    tb(s, X0, y, 0.85, 0.85, [P(f'RQ{i + 1}', size=24, color=ORANGE, family=HEAD, bold=True)], name=spec('RQ n', fx='fadedzoom', t='after', dur='0.3'), check=False)
    tb(s, X0 + 0.95, y + 0.02, 2.4, 0.5, [P(k, size=17, color=RAISIN, family=HEAD, bold=True)], name=spec('RQ key', fx='rise', by='char', t='with', dur='0.35'))
    tb(s, X0 + 3.4, y, CW - 3.4, 0.85, [P(q, size=15, color=BODYC, spacing=1.03)], name=spec('RQ text', fx='fade', by='word', t='with', d='0.1', dur='0.6'))
    if i < 3:
        line(s, X0, y + 0.86, X0 + CW, y + 0.86, color=RULE, width=0.75, name=spec('RQ rule', fx='wipe', dir='left', t='after', dur='0.25'))
    y += 0.92
notes(s, "The general question asks how a network of specialised analysers can give real-time, explainable protection across "
         "platforms. It breaks into four: decomposition, integration of the analysis types, aggregation that reduces false "
         "alarms without hiding strong threats, and the use of historical browsing context.")

# ======================================================================================
# 5  RESEARCH OBJECTIVES
# ======================================================================================
s = content_slide(4, 5, 'Research objectives', orb_at=(9.9, 4.9, 3.6), source='Thesis §1.4 Objectives of the Study')
box(s, X0, 1.6, CW, 1.35, fill=CARD, line=RULE, name=spec('GO band', fx='wipe', dir='left', t='after', dur='0.5'), radius=0.08)
box(s, X0, 1.6, 0.09, 1.35, fill=ORANGE, line=None, name=spec('GO accent', fx='wipe', dir='top', t='with', dur='0.5'), shape=MSO_SHAPE.RECTANGLE)
tb(s, X0 + 0.3, 1.72, 2.4, 0.3, [P('GENERAL OBJECTIVE', size=11, color=DEEP, family=MONO, bold=True)], name=spec('GO label', fx='fade', t='after', dur='0.3'), check=False)
tb(s, X0 + 0.3, 2.02, CW - 0.6, 0.9, [P('To design, implement and evaluate a multi-platform AI-driven cybersecurity system that monitors URLs in real time, detects and explains threats with cooperating agents, and gives timely alerts and protective feedback while keeping historical context and persistent threat records.', size=15.5, color=RAISIN, spacing=1.04)],
   name=spec('GO', fx='fade', by='word', t='after', dur='0.9'))
objs = [('Multi-agent decision framework', 'Decompose URL analysis into coordinated tasks that produce reliable real-time assessments.', 'RQ1'),
        ('Unified detection approach', 'Combine content, behavioural signals, structural patterns and threat intelligence for accuracy and consistency.', 'RQ2'),
        ('Decision aggregation', 'Reduce false alerts while high-confidence malicious indicators still trigger immediate warnings and protection.', 'RQ3'),
        ('Contextual threat intelligence', 'Link current URL behaviour with known attack patterns and external threat databases.', 'RQ4')]
cw2 = (CW - 0.3) / 2
for i, (t, b, rq) in enumerate(objs):
    x = X0 + (i % 2) * (cw2 + 0.3)
    yy = 3.15 + (i // 2) * 1.86
    g = card(s, x, yy, cw2, 1.74, t, b, accent=SAGE if i % 2 else ORANGE, label=f'SPECIFIC OBJECTIVE {i + 1}  →  {rq}', body_size=14.5)
notes(s, "The general objective is to design, implement and evaluate the system end to end. Each specific objective answers "
         "one research question: the agent framework, the unified detection approach, the aggregation that controls false "
         "alerts, and contextual threat intelligence.")

# ======================================================================================
# 6  LITERATURE REVIEW: KEY WORKS (horizontal scroll)
# ======================================================================================
s = content_slide(5, 6, 'Brief literature review', 'From rules to learning to cooperating agents', part='1 OF 2', orb_at=(10.7, -1.4, 3.4),
                  source='Thesis Chapter 2 (§2.2–2.9); full references on the final slide')
stages = [('Rule & feature based', 'Mohammad et al., 2014'), ('Classical ML', 'Sahingoz et al., 2019'), ('Deep learning', 'Le et al., 2018; Devlin et al., 2019'), ('Hybrid + agents', 'Khonji et al., 2013; Yao et al., 2023')]
sx = X0
sw = (CW - 0.45) / 4
for i, (t, r) in enumerate(stages):
    b = box(s, sx, 2.05, sw, 0.78, fill=RAISIN if i == 3 else CARD, line=None if i == 3 else RULE, name='Stage box', radius=0.12)
    t1 = tb(s, sx + 0.15, 2.09, sw - 0.3, 0.4, [P(t, size=15, color=ORANGE if i == 3 else RAISIN, family=HEAD, bold=True, align='center')], name='Stage title', check=False)
    t2 = tb(s, sx + 0.15, 2.45, sw - 0.3, 0.32, [P(r, size=10.5, color='CFC6B8' if i == 3 else MUTE, align='center')], name='Stage ref', check=False)
    g = s.shapes.add_group_shape([b, t1, t2])
    g.name = spec('Stage', fx='fly', dir='left', t='after', dur='0.35')
    if i < 3:
        line(s, sx + sw + 0.02, 2.44, sx + sw + 0.13, 2.44, color=ORANGE, width=1.5, name=spec('Stage arrow', fx='wipe', dir='left', t='after', dur='0.15'), arrow=True)
    sx += sw + 0.15
works = [('2007', 'Provos et al.', 'Drive-by downloads: 1.3% of sampled pages; predicted short-lived domains and polymorphic JavaScript.'),
         ('2010', 'Sommer & Paxson', 'ML for intrusion detection must handle cost-asymmetric errors and be interpretable.'),
         ('2012', 'Antonakakis et al.', 'DGA domains look random: high entropy, few vowels, digit mixing; detect families, not single names.'),
         ('2013', 'Khonji et al.', 'Survey of 70+ phishing works: combine lexical, content and reputation features.'),
         ('2016', 'Liao et al.', 'Automatic IOC discovery from open threat reports; STIX/TAXII for sharing (Barnum, 2012).'),
         ('2018', 'Strom et al.', 'MITRE ATT&CK: shared language of adversary tactics and techniques.'),
         ('2018', 'Le et al.', 'URLNet learns URL representations from raw text with deep learning.'),
         ('2019', 'Devlin et al.', 'BERT: pre-train then fine-tune; domain-adapted variants for security.'),
         ('2023', 'Yao et al.', 'ReAct: reason, act, observe, repeat — the loop behind agentic systems.'),
         ('2023', 'Park et al.', 'Generative Agents: memory lets agents behave consistently over time.')]
# the timeline strip is wider than the slide; a motion path scrolls it left
item_w, gap = 2.55, 0.22
parts = []
tl_y = 3.35
parts.append(line(s, X0, tl_y + 0.42, X0 + len(works) * (item_w + gap), tl_y + 0.42, color=ORANGE, width=1.5, name='Timeline'))
for i, (yr, who, what) in enumerate(works):
    x = X0 + i * (item_w + gap)
    parts.append(oval(s, x, tl_y + 0.32, 0.2, fill=ORANGE if i % 2 == 0 else SAGE, line=None, name='Year dot'))
    parts.append(tb(s, x - 0.02, tl_y - 0.22, 1.2, 0.5, [P(yr, size=20, color=ORANGE if i % 2 == 0 else '5E7257', family=HEAD, bold=True)], name='Year', check=False))
    parts.append(box(s, x, tl_y + 0.85, item_w, 2.35, name='Work card'))
    parts.append(tb(s, x + 0.18, tl_y + 1.0, item_w - 0.36, 0.45, [P(who, size=16, color=RAISIN, family=HEAD, bold=True)], name='Work author'))
    parts.append(tb(s, x + 0.18, tl_y + 1.45, item_w - 0.36, 1.7, [P(what, size=13.5, color=BODYC, spacing=1.04)], name='Work finding'))
strip = s.shapes.add_group_shape(parts)
strip.name = spec('Timeline strip', fx='fade', t='after', dur='0.5', scroll=f'{-(len(works) * (item_w + gap) - CW) / W:.4f}', sdur='7', sd='0.8')
# the strip scrolls left under the section rail, so the rail is drawn on top of it
tree = s.shapes._spTree
for shp in list(s.shapes):
    if shp.name.startswith('!!rail'):
        tree.remove(shp._element); tree.append(shp._element)
notes(s, "The literature moves through four stages: hand-written rules, classical machine learning, deep learning and "
         "Transformers, and now hybrid designs and agents. The timeline scrolls through the works the design builds on: "
         "Provos on drive-by downloads, Sommer and Paxson's critique of ML for intrusion detection, Antonakakis on DGAs, "
         "Khonji's phishing survey, IOC extraction, MITRE ATT&CK, URLNet, BERT, ReAct and Generative Agents.")

# ======================================================================================
# 7  LITERATURE REVIEW: RESEARCH GAPS
# ======================================================================================
s = content_slide(5, 7, 'Brief literature review', 'Five gaps between research ideas and working systems', part='2 OF 2', orb_at=(10.3, 4.7, 3.7),
                  source='Thesis §2.10 Research Gaps')
gaps = [('Few complete multi-agent security systems', 'Agent frameworks show the idea; few open systems apply it end to end to URL security.', 'A full working pipeline of connected agents.'),
        ('Model and service failure', 'Systems rarely say when a model or service did not answer.', 'Capability readiness and explicit unknown states.'),
        ('Accuracy over real false alarms', 'Lab scores hide how often safe sites are flagged (Sommer & Paxson, 2010).', 'Multi-signal aggregation tuned for few false positives.'),
        ('Historical context unused', 'Past observations are rarely reused for later assessment (Park et al., 2023).', 'Memory supplies prior verdicts as context.'),
        ('Hard to reproduce', 'Private data, closed systems and costly infrastructure block follow-up work.', 'Public tools and modular, testable services.')]
y = 2.0
for i, (g_, why, ans) in enumerate(gaps):
    tb(s, X0, y, 0.75, 0.8, [P(f'G{i + 1}', size=22, color=ORANGE, family=HEAD, bold=True)], name=spec('Gap n', fx='fadedzoom', t='after', dur='0.25'), check=False)
    tb(s, X0 + 0.8, y - 0.04, 4.85, 0.98, [P(g_, size=16, color=RAISIN, family=HEAD, bold=True, after=1), P(why, size=12.5, color=BODYC, spacing=1.0)],
       name=spec('Gap', fx='rise', by='para', t='with', dur='0.4'))
    ab = box(s, X0 + 5.75, y + 0.06, CW - 5.75, 0.68, fill=RAISIN, line=None, name='Gap answer bg', radius=0.18)
    at = tb(s, X0 + 6.0, y + 0.06, CW - 6.25, 0.68, [P('', runs=[('CyberForge  ', {'color': ORANGE, 'bold': True, 'family': MONO, 'size': 11}), (ans, {'color': IVORY})], size=14.5)], name='Gap answer', anchor='middle')
    grp = s.shapes.add_group_shape([ab, at])
    grp.name = spec('Gap answer', fx='fly', dir='right', t='after', dur='0.4')
    y += 0.97
notes(s, "Five gaps motivate the work: few complete multi-agent security systems, little honesty about model and service "
         "failure, a focus on accuracy rather than false alarms, unused historical context, and poor reproducibility. Each "
         "dark pill shows how CyberForge responds.")

# ======================================================================================
# 8  METHODS 1/6: ARCHITECTURE
# ======================================================================================
s = content_slide(6, 8, 'Methods and materials used', 'System architecture: four layers with a clear data flow', part='1 OF 6', orb_at=(10.8, -1.5, 3.3),
                  source='Thesis §3.2 System Architecture, Figure 3.1')
layers = [('CLIENT', 'Tauri 2 desktop · React Native/Expo companion · scoped Rust CLI · grant-controlled MCP stdio tools', ORANGE),
          ('NATIVE & BACKEND CONTROL', 'Shared Rust services, OS keyring, local ownership · Node.js 24/Express: authentication, workspace membership, device and agent workflows', SAGE),
          ('INFERENCE', 'FastAPI service on Hugging Face Spaces: trained URL models, BERT, DGA rules, Qwen explanations, versioned capability and analysis contracts', ORANGE),
          ('PERSISTENCE & INTELLIGENCE', 'MongoDB control-plane records, selected Appwrite integrations, local stores, caches and vector adapters · AlienVault OTX and page fetching', SAGE)]
y = 2.05
for i, (k, d, c) in enumerate(layers):
    b = box(s, X0, y, 7.35, 1.05, name='Layer bg')
    a = box(s, X0, y, 2.45, 1.05, fill=c, line=None, name='Layer key bg', radius=0.08)
    kt = tb(s, X0 + 0.15, y, 2.15, 1.05, [P(k, size=12.5, color=RAISIN, family=MONO, bold=True, align='center')], name='Layer key', anchor='middle', check=False)
    dt = tb(s, X0 + 2.6, y + 0.02, 4.65, 1.01, [P(d, size=13, color=BODYC, spacing=1.0)], name='Layer text', anchor='middle')
    g = s.shapes.add_group_shape([b, a, kt, dt])
    g.name = spec('Layer', fx='fly', dir='left', t='after', dur='0.4')
    if i < 3:
        line(s, X0 + 1.22, y + 1.06, X0 + 1.22, y + 1.2, color=RAISIN, width=1.5, name=spec('Layer arrow', fx='wipe', dir='top', t='after', dur='0.15'), arrow=True)
    y += 1.2
flow = [('Address', 'submitted manually or from a consented observation'), ('Privacy & session checks', 'native layer, before the backend'),
        ('Backend routes', 'select the analysis or durable-run service'), ('Source-labelled result', 'with coverage and failure information')]
fx_, fy = 9.3, 2.05
tb(s, fx_, fy, 3.4, 0.35, [P('ONE REQUEST', size=11, color=DEEP, family=MONO, bold=True)], name=spec('Flow label', fx='fade', t='after', dur='0.3'), check=False)
fy += 0.42
for i, (t, d) in enumerate(flow):
    b = box(s, fx_, fy, 3.43, 0.86, fill=RAISIN if i in (0, 3) else CARD, line=None if i in (0, 3) else RULE, name='Flow bg', radius=0.1)
    tt = tb(s, fx_ + 0.18, fy + 0.06, 3.1, 0.78, [P(t, size=15, color=ORANGE if i in (0, 3) else RAISIN, family=HEAD, bold=True, after=1),
                                                 P(d, size=11.5, color='CFC6B8' if i in (0, 3) else MUTE, spacing=1.0)], name='Flow text')
    g = s.shapes.add_group_shape([b, tt])
    g.name = spec('Flow step', fx='rise', t='after', dur='0.35')
    if i < 3:
        line(s, fx_ + 1.7, fy + 0.87, fx_ + 1.7, fy + 1.0, color=ORANGE, width=1.5, name=spec('Flow arrow', fx='wipe', dir='top', t='after', dur='0.12'), arrow=True)
    fy += 1.02
notes(s, "The architecture separates four layers: clients, native and backend control, inference, and persistence with "
         "intelligence. A request passes privacy and session checks in the native layer, the backend selects the service, "
         "and the user receives a source-labelled result that states its coverage and any failure.")

# ======================================================================================
# 9  METHODS 2/6: EIGHT-AGENT PIPELINE
# ======================================================================================
s = content_slide(6, 9, 'Methods and materials used', 'The eight-agent analysis pipeline: a three-stage directed acyclic graph', part='2 OF 6', orb_at=(10.4, 4.9, 3.5),
                  source='Thesis §3.8, Table 3.1; historical blend Eq. 3.1')
cols = [('STAGE 1 · URL & CONTEXT', 'Run in parallel on the URL', [('URL Classifier', 'BERT label and confidence'), ('DGA Detector', 'entropy and character patterns'), ('Web Scraper', 'content, scripts, headers'), ('Memory Reader', 'past visits and verdicts')]),
        ('STAGE 2 · CONTENT', 'Start once the page is scraped', [('IOC Extractor', '10 patterns: IPs, URLs, hashes, CVEs…'), ('Behavioural Analyser', 'eval/atob, hidden forms, trackers'), ('MITRE Mapper', '20 signals → ATT&CK techniques')]),
        ('STAGE 3 · ENRICHMENT', 'Needs the extracted IOCs', [('Threat Intelligence', 'AlienVault OTX reputation')]),
        ('REPORTER', 'Combines every result', [('Reporter Agent', 'risk score, verdict, explanation, stored report')])]
colw = [3.05, 3.05, 2.4, 2.2]
cx_ = X0
for ci, (head, sub, agents) in enumerate(cols):
    w_ = colw[ci]
    hb = box(s, cx_, 2.05, w_, 0.72, fill=RAISIN, line=None, name='Stage head bg', radius=0.1)
    ht = tb(s, cx_ + 0.15, 2.07, w_ - 0.3, 0.7, [P(head, size=11.5, color=ORANGE, family=MONO, bold=True, after=1), P(sub, size=11, color='CFC6B8')], name='Stage head', anchor='middle', check=False)
    g = s.shapes.add_group_shape([hb, ht])
    g.name = spec('Stage head', fx='fly', dir='top', t='after', dur='0.35')
    ay = 2.95
    for ai, (an, ad) in enumerate(agents):
        ab = box(s, cx_, ay, w_, 0.74, name='Agent bg', radius=0.1)
        acc = box(s, cx_, ay, 0.07, 0.74, fill=ORANGE if ci != 3 else SAGE, line=None, name='Agent accent', shape=MSO_SHAPE.RECTANGLE)
        at = tb(s, cx_ + 0.2, ay + 0.03, w_ - 0.3, 0.7, [P(an, size=15, color=RAISIN, family=HEAD, bold=True, after=1), P(ad, size=11.5, color=MUTE, spacing=1.0)], name='Agent text')
        g = s.shapes.add_group_shape([ab, acc, at])
        g.name = spec('Agent', fx='zoom' if ci == 0 else 'fly', dir='bottom', t='with' if ai else 'after', d=f'{ai * 0.08:.2f}', dur='0.35')
        ay += 0.8
    if ci < 3:
        line(s, cx_ + w_ + 0.03, 3.38, cx_ + w_ + colw[ci + 1] * 0 + 0.2, 3.38, color=ORANGE, width=2, name=spec('DAG arrow', fx='wipe', dir='left', t='after', dur='0.25'), arrow=True)
    cx_ += w_ + 0.24
fb = box(s, X0, 6.15, CW, 0.68, fill=CARD, line=RULE, name=spec('Formula band', fx='wipe', dir='left', t='after', dur='0.5'), radius=0.1)
tb(s, X0 + 0.25, 6.15, CW - 0.5, 0.68, [P('', runs=[('Historical blend (Eq. 3.1):  ', {'bold': True, 'color': RAISIN}),
                                                  ('risk = 0.6 × mean agent score + 0.4 × maximum agent score', {'family': MONO, 'color': DEEP, 'size': 13.5}),
                                                  ('   — averages the evidence, yet one strong signal still raises the verdict.', {'color': BODYC})], size=14)],
   name=spec('Formula', fx='fade', by='word', t='after', dur='0.6'), anchor='middle')
notes(s, "Eight specialist agents run in three stages plus a Reporter. Stage one works on the URL alone, in parallel: the BERT "
         "URL classifier, the DGA detector, the web scraper and the memory reader. Stage two needs the scraped page: IOC "
         "extraction with ten patterns, behavioural analysis, and MITRE mapping with twenty signals. Stage three enriches "
         "IOCs from AlienVault OTX. The Reporter combines everything. The original blend weights the mean at 60% and the "
         "strongest signal at 40%, so one strong signal is not averaged away. The current ReportAgent uses a weighted "
         "evidence sum instead (§3.4).")

# ======================================================================================
# 10 METHODS 3/6: MATERIALS
# ======================================================================================
s = content_slide(6, 10, 'Methods and materials used', 'Materials: hardware, software, libraries, services and data', part='3 OF 6', orb_at=(10.9, -1.6, 3.3),
                  source='Thesis §3.6 Materials; Appendix C.3')
quad = [('SOFTWARE', 'Tauri 2 / Rust desktop · Node.js 24 + Express 4 backend · Python FastAPI on Hugging Face Spaces · React Native 0.81.5 / Expo 54 companion · Rust core, CLI and MCP adapter', ORANGE),
        ('KEY LIBRARIES', 'transformers 4.40+ · scikit-learn 1.8.0 · torch 2.2+ · llama-cpp-python 0.3.36 · huggingface_hub · pandas, NumPy, joblib · axios · node-appwrite · redis', SAGE),
        ('SERVICES', 'Hugging Face Spaces (inference, owner-run training) · MongoDB/Mongoose · Appwrite · AlienVault OTX · WebScrapper.live · Qwen3.5-2B GGUF via llama.cpp', SAGE),
        ('DATA & PRETRAINED ARTEFACTS', 'BERT elftsdmr/malware-url-detect · unsloth/Qwen3.5-2B-GGUF · MITRE ATT&CK v15 · OTX pulse feed · Mitake, bgspaditya, pirocheto, Tranco top-1M, shengqin web-attacks', ORANGE)]
qw = (CW - 0.3) / 2
for i, (k, d, c) in enumerate(quad):
    card(s, X0 + (i % 2) * (qw + 0.3), 2.0 + (i // 2) * 2.12, qw, 2.02, d.split(' · ')[0], ' · '.join(d.split(' · ')[1:]), accent=c, label=k, title_size=16.5, body_size=13.5)
hw = box(s, X0, 6.3, CW, 0.52, fill=RAISIN, line=None, name='HW bg', radius=0.3)
ht = tb(s, X0 + 0.25, 6.3, CW - 0.5, 0.52, [P('', runs=[('HARDWARE  ', {'color': ORANGE, 'family': MONO, 'bold': True, 'size': 11}), ('Original development on an Apple-silicon MacBook, 16 GB RAM, macOS Sonoma 14.6', {'color': IVORY})], size=14)], name='HW text', anchor='middle')
g = s.shapes.add_group_shape([hw, ht]); g.name = spec('Hardware', fx='wipe', dir='left', t='after', dur='0.5')
notes(s, "The materials: a Tauri 2 and Rust desktop, a Node.js 24 Express backend, a Python FastAPI service on Hugging Face "
         "Spaces, a React Native companion, and a shared Rust core with a CLI and MCP adapter. Key libraries include "
         "transformers, scikit-learn 1.8.0 and llama-cpp-python. Pretrained BERT and Qwen are used for inference only; the "
         "training data sets are public phishing, malware-URL, popularity and web-attack corpora.")

# ======================================================================================
# 11 METHODS 4/6: DEVELOPMENT & CALIBRATION
# ======================================================================================
s = content_slide(6, 11, 'Methods and materials used', 'Iterative development in seven deployable iterations, then calibration', part='4 OF 6', orb_at=(10.3, 4.8, 3.6),
                  source='Thesis §3.7 Methodology; Appendix A')
its = [('Foundation', 'repository, Heroku and Space deployments, Appwrite, ML stub'), ('Single-classifier pipeline', 'scraper → ML classifier → Gemini → alert'),
       ('False-positive correction', '+0.5 offset found and removed; model consensus'), ('Sandbox subsystem', 'IOC extractor, MITRE mapper, evidence locker'),
       ('Transformer integration', 'BERT URL classifier and entropy DGA detector'), ('Agentic orchestration', 'eight-agent DAG, memory layer, LLM fallback'),
       ('UI integration', 'desktop polling, agent grid, orchestrator dashboard')]
iw = (CW - 6 * 0.12) / 7
line(s, X0 + 0.25, 2.47, X0 + CW - 0.25, 2.47, color=ORANGE, width=2, name=spec('Iteration track', fx='wipe', dir='left', t='after', dur='0.8'))
for i, (t, d) in enumerate(its):
    x = X0 + i * (iw + 0.12)
    n = oval(s, x + iw / 2 - 0.28, 2.19, 0.56, fill=RAISIN if i != 2 else ORANGE, line=None, name='It dot')
    nt = tb(s, x + iw / 2 - 0.28, 2.19, 0.56, 0.56, [P(str(i + 1), size=17, color=ORANGE if i != 2 else RAISIN, family=HEAD, bold=True, align='center')], name='It n', anchor='middle', inset=0, check=False)
    tt = tb(s, x, 2.9, iw, 0.62, [P(t, size=13.5, color=RAISIN, family=HEAD, bold=True, align='center', spacing=0.98)], name='It title')
    dt = tb(s, x, 3.52, iw, 1.0, [P(d, size=11.5, color=MUTE, align='center', spacing=1.0)], name='It text')
    g = s.shapes.add_group_shape([n, nt, tt, dt])
    g.name = spec('Iteration', fx='rise', t='after', dur='0.3')
cal = [('Risk-score calibration', '7 researcher-labelled URLs (google.com … paypa1-secure-login.tk); the +0.5 offset removed and thresholds adjusted. A development check, not held-out evidence.'),
       ('DGA heuristic calibration', '30 legitimate and generated-looking domains; empirical threshold 0.45 on entropy and character patterns.'),
       ('LLM fallback verification', 'Gemini exhaustion → Mistral fallback → rule-based response, each exercised in the prototype.')]
cw3 = (CW - 0.5) / 3
for i, (t, d) in enumerate(cal):
    card(s, X0 + i * (cw3 + 0.25), 4.7, cw3, 2.12, t, d, accent=SAGE if i == 1 else ORANGE, label=None, title_size=16, body_size=13.5)
notes(s, "Development was iterative: seven deployable iterations, each checked with representative URLs. Iteration three "
         "found the +0.5 baseline offset behind the 'medium risk for everything' defect. Calibration used seven labelled URLs "
         "for the risk score and thirty domains for the DGA threshold of 0.45; the explanation fallback was exercised from "
         "Gemini through Mistral to rules. These are development checks, separate from the evaluation set.")

# ======================================================================================
# 12 METHODS 5/6: LEARNING & TRAINING PHASES
# ======================================================================================
s = content_slide(6, 12, 'Methods and materials used', 'Learning techniques and the five training phases', part='5 OF 6', orb_at=(10.8, -1.4, 3.4),
                  source='Thesis Appendix C.3–C.4; §2.3.3')
kinds = [('SUPERVISED', 'Three gradient-boosted classifiers', 'Gradient-boosted trees (scikit-learn) for phishing, malware-serving URLs and web-attack payloads (SQLi/XSS).', ORANGE),
         ('UNSUPERVISED', 'Anomaly detection', 'IsolationForest fitted to benign URL features (200 trees, contamination 0.02). Anomaly ≠ proof of harm.', SAGE),
         ('PRETRAINED INFERENCE', 'BERT and Qwen', 'External BERT URL classifier and Qwen3.5-2B GGUF explanations through llama.cpp — used, not fine-tuned.', ORANGE),
         ('RULES & RETRIEVAL', 'Heuristics and memory', 'Entropy DGA rules, regex IOC extraction, memory as retrieval context. No online weight updates.', SAGE)]
kw = (CW - 0.6) / 4
for i, (lab, t, d, c) in enumerate(kinds):
    card(s, X0 + i * (kw + 0.2), 2.0, kw, 2.6, t, d, accent=c, label=lab, title_size=15.5, body_size=12.5)
phases = [('1', 'Collect & clean', 'public corpora, normalise, de-duplicate, popularity reference'), ('2', 'Features & split', 'shared url_features.py; domain-grouped: 20% test, 10% thresholds'),
          ('3', 'Fit', '≤300 iterations, learning rate 0.1, 31 leaves, seed 42'), ('4', 'Thresholds & evaluate', 'decision point at a 2% false-positive target; held-out check'),
          ('5', 'Publish accepted', 'only accepted models, with metadata, loaded for inference')]
pw = (CW - 4 * 0.14) / 5
for i, (n_, t, d) in enumerate(phases):
    x = X0 + i * (pw + 0.14)
    b = box(s, x, 4.78, pw, 2.04, fill=RAISIN if i in (3,) else CARD, line=None if i == 3 else RULE, name='Phase bg', radius=0.08)
    nt = tb(s, x + 0.16, 4.84, 0.8, 0.55, [P(n_, size=24, color=ORANGE, family=HEAD, bold=True)], name='Phase n', check=False)
    tt = tb(s, x + 0.16, 5.32, pw - 0.3, 0.55, [P(t, size=13.5, color=IVORY if i == 3 else RAISIN, family=HEAD, bold=True, spacing=0.95)], name='Phase title')
    dt = tb(s, x + 0.16, 5.86, pw - 0.3, 0.94, [P(d, size=11.5, color='CFC6B8' if i == 3 else MUTE, spacing=1.0)], name='Phase text')
    g = s.shapes.add_group_shape([b, nt, tt, dt])
    g.name = spec('Phase', fx='fly', dir='left', t='after', dur='0.3')
notes(s, "Four kinds of learning are kept apart: supervised gradient-boosted classifiers, an unsupervised IsolationForest on "
         "benign URLs, pretrained BERT and Qwen used only for inference, and rules with memory retrieval. Training follows five "
         "phases, with domain-grouped splits so the same domain never sits in both training and test, and thresholds chosen "
         "for a 2% false-positive target.")

# ======================================================================================
# 13 METHODS 6/6: EVALUATION
# ======================================================================================
s = content_slide(6, 13, 'Methods and materials used', 'Evaluation design: 300 URLs and four criteria', part='6 OF 6', orb_at=(10.3, 4.8, 3.6),
                  source='Thesis §3.9 Evaluation Methodology; §4.3')
tb(s, X0, 2.05, 3.0, 1.2, [P('300', size=80, color=ORANGE, family=HEAD, bold=True)], name=spec('Big 300', fx='fadedzoom', t='after', dur='0.6'), check=False)
tb(s, X0, 3.3, 3.3, 0.7, [P('URLs in the evaluation set', size=17, color=RAISIN, family=HEAD, bold=True)], name=spec('Big 300 label', fx='fade', by='word', t='after', dur='0.4'))
bars = [('Benign websites', 150, SAGE), ('Phishing websites', 100, ORANGE), ('Malware / DGA domains', 50, DEEP)]
by_ = 4.05
for t, n_, c in bars:
    tb(s, X0, by_, 2.6, 0.35, [P(t, size=13.5, color=BODYC)], name=spec('Bar label', fx='fade', t='after', dur='0.2'), check=False)
    box(s, X0, by_ + 0.38, 4.6 * n_ / 150, 0.32, fill=c, line=None, name=spec('Bar', fx='wipe', dir='left', t='with', dur='0.7'), radius=0.3)
    tb(s, X0 + 4.6 * n_ / 150 + 0.1, by_ + 0.33, 0.8, 0.4, [P(str(n_), size=15, color=RAISIN, family=HEAD, bold=True)], name=spec('Bar value', fx='fade', t='after', dur='0.2'), check=False)
    by_ += 0.78
tb(s, X0, 6.5, 5.2, 0.35, [P('Positive class = the 150 harmful URLs', size=12.5, color=MUTE, family=MONO)], name=spec('Positive class', fx='fade', t='after', dur='0.3'), check=False)
crit = [('Functional correctness', 'Every agent returns its documented response shape; the Reporter matches the expected verdicts on the calibration set.'),
        ('False-positive rate', 'Common benign sites (google.com, github.com, wikipedia.org, bbc.co.uk …) judged clean or low risk in 100% of cases.'),
        ('True-positive coverage', 'Curated phishing URLs (PhishTank and constructed) judged suspicious or malicious in at least 80% of cases.'),
        ('End-to-end latency', 'Mean over 100 consecutive requests: at most 10 s from a cold start and 4 s when warm.')]
for i, (t, d) in enumerate(crit):
    card(s, 6.75, 2.0 + i * 1.22, CW - 5.2, 1.13, t, d, accent=ORANGE if i % 2 == 0 else SAGE, label=None, title_size=15, body_size=12)
notes(s, "The evaluation set has 300 URLs: 150 benign, 100 phishing and 50 malware or DGA domains, with the harmful URLs as the "
         "positive class. Four criteria were set before testing: functional correctness, false positives on common benign "
         "sites, coverage of curated phishing, and latency of at most ten seconds cold and four seconds warm.")

# ======================================================================================
# 14 RESULTS 1/4: DETECTION
# ======================================================================================
s = content_slide(7, 14, 'Results', 'Detection performance on the 300-URL evaluation', part='1 OF 4', orb_at=(10.8, -1.5, 3.3),
                  source='Thesis Tables 4.3 and 4.4 (historical prototype results)')
mets = [('94.7%', 'Accuracy', '284 of 300 correct', ORANGE), ('97.9%', 'Precision', 'alerts that were right', SAGE), ('91.3%', 'Recall', 'harmful sites caught', ORANGE),
        ('98.0%', 'Specificity', 'safe sites left alone', SAGE), ('94.5%', 'F1 score', 'precision–recall balance', ORANGE), ('2.0%', 'FP rate', '3 of 150 benign flagged', DEEP)]
mw = (CW - 5 * 0.16) / 6
for i, (v, k, d, c) in enumerate(mets):
    x = X0 + i * (mw + 0.16)
    b = box(s, x, 2.05, mw, 1.65, fill=RAISIN if i in (0, 5) else CARD, line=None if i in (0, 5) else RULE, name='Metric bg', radius=0.08)
    vt = tb(s, x + 0.1, 2.12, mw - 0.2, 0.72, [P(v, size=30, color=ORANGE if i in (0, 5) else c if c != ORANGE else DEEP, family=HEAD, bold=True, align='center')], name='Metric value', check=False)
    kt = tb(s, x + 0.1, 2.86, mw - 0.2, 0.36, [P(k, size=14, color=IVORY if i in (0, 5) else RAISIN, family=HEAD, bold=True, align='center')], name='Metric key', check=False)
    dt = tb(s, x + 0.1, 3.2, mw - 0.2, 0.4, [P(d, size=11, color='CFC6B8' if i in (0, 5) else MUTE, align='center')], name='Metric text', check=False)
    g = s.shapes.add_group_shape([b, vt, kt, dt])
    g.name = spec('Metric', fx='fadedzoom', t='after', dur='0.35', pulse='1' if i == 0 else '0')
# confusion matrix
tb(s, X0, 4.0, 5.3, 0.35, [P('CONFUSION MATRIX', size=11, color=DEEP, family=MONO, bold=True)], name=spec('CM label', fx='fade', t='after', dur='0.3'), check=False)
cells = [('137', 'True positives', RAISIN, ORANGE), ('13', 'False negatives', CARD, DEEP), ('3', 'False positives', CARD, DEEP), ('147', 'True negatives', RAISIN, SAGE)]
for i, (v, k, f_, c) in enumerate(cells):
    x = X0 + 1.1 + (i % 2) * 2.15
    yy = 4.45 + (i // 2) * 1.2
    b = box(s, x, yy, 2.05, 1.1, fill=f_, line=None if f_ == RAISIN else RULE, name='CM bg', radius=0.08)
    vt = tb(s, x, yy + 0.06, 2.05, 0.6, [P(v, size=28, color=c, family=HEAD, bold=True, align='center')], name='CM value', check=False)
    kt = tb(s, x, yy + 0.66, 2.05, 0.36, [P(k, size=12, color=IVORY if f_ == RAISIN else MUTE, align='center')], name='CM key', check=False)
    g = s.shapes.add_group_shape([b, vt, kt])
    g.name = spec('CM cell', fx='zoom', t='after', dur='0.25')
tb(s, X0, 4.62, 1.05, 0.8, [P('Actual harmful', size=11, color=MUTE, align='right')], name=spec('CM axis', fx='fade', t='with', dur='0.3'), check=False)
tb(s, X0, 5.82, 1.05, 0.8, [P('Actual benign', size=11, color=MUTE, align='right')], name=spec('CM axis', fx='fade', t='with', dur='0.3'), check=False)
cats = [('Safe (benign) websites', 147, 150, '98.0%', SAGE), ('Phishing websites', 92, 100, '92.0%', ORANGE), ('Malware and DGA domains', 45, 50, '90.0%', DEEP)]
tb(s, 7.25, 4.0, 5.3, 0.35, [P('DETECTION BY CATEGORY', size=11, color=DEEP, family=MONO, bold=True)], name=spec('Cat label', fx='fade', t='after', dur='0.3'), check=False)
cy_ = 4.45
for t, ok, n_, pct, c in cats:
    tb(s, 7.25, cy_, 3.6, 0.35, [P('', runs=[(t, {'color': RAISIN, 'bold': True}), (f'   {ok} / {n_}', {'color': MUTE})], size=14)], name=spec('Cat name', fx='fade', t='after', dur='0.2'), check=False)
    box(s, 7.25, cy_ + 0.42, 4.5, 0.3, fill='E4DACB', line=None, name=spec('Cat track', fx='fade', t='with', dur='0.2'), radius=0.4)
    box(s, 7.25, cy_ + 0.42, 4.5 * ok / n_, 0.3, fill=c, line=None, name=spec('Cat bar', fx='wipe', dir='left', t='after', dur='0.7'), radius=0.4)
    tb(s, 11.85, cy_ + 0.3, 0.9, 0.5, [P(pct, size=16, color=RAISIN, family=HEAD, bold=True)], name=spec('Cat pct', fx='fade', t='with', d='0.4', dur='0.3'), check=False)
    cy_ += 0.82
notes(s, "On the 300-URL set the prototype classified 284 correctly: 94.7% accuracy, 97.9% precision, 91.3% recall, 98% "
         "specificity and F1 94.5%. Only three of 150 benign sites were flagged, a 2% false-positive rate. Benign detection was "
         "98%, phishing 92% and malware/DGA 90%. These are the historical prototype results; they were not re-run on the "
         "revised implementation.")

# ======================================================================================
# 15 RESULTS 2/4: SPEED
# ======================================================================================
s = content_slide(7, 15, 'Results', 'Processing speed: where the 4.05 seconds go', part='2 OF 4', orb_at=(10.3, 4.8, 3.6),
                  source='Thesis Tables 4.1 and 4.2 (historical prototype results)')
stg = [('Stage 1 · URL and context', 850, 21, SAGE), ('Stage 2 · Content analysis', 1200, 30, ORANGE), ('Stage 3 · Threat intelligence', 600, 15, SAGE), ('Reporter · report generation', 1400, 34, DEEP)]
sy = 2.15
for t, ms, pc, c in stg:
    tb(s, X0, sy, 3.3, 0.4, [P(t, size=15, color=RAISIN, family=HEAD, bold=True)], name=spec('Speed label', fx='fade', t='after', dur='0.2'), check=False)
    box(s, X0 + 3.35, sy + 0.04, 3.3, 0.36, fill='E4DACB', line=None, name=spec('Speed track', fx='fade', t='with', dur='0.2'), radius=0.4)
    box(s, X0 + 3.35, sy + 0.04, 3.3 * ms / 1400, 0.36, fill=c, line=None, name=spec('Speed bar', fx='wipe', dir='left', t='after', dur='0.7'), radius=0.4)
    tb(s, X0 + 6.75, sy - 0.02, 1.7, 0.45, [P('', runs=[(f'{ms:,} ms', {'bold': True, 'color': RAISIN, 'family': HEAD}), (f'  {pc}%', {'color': MUTE})], size=15)], name=spec('Speed value', fx='fade', t='with', d='0.4', dur='0.3'), check=False)
    sy += 0.78
pnl = box(s, X0 + 8.6, 2.05, CW - 8.6, 3.1, fill=RAISIN, line=None, name='Total bg', radius=0.06)
t1 = tb(s, X0 + 8.85, 2.22, CW - 9.1, 0.3, [P('MEAN END TO END', size=10.5, color=ORANGE, family=MONO, bold=True)], name='Total label', check=False)
t2 = tb(s, X0 + 8.85, 2.52, CW - 9.1, 0.95, [P('4.05 s', size=44, color=IVORY, family=HEAD, bold=True)], name='Total value', check=False)
t3 = tb(s, X0 + 8.85, 3.5, CW - 9.1, 1.6, [P('Warm target 4.00 s: missed by 0.05 s', size=13, color=ORANGE, after=4), P('Cached repeat visits: under 100 ms (about 15% of queries)', size=12, color='CFC6B8')], name='Total text')
g = s.shapes.add_group_shape([pnl, t1, t2, t3]); g.name = spec('Total', fx='fly', dir='right', t='after', dur='0.5', pulse='1')
tb(s, X0, 5.3, 4, 0.35, [P('SLOWEST AGENTS IN EACH STAGE', size=11, color=DEEP, family=MONO, bold=True)], name=spec('Agents label', fx='fade', t='after', dur='0.3'), check=False)
ag = [('URL Classifier', '720 ms', 'BERT, Stage 1'), ('Web Scraper', '900 ms', 'page acquisition'), ('Threat Intelligence', '600 ms', 'OTX lookups'), ('Reporter', '1,400 ms', 'scoring and explanation')]
aw = (CW - 0.6) / 4
for i, (a, v, d) in enumerate(ag):
    card(s, X0 + i * (aw + 0.2), 5.68, aw, 1.14, a, f'{v}  ·  {d}', accent=ORANGE if i % 2 == 0 else SAGE, title_size=15, body_size=13, fx='rise')
notes(s, "The mean end-to-end analysis took 4.05 seconds, 50 milliseconds over the strict four-second warm target, so I report "
         "that objective as not met. The Reporter, with the language-model explanation, is the largest share at 34%. Cached "
         "repeat visits returned in under 100 milliseconds.")

# ======================================================================================
# 16 RESULTS 3/4: RELIABILITY
# ======================================================================================
s = content_slide(7, 16, 'Results', 'How dependably each agent and service answered', part='3 OF 4', orb_at=(10.8, -1.5, 3.3),
                  source='Thesis Tables 4.5 and 4.7 (historical test period; return-success and uptime, not accuracy)')
rel = [('URL Classifier', 99.5), ('DGA Detector', 100), ('Web Scraper', 96.0), ('Memory Reader', 100), ('IOC Extractor', 99.0), ('Behavioural Analyser', 98.5),
       ('MITRE Mapper', 99.0), ('Threat-Intel Enricher', 95.0), ('Reporter', 99.8)]
tb(s, X0, 2.0, 6, 0.35, [P('AGENT RELIABILITY  ·  usable result instead of timeout or error', size=11, color=DEEP, family=MONO, bold=True)], name=spec('Rel label', fx='fade', t='after', dur='0.3'), check=False)
ry = 2.45
for a, v in rel:
    tb(s, X0, ry, 2.35, 0.4, [P(a, size=13.5, color=RAISIN, bold=True)], name=spec('Rel name', fx='fade', t='after', dur='0.12'), check=False)
    box(s, X0 + 2.4, ry + 0.08, 3.6, 0.26, fill='E4DACB', line=None, name=spec('Rel track', fx='fade', t='with', dur='0.12'), radius=0.4)
    box(s, X0 + 2.4, ry + 0.08, 3.6 * (v - 90) / 10, 0.26, fill=ORANGE if v >= 99 else SAGE, line=None, name=spec('Rel bar', fx='wipe', dir='left', t='with', dur='0.5'), radius=0.4)
    tb(s, X0 + 6.1, ry, 0.9, 0.4, [P(f'{v:g}%', size=13.5, color=RAISIN, family=HEAD, bold=True)], name=spec('Rel value', fx='fade', t='with', dur='0.2'), check=False)
    ry += 0.48
tb(s, X0 + 2.4, ry - 0.02, 3.6, 0.3, [P('scale 90% → 100%', size=10, color=MUTE, family=MONO, align='right')], name=spec('Rel scale', fx='fade', t='after', dur='0.2'), check=False)
svc = [('Heroku backend', '99.9%', 'desktop retries'), ('Hugging Face Space', '99.2%', 'cached or heuristic result'), ('AlienVault OTX', '97.5%', 'scan continues unenriched'),
       ('Google Gemini', '98.0%', 'Mistral, then rules'), ('Appwrite Cloud', '99.7%', 'kept locally, synced later'), ('Redis cache', '99.9%', 'full pipeline instead')]
tb(s, 8.75, 2.0, 4, 0.35, [P('EXTERNAL SERVICES  ·  uptime  ·  fallback', size=11, color=DEEP, family=MONO, bold=True)], name=spec('Svc label', fx='fade', t='after', dur='0.3'), check=False)
sy = 2.45
for n_, up, fb_ in svc:
    b = box(s, 8.75, sy, CW - 7.2, 0.62, name='Svc bg', radius=0.12)
    nt = tb(s, 8.95, sy, 2.2, 0.62, [P(n_, size=13.5, color=RAISIN, family=HEAD, bold=True)], name='Svc name', anchor='middle', check=False)
    ut = tb(s, 10.95, sy, 0.8, 0.62, [P(up, size=14, color=DEEP, family=HEAD, bold=True)], name='Svc up', anchor='middle', check=False)
    ft = tb(s, 11.7, sy, CW - 10.2, 0.62, [P(fb_, size=11, color=MUTE, spacing=0.95)], name='Svc fallback', anchor='middle', check=False)
    g = s.shapes.add_group_shape([b, nt, ut, ft]); g.name = spec('Service', fx='fly', dir='right', t='after', dur='0.3')
    sy += 0.72
notes(s, "Reliability is how often each agent returned a usable result, not its accuracy. All agents were above 95%; the web "
         "scraper and the OTX enricher depend on outside services and were lowest. Every external service had a fallback, "
         "so a scan degrades instead of failing; these uptime figures are from the original test period.")

# ======================================================================================
# 17 RESULTS 4/4: EXPLANATIONS & OBJECTIVES
# ======================================================================================
s = content_slide(7, 17, 'Results', 'Explanation quality and the objectives against their targets', part='4 OF 4', orb_at=(10.3, 4.8, 3.6),
                  source='Thesis Tables 4.6 and 4.8; Figure 4.3 (historical interface)')
tb(s, X0, 2.0, 4.5, 0.35, [P('AI-WRITTEN EXPLANATIONS  ·  manual 1–10 ratings', size=11, color=DEEP, family=MONO, bold=True)], name=spec('Exp label', fx='fade', t='after', dur='0.3'), check=False)
exq = [('Factual accuracy', 9.5, 'correct MITRE techniques and IOCs'), ('Readability', 9.0, 'a non-expert could follow it'), ('Usefulness of advice', 8.8, 'clear next steps'), ('Speed', 8.5, 'Gemini ≈1.2 s, Mistral ≈2.0 s')]
ey = 2.45
for t, v, d in exq:
    tb(s, X0, ey, 2.6, 0.62, [P(t, size=14.5, color=RAISIN, family=HEAD, bold=True, after=0), P(d, size=11, color=MUTE)], name=spec('Exp name', fx='fade', t='after', dur='0.15'), check=False)
    box(s, X0 + 2.7, ey + 0.14, 2.2, 0.28, fill='E4DACB', line=None, name=spec('Exp track', fx='fade', t='with', dur='0.15'), radius=0.4)
    box(s, X0 + 2.7, ey + 0.14, 2.2 * v / 10, 0.28, fill=ORANGE, line=None, name=spec('Exp bar', fx='wipe', dir='left', t='with', dur='0.5'), radius=0.4)
    tb(s, X0 + 5.0, ey + 0.02, 0.9, 0.5, [P(f'{v}', size=18, color=RAISIN, family=HEAD, bold=True)], name=spec('Exp value', fx='fade', t='with', d='0.3', dur='0.2'), check=False)
    ey += 0.8
pic = s.shapes.add_picture(str(ASSETS / 'image11.png'), Inches(X0), Inches(5.7), height=Inches(1.22))
pic.name = spec('Alert screenshot', fx='fadedzoom', t='after', dur='0.4')
tb(s, X0 + 1.5, 5.82, 4.4, 1.0, [P('The prototype\'s real-time alert, with Block, Protect and Allow. A historical interface illustration.', size=11.5, color=MUTE, spacing=1.0)],
   name=spec('Alert caption', fx='fade', t='with', dur='0.3'))
tb(s, 7.7, 2.0, 5, 0.35, [P('OBJECTIVES MET  ·  Table 4.8', size=11, color=DEEP, family=MONO, bold=True)], name=spec('Obj label', fx='fade', t='after', dur='0.3'), check=False)
om = [('Real-time analysis', 'warm mean ≤ 4.00 s', '4.05 s', False), ('Accurate detection', 'above 90% accuracy', '94.7%', True), ('Few false alarms', 'keep false alarms low', '2.0%', True),
      ('Clear explanations', 'readable by non-experts', '9.0 / 10', True), ('Reliable integrations', 'stable cloud services', '97.5%+', True)]
oy = 2.45
for t, tgt, res, ok in om:
    b = box(s, 7.7, oy, CW - 6.15, 0.8, fill=CARD, line=RULE, name='Obj bg', radius=0.1)
    tt = tb(s, 7.88, oy + 0.04, 2.6, 0.74, [P(t, size=14.5, color=RAISIN, family=HEAD, bold=True, after=0), P(tgt, size=11, color=MUTE)], name='Obj text', anchor='middle', check=False)
    rt = tb(s, 10.45, oy, 1.15, 0.8, [P(res, size=16, color=RAISIN, family=HEAD, bold=True, align='right')], name='Obj result', anchor='middle', check=False)
    badge = box(s, 11.75, oy + 0.2, 0.9, 0.4, fill=SAGE if ok else RED, line=None, name='Obj badge', radius=0.5)
    bt = tb(s, 11.75, oy + 0.2, 0.9, 0.4, [P('MET' if ok else 'NOT MET', size=10 if ok else 8.5, color=IVORY, family=MONO, bold=True, align='center')], name='Obj badge text', anchor='middle', inset=0, check=False)
    g = s.shapes.add_group_shape([b, tt, rt, badge, bt]); g.name = spec('Objective', fx='fly', dir='right', t='after', dur='0.3')
    oy += 0.88
notes(s, "Explanations were rated 9.5 for factual accuracy and 9.0 for readability by non-experts; these are descriptive manual "
         "ratings, not a blinded user study. Against the targets, four of five objectives were met. Real-time analysis was "
         "not: 4.05 seconds against a strict 4.00-second target.")

# ======================================================================================
# 18 CONCLUSION
# ======================================================================================
s = content_slide(8, 18, 'Conclusion', 'What the study shows', orb_at=(10.8, -1.5, 3.3), source='Thesis §5.1 Conclusion; §4.9')
big = [('284 / 300', 'URLs classified correctly'), ('137', 'harmful URLs detected'), ('3', 'benign URLs falsely flagged'), ('4.05 s', 'mean end-to-end analysis')]
bw = (CW - 0.6) / 4
for i, (v, k) in enumerate(big):
    x = X0 + i * (bw + 0.2)
    b = box(s, x, 2.05, bw, 1.45, fill=RAISIN if i == 0 else CARD, line=None if i == 0 else RULE, name='Big bg', radius=0.08)
    vt = tb(s, x + 0.15, 2.12, bw - 0.3, 0.8, [P(v, size=34, color=ORANGE if i == 0 else DEEP, family=HEAD, bold=True)], name='Big value', check=False)
    kt = tb(s, x + 0.15, 2.9, bw - 0.3, 0.5, [P(k, size=13.5, color=IVORY if i == 0 else BODYC)], name='Big key', check=False)
    g = s.shapes.add_group_shape([b, vt, kt]); g.name = spec('Big', fx='fadedzoom', t='after', dur='0.35')
concl = [('Contribution', 'Eight specialist analyses and a Reporter combine complementary evidence into one inspectable, explained verdict, with few false alarms.'),
         ('What it does not prove', 'No controlled single-model ablation: the results do not prove superiority to a single model, universal protection or current production performance.'),
         ('Where the system is now', 'Verified identity and workspace checks, five independent privacy choices, service authentication, device signing and explicit action states are in the source.')]
for i, (t, d) in enumerate(concl):
    card(s, X0 + i * ((CW - 0.5) / 3 + 0.25), 3.8, (CW - 0.5) / 3, 3.0, t, d, accent=[ORANGE, DEEP, SAGE][i], label=f'0{i + 1}', title_size=18, body_size=14.5)
notes(s, "To conclude: the integrated, explainable workflow classified 284 of 300 URLs correctly with only three false alarms, "
         "in a little over four seconds. The contribution is the integration of complementary evidence into one explained "
         "verdict. The limits are clear: there is no single-model ablation, and the historical results are not a "
         "measurement of the revised system. The current source adds the access, privacy and signing controls recommended "
         "after the prototype.")

# ======================================================================================
# 19 CONCLUSION: RECOMMENDATIONS & PERSPECTIVES
# ======================================================================================
s = content_slide(8, 19, 'Conclusion', 'Recommendations and perspectives', orb_at=(10.3, 4.8, 3.6), source='Thesis §5.2 Recommendations; §5.3 Perspectives')
recs = [('Security assurance', 'Exercise account switching, grant revocation, hostile input, replay, expiry and elevation prompts in the packaged product.'),
        ('Privacy and retention', 'Validate the five consent categories, URL redaction, deletion and sync withdrawal across all clients and recipients.'),
        ('Model quality and training', 'Temporal and domain-held-out evaluation; isolated training jobs; reviewed feedback, never unchecked online retraining.'),
        ('Action and integration scope', 'Verified rollback before broader automatic response; extend CLI and MCP only with permission and recovery contracts.')]
rw = (CW - 0.3) / 2
for i, (t, d) in enumerate(recs):
    card(s, X0 + (i % 2) * (rw + 0.3), 1.98 + (i // 2) * 1.68, rw, 1.56, t, d, accent=ORANGE if i % 3 == 0 else SAGE, label=f'RECOMMENDATION {i + 1}', title_size=16, body_size=13)
pb = box(s, X0, 5.42, CW, 1.4, fill=RAISIN, line=None, name='Persp bg', radius=0.06)
pl = tb(s, X0 + 0.3, 5.5, 3, 0.3, [P('PERSPECTIVES', size=11, color=ORANGE, family=MONO, bold=True)], name='Persp label', check=False)
pt = tb(s, X0 + 0.3, 5.8, CW - 0.6, 1.0, [P('Longer deployments with raw logs · agent ablations · independent regional and hosted-phishing corpora · a blinded explanation study · isolated training · richer grounded CLI and MCP tools · packaged mobile capture · a genuine dynamic-execution sandbox', size=14.5, color=IVORY, spacing=1.05)], name='Persp text')
g = s.shapes.add_group_shape([pb, pl, pt]); g.name = spec('Perspectives', fx='wipe', dir='left', t='after', dur='0.6')
notes(s, "Four recommendations follow: test the security controls in the packaged product, validate the privacy and retention "
         "controls across all clients, strengthen model evaluation and isolate training, and widen automatic actions only "
         "after verified rollback. Future research should include ablations, independent corpora and a blinded study of the "
         "explanations.")

# ======================================================================================
# 20 THANK YOU + REFERENCES (credits roll)
# ======================================================================================
s = prs.slides.add_slide(BLANK)
background(s, RAISIN)
oval(s, 8.4, 0.9, 5.6, fill=None, line='3A3233', name='!!orb', lw=1.25)
oval(s, 9.41, 1.91, 3.58, fill=None, line='3A3233', name='!!orb2', lw=0.75)
tb(s, 0.8, 1.7, 7.0, 1.3, [P('Thank you', size=66, color=IVORY, family=HEAD, bold=True)], name=spec('Thanks', fx='rise', by='char', t='after', dur='0.6'))
tb(s, 0.8, 3.0, 7.0, 0.8, [P('Questions and discussion', size=26, color=ORANGE, family=HEAD)], name=spec('Questions', fx='fade', by='word', t='after', dur='0.5'))
box(s, 0.8, 4.0, 0.9, 0.05, fill=SAGE, line=None, name=spec('Divider', fx='wipe', dir='left', t='after', dur='0.4'), shape=MSO_SHAPE.RECTANGLE)
tb(s, 0.8, 4.25, 7.0, 1.6, [P('Che Haggai Ngha Kang  ·  UBA24PP134', size=16, color=IVORY, family=HEAD, bold=True, after=4),
                            P('Supervisor: Prof. Onabid Mathias Akong', size=14, color='B9AFA2', after=2),
                            P('The University of Bamenda  ·  College of Technology', size=14, color='B9AFA2')],
   name=spec('Credits', fx='rise', by='para', t='after', dur='0.4'))
refs = ['REFERENCES', '', 'Anderson & Roth (2018) — EMBER', 'Antonakakis et al. (2012) — DGA-based malware', 'Barnum (2012) — STIX', 'Brown et al. (2020) — few-shot language models',
        'Buczak & Guven (2016) — ML for intrusion detection', 'Cockburn (2001) — Writing effective use cases', 'Devlin et al. (2019) — BERT', 'Egele et al. (2012) — dynamic malware analysis',
        'Khonji et al. (2013) — phishing detection survey', 'Le et al. (2018) — URLNet', 'Liao et al. (2016) — IOC discovery', 'Mohammad et al. (2014) — phishing websites',
        'Park et al. (2023) — Generative Agents', 'Provos et al. (2007) — The ghost in the browser', 'Russell & Norvig (2020) — AI: A Modern Approach', 'Sahingoz et al. (2019) — ML phishing detection',
        'Sommer & Paxson (2010) — Outside the closed world', 'Strom et al. (2018) — MITRE ATT&CK', 'Tounsi & Rais (2018) — threat intelligence survey', 'Vaswani et al. (2017) — Attention is all you need',
        'Wei et al. (2022) — chain-of-thought prompting', 'Willems et al. (2007) — CWSandbox', 'Wooldridge (2009) — multiagent systems', 'Yao et al. (2023) — ReAct']
tb(s, 8.75, 1.0, 4.4, 5.6, [P(r, size=13 if i else 13, color=ORANGE if i == 0 else 'CFC6B8', family=MONO if i == 0 else BODY, bold=i == 0, align='center', spacing=1.15) for i, r in enumerate(refs)],
   name=spec('References roll', fx='credits', t='after', d='0.5', dur='22'), check=False)
notes(s, "Thank you. I welcome your questions. The references scroll on the right; the full list is in the dissertation.")

prs.save(OUT)
print(f'built {len(prs.slides)} slides -> {OUT.name}')
if overflow:
    print('TEXT THAT MAY NOT FIT:')
    for o in overflow:
        print('  ' + o)
