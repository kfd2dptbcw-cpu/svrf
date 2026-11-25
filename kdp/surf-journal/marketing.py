"""
SVRF Surf Log: launch graphics for social posts and Amazon A+ content.

Run after build.py (it uses the built cover and interior):  python3 marketing.py
Writes PNGs to marketing/.
"""

from __future__ import annotations

import os

import pypdfium2 as pdfium
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

import build as B

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "marketing")
PRINT = os.path.join(HERE, "print")
INTERIOR = os.path.join(PRINT, "svrf-surf-log-interior.pdf")
FRONT = os.path.join(PRINT, "svrf-surf-log-front.jpg")

# Pages shown in the graphics (1-based page numbers in the interior).
SESSION_PAGE = 44
SPOT_PAGE = 18
GUIDE_PAGE = 8
QUIVER_PAGE = 36


def page_image(n, scale=3.0):
    """Render one interior page, cropped to the 6 x 9 trim (bleed removed)."""
    doc = pdfium.PdfDocument(INTERIOR)
    im = doc[n - 1].render(scale=scale).to_pil().convert("RGB")
    bleed = int(round(B.BLEED * scale))
    w, h = im.size
    left = 0 if n % 2 == 1 else bleed
    return im.crop((left, bleed, left + w - bleed, h - bleed))


def shadowed(c, img, x, y, w, h, shadow=10):
    c.setFillColor(HexColor("#000000"))
    c.setFillAlpha(0.45)
    c.rect(x + shadow * 0.6, y - shadow, w, h, stroke=0, fill=1)
    c.setFillAlpha(1)
    c.drawImage(img, x, y, w, h)


def new(name, w, h):
    path = os.path.join(OUT, name + ".pdf")
    c = canvas.Canvas(path, pagesize=(w, h), initialFontName="Sans", initialFontSize=9)
    c.setFillColor(B.INK)
    c.rect(0, 0, w, h, stroke=0, fill=1)
    return c, path


def finish(c, path, scale=1.0):
    c.save()
    doc = pdfium.PdfDocument(path)
    png = path[:-4] + ".png"
    doc[0].render(scale=scale).to_pil().convert("RGB").save(png)
    doc.close()
    os.remove(path)
    return png


def wordmark(c, x, y, size, color=B.CHALK):
    B.text(c, x, y, "SVRF", "Display", size, color, tracking=size * 0.03)


def bar(c, x, y, w=60, h=7):
    c.setFillColor(B.FLAG)
    c.rect(x, y, w, h, stroke=0, fill=1)


def headline(c, x, y, lines, size, color=B.CHALK, leading=1.05):
    for line in lines:
        B.text(c, x, y, line, "Display", size, color)
        y -= size * leading
    return y


def cover_img():
    return ImageReader(FRONT)


# ---- Graphics ---------------------------------------------------------------------

def launch_square():
    W = H = 1080
    c, path = new("01-launch-square", W, H)
    B.swell_lines(c, 0, -40, W, 430, n=18, seed=5, color=B.SEAFOAM, width=2.2, highlight=13, hl_color=B.FLAG,
                  hl_width=2.6)
    cw = 420
    ch = cw * 1.5
    shadowed(c, cover_img(), W - cw - 90, H - ch - 120, cw, ch, 18)
    wordmark(c, 80, H - 130, 46)
    bar(c, 80, H - 262, 70, 8)
    y = headline(c, 80, H - 380, ["OUT", "NOW"], 96)
    B.text(c, 80, y - 10, "The surf journal built around", "Sans-Md", 28, B.CHALK)
    B.text(c, 80, y - 46, "forecast vs reality.", "Sans-Md", 28, B.CHALK)
    B.label(c, 80, y - 100, "Paperback · on Amazon", 20, B.SEAFOAM)
    return finish(c, path)


def launch_story():
    W, H = 1080, 1920
    c, path = new("02-launch-story", W, H)
    B.swell_lines(c, 0, -60, W, 640, n=20, seed=9, color=B.SEAFOAM, width=2.4, highlight=15, hl_color=B.FLAG,
                  hl_width=2.8)
    wordmark(c, 90, H - 200, 52)
    y = headline(c, 90, H - 370, ["The forecast", "said 4ft", "and clean."], 98)
    B.text(c, 90, y - 20, "What did you actually get?", "Sans-Md", 40, B.SEAFOAM)
    cw = 420
    ch = cw * 1.5
    shadowed(c, cover_img(), (W - cw) / 2, 420, cw, ch, 20)
    B.label(c, W / 2, 340, "SVRF Surf Log · out now on Amazon", 24, B.CHALK, "center")
    return finish(c, path)


def carousel():
    """Four 1080 x 1350 slides for Instagram / Facebook."""
    W, H = 1080, 1350
    files = []

    # 1 - hook
    c, path = new("03-carousel-1-hook", W, H)
    B.swell_lines(c, 0, -40, W, 520, n=18, seed=21, color=B.SEAFOAM, width=2.2, highlight=12, hl_color=B.FLAG,
                  hl_width=2.6)
    wordmark(c, 90, H - 160, 46)
    y = headline(c, 90, H - 360, ["Forecast:", "4ft, clean,", "offshore."], 104)
    c.setFillColor(B.FLAG)
    y = headline(c, 90, y - 30, ["Reality:", "?"], 104, B.FLAG)
    B.label(c, W - 90, 80, "Swipe →", 26, B.SEAFOAM, "right")
    files.append(finish(c, path))

    def page_slide(name, n, title, body):
        c, path = new(name, W, H)
        c.setFillColor(B.CHALK)
        c.rect(0, 0, W, H, stroke=0, fill=1)
        img = page_image(n)
        ph = 900
        pw = ph * img.width / img.height
        c.setFillColor(B.INK)
        c.rect(0, H - 300, W, 300, stroke=0, fill=1)
        y = headline(c, 80, H - 140, title, 64)
        shadowed(c, ImageReader(img), (W - pw) / 2, 80, pw, ph, 14)
        B.text(c, 80, H - 140 - 64 * len(title) - 10, body, "Sans-Md", 26, B.SEAFOAM)
        return finish(c, path)

    files.append(page_slide("03-carousel-2-session", SESSION_PAGE, ["Forecast vs reality,", "every session."],
                            "Write the call. Log what you got. Give it a verdict."))
    files.append(page_slide("03-carousel-3-spot", SPOT_PAGE, ["Every break", "has a recipe."],
                            "Swell window, offshore wind, best tide. Write it down."))

    # 4 - CTA
    c, path = new("03-carousel-4-cta", W, H)
    B.swell_lines(c, 0, -40, W, 460, n=18, seed=33, color=B.SEAFOAM, width=2.2, highlight=13, hl_color=B.FLAG,
                  hl_width=2.6)
    cw = 400
    ch = cw * 1.5
    shadowed(c, cover_img(), 90, H - ch - 110, cw, ch, 18)
    tx = 90 + cw + 60
    B.text(c, tx, H - 170, "Inside", "Display", 46, B.CHALK)
    items = ["120 session pages", "12 monthly reviews", "Forecast scorecard", "8 spot files", "6 quiver pages",
             "Field guide", "Trip planners"]
    for k, s in enumerate(items):
        B.text(c, tx, H - 240 - k * 50, s, "Sans-Md", 28, B.CHALK)
        c.setFillColor(B.FLAG)
        c.rect(tx - 22, H - 232 - k * 50, 10, 10, stroke=0, fill=1)
    y = headline(c, 90, 560, ["Log it. Learn it.", "Call it."], 64)
    B.label(c, 90, y - 10, "SVRF Surf Log · paperback on Amazon", 24, B.SEAFOAM)
    files.append(finish(c, path))
    return files


def look_inside():
    """970 x 600: Amazon A+ 'Standard image' size. Three pages fanned out."""
    W, H = 970, 600
    c, path = new("04-aplus-look-inside", W, H)
    c.setFillColor(B.CHALK)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    pages = [(SESSION_PAGE, "Session page"), (SPOT_PAGE, "Spot file"), (QUIVER_PAGE, "The quiver")]
    ph = 420
    gap = 30
    pw = ph * 2 / 3
    total = len(pages) * pw + (len(pages) - 1) * gap
    x = (W - total) / 2
    for n, cap in pages:
        shadowed(c, ImageReader(page_image(n)), x, 100, pw, ph, 8)
        B.label(c, x, 72, cap, 13, B.SLATE)
        x += pw + gap
    B.text(c, (W - total) / 2, H - 46, "Look inside", "Display", 28, B.INK)
    return finish(c, path, scale=2.0)


def aplus_banner():
    """970 x 300: Amazon A+ 'Standard image header' size."""
    W, H = 970, 300
    c, path = new("05-aplus-banner", W, H)
    B.swell_lines(c, 380, -30, W, 210, n=14, seed=4, color=B.SEAFOAM, width=1.1, highlight=10, hl_color=B.FLAG,
                  hl_width=1.3)
    wordmark(c, 50, H - 70, 26)
    headline(c, 50, H - 140, ["Forecast first.", "Reality after."], 38)
    B.text(c, 50, 50, "A session journal for reading the sea.", "Sans-Md", 15, B.SEAFOAM)
    return finish(c, path, scale=2.0)


# ---- A+ module extras ------------------------------------------------------------------

def aplus_squares():
    """Three 600 x 600 close-ups for 'Standard Three Images & Text' (min 300 x 300)."""
    from PIL import Image
    crops = [  # (page, name, crop box as fractions of the trimmed page: left, top, right, bottom)
        (SESSION_PAGE, "06-aplus-square-session", (0.06, 0.04, 0.94, 0.62)),
        (SPOT_PAGE, "07-aplus-square-spot", (0.06, 0.04, 0.94, 0.462)),
        (GUIDE_PAGE, "08-aplus-square-guide", (0.06, 0.04, 0.94, 0.555)),
    ]
    files = []
    for n, name, (l, t, r, b) in crops:
        im = page_image(n, scale=4)
        w, h = im.size
        box = (int(l * w), int(t * h), int(r * w), int(b * h))
        part = im.crop(box)
        side = 600
        canvas_ = Image.new("RGB", (side, side), (0xEF, 0xEE, 0xE7))
        part.thumbnail((side - 48, side - 48), Image.LANCZOS)
        canvas_.paste(part, ((side - part.width) // 2, (side - part.height) // 2))
        path = os.path.join(OUT, name + ".png")
        canvas_.save(path)
        files.append(path)
    return files


def aplus_logo():
    """600 x 180 for 'Standard Company Logo'."""
    W, H = 600, 180
    c, path = new("09-aplus-logo", W, H)
    B.text(c, W / 2, 62, "SVRF", "Display", 92, B.CHALK, "center")
    return finish(c, path, scale=1.0)


def main():
    B.reg_fonts()
    B.ST = B.styles()
    os.makedirs(OUT, exist_ok=True)
    for f in [launch_square(), launch_story(), *carousel(), look_inside(), aplus_banner(), *aplus_squares(),
              aplus_logo()]:
        print(os.path.relpath(f, HERE))


if __name__ == "__main__":
    main()
