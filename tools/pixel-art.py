#!/usr/bin/env python3
"""
HEPHAESTUS · site art generator  —  pixel art, drawn from the mark, by rules.

    python3 tools/pixel-art.py            # regenerate site/assets/pixel/*
    python3 tools/pixel-art.py --icons    # print the OS icons as inline SVG
    python3 tools/pixel-art.py --contact  # a sheet of the icon candidates, to look at

What it does, in plain words: it takes the carved bust (site/assets/logo-ink-512.png),
shrinks it onto a coarse grid, and maps every cell to one of seven warm tones with a
4x4 Bayer dither between them. That is the whole trick — the "8-bit" look is a
quantisation of a real image, so it stays recognisable at any size. No model, no
photo filter, nothing you can't read in this file.

Needs Pillow (pip install pillow). The generated files are committed, so this script
only runs when you want to change the art; the site never depends on it.
"""
import os
import sys
import math

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
SRC = os.path.join(SITE, "assets", "logo-ink-512.png")
OUT = os.path.join(SITE, "assets", "pixel")

# ── the ramp ────────────────────────────────────────────────────────────────
# darkest = the panel the art sits on, so shadow dissolves into the background.
RAMP_DARK = ["#1c1310", "#33211a", "#5c3a24", "#8a5a37", "#bd8a5c", "#e2c9a6", "#f7efe3"]
RAMP_LIGHT = ["#2c1e15", "#4a3323", "#6f4429", "#9a6b44", "#c9a882", "#e6d6c1", "#f6efe6"]

BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def luminance(rgb):
    r, g, b = [c / 255 for c in rgb]
    lin = [(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in (r, g, b)]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def cells_from_image(path, cols, ramp, alpha_floor=0.5, dither=1.0, lift=0.0):
    """grid of palette indices (or None where the art is transparent)"""
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A")
    box = a.point(lambda v: 255 if v > 40 else 0).getbbox()
    if box:
        # keep the silhouette's own padding, then pad to a square-ish crop
        w, h = box[2] - box[0], box[3] - box[1]
        pad = int(max(w, h) * 0.045)
        box = (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)
        im = im.crop(box)
    src_w, src_h = im.size
    rows = max(1, round(cols * src_h / src_w))
    bg = hex2rgb(ramp[0])
    flat = Image.new("RGB", im.size, bg)
    flat.paste(im, (0, 0), im)
    small = flat.resize((cols, rows), Image.LANCZOS)
    alpha = a.crop(box).resize((cols, rows), Image.LANCZOS) if box else None
    px, ax = small.load(), (alpha.load() if alpha is not None else None)
    n = len(ramp) - 1
    # the mark is all mid-brown, so its luminance lives in a narrow band. measuring the
    # band and stretching it over the whole ramp is what keeps the carving readable.
    vals = sorted(
        luminance(px[x, y])
        for y in range(rows) for x in range(cols)
        if ax is None or ax[x, y] / 255 >= alpha_floor
    )
    if not vals:
        raise SystemExit("nothing to draw — the source image is empty")
    lo = vals[int(len(vals) * 0.02)]
    hi = vals[max(0, min(len(vals) - 1, int(len(vals) * 0.98)))]
    if hi - lo < 1e-4:
        hi = lo + 1e-4
    out = []
    for y in range(rows):
        row = []
        for x in range(cols):
            if ax is not None and ax[x, y] / 255 < alpha_floor:
                row.append(None)
                continue
            lum = min(1.0, max(0.0, luminance(px[x, y]) + lift))
            t = (lum - lo) / (hi - lo)
            v = t * n + dither * ((BAYER4[y % 4][x % 4] / 16.0) - 0.5) * 1.15
            row.append(max(0, min(n, int(round(v)))))
        out.append(row)
    return out


def paint(cells, ramp, scale, shadow=None):
    """one flat block per cell — no anti-aliasing, no gradient, nothing to smooth.
    shadow=(dx,dy,hex) offsets a hard silhouette by whole blocks, nothing in between."""
    cols, rows = len(cells[0]), len(cells)
    dx, dy = (shadow[0], shadow[1]) if shadow else (0, 0)
    W, H = (cols + max(0, dx)) * scale, (rows + max(0, dy)) * scale
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shadow:
        tone = (*hex2rgb(shadow[2]), 255)
        for y in range(rows):
            for x in range(cols):
                if cells[y][x] is not None:
                    d.rectangle([(x + dx) * scale, (y + dy) * scale,
                                 (x + dx + 1) * scale - 1, (y + dy + 1) * scale - 1], fill=tone)
    for y in range(rows):
        for x in range(cols):
            i = cells[y][x]
            if i is None:
                continue
            d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1],
                        fill=(*hex2rgb(ramp[i]), 255))
    return im


def fade_bottom(cells, band=4):
    """the classic 8-bit fade: the last few rows lose cells in a checker, so the plate
    dissolves into the panel instead of stopping on a hard line"""
    out = [list(r) for r in cells]
    rows = len(out)
    for y in range(rows - band, rows):
        depth = (y - (rows - band - 1)) / band          # 1/band … 1
        for x in range(len(out[0])):
            if out[y][x] is None:
                continue
            if (x + y) % 2 == 1 and depth < 0.8:
                out[y][x] = None
            elif depth >= 0.8:
                out[y][x] = None
    return out


def spray(cells, amount, rnd, ramp_len):
    """loose blocks along the outside of the silhouette — dust from the chisel. it makes
    the piece feel mid-work without touching the carving itself. cells that sit in a
    hollow *inside* the shape (3+ filled neighbours) are left alone, or this reads as noise."""
    rows, cols = len(cells), len(cells[0])
    filled = lambda x, y: 0 <= x < cols and 0 <= y < rows and cells[y][x] is not None
    out = [list(r) for r in cells]
    for y in range(rows):
        for x in range(cols):
            if out[y][x] is not None or rnd.random() > amount:
                continue
            n = sum(1 for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1))
                    if filled(x + dx, y + dy))
            if n in (1, 2):
                out[y][x] = 1 + rnd.randrange(max(1, ramp_len - 2))
    return out


# ── pixel OS icons, drawn by rules ──────────────────────────────────────────
# Not ASCII typed by hand and not an SVG traced off a site: each icon is a small piece
# of geometry on a 24-wide grid, rasterised one cell at a time. Change a number, get a
# different icon. The grid is what makes them look like pixel art — CSS shows them at
# exactly 2 px per cell, so every block lands whole.
GX = 24

def grid_of(w, h, paint):
    return ["".join("#" if paint(x, y) else "." for x in range(w)) for y in range(h)]




def _shear(x, y, h, k):
    """lean the shape left as it goes down: the flag-in-flight trick"""
    return x - (h - 1 - y) * k


def windows(w=GX, h=21, k=0.13, gutter=2.4, side=9.1, ox=0.9, oy=0.9):
    def paint(x, y):
        xx = _shear(x + 0.5, y + 0.5, h, k) - ox
        yy = y + 0.5 - oy
        inx = (0 <= xx < side) or (gutter + side <= xx < gutter + 2 * side)
        iny = (0 <= yy < side) or (gutter + side <= yy < gutter + 2 * side)
        return inx and iny
    return grid_of(w, h, paint)


def apple(w=GX, h=25):
    def in_ellipse(x, y, cx, cy, rx, ry, rot=0.0):
        s, c = math.sin(rot), math.cos(rot)
        dx, dy = (x - cx) * c + (y - cy) * s, -(x - cx) * s + (y - cy) * c
        return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1.0

    def paint(x, y):
        px, py = x + 0.5, y + 0.5
        # two lobes and a filler, the way the logo is actually drawn: the top dips in
        body = (in_ellipse(px, py, 8.2, 16.6, 6.6, 7.9)
                or in_ellipse(px, py, 15.8, 16.6, 6.6, 7.9)
                or in_ellipse(px, py, 12.0, 14.6, 7.9, 6.4))
        bite = in_ellipse(px, py, 22.0, 17.0, 4.0, 4.6)
        leaf = in_ellipse(px, py, 15.4, 6.4, 3.3, 1.5, -0.5)
        stem = 10.6 <= px <= 12.4 and 6.4 <= py <= 10.4 and (px - 10.6) >= (py - 5.6) * 0.34
        return (body and not bite) or leaf or stem
    return grid_of(w, h, paint)


def linux(w=GX, h=26):
    def in_ellipse(x, y, cx, cy, rx, ry, rot=0.0):
        s, c = math.sin(rot), math.cos(rot)
        dx, dy = (x - cx) * c + (y - cy) * s, -(x - cx) * s + (y - cy) * c
        return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1.0

    def paint(x, y):
        px, py = x + 0.5, y + 0.5
        head = in_ellipse(px, py, 12.0, 7.0, 4.7, 5.0)
        body = in_ellipse(px, py, 12.0, 16.0, 8.4, 9.4)
        flip = in_ellipse(px, py, 3.4, 16.0, 2.0, 5.4, 0.30) or in_ellipse(px, py, 20.6, 16.0, 2.0, 5.4, -0.30)
        feet = in_ellipse(px, py, 8.2, 24.4, 3.6, 1.7) or in_ellipse(px, py, 15.8, 24.4, 3.6, 1.7)
        solid = head or body or flip or feet
        belly = in_ellipse(px, py, 12.0, 17.2, 5.1, 6.6)          # the pale front
        eye = in_ellipse(px, py, 10.0, 6.0, 1.15, 1.5) or in_ellipse(px, py, 14.0, 6.0, 1.15, 1.5)
        beak = in_ellipse(px, py, 12.0, 8.8, 2.0, 1.0)            # knocked out, so it reads
        return solid and not (belly or eye or beak)
    return grid_of(w, h, paint)


ICONS = {"windows": windows(), "apple": apple(), "linux": linux()}


def icon_svg(grid, ink="currentColor", gap=0):
    """one <rect> per run of ink per row — smaller than a bitmap's worth of squares"""
    w, h = len(grid[0]), len(grid)
    parts = []
    for y, row in enumerate(grid):
        x = 0
        while x < w:
            if row[x] == ".":
                x += 1
                continue
            run = 1
            while x + run < w and row[x + run] != ".":
                run += 1
            parts.append(f'<rect x="{x}" y="{y}" width="{run}" height="1"/>')
            x += run
    return (f'<svg class="osicon" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'fill="{ink}" aria-hidden="true" focusable="false">' + "".join(parts) + "</svg>")


def main():
    os.makedirs(OUT, exist_ok=True)
    if "--icons" in sys.argv:
        for k in ("windows", "apple", "linux"):
            print(f"--- {k} ---")
            print(icon_svg(ICONS[k]))
        return
    if "--contact" in sys.argv:
        sheet = Image.new("RGB", (13 * 8 * 3 + 80, 14 * 8 + 60), "#f4eee6")
        d = ImageDraw.Draw(sheet)
        for n, (k, grid) in enumerate([("windows", ICONS["windows"]), ("apple", ICONS["apple"]),
                                        ("linux", ICONS["linux"])]):
            ox, oy = 20 + n * (13 * 8 + 20), 20
            for y, row in enumerate(grid):
                for x, c in enumerate(row):
                    if c != ".":
                        d.rectangle([ox + x * 8, oy + y * 8, ox + x * 8 + 7, oy + y * 8 + 7], fill="#2c1e15")
            d.text((ox, oy + len(grid) * 8 + 6), k, fill="#2c1e15")
        sheet.save("/home/user/qa-shots/os-icons.png")
        print("wrote /home/user/qa-shots/os-icons.png")
        return

    import random
    rnd = random.Random(7)
    # scale 1 = one pixel per block, and CSS decides how big a block is (integer cell
    # sizes only, so every block lands on a whole device pixel).
    jobs = [
        # name, grid width, ramp, dither strength, effects
        ("bust.png", 56, RAMP_DARK, 1.0, ("fade", "spray", "shadow")),
        ("bust-plate.png", 64, RAMP_DARK, 1.0, ("shadow",)),
        ("bust-cream.png", 44, RAMP_LIGHT, 0.9, ()),
    ]
    for name, cols, ramp, dith, fx in jobs:
        cells = cells_from_image(SRC, cols, ramp, dither=dith)
        if "fade" in fx:
            cells = fade_bottom(cells, 4)
        if "spray" in fx:
            cells = spray(cells, 0.30, rnd, len(ramp))
        im = paint(cells, ramp, 1, (1, 1, "#0d0906") if "shadow" in fx else None)
        p = os.path.join(OUT, name)
        im.save(p, optimize=True)
        print(f"{p}  {im.size[0]}x{im.size[1]}  {os.path.getsize(p) / 1024:.1f} KB")
    # the og/social card: the bust on the panel, big enough to share
    og = Image.new("RGB", (1200, 630), "#1c1310")
    ogd = ImageDraw.Draw(og)
    for y in range(0, 630, 6):
        for x in range(0, 1200, 6):
            if (x // 6 + y // 6) % 2 == 0:
                ogd.rectangle([x, y, x + 1, y + 1], fill="#2a1c15")
    art = paint(spray(fade_bottom(cells_from_image(SRC, 40, RAMP_DARK)), 0.25, rnd, 7),
                RAMP_DARK, 9)
    og.paste(art, (1200 - art.width - 70, (630 - art.height) // 2 + 10), art)
    f = None
    for cand in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(cand):
            f = cand
            break
    if f:
        from PIL import ImageFont
        ogd.text((70, 200), "HEPHAESTUS", font=ImageFont.truetype(f, 54), fill="#f7efe3")
        ogd.text((72, 275), "design help that shows its work", font=ImageFont.truetype(f, 26), fill="#bd8a5c")
        ogd.text((72, 330), "free desktop app - windows, macos, linux - no ai, no account",
                 font=ImageFont.truetype(f, 18), fill="#8a5a37")
    og.save(os.path.join(OUT, "og.png"), optimize=True)
    print(f"og card  1200x630  {os.path.getsize(os.path.join(OUT, 'og.png')) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
