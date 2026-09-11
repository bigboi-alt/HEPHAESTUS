#!/usr/bin/env python3
"""
HEPHAESTUS · site portrait, in ASCII — drawn from the mark, by rule.

    python3 tools/ascii-art.py                 print the art to stdout
    python3 tools/ascii-art.py --write         splice it into site/index.html
    python3 tools/ascii-art.py --preview /tmp/a.png    render it as a PNG to look at
    python3 tools/ascii-art.py --og            write site/assets/og.png (the share card)
    python3 tools/ascii-art.py --cols 96 --unsharp 0.8 --gamma 1.2           tune it

In plain words: it takes the app's own mark (site/assets/logo-ink-512.png), measures how
dark each cell of a grid over it is, and picks one character per cell from a ramp of ten.
The darkest cell is "@", the lightest is a space, and nothing else decides anything. No
model, no font effect, no image file — the portrait on the site is literal text, which is
why it stays crisp at every size and costs a few hundred bytes.

Two numbers matter and both are visible here: --cols sets the grid (the page is built
around 84), and CHAR (0.60) is the ratio of a monospace cell's width to its height, so the
rows are counted back from the source's own aspect ratio instead of being guessed.

Needs Pillow only for --preview and --og; --write and stdout are pure text.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
SRC = os.path.join(SITE, "assets", "logo-ink-512.png")
PAGE = os.path.join(SITE, "index.html")
OG = os.path.join(SITE, "assets", "og.png")

# dark → light is the wrong way round for reading, so this runs the other way: index 0 is
# empty paper, the last one is solid ink. Ten steps is roughly what ten glyphs can hold.
RAMP = " .,:-=+*%#@"
CHAR = 0.60  # advance width of a monospace cell, as a fraction of its height

# the portrait, as it ships on the page
COLS, CROP, FADE, GAMMA, UNSHARP, DITHER, PAD = 72, 0.86, 0.26, 1.12, 0.85, 0.5, 0.05
PAPER = (244, 238, 230)
INK = (111, 68, 41)

BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def luminance(rgb):
    r, g, b = [c / 255 for c in rgb]
    lin = [(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in (r, g, b)]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.722 * lin[2] / 10 * 10  # (kept readable)


def density_grid(path=SRC, cols=COLS, alpha_floor=0.42, gamma=GAMMA, dither=DITHER,
                 ramp=RAMP, unsharp=UNSHARP, crop=CROP, fade=FADE, pad=PAD):
    """rows of characters — one per cell of a cols-wide grid laid over the mark."""
    from PIL import Image

    if "<" in ramp or ">" in ramp or "&" in ramp:
        raise SystemExit("the ramp may not contain < > or & — it goes into HTML as text")

    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A")
    box = a.point(lambda v: 255 if v > 40 else 0).getbbox()
    if box:
        w, h = box[2] - box[0], box[3] - box[1]
        p = int(max(w, h) * pad)
        box = (max(0, box[0] - p), max(0, box[1] - p), box[2] + p, box[3] + p)
        if crop < 1.0:   # keep the top of the silhouette: a head study, not a plinth
            box = (box[0], box[1], box[2], box[1] + int((box[3] - box[1]) * crop))
        im, a = im.crop(box), a.crop(box)
    src_w, src_h = im.size
    rows = max(1, round(cols * (src_h / src_w) * CHAR))

    # the mark sits on paper, exactly as it will on the page, so the measurement is honest
    flat = Image.new("RGB", im.size, PAPER)
    flat.paste(im, (0, 0), im)
    small = flat.resize((cols, rows), Image.BOX)  # area average, not a point sample
    ax = a.resize((cols, rows), Image.BOX).load()
    px = small.load()

    raw = []
    for y in range(rows):
        line = []
        for x in range(cols):
            if ax[x, y] / 255 < alpha_floor:
                line.append(None)  # outside the silhouette: a space, and nothing else
                continue
            line.append(luminance(px[x, y]))
        raw.append(line)

    vals = sorted(v for line in raw for v in line if v is not None)
    if not vals:
        raise SystemExit("nothing to draw — the source image is empty")
    lo = vals[int(len(vals) * 0.01)]
    hi = vals[max(0, min(len(vals) - 1, int(len(vals) * 0.99)))]
    if hi - lo < 1e-4:
        hi = lo + 1e-4

    if unsharp:
        # the carving is fine relative to the whole head, so at this grid size its lines
        # average away. subtracting a blurred copy of the tonal map puts them back.
        import copy
        base = copy.deepcopy(raw)
        r = 1.0
        for y, line in enumerate(raw):
            for x, v in enumerate(line):
                if v is None:
                    continue
                tot, cnt = 0.0, 0
                for dy in range(-1, 2):
                    for dx in range(-1, 2):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < len(base) and 0 <= xx < len(base[yy]) and base[yy][xx] is not None:
                            tot += base[yy][xx]; cnt += 1
                if cnt:
                    line[x] = v + unsharp * (v - tot / cnt)

    n = len(ramp) - 1
    out = []
    for y, line in enumerate(raw):
        row = []
        # the bottom of a bust is a slab of tone that says nothing in characters, so it
        # thins out and breaks apart into the paper instead of ending on a hard line
        fy = (len(raw) - 1 - y) / max(1, len(raw) - 1)
        w = 1.0 if fade <= 0 else min(1.0, fy / fade)
        for x, v in enumerate(line):
            if v is None:
                row.append(" ")
                continue
            t = 1.0 - min(1.0, max(0.0, (v - lo) / (hi - lo)))  # dark → dense
            t = t ** gamma
            if w < 1.0:
                t *= w ** 1.5
                if ((BAYER4[y % 4][x % 4] / 16.0) * 0.7 + ((x * 37 + y * 11) % 13) / 13.0 * 0.3) > w:
                    t = 0.0
            t += dither * ((BAYER4[y % 4][x % 4] / 16.0) - 0.5) * (1.0 / n) * 1.9
            row.append(ramp[max(0, min(n, int(round(t * n))))])
        out.append("".join(row).ljust(cols))
    # a round head inside a square crop leaves whole rows of paper at the top and bottom;
    # they're not composition, they're dead weight that shrinks the portrait on the page
    while out and not out[0].strip():
        out.pop(0)
    while out and not out[-1].strip():
        out.pop()
    return out


def render(lines, font_px=11, color=INK, bg=PAPER, pad=24, mono=None):
    """paint the characters themselves into an image, so a human can look at the result"""
    from PIL import Image, ImageDraw, ImageFont

    f = None
    for cand in (mono or []):
        if os.path.exists(cand):
            f = ImageFont.truetype(cand, font_px)
            break
    if f is None:
        for cand in ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
                     "/usr/share/fonts/dejavu/DejaVuSansMono.ttf"):
            if os.path.exists(cand):
                f = ImageFont.truetype(cand, font_px)
                break
    if f is None:
        f = ImageFont.load_default()
    adv = getattr(f, "length", None)
    w0 = adv("M") if adv else font_px * CHAR
    line_h = font_px * 1.06
    W = int(max(len(l) for l in lines) * w0) + pad * 2
    H = int(len(lines) * line_h) + pad * 2
    im = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        d.text((pad, pad + i * line_h), line, font=f, fill=color)
    return im


def og(lines, out=OG):
    """the social card: same words, same characters, one canvas, no browser needed"""
    from PIL import Image, ImageDraw, ImageFont

    W, H = 1200, 630
    ink, ink2, ink3 = hex2rgb("#2c1e15"), INK, hex2rgb("#8d7767")
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 4], fill=INK)
    d.rectangle([0, H - 4, W, H], fill=INK)

    def font(px, bold=False, mono=False):
        name = "DejaVuSansMono" if mono else f"DejaVuSans{'-Bold' if bold else ''}"
        for root in ("/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu"):
            cand = os.path.join(root, name + ".ttf")
            if os.path.exists(cand):
                return ImageFont.truetype(cand, px)
        return ImageFont.load_default()

    # the art owns the right half, so text is shrunk until it stops trying to walk into it
    art = render(lines, font_px=26, pad=0, bg=PAPER)
    right = 745                                   # the column the text may not cross
    ah = min(H - 130, 500)
    if art.height > ah:
        art = art.resize((int(art.width * ah / art.height), ah), Image.LANCZOS)
    if art.width > W - right - 60:
        k = (W - right - 60) / art.width
        art = art.resize((int(art.width * k), int(art.height * k)), Image.LANCZOS)
    ax, ay = W - art.width - 70, (H - art.height) // 2

    def put(x, y, text, f, color, limit):
        while f.size > 8 and d.textlength(text, font=f) > limit:
            f = font(f.size - 1, mono=isinstance(f, ImageFont.FreeTypeFont) and "Mono" in f.font.family)
        d.text((x, y), text, font=f, fill=color)
        return f

    L = right - 74 - 24
    put(74, 112, "Hephaestus", font(76, bold=True), ink, L)
    put(76, 210, "design help that shows its work", font(33), INK, L)
    put(76, 276, "picks your colours · lays out your pages", font(21), ink2, L)
    put(76, 308, "and reviews the result, out loud", font(21), ink2, L)
    put(76, 366, "free desktop app · windows macos linux", font(18, mono=True), ink3, L)
    put(76, 392, "no AI, no account, works offline", font(18, mono=True), ink3, L)
    put(76, 470, "the portrait is the app's own mark, measured cell by cell", font(16, mono=True), ink3, L)
    put(76, 496, "and set in ten characters — no model touched it", font(16, mono=True), ink3, L)
    im.paste(art, (ax, ay))
    im.save(out)
    return out, im.size


def write_page(lines, ramp=RAMP):
    src = open(PAGE, encoding="utf-8").read()
    pat = re.compile(r'<pre class="bust"([^>]*)>(.*?)</pre>', re.S)
    if not pat.search(src):
        raise SystemExit(f"no <pre class=\"bust\"> found in {PAGE} — put one there first")
    block = "\n" + "\n".join(lines) + "\n"
    # the size is stamped into the tag so the copy on the page can be checked against it
    def tag(m):
        attrs = re.sub(r'\s*data-(cols|rows)="\d+"', "", m.group(1))
        return f'<pre class="bust"{attrs} data-cols="{len(lines[0])}" data-rows="{len(lines)}">' + block + "</pre>"
    out = pat.sub(tag, src, count=1)
    # if the page quotes the grid anywhere (a caption, a footnote — the shipped page
    # deliberately doesn't), that quote is rewritten too, so copy can't drift from the art
    dims = f"{len(lines[0])} cells across, {len(lines)} rows down, {len(ramp) - 1} tones deep"
    out = re.sub(r'(<span id="artDims">)(.*?)(</span>)', lambda m: m.group(1) + dims + m.group(3), out,
                 count=1, flags=re.S)
    if out == src:
        print("site/index.html — already matches the generator, nothing written")
        return max(len(l) for l in lines), len(lines)
    open(PAGE, "w", encoding="utf-8").write(out)
    return max(len(l) for l in lines), len(lines)


def flag(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def main():
    # these numbers are the portrait: measured, not hand-tuned per run, because the QA
    # suite regenerates the block and expects the page to match it character for character
    cols = int(flag("--cols", COLS))
    ramp = flag("--ramp", RAMP)
    gamma = float(flag("--gamma", GAMMA))
    dither = float(flag("--dither", DITHER))
    unsharp = float(flag("--unsharp", UNSHARP))
    crop = float(flag("--crop", CROP))
    fade = float(flag("--fade", FADE))
    lines = density_grid(cols=cols, gamma=gamma, dither=dither, ramp=ramp, unsharp=unsharp,
                         crop=crop, fade=fade, pad=float(flag("--pad", PAD)))

    if "--og" in sys.argv:
        path, size = og(lines)
        print(f"{os.path.relpath(path, ROOT)}  {size[0]}×{size[1]}  ({os.path.getsize(path):,} B)")
        return
    if "--preview" in sys.argv:
        out = flag("--preview")
        im = render(lines, font_px=int(flag("--px", 11)))
        im.save(out)
        print(f"{out}  {im.size[0]}×{im.size[1]}  ·  {len(lines[0])} × {len(lines)} cells")
        return
    if "--write" in sys.argv:
        w, h = write_page(lines, ramp)
        print(f"site/index.html ← {w} wide × {h} tall ({len(ramp) - 1} marks + a space, ramp {ramp!r})")
        return
    print("\n".join(lines))
    print(f"\n/* {len(lines[0])} wide × {len(lines)} tall, ramp {ramp!r} */")


if __name__ == "__main__":
    main()
