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

**Keeping it current:** set a raw JSON URL in Settings and the app merges an updated `trends.json`
by id. You push one file to a public gist or repo; every installed copy learns the new trend. Free,
no server, no build.

### The rest

- 24 purposes across 14 sectors, each with a brief, priorities, the sections you'll actually need, and a trend posture
- Library of saved palettes as minimal cards — search, sort by Cedalion score, favourite, import/export JSON
- Live preview applying your palette to a landing page, dashboard and storefront
- Five shell themes (Obsidian, Graphite, Paper, Blueprint, Ember), accent colour, density, motion toggle
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

## Desktop + distribution (scaffolded)

`src-tauri/` wraps the whole app (Tauri 2, ~10 MB installers instead of Electron's ~100 MB —
the app was already offline-first and dependency-light, so this is a wrapper, not a rewrite).
The icon in `src-tauri/icons/` is generated from `tools/icon.cjs` (`node tools/icon.cjs`,
then `npx tauri icon src-tauri/icons/app-icon.png`).

**The release pipeline lives in `.github/workflows/`:**

| Workflow | When | What it does |
|---|---|---|
| `release.yml` | every push to `main`/`master` | builds Windows (x64), macOS (aarch64 + x86_64), Linux (deb + AppImage) and uploads everything to a **draft** GitHub Release tagged `v<version>` |
| `site.yml` | push touching `site/`, or manual | deploys `site/` (the downloads page) to Cloudflare Pages — only runs once the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets exist |

**Version bumps** — the version lives in three places; this keeps them in sync:

```bash
node tools/bump.mjs 0.2.0
```

### To ship a release

1. `node tools/bump.mjs 0.1.1`, commit, push. Actions builds the draft `v0.1.1` release.
2. When the run is green, open **Releases → Drafts** on github.com and click **Publish release**.
3. The download page (`site/index.html`, deployed to Cloudflare Pages) reads the latest
   release from the GitHub API — once the repo is public, the buttons fill themselves in.
   While the repo is private the page says releases are unreachable, which is GitHub
   enforcing privacy, not a bug.

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
3. Optional but recommended: Workers & Pages → **Create → Pages → Upload assets** → project name `hephaestus-downloads` (first deploy also auto-creates it, this just makes it visible first).
4. github.com repo → **Settings → Secrets and variables → Actions → New repository secret**, twice:
   - name `CLOUDFLARE_API_TOKEN`, value = token from step 1
   - name `CLOUDFLARE_ACCOUNT_ID`, value = ID from step 2
   Names must match **exactly** — a typo is a silent skip, not an error.
5. Run the **site** workflow manually once (repo → Actions → site → Run workflow), then open `https://hephaestus-downloads.pages.dev`. Buttons stay disabled until the repo is public — GitHub refuses anonymous reads of private releases, which is correct behaviour.

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
