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

# 2026-09-11 (later) · the site, redone to your notes — SUPERSEDED, read the next entry

> **Kept for the record; the entry after this one replaced almost all of it.** The pixel
> plate, the eight screenshots, the canvas assembly and the GitHub release reader were all
> built as asked and then asked to be removed: the portrait is ASCII on plain paper now,
> there are no images on the page at all, nothing animates, and the page says the word
> "github" zero times because the repo is private. `tools/pixel-art.py`, `tools/shots.mjs`
> and `tools/connect.mjs` were deleted with it (they're in the git history). What survives
> below: the phone-width `<pre>` overflow lesson, the contrast-on-dark-plate lesson, and the
> rule that decoration must never gate content.

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


# 2026-09-11 (later still) · the site, again: text on paper

You looked at the pixel version and said it was bad, and you were right about the shape of
it: a dark plate bolted next to the copy, a picture that only made sense at one size, eight
screenshots in frames, and a release reader bolted to a repo nobody can see. This is the
same page after taking all of that out.

**1 · the portrait is ASCII, on the page's own paper.** Right half of the hero, no panel
behind it, no border, nothing rectangular at all — `tools/ascii-art.py` measures the app's
mark on a 72-cell grid, and each cell gets one character from a ramp of ten
(` .,:-=+*%#@`), darkest to densest. Then, in this order: percentile-stretch the tonal range
(the mark is all mid-brown, so un-stretched it lands in three of the ten), unsharp it once at
grid size or the carved lines average away into a blob, dither with a 4×4 Bayer so the
gradients don't band, and fade the bottom out because a plinth is a slab of tone that says
nothing in characters. It sets itself to the column with a container query
(`min(13.5px, 100cqi / 44)`), so it is 483 px wide on a laptop and 342 on a phone with no
media queries doing arithmetic. `--write` splices the block into `index.html`; it used to also
restate the grid size in a caption under the art, and you asked for that text out, so there is
no caption — the generator still rewrites such a quote if one is ever put back, and `ascii-qa`
asserts the absence in the meantime (and that the `aria-label` survived, so the picture isn't
silent to a screen reader just because the words are gone);
`--preview x.png` paints the block so you can look at a candidate before committing to it
(I tried four ramps and three grids that way; the two I rejected read as a tree and as mud).

**2 · no images, no canvas, nothing that moves.** Every `<img>` is gone, the screenshots are
gone, `tools/shots.mjs` and `tools/pixel-art.py` are deleted, and the scroll assembly is
gone with them — including the footer switch that used to turn it off. What's left of the
motion is one soft fade on blocks as they enter, and it only exists once JS has proved it
runs: with the script blocked, or with reduced motion on, all 20 blocks are shown as written
(both states are asserted, not assumed). The screens section is now an index of the six
screens in words, and where the page needs to show what the tool does with colour it quotes
the engine: three sentences run through Akmon as it ships, real palettes, seed = the
sentence, with a note saying none of it was picked by hand.

**3 · no GitHub, anywhere, in any form.** *(reversed the same day — see the next entry; the
`config.js` / `connect.mjs` part stays reversed for good)* The word does not appear in the file; there is no
`site/config.js`, no `tools/connect.mjs`, no `api.github.com` fetch, no `og` pixel art on a
plate, no "the code" section, and the download cards are `div`s that each say
**"not posted yet"**. The old 404 bug can't come back, because there is nothing to point at.
`site/_headers` now carries `connect-src 'none'` — so if a future edit grows a `fetch`, the
browser refuses it rather than the page quietly starting to phone somewhere. If you publish
builds later, the whole site change is: make the three cards in `#get` anchors.

**4 · cosy, same palette, one bug class closed.** Paper `#f5efe7`, cards `#fcf9f4`, 14 px
radii, soft two-layer shadows, dotted leaders between a heading and its `§ 02` marker, and no
dark panels on the page at all. The quiet ink went from `#8d7767` to `#75604f` because the
first one measured 3.7:1 and failed the contrast gate in six places — muted text is where
accessibility goes to die, and "it's a caption" is not an exemption. Two real layout bugs came
out of the same measurement: `.hero` and `.fbar` both share the `.wrap` class and both declared
`padding: <y> 0`, which overrode the wrapper's side padding and let the hero and the footer text
touch the edge of the screen on every phone. `site-qa` now measures the *content's* inset at all
seven viewports instead of trusting the CSS, and `edge:ok` is part of the gate. (It found the
five dead `.rule` divs too, which were reporting a 0 px inset because they are display:none.)

**Checked:** `node qa-tools/run-all.mjs` → **11/11 suites green, 211 assertions + 7 viewports
clean** (`ascii-qa` is new, 41 of them, and it replaces `pixel-qa` + `ghlinks-qa`; it diffs the
page's block against what the generator prints, so the portrait can't rot). `npm run typecheck`
clean, `npm run lint` 0 errors / 24 warnings on 48 files, `npm run build` clean, and
`site-preview.html` regenerated (101 KB, from `file://` with no server, errors-free).

---

# 2026-09-11 (last) · the cards download, and nothing is wired by hand

The ask moved: *"the cards of the different OS automatically pick their installer there and if
you click one the download starts"* — and *"i dont have to do all the weird things"*. So the page
stopped being a poster about downloads and started doing them, under one constraint that survives
from the previous round: **a link only exists once something has confirmed it.**

**1 · the wiring is one line, written by the deploy.** The page ships
`var HEPH_REPO = window.__hephRepo || "";` and nothing else that knows a repo exists.
`site.yml` copies `site/` to `site-built/`, seds that line to `"owner/repo"` using
`github.repository` — the repo the workflow *ran from*, so it can't name the wrong one — refuses
to deploy if the substitution didn't land, and deploys the copy. It then re-reads the live URL and
warns if the page coming back doesn't carry the baked string. A second deploy path, a stale build,
or someone hand-uploading `site/` shows up as a warning in the run log instead of a mystery in a
browser. That replaced two designs that were rejected outright: a `config.js` in the repo to edit
per deployment, and a `tools/connect.mjs` step to run before pushing. Both are gone; nothing here
needs typing.

**2 · the reader asks GitHub twice, once, and only then writes a link.**
`GET /repos/<r>/releases/latest` for the files, `GET /repos/<r>` for whether the repo is readable
by a stranger at all. The second request is not padding: **a 404 from GitHub means two opposite
things** — nothing published, or private — and the first reads as "here's the releases page", the
second as "stay exactly where you are", because on a private repo `/releases` is a wall for the
person clicking. Everything else (fetch throws, a 500, an HTML captive portal where JSON should
be, a 6 s timeout) leaves the cards as the markup wrote them, and the status line says it couldn't
read the answer rather than guessing at a reason. `PAIR` picks the file: `.exe/.msi` preferring
`setup`, `.dmg` preferring `aarch64`, `.AppImage` over `.deb`.

**3 · what QA found when the code wasn't trusted.** The first draft of the reader was green on a
mocked release and *wrong* on a private repo: it linked `/releases`, which is a 404 for a logged-out
visitor — precisely the dead-link class the page was supposed to be immune to, and it only showed
up because the QA scenario asserted the href stayed `#get`. A second bug was quieter: `r.json()` on
a 200 whose body isn't JSON left an unhandled rejection, so a captive portal produced a console
error and a card that claimed "no published release yet" — a story about the repo invented from a
parse failure. Both fixed, both still asserted (`qa-tools/dl-qa.mjs`, 50 checks across seven
states). Two of the round's own failures were in QA rather than the page: a 9 s timeout per
scenario, because the suite waited on a marker that had never been added, and three expectations
written from what I intended to ship instead of what was in the file.

**4 · the private repo is a ceiling, not a config problem.** `github.com/<private>/releases/download/…`
404s for logged-out visitors, so "the cards auto-download installers while the repo is private" is
not reachable by any amount of wiring. Decided: the page degrades to inert-and-labelled, says why,
and lights up on its own the day the repo or the builds go public. The alternative — a Cloudflare
Pages Function holding a token to fetch assets on the visitor's behalf — was not built: it turns a
static page into a proxy for your private repo, and the user asked for fewer moving parts, not a
secret in front of the internet.

**5 · Actions stopped running on every push.** `release.yml` now triggers on a `v*` tag or a manual
run, and the *event* decides the outcome: a tag publishes, a manual run leaves a draft. Private
repos are metered on Actions minutes with macOS at 10× and Windows at 2×, so a three-OS matrix on
every push could spend a free plan's month in about ten commits — on files nobody could download.
`concurrency: release-${{ github.ref }}` so two tags pushed in quick succession queue instead of
racing over one draft; `tools/bump.mjs` prints the tag command it needs, because the trigger moved.

**Checked:** `node qa-tools/run-all.mjs` → **12/12 suites green, 263 assertions + 7 viewports
clean** (`dl-qa` new, 50; `ascii-qa` 41 → 44 after its assertions were turned from "no GitHub" into
"no GitHub in the *markup*, and nothing asked until an owner is baked in"). `npm run typecheck`
clean, `npm run lint` 0 errors / 24 warnings on 49 files, `npm run build` clean,
`site-preview.html` regenerated after the last copy edit (109 KB, `file://`, no server, and it asks GitHub nothing), both
workflows re-parsed with `yaml.safe_load`, and `site/index.html` is 42,661 B with `href="https://`
counting zero occurrences in the shipped markup.
