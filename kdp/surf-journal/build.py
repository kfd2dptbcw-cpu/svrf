"""
SVRF Surf Log — KDP paperback generator.

Builds:
  print/svrf-surf-log-interior.pdf   6 x 9 in trim, with bleed (6.125 x 9.25 in pages), black & white interior
  print/svrf-surf-log-cover.pdf      full-wrap paperback cover (back + spine + front) with 0.125 in bleed
  print/svrf-surf-log-cover.png      same cover at 300 DPI
  print/svrf-surf-log-front.jpg      front cover only, for listings / marketing

Run:  python3 build.py   (needs reportlab and pypdfium2)
"""

from __future__ import annotations

import math
import os
import random

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Frame, Paragraph, Table, TableStyle

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "print")
FONTS = os.path.join(HERE, "fonts")

IN = 72.0
TRIM_W, TRIM_H = 6 * IN, 9 * IN
BLEED = 0.125 * IN
PAGE_W, PAGE_H = TRIM_W + BLEED, TRIM_H + 2 * BLEED

# KDP: 151-300 pages needs >= 0.5 in gutter; outside >= 0.375 in with bleed. We go a little wider.
GUTTER = 0.68 * IN
OUTER = 0.5 * IN
TOP = 0.55 * IN
BOTTOM = 0.62 * IN

SESSIONS = 120
SPOTS = 8
BOARDS = 6

# ---- Brand -----------------------------------------------------------------
INK = HexColor("#0B0D0E")
SLATE = HexColor("#4A5459")
FOG = HexColor("#8E9A9C")
SEAFOAM = HexColor("#CFDBDA")
CHALK = HexColor("#EFEEE7")
FLAG = HexColor("#FF4E1F")
PAPER = HexColor("#F7F6F1")

# Interior is printed black & white, so it only uses neutrals.
RULE = HexColor("#A7AFB1")      # writing lines
HAIR = HexColor("#C9CFD0")      # faint guides
TINT = HexColor("#EEEFEC")      # light panel fill
MID = HexColor("#6C777B")


def reg_fonts():
    for name, file in [
        ("Display", "ArchivoBlack-Regular.ttf"),
        ("Sans", "Inter-Regular.ttf"),
        ("Sans-It", "Inter-Italic.ttf"),
        ("Sans-Md", "Inter-Medium.ttf"),
        ("Sans-SB", "Inter-SemiBold.ttf"),
        ("Sans-Bd", "Inter-Bold.ttf"),
        ("Mono", "JetBrainsMono-Regular.ttf"),
        ("Mono-Md", "JetBrainsMono-Medium.ttf"),
        ("Mono-Bd", "JetBrainsMono-Bold.ttf"),
    ]:
        pdfmetrics.registerFont(TTFont(name, os.path.join(FONTS, file)))
    pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bd", italic="Sans-It", boldItalic="Sans-Bd")


# ---- Paragraph styles --------------------------------------------------------
def styles():
    body = ParagraphStyle("body", fontName="Sans", fontSize=9.2, leading=13.4, textColor=INK, spaceAfter=6)
    return {
        "body": body,
        "small": ParagraphStyle("small", parent=body, fontSize=8, leading=11.2, textColor=SLATE),
        "lead": ParagraphStyle("lead", parent=body, fontName="Sans-Md", fontSize=10.5, leading=15, spaceAfter=10),
        "h3": ParagraphStyle("h3", parent=body, fontName="Sans-Bd", fontSize=9.6, leading=13, spaceBefore=4, spaceAfter=3),
        "bullet": ParagraphStyle("bullet", parent=body, leftIndent=11, bulletIndent=0, spaceAfter=3.5),
        "center": ParagraphStyle("center", parent=body, alignment=TA_CENTER),
        "cell": ParagraphStyle("cell", parent=body, fontSize=8.2, leading=10.6, spaceAfter=0),
        "cellb": ParagraphStyle("cellb", parent=body, fontName="Sans-SB", fontSize=8.2, leading=10.6, spaceAfter=0),
    }


ST = None


# ---- Page geometry -------------------------------------------------------------
class Page:
    """Geometry for the current interior page. Page 1 is a right-hand (recto) page."""

    def __init__(self, c: canvas.Canvas, number: int):
        self.c = c
        self.n = number
        self.recto = number % 2 == 1
        # Bleed sits on the outside edge only, so the trim box shifts on left-hand pages.
        self.tx0 = 0 if self.recto else BLEED
        self.tx1 = self.tx0 + TRIM_W
        self.ty0 = BLEED
        self.ty1 = BLEED + TRIM_H
        self.x0 = self.tx0 + (GUTTER if self.recto else OUTER)
        self.x1 = self.tx1 - (OUTER if self.recto else GUTTER)
        self.y1 = self.ty1 - TOP
        self.y0 = self.ty0 + BOTTOM
        self.w = self.x1 - self.x0

    def full_bleed(self, color):
        self.c.setFillColor(color)
        self.c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)


# ---- Drawing primitives ----------------------------------------------------------
def text(c, x, y, s, font="Sans", size=9, color=INK, align="left", tracking=0):
    c.setFillColor(color)
    if tracking:
        t = c.beginText()
        t.setFont(font, size)
        t.setCharSpace(tracking)
        w = pdfmetrics.stringWidth(s, font, size) + tracking * (len(s) - 1)
        if align == "center":
            x -= w / 2
        elif align == "right":
            x -= w
        t.setTextOrigin(x, y)
        t.textOut(s)
        t.setCharSpace(0)  # text state persists in PDF; don't leak tracking into later text
        c.drawText(t)
        return w
    c.setFont(font, size)
    if align == "center":
        c.drawCentredString(x, y, s)
    elif align == "right":
        c.drawRightString(x, y, s)
    else:
        c.drawString(x, y, s)
    return pdfmetrics.stringWidth(s, font, size)


def label(c, x, y, s, size=6.6, color=SLATE, align="left"):
    """Small uppercase mono label — the SVRF data voice."""
    return text(c, x, y, s.upper(), "Mono-Md", size, color, align, tracking=0.5)


def hline(c, x0, x1, y, color=RULE, width=0.5, dash=None):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    if dash:
        c.setDash(*dash)
    c.line(x0, y, x1, y)
    if dash:
        c.setDash()


def field(c, x, y, w, name, size=6.6):
    """Label followed by a writing line to the end of width w."""
    lw = label(c, x, y + 2, name, size)
    hline(c, x + lw + 4, x + w, y)


def checkbox(c, x, y, s=6.5, color=INK):
    c.setStrokeColor(color)
    c.setLineWidth(0.6)
    c.rect(x, y, s, s, stroke=1, fill=0)


def circle(c, x, y, r, color=INK, width=0.6, fill=None):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    if fill is not None:
        c.setFillColor(fill)
    c.circle(x, y, r, stroke=1, fill=1 if fill is not None else 0)


def rating_dot(c, x, y, d, filled=False, color=INK, width=0.7):
    """One rating mark: a circle to colour in. (x, y) is the bottom-left of its box."""
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.setFillColor(color)
    c.circle(x + d / 2, y + d / 2, d / 2, stroke=1, fill=1 if filled else 0)
    return d


def flags_rating(c, x, y, h=9, gap=5, n=5, color=INK):
    """Five empty circles to colour in (the 1-5 rating scale). Returns total width."""
    cx = x
    for _ in range(n):
        cx += rating_dot(c, cx, y, h, False, color) + gap
    return cx - x - gap


# Optional official logo files (transparent PNG). logo.png is used on light pages, logo-light.png on the dark cover.
BRAND_LOGO = os.path.join(HERE, "brand", "logo.png")
BRAND_LOGO_LIGHT = os.path.join(HERE, "brand", "logo-light.png")


def logo(c, x, y, h, light=False, with_word=True, accent=FLAG):
    """SVRF brand mark. Uses brand/logo.png if supplied, otherwise the plain SVRF wordmark set in Archivo Black."""
    src = BRAND_LOGO_LIGHT if light else BRAND_LOGO
    if os.path.exists(src):
        from reportlab.lib.utils import ImageReader
        img = ImageReader(src)
        iw, ih = img.getSize()
        c.drawImage(img, x, y, h * iw / ih, h, mask="auto")
        return h * iw / ih
    return text(c, x, y + h * 0.12, "SVRF", "Display", h * 0.95, INK if not light else CHALK, tracking=h * 0.03)


def compass(c, cx, cy, r, title=None, legend=True):
    """16-point compass rose to draw swell and wind arrows on."""
    c.setStrokeColor(HAIR)
    c.setLineWidth(0.4)
    for i in range(16):
        a = math.radians(90 - i * 22.5)
        inner = r * (0.18 if i % 2 == 0 else 0.55)
        c.line(cx + inner * math.cos(a), cy + inner * math.sin(a), cx + r * math.cos(a), cy + r * math.sin(a))
    circle(c, cx, cy, r * 0.55, HAIR, 0.4)
    circle(c, cx, cy, r, INK, 0.8)
    for i in range(16):
        a = math.radians(90 - i * 22.5)
        tick = 4 if i % 4 == 0 else (2.6 if i % 2 == 0 else 1.6)
        c.setStrokeColor(INK)
        c.setLineWidth(0.7)
        c.line(cx + (r - tick) * math.cos(a), cy + (r - tick) * math.sin(a), cx + r * math.cos(a), cy + r * math.sin(a))
    for i, d in enumerate(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]):
        a = math.radians(90 - i * 45)
        rr = r + (7.5 if len(d) == 1 else 9.5)
        text(c, cx + rr * math.cos(a), cy + rr * math.sin(a) - 2.3, d, "Mono-Bd" if len(d) == 1 else "Mono", 6.4 if len(d) == 1 else 5.6, INK if len(d) == 1 else SLATE, "center")
    c.setFillColor(INK)
    c.circle(cx, cy, 1.2, stroke=0, fill=1)


def tide_curve(c, x, y, w, h, labels=True):
    """One tidal cycle, low to high to low, with hour ticks: mark when you were in the water."""
    c.setStrokeColor(HAIR)
    c.setLineWidth(0.4)
    for i in range(13):
        xx = x + w * i / 12
        c.line(xx, y, xx, y + h)
    hline(c, x, x + w, y, INK, 0.6)
    p = c.beginPath()
    steps = 120
    for i in range(steps + 1):
        t = i / steps
        yy = y + 3 + (h - 6) * (0.5 - 0.5 * math.cos(2 * math.pi * t))
        if i == 0:
            p.moveTo(x + w * t, yy)
        else:
            p.lineTo(x + w * t, yy)
    c.setStrokeColor(INK)
    c.setLineWidth(1.3)
    c.drawPath(p, stroke=1, fill=0)
    if labels:
        for frac, s, al in [(0, "LOW", "left"), (0.25, "MID", "center"), (0.5, "HIGH", "center"),
                            (0.75, "MID", "center"), (1, "LOW", "right")]:
            label(c, x + w * frac, y - 8, s, 5.6, SLATE, al)


def lines(c, x0, x1, ytop, n, gap=20, color=RULE):
    for i in range(n):
        hline(c, x0, x1, ytop - gap * (i + 1), color)
    return ytop - gap * n


def dot_grid(c, x0, y0, x1, y1, step=0.2 * IN, r=0.45, color=FOG):
    c.setFillColor(color)
    nx = int((x1 - x0) / step)
    ny = int((y1 - y0) / step)
    ox = x0 + ((x1 - x0) - nx * step) / 2
    oy = y0 + ((y1 - y0) - ny * step) / 2
    for i in range(nx + 1):
        for j in range(ny + 1):
            c.circle(ox + i * step, oy + j * step, r, stroke=0, fill=1)


def panel(c, x, y, w, h, fill=TINT, stroke=None, radius=3):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, radius, stroke=1 if stroke else 0, fill=1 if fill else 0)


def section_head(c, pg, kicker, title, y=None):
    """Page header: mono kicker, display title, heavy rule. Returns y below the rule."""
    y = pg.y1 if y is None else y
    label(c, pg.x0, y - 7, kicker, 6.8, SLATE)
    text(c, pg.x0, y - 30, title, "Display", 20, INK)
    hline(c, pg.x0, pg.x1, y - 39, INK, 1.6)
    return y - 39


def footer(c, pg, section=""):
    y = pg.ty0 + 0.45 * IN
    num = str(pg.n)
    if pg.recto:
        text(c, pg.x1, y, num, "Mono-Bd", 7, INK, "right")
        if section:
            label(c, pg.x1 - 16, y, section, 5.8, FOG, "right")
        label(c, pg.x0, y, "SVRF Surf Log", 5.8, FOG)
    else:
        text(c, pg.x0, y, num, "Mono-Bd", 7, INK)
        if section:
            label(c, pg.x0 + 16, y, section, 5.8, FOG)
        label(c, pg.x1, y, "SVRF Surf Log", 5.8, FOG, "right")


def paragraphs(c, pg, items, x, ytop, w, ybottom):
    f = Frame(x, ybottom, w, ytop - ybottom, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, showBoundary=0)
    rest = f.addFromList(list(items), c)
    if items and rest is None:
        pass
    return f


def P(s, style="body"):
    return Paragraph(s, ST[style])


def B(s):
    return Paragraph(s, ST["bullet"], bulletText="—")


# ---- Swell-lines motif (used on dividers and the cover) ------------------------------
def _mix(a, b, t):
    return Color(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t)


def swell_lines(c, x0, y0, x1, y1, n=26, seed=7, color=SLATE, width=0.7, highlight=None, hl_color=FLAG, hl_width=1.6,
                amp=1.0, bg=INK):
    """Groundswell lines stacking to the horizon, as seen from a cliff top: an original SVRF motif.
    y1 is the horizon. Each crest is a tapered stroke that thickens where the swell peaks and fades
    out between peaks; crests get further apart, heavier and brighter toward the viewer and arrive in sets."""
    rnd = random.Random(seed)
    steps = 260
    set_len = 4
    for k in range(n):
        d = (k + 1) / n                       # 0 = horizon, 1 = foreground
        base = y1 - (y1 - y0) * d ** 1.9
        gap = (y1 - y0) * (d ** 1.9 - (k / n) ** 1.9)
        in_set = (k // set_len) % 2 == 0
        hl = highlight is not None and k == highlight
        p1, p2, p3 = rnd.uniform(0, 1), rnd.uniform(0, 1), rnd.uniform(0, 1)
        f1 = rnd.uniform(0.9, 1.4)
        top, bot = [], []
        for i in range(steps + 1):
            u = i / steps
            px = x0 + (x1 - x0) * u
            # gentle crest shape: long wavelengths only, plus a bow toward the viewer
            v = 0.5 * math.sin(2 * math.pi * (u * 0.7 + p1)) + 0.25 * math.sin(2 * math.pi * (u * 1.6 + p2))
            bow = 1 - (2 * u - 1) ** 2
            py = base + gap * amp * (0.3 * v - 0.22 * bow)
            # thickness along the crest: peaks and fades (sections of the line break up between peaks)
            e = 0.5 + 0.5 * math.sin(2 * math.pi * (u * f1 * (2.2 - d) + p3))
            if hl:
                e = (0.45 + 0.55 * e) * min(1.0, u / 0.12, (1 - u) / 0.12 + 0.35)
            else:
                e = max(0.0, (e - 0.3) / 0.7) ** 0.8
            th = (hl_width if hl else width) * (0.35 + 2.4 * d ** 1.3) * e * (1.0 if (in_set or hl) else 0.6)
            top.append((px, py + th / 2))
            bot.append((px, py - th / 2))
        strength = (0.3 + 0.7 * d) * (1.0 if in_set else 0.75)
        col = hl_color if hl else (_mix(bg, color, min(1.0, strength)) if bg is not None else color)
        path = c.beginPath()
        path.moveTo(*top[0])
        for pt in top[1:]:
            path.lineTo(*pt)
        for pt in reversed(bot):
            path.lineTo(*pt)
        path.close()
        c.setFillColor(col)
        c.drawPath(path, stroke=0, fill=1)


# =====================================================================================
# Interior pages. Each function draws one page and returns the running-section name.
# =====================================================================================

def p_half_title(c, pg):
    lw = pdfmetrics.stringWidth("SVRF", "Display", 44 * 0.95) + 3 * 44 * 0.03
    logo(c, pg.tx0 + (TRIM_W - lw) / 2, pg.ty0 + TRIM_H * 0.56, 44)
    text(c, pg.tx0 + TRIM_W / 2, pg.ty0 + TRIM_H * 0.47, "SURF LOG", "Display", 30, INK, "center", tracking=1)
    label(c, pg.tx0 + TRIM_W / 2, pg.ty0 + TRIM_H * 0.43, "A session journal for reading the sea", 7.4, SLATE, "center")


def p_copyright(c, pg):
    y = pg.y0 + 2.6 * IN
    lines_ = [
        ("SVRF Surf Log", "Sans-Bd", 9),
        ("A session journal for reading the sea", "Sans", 8.5),
        ("", "Sans", 8),
        ("Copyright © 2026 SVRF. All rights reserved.", "Sans", 8),
        ("No part of this publication may be reproduced, distributed or", "Sans", 8),
        ("transmitted in any form without prior written permission from the", "Sans", 8),
        ("publisher, except for personal use of the journal pages.", "Sans", 8),
        ("", "Sans", 8),
        ("Independently published.", "Sans", 8),
        ("", "Sans", 8),
        ("Surfing is a hazardous activity. The field guide in this journal is", "Sans-It", 7.6),
        ("general information, not instruction, and tide notes are not for", "Sans-It", 7.6),
        ("navigation. Check local conditions, surf within your ability, and", "Sans-It", 7.6),
        ("surf at lifeguarded beaches when you can.", "Sans-It", 7.6),
        ("", "Sans", 8),
        ("Set in Archivo Black, Inter and JetBrains Mono.", "Sans", 7.6),
    ]
    for s, f, sz in lines_:
        text(c, pg.x0, y, s, f, sz, INK if f != "Sans-It" else SLATE)
        y -= sz * 1.55


def p_belongs(c, pg):
    y = section_head(c, pg, "Logbook No. ____", "This log belongs to")
    y -= 34
    for name in ["Name", "Home break", "Phone", "Email / socials", "Started this log on", "Session numbers in this log"]:
        field(c, pg.x0, y, pg.w, name, 7)
        y -= 32
    y -= 10
    panel(c, pg.x0, y - 112, pg.w, 112)
    label(c, pg.x0 + 12, y - 18, "If found", 7.4, INK)
    for i, s in enumerate([
        "This book holds a lot of waves. Please send it",
        "home — the owner would rather lose a fin.",
        "",
        "Reward: ____________________________",
    ]):
        text(c, pg.x0 + 12, y - 36 - i * 15, s, "Sans", 9.4, INK)
    y -= 150
    label(c, pg.x0, y, "Emergency contact", 7, SLATE)
    y -= 26
    field(c, pg.x0, y, pg.w, "Name / phone", 7)
    y -= 30
    field(c, pg.x0, y, pg.w, "Medical notes", 7)


def p_contents(c, pg, toc):
    y = section_head(c, pg, "Inside", "Contents")
    y -= 26
    for num, title, desc, page in toc:
        text(c, pg.x0, y, num, "Mono-Bd", 9, FOG)
        text(c, pg.x0 + 26, y, title, "Sans-Bd", 11, INK)
        tw = pdfmetrics.stringWidth(title, "Sans-Bd", 11)
        hline(c, pg.x0 + 30 + tw, pg.x1 - 22, y + 2, HAIR, 0.6, dash=(1, 2.2))
        text(c, pg.x1, y, str(page), "Mono-Bd", 9, INK, "right")
        text(c, pg.x0 + 26, y - 13, desc, "Sans", 8, SLATE)
        y -= 37


def p_how_to(c, pg):
    y = section_head(c, pg, "Start here", "How to use this log")
    items = [
        P("Every surfer has a session that changed how they read the ocean. Most of us forget the details by the "
          "drive home. This log is built to catch them — and to make you a sharper forecaster than any app.", "lead"),
        P("<b>1 — Before you paddle out, write the forecast.</b> Note the predicted size, period, swell and wind "
          "directions, and the rating the forecast gave. Thirty seconds, done in the car park."),
        P("<b>2 — After the session, write what you actually got.</b> The <i>Forecast vs Reality</i> block puts "
          "the two side by side. Then give the forecast a verdict: <i>Called it</i>, <i>Close</i> or <i>Way off</i>."),
        P("<b>3 — Draw it.</b> Arrow the swell and wind on the compass, mark the tide window on the curve, "
          "colour in the rating dots. Drawing is faster than writing and easier to read back a year later."),
        P("<b>4 — Close the loop each month.</b> The Monthly Review turns a stack of sessions into lessons: "
          "which spots fired, on what tide, with which board — and how often the forecast was right."),
        P("<b>5 — Build your Spot Files.</b> Every break has a recipe. After a few sessions you'll know yours by "
          "heart: the swell window, the offshore wind, the tide that switches it on."),
        Paragraph("Rating scale", ST["h3"]),
        P("Throughout this log, conditions and stoke are rated on a five-point scale \u2014 the same "
          "1\u20135 scale SVRF forecasts use. Colour in as many dots as the session deserves."),
    ]
    f = Frame(pg.x0, pg.y0 + 1.75 * IN, pg.w, y - 14 - (pg.y0 + 1.75 * IN), 0, 0, 0, 0)
    f.addFromList(items, c)
    rows = [("Poor", "Flat, tiny or blown out."), ("Fair", "Surfable but compromised."),
            ("Good", "Fun waves, reasonable wind. Go."), ("Excellent", "Size, period and clean wind."),
            ("Epic", "Everything lines up. Call in sick.")]
    yy = pg.y0 + 1.6 * IN
    for i, (name, d) in enumerate(rows):
        for k in range(5):
            rating_dot(c, pg.x0 + k * 11, yy - 1, 8, filled=k <= i)
        text(c, pg.x0 + 64, yy + 1, name, "Sans-Bd", 8.6)
        text(c, pg.x0 + 120, yy + 1, d, "Sans", 8.6, SLATE)
        yy -= 19


def p_divider(c, pg, num, title, sub):
    pg.full_bleed(INK)
    swell_lines(c, -10, -0.2 * IN, PAGE_W + 10, pg.ty0 + TRIM_H * 0.42, n=20, seed=int(num) * 13,
                color=SEAFOAM, width=0.9, highlight=15, hl_color=CHALK, hl_width=1.1)
    x = pg.x0
    text(c, x, pg.ty1 - 1.45 * IN, num, "Mono-Bd", 11, FOG, tracking=1)
    c.setFillColor(CHALK)
    c.rect(x, pg.ty1 - 1.8 * IN, 0.42 * IN, 3.5, stroke=0, fill=1)
    yy = pg.ty1 - 2.75 * IN
    for line in title.split("\n"):
        text(c, x, yy, line, "Display", 38, CHALK)
        yy -= 42
    yy -= 6
    for line in sub.split("\n"):
        text(c, x, yy, line, "Sans", 10.5, SEAFOAM)
        yy -= 15


def p_season(c, pg):
    y = section_head(c, pg, "The season ahead", "Intentions")
    y -= 24
    field(c, pg.x0, y, pg.w * 0.48, "Season / year")
    field(c, pg.x0 + pg.w * 0.54, y, pg.w * 0.46, "Session target")
    y -= 30
    blocks = [
        ("Three things I want to get better at", 3),
        ("Spots I want to surf this year", 3),
        ("A wave I want to ride before the season ends", 2),
        ("Boards / gear to sort", 2),
        ("Who I want to surf with more", 1),
    ]
    for t, n in blocks:
        label(c, pg.x0, y, t, 7, INK)
        y = lines(c, pg.x0, pg.x1, y - 2, n, 21) - 18
    panel(c, pg.x0, y - 70, pg.w, 70)
    label(c, pg.x0 + 10, y - 16, "Signed (so you mean it)", 6.8, SLATE)
    hline(c, pg.x0 + 10, pg.x1 - 10, y - 48, INK, 0.6)


# ---- Field guide -------------------------------------------------------------------------

def guide_page(c, pg, kicker, title, items, after=None, bottom_reserve=0):
    y = section_head(c, pg, kicker, title)
    f = Frame(pg.x0, pg.y0 + bottom_reserve, pg.w, y - 14 - (pg.y0 + bottom_reserve), 0, 0, 0, 0)
    f.addFromList(list(items), c)
    if after:
        after(c, pg)


def table(data, widths, header=True, zebra=True):
    rows = [[Paragraph(str(cell), ST["cellb"] if (header and r == 0) or ci == 0 else ST["cell"]) for ci, cell in enumerate(row)]
            for r, row in enumerate(data)]
    t = Table(rows, colWidths=widths)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, HAIR),
    ]
    if header:
        style += [("LINEBELOW", (0, 0), (-1, 0), 1, INK)]
    if zebra:
        for r in range(1 if header else 0, len(data), 2):
            style.append(("BACKGROUND", (0, r), (-1, r), TINT))
    t.setStyle(TableStyle(style))
    return t


def p_guide_swell(c, pg):
    w = pg.w
    items = [
        P("A forecast gives you <b>deep-water swell</b>: its height, its period and the direction it comes from. "
          "What breaks on the beach depends on all three, plus the shape of the seabed.", "lead"),
        Paragraph("Period is the number that matters", ST["h3"]),
        P("Period is the time between swell crests, in seconds. Longer-period swell has travelled further, carries "
          "far more energy and is less affected by local wind. A 3 ft swell at 15 s can break bigger than a 5 ft "
          "swell at 7 s."),
        table([
            ["Period", "What it is", "What to expect"],
            ["Under 8 s", "Local windswell", "Weak, choppy, close together. Often only fun on a good bank."],
            ["8 – 10 s", "Short-period swell", "Surfable and more consistent; size close to the forecast."],
            ["11 – 13 s", "Groundswell", "Defined lines, more push. Reefs and points start to work."],
            ["14 s +", "Long-period groundswell", "Breaks bigger than forecast, long lulls then heavy sets."],
        ], [w * 0.2, w * 0.3, w * 0.5]),
        Paragraph("<br/>Swell height vs wave face", ST["h3"]),
        P("Forecasters convert swell into an estimated breaking wave face, shown here in feet. The SVRF forecast "
          "factors in period, direction and each spot's exposure. Your job in this log is to learn how each of "
          "your spots compares — some always break bigger, some always smaller."),
        Paragraph("Swell direction", ST["h3"]),
        P("Like wind, swell direction is where it comes <i>from</i>. A beach only receives swell from inside its "
          "<b>swell window</b> — the arc of open water it faces. Swell from outside that window wraps in "
          "small, or not at all."),
        P("<b>Rule of thumb:</b> energy rises with the <i>square</i> of height times period, so doubling the height "
          "roughly quadruples the power.", "small"),
    ]
    guide_page(c, pg, "Field guide 01", "Swell & period", items)


def p_guide_wind(c, pg):
    w = pg.w
    items = [
        P("Swell makes the waves. Wind decides whether they are any good.", "lead"),
        Paragraph("Offshore, onshore, cross-shore", ST["h3"]),
        B("<b>Offshore</b> blows from the land out to sea. It holds the wave face up and grooms it smooth. "
          "Too strong and it makes paddling into waves hard."),
        B("<b>Onshore</b> blows from the sea onto the land. It crumbles waves and makes them close out."),
        B("<b>Cross-shore</b> blows along the beach. Light cross-off can be great; strong cross-on is messy."),
        P("To find the offshore wind for a beach, face the sea: the wind at your back is offshore. A west-facing "
          "beach is offshore in an east wind.", "small"),
        Paragraph("Wind strength", ST["h3"]),
        table([
            ["Speed", "Feel", "Surf"],
            ["0 – 5 mph", "Calm / glassy", "Best of the day. Dawn and dusk are often like this."],
            ["5 – 12 mph", "Light", "Fine from most directions; ideal if offshore."],
            ["12 – 18 mph", "Moderate", "Offshore: clean but tricky to paddle in. Onshore: messy."],
            ["18 – 25 mph", "Fresh", "Only sheltered spots, or a strong offshore on a solid swell."],
            ["25 mph +", "Strong", "Blown out almost everywhere. Hunt for shelter or rest."],
        ], [w * 0.22, w * 0.22, w * 0.56]),
        P("<br/><b>Diurnal pattern:</b> on warm days the land heats faster than the sea and an onshore sea breeze "
          "builds through the afternoon. Morning sessions are often cleaner.", "small"),
    ]
    guide_page(c, pg, "Field guide 02", "Wind", items, bottom_reserve=1.45 * IN, after=_wind_diagram)


def _wind_diagram(c, pg):
    # Simple plan view: land, beach, sea, with offshore and onshore arrows.
    x, y, w, h = pg.x0, pg.y0 + 0.05 * IN, pg.w, 1.25 * IN
    panel(c, x, y, w, h, TINT)
    c.setFillColor(HexColor("#D9DCDA"))
    c.rect(x, y, w * 0.32, h, stroke=0, fill=1)
    label(c, x + 8, y + h - 12, "Land", 6.4, INK)
    label(c, x + w - 8, y + h - 12, "Sea", 6.4, INK, "right")
    # breaking lines
    for k in range(3):
        xx = x + w * 0.42 + k * 18
        c.setStrokeColor(SLATE)
        c.setLineWidth(0.9)
        p = c.beginPath()
        p.moveTo(xx, y + 10)
        for i in range(1, 21):
            p.lineTo(xx + 2.2 * math.sin(i * 1.1), y + 10 + (h - 20) * i / 20)
        c.drawPath(p, stroke=1, fill=0)

    def arrow(x0, y0, x1, y1, col=INK):
        c.setStrokeColor(col)
        c.setFillColor(col)
        c.setLineWidth(1.4)
        c.line(x0, y0, x1, y1)
        a = math.atan2(y1 - y0, x1 - x0)
        p = c.beginPath()
        p.moveTo(x1, y1)
        p.lineTo(x1 - 7 * math.cos(a - 0.4), y1 - 7 * math.sin(a - 0.4))
        p.lineTo(x1 - 7 * math.cos(a + 0.4), y1 - 7 * math.sin(a + 0.4))
        p.close()
        c.drawPath(p, stroke=0, fill=1)

    arrow(x + w * 0.1, y + h * 0.62, x + w * 0.38, y + h * 0.62)
    text(c, x + w * 0.1, y + h * 0.62 + 6, "OFFSHORE — good", "Mono-Bd", 6.2)
    arrow(x + w * 0.95, y + h * 0.28, x + w * 0.68, y + h * 0.28, SLATE)
    text(c, x + w * 0.95, y + h * 0.28 + 6, "ONSHORE — messy", "Mono-Bd", 6.2, SLATE, "right")


def p_guide_tide(c, pg):
    w = pg.w
    items = [
        P("Tide changes the depth of water over the sandbar or reef, which changes how — and whether — a wave "
          "breaks. Most spots have a tide that switches them on.", "lead"),
        Paragraph("The rule of twelfths", ST["h3"]),
        P("Around the UK and Europe there are roughly two highs and two lows a day, about 6 h 12 min apart. The water "
          "does not move evenly: it rises or falls fastest in the middle hours."),
        table([
            ["Hour after low / high", "1st", "2nd", "3rd", "4th", "5th", "6th"],
            ["Share of the range", "1/12", "2/12", "3/12", "3/12", "2/12", "1/12"],
        ], [w * 0.31] + [w * 0.115] * 6),
        P("<br/>So a spot that only works for an hour either side of low can change fast around mid-tide. Use the "
          "tide curve on each session page to mark when you paddled out and in."),
        Paragraph("Springs and neaps", ST["h3"]),
        B("<b>Spring tides</b> follow a new or full moon by a day or two. Bigger range: higher highs, lower lows, "
          "stronger currents. Tide-sensitive spots switch on and off quickly."),
        B("<b>Neap tides</b> fall around the half moons. Smaller range, gentler flow; spots stay working for longer."),
        Paragraph("Reading your spots", ST["h3"]),
        B("<b>Beach breaks</b> often favour low to mid on the push (rising tide)."),
        B("<b>Reefs and points</b> can be too shallow at low and swamped at high — learn the window."),
        B("<b>High-tide shore dump:</b> many beaches get steep and dumpy at the top of a big spring tide."),
        P("Tide notes here are general. Always check local tide tables; they are not for navigation.", "small"),
    ]
    guide_page(c, pg, "Field guide 03", "Tide", items, bottom_reserve=0.95 * IN, after=_tide_diagram)


def _tide_diagram(c, pg):
    x, y, w = pg.x0 + 14, pg.y0 + 0.24 * IN, pg.w - 28
    tide_curve(c, x, y, w, 0.58 * IN)
    for i, s in enumerate(["1", "2", "3", "3", "2", "1"]):
        text(c, x + w * (i + 0.5) / 12, y + 0.58 * IN + 4, s + "/12", "Mono", 5.4, SLATE, "center")


def p_guide_rating(c, pg):
    items = [
        P("Every session page asks you to rate three things from 1 to 5. Keep them separate — that's where the "
          "learning is.", "lead"),
        Paragraph("1 — Forecast rating", ST["h3"]),
        P("The rating the forecast gave before you went. Copy it from the SVRF forecast (or whichever one you use)."),
        Paragraph("2 — Actual conditions", ST["h3"]),
        P("How good the surf really was, judged as if you were a neutral observer on the cliff. A crowded day can "
          "still be a five."),
        Paragraph("3 — Stoke", ST["h3"]),
        P("How the session felt to <i>you</i>. A two-rated day with your best-ever turn can be five out of five for stoke. "
          "A five-rated day you couldn't handle might be a one."),
        Paragraph("Forecast verdict", ST["h3"]),
        P("Compare columns 1 and 2. If size, wind and rating were all about right, it's <b>Called it</b>. One thing "
          "out — <b>Close</b>. Wrong call entirely — <b>Way off</b>. Tally your verdicts on the Forecast "
          "Scorecard at the back. Over a season you'll learn which forecasts to trust, at which spots, in which "
          "conditions."),
    ]
    guide_page(c, pg, "Field guide 04", "The 1\u20135 scale", items, bottom_reserve=2.05 * IN, after=_rating_scale)


def _rating_scale(c, pg):
    rows = [("1", "Poor", "Flat, tiny or blown out. Not worth the trip."),
            ("2", "Fair", "Surfable but compromised: small or windy."),
            ("3", "Good", "Fun waves with decent size and reasonable wind."),
            ("4", "Excellent", "Good size, solid period, clean offshore-ish wind."),
            ("5", "Epic", "Everything lines up. Call in sick.")]
    x, y = pg.x0, pg.y0 + 1.9 * IN
    panel(c, x, pg.y0 + 0.02 * IN, pg.w, 1.98 * IN)
    for i, (n, name, d) in enumerate(rows):
        yy = y - 12 - i * 23
        for k in range(5):
            rating_dot(c, x + 10 + k * 12, yy - 1.5, 9, filled=k <= i)
        text(c, x + 82, yy + 1, name, "Sans-Bd", 9)
        text(c, x + 136, yy + 1, d, "Sans", 7.4, SLATE)


def p_guide_wetsuit(c, pg):
    w = pg.w
    items = [
        P("Water temperature, not air temperature, decides your rubber. Wind chill, session length and how much you "
          "feel the cold all shift these numbers — use the log to find your own.", "lead"),
        table([
            ["Water", "°F", "Wetsuit", "Extras"],
            ["21 °C +", "70 +", "Boardshorts / swimsuit, rash vest", "—"],
            ["18 – 21 °C", "64 – 70", "2 mm shorty or spring suit", "—"],
            ["15 – 18 °C", "59 – 64", "3/2 full suit", "—"],
            ["12 – 15 °C", "54 – 59", "4/3 full suit", "Boots optional"],
            ["9 – 12 °C", "48 – 54", "5/4 (or warm 4/3)", "Boots, gloves"],
            ["Under 9 °C", "Under 48", "5/4 or 6/5 hooded", "5–7 mm boots, gloves, hood"],
        ], [w * 0.2, w * 0.15, w * 0.37, w * 0.28]),
        Paragraph("<br/>Cold-water habits", ST["h3"]),
        B("Rinse your suit in fresh water and dry it inside-out, out of direct sun."),
        B("A changing robe and a flask of something warm make winter dawn patrols possible."),
        B("Numb hands and slurred thinking mean get out. Cold creeps up on you."),
        B("Log your suit and water temp each session. By next winter you'll know exactly when to switch."),
    ]
    guide_page(c, pg, "Field guide 05", "Wetsuits & water temp", items)


def p_guide_etiquette(c, pg):
    items = [
        P("The lineup runs on a handful of unwritten rules. Here they are, written.", "lead"),
        B("<b>Priority to the surfer closest to the peak.</b> If someone is up and riding, or deeper than you, it's "
          "their wave."),
        B("<b>Don't drop in.</b> Never take off in front of someone already riding the wave."),
        B("<b>Don't snake.</b> Paddling around someone to steal the inside position is the same as dropping in, "
          "just slower."),
        B("<b>Paddle wide.</b> Paddle out through the channel or the white water, not across the path of a rider. "
          "If you're in the way, go for the white water behind them."),
        B("<b>Hold onto your board.</b> A loose board is a weapon. Learn to duck dive or turtle roll."),
        B("<b>Take turns.</b> Waves come in sets. If you've just had one, let others have the next."),
        B("<b>Respect the locals and the spot.</b> Arrive humble, surf within your ability, and leave the car park "
          "and beach cleaner than you found them."),
        B("<b>Help.</b> If someone is in trouble, you are often the closest rescuer. Make sure they're OK."),
        B("<b>Own your mistakes.</b> Drop in by accident? Kick out and apologise. It goes a long way."),
    ]
    guide_page(c, pg, "Field guide 06", "Lineup etiquette", items, bottom_reserve=1.55 * IN, after=_priority_diagram)


def _priority_diagram(c, pg):
    """Plan view of a wave peeling right: the surfer nearest the breaking peak has priority."""
    x, y, w, h = pg.x0, pg.y0 + 0.02 * IN, pg.w, 1.38 * IN
    panel(c, x, y, w, h, TINT)
    label(c, x + 10, y + h - 14, "Who has priority? (seen from above)", 6.6, INK)
    ly = y + h * 0.46
    px = x + w * 0.3
    c.setFillColor(HexColor("#D2D7D7"))
    c.roundRect(x + 14, ly - 7, px - x - 14, 14, 7, stroke=0, fill=1)
    label(c, x + 22, ly - 2.3, "White water", 5.4, SLATE)
    c.setStrokeColor(INK)
    c.setLineWidth(1.6)
    c.line(px, ly, x + w - 30, ly)
    c.setFillColor(INK)
    pth = c.beginPath()
    pth.moveTo(x + w - 18, ly)
    pth.lineTo(x + w - 30, ly + 4.5)
    pth.lineTo(x + w - 30, ly - 4.5)
    pth.close()
    c.drawPath(pth, stroke=0, fill=1)
    label(c, x + w - 18, ly + 10, "Wave peels this way", 5.4, SLATE, "right")
    c.setStrokeColor(SLATE)
    c.setLineWidth(0.6)
    c.setDash(1.5, 1.5)
    c.line(px, ly - 16, px, ly + 16)
    c.setDash()
    label(c, px, ly + 20, "Peak", 5.6, SLATE, "center")

    def surfer(sx, name, note, dark):
        col = INK if dark else HexColor("#AEB6B7")
        c.setFillColor(col)
        c.circle(sx, ly, 6, stroke=0, fill=1)
        text(c, sx, ly - 2.4, name, "Mono-Bd", 6.4, white if dark else INK, "center")
        label(c, sx, ly - 22, note, 5.8, INK, "center")

    surfer(px + 12, "A", "A: closest, goes", True)
    surfer(px + w * 0.3, "B", "B: pulls back", False)
    surfer(px + w * 0.54, "C", "C: waits", False)


def p_guide_safety(c, pg):
    w = pg.w
    items = [
        P("The best surfers are the ones still surfing at eighty. Know the sea and know the signals.", "lead"),
        Paragraph("Rip currents", ST["h3"]),
        P("Rips are channels of water flowing out to sea, often in the gaps between sandbars. Look for darker, "
          "flatter water with fewer breaking waves, foam or debris moving seaward."),
        B("If you're caught, <b>don't fight it</b>. Stay on your board, stay calm."),
        B("Paddle <b>parallel to the beach</b> until you're out of the pull, then use the waves to get in."),
        B("If you can't get out, raise a hand and shout for help."),
        Paragraph("UK beach flags", ST["h3"]),
        table([
            ["Flag", "Meaning"],
            ["Red & yellow", "Lifeguarded area for swimming and bodyboarding."],
            ["Black & white chequered", "Zone for surfboards, kayaks and other craft. Don't swim here."],
            ["Red", "Danger. Do not enter the water."],
            ["Orange windsock", "Offshore or unsafe wind. Don't use inflatables."],
        ], [w * 0.36, w * 0.64]),
        Paragraph("<br/>In an emergency", ST["h3"]),
        P("In the UK and Ireland, call <b>999</b> or <b>112</b> and ask for the <b>Coastguard</b>. Elsewhere, learn "
          "the local number before you paddle out. Write it here:"),
    ]
    def fields(c, pg):
        for k, n in enumerate(["Local emergency number", "Nearest lifeguarded beach", "Nearest A&E / hospital"]):
            field(c, pg.x0, pg.y0 + 0.12 * IN + (2 - k) * 22, pg.w, n)

    guide_page(c, pg, "Field guide 07", "Safety", items, bottom_reserve=1.0 * IN, after=fields)


# ---- Progression -----------------------------------------------------------------

LADDER = [
    ("Foundations", ["Pop-up in the white water", "Ride straight to the beach", "Paddle out through small surf",
                     "Read a set and pick a wave", "Catch an unbroken (green) wave"]),
    ("Riding the face", ["Angled take-off, left and right", "Trim along the open face", "Duck dive / turtle roll",
                         "Generate speed with pumps", "Bottom turn"]),
    ("Turns", ["Cutback", "Top turn / snap", "Floater", "Roundhouse cutback", "Re-entry off the lip"]),
    ("Commitment", ["Late drop on a steep wave", "Surf a reef or point break", "Overhead day, holding position",
                    "Ride a barrel (any size!)", "Your call: __________________"]),
]


def p_ladder(c, pg):
    y = section_head(c, pg, "Progression", "The ladder")
    text(c, pg.x0, y - 16, "Tick it off, date it, and log the session number where it clicked.", "Sans", 8.6, SLATE)
    y -= 34
    label(c, pg.x1 - 78, y, "Date", 6, SLATE)
    label(c, pg.x1 - 26, y, "Sess.", 6, SLATE)
    y -= 8
    for tier, (name, skills) in enumerate(LADDER):
        y -= 6
        text(c, pg.x0, y - 10, f"0{tier + 1}", "Mono-Bd", 8, FOG)
        text(c, pg.x0 + 20, y - 10, name.upper(), "Display", 10.5, INK)
        y -= 14
        for s in skills:
            y -= 18.5
            checkbox(c, pg.x0 + 20, y - 1, 7.5)
            text(c, pg.x0 + 36, y, s, "Sans", 9)
            hline(c, pg.x1 - 82, pg.x1 - 32, y - 2)
            hline(c, pg.x1 - 26, pg.x1, y - 2)
        y -= 6


# ---- Spot files -----------------------------------------------------------------

def p_spot(c, pg, i):
    y = section_head(c, pg, f"Spot file {i:02d} / {SPOTS:02d}", "Spot file")
    y -= 22
    field(c, pg.x0, y, pg.w * 0.62, "Spot")
    field(c, pg.x0 + pg.w * 0.66, y, pg.w * 0.34, "Region")
    y -= 20
    lx = label(c, pg.x0, y, "Type", 6.6)
    xx = pg.x0 + lx + 8
    for t in ["Beach", "Reef", "Point", "Rivermouth", "Slab"]:
        checkbox(c, xx, y - 1, 6.5)
        text(c, xx + 10, y, t, "Sans", 8)
        xx += 18 + pdfmetrics.stringWidth(t, "Sans", 8)
    y -= 12

    # Recipe panel: two compasses + tide.
    ph = 2.25 * IN
    panel(c, pg.x0, y - ph, pg.w, ph)
    label(c, pg.x0 + 10, y - 14, "The recipe", 7, INK)
    r = 0.43 * IN
    cy = y - 14 - 22 - r
    cx1 = pg.x0 + pg.w * 0.22
    cx2 = pg.x0 + pg.w * 0.55
    compass(c, cx1, cy, r)
    compass(c, cx2, cy, r)
    label(c, cx1, cy - r - 17, "Shade the swell window", 5.6, SLATE, "center")
    label(c, cx2, cy - r - 17, "Shade the offshore wind", 5.6, SLATE, "center")
    tx = pg.x0 + pg.w * 0.76
    label(c, tx, y - 36, "Best tide", 6, INK)
    tide_curve(c, tx, cy - 6, pg.w * 0.21, 0.42 * IN, labels=False)
    label(c, tx, cy - 16, "Shade the window", 5.6, SLATE)
    label(c, tx, cy + 0.42 * IN + 16, "", 5)
    yy = y - ph + 14
    field(c, pg.x0 + 10, yy, pg.w * 0.46, "Best size", 6.2)
    field(c, pg.x0 + pg.w * 0.52, yy, pg.w * 0.46, "Min. period", 6.2)
    y -= ph + 20

    for name in ["Faces / bottom", "Works best on", "Hazards (rocks, rips, rules)", "Access & parking",
                 "Crowd & vibe", "Post-surf (food, coffee, shop)"]:
        field(c, pg.x0, y, pg.w, name)
        y -= 21
    y -= 4
    label(c, pg.x0, y, "Sketch the lineup — peaks, channel, rocks, where to paddle out", 6.6, INK)
    y -= 6
    c.setStrokeColor(HAIR)
    c.setLineWidth(0.6)
    c.rect(pg.x0, pg.y0 + 2, pg.w, y - pg.y0 - 2, stroke=1, fill=0)
    dot_grid(c, pg.x0 + 4, pg.y0 + 6, pg.x1 - 4, y - 4)


def p_spot_notes(c, pg, i):
    y = section_head(c, pg, f"Spot file {i:02d} — continued", "Sessions here")
    y -= 10
    cols = [("Session", 0.13), ("Date", 0.16), ("Swell / period", 0.22), ("Wind", 0.15), ("Tide", 0.12), ("Rating", 0.22)]
    x = pg.x0
    for name, f in cols:
        label(c, x + 2, y - 10, name, 6)
        x += pg.w * f
    hline(c, pg.x0, pg.x1, y - 15, INK, 0.9)
    yy = y - 15
    for r in range(14):
        yy -= 19
        hline(c, pg.x0, pg.x1, yy, RULE)
    y = yy - 22
    label(c, pg.x0, y, "What I've learned about this spot", 7, INK)
    lines(c, pg.x0, pg.x1, y - 2, int((y - pg.y0 - 10) / 20), 20)


# ---- Quiver --------------------------------------------------------------------------

def board_outline(c, cx, y0, y1, maxw):
    """A faint generic surfboard outline as a drawing guide (top view)."""
    L = y1 - y0
    p = c.beginPath()
    steps = 60
    pts = []
    for i in range(steps + 1):
        t = i / steps
        # width profile: narrow nose, wide just forward of middle, squash tail
        if t < 0.45:
            wv = maxw / 2 * (1 - ((0.45 - t) / 0.45) ** 2) ** 0.62
        else:
            wv = maxw / 2 * (1 - ((t - 0.45) / 0.62) ** 2) ** 0.5
        pts.append((wv, y1 - L * t))
    p.moveTo(cx, y1)
    for wv, yy in pts:
        p.lineTo(cx + wv, yy)
    p.lineTo(cx - pts[-1][0], y0)
    for wv, yy in reversed(pts):
        p.lineTo(cx - wv, yy)
    p.close()
    c.setStrokeColor(HAIR)
    c.setLineWidth(0.8)
    c.setDash(2, 2)
    c.drawPath(p, stroke=1, fill=0)
    c.line(cx, y0 + 2, cx, y1 - 2)
    c.setDash()


def p_board(c, pg, i):
    y = section_head(c, pg, f"Quiver {i:02d} / {BOARDS:02d}", "The quiver")
    y -= 22
    left_w = pg.w * 0.6
    gx = pg.x0 + left_w + 14
    top = y
    for name in ["Name / nickname", "Shaper / brand", "Model", "Length", "Width", "Thickness", "Volume (L)",
                 "Construction", "Got it (date / where)"]:
        field(c, pg.x0, y, left_w, name)
        y -= 21
    y -= 2
    label(c, pg.x0, y, "Fins", 6.6)
    xx = pg.x0 + 30
    for t in ["Single", "Twin", "Thruster", "Quad", "5-fin"]:
        checkbox(c, xx, y - 1, 6.5)
        text(c, xx + 9, y, t, "Sans", 7.8)
        xx += 15 + pdfmetrics.stringWidth(t, "Sans", 7.8)
    y -= 17
    label(c, pg.x0, y, "Tail", 6.6)
    xx = pg.x0 + 30
    for t in ["Squash", "Round", "Pin", "Swallow", "Square"]:
        checkbox(c, xx, y - 1, 6.5)
        text(c, xx + 9, y, t, "Sans", 7.8)
        xx += 15 + pdfmetrics.stringWidth(t, "Sans", 7.8)
    y -= 22
    # board outline drawing area on the right
    board_outline(c, gx + (pg.x1 - gx) / 2, y + 6, top + 8, (pg.x1 - gx) * 0.78)
    label(c, gx + (pg.x1 - gx) / 2, y - 6, "Sketch it / mark dings", 5.6, SLATE, "center")
    y -= 22
    label(c, pg.x0, y, "Best in", 7, INK)
    y -= 18
    field(c, pg.x0, y, pg.w * 0.48, "Size range", 6.2)
    field(c, pg.x0 + pg.w * 0.52, y, pg.w * 0.48, "Wave type", 6.2)
    y -= 20
    label(c, pg.x0, y, "Magic sessions on this board (session no.)", 6.6)
    y = lines(c, pg.x0, pg.x1, y - 2, 1, 18) - 22
    label(c, pg.x0, y, "Ding & repair log", 7, INK)
    y -= 6
    for name, f in [("Date", 0.18), ("What happened", 0.56), ("Fixed by", 0.26)]:
        pass
    x = pg.x0
    for name, f in [("Date", 0.18), ("What happened", 0.56), ("Fixed by", 0.26)]:
        label(c, x, y - 8, name, 5.8, SLATE)
        x += pg.w * f
    y -= 12
    n = int((y - pg.y0 - 4) / 19)
    lines(c, pg.x0, pg.x1, y, n, 19)


def p_gear(c, pg):
    y = section_head(c, pg, "Quiver", "Wetsuits & gear")
    y -= 14
    cols = [("Suit / item", 0.34), ("Thickness", 0.16), ("Bought", 0.16), ("Water temp range", 0.34)]
    x = pg.x0
    for name, f in cols:
        label(c, x + 2, y - 8, name, 6)
        x += pg.w * f
    hline(c, pg.x0, pg.x1, y - 13, INK, 0.9)
    yy = y - 13
    for r in range(9):
        yy -= 20
        hline(c, pg.x0, pg.x1, yy)
    y = yy - 26
    label(c, pg.x0, y, "Surf trip / car kit checklist", 7, INK)
    items = ["Boards + spare fins", "Fin key / screws", "Wax + comb", "Leash (+ spare)", "Wetsuit", "Boots / gloves / hood",
             "Changing robe / towel", "Water + snack", "Ding repair kit", "Sun cream / zinc", "Earplugs", "First-aid kit",
             "Car key pouch", "This log + a pen", "", ""]
    y -= 18
    colw = pg.w / 2
    for k, it in enumerate(items):
        cx = pg.x0 + (k % 2) * colw
        cy = y - (k // 2) * 19
        checkbox(c, cx, cy - 1, 7)
        if it:
            text(c, cx + 12, cy, it, "Sans", 8.6)
        else:
            hline(c, cx + 12, cx + colw - 12, cy - 1)


# ---- Session page -------------------------------------------------------------------

def p_session(c, pg, n):
    x0, x1, w = pg.x0, pg.x1, pg.w
    y = pg.y1
    # Header
    text(c, x0, y - 22, "SESSION", "Display", 21, INK)
    sw = pdfmetrics.stringWidth("SESSION", "Display", 21)
    text(c, x0 + sw + 8, y - 22, f"{n:03d}", "Mono-Bd", 15, FOG)
    # Date + day of week
    label(c, x1 - 108, y - 7, "Date", 6.2)
    hline(c, x1 - 108, x1, y - 22)
    days = "MTWTFSS"
    for k, d in enumerate(days):
        cx = x1 - 108 + 7 + k * 15.6
        circle(c, cx, y - 32, 5.2, RULE, 0.5)
        text(c, cx, y - 34.2, d, "Mono", 5.6, SLATE, "center")
    hline(c, x0, x1, y - 42, INK, 1.6)
    y -= 42

    # Spot / time
    y -= 20
    field(c, x0, y, w * 0.6, "Spot")
    xx = x0 + w * 0.64
    lw = label(c, xx, y + 2, "In", 6.6)
    hline(c, xx + lw + 4, xx + lw + 30, y)
    xx2 = xx + lw + 38
    lw2 = label(c, xx2, y + 2, "Out", 6.6)
    hline(c, xx2 + lw2 + 4, x1, y)
    y -= 19
    field(c, x0, y, w * 0.6, "Surfed with")
    field(c, x0 + w * 0.64, y, w * 0.36, "Hours")
    y -= 14

    # Forecast vs reality
    th_h = 15
    row_h = 19.5
    rows = ["Wave size (ft)", "Swell period (s)", "Swell direction", "Wind (dir / mph)", "Rating"]
    tbl_h = th_h + row_h * len(rows) + 21
    panel(c, x0, y - tbl_h, w, tbl_h, TINT)
    c1 = x0 + w * 0.31
    c2 = x0 + w * 0.655
    c.setFillColor(INK)
    c.roundRect(x0, y - th_h, w, th_h, 3, stroke=0, fill=1)
    c.rect(x0, y - th_h, w, 4, stroke=0, fill=1)
    label(c, x0 + 7, y - 10.5, "Forecast vs reality", 6.4, CHALK)
    label(c, c1 + 7, y - 10.5, "Forecast said", 6.4, CHALK)
    label(c, c2 + 7, y - 10.5, "What I got", 6.4, CHALK)
    yy = y - th_h
    for k, r in enumerate(rows):
        yb = yy - row_h * (k + 1)
        text(c, x0 + 7, yb + 6.5, r, "Sans-Md", 8, INK)
        if r == "Rating":
            flags_rating(c, c1 + 9, yb + 4.5, 9.5, 6.5)
            flags_rating(c, c2 + 9, yb + 4.5, 9.5, 6.5)
        else:
            hline(c, c1 + 7, c2 - 9, yb + 5)
            hline(c, c2 + 7, x1 - 8, yb + 5)
        if k < len(rows) - 1:
            hline(c, x0 + 5, x1 - 5, yb, HAIR, 0.4)
    c.setStrokeColor(HAIR)
    c.setLineWidth(0.4)
    c.line(c1, yy - 2, c1, yy - row_h * len(rows) + 2)
    c.line(c2, yy - 2, c2, yy - row_h * len(rows) + 2)
    vb = y - tbl_h + 7
    hline(c, x0 + 5, x1 - 5, vb + 13, INK, 0.6)
    label(c, x0 + 7, vb, "Verdict", 6.4, INK)
    xx = x0 + 52
    for t in ["Called it", "Close", "Way off"]:
        checkbox(c, xx, vb - 1, 7)
        text(c, xx + 11, vb, t, "Sans-SB", 8.2)
        xx += 22 + pdfmetrics.stringWidth(t, "Sans-SB", 8.2) + 10
    y -= tbl_h + 12

    # Tide + compass
    blk_h = 1.32 * IN
    tw = w * 0.56
    label(c, x0, y - 6, "Tide", 6.6, INK)
    xx = x0 + 28
    for t in ["Rising", "Falling", "Springs", "Neaps"]:
        checkbox(c, xx, y - 7, 6)
        text(c, xx + 8.5, y - 6, t, "Sans", 7.2, SLATE)
        xx += 14 + pdfmetrics.stringWidth(t, "Sans", 7.2)
    tide_curve(c, x0, y - blk_h + 14, tw - 4, blk_h - 40)
    label(c, x0, y - blk_h + 2 - 6, "Bracket your time in the water", 5.6, SLATE)
    r = 0.42 * IN
    ccx = x0 + tw + (w - tw) / 2 + 4
    ccy = y - 6 - (blk_h - 6) / 2 + 2
    compass(c, ccx, ccy, r)
    label(c, x1, y - 6, "Swell: solid / Wind: dashed", 5.6, SLATE, "right")
    label(c, x1, y - blk_h + 2 - 6, "Draw the arrows", 5.6, SLATE, "right")
    y -= blk_h + 14

    # Kit
    hline(c, x0, x1, y + 6, HAIR, 0.5)
    y -= 8
    lw = label(c, x0, y, "Water", 6.6)
    hline(c, x0 + lw + 4, x0 + lw + 26, y - 2)
    text(c, x0 + lw + 28, y, "°", "Sans", 9)
    xa = x0 + lw + 40
    lw = label(c, xa, y, "Air", 6.6)
    hline(c, xa + lw + 4, xa + lw + 26, y - 2)
    text(c, xa + lw + 28, y, "°", "Sans", 9)
    xs = xa + lw + 44
    label(c, xs, y, "Suit", 6.6)
    xx = xs + 22
    for t in ["3/2", "4/3", "5/4", "6/5", "Boots", "Gloves", "Hood"]:
        checkbox(c, xx, y - 1, 6)
        text(c, xx + 8, y, t, "Sans", 7.2)
        xx += 13 + pdfmetrics.stringWidth(t, "Sans", 7.2)
    y -= 20
    field(c, x0, y, w * 0.5, "Board")
    field(c, x0 + w * 0.54, y, w * 0.46, "Fins")
    y -= 20
    lw = label(c, x0, y, "Crowd", 6.6)
    for k in range(5):
        circle(c, x0 + lw + 10 + k * 11, y + 2.4, 3.6, INK, 0.6)
    label(c, x0 + lw + 66, y, "Waves", 6.6)
    hline(c, x0 + lw + 94, x0 + lw + 118, y - 2)
    sx = x0 + w * 0.6
    lw = label(c, sx, y, "Stoke", 6.6)
    flags_rating(c, sx + lw + 8, y - 1.5, 9.5, 6)
    y -= 12

    # Notes
    hline(c, x0, x1, y, INK, 0.9)
    y -= 14
    for name, n_ in [("Best wave", 2), ("Worked on", 1), ("Next time", 1)]:
        label(c, x0, y, name, 6.6, INK)
        y = lines(c, x0 + 58, x1, y + 15, n_, 18) - 2
        y -= 12 if n_ == 1 else 12
    n_lines = int((y - pg.y0 + 2) / 18)
    lines(c, x0, x1, y + 15, n_lines, 18)


# ---- Monthly review / trackers ------------------------------------------------------

def p_month(c, pg, m):
    y = section_head(c, pg, f"Review {m:02d} / 12", "Monthly review")
    y -= 22
    field(c, pg.x0, y, pg.w * 0.46, "Month")
    field(c, pg.x0 + pg.w * 0.5, y, pg.w * 0.5, "Sessions logged (no.)")
    y -= 20
    # Day strip
    label(c, pg.x0, y - 4, "Days in the water \u2014 write the rating (1\u20135) in each day you surfed", 6.2, INK)
    y -= 12
    cw = pg.w / 16
    for d in range(31):
        row, col = divmod(d, 16)
        cx = pg.x0 + col * cw
        cy = y - row * (cw + 2) - cw
        c.setStrokeColor(RULE)
        c.setLineWidth(0.5)
        c.rect(cx + 1, cy, cw - 2, cw - 2, stroke=1, fill=0)
        text(c, cx + 3, cy + cw - 8.5, str(d + 1), "Mono", 5, FOG)
    y -= 2 * (cw + 2) + 16

    # Stats grid
    stats = [("Sessions", ""), ("Hours", ""), ("Waves", ""), ("Best day", "")]
    sw = pg.w / 4
    for k, (s, _) in enumerate(stats):
        sx = pg.x0 + k * sw
        panel(c, sx + 1.5, y - 40, sw - 3, 40)
        label(c, sx + 8, y - 11, s, 6, SLATE)
    y -= 54
    # Forecast scorecard for the month
    label(c, pg.x0, y, "Forecast verdicts this month", 6.8, INK)
    y -= 18
    xx = pg.x0
    for t in ["Called it", "Close", "Way off"]:
        text(c, xx, y, t, "Sans-SB", 8.4)
        hline(c, xx + pdfmetrics.stringWidth(t, "Sans-SB", 8.4) + 5, xx + pg.w / 3 - 12, y - 2)
        xx += pg.w / 3
    y -= 24
    for name in ["Best session (no. & why)", "Best spot / tide / wind combo", "Board that went best"]:
        field(c, pg.x0, y, pg.w, name)
        y -= 21
    y -= 6
    for name, n in [("Wins", 2), ("Biggest lesson", 3), ("Goal for next month", 2), ("Month in one line", 1)]:
        label(c, pg.x0, y, name, 7, INK)
        y = lines(c, pg.x0, pg.x1, y - 2, n, 20) - 18


def p_year(c, pg):
    y = section_head(c, pg, "Year at a glance", "The year in surf")
    text(c, pg.x0, y - 15, "Shade each day you surfed. Darker = better: match the 1\u20135 rating.", "Sans", 8.4, SLATE)
    y -= 30
    lab_w = 20
    cw = (pg.w - lab_w) / 31
    label(c, pg.x0, y - 4, "", 5)
    for d in range(31):
        if d % 2 == 0:
            text(c, pg.x0 + lab_w + d * cw + cw / 2, y - 4, str(d + 1), "Mono", 4.8, SLATE, "center")
    y -= 8
    months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
    days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    rh = cw * 1.6
    for m, (ml, nd) in enumerate(zip(months, days)):
        yy = y - (m + 1) * rh
        text(c, pg.x0 + 4, yy + rh / 2 - 3, ml, "Mono-Bd", 7, INK)
        for d in range(31):
            c.setStrokeColor(RULE if d < nd else TINT)
            c.setLineWidth(0.45)
            c.setFillColor(white if d < nd else TINT)
            c.rect(pg.x0 + lab_w + d * cw + 0.6, yy + 0.6, cw - 1.2, rh - 1.2, stroke=1, fill=1)
    y -= 12 * rh + 20
    # legend
    label(c, pg.x0, y, "Key", 6.4, INK)
    shades = [HexColor("#E6E8E6"), HexColor("#BFC6C7"), HexColor("#8E9A9C"), HexColor("#4A5459"), INK]
    for k, s in enumerate(shades):
        c.setFillColor(s)
        c.rect(pg.x0 + 30 + k * 40, y - 2, 10, 10, stroke=0, fill=1)
        text(c, pg.x0 + 44 + k * 40, y, str(k + 1), "Mono", 7)
    y -= 30
    stats = ["Total sessions", "Total hours", "Most-surfed spot", "Longest streak", "Best month", "Coldest session"]
    sw = pg.w / 2
    for k, s in enumerate(stats):
        sx = pg.x0 + (k % 2) * sw
        sy = y - (k // 2) * 26
        field(c, sx, sy, sw - 14, s)
    y -= 3 * 26 + 10
    label(c, pg.x0, y, "Spots this year", 7, INK)
    y -= 8
    x = pg.x0
    for name, f in [("Spot", 0.5), ("Sessions", 0.18), ("Best rating", 0.32)]:
        label(c, x + 2, y - 8, name, 6, SLATE)
        x += pg.w * f
    hline(c, pg.x0, pg.x1, y - 12, INK, 0.9)
    y -= 12
    lines(c, pg.x0, pg.x1, y, int((y - pg.y0) / 19), 19)


def p_scorecard(c, pg):
    y = section_head(c, pg, "Trust, but verify", "Forecast scorecard")
    text(c, pg.x0, y - 15, "Mark each verdict:  \u2713 called it   ~ close   \u00d7 way off", "Mono", 7.4, SLATE)
    y -= 28
    cols = 10
    rows = SESSIONS // cols
    cw = pg.w / cols
    ch = 23
    for r in range(rows):
        for k in range(cols):
            n = r * cols + k + 1
            cx = pg.x0 + k * cw
            cy = y - (r + 1) * ch
            c.setStrokeColor(RULE)
            c.setLineWidth(0.45)
            c.rect(cx + 0.8, cy + 0.8, cw - 1.6, ch - 1.6, stroke=1, fill=0)
            text(c, cx + 3, cy + ch - 7.5, f"{n:03d}", "Mono", 4.8, FOG)
    y -= rows * ch + 22
    panel(c, pg.x0, y - 98, pg.w, 98)
    label(c, pg.x0 + 10, y - 16, "Season hit rate", 7, INK)
    xx = pg.x0 + 10
    for t in ["✓ total", "~ total", "× total"]:
        field(c, xx, y - 38, pg.w / 3 - 18, t)
        xx += pg.w / 3 - 4
    text(c, pg.x0 + 10, y - 62, "Hit rate = (\u2713 + half of ~) \u00f7 sessions \u00d7 100 =", "Mono-Md", 7.6)
    hline(c, pg.x1 - 70, pg.x1 - 24, y - 64)
    text(c, pg.x1 - 12, y - 62, "%", "Sans-Bd", 9, INK, "right")
    text(c, pg.x0 + 10, y - 84, "Where is it most often wrong — which spot, which wind?", "Sans", 8, SLATE)


def p_index(c, pg, start, count):
    y = section_head(c, pg, f"Sessions {start:03d}–{start + count - 1:03d}", "Session index")
    y -= 6
    cols = [("No.", 0.11), ("Date", 0.17), ("Spot", 0.44), ("Board", 0.16), ("Rating", 0.12)]
    x = pg.x0
    for name, f in cols:
        label(c, x + 2, y - 8, name, 6)
        x += pg.w * f
    hline(c, pg.x0, pg.x1, y - 12, INK, 0.9)
    rh = (y - 12 - pg.y0) / count
    for k in range(count):
        yy = y - 12 - (k + 1) * rh
        text(c, pg.x0 + 2, yy + 4, f"{start + k:03d}", "Mono", 7, FOG)
        hline(c, pg.x0, pg.x1, yy, RULE, 0.45)


def p_top_waves(c, pg):
    y = section_head(c, pg, "Hall of fame", "Ten best waves")
    y -= 12
    rh = (y - pg.y0 - 70) / 10
    for k in range(10):
        yy = y - k * rh
        text(c, pg.x0, yy - 18, f"{k + 1:02d}", "Display", 15, INK if k == 0 else FOG)
        field(c, pg.x0 + 34, yy - 16, pg.w * 0.62 - 34, "Spot / wave")
        field(c, pg.x0 + pg.w * 0.66, yy - 16, pg.w * 0.34, "Session")
        hline(c, pg.x0 + 34, pg.x1, yy - rh + 10, RULE)
    y = pg.y0 + 52
    panel(c, pg.x0, pg.y0, pg.w, 56)
    label(c, pg.x0 + 10, pg.y0 + 40, "The one that got away", 6.8, INK)
    hline(c, pg.x0 + 10, pg.x1 - 10, pg.y0 + 14)


def p_trip(c, pg, i):
    y = section_head(c, pg, f"Trip {i:02d}", "Surf trip")
    y -= 22
    field(c, pg.x0, y, pg.w * 0.6, "Destination")
    field(c, pg.x0 + pg.w * 0.64, y, pg.w * 0.36, "Dates")
    y -= 21
    field(c, pg.x0, y, pg.w * 0.6, "Crew")
    field(c, pg.x0 + pg.w * 0.64, y, pg.w * 0.36, "Sessions no.")
    y -= 21
    field(c, pg.x0, y, pg.w * 0.48, "Water temp / suit")
    field(c, pg.x0 + pg.w * 0.52, y, pg.w * 0.48, "Boards taken")
    y -= 26
    half = (pg.w - 14) / 2
    panel(c, pg.x0, y - 2.0 * IN, half, 2.0 * IN)
    panel(c, pg.x0 + half + 14, y - 2.0 * IN, half, 2.0 * IN)
    label(c, pg.x0 + 8, y - 13, "Spots to check", 6.6, INK)
    label(c, pg.x0 + half + 22, y - 13, "Best swell & wind", 6.6, INK)
    lines(c, pg.x0 + 8, pg.x0 + half - 8, y - 14, 6, 19)
    compass(c, pg.x0 + half + 14 + half / 2, y - 1.05 * IN, 0.55 * IN)
    y -= 2.0 * IN + 20
    for name, n in [("Highlights", 4), ("Lessons / would do differently", 3)]:
        label(c, pg.x0, y, name, 7, INK)
        y = lines(c, pg.x0, pg.x1, y - 2, n, 20) - 18
    label(c, pg.x0, y, "Rate the trip", 7, INK)
    flags_rating(c, pg.x0 + 70, y - 2, 11, 7)
    y -= 26
    label(c, pg.x0, y, "Notes", 7, INK)
    lines(c, pg.x0, pg.x1, y - 2, int((y - 2 - pg.y0) / 20), 20)


def p_notes(c, pg, title="Notes", kicker="Sketches, maps, ideas"):
    y = section_head(c, pg, kicker, title)
    dot_grid(c, pg.x0, pg.y0, pg.x1, y - 12)


def p_closing(c, pg):
    pg.full_bleed(INK)
    swell_lines(c, -10, -0.2 * IN, PAGE_W + 10, pg.ty0 + TRIM_H * 0.4, n=20, seed=99,
                color=SEAFOAM, width=0.9, highlight=15, hl_color=CHALK, hl_width=1.1)
    x = pg.x0
    yy = pg.ty1 - 2.3 * IN
    for line in ["Full book?", "Start the next."]:
        text(c, x, yy, line, "Display", 28, CHALK)
        yy -= 34
    yy -= 8
    for line in ["Every page in here is a day you chose the sea.",
                 "Keep the log going — the patterns get clearer",
                 "with every season you add."]:
        text(c, x, yy, line, "Sans", 10, SEAFOAM)
        yy -= 15
    logo(c, x, pg.ty0 + TRIM_H * 0.47, 22, light=True)


# =====================================================================================
# Book assembly
# =====================================================================================

def build_plan():
    """Return the ordered list of (draw_fn, args, section) and a TOC."""
    plan = []
    toc = []

    def add(fn, *args, section=""):
        plan.append((fn, args, section))

    def recto():
        # Next page index is len(plan)+1; make sure it is odd (right-hand).
        if (len(plan) + 1) % 2 == 0:
            add(p_notes, section="Notes")

    add(p_half_title)
    add(p_copyright)
    add(p_belongs)
    add(p_contents, None)  # filled later
    add(p_how_to, section="Start here")
    add(p_season, section="Start here")

    recto()
    toc.append(("01", "Field guide", "Swell, wind, tide, ratings, wetsuits, etiquette, safety", len(plan) + 1))
    add(p_divider, "01", "Field\nguide", "Seven pages on reading the sea —\nso the log makes more sense.")
    for fn in [p_guide_swell, p_guide_wind, p_guide_tide, p_guide_rating, p_guide_wetsuit, p_guide_etiquette, p_guide_safety]:
        add(fn, section="Field guide")
    add(p_ladder, section="Progression")

    recto()
    toc.append(("02", "Spot files", f"{SPOTS} spot dossiers: the recipe for each of your breaks", len(plan) + 1))
    add(p_divider, "02", "Spot\nfiles", "Every break has a recipe.\nWrite yours down.")
    for i in range(1, SPOTS + 1):
        add(p_spot, i, section="Spot files")
        if i == 1:
            globals()["SPOT_PAGE"] = len(plan)
        add(p_spot_notes, i, section="Spot files")

    recto()
    toc.append(("03", "The quiver", f"{BOARDS} board pages, wetsuits, gear and trip checklist", len(plan) + 1))
    add(p_divider, "03", "The\nquiver", "Boards, rubber and the kit\nthat lives in the car.")
    for i in range(1, BOARDS + 1):
        add(p_board, i, section="Quiver")
    add(p_gear, section="Quiver")

    recto()
    toc.append(("04", "Session log", f"{SESSIONS} sessions with forecast vs reality, plus monthly reviews", len(plan) + 1))
    add(p_divider, "04", "Session\nlog", f"{SESSIONS} sessions. Forecast first,\nreality after. Be honest.")
    per_month = SESSIONS // 12
    s = 1
    for m in range(1, 13):
        for _ in range(per_month):
            add(p_session, s, section="Session log")
            if s == 1:
                globals()["SESSION_PAGE"] = len(plan)
            s += 1
        add(p_month, m, section="Monthly review")

    recto()
    toc.append(("05", "The season", "Year in surf, forecast scorecard, index, best waves, trips", len(plan) + 1))
    add(p_divider, "05", "The\nseason", "Zoom out. The patterns are\nwhere the lessons hide.")
    add(p_year, section="The season")
    add(p_scorecard, section="The season")
    for st in range(1, SESSIONS + 1, 40):
        add(p_index, st, 40, section="Index")
    add(p_top_waves, section="The season")
    add(p_trip, 1, section="Trips")
    add(p_trip, 2, section="Trips")
    add(p_trip, 3, section="Trips")
    for _ in range(4):
        add(p_notes, section="Notes")
    # Closing page should be a left-hand page so it ends the book facing the back cover.
    if (len(plan) + 1) % 2 == 1:
        add(p_notes, section="Notes")
    add(p_closing)
    return plan, toc


def build_interior(path):
    plan, toc = build_plan()
    c = canvas.Canvas(path, pagesize=(PAGE_W, PAGE_H), initialFontName="Sans", initialFontSize=9)
    c.setTitle("SVRF Surf Log")
    c.setAuthor("SVRF")
    c.setSubject("A session journal for reading the sea")
    c.setCreator("SVRF")
    for idx, (fn, args, section) in enumerate(plan, start=1):
        pg = Page(c, idx)
        if fn is p_contents:
            fn(c, pg, toc)
        else:
            fn(c, pg, *args)
        no_footer = fn in (p_half_title, p_copyright, p_divider, p_closing)
        if not no_footer:
            footer(c, pg, section)
        c.showPage()
    c.save()
    return len(plan)


# =====================================================================================
# Cover
# =====================================================================================

def build_cover(path, pages):
    spine = pages * 0.002252 * IN  # KDP white paper
    W = 2 * TRIM_W + spine + 2 * BLEED
    H = TRIM_H + 2 * BLEED
    c = canvas.Canvas(path, pagesize=(W, H), initialFontName="Sans", initialFontSize=9)
    c.setTitle("SVRF Surf Log — cover")
    c.setFillColor(INK)
    c.rect(0, 0, W, H, stroke=0, fill=1)

    back_x0 = BLEED
    spine_x0 = BLEED + TRIM_W
    front_x0 = spine_x0 + spine
    safe = 0.375 * IN

    # --- Front ---
    fx, fy = front_x0, BLEED
    swell_lines(c, front_x0, fy + 1.3 * IN, W, fy + TRIM_H * 0.44, n=19, seed=11, color=SEAFOAM,
                width=1.0, highlight=15, hl_color=FLAG, hl_width=1.25, amp=1.0)
    logo(c, fx + safe + 0.05 * IN, fy + TRIM_H - safe - 0.45 * IN, 0.42 * IN, light=True)
    tx = fx + safe + 0.05 * IN
    text(c, tx, fy + TRIM_H * 0.735, "SURF", "Display", 104, CHALK, tracking=-1)
    text(c, tx, fy + TRIM_H * 0.735 - 92, "LOG", "Display", 104, CHALK, tracking=-1)
    # orange bar + subtitle
    c.setFillColor(FLAG)
    c.rect(tx, fy + TRIM_H * 0.735 - 120, 0.6 * IN, 5, stroke=0, fill=1)
    text(c, tx, fy + TRIM_H * 0.735 - 144, "A session journal for reading the sea", "Sans-Md", 13.5, CHALK)
    text(c, tx, fy + TRIM_H * 0.735 - 163, "Forecast vs reality · Spot files · Quiver · Field guide",
         "Sans", 10.5, SEAFOAM)
    # bottom data strip
    by = fy + safe + 0.18 * IN
    stats = [("120", "Sessions"), ("08", "Spot files"), ("06", "Boards"), ("12", "Reviews")]
    sw = (TRIM_W - 2 * safe - 0.1 * IN) / 4
    for k, (n, l) in enumerate(stats):
        sx = tx + k * sw
        text(c, sx, by + 14, n, "Mono-Bd", 15, CHALK)
        label(c, sx, by, l, 6.6, FOG)
    hline(c, tx, fx + TRIM_W - safe - 0.05 * IN, by + 36, HexColor("#3A4347"), 0.8)

    # --- Spine ---
    c.saveState()
    c.translate(spine_x0 + spine / 2, BLEED + TRIM_H / 2)
    c.rotate(-90)
    # reading top-to-bottom (US/UK convention)
    size = min(13, spine * 0.48)
    tw = pdfmetrics.stringWidth("SURF LOG", "Display", size)
    total = tw + 30 + pdfmetrics.stringWidth("SVRF", "Mono-Bd", size * 0.7)
    sx = -total / 2
    text(c, sx, -size * 0.36, "SURF LOG", "Display", size, CHALK)
    c.setFillColor(FLAG)
    c.rect(sx + tw + 10, -size * 0.36 + size * 0.05, 10, size * 0.6, stroke=0, fill=1)
    text(c, sx + tw + 30, -size * 0.27, "SVRF", "Mono-Bd", size * 0.7, SEAFOAM, tracking=1)
    c.restoreState()

    # --- Back ---
    bx = back_x0 + safe + 0.1 * IN
    bw = TRIM_W - 2 * safe - 0.2 * IN
    ytop = BLEED + TRIM_H - safe - 0.25 * IN
    c.setFillColor(FLAG)
    c.rect(bx, ytop - 8, 0.6 * IN, 5, stroke=0, fill=1)
    yy = ytop - 58
    for line in ["Log it. Learn it.", "Call it."]:
        text(c, bx, yy, line, "Display", 24, CHALK)
        yy -= 29
    yy -= 6
    blurb = ("The forecast said four foot and clean. You got two foot and onshore — or the session of your life. "
             "The SVRF Surf Log is built around that gap. Write the forecast before you paddle out, log what you "
             "actually got, and give it a verdict. A season later you'll know your spots, your boards and your "
             "forecasts better than any app ever could.")
    bst = ParagraphStyle("b", fontName="Sans", fontSize=9.6, leading=14.2, textColor=SEAFOAM)
    p = Paragraph(blurb, bst)
    _, ph = p.wrap(bw, 400)
    p.drawOn(c, bx, yy - ph + 6)
    yy -= ph + 14
    feats = [
        ("120", "session pages — forecast vs reality, tide, wind & swell compass, kit, stoke"),
        ("12", "monthly reviews and a year-at-a-glance tracker"),
        ("8", "spot files to map each break's swell, wind and tide recipe"),
        ("6", "quiver pages, plus wetsuit log and car-kit checklist"),
        ("7", "field-guide pages: period, wind, tide, wetsuits, etiquette, safety"),
        ("+", "forecast scorecard, session index, ten best waves, trip planners"),
    ]
    fst = ParagraphStyle("f", fontName="Sans", fontSize=8.6, leading=11.6, textColor=CHALK)
    for n, s in feats:
        text(c, bx, yy - 9, n, "Mono-Bd", 9, FLAG)
        p = Paragraph(s, fst)
        _, ph = p.wrap(bw - 32, 200)
        p.drawOn(c, bx + 32, yy - ph + 1)
        yy -= ph + 7
    # Look inside: thumbnails of two interior pages.
    thumbs = getattr(build_cover, "thumbs", [])
    th_h = 2.35 * IN
    th_w = th_h * PAGE_W / PAGE_H
    ty = BLEED + safe + 1.12 * IN
    for k, (img, cap) in enumerate(thumbs):
        tx_ = bx + k * (th_w + 0.18 * IN)
        c.setFillColor(HexColor("#000000"))
        c.rect(tx_ + 3, ty - 3, th_w, th_h, stroke=0, fill=1)
        c.drawImage(img, tx_, ty, th_w, th_h)
        label(c, tx_, ty - 13, cap, 6, FOG)
    # Bottom: details. The lower right (2 x 1.2 in + margin) is left empty for KDP's barcode.
    label(c, bx, BLEED + safe + 0.42 * IN, "6 x 9 in · Durable matte cover", 6.6, FOG)
    label(c, bx, BLEED + safe + 0.26 * IN, "Made for cold mornings and car parks", 6.6, FOG)
    logo(c, bx, BLEED + safe + 0.58 * IN, 0.2 * IN, light=True)

    c.save()
    return W, H, spine


def rasterize(pdf, png, jpg_front=None, dpi=300, front_box=None):
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(pdf)
    page = doc[0]
    img = page.render(scale=dpi / 72).to_pil().convert("RGB")
    img.save(png, dpi=(dpi, dpi))
    if jpg_front and front_box:
        x0, y0, x1, y1 = [int(round(v * dpi / 72)) for v in front_box]
        img.crop((x0, y0, x1, y1)).save(jpg_front, quality=95, dpi=(dpi, dpi))
    return img.size


SESSION_PAGE = None
SPOT_PAGE = None


def page_thumbs(pdf, pages):
    """Render interior pages (trimmed to the 6 x 9 trim box) as images for the back cover."""
    import pypdfium2 as pdfium
    from reportlab.lib.utils import ImageReader
    doc = pdfium.PdfDocument(pdf)
    out = []
    for n, cap in pages:
        im = doc[n - 1].render(scale=300 / 72).to_pil().convert("RGB")
        out.append((ImageReader(im), cap))
    return out


def strip_unused_base14(path):
    """ReportLab lists Helvetica in every page's resources even when nothing uses it. KDP wants every font
    embedded, so drop any non-embedded font resource that no content stream references."""
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject
    r = PdfReader(path)
    w = PdfWriter(clone_from=r)
    removed = 0
    for page in w.pages:
        fonts = page["/Resources"].get("/Font")
        if not fonts:
            continue
        fonts = fonts.get_object()
        data = page.get_contents().get_data() if page.get_contents() else b""
        for key in list(fonts.keys()):
            fo = fonts[key].get_object()
            if "/FontDescriptor" in fo or "/DescendantFonts" in fo:
                continue
            if (key + " ").encode() not in data:
                del fonts[NameObject(key)]
                removed += 1
    w.write(path)
    return removed


def main():
    global ST
    reg_fonts()
    ST = styles()
    os.makedirs(OUT, exist_ok=True)
    interior = os.path.join(OUT, "svrf-surf-log-interior.pdf")
    pages = build_interior(interior)
    strip_unused_base14(interior)
    build_cover.thumbs = page_thumbs(interior, [(SESSION_PAGE, "Session page"), (SPOT_PAGE, "Spot file")])
    cover_pdf = os.path.join(OUT, "svrf-surf-log-cover.pdf")
    W, H, spine = build_cover(cover_pdf, pages)
    strip_unused_base14(cover_pdf)
    front_x0 = BLEED + TRIM_W + spine
    size = rasterize(cover_pdf, os.path.join(OUT, "svrf-surf-log-cover.png"),
                     os.path.join(OUT, "svrf-surf-log-front.jpg"),
                     front_box=(front_x0, BLEED, front_x0 + TRIM_W, BLEED + TRIM_H))
    print(f"interior: {pages} pages, page size {PAGE_W / IN:.3f} x {PAGE_H / IN:.3f} in")
    print(f"cover: {W / IN:.3f} x {H / IN:.3f} in, spine {spine / IN:.4f} in, png {size[0]} x {size[1]} px")


if __name__ == "__main__":
    main()
