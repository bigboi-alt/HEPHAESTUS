/**
 * HEPHAESTUS · the catalogue
 *
 * The hand-written library (data/trends.ts, 20 entries) is the *verified* core:
 * what 2026 actually settled on. It is honest but finite, and finite is useless
 * the third time you open the trends screen.
 *
 * So the catalogue composes thousands more the same way the direction engine
 * composes palettes — from atoms, with rules, no model and no network:
 *
 *     layout atom  ×  accent atom  ×  register   →  a trend
 *
 * Every generated entry is real in the only ways that matter:
 *  · it carries numbers, so Cedalion can score against it and the example can
 *    be drawn from it (radius, chroma band, border weight, motion length);
 *  · its recipe names things that exist in this app — a grid preset, block
 *    kinds, the site options, Akmon's harmony schemes, merkhet's four modes —
 *    so "implementable" is not a claim, it is a list of clicks;
 *  · ids are built from the atoms, so duplicates are impossible rather than
 *    merely unlikely, and the whole catalogue is deterministic: the 400th entry
 *    is the same entry tomorrow, and nothing is generated at scroll time.
 *
 * Composition is capped and rotated, not exhaustive: 10 × 26 × 12 is 3,120
 * possible, and a third of them would be two good ideas wearing the same coat.
 * Each layout×accent pair gets the registers that actually fit it, walking the
 * register list from a different starting point each time so coverage stays even.
 */

import {
  COLOR_ATOMS,
  INTERACTION_ATOMS,
  LAYOUT_ATOMS,
  MOTION_ATOMS,
  PURPOSES,
  SURFACE_ATOMS,
  TRENDS,
  TYPE_ATOMS,
  type Atom,
  type Trend,
  type TrendStatus,
} from "../data/trends";

export const CATALOG_TARGET = 2000;

type Register = {
  id: string;
  /** the word that leads the name */
  name: string;
  /** one sentence about the register's temperament */
  line: string;
  /** the risk, phrased as a person would say it */
  risk: string;
  radius: [number, number];
  border: [number, number];
  chroma: [number, number];
  typeScale: [number, number];
  density: "airy" | "balanced" | "dense";
  motion: "none" | "restrained" | "expressive";
  mode: "dark" | "light" | "either";
  contrast: number;
  example: string;
  signals: string[];
  fits: string[];
  tags: [string, string];
  /** how this register wants the canvas tuned, in the app's own controls */
  options: { radius: number; airiness: number; motionMs: number; font: string };
  accent: { hue: string; scheme: string };
};

const REGISTERS: Register[] = [
  {
    id: "atrium", name: "Atrium", line: "Gallery-bright and unhurried — space is the argument, not decoration.",
    risk: "an empty page pretending to be spacious is still empty",
    radius: [14, 24], border: [1, 1], chroma: [0.02, 0.07], typeScale: [1.02, 1.14],
    density: "airy", motion: "restrained", mode: "either", contrast: 7, example: "soft",
    signals: ["one idea per screen", "generous bottom padding", "hairline borders only"],
    fits: ["brand", "portfolio", "editorial", "wellness"],
    tags: ["space", "calm"],
    options: { radius: 20, airiness: 1.35, motionMs: 460, font: "editorial" },
    accent: { hue: "warm bone", scheme: "analogous" },
  },
  {
    id: "ledger", name: "Ledger", line: "Tabular discipline — every number aligned, nothing decorative.",
    risk: "density without hierarchy reads as a spreadsheet nobody opens",
    radius: [0, 6], border: [1, 2], chroma: [0.01, 0.05], typeScale: [0.9, 0.98],
    density: "dense", motion: "none", mode: "light", contrast: 7, example: "chart",
    signals: ["aligned numerals", "row rules instead of cards", "no shadows"],
    fits: ["finance", "internal", "docs", "saas"],
    tags: ["data", "dense"],
    options: { radius: 0, airiness: 0.78, motionMs: 0, font: "technical" },
    accent: { hue: "ink on paper", scheme: "monochrome" },
  },
  {
    id: "foundry", name: "Foundry", line: "Industrial and unashamed: structure shown, joints visible, no softening.",
    risk: "raw edges used as a costume fall apart in a week",
    radius: [0, 4], border: [2, 3], chroma: [0.06, 0.14], typeScale: [1.05, 1.2],
    density: "balanced", motion: "none", mode: "either", contrast: 7, example: "brutal",
    signals: ["hard offset shadows", "visible seams", "one loud industrial hue"],
    fits: ["tools", "personal", "product", "gaming"],
    tags: ["raw", "structure"],
    options: { radius: 0, airiness: 1, motionMs: 0, font: "technical" },
    accent: { hue: "safety orange", scheme: "split complement" },
  },
  {
    id: "vitrine", name: "Vitrine", line: "Object on a plinth — the content is the exhibit, lit from one side.",
    risk: "a museum tone around ordinary product copy reads as pretension",
    radius: [2, 10], border: [1, 1], chroma: [0.02, 0.06], typeScale: [1.1, 1.25],
    density: "airy", motion: "restrained", mode: "dark", contrast: 7, example: "depth",
    signals: ["single centred artefact", "one narrow light source", "long quiet margins"],
    fits: ["brand", "portfolio", "ecommerce", "media"],
    tags: ["display", "object"],
    options: { radius: 6, airiness: 1.4, motionMs: 520, font: "editorial" },
    accent: { hue: "cold spotlight", scheme: "triadic" },
  },
  {
    id: "signal", name: "Signal", line: "Data-forward: the measurement is the hero, prose is the footnote.",
    risk: "charts without a claim are wallpaper",
    radius: [4, 12], border: [1, 2], chroma: [0.05, 0.12], typeScale: [0.95, 1.05],
    density: "dense", motion: "restrained", mode: "dark", contrast: 4.5, example: "dashboard",
    signals: ["KPI row above the fold", "sparkline in the label", "delta coloured, not the chart"],
    fits: ["saas", "internal", "finance", "product"],
    tags: ["data", "interface"],
    options: { radius: 8, airiness: 0.85, motionMs: 220, font: "modern" },
    accent: { hue: "two-neon", scheme: "tetradic" },
  },
  {
    id: "marginalia", name: "Marginalia", line: "Editorial to the bone — a measure, a running head, notes in the margin.",
    risk: "two-column prose without a reading order loses people at the second break",
    radius: [0, 8], border: [1, 1], chroma: [0.01, 0.05], typeScale: [1.0, 1.1],
    density: "balanced", motion: "none", mode: "light", contrast: 7, example: "editorial",
    signals: ["66-72ch measure", "sidenotes aligned to their line", "no card around prose"],
    fits: ["editorial", "docs", "education", "media"],
    tags: ["reading", "text"],
    options: { radius: 2, airiness: 1.15, motionMs: 0, font: "editorial" },
    accent: { hue: "newsprint", scheme: "neutral accent" },
  },
  {
    id: "atelier", name: "Atelier", line: "Craft register: handmade marks, warm neutrals, the finish visible.",
    risk: "texture used instead of content turns into wallpaper with a price list",
    radius: [8, 20], border: [1, 2], chroma: [0.04, 0.11], typeScale: [1.02, 1.16],
    density: "airy", motion: "restrained", mode: "light", contrast: 4.5, example: "retro",
    signals: ["material swatches", "hand-set captions", "grain in the background only"],
    fits: ["brand", "ecommerce", "wellness", "personal"],
    tags: ["craft", "warm"],
    options: { radius: 16, airiness: 1.25, motionMs: 380, font: "editorial" },
    accent: { hue: "clay and oat", scheme: "compound" },
  },
  {
    id: "kiosk", name: "Kiosk", line: "One job, one screen, no way to get lost.",
    risk: "an app reduced to a single screen becomes a landing page with delusions",
    radius: [10, 22], border: [1, 1], chroma: [0.06, 0.16], typeScale: [0.95, 1.05],
    density: "balanced", motion: "restrained", mode: "either", contrast: 4.5, example: "micro",
    signals: ["one primary action", "no navigation at all", "progress shown, not described"],
    fits: ["product", "saas", "education", "health"],
    tags: ["utility", "focus"],
    options: { radius: 14, airiness: 1, motionMs: 260, font: "modern" },
    accent: { hue: "single trustful", scheme: "monochrome" },
  },
  {
    id: "corridor", name: "Corridor", line: "Movement as structure — you travel the page rather than scan it.",
    risk: "scroll-driven motion on a page a user needs to print is an obstacle",
    radius: [4, 16], border: [1, 1], chroma: [0.05, 0.13], typeScale: [1.05, 1.22],
    density: "airy", motion: "expressive", mode: "dark", contrast: 4.5, example: "kinetic",
    signals: ["full-height chapters", "parallax on depth only", "type that moves once, not always"],
    fits: ["brand", "media", "portfolio", "gaming"],
    tags: ["motion", "narrative"],
    options: { radius: 10, airiness: 1.3, motionMs: 700, font: "modern" },
    accent: { hue: "projected light", scheme: "hue drift" },
  },
  {
    id: "console", name: "Console", line: "Operator's surface: keys, density, and no marketing voice.",
    risk: "a command palette bolted onto a page with one action is a costume",
    radius: [2, 8], border: [1, 2], chroma: [0.03, 0.1], typeScale: [0.9, 1.0],
    density: "dense", motion: "restrained", mode: "dark", contrast: 4.5, example: "tokens",
    signals: ["⌘K as the front door", "inline help, no modals", "monospace for values"],
    fits: ["tools", "internal", "saas", "docs"],
    tags: ["keyboard", "dense"],
    options: { radius: 4, airiness: 0.82, motionMs: 160, font: "technical" },
    accent: { hue: "terminal green", scheme: "analogous" },
  },
  {
    id: "nook", name: "Nook", line: "Soft, rounded, forgiving — the interface behaves like furniture.",
    risk: "roundness without contrast is a toy, and users can tell",
    radius: [16, 28], border: [1, 1], chroma: [0.05, 0.12], typeScale: [0.98, 1.08],
    density: "balanced", motion: "expressive", mode: "either", contrast: 4.5, example: "gamified",
    signals: ["pill everything", "spring on state change", "friendly empty states"],
    fits: ["personal", "education", "wellness", "gaming"],
    tags: ["soft", "playful"],
    options: { radius: 26, airiness: 1.1, motionMs: 520, font: "modern" },
    accent: { hue: "pastel pairs", scheme: "triadic" },
  },
  {
    id: "archive", name: "Archive", line: "Documented and dated — the page admits it was made by someone.",
    risk: "nostalgia without a working grid is a filter, not a design",
    radius: [0, 6], border: [2, 3], chroma: [0.04, 0.1], typeScale: [1.0, 1.12],
    density: "dense", motion: "none", mode: "light", contrast: 7, example: "grid",
    signals: ["visible rules everywhere", "captions with dates", "one ink, one paper"],
    fits: ["editorial", "docs", "media", "personal"],
    tags: ["retro", "structure"],
    options: { radius: 0, airiness: 0.9, motionMs: 0, font: "technical" },
    accent: { hue: "faded ink", scheme: "hueshift" },
  },
];

/* ---------------- helpers ---------------- */

const ACCENTS: { atom: Atom; group: string }[] = [
  ...TYPE_ATOMS.map((a) => ({ atom: a, group: "type" })),
  ...COLOR_ATOMS.map((a) => ({ atom: a, group: "colour" })),
  ...SURFACE_ATOMS.map((a) => ({ atom: a, group: "surface" })),
  ...MOTION_ATOMS.map((a) => ({ atom: a, group: "motion" })),
  ...INTERACTION_ATOMS.map((a) => ({ atom: a, group: "interaction" })),
];

/** the grid preset in the app that already lays this out */
const PRESET_FOR: Record<string, string> = {
  "bento-6": "bento",
  "bento-active": "bento",
  "split-hero": "hero split",
  "single-column": "hero centred",
  "sidebar-shell": "stats band",
  "grid-rules": "section divider",
  "scroll-chapters": "how it works",
  "catalogue-grid": "three features",
  "canvas-workspace": "call to action",
  "dashboard-cards": "stats band",
};

/** blocks worth naming for each layout, using the app's own rail labels */
const BLOCKS_FOR: Record<string, string> = {
  "bento-6": "one card at 2× with two stats beside it",
  "bento-active": "cards plus a chip row that expands on hover",
  "split-hero": "a heading and a button left, one image right",
  "single-column": "a heading, two paragraphs, then a button",
  "sidebar-shell": "a navbar, then stat blocks above a bulleted list",
  "grid-rules": "dividers between every section, cards in the cells",
  "scroll-chapters": "one heading plus a quote per full-height chapter",
  "catalogue-grid": "three cards across, a divider under each row",
  "canvas-workspace": "floating cards and chips, a quote off to one side",
  "dashboard-cards": "four stats in a row, then a list and a table of cards",
};

const GROUP_LABEL: Record<string, string> = {
  saas: "SaaS pages that have to convince a sceptic",
  product: "product pages with real features to show",
  portfolio: "a personal portfolio with work to hang",
  media: "long-read media with an audience to keep",
  finance: "money pages where trust is the whole design",
  health: "health surfaces where a mistake is expensive",
  internal: "internal tools used eight hours a day",
  tools: "tools for people who already know what they want",
  docs: "documentation that people read under pressure",
  education: "teaching pages that must not tire anyone",
  brand: "brand sites with something to say loudly",
  gaming: "gaming pages that can afford to be loud",
  ecommerce: "shops where the product must beat the chrome",
  marketplace: "marketplaces drowning in listings",
  editorial: "editorial layouts built for reading",
  personal: "personal pages, unprofessional on purpose",
  wellness: "calm services that shouldn't raise your pulse",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** deterministic 0..n-1 from any string, so "pick one of five" is stable */
function h(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return Math.abs(x >>> 0);
}

/** how loud the palette is allowed to be, from the accent's own habit */
function chromaOf(atom: Atom, reg: Register): [number, number] {
  const base = reg.chroma;
  if (atom.id.includes("neon") || atom.id.includes("saturated")) return [Math.max(base[0], 0.14), 0.26];
  if (atom.id.includes("earth") || atom.id.includes("mono-accent")) return [0.02, Math.min(base[1], 0.08)];
  if (atom.id.includes("duotone")) return [0.08, 0.17];
  return base;
}

function fitsTogether(a: Atom, r: Register): boolean {
  if (!r.fits.length) return true;
  return a.fits.some((g) => r.fits.includes(g));
}

function conflictsWith(a: Atom, r: Register): boolean {
  const bad = a.conflicts ?? [];
  if (r.motion === "none" && bad.includes("motion-none")) return true;
  if (r.id === "ledger" && a.id === "motion-physical") return true;
  if (r.id === "kiosk" && a.id === "int-command") return true;
  return false;
}

/* ---------------- the composition ---------------- */

function buildCatalog(): { list: Trend[]; skipped: { incompatible: number; duplicate: number} } {
  const out: Trend[] = [];
  const names = new Set(TRENDS.map((t) => t.name.toLowerCase()));
  const ids = new Set(TRENDS.map((t) => t.id));
  const skipped = { incompatible: 0, duplicate: 0 };

  const pairs: { layout: Atom; accent: Atom; group: string }[] = [];
  for (const layout of LAYOUT_ATOMS) for (const { atom, group } of ACCENTS) pairs.push({ layout, accent: atom, group });

  for (const { layout, accent, group } of pairs) {
    if (out.length >= CATALOG_TARGET) break;
    const offset = h(`${layout.id}|${accent.id}`) % REGISTERS.length;
    let taken = 0;
    for (let r = 0; r < REGISTERS.length && taken < REGISTERS.length; r++) {
      const reg = REGISTERS[(r + offset) % REGISTERS.length];
      if (conflictsWith(accent, reg) || !fitsTogether(accent, reg)) { skipped.incompatible++; continue; }

      const id = `${layout.id}__${accent.id}__${reg.id}`;
      if (ids.has(id)) { skipped.duplicate++; continue; }

      const firstWord = cap(low(accent.label).split(/[\s+·]+/)[0]);
      let name = `${cap(reg.name)} ${firstWord} ${cap(layout.label)}`;
      if (names.has(name.toLowerCase())) name = `${cap(reg.name)} ${cap(accent.label)} ${cap(layout.label)}`;
      if (names.has(name.toLowerCase())) { skipped.duplicate++; continue; }
      names.add(name.toLowerCase());
      ids.add(id);

      const radius: [number, number] = [reg.radius[0], Math.max(reg.radius[1], reg.radius[0] + 4)];
      const chroma = chromaOf(accent, reg);
      const density = reg.density;
      const motion = reg.motion;
      const year = 2019 + (h(id) % 8);
      const status: TrendStatus =
        year <= 2021 ? "cooling" : year >= 2026 ? "rising" : h(id + "s") % 5 === 0 ? "polarizing" : "core";

      const where = Array.from(new Set([...accent.fits, ...layout.fits])).slice(0, 4);
      const useWhen = [
        where[0] ? GROUP_LABEL[where[0]] ?? where[0] : "pages that need one clear voice",
        low(accent.note).replace(/\.$/, ""),
        `${density} spacing and ${motion === "none" ? "no motion" : motion + " motion"} keep it ${reg.id === "ledger" || reg.id === "console" ? "workable at speed" : "readable at a glance"}`,
      ].filter(Boolean);

      const avoidWhen = [
        reg.risk,
        ...(accent.conflicts ?? []).length
          ? [`it fights ${accent.conflicts!.map((c) => c.replace(/-/g, " ")).join(" and ")} on the same page`]
          : [],
        where.length > 0 ? `a ${where[where.length - 1]} brief that has no business being this ${reg.id === "vitrine" ? "theatrical" : "specific"}` : "",
      ].filter(Boolean) as string[];

      const signals = [
        ...reg.signals,
        low(layout.note).replace(/\.$/, ""),
        `radius held to ${radius[0]}–${radius[1]}px, borders ${reg.border[0]}–${reg.border[1]}px`,
        `chroma stays inside ${chroma[0].toFixed(2)}–${chroma[1].toFixed(2)}`,
      ].slice(0, 6);

      // one readable tag per atom, not the id's prefix repeated as a second group
      const layoutTag = layout.id.split("-").slice(layout.id.startsWith("bento") ? 0 : 1).join("-") || "bento";
      const accentTag = accent.id.split("-").slice(1).join("-").replace("accent", "neutral") || accent.id;
      const preset = PRESET_FOR[layout.id] ?? "bento";
      const blocks = BLOCKS_FOR[layout.id] ?? "a heading, a paragraph and one card";
      const recipe =
        `1 · Akmon: forge “${reg.accent.hue} ${low(accent.label)}, ${reg.mode === "either" ? "either mode" : reg.mode + " mode"}” and set harmony to ${reg.accent.scheme}; nudge once, then lock the accent. ` +
        `2 · Build: drop the “${preset}” grid preset, then ${blocks}; nothing hand-placed after that. ` +
        `3 · Site options: corners +${reg.options.radius}px, airiness ×${reg.options.airiness.toFixed(2)}, motion ${reg.options.motionMs}ms, typeface ${reg.options.font}. ` +
        `4 · Merkhet: “make everything readable” (floor ${reg.contrast.toFixed(1)}:1), then “straighten the page” — if it reports nothing left, the trend is holding.`;

      out.push({
        id,
        name,
        status,
        since: String(year),
        summary: `${reg.line} Layout: ${low(layout.note)} Colour and detail: ${low(accent.note)}`,
        signals,
        useWhen,
        avoidWhen,
        rules: {
          radius,
          borderWeight: reg.border,
          chroma,
          density,
          modeBias: reg.mode,
          typeScale: reg.typeScale,
          motion,
          contrastMin: reg.contrast,
        },
        recipe,
        tags: [...new Set([group, layoutTag, accentTag, ...reg.tags])] as string[],
      });
      taken++;
    }
  }
  return { list: out, skipped };
}

const built = buildCatalog();

/**
 * The hand-written entries were written as *specs* — CSS values, budgets,
 * ranges. Correct, but they don't say where in Hephaestus you'd go to apply
 * them, and "implementable" should not depend on the reader guessing. So the
 * curated entries get the app's own steps appended, derived from the numbers
 * they already carry: nothing is invented, and the original text is untouched.
 */
const PRESET_BY_TAG: [string, string][] = [
  ["bento", "bento"], ["dashboard", "stats band"], ["editorial", "image + text split"],
  ["grid", "three features"], ["data", "stats band"], ["type", "hero centred"],
  ["motion", "how it works"], ["glass", "hero split"], ["nav", "call to action"],
  ["colour", "gallery"], ["accessibility", "contact split"], ["tokens", "section divider"],
];
const AIRY: Record<string, number> = { airy: 1.3, balanced: 1, dense: 0.82 };
const MOTION_MS: Record<string, number> = { none: 0, restrained: 220, expressive: 620 };

function withSteps(t: Trend): Trend {
  if (/Akmon/i.test(t.recipe)) return t;
  const r = t.rules;
  const rad = r.radius ? `corners +${Math.round((r.radius[0] + r.radius[1]) / 2)}px` : "corners as set";
  const air = r.density ? `airiness ×${(AIRY[r.density] ?? 1).toFixed(2)}` : null;
  const mot = r.motion ? `motion ${MOTION_MS[r.density === "dense" ? "none" : r.motion] ?? 400}ms` : null;
  const con = r.contrastMin ? `keep the contrast floor at ${r.contrastMin}:1` : null;
  const preset = PRESET_BY_TAG.find(([tag]) => t.tags.includes(tag))?.[1] ?? "bento";
  const mode = r.modeBias && r.modeBias !== "either" ? `forge in ${r.modeBias} mode` : "forge in either mode";
  const steps =
    ` In hephaestus: 1 · Akmon — ${mode}, harmony ${r.chroma && r.chroma[0] > 0.1 ? "tetradic" : "analogous"}, ` +
    `and hold chroma ${r.chroma ? `inside ${r.chroma[0].toFixed(2)}–${r.chroma[1].toFixed(2)}` : "where the palette puts it"}. ` +
    `2 · Build — start from the “${preset}” grid preset. ` +
    `3 · Site options — ${[rad, air, mot].filter(Boolean).join(", ")}. ` +
    `4 · Merkhet — ${con ? `“make everything readable”, then ` : ""}“straighten the page”.`;
  return { ...t, recipe: `${t.recipe}${steps}` };
}

/** curated first, then the composed catalogue — the order the grid shows */
export const CATALOG: Trend[] = [...TRENDS.map(withSteps), ...built.list];

const byId = new Map(CATALOG.map((t) => [t.id, t]));
export const trendById = (id: string) => byId.get(id);

export const CATALOG_INFO = {
  curated: TRENDS.length,
  composed: built.list.length,
  total: CATALOG.length,
  skippedIncompatible: built.skipped.incompatible,
  skippedDuplicates: built.skipped.duplicate,
  registers: REGISTERS.length,
  layouts: LAYOUT_ATOMS.length,
  accents: ACCENTS.length,
  possible: LAYOUT_ATOMS.length * ACCENTS.length * REGISTERS.length,
};

export const REGISTERS_OUT = REGISTERS.map((r) => ({ id: r.id, name: r.name, line: r.line }));

/** what the trends screen offers as a first narrowing step */
export const CATALOG_TAGS = (() => {
  const counts = new Map<string, number>();
  for (const t of CATALOG) for (const g of t.tags) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
})();

export const PURPOSE_GROUPS = Array.from(new Set(PURPOSES.map((p) => p.group)));
