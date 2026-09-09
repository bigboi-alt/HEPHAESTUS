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
  | "card" | "stat" | "chip" | "spacer" | "footer";

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
};

export type CvDoc = {
  pages: CvPage[];
  transition: CvTransition;
  brand: string;
};

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
  spacer: "text", footer: "muted",
};
export const KIND_BG: Record<CvKind, string> = {
  nav: "surface", heading: "background", text: "background", button: "accent",
  image: "primary", card: "surface", stat: "surface", chip: "accent",
  spacer: "background", footer: "surface",
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
  return Math.max(720, max + 120);
}

export function blockRect(b: CvBlock) {
  return { x: b.x, y: b.y, w: b.w, h: b.h, right: b.x + b.w, bottom: b.y + b.h };
}

export function overlaps(a: CvBlock, b: CvBlock): boolean {
  const r1 = blockRect(a), r2 = blockRect(b);
  // nav & footer are full-width bands — ignore with the blocks they frame
  if (a.kind === "nav" || a.kind === "footer" || b.kind === "nav" || b.kind === "footer") return false;
  if (a.kind === "spacer" || b.kind === "spacer") return false;
  return r1.x < r2.right && r2.x < r1.right && r1.y < r2.bottom && r2.y < r1.bottom;
}

/* ---------------- audit (canvas-level, fed to Cedalion) ---------------- */

export type CvIssue = { sev: "critical" | "warning" | "note"; what: string; fix?: string };

export function auditCanvas(pg: CvPage, p: Palette): { score: number; issues: CvIssue[] } {
  const issues: CvIssue[] = [];
  let score = 100;
  const cols: CvBlock[] = pg.blocks.filter((b) => !["spacer", "nav", "footer"].includes(b.kind));

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
      if (b.kind === "nav" || b.kind === "footer" || b.kind === "spacer") continue;
      const nx = Math.round(b.x / col) * col;
      const nw = Math.max(col, Math.round(b.w / col) * col);
      const ny = Math.round(b.y / 8) * 8;
      if (nx !== b.x || ny !== b.y || nw !== b.w) { b.x = Math.min(nx, FRAME_W - nw); b.y = ny; b.w = Math.min(nw, FRAME_W - nx); moved++; }
    }
    // resolve overlaps by pushing the lower block down
    for (let i = 0; i < blocks.length; i++)
      for (let j = 0; j < blocks.length; j++) {
        if (i === j || blocks[i].kind === "spacer" || blocks[j].kind === "spacer") continue;
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
    for (const b of blocks) if (b.kind !== "spacer") {
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

export function canvasToHtml(doc: CvDoc, p: Palette): string {
  const bg = roleHex(p, "background");
  const surf = roleHex(p, "surface");
  const tx = roleHex(p, "text");
  const mut = roleHex(p, "muted");
  const line = roleHex(p, "border");
  const acc = roleHex(p, "accent");
  const bodyFont = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

  const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const styleFor = (b: CvBlock) => {
    const s: string[] = [
      `left:${b.x}px`, `top:${b.y}px`, `width:${b.w}px`, `height:${b.h}px`,
      b.radius !== undefined ? `border-radius:${b.radius}px` : "",
    ];
    return s.filter(Boolean).join(";");
  };

  const kindHtml = (b: CvBlock): string => {
    const fg = b.fg ?? (b.kind === "button" || b.kind === "chip" ? (contrastRatio(tx, acc) >= 4.5 ? tx : "#fff") : b.kind === "text" ? mut : tx);
    switch (b.kind) {
      case "heading":
        return `<div style="font-weight:${b.weight ?? 800};font-size:${b.size ?? 52}px;line-height:1.08;letter-spacing:-.02em;color:${fg};text-align:${b.align ?? "left"}">${esc(b.text ?? "")}</div>`;
      case "text":
        return `<div style="font-size:${b.size ?? 18}px;line-height:1.6;color:${fg};text-align:${b.align ?? "left"}">${esc(b.text ?? "")}</div>`;
      case "button": {
        const solid = b.variant !== "outline" && b.variant !== "ghost";
        const bb = solid ? (b.bg ?? acc) : "transparent";
        const bfg = solid ? fg : tx;
        return `<a href="${b.link ? "#pg-" + esc(b.link) : "#"}" data-page="${esc(b.link ?? "")}" style="display:inline-flex;align-items:center;justify-content:center;height:100%;width:100%;background:${bb};color:${bfg};border:${b.variant === "outline" ? "2px solid " + (b.line ?? tx) : "2px solid transparent"};border-radius:${b.radius ?? 10}px;font-weight:${b.weight ?? 700};font-size:${b.size ?? 17}px;text-decoration:none">${esc(b.text ?? "")}</a>`;
      }
      case "image":
        return `<div style="width:100%;height:100%;border-radius:${b.radius ?? 14}px;background:linear-gradient(135deg, ${roleHex(p, "primary")} 0%, ${roleHex(p, "secondary")} 130%);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:26px">▣</div>`;
      case "card":
        return `<div style="height:100%;background:${surf};border:1px solid ${line};border-radius:${b.radius ?? 16}px;padding:22px;display:flex;flex-direction:column;gap:10px"><div style="font-weight:700;font-size:${(b.size ?? 19) + 3}px;color:${tx}">${esc(b.text ?? "")}</div><div style="font-size:${b.size ?? 15}px;line-height:1.55;color:${mut}">${esc(b.sub ?? "")}</div></div>`;
      case "stat":
        return `<div style="height:100%;background:${surf};border:1px solid ${line};border-radius:${b.radius ?? 14}px;padding:16px 18px;display:flex;flex-direction:column;justify-content:center;gap:4px"><div style="font-size:${b.size ?? 40}px;font-weight:800;letter-spacing:-.02em;color:${b.fg ?? acc}">${esc(b.text ?? "")}</div><div style="color:${mut};font-size:14px">${esc(b.sub ?? "")}</div></div>`;
      case "chip":
        return `<span style="display:inline-flex;align-items:center;height:100%;padding:0 16px;background:${b.bg ?? acc};color:${fg};font-size:${b.size ?? 13}px;font-weight:700;border-radius:${b.radius ?? 999}px">${esc(b.text ?? "")}</span>`;
      case "spacer": return "";
      case "footer":
        return `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${mut};font-size:${b.size ?? 13}px;border-top:1px solid ${line}">${esc(b.text ?? "")}</div>`;
      default: return "";
    }
  };

  const navHtml = (b: CvBlock, others: CvPage[]) => {
    const variant = (b.variant as NavStyle) ?? "minimal";
    const style: Record<NavStyle, string> = {
      minimal: "",
      centered: "justify-content:center",
      pill: "justify-content:space-between;margin:14px 28px;border-radius:999px;border:1px solid " + line + ";background:" + surf,
      glass: "justify-content:space-between;backdrop-filter:blur(12px);background:rgba(255,255,255,.06)",
      bold: "justify-content:space-between;border-bottom:3px solid " + acc,
    };
    const links = others.map((p2) => `<a href="#pg-${esc(p2.id)}" data-page="${esc(p2.id)}" style="color:${mut};text-decoration:none;font-weight:600;font-size:15px">${esc(p2.name)}</a>`).join("");
    return `<div style="display:flex;align-items:center;gap:26px;height:100%;padding:0 30px;${style[variant] ?? ""}"><span style="font-weight:800;font-size:19px;letter-spacing:-.01em">${esc(doc.brand)}</span><div style="display:flex;gap:26px">${links}</div></div>`;
  };

  const pages = doc.pages.map((pg, i) => {
    const nav = pg.blocks.filter((b) => b.kind === "nav");
    const others = doc.pages.filter((p2) => p2.id !== pg.id);
    const rest = pg.blocks.filter((b) => b.kind !== "nav");
    const content = rest.map((b) => b.kind === "nav" ? "" : `<div class="blk" style="${styleFor(b)}">${kindHtml(b)}</div>`).join("");
    const navs = nav.map((b) => `<div style="position:relative;z-index:5;height:${b.h}px;${b.variant === "pill" ? "padding:0 28px" : ""}">${navHtml(b, others)}</div>`).join("");
    return `<section class="pg" id="pg-${esc(pg.id)}" style="${i === 0 ? "" : "display:none"};min-height:100vh;background:${pg.bg ?? bg};position:relative;color:${tx}">${navs}<div style="position:absolute;left:0;top:${nav.length ? nav[0].h : 0}px;right:0;bottom:0;overflow:visible">${content}</div></section>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(doc.brand)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:${bodyFont};background:${bg}}
.pg{transition:opacity .28s ease, transform .28s ease}
.blk{position:absolute}
.blk a[data-page]{cursor:pointer}
.pg.swap{opacity:0;transform:translateY(6px)}
</style></head><body>
${pages}
<script>
(function(){
  var links=document.querySelectorAll('a[data-page]');
  function show(id){var cur=document.querySelector('.pg:not([style*="none"])')||document.querySelector('.pg');var nx=document.getElementById('pg-'+id);if(!nx||nx===cur)return;cur.classList.add('swap');setTimeout(function(){cur.style.display='none';cur.classList.remove('swap');nx.style.display='block';nx.classList.add('swap');requestAnimationFrame(function(){nx.classList.remove('swap')})},150)}
  links.forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();show(a.getAttribute('data-page'));window.scrollTo(0,0)})});
})();
</script>
</body></html>`;
}
