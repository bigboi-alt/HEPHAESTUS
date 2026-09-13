# HEPHAESTUS

**Visual website builder & colour forge that runs on maths, not models.**

No cloud, no API keys, no telemetry. Everything runs locally —
the only outbound request is a version check you can switch off.

[Download](https://hephaestus-app.pages.dev/#get) · v0.5.2

---

## What it does

### Akmon — palette engine

Type what you want in plain English. It understands colour names, moods,
hex values, roles (`navy background`), schemes (`triadic`, `split`),
and industry shorthands (`trustworthy fintech`).

Output is eight semantic roles — background, surface, border, text, muted,
primary, secondary, accent — not a random row of squares. Every generation
runs an accessibility repair pass: body text clears 7:1, interactive colours
clear 3:1, and colliding roles get separated.

Colours are generated in OKLCH and gamut-mapped properly, so the space is
effectively unlimited — not a list of presets being shuffled.

Also: per-role locking, variation, crossbreeding, colour-vision simulation,
tonal ramps, and export to CSS / SCSS / Tailwind / JSON / SVG.

---

### Cedalion — design critic

Scores your palette out of 100 across six categories: contrast & legibility,
colour-vision safety, harmony, distinctiveness, purpose fit, and trend
alignment. Findings come with evidence (`#7A8B99 on #101314 = 3.81:1`)
and one-click fixes where possible.

The conversation side covers colour theory, typography, spacing, dark mode,
accessibility, and every trend in the library — with your current palette's
numbers injected into the answers.

---

### Trend intelligence

- **Curated library** — 20 researched entries with status, visual signals,
  and implementation recipes. Ships offline.
- **Direction engine** — decomposes trends into atoms across six axes
  (layout, typography, colour, surface, motion, interaction) and recombines
  them into scored, exportable directions.
- **Catalogue** — 1,750 searchable entries with implementation recipes
  that are a list of clicks, not an adjective.

---

### Build — visual website builder

- 24 purposes across 14 sectors, each with briefs and section presets
- Live preview at four widths — the same HTML the export writes
- 12 site options (typeface, corners, depth, motion, airiness, etc.)
  honoured by both the editor and the exporter
- Merkhet measures, repairs, then measures again — no tick for a fix
  it hasn't verified

---

### The forge mark

One palette per person, derived from time, place, and weather. Graded
on the anvil out of 100 across six components (harmony, lightness ladder,
contrast, chroma discipline, colour-blind separation, distinct roles).
Forged once, then frozen — an identity, not a mood.

Seven bands from Raw Iron to Divine Forge. The score is the floor of
its weakest component.

---

## Running it

```bash
npm install
npm run dev          # web → http://localhost:5173
npm run build        # static output in dist/

# desktop (needs Rust 1.77+)
npm run tauri dev    # native window with hot reload
npm run tauri build  # installers in src-tauri/target/release/bundle/
```

Three runtime dependencies: `react`, `react-dom`, `zustand`.
The colour science, trend library, and critic are all first-party
TypeScript with zero dependencies.

---

## Architecture

```
src/
  engine/
    color.ts          sRGB ↔ OKLab ↔ OKLCH, contrast, CVD, gamut mapping
    vocabulary.ts     210 colour anchors, modifiers, mood profiles
    akmon.ts          prompt parsing, palette generation, export
    cedalion.ts       audit engine + conversation
    cedalionBrain.ts  conversational intent + knowledge base
    directions.ts     trend atom recombination
  data/trends.ts      curated trends + purposes + atoms
  lib/storage.ts      persistence interface
  screens/            Home, Akmon, Library, Trends, Build, Settings
  store.ts            zustand state
```

The engines are pure TypeScript with no React and no I/O — they can
be dropped into a CLI, a Figma plugin, or a CI check.

---

## Shipping a release

```bash
node tools/bump.mjs 0.5.2                          # bumps all three configs
node tools/release-manifest.mjs --check-config      # verify they agree
git add -A && git commit -m ".." && git push
git tag v0.5.2 && git push --tags                   # triggers the build
```

The pipeline builds installers for Windows, macOS (ARM + Intel), and Linux,
then deploys them to Cloudflare Pages. No GitHub Release — installers
are served from your own host.

---

## Updates

The app checks for updates once a day (switchable in Settings).
When an update is available, click **get update** — it downloads
and installs silently in the background, then relaunches. No browser,
no manual steps.

---

## Naming

Hephaestus was thrown off Olympus and built better things than the
gods who threw him. **Akmon** is the anvil. **Cedalion** carried
the blinded smith on his shoulders and pointed him at the sunrise —
he didn't do the work, he pointed. That's the job here.

---

MIT · [hephaestus-app.pages.dev](https://hephaestus-app.pages.dev)
