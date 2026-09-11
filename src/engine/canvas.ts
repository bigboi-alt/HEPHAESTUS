/**
 * HEPHAESTUS · canvas — the free-build document model.
 *
 * A canvas document is a set of PAGES, each a stack of absolutely-placed
 * BLOCKS (headings, text, buttons, cards, navbars, footers…). Blocks carry
 * semantic colour roles, so re-forging the palette retints the whole site.
 *
 * Merkhet lives here too: the fix engine that measures what is wrong
 * (overlaps, contrast, off-grid, rhythm) and repairs it with colour science
 * and grid math — no guesses.
 */

import type { Palette } from "./akmon";
import { contrastRatio, fixContrast } from "./color";

/* ---------------- types ---------------- */

export type CvKind =
  | "nav" | "heading" | "text" | "button" | "image"
  | "card" | "stat" | "chip" | "spacer" | "footer"
  | "divider" | "quote" | "list";

export type NavStyle = "minimal" | "centered" | "pill" | "glass" | "bold";
export type CvTransition = "none" | "fade" | "slide" | "scale";

export type CvBlock = {
  id: string;
  kind: CvKind;
  x: number; y: number; w: number; h: number;
  text?: string;
  sub?: string;
  link?: string;          // pageId this navigates to
  align?: "left" | "center" | "right";
  weight?: number;
  variant?: string;       // button: solid|outline|ghost · nav: NavStyle
  size?: number;          // font-size override px
  radius?: number;
  /** explicit paint order. unset = whatever this kind of block normally sits at
   *  (surfaces below, content above); ⇤ / ⇥ in the inspector sets it by hand */
  z?: number;
  fg?: string;            // explicit hex override (else palette role)
  bg?: string;
  line?: string;
};

export type CvPage = {
  id: string;
  name: string;
  blocks: CvBlock[];
  bg?: string;
  /** explicit page length (px) — the canvas can be extended past its content */
  minH?: number;
};

/** Choices that apply to the whole site, not to one block. Every one of these
 *  is honoured twice — once in the editor, once in the exported .html — so what
 *  you see is genuinely what you ship. */
export type CvOptions = {
  /** headings + body text, as a multiplier of each block's own size */
  typeScale?: number;
  /** added to every corner that hasn't been set by hand */
  radius?: number;
  /** 0 = flat, 3 = lifted */
  depth?: number;
  fontStack?: "modern" | "editorial" | "technical";
  /** transition length in the export and on the canvas; 0 = instant */
  motionMs?: number;
  imageFill?: "gradient" | "flat" | "duotone" | "hatched";
  /** padding multiplier for cards, stats and the footer band */
  airiness?: number;
  /** headings: left alone, all caps, or small caps */
  headingCase?: "none" | "upper";
  /** heading letter-spacing in em, negative is tighter */
  headingTrack?: number;
  /** button corners: square · soft · pill — on top of the corner slider */
  buttonShape?: "square" | "soft" | "pill";
  /** draw the hairline around cards and stats */
  cardBorder?: boolean;
};

export const FONT_STACKS: Record<NonNullable<CvOptions["fontStack"]>, string> = {
  modern: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  editorial: "'Iowan Old Style', 'Source Serif 4', Georgia, 'Times New Roman', serif",
  technical: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
};

const DEPTH_SHADOWS = ["none", "0 6px 18px -12px rgba(0,0,0,.34)", "0 14px 34px -16px rgba(0,0,0,.38)", "0 26px 60px -22px rgba(0,0,0,.45)"];

/** resolve the doc's options with defaults — one place, so both renderers agree */
export function optOf(doc?: CvDoc) {
  const o: CvOptions = doc?.options ?? {};
  return {
    typeScale: Math.max(0.8, Math.min(1.3, o.typeScale ?? 1)),
    radius: Math.max(-8, Math.min(28, o.radius ?? 0)),
    depth: DEPTH_SHADOWS[Math.max(0, Math.min(3, Math.round(o.depth ?? 0)))],
    font: FONT_STACKS[o.fontStack ?? "modern"],
    fontId: o.fontStack ?? "modern",
    motionMs: Math.max(0, Math.min(900, o.motionMs ?? 420)),
    imageFill: o.imageFill ?? "gradient",
    airiness: Math.max(0.7, Math.min(1.6, o.airiness ?? 1)),
    headingCase: o.headingCase ?? "none",
    headingTrack: Math.max(-0.05, Math.min(0.12, o.headingTrack ?? -0.02)),
    buttonShape: o.buttonShape ?? "soft",
    cardBorder: o.cardBorder ?? true,
  };
}

export type CvDoc = {
  pages: CvPage[];
  transition: CvTransition;
  brand: string;
  /** site-wide choices, see CvOptions */
  options?: CvOptions;
  /** single = one long scrollable page · multi = separate pages */
  mode?: "single" | "multi";
  /** pages parked while in single-page mode (restored on switch back) */
  parked?: CvPage[];
};

/** pages that are live for the current mode */
export function activePages(doc: CvDoc): CvPage[] {
  return doc.mode === "single" ? [doc.pages[0]] : doc.pages;
}

export const FRAME_W = 1200;

/* ---------------- ids / factories ---------------- */

let n = 0;
export const uid = (p = "el") => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

export const PAGE_NAMES = ["home", "about", "pricing", "contact"];

export function freshPage(name: string): CvPage {
  return { id: uid("pg"), name, blocks: [] };
}

export function freshDoc(brand: string): CvDoc {
  return { brand, transition: "fade", pages: [freshPage("home"), freshPage("about"), freshPage("contact")] };
}

export function emptyBlock(kind: CvKind, x: number, y: number): CvBlock {
  const b: CvBlock = { id: uid(), kind, x, y, w: 200, h: 60 };
  switch (kind) {
    case "nav": { b.x = 0; b.y = 0; b.w = FRAME_W; b.h = 74; b.text = "home"; return b; }
    case "heading": { b.w = 780; b.h = 120; b.text = "Big idea in one line"; b.size = 52; b.weight = 800; return b; }
    case "text": { b.w = 640; b.h = 90; b.text = "A sentence that explains what this is and why it matters — plain, specific, human."; b.size = 18; return b; }
    case "button": { b.w = 210; b.h = 56; b.text = "get started"; b.variant = "solid"; b.size = 17; b.weight = 700; return b; }
    case "image": { b.w = 420; b.h = 300; return b; }
    case "card": { b.w = 340; b.h = 240; b.text = "Feature title"; b.sub = "A short paragraph describing this feature and the problem it quietly solves."; b.size = 17; return b; }
    case "stat": { b.w = 220; b.h = 120; b.text = "4.9/5"; b.sub = "average rating"; b.size = 42; return b; }
    case "chip": { b.w = 150; b.h = 44; b.text = "new · 2026"; b.size = 13; return b; }
    case "spacer": { b.w = FRAME_W; b.h = 36; return b; }
    case "divider": { b.w = FRAME_W - 120; b.h = 6; b.variant = "soft"; b.x = 60; b.y = 60; return b; }
    case "quote": { b.w = 760; b.h = 150; b.text = "Design is intelligence made visible."; b.sub = "— a maker who ships"; b.size = 30; return b; }
    case "list": { b.w = 640; b.h = 140; b.text = "One clear benefit\nA second real outcome\nA third thing worth saying"; b.size = 18; return b; }
    case "footer": { b.w = FRAME_W; b.h = 90; b.text = "© hephaestus — forged, not generated."; b.size = 13; return b; }
  }
  return b;
}

/** default blocks for a brand-new page (nav on every page so links always work) */
export function starterBlocks(kind: "home" | "inner"): CvBlock[] {
  if (kind === "home") {
    return [
      emptyBlock("nav", 0, 0),
      emptyBlock("heading", 60, 150),
      emptyBlock("text", 60, 290),
      emptyBlock("button", 60, 400),
      emptyBlock("spacer", 0, 500),
    ];
  }
  return [emptyBlock("nav", 0, 0), emptyBlock("heading", 60, 160), emptyBlock("text", 60, 300)];
}

/* ---------------- palette roles ---------------- */

export function roleHex(p: Palette, role: string, override?: string): string {
  if (override) return override;
  return p.swatches.find((s) => s.role === role)?.hex ?? "#888";
}

/** which role each block kind leans on (fg/bg) */
export const KIND_FG: Record<CvKind, string> = {
  nav: "text", heading: "text", text: "muted", button: "accent",
  image: "accent", card: "text", stat: "accent", chip: "text",
  spacer: "text", footer: "muted", divider: "border", quote: "text", list: "text",
};
export const KIND_BG: Record<CvKind, string> = {
  nav: "surface", heading: "background", text: "background", button: "accent",
  image: "primary", card: "surface", stat: "surface", chip: "accent",
  spacer: "background", footer: "surface", divider: "background",
  quote: "background", list: "background",
};

/** what the block looks like: resolved hexes */
export function blockColors(kind: CvKind, p: Palette, b: CvBlock) {
  const bgRole = KIND_BG[kind];
  const fgRole = KIND_FG[kind];
  const bg = roleHex(p, bgRole, b.bg);
  const naturalFg = roleHex(p, fgRole, b.fg);
  const fg = readableOn(bg, naturalFg);
  return { bg, fg, line: roleHex(p, "border", b.line) };
}

/** pick a foreground that clears the surface it sits on */
export function readableOn(bg: string, preferred: string): string {
  if (contrastRatio(preferred, bg) >= 4.5) return preferred;
  const white = contrastRatio("#ffffff", bg);
  const black = contrastRatio("#000000", bg);
  if (white >= black) {
    return white >= 4.5 ? "#ffffff" : preferred;
  }
  return black >= 4.5 ? "#101010" : preferred;
}

/* ---------------- measurements ---------------- */

export function pageHeight(pg: CvPage): number {
  let max = 0;
  for (const b of pg.blocks) max = Math.max(max, b.y + b.h);
  return Math.max(pg.minH ?? 720, max + 120);
}

export function blockRect(b: CvBlock) {
  return { x: b.x, y: b.y, w: b.w, h: b.h, right: b.x + b.w, bottom: b.y + b.h };
}

export function overlaps(a: CvBlock, b: CvBlock): boolean {
  const r1 = blockRect(a), r2 = blockRect(b);
  // nav & footer are full-width bands — ignore with the blocks they frame
  if (a.kind === "nav" || a.kind === "footer" || b.kind === "nav" || b.kind === "footer") return false;
  if (a.kind === "spacer" || b.kind === "spacer" || a.kind === "divider" || b.kind === "divider") return false;
  return r1.x < r2.right && r2.x < r1.right && r1.y < r2.bottom && r2.y < r1.bottom;
}

/* ---------------- audit (canvas-level, fed to Cedalion) ---------------- */

export type CvIssue = { sev: "critical" | "warning" | "note"; what: string; fix?: string };

export function auditCanvas(pg: CvPage, p: Palette): { score: number; issues: CvIssue[] } {
  const issues: CvIssue[] = [];
  let score = 100;
  const cols: CvBlock[] = pg.blocks.filter((b) => !["spacer", "nav", "footer", "divider"].includes(b.kind));

  // text contrast vs the colour they sit on
  for (const b of cols) {
    const { fg } = blockColors(b.kind, p, b);
    const bg = roleHex(p, KIND_BG[b.kind], b.bg);
    const target = b.kind === "heading" || b.kind === "text" ? 7 : 4.5;
    const cr = contrastRatio(fg, bg);
    if (cr < target) {
      score -= 9;
      issues.push({ sev: cr < 3 ? "critical" : "warning", what: `${b.kind}: ${cr.toFixed(1)}:1`, fix: "merkhet → contrast" });
    }
  }
  // overlaps
  for (let i = 0; i < cols.length; i++)
    for (let j = i + 1; j < cols.length; j++)
      if (overlaps(cols[i], cols[j])) {
        score -= 8;
        issues.push({ sev: "warning", what: `${cols[i].kind} overlaps ${cols[j].kind}`, fix: "merkhet → layout" });
      }
  // off-frame
  for (const b of cols) {
    if (b.x + b.w > FRAME_W + 2 || b.x < -2) {
      score -= 3;
      issues.push({ sev: "note", what: `${b.kind} hangs off the page edge`, fix: "merkhet → layout" });
    }
  }
  return { score: Math.max(0, score), issues };
}

/* ---------------- Merkhet fixes ---------------- */

export type MerkhetMode = "theme" | "contrast" | "layout" | "rhythm";

/** the colour a block is really sitting on: its own background, else the smallest
 *  box that contains it (a card is a surface, not a decoration), else the page. */
export function surfaceUnder(pg: CvPage, b: CvBlock, p: Palette, blocks?: CvBlock[]): string {
  if (b.bg) return b.bg;
  const list = blocks ?? pg.blocks;
  let best: CvBlock | null = null;
  let bestArea = Infinity;
  for (const o of list) {
    if (o.id === b.id) continue;
    if (o.kind !== "card" && o.kind !== "stat") continue;
    const inside = o.x <= b.x && o.y <= b.y && o.x + o.w >= b.x + b.w && o.y + o.h >= b.y + b.h;
    if (!inside) continue;
    const area = o.w * o.h;
    if (area < bestArea) { best = o; bestArea = area; }
  }
  if (best) return best.bg ?? roleHex(p, "surface", best.bg);
  return pg.bg ?? roleHex(p, "background");
}

/** the floor a block has to clear, in plain terms: headings and paragraphs are
 *  read at small sizes for a long time, so they need more than a button label */
function floorFor(b: CvBlock): number {
  if (b.kind === "heading") return 7;
  if (b.kind === "text" || b.kind === "quote" || b.kind === "list") return 7;
  return 4.5;
}

function fgOf(b: CvBlock, p: Palette): string {
  return b.fg ?? blockColors(b.kind, p, b).fg;
}

/** how loud the palette is allowed to be on this surface: if the palette's own
 *  colour fails here, the palette is the problem, not the block */
function paletteClears(b: CvBlock, p: Palette, surface: string): boolean {
  return contrastRatio(blockColors(b.kind, p, b).fg, surface) >= floorFor(b) - 0.01;
}

const BANDS = ["nav", "footer", "spacer", "divider"];
const READABLE_KINDS = ["heading", "text", "quote", "list", "button", "chip", "stat", "card"];
const labelOf = (b: CvBlock) =>
  b.kind === "heading" ? "the heading"
  : b.kind === "text" ? "a paragraph"
  : b.kind === "quote" ? "a pull-quote"
  : b.kind === "list" ? "a list"
  : b.kind === "button" ? (b.text ? `“${b.text.slice(0, 22)}”` : "a button")
  : b.kind === "chip" ? "a tag"
  : b.kind === "stat" ? "a number"
  : b.kind === "card" ? "a card"
  : b.kind;

/** is `inner` placed inside `outer` on purpose? then it must move with it, not against it */
function CONTAINED(inner: CvBlock, outer: CvBlock): boolean {
  if (!["card", "stat"].includes(outer.kind)) return false;
  if (BANDS.includes(inner.kind)) return false;
  return outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h;
}

/** blocks that read as one row: their vertical ranges have to overlap properly,
 *  otherwise a heading and the paragraph under it get welded to the same top */
/** every problem a mode is responsible for, measured — not assumed */
export function merkhetProblems(pg: CvPage, p: Palette, mode: MerkhetMode): { id: string; what: string; blockId?: string }[] {
  const out: { id: string; what: string; blockId?: string }[] = [];
  const blocks = pg.blocks;

  if (mode === "theme") {
    for (const b of blocks) {
      if (b.fg || b.bg || b.line) out.push({ id: b.id, blockId: b.id, what: `${b.kind} has a hand-picked colour that the palette no longer needs` });
    }
  }
  if (mode === "contrast") {
    for (const b of blocks) {
      if (!READABLE_KINDS.includes(b.kind)) continue;
      const surf = surfaceUnder(pg, b, p, blocks);
      const cr = contrastRatio(fgOf(b, p), surf);
      const floor = floorFor(b);
      if (cr < floor) out.push({ id: b.id, blockId: b.id, what: `${labelOf(b)} reads at ${cr.toFixed(1)} where ${floor.toFixed(1)} is needed` });
    }
  }
  if (mode === "layout") {
    const col = FRAME_W / 12;
    for (const b of blocks) {
      if (BANDS.includes(b.kind)) continue;
      if (b.x < 0 || b.x + b.w > FRAME_W) out.push({ id: b.id, blockId: b.id, what: `${labelOf(b)} hangs off the edge of the page` });
      else if (Math.abs(b.x / col - Math.round(b.x / col)) * col > 3) out.push({ id: b.id, blockId: b.id, what: `${labelOf(b)} is not on a column line` });
    }
    for (let i = 0; i < blocks.length; i++)
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i], b = blocks[j];
        if (CONTAINED(a, b) || CONTAINED(b, a)) continue;
        if (overlaps(a, b)) out.push({ id: `${a.id}/${b.id}`, blockId: b.id, what: `${labelOf(a)} and ${labelOf(b)} are sitting on top of each other` });
      }
  }
  if (mode === "rhythm") {
    for (const g of rowGroups(blocks)) {
      if (g.length < 2) continue;
      const tops = g.map((b) => b.y);
      if (Math.max(...tops) - Math.min(...tops) > 6) out.push({ id: g[0].id, blockId: g[0].id, what: `${g.length} blocks in one row are not on the same line` });
      const sorted = [...g].sort((a, b) => a.x - b.x);
      const gaps = sorted.slice(1).map((b, i) => b.x - (sorted[i].x + sorted[i].w));
      if (gaps.length > 1 && Math.max(...gaps) - Math.min(...gaps) > 14) out.push({ id: sorted[0].id, blockId: sorted[0].id, what: `the space between them is uneven: ${gaps.map((x) => Math.round(x)).join(", ")} px` });
    }
  }
  return out;
}

function rowGroups(blocks: CvBlock[]): CvBlock[][] {
  const pool = blocks.filter((b) => !BANDS.includes(b.kind));
  const used = new Set<string>();
  const groups: CvBlock[][] = [];
  for (const a of pool) {
    if (used.has(a.id)) continue;
    const g = [a];
    used.add(a.id);
    for (const b of pool) {
      if (used.has(b.id)) continue;
      const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const shared = overlap / Math.max(1, Math.min(a.h, b.h));
      if (shared >= 0.55) { g.push(b); used.add(b.id); }
    }
    groups.push(g);
  }
  return groups;
}

export type MerkhetVerdict = {
  mode: MerkhetMode;
  /** the problems this mode is responsible for, measured before and after */
  before: number;
  after: number;
  fixed: number;
  /** changes that made the page worse and were put back */
  reverted: number;
  remaining: string[];
  /** which blocks are still wrong, so the panel can point at them */
  remainingIds: string[];
  ok: boolean;
  /** true when nothing was wrong to begin with */
  wasClean: boolean;
};

export type MerkhetResult = { page: CvPage; report: string[]; verdict: MerkhetVerdict };

/**
 * MERKHET — measure, repair, then measure again.
 *
 * The old version reported how many operations it performed, which meant it
 * could say "snapped 6 blocks" while leaving the page in a worse state, and the
 * panel drew a green tick either way. Now every individual change is kept only
 * if it does not make any measured problem worse, and the verdict is the
 * difference between the before-count and the after-count of that mode's own
 * problems. If it could not fix something, it says so.
 */
export function merkhet(pg: CvPage, p: Palette, mode: MerkhetMode): MerkhetResult {
  let blocks = pg.blocks.map((b) => ({ ...b }));
  const report: string[] = [];
  const problemsOf = (bs: CvBlock[]) => merkhetProblems({ ...pg, blocks: bs }, p, mode);
  const beforeProblems = problemsOf(blocks);
  const before = beforeProblems.length;
  let reverted = 0;

  const scoreOf = (bs: CvBlock[]) => auditCanvas({ ...pg, blocks: bs }, p).score;
  const startScore = scoreOf(blocks);

  /** apply one candidate change, keep it only if it does not make the page worse */
  const tryChange = (mutate: (bs: CvBlock[]) => void) => {
    const candidate = blocks.map((b) => ({ ...b }));
    mutate(candidate);
    const wasBad = problemsOf(blocks).length;
    const isBad = problemsOf(candidate).length;
    const moved = auditCanvas({ ...pg, blocks: candidate }, p).score;
    // a change is only an improvement if the problem it targeted is no worse
    // and the rest of the page has not decayed
    if (isBad > wasBad || moved < startScore - 1) {
      reverted++;
      return false;
    }
    if (isBad === wasBad && JSON.stringify(candidate) === JSON.stringify(blocks)) return false;
    blocks = candidate;
    return true;
  };

  if (mode === "theme") {
    let cleared = 0, kept = 0;
    for (const b of pg.blocks) {
      if (!b.fg && !b.bg && !b.line) continue;
      const surf = surfaceUnder({ ...pg, blocks }, b, p, blocks);
      const ok = paletteClears(b, p, surf);
      const applied = ok
        ? tryChange((bs) => { const t = bs.find((x) => x.id === b.id)!; t.fg = undefined; t.bg = undefined; t.line = undefined; })
        : false;
      if (applied) cleared++;
      else {
        kept++;
        if (!ok) report.push(`left ${labelOf(b)} alone — its hand-picked colour is the only thing holding it up on that background. the palette has no colour dark enough there yet.`);
        else report.push(`left ${labelOf(b)} alone — moving it back to the palette would have made the page worse, and I don't trade one problem for another.`);
      }
    }
    if (cleared) report.unshift(`${cleared} block${cleared === 1 ? "" : "s"} went back to the palette, so the palette now owns the page again.`);
    if (!cleared && !kept) report.push("nothing here is off-palette — the page already speaks with one voice.");
  }

  if (mode === "contrast") {
    let lifted = 0, hopeless: string[] = [];
    for (const b0 of [...blocks]) {
      if (!READABLE_KINDS.includes(b0.kind)) continue;
      const b = blocks.find((x) => x.id === b0.id)!;
      const surf = surfaceUnder({ ...pg, blocks }, b, p, blocks);
      const floor = floorFor(b);
      const cr = contrastRatio(fgOf(b, p), surf);
      if (cr >= floor) continue;
      const want = floor >= 7 ? "#ffffff" : "#ffffff";
      const candidates = [
        fixContrast(fgOf(b, p), surf, floor),
        want,
        "#101010",
        contrastRatio(surf, "#ffffff") >= floor ? "#ffffff" : contrastRatio(surf, "#0b0b0b") >= floor ? "#0b0b0b" : null,
      ].filter((x): x is string => !!x);
      let done = false;
      for (const cand of candidates) {
        if (contrastRatio(cand, surf) < floor - 0.01) continue;
        const applied = tryChange((bs) => { bs.find((x) => x.id === b.id)!.fg = cand; });
        if (applied) {
          report.push(`${labelOf(b)} was too faint to read (${cr.toFixed(1)} where ${floor.toFixed(1)} is needed) — it clears it now.`);
          lifted++; done = true; break;
        }
      }
      if (!done) hopeless.push(labelOf(b));
    }
    if (hopeless.length)
      report.push(`I could not fix ${hopeless.slice(0, 3).join(", ")} without breaking something else: on that background no ink reaches the number it needs. the background itself has to change — try Akmon's “nudge”, or pick a darker card colour.`);
    if (!lifted && !hopeless.length) report.push("every word on this page is already readable where it sits — nothing to fix.");
  }

  if (mode === "layout") {
    const col = FRAME_W / 12;
    let snapped = 0, unstuck = 0;
    // snap to columns, but a block that lives inside a card snaps to that card's
    // own grid — otherwise "fixing" the alignment rips it out of its container
    for (const b of [...blocks]) {
      if (BANDS.includes(b.kind)) continue;
      const host = blocks.find((o) => o.id !== b.id && CONTAINED(b, o));
      const applied = tryChange((bs) => {
        const t = bs.find((x) => x.id === b.id)!;
        if (host) {
          const hcol = host.w / 12;
          t.x = Math.round((host.x + Math.round((b.x - host.x) / hcol) * hcol));
          t.w = Math.max(hcol, Math.round(b.w / hcol) * hcol);
          if (t.x + t.w > host.x + host.w) t.w = host.x + host.w - t.x;
        } else {
          t.x = Math.round(Math.min(Math.max(0, Math.round(b.x / col) * col), FRAME_W - Math.max(col, Math.round(b.w / col) * col)));
          t.w = Math.min(FRAME_W - t.x, Math.max(col, Math.round(b.w / col) * col));
        }
        t.y = Math.round(b.y / 8) * 8;
      });
      if (applied) snapped++;
    }
    // then separate what still collides, by moving the lower one only
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      const bs = blocks;
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          if (CONTAINED(bs[j], bs[i]) || CONTAINED(bs[i], bs[j])) continue;
          if (!overlaps(bs[i], bs[j])) continue;
          const a = bs[i], b2 = bs[j];
          const lowerFirst = a.y <= b2.y ? b2 : a;
          const other = lowerFirst === b2 ? a : b2;
          const target = Math.ceil((other.y + other.h + 16) / 8) * 8;
          const applied = tryChange((list) => {
            const t = list.find((x) => x.id === lowerFirst.id)!;
            t.y = Math.max(t.y, target);
          });
          if (applied) { unstuck++; changed = true; }
        }
      }
      if (!changed) break;
    }
    if (snapped || unstuck) {
      report.unshift(
        [
          snapped ? `${snapped} block${snapped === 1 ? "" : "s"} moved onto the column lines` : null,
          unstuck ? `${unstuck} pair${unstuck === 1 ? "" : "s"} that were sitting on each other separated` : null,
        ].filter(Boolean).join(", ") + "."
      );
    }
  }

  if (mode === "rhythm") {
    let aligned = 0, spaced = 0, skipped = 0;
    for (const g0 of rowGroups(blocks)) {
      if (g0.length < 2) continue;
      const g = g0.map((b) => blocks.find((x) => x.id === b.id)!).filter(Boolean);
      const top = Math.min(...g.map((b) => b.y));
      if (Math.max(...g.map((b) => b.y)) - top > 6) {
        const applied = tryChange((bs) => { for (const b of g) bs.find((x) => x.id === b.id)!.y = top; });
        if (applied) aligned++; else skipped++;
      }
      const sorted = [...g].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        const gap = cur.x - (prev.x + prev.w);
        if (gap < 20 || gap > 60) {
          const applied = tryChange((bs) => { bs.find((x) => x.id === cur.id)!.x = Math.round(prev.x + prev.w + 32); });
          if (applied) spaced++; else skipped++;
        }
      }
    }
    if (aligned || spaced) report.unshift(`a row is a row: ${aligned ? `${aligned} row${aligned === 1 ? "" : "s"} lined up` : ""}${aligned && spaced ? ", and " : ""}${spaced ? `${spaced} gap${spaced === 1 ? "" : "s"} evened out` : ""}.`);
    if (skipped) report.push(`left ${skipped} thing${skipped === 1 ? "" : "s"} where they were — straightening them would have pushed something else out of place.`);
    if (!aligned && !spaced && !skipped) report.push("the spacing is already even. I checked every row.");
  }

  const afterProblems = problemsOf(blocks);
  const verdict: MerkhetVerdict = {
    mode,
    before,
    after: afterProblems.length,
    fixed: Math.max(0, before - afterProblems.length),
    reverted,
    remaining: afterProblems.slice(0, 4).map((x) => x.what),
    remainingIds: afterProblems.slice(0, 4).map((x) => x.blockId).filter((x): x is string => !!x),
    ok: afterProblems.length === 0,
    wasClean: before === 0 && afterProblems.length === 0,
  };
  if (reverted) report.push(`${reverted} change${reverted === 1 ? "" : "s"} I tried and put back, because the page read worse after it.`);
  if (!verdict.ok && !verdict.wasClean) report.push(`still open: ${afterProblems.length} of ${before} finding${before === 1 ? "" : "s"} — ${afterProblems.slice(0, 2).map((x) => x.what).join("; ")}.`);
  if (verdict.ok) report.push(verdict.wasClean ? "nothing to repair — this page was already clean." : `checked again: all ${before} problem${before === 1 ? "" : "s"}${before === 1 ? "" : "s"} are gone.`);
  if (auditCanvas({ ...pg, blocks }, p).score !== startScore)
    report.push(`page score ${startScore} → ${auditCanvas({ ...pg, blocks }, p).score}.`);

  return { page: { ...pg, blocks }, report, verdict };
}

/* ---------------- static export ---------------- */

/** WYSIWYG export: every block sits exactly where it does on the canvas. */
export function canvasToHtml(doc: CvDoc, p: Palette): string {
  const bg0 = roleHex(p, "background");
  const surf = roleHex(p, "surface");
  const tx = roleHex(p, "text");
  const mut = roleHex(p, "muted");
  const line = roleHex(p, "border");
  const acc = roleHex(p, "accent");
  const prim = roleHex(p, "primary");
  const sec = roleHex(p, "secondary");
  const O = optOf(doc);
  const bodyFont = O.font;
  /** one set of helpers so the editor and the export can't drift apart */
  const fs = (n: number) => Math.round(n * O.typeScale);
  const rad = (b: CvBlock, base: number) => Math.max(0, (b.radius ?? base) + O.radius);
  const pad = (n: number) => Math.round(n * O.airiness);
  const imageBg = (b: CvBlock) =>
    b.bg ? b.bg
    : O.imageFill === "flat" ? prim
    : O.imageFill === "duotone" ? `linear-gradient(165deg, ${prim} 0%, ${acc} 100%)`
    : O.imageFill === "hatched" ? `repeating-linear-gradient(135deg, ${prim} 0 9px, ${sec} 9px 18px)`
    : `linear-gradient(135deg, ${prim} 0%, ${sec} 130%)`;
  const pages = activePages(doc);
  const esc = (x: unknown) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const kindHtml = (b: CvBlock): string => {
    const fg = b.fg ?? (b.kind === "button" || b.kind === "chip" ? (contrastRatio(tx, acc) >= 4.5 ? tx : "#ffffff") : b.kind === "text" ? mut : tx);
    switch (b.kind) {
      case "heading":
        return `<div style="font-weight:${b.weight ?? 800};font-size:${fs(b.size ?? 52)}px;line-height:1.08;letter-spacing:${O.headingTrack}em;text-transform:${O.headingCase === "upper" ? "uppercase" : "none"};color:${fg};text-align:${b.align ?? "left"}">${esc(b.text)}</div>`;
      case "text":
        return `<div style="font-size:${fs(b.size ?? 18)}px;line-height:1.65;color:${fg};text-align:${b.align ?? "left"}">${esc(b.text)}</div>`;
      case "quote":
        return `<div style="padding:6px 0 6px 34px;border-left:3px solid ${acc}"><div style="font-size:${fs(b.size ?? 28)}px;line-height:1.4;font-weight:600;letter-spacing:-.01em;color:${fg}">${esc(b.text)}</div><div style="margin-top:12px;color:${mut};font-size:14px">${esc(b.sub)}</div></div>`;
      case "list": {
        const items = String(b.text ?? "").split("\n").map((t) => t.replace(/^[•▪◦–—-]\s*/, "")).filter(Boolean);
        return `<ul class="cv-list" style="font-size:${fs(b.size ?? 18)}px;line-height:1.9;color:${fg};list-style:none;padding:0;margin:0;text-align:${b.align ?? "left"}">${items.map((t) => `<li style="padding-left:26px;position:relative">${esc(t)}</li>`).join("")}</ul>`;
      }
      case "button": {
        const solid = (b.variant ?? "solid") !== "outline" && (b.variant ?? "solid") !== "ghost";
        const bb = solid ? (b.bg ?? acc) : "transparent";
        const bfg = solid ? (contrastRatio(tx, bb) >= 4.5 ? tx : "#ffffff") : fg;
        const align = b.align === "center" ? "justify-content:center" : b.align === "right" ? "justify-content:flex-end" : "justify-content:flex-start";
        return `<div style="display:flex;align-items:center;height:100%;width:100%;${align}"><a href="${b.link ? "#pg-" + esc(b.link) : "#"}" data-page="${esc(b.link ?? "")}" style="display:inline-flex;align-items:center;justify-content:center;padding:0 24px;height:100%;background:${bb};color:${bfg};border:${(b.variant ?? "solid") === "outline" ? "2px solid " + (b.line ?? tx) : "2px solid transparent"};border-radius:${O.buttonShape === "pill" ? 999 : O.buttonShape === "square" ? 0 : rad(b, 10)}px;font-weight:${b.weight ?? 700};font-size:${fs(b.size ?? 17)}px;text-decoration:none;white-space:nowrap;cursor:pointer">${esc(b.text)}</a></div>`;
      }
      case "image":
        return `<div style="width:100%;height:100%;border-radius:${rad(b, 14)}px;background:${imageBg(b)};display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:26px">▣</div>`;
      case "card":
        return `<div style="height:100%;background:${b.bg ?? surf};border:${O.cardBorder ? `1px solid ${b.line ?? line}` : "none"};border-radius:${rad(b, 16)}px;padding:${pad(24)}px;box-shadow:${O.depth};display:flex;flex-direction:column;gap:${pad(10)}px"><div style="font-weight:700;font-size:${fs((b.size ?? 17) + 4)}px;color:${b.fg ?? tx}">${esc(b.text)}</div><div style="font-size:${fs(b.size ?? 15)}px;line-height:1.6;color:${mut}">${esc(b.sub)}</div></div>`;
      case "stat":
        return `<div style="height:100%;background:${b.bg ?? surf};border:${O.cardBorder ? `1px solid ${b.line ?? line}` : "none"};border-radius:${rad(b, 14)}px;padding:${pad(16)}px ${pad(20)}px;box-shadow:${O.depth};display:flex;flex-direction:column;justify-content:center;gap:4px"><div style="font-size:${fs(b.size ?? 40)}px;font-weight:800;letter-spacing:-.02em;color:${b.fg ?? acc}">${esc(b.text)}</div><div style="color:${mut};font-size:14px">${esc(b.sub)}</div></div>`;
      case "chip":
        return `<span style="display:inline-flex;align-items:center;height:100%;padding:0 ${pad(18)}px;background:${b.bg ?? acc};color:${fg};font-size:${fs(b.size ?? 13)}px;font-weight:700;border-radius:999px;white-space:nowrap">${esc(b.text)}</span>`;
      case "divider": {
        const v = (b.variant as string) ?? "soft";
        const style =
          v === "gradient" ? `background:linear-gradient(90deg, ${prim}, ${acc}, ${sec})`
          : v === "solid" ? `background:${line}`
          : `background:linear-gradient(90deg, transparent, ${line} 18%, ${line} 82%, transparent)`;
        return `<div style="width:100%;height:100%;border-radius:999px;${style}"></div>`;
      }
      case "spacer": return "";
      case "footer":
        return `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${mut};font-size:${b.size ?? 13}px;border-top:1px solid ${line}">${esc(b.text)}</div>`;
      default: return "";
    }
  };

  const navHtml = (b: CvBlock, others: CvPage[]) => {
    const variant = (b.variant as NavStyle) ?? "minimal";
    const brand = `<span style="font-weight:800;font-size:19px;letter-spacing:-.01em;color:${tx}">${esc(doc.brand)}</span>`;
    const links = others.map((p2) => `<a href="#pg-${esc(p2.id)}" data-page="${esc(p2.id)}" style="color:${mut};text-decoration:none;font-weight:600;font-size:15px">${esc(p2.name)}</a>`).join("");
    const cta = `<a href="#${doc.pages.length > 1 && others.length ? "pg-" + esc(others[0].id) : ""}" data-page="${others.length ? esc(others[0].id) : ""}" style="background:${acc};color:${contrastRatio(tx, acc) >= 4.5 ? tx : "#ffffff"};font-size:13px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none">get started</a>`;
    const right = `<div style="display:flex;gap:24px;align-items:center">${links}${cta}</div>`;
    if (variant === "centered")
      return `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">${brand}<div style="display:flex;gap:24px;align-items:center">${others.map((p2) => `<a href="#pg-${esc(p2.id)}" data-page="${esc(p2.id)}" style="color:${mut};text-decoration:none;font-weight:500;font-size:14px">${esc(p2.name)}</a>`).join("")}</div></div>`;
    if (variant === "pill")
      return `<div style="height:100%;display:flex;align-items:center;justify-content:center"><div style="display:flex;align-items:center;gap:28px;background:${surf};border:1px solid ${line};border-radius:999px;padding:0 26px;height:56px;box-shadow:0 12px 30px -18px rgba(0,0,0,.35)">${brand}<div style="display:flex;gap:22px">${others.map((p2) => `<a href="#pg-${esc(p2.id)}" data-page="${esc(p2.id)}" style="color:${mut};text-decoration:none;font-weight:500;font-size:14px">${esc(p2.name)}</a>`).join("")}</div></div></div>`;
    const frame: Record<string, string> = {
      minimal: "justify-content:space-between",
      glass: "justify-content:space-between;backdrop-filter:blur(12px);background:rgba(255,255,255,.05);border-bottom:1px solid " + line,
      bold: "justify-content:space-between;border-bottom:3px solid " + acc + ";text-transform:uppercase",
    };
    return `<div style="display:flex;align-items:center;height:100%;padding:0 30px;${frame[variant] ?? frame.minimal}">${brand}${right}</div>`;
  };

  const sectionHtml = pages.map((pg) => {
    let contentBottom = 0;
    for (const b of pg.blocks) contentBottom = Math.max(contentBottom, b.y + b.h);
    const H = Math.max(700, contentBottom + 120, pg.minH ?? 0);
    const others = pages.filter((p2) => p2.id !== pg.id);
    const blocks = pg.blocks
      .map((b) => {
        const inner =
          b.kind === "nav" ? navHtml(b, others)
          : b.kind === "footer" ? kindHtml(b)
          : kindHtml(b);
        const z = b.kind === "nav" ? "z-index:8;" : b.kind === "footer" ? "z-index:7;" : "";
        return `<div class="blk" style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;${z}border-radius:${b.radius ?? 0}px">${inner}</div>`;
      })
      .join("");
    return `<section class="pg${doc.transition === "none" ? " instant" : ""}" id="pg-${esc(pg.id)}" style="background:${pg.bg ?? bg0};color:${tx};height:${H}px;width:1200px;position:relative">${blocks}</section>`;
  }).join("");

  return `<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(doc.brand)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:${bodyFont};background:${bg0};color:${tx}}
.pg{display:none;margin:0 auto}
.pg.on{display:block}
.pg.instant{display:none}.pg.instant.on{display:block}
a[data-page]{cursor:pointer}
.cv-list li::before{content:"▸";position:absolute;left:2px;color:${acc};font-size:.8em;top:.35em}
.cv-list li{line-height:1.85}
@keyframes cvFade{from{opacity:0}to{opacity:1}}
@keyframes cvSlide{from{opacity:0;transform:translateX(52px)}to{opacity:1;transform:none}}
@keyframes cvScale{from{opacity:0;transform:scale(.965)}to{opacity:1;transform:none}}
.pg.anim.anim-fade{animation:cvFade ${O.motionMs}ms ease}
.pg.anim.anim-slide{animation:cvSlide ${Math.round(O.motionMs * 1.1)}ms cubic-bezier(.2,.75,.25,1)}
.pg.anim.anim-scale{animation:cvScale ${O.motionMs}ms cubic-bezier(.2,.75,.25,1)}
</style></head><body>
${sectionHtml}
<script>
(function(){
  var mode="${esc(doc.transition)}";
  var cur=document.querySelector('.pg');if(cur)cur.classList.add('on');
  function go(id){
    var nx=document.getElementById('pg-'+id);if(!nx)return;
    if(nx.classList.contains('on'))return;
    document.querySelectorAll('.pg.on').forEach(function(p){p.classList.remove('on')});
    nx.classList.add('on');
    if(mode!=='none'){nx.classList.remove('anim','anim-fade','anim-slide','anim-scale');void nx.offsetWidth;nx.classList.add('anim','anim-'+mode)}
    window.scrollTo(0,0);
  }
  document.querySelectorAll('a[data-page]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var id=a.getAttribute('data-page');if(id)go(id)})});
})();
</script>
</body></html>`;
}
