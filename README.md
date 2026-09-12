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
- Akmon is two labelled swatch grids — *surfaces* (background, surface, border, text, muted, each with a
  whisper of the brand hue) and *voice* (primary, secondary, accent) — every swatch editable in place,
  click-to-copy, locked or unlocked, with a contrast grade per pair and Cedalion's read across the top
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

That's the release gate: 12/12, 432 assertions plus nine viewports of the live page, and
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

**The release pipeline lives in `.github/workflows/`, and it has one rule: GitHub builds,
Cloudflare delivers.**

```
tag v0.4.0  →  4 native runners build installers  →  temporary artifacts
                                                            ↓
                     one publish job: validate → place in /downloads/ → write release.json
                                                            ↓
                             preview deploy → verify every file → promote → verify again
                                                            ↓
                                   visitors download from your own hostname
```

| Workflow | When | What it does |
|---|---|---|
| `release.yml` | **a `v*` tag**, or a manual run | builds the four native targets, then a single `publish` job validates the batch (`tools/release-manifest.mjs`), assembles the deployable site with the installers inside it, deploys to a throwaway preview branch, fetches every listed file back to prove it landed at the right size, and only then promotes to production. A manual run **defaults to build-and-validate only**; publishing needs the `publish` box ticked, or a tag. Runs queue on one shared lock instead of racing |
| `site.yml` | push touching `site/`, or manual | deploys the page to Cloudflare Pages. It first carries the *live* `release.json` and `downloads/` into the new bundle, so a docs push can never demote a published release. Verifies the URL it just deployed, and that the release file it now serves still reads |

**There is no GitHub Release, deliberately.** Not because releases are bad but because they put a
stranger's download behind someone else's web server: installers would live on `github.com`, the
page would have to ask `api.github.com` who the newest one is, and every visitor's browser would
need that to work. So the files are published as ordinary static files on the site's own host —
`/downloads/Hephaestus_0.4.0_x64-setup.exe` — with a small generated `release.json` beside them
listing what exists, its byte size and its sha256. Consequences worth having: the repository can be
**private** with no effect on downloads, GitHub can be down and the site keeps serving, and no
visitor leaks anything to a third party. Nothing on `site/` mentions GitHub at all, and
`qa-tools/ascii-qa.mjs` fails the build if that ever stops being true.

**The site** lives in `site/` — one static page, no build step, coffee-and-cream, the hero portrait
set in text characters measured off the mark. Five platform cards (Windows, Apple Silicon, Intel,
AppImage, .deb) read `/release.json` from the same origin, and say one of exactly three things:
filled with a real file (name, size, short hash), *not in this release*, or *not published yet*. A
button is never a guess: when the file cannot be confirmed the link stays the in-page anchor it was
authored as. Older releases are listed from the same file — kept for five versions, because the
publish job carries the previous bundle forward instead of deleting it (`site/_headers` also serves
`/downloads/*` as `immutable` + `Content-Disposition: attachment`, and `release.json` with a 60-second
revalidate so a bad manifest is fixable within the hour). `qa-tools/dl-qa.mjs` drives the page against
bundles that are complete, partial, empty, malformed, size-lying and off-site-pointing — the last two
of which a browser cannot detect, and which the pipeline's own `tools/verify-release.mjs` rejects.
`node tools/site-preview.mjs` builds the single-file offline copy. Full notes:
[`site/README.md`](site/README.md).

**Version bumps** — the version lives in three places; this keeps them in sync (and the pipeline
refuses a batch that disagrees):

```bash
node tools/bump.mjs 0.4.0        # package.json + Cargo.toml + tauri.conf.json, prints the tag to push
node tools/release-manifest.mjs --check-config            # the same check CI runs, in two seconds
node tools/release-manifest.mjs --print-required          # which files a release must contain, read
                                                          # from tauri.conf's bundle.targets
```

### To ship a release

1. `node tools/bump.mjs 0.4.0`, commit, push.
2. `git tag v0.4.0 && git push --tags` — that is the publish trigger, and the only automatic one.
3. Watch Actions → `release`. Four builds, then the `publish` job. It prints the batch it accepted,
   the preview URL it verified, and the production URL it re-verified. `site/index.html` needs no
   edit and no redeploy: it reads `release.json`, which the job just rewrote.
4. If any platform is missing, empty, or named for another version, the job fails **before** the
   deploy step and the live release keeps serving what it served. Nothing is deleted either way,
   so a failed release never takes the old ones down.

To check a release **without** shipping it — the run to use first, since a private repo pays macOS
minutes at 10x: Actions → **release** → *Run workflow*, leaving **publish** unticked. It builds all
four platforms, runs every validation rule, writes nothing, and tells you at the end what a publish
would have done. Tick `publish` on the same form to do the deploy; tick `republish` only if you are
deliberately re-shipping a version that is already live (the gate otherwise stops you, because the
usual answer to "the release is wrong" is a new version number).

| You want to… | Do |
|---|---|
| ship a version | `node tools/bump.mjs 0.4.0`, push, `git tag v0.4.0 && git push --tags` |
| build everything and change nothing | Actions → release → Run workflow (leave `publish` off) |
| re-run a deploy that failed on a missing secret | same form, `publish` ticked — the artifacts live 7 days |
| ship only the page | push under `site/` (or run **site**); the live release rides along untouched |
| push app/code changes | nothing to remember: no push trigger on `release.yml`, so a normal commit spends zero macOS minutes and `[skip ci]` is not needed |

### Secrets — what lives where

| Secret | Needed for | Where it lives | In repo files? |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | the deploy steps in both workflows | GitHub → repo **Settings → Secrets and variables → Actions** | never |
| `CLOUDFLARE_ACCOUNT_ID` | same (tells wrangler which account) | same place | never |
| `PAGES_PROJECT` *(a variable, not a secret)* | only if `hephaestus-app` is taken and you want another subdomain | the **Variables** tab of the same page | default is in the workflow |

Nothing else is required, and this repo does not invent what isn't. A preflight run needs **no**
secrets at all; a publish run stops with a readable error if either Cloudflare secret is missing,
after the build and before the deploy. The names above are the only credential references in either
workflow — `qa-tools/manifest-qa.mjs` asserts that, so a future edit cannot quietly start reading
an undefined secret.

Deliberately **not** configured, because none of it is real yet (each is documented so nobody has to
guess, and none is faked):

- **Tauri updater signing** (`TAURI_SIGNING_PRIVATE_KEY` + `_PASSWORD`, with the public half in
  `tauri.conf.json`). `plugins` is `null` in that config: there is no updater, so in-app "check for
  updates" does not exist and this workflow will not pretend otherwise. Downloading the new file is
  the update path. Wiring an updater is its own job — it needs a key generated on your machine and
  kept out of this repository, and its own QA, not a placeholder key.
- **Apple Developer ID + notarization.** No certificate, no notary credentials, no signing step, and
  no claim of any of it: the manifest says `"signing": {"macos": "unsigned, not notarised"}` and the
  page tells visitors to right-click → Open once. If you ever buy the account and sign properly,
  change that field and the sentence — the site shows what the file says rather than what it hopes.
- **Windows code signing.** Same story: no certificate, no claim.

**Setup order for Cloudflare (do it when you want the site live — desktop releases need none of this):**

1. dash.cloudflare.com → top-right avatar → **My Profile → API Tokens → Create Token** → **Create Custom Token**:
   - token name: `hephaestus-pages`
   - permission: **Account → Cloudflare Pages → Edit** (nothing else)
   - Account resources: **Include → your account**
   - Create → **copy the token now** (Cloudflare shows it only once)
2. **Account ID**: dash.cloudflare.com home page → right column → copy the long hex ID.
3. Nothing to create in Cloudflare. The workflow asks the Pages API whether the project name it wants —
   `hephaestus-app` — is yours. Free: it creates it with `main` as the production branch. Yours from a
   previous run: it deploys straight in. **Someone else's: it stops and says so**, because
   `wrangler pages deploy` would otherwise mint a suffixed clone (`hephaestus-app-x9k`) and cheerfully
   report success. Want a different subdomain? Add an Actions **variable** named `PAGES_PROJECT` — the
   project name *is* the subdomain, and Cloudflare cannot rename one later.
4. github.com repo → **Settings → Secrets and variables → Actions → New repository secret**, twice:
   `CLOUDFLARE_API_TOKEN` (step 1) and `CLOUDFLARE_ACCOUNT_ID` (step 2). Names must match **exactly** —
   a typo is a silent skip on a docs deploy, and an explicit failure on a release.
5. Run the **site** workflow once (repo → Actions → site → Run workflow). Its last step loads the URL it
   just deployed, checks it is this page, and reads `/release.json` back — so the run summary is either
   "verified" or an error, never an assumption.
6. Then a release: preflight first, tag when it is green. Nothing else is wired up by hand.

**Minutes and limits, honestly.** Public repos get unlimited Actions minutes; a private repo on the
Free plan gets 2,000/month with macOS counted 10x and Windows 2x, and the default spend limit of $0
makes running out a hard stop rather than a bill. That is why `release.yml` has no push trigger and
why manual runs are preflight by default. And it is why the split matters: **Cloudflare Pages serves
the site and its downloads from its own storage**, so a month with no buildable minutes can stop a
new release and cannot break the page, the buttons, or a single existing download.

**If a deploy goes wrong.** The publish job verifies the preview before promoting and production
after, so the failure modes are: preview verification fails (nothing promoted, run red, live site
untouched), or production verification fails (run red, and the log prints the previous deployment's
id via `wrangler pages deployment list`, because Cloudflare keeps every deployment and
Pages → *your project* → *Rollback* restores one). There is no state in which the live site
advertises a file that is not there — that is what the verification step is for, not a hope.

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
