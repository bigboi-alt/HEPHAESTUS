# HEPHAESTUS

**A design forge that runs on maths, not models.**

Palette engine, trend intelligence, and a critic that shows its numbers. No AI, no API keys,
no network calls, no paid services. Everything it claims, it can prove with a measurement.

- **Akmon** — the anvil. Natural language in, an eight-role, accessibility-checked colour system out.
- **Cedalion** — the guide. Audits what you make, answers questions, always with the number attached.
- **Trend library + direction engine** — what 2026 actually settled on, decomposed into parts that recombine.

---

## Running it

```bash
npm install
npm run dev        # web: http://localhost:5173
npm run build      # static output in dist/ — deploy anywhere
npm run typecheck

# desktop (needs Rust 1.77+ — https://rustup.rs)
npm run tauri dev     # native window with hot reload
npm run tauri build   # local release bundles in src-tauri/target/release/bundle/
```

Node 20+. Three runtime dependencies: `react`, `react-dom`, `zustand`. The colour science,
the trend library and the critic are all first-party code with zero dependencies. The only
dev-time extras are `vite`, `typescript`, `@tauri-apps/cli` and the React type packages.

---

## What's built

### Akmon — the palette engine

Type what you want in plain English. The parser understands:

| Input | What it does |
|---|---|
| `deep dusty teal` | anchor colour + stacked modifiers (`deep` + `dusty` applied as OKLCH deltas) |
| `burnt orange accent` | role assignment — that colour becomes the accent and keeps its own chroma |
| `navy background` | the named colour becomes the neutral family; every surface derives from it |
| `trustworthy fintech` | mood detection → hue windows, chroma band, contrast floor, scheme preference |
| `#1F6FEB` | raw hex anchors |
| `dark` / `light mode` | mode override |
| `triadic`, `monochrome`, `split` | scheme override |

Output is eight semantic roles — `background surface border text muted primary secondary accent` —
not a random row of squares. Every generation runs an accessibility repair pass: body text is
lifted until it clears 7:1, interactive colours until they clear 3:1, and any two roles that
collapse into each other get separated.

**Why it's not limited:** colours are generated in **OKLCH** and gamut-mapped by chroma reduction
(binary search), so hue and lightness survive the trip into sRGB. The addressable space is
1000 lightness × 400 chroma × 3600 hue steps per swatch across 8 roles — about `10^73` distinct
palettes. It is not a list of presets being shuffled. 400 unlocked generations produce 400 unique
results, verified.

Also in Akmon: per-role locking, nudge/shake variation, OKLab/OKLCH/sRGB mixing (with the crucible
for melting many colours into their perceptual centroid), 11-step tonal ramps, colour-vision
simulation, crossbreeding two saved palettes, and export to CSS / SCSS / Tailwind / JSON / SVG.

### Cedalion — the critic

Scores anything on screen out of 100 across six weighted categories:

| Category | What it measures |
|---|---|
| contrast & legibility (30%) | WCAG 2.2 ratios for every meaningful pair, including text on raised surfaces |
| colour-vision safety (15%) | LMS-projection simulation of protanopia, deuteranopia, tritanopia; flags pairs that collapse |
| harmony & structure (20%) | lightness spread, mid-tone crowding, chroma discipline, awkward hue gaps, neutral tinting |
| distinctiveness (15%) | ΔE in OKLab between every role pair — catches roles doing no work |
| purpose fit (12%) | too loud for fintech, too timid for a portfolio, warning-hue collisions, contrast floors |
| trend alignment (8%) | which curated trends the palette's measurable shape actually matches |

Findings come with evidence (`#7A8B99 on #101314 = 3.81:1`) and, where possible, a one-click fix
that computes the corrected value rather than just complaining.

The conversation side is a deterministic intent matcher over a rule base covering colour theory,
contrast, accessibility, typography, spacing, hierarchy, motion, dark mode, and every trend in the
library — with live facts about your current palette injected into the answers. **When it doesn't
know something, it says so instead of inventing an answer.** That was a deliberate design decision:
a critic that bluffs is worse than no critic.

Cedalion is present on the home screen as a full console and everywhere else as a dock.

### Trend intelligence

Two layers, because "know the latest trends" and "have infinite ideas" are different problems.

**1. Curated library** (`src/data/trends.ts`) — 20 entries, each with status (core / rising /
polarizing / cooling), visual signals, when to use, when to avoid, machine-readable rules Cedalion
scores against, and an implementation recipe. Researched and hand-written, not scraped. Ships
inside the app so it works offline.

**2. Direction engine** (`src/engine/directions.ts`) — every trend is decomposed into interchangeable
atoms across six axes: layout × typography × colour behaviour × surface × motion × interaction.
Atoms carry compatibility rules and purpose affinities, so recombination produces coherent
directions rather than noise. 36,000 raw combinations before filtering, and the space grows
multiplicatively every time a single atom is added.

Each generated direction gets a fit score dragged down by its weakest decision, a rationale, explicit
cautions when it contradicts the purpose, and an exportable token file (radius, spacing, type scale,
motion, shadow, font stack). The first half of every set is safe; the second half is allowed to
argue with the brief — and gets flagged when it does.

**3. The catalogue** (`src/engine/catalog.ts`) — the two layers above composed into a searchable
library of **1,750 entries**: every layout atom × every accent atom × twelve registers (Atrium, Ledger,
Foundry, Vitrine, Signal, Marginalia, Atelier, Kiosk, Corridor, Console, Nook, Archive), with ids built
from the parts so a duplicate is impossible rather than merely unlikely. 1,390 combinations are refused
because their atoms fight each other. Each entry carries the numbers Cedalion scores against, a drawn
example generated from those numbers, and a recipe naming the exact grid preset, blocks, site options and
merkhet mode to use — so "implementable" is a list of clicks, not an adjective. Generation is deterministic
and happens once at startup; the screen pages 24 rows at a time.

**Keeping it current:** set a raw JSON URL in Settings and the app merges an updated `trends.json`
by id. You push one file to a public gist or repo; every installed copy learns the new trend. Free,
no server, no build.

### The rest

- 24 purposes across 14 sectors, each with a brief, priorities, the sections you'll actually need, and a trend posture
- Library of saved palettes as minimal cards — search, sort by Cedalion score, favourite, import/export JSON
- Build's ▶ preview opens the **exported site itself** — the same HTML string the .html download writes —
  full size, at four widths, with working links and transitions. Not a second renderer that can disagree
  with what you ship
- Twelve site options (typeface, text size, corners, card depth, image fill, motion, airiness, heading
  case, heading tracking, button shape, card outline, reset) that are honoured by the editor *and* the
  exporter — checked, not asserted
- Merkhet measures, repairs, then measures again: it reports how many problems it fixed, what is still
  open, and what it tried and put back because the page read worse. No tick for a fix it hasn't verified
- Akmon shows surfaces as a stack of planes with the perceptual distance between them, and voice as
  editable cards, plus a page fragment painted twice to make the difference between the two unmistakable
- Six shell themes (Obsidian, Graphite, Paper, Claude, Blueprint, Ember), accent colour, density, motion
  toggle — and Claude comes in two skins, Ambrosia (cream) and Nyx (dusted black with orange coals)
- Everything persists locally. No account, no telemetry, no network.

---

## Architecture

```
src/
  engine/
    color.ts        # sRGB ↔ OKLab ↔ OKLCH, WCAG contrast, CVD simulation, ΔE, gamut mapping
    vocabulary.ts   # 210 colour anchors, compositional modifiers, 10 mood profiles
    akmon.ts        # prompt parsing, palette generation, variation, crossbreeding, export
    cedalion.ts     # the audit + the deterministic answer engine
    directions.ts   # trend atom recombination and scoring
  data/trends.ts    # curated trend library + purpose library + atoms
  lib/storage.ts    # Store interface, LocalStore, CloudStore seam for Firebase
  screens/          # Home, Akmon, Library, Trends, Build, Settings
  components/       # TopBar, CedalionDock, AuditPanel, PaletteCard, PalettePreview
  store.ts          # zustand state, debounced persistence
```

The engines are pure TypeScript with no React and no I/O — they can be lifted into a CLI, a Figma
plugin, or a CI accessibility check without modification.

Persistence goes through one narrow `Store` interface. Adding Firebase later means implementing
`CloudStore` and nothing else — no screen or engine knows where data lives.

---

## Checking it

Twelve suites live in [`qa-tools/`](qa-tools/README.md). They drive the real app and the real
site in a browser — nothing is stubbed, and where a picture matters the assertion recomputes
what the picture should have said, so a suite can't be satisfied by a lucky screenshot.

```bash
npm run dev -- --port 5199                        # the app
python3 -m http.server 8099 --directory site      # the site
cd qa-tools && npm i && npx playwright install chromium && node run-all.mjs
```

That's the release gate: 12/12, 302 assertions plus seven viewports of the live page, and
`run-all.mjs` exits non-zero if any of them complains. `npm run typecheck` (`tsc -b`, not `tsc --noEmit` — the root config is a
solution file and the latter silently does nothing) and `npm run lint` (oxlint, which also
covers `tools/` and `qa-tools/`) are expected to come back clean.

The site's portrait is generated, not placed: `python3 tools/ascii-art.py --write` measures the
mark on a 72-cell grid and writes the characters into `site/index.html`, and the gate fails if
the page and the generator drift apart. The page carries no screenshots and no images at all.

---

## Desktop + distribution (scaffolded)

`src-tauri/` wraps the whole app (Tauri 2, ~10 MB installers instead of Electron's ~100 MB —
the app was already offline-first and dependency-light, so this is a wrapper, not a rewrite).
The icon in `src-tauri/icons/` is generated from `tools/icon.cjs` (`node tools/icon.cjs`,
then `npx tauri icon src-tauri/icons/app-icon.png`).

**The release pipeline lives in `.github/workflows/`:**

| Workflow | When | What it does |
|---|---|---|
| `release.yml` | **a `v*` tag, or a manual run** — deliberately not every push | builds Windows (x64), macOS (aarch64 + x86_64), Linux (deb + AppImage) and puts them on a release tagged `v<version>`: a tag push **publishes** it, a manual run leaves a **draft**. Runs queue per tag rather than racing over one draft |
| `site.yml` | push touching `site/`, or manual | writes this repo's name into the built page (the one thing the cards and the release list need), deploys it to Cloudflare Pages, prints what GitHub will answer a visitor, and verifies the live URL carries the write. Only runs once the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets exist |

**The site** lives in `site/` — one static page, no build step, coffee-and-cream, the hero
portrait set in text characters measured off the mark. Its three download cards and its list of
**every** release both read `bigboi-alt/HEPHAESTUS` at run time: the newest stable release's file
for your system on the card, the whole release history underneath, sizes and all. The one line that
names the repo is a working default, and `site.yml` overwrites it with whatever repo the deploy ran
from — which is why there is no `config.js`, no connect step, and nothing to edit after publishing.
When there is nothing to confirm, the card stays the anchor it already was and says so;
`qa-tools/dl-qa.mjs` drives twelve of those states against a stand-in GitHub, including a release
whose name is really HTML and an asset whose URL is really `javascript:`. `site/_headers` narrows
`connect-src` to `'self' https://api.github.com`, so that reader is the only way this page can
reach outside itself. One honest ceiling: **GitHub will not hand release files to anonymous
visitors on a private repo**, so while the repo is private the cards stay inert and labelled —
they light up by themselves the day it goes public. `node tools/site-preview.mjs` builds the
single-file offline copy. Full notes, including the two ways to wire up Cloudflare Pages:
[`site/README.md`](site/README.md).

The emblem is transparent-backed in two inks — light marble for dark themes, brown for light
ones — chosen by CSS from `[data-theme]`, so it never sits on a black plate and never
disappears on a pale background.

**Version bumps** — the version lives in three places; this keeps them in sync:

```bash
node tools/bump.mjs 0.2.0
```

### To ship a release

1. `node tools/bump.mjs 0.2.0`, commit, push, then `git tag v0.2.0 && git push --tags`.
2. That tag is the whole release: Actions builds all three systems and **publishes** `v0.2.0`.
   Nothing to click on github.com, and no run needed if you'd rather look first — press
   **Run workflow** instead and it stops at a draft you can publish by hand.
3. The download page needs no step at all: its cards and its release list read this repo when a
   visitor loads the page, so they pick up `v0.2.0` on the next load after the tag — no redeploy,
   no edit. Running `site.yml` at least once is still worth it, because that overwrites the repo
   the page asks with the repo the deploy actually ran from.
   While the repo is private the cards say so instead of linking — that is GitHub enforcing
   privacy on strangers, not a bug in the page.

### The release ritual (one version at a time)

A push does NOT always create a new release — it creates **or updates** the draft for the
version that is currently set. That is deliberate: you keep pushing refinements to the same
draft until you're happy, then you publish it once. The moment something is **published**,
the workflow refuses to touch it again and tells you to bump:

| You want to… | Do |
|---|---|
| ship a version | `node tools/bump.mjs 0.2.0`, commit, push, `git tag v0.2.0 && git push --tags` — builds and publishes; the site notices by itself |
| build without shipping | Actions → **Release** → Run workflow — same three OSes into a **draft** you can test, then publish or delete |
| refresh a draft you already have | run it again for the same tag — `tauri-action` updates that draft instead of minting a second one |
| push docs, site or workflow changes | nothing to remember: the release workflow has no push trigger, so a normal commit spends zero macOS minutes and `[skip ci]` is not needed |

You can tell which build a draft holds by its run time: a run that finishes in ~4 minutes
(caches warm) still uploaded fresh installers — always re-download before testing.

### Secrets — what lives where

| Secret | Needed for | Where it lives | In repo files? |
|---|---|---|---|
| `GITHUB_TOKEN` | creating releases/uploading installers | automatic — GitHub injects it every run | never |
| `CLOUDFLARE_API_TOKEN` | deploying the download site | GitHub → repo **Settings → Secrets and variables → Actions** | never |
| `CLOUDFLARE_ACCOUNT_ID` | same (tells wrangler which account) | same place | never |
| Tauri updater signing key (later) | signing auto-update manifests | same place, when auto-update is wired in | public half only, deliberately |

**Setup order for Cloudflare (do it when you want the site live — desktop releases need none of this):**

1. dash.cloudflare.com → top-right avatar → **My Profile → API Tokens → Create Token** → **Create Custom Token**:
   - token name: `hephaestus-pages`
   - permission: **Account → Cloudflare Pages → Edit** (nothing else)
   - Account resources: **Include → your account**
   - Create → **copy the token now** (Cloudflare shows it only once)
2. **Account ID**: dash.cloudflare.com home page → right column → copy the long hex ID.
3. Nothing to create in Cloudflare. The workflow asks the Pages API whether the project name it wants — `hephaestus-app` — is yours. Free: it creates it with `main` as the production branch. Yours from a previous run: it deploys straight in. **Someone else's: it stops and says so**, because `wrangler pages deploy` would otherwise mint a suffixed clone (`hephaestus-app-x9k`) and cheerfully report success. Want a different subdomain? Add an Actions **variable** named `PAGES_PROJECT` with the name you want — the project name *is* the subdomain, and Cloudflare cannot rename one later. By-eye alternative: Workers & Pages → Create → Pages → Upload assets → project name `hephaestus-app`, then delete that test upload and let the workflow take over.
4. github.com repo → **Settings → Secrets and variables → Actions → New repository secret**, twice:
   - name `CLOUDFLARE_API_TOKEN`, value = token from step 1
   - name `CLOUDFLARE_ACCOUNT_ID`, value = ID from step 2
   Names must match **exactly** — a typo is a silent skip, not an error.
5. Run the **site** workflow manually once (repo → Actions → site → Run workflow). The last step of that job loads the URL it just deployed to and checks the page's `<title>` before it claims anything, so the run summary tells you the truth: **https://hephaestus-app.pages.dev**.
6. Nothing else to wire up. The page doesn't read GitHub, so a private repo changes nothing about it — no connect step, no placeholder owner, no button that could land on a 404.

Actions billing note: builds on **public** repos are unlimited/free; on **private** repos they burn the 2,000 free minutes/month. Since a public download site is the endgame anyway, flip the repo public when you start iterating releases.

### macOS signing (later)

Bundles are unsigned for now — first launch on macOS needs right-click → Open. Notarization
needs an Apple Developer account (paid) and is on the deferred list below.

---

## Roadmap

**Next: the Akmon canvas.** Infinite surface, frames, snapping, layers, and Cedalion scoring the
composition live — spacing rhythm, alignment, hierarchy, contrast on real elements. It is deliberately
not stubbed out. It depends on the palette engine, trend library, direction engine and critic all
existing first; they do now.

**Then, once the canvas has settled** (so we're not versioning a moving target through the pipeline):

1. ✅ Tauri wrapper — done, committed, waiting for its first real-machine build
2. ✅ GitHub Actions matrix — done; first run happens on your first push
3. ✅ Cloudflare Pages download site — done; add the two secrets and it deploys
4. ⏳ **Auto-update** — Tauri's updater pointed at a `latest.json` published by `tauri-action`
   (needs an updater public key generated with `npx tauri signer generate`); add the plugin,
   sign bundles, ship
5. ⏳ **Mac notarization** — needs a paid Apple Developer account; optional

---

## Naming

Hephaestus was thrown off Olympus and built better things than the gods who threw him.
**Akmon** is the anvil. **Cedalion** is the man who carried the blinded smith on his shoulders and
pointed him at the sunrise — he didn't do the work, he pointed. That's the job here.
