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
