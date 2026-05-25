"""
svgkit — a tiny, dependency-free SVG builder for the CyberForge thesis diagrams.

It exposes a `Canvas` that accumulates SVG primitives (rounded panels, node
boxes, header tabs, arrows, lock/cylinder/actor glyphs, UML class tables, use
case ovals) and serialises them to a standalone .svg string.

The palette and primitives are shared by all three diagrams so the
architecture, use-case, and class diagrams look like one coherent set.
"""
from __future__ import annotations
from html import escape
from typing import List, Optional, Tuple

# ── Palette ──────────────────────────────────────────────────────────────────
INK        = "#16233D"   # primary dark navy text
INK_SOFT   = "#46556F"   # secondary text
WHITE      = "#FFFFFF"
TEAL       = "#0E8FA3"    # accent — header tabs / secure infra bars
TEAL_DK    = "#0A6B7B"
TEAL_LT    = "#E3F4F6"
YELLOW     = "#F4C20D"    # the agentic "core" highlight
YELLOW_LT  = "#FEF6D8"
PANEL_BG   = "#F2F5F9"    # layer panel background
PANEL_BD   = "#C7D2E0"    # layer panel border
CARD_BG    = "#FFFFFF"
CARD_BD    = "#9FB1C7"
ORANGE     = "#E8743B"    # numbered pipeline path
GREEN      = "#1Fa463"    # persistence / aggregation edges
GREY       = "#7A8Aa0"    # secondary calls
PURPLE     = "#7C5CD6"

# stage tints (fill, border, accent)
STAGE1 = ("#FCE6E2", "#E1897D", "#C0392B")
STAGE2 = ("#DEF3E6", "#5FB489", "#1E8449")
STAGE3 = ("#EBE2F7", "#A98FD8", "#6C3FBF")
INFER  = ("#DCEEF4", "#74B4C9", "#0A6B7B")
EXT    = ("#EAEEF3", "#9FB1C7", "#46556F")

FONT = "Helvetica, Arial, sans-serif"


class Canvas:
    def __init__(self, w: int, h: int, bg: str = WHITE):
        self.w, self.h, self.bg = w, h, bg
        self.body: List[str] = []

    # ── low level ────────────────────────────────────────────────────────────
    def raw(self, s: str):
        self.body.append(s)

    def rect(self, x, y, w, h, fill=WHITE, stroke="none", rx=10, sw=1.5,
             dash: Optional[str] = None, opacity=1.0):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.body.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
            f'rx="{rx}" ry="{rx}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="{sw}"{d} opacity="{opacity}"/>')

    def text(self, x, y, s, size=14, color=INK, weight="normal",
             anchor="start", family=FONT, spacing=None, italic=False):
        ls = f' letter-spacing="{spacing}"' if spacing else ""
        it = ' font-style="italic"' if italic else ""
        self.body.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" '
            f'font-size="{size}" font-weight="{weight}" fill="{color}" '
            f'text-anchor="{anchor}"{ls}{it}>{escape(s)}</text>')

    def multiline(self, x, y, lines, size=13, color=INK, weight="normal",
                  anchor="middle", lh=None):
        lh = lh or size + 3
        for i, ln in enumerate(lines):
            self.text(x, y + i * lh, ln, size=size, color=color,
                      weight=weight, anchor=anchor)

    def line(self, x1, y1, x2, y2, color=GREY, sw=1.6, dash=None, marker=True,
             opacity=1.0):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        m = ' marker-end="url(#arrow)"' if marker else ""
        self.body.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{color}" stroke-width="{sw}"{d}{m} opacity="{opacity}"/>')

    def path(self, d, color=GREY, sw=1.6, dash=None, marker=True, fill="none"):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        m = ' marker-end="url(#arrow)"' if marker else ""
        self.body.append(
            f'<path d="{d}" fill="{fill}" stroke="{color}" stroke-width="{sw}"'
            f'{da}{m}/>')

    # ── composite glyphs ───────────────────────────────────────────────────
    def lock(self, cx, cy, s=11, color=TEAL_DK):
        """A small padlock centred at (cx,cy), body width ~s."""
        bw, bh = s, s * 0.78
        bx, by = cx - bw / 2, cy - bh / 2 + s * 0.18
        self.rect(bx, by, bw, bh, fill=color, stroke="none", rx=2, sw=0)
        r = s * 0.30
        self.body.append(
            f'<path d="M {cx-r:.1f} {by:.1f} v {-r:.1f} a {r:.1f} {r:.1f} 0 0 1 '
            f'{2*r:.1f} 0 v {r:.1f}" fill="none" stroke="{color}" '
            f'stroke-width="{max(1.4,s*0.16):.1f}"/>')
        self.body.append(
            f'<circle cx="{cx:.1f}" cy="{by+bh*0.5:.1f}" r="{s*0.09:.1f}" '
            f'fill="{WHITE}"/>')

    def secure_label(self, cx, cy, label, color=TEAL_DK):
        """A lock + small caps label, used on TLS/HTTPS channels."""
        self.lock(cx, cy - 7, s=12, color=color)
        self.text(cx, cy + 14, label, size=11, color=color, weight="bold",
                  anchor="middle", spacing="0.5")

    def cylinder(self, cx, cy, w, h, fill, stroke, label_lines, lsize=11.5):
        """A database cylinder with centred multiline label below the lip."""
        ry = h * 0.13
        top, bot = cy - h / 2, cy + h / 2
        self.body.append(
            f'<path d="M {cx-w/2:.1f} {top+ry:.1f} '
            f'a {w/2:.1f} {ry:.1f} 0 0 1 {w:.1f} 0 '
            f'v {h-2*ry:.1f} a {w/2:.1f} {ry:.1f} 0 0 1 {-w:.1f} 0 z" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        self.body.append(
            f'<path d="M {cx-w/2:.1f} {top+ry:.1f} '
            f'a {w/2:.1f} {ry:.1f} 0 0 0 {w:.1f} 0" '
            f'fill="none" stroke="{stroke}" stroke-width="1.5"/>')
        self.multiline(cx, cy + 2, label_lines, size=lsize, color=INK,
                       weight="bold", anchor="middle")

    def actor(self, cx, cy, label, color=INK, scale=1.0):
        """A UML stick-figure actor with a label underneath."""
        r = 9 * scale
        head_y = cy - 26 * scale
        self.body.append(
            f'<circle cx="{cx:.1f}" cy="{head_y:.1f}" r="{r:.1f}" '
            f'fill="{WHITE}" stroke="{color}" stroke-width="2.4"/>')
        body_top = head_y + r
        body_bot = body_top + 26 * scale
        self.line(cx, body_top, cx, body_bot, color=color, sw=2.4, marker=False)
        self.line(cx - 16 * scale, body_top + 9 * scale, cx + 16 * scale,
                  body_top + 9 * scale, color=color, sw=2.4, marker=False)
        self.line(cx, body_bot, cx - 13 * scale, body_bot + 20 * scale,
                  color=color, sw=2.4, marker=False)
        self.line(cx, body_bot, cx + 13 * scale, body_bot + 20 * scale,
                  color=color, sw=2.4, marker=False)
        for i, ln in enumerate(label.split("\n")):
            self.text(cx, body_bot + 36 * scale + i * 15, ln, size=13,
                      color=color, weight="bold", anchor="middle")

    def oval(self, cx, cy, rx, ry, lines, fill=WHITE, stroke=TEAL,
             color=INK, size=12.5, weight="bold", tag=None, sw=1.8):
        """A UML use-case ellipse with a centred multiline label."""
        self.body.append(
            f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
        y0 = cy - (len(lines) - 1) * (size + 2) / 2 + size * 0.34
        if tag:
            self.text(cx, y0 - (size + 2) * (len(lines) / 2 + 0.55), tag,
                      size=size - 2.5, color=stroke, anchor="middle",
                      weight="bold", italic=True)
        for i, ln in enumerate(lines):
            self.text(cx, y0 + i * (size + 2), ln, size=size, color=color,
                      weight=weight, anchor="middle")

    def conn(self, x1, y1, x2, y2, label=None, dash=None, color=INK_SOFT,
             marker="arrowOpen", sw=1.6, loff=0):
        m = f' marker-end="url(#{marker})"' if marker else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.body.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{color}" stroke-width="{sw}"{d}{m}/>')
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2 - 4 + loff
            tw = len(label) * 6.2 + 8
            self.rect(mx - tw / 2, my - 11, tw, 16, fill=WHITE, stroke="none",
                      rx=3, sw=0)
            self.text(mx, my + 1, label, size=10.5, color=color,
                      anchor="middle", weight="bold", italic=True)

    # ── higher level building blocks ─────────────────────────────────────────
    def panel(self, x, y, w, h, title, subtitle="", bg=PANEL_BG, bd=PANEL_BD,
              tab=TEAL):
        """A layer panel: rounded body + a teal title tab top-left."""
        self.rect(x, y, w, h, fill=bg, stroke=bd, rx=14, sw=1.8)
        tw = 26 + len(title) * 8.4 + (len(subtitle) * 6.0 if subtitle else 0)
        tw = min(tw, w - 30)
        self.rect(x + 16, y - 16, tw, 32, fill=tab, stroke="none", rx=8, sw=0)
        self.text(x + 30, y + 5, title, size=14.5, color=WHITE, weight="bold",
                  anchor="start")
        if subtitle:
            self.text(x + 30 + len(title) * 8.4 + 14, y + 5, subtitle,
                      size=12, color="#DFF3F6", anchor="start")

    def bar(self, x, y, w, h, label, fill=TEAL, color=WHITE, lock_left=True,
            size=13):
        """A full-width teal infrastructure bar (e.g. API gateway)."""
        self.rect(x, y, w, h, fill=fill, stroke="none", rx=8, sw=0)
        tx = x + 18
        if lock_left:
            self.lock(x + 18, y + h / 2, s=13, color=WHITE)
            tx = x + 36
        self.text(tx, y + h / 2 + 4.5, label, size=size, color=color,
                  weight="bold", anchor="start")

    def node(self, x, y, w, h, title_lines, fill=CARD_BG, bd=CARD_BD,
             num=None, num_color=ORANGE, accent=None, tsize=12.5,
             sub: Optional[str] = None):
        """A node card. Optional numbered badge + left accent stripe."""
        self.rect(x, y, w, h, fill=fill, stroke=bd, rx=9, sw=1.6)
        if accent:
            self.body.append(
                f'<path d="M {x+1.5:.1f} {y+9:.1f} v {h-18:.1f}" '
                f'stroke="{accent}" stroke-width="4" stroke-linecap="round"/>')
        cy0 = y + h / 2 - (len(title_lines) - 1) * 7.5
        if sub:
            cy0 -= 8
        for i, ln in enumerate(title_lines):
            self.text(x + w / 2, cy0 + i * 15 + 4, ln, size=tsize, color=INK,
                      weight="bold", anchor="middle")
        if sub:
            self.text(x + w / 2, cy0 + len(title_lines) * 15 + 4, sub,
                      size=10.5, color=INK_SOFT, anchor="middle")
        if num is not None:
            self.badge(x + 15, y + 14, num, color=num_color)

    def badge(self, cx, cy, n, color=ORANGE, r=11):
        self.body.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{color}" '
            f'stroke="{WHITE}" stroke-width="2"/>')
        self.text(cx, cy + 4, str(n), size=12.5, color=WHITE, weight="bold",
                  anchor="middle")

    def uml(self, x, y, w, name, attrs=None, methods=None, stereotype=None,
            header=TEAL, abstract=False, mono="Menlo, Consolas, monospace"):
        """A UML class box (name / attributes / operations compartments).
        Returns a dict of bounds and edge anchor points."""
        attrs = attrs or []
        methods = methods or []
        lh, pad = 16.5, 9
        name_h = 32 + (15 if stereotype else 0)
        attrs_h = (pad * 2 + len(attrs) * lh) if attrs else 12
        meth_h = (pad * 2 + len(methods) * lh) if methods else 12
        h = name_h + attrs_h + meth_h
        # outer
        self.rect(x, y, w, h, fill=WHITE, stroke="#5A6B82", rx=7, sw=1.7)
        # header band
        self.body.append(
            f'<path d="M {x} {y+name_h} V {y+7} a7 7 0 0 1 7 -7 H {x+w-7} '
            f'a7 7 0 0 1 7 7 V {y+name_h} Z" fill="{header}"/>')
        ny = y + 18
        if stereotype:
            self.text(x + w / 2, ny, stereotype, size=10.5, color="#EAF6F8",
                      anchor="middle", italic=True)
            ny += 17
        self.text(x + w / 2, ny + 4, name, size=13.5, color=WHITE,
                  weight="bold", anchor="middle", italic=abstract)
        # divider after attrs
        self.line(x, y + name_h, x + w, y + name_h, color="#5A6B82", sw=1.2,
                  marker=False)
        ay = y + name_h + pad + 10
        for a in attrs:
            self.text(x + 11, ay, a, size=10.5, color=INK, family=mono)
            ay += lh
        self.line(x, y + name_h + attrs_h, x + w, y + name_h + attrs_h,
                  color="#5A6B82", sw=1.2, marker=False)
        my = y + name_h + attrs_h + pad + 10
        for m in methods:
            self.text(x + 11, my, m, size=10.5, color="#1d3b2f", family=mono)
            my += lh
        cx, cy = x + w / 2, y + h / 2
        return {"x": x, "y": y, "w": w, "h": h, "cx": cx, "cy": cy,
                "top": (cx, y), "bottom": (cx, y + h),
                "left": (x, cy), "right": (x + w, cy)}

    # ── serialise ────────────────────────────────────────────────────────────
    def svg(self) -> str:
        defs = (
            '<defs>'
            '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" '
            'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            '<path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker>'
            '<marker id="arrowOpen" viewBox="0 0 12 12" refX="10" refY="6" '
            'markerWidth="11" markerHeight="11" orient="auto-start-reverse">'
            '<path d="M 1 1 L 11 6 L 1 11" fill="none" stroke="context-stroke" '
            'stroke-width="1.6"/></marker>'
            '<marker id="tri" viewBox="0 0 16 16" refX="15" refY="8" '
            'markerWidth="16" markerHeight="16" orient="auto-start-reverse">'
            '<path d="M 1 1 L 15 8 L 1 15 z" fill="white" stroke="#46556F" '
            'stroke-width="1.4"/></marker>'
            '<marker id="diamond" viewBox="0 0 18 12" refX="1" refY="6" '
            'markerWidth="18" markerHeight="12" orient="auto-start-reverse">'
            '<path d="M 1 6 L 9 1 L 17 6 L 9 11 z" fill="white" '
            'stroke="#46556F" stroke-width="1.3"/></marker>'
            '</defs>')
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" '
            f'height="{self.h}" viewBox="0 0 {self.w} {self.h}" '
            f'font-family="{FONT}">'
            f'<rect width="{self.w}" height="{self.h}" fill="{self.bg}"/>'
            f'{defs}{"".join(self.body)}</svg>')

    def save(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.svg())
        return path
