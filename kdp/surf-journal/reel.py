"""
SVRF Surf Log: 9:16 promotional reel for Instagram Reels and TikTok.

Run after build.py:  python3 reel.py
Writes marketing/svrf-surf-log-reel.mp4 (1080 x 1920, 30 fps, H.264, silent AAC track; add a sound in-app).
"""

from __future__ import annotations

import io
import math
import os
import random
import shutil
import subprocess
import tempfile
from multiprocessing import Pool

import pypdfium2 as pdfium
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

import build as B
import marketing as M

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "marketing", "svrf-surf-log-reel.mp4")
W, H = 1080, 1920
FPS = 30
DURATION = 19.0

# Keep text inside the area the Instagram / TikTok UI doesn't cover.
SAFE_TOP = H - 250
SAFE_BOTTOM = 380
SAFE_LEFT = 90

ASSETS = {}


# ---- Timing helpers ------------------------------------------------------------------

def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp(t)
    return 3 * t * t - 2 * t * t * t


def prog(t, start, dur):
    return clamp((t - start) / dur)


# ---- Drawing helpers -----------------------------------------------------------------

def swell(c, x0, y0, x1, y1, t, n=20, seed=11, highlight=None, width=2.2, hl_width=2.6, speed=0.32):
    """Animated version of the cover motif: swell lines rolling in from the horizon toward the viewer."""
    rnd = random.Random(seed)
    params = [(rnd.uniform(0, 1), rnd.uniform(0, 1), rnd.uniform(0, 1), rnd.uniform(0.9, 1.4)) for _ in range(n)]
    drift = t * speed
    steps = 160
    order = []
    for k in range(n):
        pos = (k + drift) % n            # lines advance and wrap back to the horizon
        order.append((pos, k))
    order.sort()
    for pos, k in order:
        d = (pos + 1) / (n + 1)
        base = y1 - (y1 - y0) * d ** 1.9
        gap = (y1 - y0) * (d ** 1.9 - max(0.0, (pos) / (n + 1)) ** 1.9)
        in_set = (k // 4) % 2 == 0
        hl = highlight is not None and k == highlight
        p1, p2, p3, f1 = params[k]
        p1 += t * 0.02
        p3 += t * 0.05
        top, bot = [], []
        for i in range(steps + 1):
            u = i / steps
            px = x0 + (x1 - x0) * u
            v = 0.5 * math.sin(2 * math.pi * (u * 0.7 + p1)) + 0.25 * math.sin(2 * math.pi * (u * 1.6 + p2))
            bow = 1 - (2 * u - 1) ** 2
            py = base + gap * (0.3 * v - 0.22 * bow)
            e = 0.5 + 0.5 * math.sin(2 * math.pi * (u * f1 * (2.2 - d) + p3))
            if hl:
                e = (0.45 + 0.55 * e) * min(1.0, u / 0.12, (1 - u) / 0.12 + 0.35)
            else:
                e = max(0.0, (e - 0.3) / 0.7) ** 0.8
            th = (hl_width if hl else width) * (0.35 + 2.4 * d ** 1.3) * e * (1.0 if (in_set or hl) else 0.6)
            top.append((px, py + th / 2))
            bot.append((px, py - th / 2))
        # fade in at the horizon so wrapped lines never pop
        fade = clamp(pos / 1.5)
        strength = (0.3 + 0.7 * d) * (1.0 if in_set else 0.75) * fade
        col = B.FLAG if hl else B._mix(B.INK, B.SEAFOAM, min(1.0, strength))
        path = c.beginPath()
        path.moveTo(*top[0])
        for pt in top[1:]:
            path.lineTo(*pt)
        for pt in reversed(bot):
            path.lineTo(*pt)
        path.close()
        c.setFillColor(col)
        c.setFillAlpha(fade if hl else 1)
        c.drawPath(path, stroke=0, fill=1)
        c.setFillAlpha(1)


def rise_text(c, x, y, s, font, size, color, t, start, dur=0.45, dist=40, align="left"):
    """Text that fades in while sliding up."""
    p = ease_out(prog(t, start, dur))
    if p <= 0:
        return
    c.setFillAlpha(p)
    B.text(c, x, y - dist * (1 - p), s, font, size, color, align)
    c.setFillAlpha(1)


def image(c, key, x, y, w, h, alpha=1.0, shadow=True):
    if shadow:
        c.setFillColor(HexColor("#000000"))
        c.setFillAlpha(0.35 * alpha)
        c.rect(x + 10, y - 16, w, h, stroke=0, fill=1)
    c.setFillAlpha(alpha)
    c.drawImage(ASSETS[key], x, y, w, h)
    c.setFillAlpha(1)


def wordmark(c, alpha=1.0):
    c.setFillAlpha(alpha)
    B.text(c, SAFE_LEFT, SAFE_TOP - 10, "SVRF", "Display", 44, B.CHALK, tracking=1.3)
    c.setFillAlpha(1)


# ---- Scenes --------------------------------------------------------------------------

def scene_hook(c, t):
    c.setFillColor(B.INK)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    swell(c, 0, -120, W, 820, t, n=20, seed=11, highlight=15)
    wordmark(c, ease_out(prog(t, 0.0, 0.4)))
    y = SAFE_TOP - 330
    for k, line in enumerate(["Forecast:", "4ft, clean,", "offshore."]):
        rise_text(c, SAFE_LEFT, y - k * 118, line, "Display", 112, B.CHALK, t, 0.25 + k * 0.38)
    y2 = y - 3 * 118 - 60
    rise_text(c, SAFE_LEFT, y2, "Reality:", "Display", 112, B.FLAG, t, 2.5)
    # the question mark drops in with a small overshoot
    p = prog(t, 3.1, 0.5)
    if p > 0:
        s = 1 + 0.25 * math.sin(math.pi * clamp(p * 1.2)) * (1 - p)
        c.saveState()
        x0 = SAFE_LEFT + B.pdfmetrics.stringWidth("Reality: ", "Display", 112)
        c.translate(x0, y2)
        c.scale(s, s)
        c.setFillAlpha(ease_out(p))
        B.text(c, 0, 0, "?", "Display", 112, B.FLAG)
        c.restoreState()


def page_scene(c, t, key, title, sub, enter="up", zoom_anchor=(0.5, 0.75), zoom=0.1, scene_len=4.0):
    """Chalk background, ink header with title, a journal page with a slow push-in."""
    c.setFillColor(B.CHALK)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    band = 580
    c.setFillColor(B.INK)
    c.rect(0, H - band, W, band, stroke=0, fill=1)
    ty = SAFE_TOP - 70
    for k, line in enumerate(title):
        rise_text(c, SAFE_LEFT, ty - k * 82, line, "Display", 76, B.CHALK, t, 0.1 + k * 0.15, dist=24)
    rise_text(c, SAFE_LEFT, ty - len(title) * 82 - 22, sub, "Sans-Md", 32, B.SEAFOAM, t, 0.45, dist=16)

    # page geometry
    ph = H - band - 90 - 250
    pw = ph * 2 / 3
    px = (W - pw) / 2
    py = 250
    p = ease_out(prog(t, 0.0, 0.6))
    if enter == "up":
        py_now = py - (1 - p) * 900
        px_now = px
    else:
        py_now = py
        px_now = px + (1 - p) * W
    # push-in after it lands
    z = 1 + zoom * ease_in_out(prog(t, 0.6, scene_len - 0.6))
    ax, ay = zoom_anchor
    cx = px_now + pw * ax
    cy = py_now + ph * ay
    c.saveState()
    clip = c.beginPath()
    clip.rect(0, 0, W, H - band)
    c.clipPath(clip, stroke=0, fill=0)
    c.translate(cx, cy)
    c.scale(z, z)
    c.translate(-cx, -cy)
    image(c, key, px_now, py_now, pw, ph)
    c.restoreState()


def scene_montage(c, t):
    items = [("guide", ["7-page", "field guide."], "Swell, wind, tide, wetsuits, safety."),
             ("quiver", ["Your whole", "quiver."], "Dims, volume, fins, ding log."),
             ("score", ["Keep the", "forecast honest."], "Your season hit rate, worked out.")]
    seg = 0.9
    i = min(len(items) - 1, int(t // seg))
    key, title, sub = items[i]
    page_scene(c, t - i * seg, key, title, sub, enter="side", zoom=0.04, scene_len=seg)


def scene_cover(c, t):
    c.setFillColor(B.INK)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    swell(c, 0, -120, W, 760, t + 6, n=20, seed=5, highlight=12)
    wordmark(c)
    p = ease_out(prog(t, 0.0, 0.8))
    cw = 520 * (0.92 + 0.08 * p)
    ch = cw * 1.5
    cx = (W - cw) / 2
    cy = 640 + (1 - p) * 60
    image(c, "cover", cx, cy, cw, ch, alpha=p)
    rise_text(c, W / 2, 520, "Log it. Learn it. Call it.", "Display", 58, B.CHALK, t, 0.6, align="center")
    rise_text(c, W / 2, 450, "SVRF SURF LOG  ·  OUT NOW ON AMAZON", "Mono-Bd", 30, B.FLAG, t, 0.9,
              align="center")
    rise_text(c, W / 2, 400, "Link in bio", "Sans-Md", 30, B.SEAFOAM, t, 1.2, align="center")


# ---- Timeline ------------------------------------------------------------------------

TIMELINE = [  # (start, end, scene function)
    (0.0, 4.6, scene_hook),
    (4.6, 8.8, lambda c, t: page_scene(c, t, "session", ["Forecast vs reality,", "every session."],
                                       "Write the call. Log what you got.", zoom_anchor=(0.5, 0.78), zoom=0.12,
                                       scene_len=4.2)),
    (8.8, 12.2, lambda c, t: page_scene(c, t, "spot", ["Every break", "has a recipe."],
                                        "Swell window, offshore wind, best tide.", enter="side",
                                        zoom_anchor=(0.5, 0.7), zoom=0.1, scene_len=3.4)),
    (12.2, 14.9, scene_montage),
    (14.9, DURATION, scene_cover),
]
WIPE = 0.35  # seconds of crossfade at each cut


def draw_scene(c, t):
    for start, end, fn in TIMELINE:
        if start <= t < end:
            fn(c, t - start)
            return
    TIMELINE[-1][2](c, t - TIMELINE[-1][0])


def render_frame(i):
    t = i / FPS
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(W, H), initialFontName="Sans", initialFontSize=9)
    draw_scene(c, t)
    # Fade through ink at each scene change, and at the very start and end.
    cuts = [s for s, _, _ in TIMELINE[1:]]
    a = 0.0
    for cut in cuts:
        dt = abs(t - cut)
        if dt < WIPE / 2:
            a = max(a, 1 - dt / (WIPE / 2))
    a = max(a, 1 - t / 0.3, 1 - (DURATION - t) / 0.4)
    if a > 0:
        c.setFillColor(B.INK)
        c.setFillAlpha(clamp(a) * 0.85)
        c.rect(0, 0, W, H, stroke=0, fill=1)
    c.save()
    doc = pdfium.PdfDocument(buf.getvalue())
    img = doc[0].render(scale=1).to_pil().convert("RGB")
    img.save(os.path.join(FRAMES, f"{i:05d}.png"), compress_level=1)
    doc.close()
    return i


FRAMES = None


def init(frames, assets):
    global FRAMES
    FRAMES = frames
    B.reg_fonts()
    B.ST = B.styles()
    ASSETS.update(assets)


def prepare_assets(tmp):
    """Pre-render the pages as JPEGs so every frame can embed them without re-encoding."""
    pages = {"session": M.SESSION_PAGE, "spot": M.SPOT_PAGE, "guide": M.GUIDE_PAGE, "quiver": M.QUIVER_PAGE,
             "score": 179}
    assets = {}
    for key, n in pages.items():
        path = os.path.join(tmp, key + ".jpg")
        M.page_image(n, scale=2.6).save(path, quality=92)
        assets[key] = path
    assets["cover"] = M.FRONT
    return assets


def main():
    B.reg_fonts()
    B.ST = B.styles()
    tmp = tempfile.mkdtemp(prefix="reel-")
    frames = os.path.join(tmp, "frames")
    os.makedirs(frames)
    assets = prepare_assets(tmp)
    n = int(DURATION * FPS)
    with Pool(os.cpu_count(), initializer=init, initargs=(frames, assets)) as pool:
        for k, _ in enumerate(pool.imap_unordered(render_frame, range(n), chunksize=8)):
            if k % 90 == 0:
                print(f"frame {k}/{n}")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(frames, "%05d.png"),
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-level", "4.1", "-r", str(FPS), "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
        OUT,
    ], check=True)
    shutil.rmtree(tmp)
    print(os.path.relpath(OUT, HERE))


if __name__ == "__main__":
    main()
