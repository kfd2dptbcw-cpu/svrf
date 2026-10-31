"""Generate the SVRF sponsor logo pack as outlined SVGs (no font dependency)."""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

S = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
FONTS = os.path.join(S, "..", "..", "node_modules", "@fontsource")
os.makedirs(OUT, exist_ok=True)

INK, CHALK, FLAG, SLATE = "#0B0D0E", "#EFEEE7", "#FF4E1F", "#4A5459"


def load(woff):
    f = TTFont(woff)
    f.flavor = None
    ttf = os.path.join(OUT, os.path.basename(woff).replace(".woff", ".ttf"))
    f.save(ttf)
    f = TTFont(ttf)
    blob = hb.Blob.from_file_path(ttf)
    return f, hb.Font(hb.Face(blob))


ARCHIVO = load(f"{FONTS}/archivo-black/files/archivo-black-latin-400-normal.woff")
MONO = load(f"{FONTS}/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff")


def text_path(font, text, size, x, y, tracking=0.0):
    """Return (svg path d, advance width) for text with baseline at (x, y)."""
    tt, hbf = font
    upem = tt["head"].unitsPerEm
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbf, buf, {"kern": True, "liga": False})
    order = tt.getGlyphOrder()
    gs = tt.getGlyphSet()
    scale = size / upem
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    cx = 0
    n = len(buf.glyph_infos)
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        name = order[info.codepoint]
        ox = x + (cx + pos.x_offset) * scale
        oy = y - pos.y_offset * scale
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, ox, oy)))
        cx += pos.x_advance
        if i < n - 1:
            cx += tracking * upem
    return pen.getCommands(), cx * scale


def mark(x, y, h, pole, flag):
    """Flag mark from public/icon.svg, scaled so its pole is h tall, top-left at (x, y)."""
    u = h / 40.0
    return (
        f'<rect x="{x:.2f}" y="{y:.2f}" width="{6*u:.2f}" height="{40*u:.2f}" fill="{pole}"/>'
        f'<path d="M{x+6*u:.2f} {y:.2f}h{30*u:.2f}l{-8*u:.2f} {10*u:.2f} {8*u:.2f} {10*u:.2f}H{x+6*u:.2f}z" fill="{flag}"/>'
    ), 36 * u


def svg(w, h, body, bg=None):
    b = f'<rect width="{w:.0f}" height="{h:.0f}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
            f'width="{w:.0f}" height="{h:.0f}">{b}{body}</svg>\n')


CAP = 688 / 1000  # Archivo Black cap height / em
PAD = 120

# Colourways: (name, text/pole colour, flag colour, preview bg)
WAYS = [
    ("full-colour-dark-bg", CHALK, FLAG, INK),
    ("full-colour-light-bg", INK, FLAG, CHALK),
    ("mono-black", INK, INK, CHALK),
    ("mono-white", CHALK, CHALK, INK),
]


def primary(fg, fl):
    size = 600
    cap = size * CAP
    m, mw = mark(PAD, PAD, cap, fg, fl)
    gap = cap * 0.28
    d, adv = text_path(ARCHIVO, "SVRF", size, PAD + mw + gap, PAD + cap, tracking=0.01)
    return PAD * 2 + mw + gap + adv, PAD * 2 + cap, m + f'<path d="{d}" fill="{fg}"/>'


def stacked(fg, fl):
    size = 600
    cap = size * CAP
    _, adv = text_path(ARCHIVO, "SVRF", size, 0, 0, tracking=0.01)
    mh = cap * 1.25
    mw = 36 * mh / 40
    W = PAD * 2 + adv
    m, _ = mark(PAD + (adv - mw) / 2, PAD, mh, fg, fl)
    gap = cap * 0.35
    d, _ = text_path(ARCHIVO, "SVRF", size, PAD, PAD + mh + gap + cap, tracking=0.01)
    return W, PAD * 2 + mh + gap + cap, m + f'<path d="{d}" fill="{fg}"/>'


def icon(fg, fl, bg):
    # Square app-icon style mark on its tile, straight from public/icon.svg at 4096px.
    k = 4096 / 64
    body = (f'<rect width="4096" height="4096" rx="{8*k:.0f}" fill="{bg}"/>' +
            mark(12 * k, 12 * k, 40 * k, fg, fl)[0])
    return 4096, 4096, body


def wordmark(fg, accent):
    """Flag-free 'SVRF' wordmark as used in the site header. With an accent colour it
    gets the Flag Orange bar under the S from the iOS app icon."""
    size = 600
    cap = size * CAP
    x0 = PAD
    d, adv = text_path(ARCHIVO, "SVRF", size, x0, PAD + cap, tracking=0.01)
    body = f'<path d="{d}" fill="{fg}"/>'
    h = PAD * 2 + cap
    if accent:
        # Proportions measured from ios/.../AppIcon-512@2x.png (cap 170px: gap 47, bar 215 x 24).
        gap, bw, bh = cap * 47 / 170, cap * 215 / 170, cap * 24 / 170
        body += f'<rect x="{x0:.2f}" y="{PAD + cap + gap:.2f}" width="{bw:.2f}" height="{bh:.2f}" fill="{accent}"/>'
        h += gap + bh
    return PAD * 2 + adv, h, body


def sponsor(fg, fl, sub, flag=True):
    """SVRF (with or without the flag) + divider + 'PROUD SPONSOR OF / CORNWALL SURF ACADEMY'."""
    size = 600
    cap = size * CAP
    if flag:
        m, mw = mark(PAD, PAD, cap, fg, fl)
        gap = cap * 0.28
    else:
        m, mw, gap = "", 0, 0
    d, adv = text_path(ARCHIVO, "SVRF", size, PAD + mw + gap, PAD + cap, tracking=0.01)
    x = PAD + mw + gap + adv
    rule_x = x + cap * 0.42
    rule_w = cap * 0.035
    tx = rule_x + rule_w + cap * 0.42
    lsize = cap * 0.36
    msize = lsize * 0.62
    l1, a1 = text_path(MONO, "PROUD SPONSOR OF", msize, tx, PAD + msize * 0.73, tracking=0.12)
    l2, a2 = text_path(ARCHIVO, "CORNWALL", lsize, tx, PAD + cap * 0.64, tracking=0.02)
    l3, a3 = text_path(ARCHIVO, "SURF ACADEMY", lsize, tx, PAD + cap, tracking=0.02)
    W = tx + max(a1, a2, a3) + PAD
    body = (m + f'<path d="{d}" fill="{fg}"/>'
            f'<rect x="{rule_x:.2f}" y="{PAD:.2f}" width="{rule_w:.2f}" height="{cap:.2f}" fill="{fl}"/>'
            f'<path d="{l1}" fill="{sub}"/><path d="{l2}" fill="{fg}"/><path d="{l3}" fill="{fg}"/>')
    return W, PAD * 2 + cap, body


files = []
for name, fg, fl, bg in WAYS:
    sub = fl if fl != fg else fg
    for kind, fn in (("primary", lambda: primary(fg, fl)), ("stacked", lambda: stacked(fg, fl)),
                     ("sponsor-lockup", lambda: sponsor(fg, fl, sub)),
                     ("wordmark", lambda: wordmark(fg, fl if fl != fg else None)),
                     ("sponsor-lockup-no-flag", lambda: sponsor(fg, fl, sub, flag=False))):
        w, h, body = fn()
        p = f"{OUT}/svrf-{kind}-{name}.svg"
        open(p, "w").write(svg(w, h, body))
        files.append((p, w, h, bg))

for name, fg, fl, bg in (("full-colour", CHALK, FLAG, INK), ("light", INK, FLAG, CHALK)):
    w, h, body = icon(fg, fl, bg)
    p = f"{OUT}/svrf-icon-{name}.svg"
    open(p, "w").write(svg(w, h, body))
    files.append((p, w, h, None))

with open(f"{OUT}/.manifest", "w") as fh:
    for p, w, h, bg in files:
        fh.write(f"{p}\t{w:.0f}\t{h:.0f}\t{bg or ''}\n")
for t in os.listdir(OUT):
    if t.endswith(".ttf"):
        os.remove(os.path.join(OUT, t))
print(len(files), "svgs")
