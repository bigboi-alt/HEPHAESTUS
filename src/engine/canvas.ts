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

export type CvDoc = {
  pages: CvPage[];
  transition: CvTransition;
  brand: string;
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

export function merkhet(pg: CvPage, p: Palette, mode: MerkhetMode): { page: CvPage; report: string[] } {
  const blocks = pg.blocks.map((b) => ({ ...b }));
  const report: string[] = [];
  const bg = pg.bg ?? roleHex(p, "background");

  if (mode === "theme") {
    // drop hex overrides so the palette fully owns the page
    let cleared = 0;
    for (const b of blocks) {
      if (b.fg || b.bg || b.line) { b.fg = undefined; b.bg = undefined; b.line = undefined; cleared++; }
    }
    report.push(`cleared ${cleared} manual colours — the palette now speaks.`);
  }

  if (mode === "contrast") {
    let fixed = 0;
    for (const b of blocks) {
      const target = b.kind === "heading" ? 7 : b.kind === "text" ? 7 : 4.5;
      const surf = b.kind === "button" || b.kind === "chip"
        ? roleHex(p, KIND_BG[b.kind], b.bg)
        : bg;
      const base = b.kind === "button" || b.kind === "chip"
        ? (contrastRatio(roleHex(p, "text"), surf) >= 4.5 ? roleHex(p, "text") : "#ffffff")
        : roleHex(p, KIND_FG[b.kind], b.fg);
      const cr = contrastRatio(base, surf);
      if (cr < target) {
        const better = fixContrast(base, surf, target) ?? (contrastRatio("#ffffff", surf) >= target ? "#ffffff" : "#101010");
        b.fg = better;
        fixed++;
        report.push(`${b.kind}: lifted to ${target}:1 on its surface (${cr.toFixed(1)} → ${contrastRatio(better, surf).toFixed(1)}).`);
      }
    }
    if (!fixed) report.push("every text/button already clears its floor — nothing to fix.");
  }

  if (mode === "layout") {
    const col = FRAME_W / 12;
    let moved = 0;
    for (const b of blocks) {
      if (b.kind === "nav" || b.kind === "footer" || b.kind === "spacer" || b.kind === "divider") continue;
      const nx = Math.round(b.x / col) * col;
      const nw = Math.max(col, Math.round(b.w / col) * col);
      const ny = Math.round(b.y / 8) * 8;
      if (nx !== b.x || ny !== b.y || nw !== b.w) { b.x = Math.min(nx, FRAME_W - nw); b.y = ny; b.w = Math.min(nw, FRAME_W - nx); moved++; }
    }
    // resolve overlaps by pushing the lower block down
    for (let i = 0; i < blocks.length; i++)
      for (let j = 0; j < blocks.length; j++) {
        if (i === j || ["spacer", "divider"].includes(blocks[i].kind) || ["spacer", "divider"].includes(blocks[j].kind)) continue;
        if (overlaps(blocks[i], blocks[j])) {
          const a = blocks[i], b2 = blocks[j];
          // push the lower block below, then land it on the 8px rhythm
          const snap8 = (v: number) => Math.ceil(v / 8) * 8;
          if (a.y < b2.y) b2.y = snap8(a.y + a.h + 12);
          else if (b2.y < a.y) a.y = snap8(b2.y + b2.h + 12);
          moved++;
        }
      }
    report.push(`snapped to the 12-column grid and un-stacked ${moved} collisions.`);
  }

  if (mode === "rhythm") {
    let moves = 0;
    const row: Record<string, CvBlock[]> = {};
    for (const b of blocks) if (b.kind !== "spacer" && b.kind !== "divider") {
      const key = String(Math.round(b.y / 32));
      (row[key] ??= []).push(b);
    }
    for (const list of Object.values(row)) {
      if (list.length < 2) continue;
      const top = Math.min(...list.map((b) => b.y));
      for (const b of list) if (b.y !== top) { b.y = top; moves++; }
      // even spacing inside the row
      const sorted = [...list].sort((a, b2) => a.x - b2.x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        if (cur.x - (prev.x + prev.w) < 24 && cur.x - (prev.x + prev.w) > -8) {
          cur.x = prev.x + prev.w + 24;
          moves++;
        }
      }
    }
    report.push(moves ? `aligned ${moves} blocks to even rows and gutters.` : "rhythm already even — nice.");
  }

  return { page: { ...pg, blocks }, report };
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
  const bodyFont = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const pages = activePages(doc);
  const esc = (x: unknown) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const kindHtml = (b: CvBlock): string => {
    const fg = b.fg ?? (b.kind === "button" || b.kind === "chip" ? (contrastRatio(tx, acc) >= 4.5 ? tx : "#ffffff") : b.kind === "text" ? mut : tx);
    switch (b.kind) {
      case "heading":
        return `<div style="font-weight:${b.weight ?? 800};font-size:${b.size ?? 52}px;line-height:1.08;letter-spacing:-.02em;color:${fg};text-align:${b.align ?? "left"}">${esc(b.text)}</div>`;
      case "text":
        return `<div style="font-size:${b.size ?? 18}px;line-height:1.65;color:${fg};text-align:${b.align ?? "left"}">${esc(b.text)}</div>`;
      case "quote":
        return `<div style="padding:6px 0 6px 34px;border-left:3px solid ${acc}"><div style="font-size:${b.size ?? 28}px;line-height:1.4;font-weight:600;letter-spacing:-.01em;color:${fg}">${esc(b.text)}</div><div style="margin-top:12px;color:${mut};font-size:14px">${esc(b.sub)}</div></div>`;
      case "list": {
        const items = String(b.text ?? "").split("\n").map((t) => t.replace(/^[•▪◦–—-]\s*/, "")).filter(Boolean);
        return `<ul class="cv-list" style="font-size:${b.size ?? 18}px;line-height:1.9;color:${fg};list-style:none;padding:0;margin:0;text-align:${b.align ?? "left"}">${items.map((t) => `<li style="padding-left:26px;position:relative">${esc(t)}</li>`).join("")}</ul>`;
      }
      case "button": {
        const solid = (b.variant ?? "solid") !== "outline" && (b.variant ?? "solid") !== "ghost";
        const bb = solid ? (b.bg ?? acc) : "transparent";
        const bfg = solid ? (contrastRatio(tx, bb) >= 4.5 ? tx : "#ffffff") : fg;
        const align = b.align === "center" ? "justify-content:center" : b.align === "right" ? "justify-content:flex-end" : "justify-content:flex-start";
        return `<div style="display:flex;align-items:center;height:100%;width:100%;${align}"><a href="${b.link ? "#pg-" + esc(b.link) : "#"}" data-page="${esc(b.link ?? "")}" style="display:inline-flex;align-items:center;justify-content:center;padding:0 24px;height:100%;background:${bb};color:${bfg};border:${(b.variant ?? "solid") === "outline" ? "2px solid " + (b.line ?? tx) : "2px solid transparent"};border-radius:${b.radius ?? 10}px;font-weight:${b.weight ?? 700};font-size:${b.size ?? 17}px;text-decoration:none;white-space:nowrap;cursor:pointer">${esc(b.text)}</a></div>`;
      }
      case "image":
        return `<div style="width:100%;height:100%;border-radius:${b.radius ?? 14}px;background:linear-gradient(135deg, ${prim} 0%, ${sec} 130%);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:26px">▣</div>`;
      case "card":
        return `<div style="height:100%;background:${b.bg ?? surf};border:1px solid ${b.line ?? line};border-radius:${b.radius ?? 16}px;padding:24px;display:flex;flex-direction:column;gap:10px"><div style="font-weight:700;font-size:${(b.size ?? 17) + 4}px;color:${b.fg ?? tx}">${esc(b.text)}</div><div style="font-size:${b.size ?? 15}px;line-height:1.6;color:${mut}">${esc(b.sub)}</div></div>`;
      case "stat":
        return `<div style="height:100%;background:${b.bg ?? surf};border:1px solid ${b.line ?? line};border-radius:${b.radius ?? 14}px;padding:16px 20px;display:flex;flex-direction:column;justify-content:center;gap:4px"><div style="font-size:${b.size ?? 40}px;font-weight:800;letter-spacing:-.02em;color:${b.fg ?? acc}">${esc(b.text)}</div><div style="color:${mut};font-size:14px">${esc(b.sub)}</div></div>`;
      case "chip":
        return `<span style="display:inline-flex;align-items:center;height:100%;padding:0 18px;background:${b.bg ?? acc};color:${fg};font-size:${b.size ?? 13}px;font-weight:700;border-radius:999px;white-space:nowrap">${esc(b.text)}</span>`;
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
.pg.anim.anim-fade{animation:cvFade .4s ease}
.pg.anim.anim-slide{animation:cvSlide .45s cubic-bezier(.2,.75,.25,1)}
.pg.anim.anim-scale{animation:cvScale .4s cubic-bezier(.2,.75,.25,1)}
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
