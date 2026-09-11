/**
 * HEPHAESTUS · Studio — the free-canvas builder (v3 UI).
 *
 * Everything on the page is a block you can select, drag, resize, reorder
 * and restyle. Interactions are built on a single always-mounted gesture
 * engine (window listeners + refs), and the keyboard only acts when the
 * canvas itself is focused — typing in a text field can never delete a block.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "../store";
import { getPurpose, type Purpose } from "../data/trends";
import { generatePalette, type Palette } from "../engine/akmon";
import { auditPalette, canvasProblems } from "../engine/cedalion";
import {
  FRAME_W, activePages, blockColors, roleHex, readableOn, auditCanvas,
  merkhet, merkhetProblems, canvasToHtml, optOf, FONT_STACKS,
  type CvOptions, emptyBlock, freshDoc, freshPage, starterBlocks,
  uid, pageHeight,
  type CvBlock, type CvDoc, type CvKind, type CvPage, type CvTransition,
  type MerkhetMode, type MerkhetVerdict,
} from "../engine/canvas";
import { contentFor } from "../engine/sites";
import { FALLBACK, GRID_PRESETS, blockSpan, layBelow, type GridPreset, type GridSeed } from "../engine/grids";
import { download } from "../lib/storage";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEVICES = [
  { id: "desktop", w: 1200, label: "desktop" },
  { id: "tablet", w: 820, label: "tablet" },
  { id: "mobile", w: 400, label: "mobile" },
];
const TRANSITIONS: CvTransition[] = ["none", "fade", "slide", "scale"];
const NAV_STYLES = ["minimal", "centered", "pill", "glass", "bold"] as const;
const BTN_VARIANTS = ["solid", "outline", "ghost"] as const;
const DIV_VARIANTS = ["soft", "solid", "gradient"] as const;

const KIND_GROUPS: { label: string; items: { id: CvKind; icon: string; label: string }[] }[] = [
  { label: "type", items: [
    { id: "heading", icon: "T", label: "heading" },
    { id: "text", icon: "¶", label: "paragraph" },
    { id: "list", icon: "≡", label: "bullets" },
    { id: "quote", icon: "❝", label: "quote" },
  ] },
  { label: "action", items: [
    { id: "button", icon: "▭", label: "button" },
    { id: "chip", icon: "✧", label: "chip" },
  ] },
  { label: "proof", items: [
    { id: "card", icon: "▢", label: "card" },
    { id: "stat", icon: "Σ", label: "stat" },
    { id: "image", icon: "◫", label: "image" },
  ] },
  { label: "structure", items: [
    { id: "divider", icon: "―", label: "divider" },
    { id: "spacer", icon: "⇕", label: "space" },
    { id: "nav", icon: "☰", label: "navbar" },
    { id: "footer", icon: "⤓", label: "footer" },
  ] },
];

type Axis = { ex: -1 | 0 | 1; ey: -1 | 0 | 1 };
type Gesture =
  | { mode: "move"; id: string; ix: number; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { mode: "resize"; id: string; ix: number; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; ax: Axis; moved: boolean }
  | { mode: "pageh"; ix: number; sy: number; base: number; floor: number; moved: boolean }
  | null;

function minDim(kind: CvKind) {
  switch (kind) {
    case "nav": return { minW: FRAME_W, minH: 44 };
    case "footer": return { minW: FRAME_W, minH: 60 };
    case "divider": return { minW: 120, minH: 4 };
    case "spacer": return { minW: 40, minH: 8 };
    default: return { minW: 56, minH: 26 };
  }
}
const bandKind = (k: CvKind) => k === "nav" || k === "footer";

/** Paint order. A card or a stat is a *surface* — the pieces drawn on it must
 *  stay clickable, or a block you can see is a block you cannot select. Content
 *  sits above surfaces by default; ⇤ /  in the inspector (or [ ]) still lets you
 *  overrule it when you really want something behind. */
const STACK_BASE: Partial<Record<CvKind, number>> = {
  nav: 0, footer: 0, spacer: 0, card: 1, stat: 1, divider: 1,
};

export default function Studio() {
  const { current, setCurrent, purposeId, go, say, setCedalionOpen, resumeId, setResumeId, sites, upsertSite, setCanvasCtx } = useApp();
  const purpose = purposeId ? getPurpose(purposeId) : undefined;

  /* resume an autosaved site from the dashboard, else start fresh */
  const boot = useRef<{ site: { doc: CvDoc; palette: Palette } | null | undefined }>({ site: undefined });
  if (boot.current.site === undefined && resumeId) {
    const found = sites.find((s) => s.id === resumeId);
    if (found) boot.current.site = { doc: found.doc, palette: found.palette };
    else boot.current.site = null;
  }
  /* a resumed site keeps its saved identity; a fresh build gets a new one */
  const siteId = useRef<string>(resumeId ?? uid("site"));
  const seeded = useRef(false);

  const [pal, setPal] = useState<Palette>(() => boot.current.site?.palette ?? current ?? generatePalette({ prompt: purposeId ?? "modern site", seed: 5 }));
  const [doc, setDoc] = useState<CvDoc>(() => {
    if (boot.current.site) return boot.current.site.doc;
    const d = freshDoc(seedBrand(purpose));
    d.pages[0].name = "home";
    d.pages[0].blocks = seedBlocks("home", d.brand);
    d.pages[1].blocks = seedBlocks("inner", d.brand);
    d.pages[2].blocks = seedBlocks("inner", d.brand);
    return d;
  });

  const [pageIx, setPageIx] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [devW, setDevW] = useState(1200);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showMerq, setShowMerq] = useState(false);
  const [report, setReport] = useState<string[]>([]);
  const [merq, setMerq] = useState<MerkhetVerdict | null>(null);
  const [showGrids, setShowGrids] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [zoom, setZoom] = useState<number | null>(null);
  const [fit, setFit] = useState(1);
  const [past, setPast] = useState<CvDoc[]>([]);
  const [future, setFuture] = useState<CvDoc[]>([]);
  const [savedTick, setSavedTick] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture>(null);
  const devWRef = useRef(devW);
  devWRef.current = devW;
  const docRef = useRef(doc);
  docRef.current = doc;
  const pageRef = useRef<CvPage | null>(null);

  /* content-rich boot from purpose (once, and only for fresh docs) */
  useEffect(() => {
    if (seeded.current || boot.current.site) { seeded.current = true; return; }
    seeded.current = true;
    if (purpose) {
      const c = contentFor(purpose, mulberry32(Math.floor(Math.random() * 1e6) + 1));
      setDoc({
        brand: c.brand, transition: "fade",
        pages: [makeHome(c), makeInner(c, "about"), makeInner(c, "contact")],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* consume the resume id */
  useEffect(() => {
    if (resumeId) setResumeId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = activePages(doc);
  const page = active[pageIx] ?? active[0] ?? doc.pages[0];
  pageRef.current = page;
  const selBlock = page.blocks.find((b) => b.id === sel) ?? null;
  const single = doc.mode === "single";
  const audit = auditCanvas(page, pal);
  const pAudit = auditPalette(pal, purposeId ?? undefined);

  /* fit-to-width observer */
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.min(1, (el.clientWidth - 72) / devWRef.current)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = zoom ?? fit;

  /* ---------------- history ---------------- */
  function commit(next: CvDoc) {
    setPast((p) => [...p.slice(-59), docRef.current]);
    setFuture([]);
    setDoc(next);
  }
  function live(next: CvDoc) { setDoc(next); }
  const pageMap = (mut: Partial<CvPage> | ((p: CvPage) => CvPage), d: CvDoc = docRef.current, ix: number = pageIx): CvDoc => ({
    ...d, pages: d.pages.map((p, i) => (i === ix ? (typeof mut === "function" ? mut(p) : { ...p, ...mut }) : p)),
  });
  const blockMap = (id: string, mut: Partial<CvBlock> | ((b: CvBlock) => CvBlock), d: CvDoc = docRef.current, ix: number = pageIx): CvDoc =>
    pageMap((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? (typeof mut === "function" ? mut(b) : { ...b, ...mut }) : b)) }), d, ix);
  function undo() {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setFuture((f) => [docRef.current, ...f].slice(0, 59));
    setPast((p) => p.slice(0, -1));
    setDoc(prev);
  }
  function redo() {
    if (!future.length) return;
    setDoc(future[0]);
    setPast((p) => [...p, docRef.current].slice(-59));
    setFuture((f) => f.slice(1));
  }

  /* ---------------- autosave + cedalion feed ---------------- */
  useEffect(() => {
    const t = setTimeout(() => {
      upsertSite({
        id: siteId.current, name: docRef.current.brand || "untitled",
        doc: docRef.current, palette: pal,
        pageCount: docRef.current.pages.length,
        updatedAt: Date.now(),
      });
      setSavedTick(Date.now());
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pal]);

  useEffect(() => {
    const kinds: Record<string, number> = {};
    for (const b of page.blocks) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
    setCanvasCtx({
      mode: single ? "single" : "multi",
      pageName: page.name,
      pageIx,
      pageCount: active.length,
      pageHeight: pageHeight(page),
      blockCount: page.blocks.length,
      kinds,
      auditScore: audit.score,
      issues: audit.issues.map((i) => ({ sev: i.sev, what: i.what, fix: i.fix })),
      purposeLabel: purpose?.label,
      transition: doc.transition,
      hasNav: page.blocks.some((b) => b.kind === "nav"),
      hasFooter: page.blocks.some((b) => b.kind === "footer"),
    });
    return () => setCanvasCtx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageIx, pal]);

  /* ---------------- pointer geometry ---------------- */
  const toPage = (e: { clientX: number; clientY: number }) => {
    const el = viewRef.current?.querySelector("[data-frame]") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = r.width / devWRef.current;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };

  /* ---------------- gesture engine (always mounted) ---------------- */
  useEffect(() => {
    const move = (ev: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const pt = toPage(ev);
      if (!pt) return;
      const dist = g.mode === "pageh" ? Math.abs(pt.y - g.sy) : Math.hypot(pt.x - (g as { sx: number }).sx, pt.y - g.sy);
      if (!g.moved && dist < 3) return;
      if (!g.moved) {
        g.moved = true;
        setPast((p) => [...p.slice(-59), docRef.current]);
        setFuture([]);
      }
      if (g.mode === "move") {
        const dx = pt.x - g.sx, dy = pt.y - g.sy;
        const b = docRef.current.pages[g.ix]?.blocks.find((x) => x.id === g.id);
        if (!b) return;
        setDoc((d) => blockMap(g.id, { x: Math.max(0, Math.round(g.ox + dx)), y: Math.max(0, Math.round(g.oy + dy)) }, d, g.ix));
      } else if (g.mode === "resize") {
        setDoc((d) => {
          const p = d.pages[g.ix];
          const b = p.blocks.find((x) => x.id === g.id);
          if (!b) return d;
          const { minW, minH } = minDim(b.kind);
          let w = g.ow, h = g.oh, x = g.ox, y = g.oy;
          if (g.ax.ex === -1) { w = g.ow + (g.sx - pt.x); x = g.ox - (w - g.ow); }
          else if (g.ax.ex === 1) { w = g.ow + (pt.x - g.sx); }
          if (g.ax.ey === -1) { h = g.oh + (g.sy - pt.y); y = g.oy - (h - g.oh); }
          else if (g.ax.ey === 1) { h = g.oh + (pt.y - g.sy); }
          w = Math.max(minW, Math.round(w)); h = Math.max(minH, Math.round(h));
          if (b.kind === "nav" || b.kind === "footer") { w = devWRef.current; x = 0; }
          if (x < 0) { w -= -x; x = 0; }
          if (y < 0) { h -= -y; y = 0; }
          return blockMap(g.id, { x, y, w: Math.max(minW, w), h: Math.max(minH, h) }, d, g.ix);
        });
      } else {
        setDoc((d) => pageMap((p) => ({ ...p, minH: Math.max(g.floor, Math.round(g.base + (pt.y - g.sy))) }), d, g.ix));
      }
    };
    const up = () => { gestureRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusCanvas = () => rootRef.current?.focus({ preventScroll: true });

  const onBlockDown = (b: CvBlock, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest?.("[contenteditable]")) return;
    focusCanvas();
    if (preview) {
      if (b.kind === "button" && (b.link || active.length > 1)) {
        const ix = active.findIndex((p) => p.id === (b.link ?? active[Math.min(pageIx + 1, active.length - 1)].id));
        if (ix >= 0 && ix !== pageIx) switchPage(ix);
      }
      return;
    }
    const pt = toPage(e);
    // ⌥/alt-click: take the block *under* this one — the escape hatch for
    // anything that ends up behind something else
    let target = b;
    if (e.altKey && pt) {
      const stack = pageRef.current!.blocks.filter((o) => o.x <= pt.x && pt.x <= o.x + o.w && o.y <= pt.y && pt.y <= o.y + Math.max(o.h, 24));
      const i = stack.findIndex((o) => o.id === b.id);
      if (i > 0) target = stack[i - 1];
    }
    setEditId(null);
    setSel(target.id);
    if (bandKind(target.kind)) return;
    if (!pt) return;
    gestureRef.current = { mode: "move", id: target.id, ix: pageIx, sx: pt.x, sy: pt.y, ox: target.x, oy: target.y, moved: false };
  };

  const onHandleDown = (b: CvBlock, ax: Axis, e: React.PointerEvent) => {
    if (e.button !== 0 || preview) return;
    e.stopPropagation();
    focusCanvas();
    setEditId(null);
    setSel(b.id);
    const pt = toPage(e);
    if (!pt) return;
    gestureRef.current = {
      mode: "resize", id: b.id, ix: pageIx, sx: pt.x, sy: pt.y,
      ox: b.x, oy: b.y, ow: b.w, oh: b.h, ax, moved: false,
      ...(b.kind === "nav" || b.kind === "footer" ? { ax: { ex: 0 as const, ey: 1 as const }, ow: devW } : {}),
    };
  };

  const onPageDown = (e: React.PointerEvent) => {
    if (preview || e.button !== 0) return;
    if ((e.target as HTMLElement) === e.currentTarget) { setSel(null); setEditId(null); focusCanvas(); }
  };

  const startPageExtend = (e: React.PointerEvent) => {
    if (preview || e.button !== 0) return;
    e.stopPropagation();
    focusCanvas();
    setSel(null); setEditId(null);
    const pt = toPage(e);
    if (!pt) return;
    const H = pageHeight(pageRef.current!);
    let floor = 0;
    for (const b of pageRef.current!.blocks) if (!bandKind(b.kind)) floor = Math.max(floor, b.y + b.h);
    floor = Math.max(220, Math.round((floor + 120) / 8) * 8);
    gestureRef.current = { mode: "pageh", ix: pageIx, sy: pt.y, base: H, floor, moved: false };
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // only when the canvas itself is focused
    if (editId) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === "y") { e.preventDefault(); redo(); return; }
    if (e.key === "Escape") {
      if (showGrids) setShowGrids(false);
      else if (showMerq) setShowMerq(false);
      else { setSel(null); setEditId(null); }
      return;
    }
    if (showGrids || showMerq) return;
    if (!sel) return;
    const b = page.blocks.find((x) => x.id === sel);
    if (!b) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeBlock(sel); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const list = page.blocks.filter((x) => !bandKind(x.kind) && x.kind !== "spacer");
      if (!list.length) return;
      const i = list.findIndex((x) => x.id === sel);
      const nx = list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length];
      setSel(nx.id);
      reveal(nx.id);
      return;
    }
    if (e.key === "[") { moveZ(b, -1); return; }
    if (e.key === "]") { moveZ(b, 1); return; }
    const step = e.shiftKey ? 10 : 1;
    const map: Record<string, { x?: number; y?: number }> = {
      ArrowUp: { y: Math.max(0, b.y - step) },
      ArrowDown: { y: b.y + step },
      ArrowLeft: { x: Math.max(0, b.x - step) },
      ArrowRight: { x: b.x + step },
    };
    const m = map[e.key];
    if (m) { e.preventDefault(); setDoc((d) => blockMap(sel, m, d)); }
  };

  /* ---------------- page ops ---------------- */
  const switchPage = (ix: number) => {
    if (ix === pageIx) return;
    setPageIx(ix); setSel(null); setEditId(null); setReport([]); focusCanvas();
  };
  const toggleMode = () => {
    if (!single) {
      const parked = doc.pages.slice(1);
      commit({ ...doc, pages: [doc.pages[0]], mode: "single", parked });
      setPageIx(0); setSel(null); setEditId(null);
      say(parked.length ? `${parked.length} page${parked.length === 1 ? "" : "s"} parked — this is now one long page` : "one long page — extend it with the ⣿ handle as you go");
    } else {
      const parked = doc.parked ?? [];
      commit({ ...doc, mode: "multi", pages: parked.length ? [...doc.pages, ...parked] : doc.pages, parked: undefined });
      setPageIx(0); setSel(null);
      say(parked.length ? `${parked.length} parked page${parked.length === 1 ? "" : "s"} restored` : "multi-page — add pages on the left and link them from buttons");
    }
  };
  const addPage = () => {
    if (single) { say("switch to “multiple pages” to add separate pages"); return; }
    const name = `page ${doc.pages.length + 1}`;
    const np = freshPage(name);
    np.blocks = starterBlocks("inner").map((b) => (b.kind === "nav" ? { ...b, text: doc.brand } : b));
    commit({ ...doc, pages: [...doc.pages, np] });
    setPageIx(doc.pages.length); setSel(null);
    say(`page “${name}” added`);
  };
  const removePage = (ix: number) => {
    if (single) return;
    if (doc.pages.length <= 1) { say("keep at least one page"); return; }
    const pages = doc.pages.filter((_, i) => i !== ix);
    commit({ ...doc, pages });
    setPageIx(Math.min(pageIx, pages.length - 1)); setSel(null);
    say("page removed");
  };
  const renamePage = (ix: number, name: string) => live(pageMap((p) => ({ ...p, name }), doc, ix));

  /* ---------------- block ops ---------------- */
  const dropY = (p: CvPage) => {
    let bottom = 0;
    for (const b of p.blocks) {
      if (bandKind(b.kind)) continue;
      bottom = Math.max(bottom, b.y + b.h);
    }
    const navBottom = p.blocks.filter((b) => b.kind === "nav").reduce((m, b) => Math.max(m, b.y + b.h), 0);
    return Math.round((Math.max(bottom, navBottom) + 44) / 8) * 8;
  };
  const addBlock = (kind: CvKind) => {
    const y0 = dropY(page);
    const b = emptyBlock(kind, 60, y0);
    if (kind === "nav") { b.x = 0; b.y = 0; b.w = devW; b.text = doc.brand; }
    if (kind === "footer") { b.x = 0; b.y = pageHeight(page); b.w = devW; b.text = `© ${doc.brand} — forged with hephaestus`; }
    if (kind === "divider") { b.x = 60; b.w = Math.min(devW - 120, FRAME_W - 120); }
    commit(pageMap((p) => ({ ...p, blocks: [...p.blocks, b] })));
    setSel(b.id);
    reveal(b.id);
    say(`${kind} added below your content — drag it anywhere`);
  };
  const addPreset = (preset: GridPreset) => {
    const seed = (purpose ? (contentFor(purpose, mulberry32(Math.floor(Math.random() * 1e6) + 1)) as unknown as GridSeed) : null) ?? FALLBACK;
    const laid = layBelow(preset, page, seed).map((b) => ({ ...b, id: uid("b") }));
    commit(pageMap((p) => ({ ...p, blocks: [...p.blocks, ...laid] })));
    setShowGrids(false);
    setSel(laid[0]?.id ?? null);
    if (laid[0]) reveal(laid[0].id);
    say(`“${preset.name}” dropped below your content — drag & edit freely`);
  };
  const removeBlock = (id: string) => {
    commit(pageMap((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) })));
    setSel(null);
  };
  const duplicate = (b: CvBlock) => {
    const nb = { ...b, id: uid(), x: Math.min(b.x + 28, Math.max(0, devW - b.w)), y: b.y + 36 };
    commit(pageMap((p) => ({ ...p, blocks: [...p.blocks, nb] })));
    setSel(nb.id); reveal(nb.id);
  };
  /** the order a block sits at when nobody has touched it */
  const zBase = (k: CvKind) => STACK_BASE[k] ?? 2;
  /** ⇤ / ⇥ (or [ ]) swap layers with the neighbour as it is actually painted,
   *  not with the neighbour next in the array — otherwise "send back" can be a
   *  no-op on a block whose kind already decides its layer. */
  const moveZ = (b: CvBlock, dir: -1 | 1) => {
    commit(pageMap((p) => {
      const arr = [...p.blocks];
      const zof = (x: CvBlock) => x.z ?? zBase(x.kind);
      const painted = arr.map((x, i) => ({ x, i })).sort((m, n) => zof(m.x) - zof(n.x) || m.i - n.i);
      const k = painted.findIndex((o) => o.x.id === b.id);
      const l = k + dir;
      if (k < 0 || l < 0 || l >= painted.length) return p;
      const me = painted[k].x, other = painted[l].x;
      const mz = zof(me), oz = zof(other);
      const clamp = (v: number) => Math.max(0, Math.min(9, v));
      const next = arr.map((x) => {
        if (x.id === me.id) return { ...x, z: mz === oz ? clamp(oz + dir) : oz };
        if (x.id === other.id) return { ...x, z: mz === oz ? clamp(mz - dir) : mz };
        return x;
      });
      return { ...p, blocks: next };
    }));
  };
  const reveal = (id: string) => {
    setTimeout(() => {
      const el = viewRef.current?.querySelector(`[data-blk="${id}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 60);
  };

  const liveText = (id: string, text: string) => setDoc((d) => blockMap(id, { text }, d));
  const liveBlock = (id: string, mut: Partial<CvBlock> | ((b: CvBlock) => CvBlock)) => setDoc((d) => blockMap(id, mut, d));

  const runMerkhet = (mode: MerkhetMode) => {
    const { page: np, report: rep, verdict } = merkhet(pageRef.current!, pal, mode);
    commit(pageMap(() => np));
    setReport(rep);
    setMerq(verdict);
    // the toast says what was measured, not what was attempted
    say(
      verdict.wasClean ? "merkhet · nothing to fix here"
      : verdict.ok ? `merkhet · ${verdict.fixed} fixed and re-checked`
      : `merkhet · ${verdict.fixed} of ${verdict.before} — ${verdict.after} left, panel says why`
    );
  };
  /** measure without touching: what a mode would find, in plain words */
  const checkMerkhet = () => {
    const mode = merq?.mode ?? "contrast";
    const probs = merkhetProblems(pageRef.current!, pal, mode);
    setMerq({ mode, before: probs.length, after: probs.length, fixed: 0, reverted: 0, remaining: probs.slice(0, 4).map((x) => x.what), remainingIds: probs.slice(0, 4).map((x) => x.blockId).filter(Boolean) as string[], ok: probs.length === 0, wasClean: probs.length === 0 });
    setReport(probs.length ? probs.slice(0, 6).map((x) => x.what) : [`nothing a “${mode}” pass could complain about on this page.`]);
  };
  const reforge = () => {
    const np = generatePalette({ prompt: purpose ? `${purpose.label} ${purpose.moodId ?? ""} site` : "modern", seed: Math.floor(Math.random() * 1e6) + 1 });
    setPal(np); setCurrent(np);
    say("palette re-forged — the whole canvas retinted");
  };
  /** build the site the way the export builds it, then show it full size */
  const openPreview = () => {
    setEditId(null);
    setSel(null);
    setPreviewHtml(canvasToHtml(docRef.current, pal));
    setPreview(true);
  };
  const closePreview = () => { setPreview(false); setPreviewHtml(null); };
  const openInTab = () => {
    const html = previewHtml ?? canvasToHtml(docRef.current, pal);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const exportHtml = () => {
    const slug = (purpose?.id ?? doc.brand ?? "site").toLowerCase().replace(/[^a-z0-9-]/g, "-");
    download(`hephaestus-${slug}.html`, canvasToHtml(docRef.current, pal), "text/html");
    say("exported — open it in any browser");
  };

  /* ---------------- render ---------------- */
  if (!page) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg)" }}>
        <div style={{ fontSize: 30 }}>⚒</div>
        <div className="label">this site has no pages</div>
        <button className="btn btn-primary" onClick={addPage}>create a page</button>
      </div>
    );
  }
  const H = pageHeight(page);
  const others = active.filter((p) => p.id !== page.id);
  /** site-wide choices, resolved once and handed to every block */
  const STY = optOf(doc);
  const setOption = (patch: CvOptions) => commit({ ...doc, options: { ...(doc.options ?? {}), ...patch } });
  const transClass = !single && doc.transition !== "none"
    ? (doc.transition === "fade" ? "cv-fade" : doc.transition === "slide" ? "cv-slide" : "cv-scale") : "";
  const issues = audit.issues;
  const notes = canvasProblems({ mode: single ? "single" : "multi", pageName: page.name, pageIx, pageCount: active.length, pageHeight: H, blockCount: page.blocks.length, kinds: counts(page.blocks), auditScore: audit.score, issues: issues.map((i) => ({ sev: i.sev, what: i.what })), purposeLabel: purpose?.label, transition: doc.transition, hasNav: page.blocks.some((b) => b.kind === "nav"), hasFooter: page.blocks.some((b) => b.kind === "footer") }).slice(0, 2);

  return (
    <div ref={rootRef} tabIndex={0} onKeyDown={onKey} style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", outline: "none" }}>
      {/* ================= top bar ================= */}
      <div className="row" style={{ height: 48, padding: "0 12px", borderBottom: "1px solid var(--line)", background: "var(--surface)", gap: 8, flexShrink: 0 }}>
        <button className="btn" style={{ fontSize: 11 }} onClick={() => go("home")} title="back to dashboard (autosaved)">←</button>
        <button className="row gap-1" style={{ border: "1px solid var(--line)", padding: "3px 8px" }} title={`palette ${pal.name} — click to re-forge`} onClick={reforge}>
          <span className="row" style={{ gap: 1 }}>
            {pal.swatches.map((s) => <span key={s.role} style={{ width: 7, height: 14, background: s.hex }} />)}
          </span>
          <span className="mono-sm dim" style={{ fontSize: 10 }}>{pal.name.slice(0, 20)}</span>
        </button>
        <button className="btn" style={{ fontSize: 9, padding: "3px 7px" }} onClick={reforge} title="re-forge the palette">↻</button>
        <span style={{ width: 1, height: 20, background: "var(--line)" }} />
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-.01em", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title="site name — rename from the dashboard">
          {doc.brand || "untitled"}
        </div>
        {purpose && <span className="mono-sm faint" style={{ fontSize: 9, textTransform: "capitalize" }}>{purpose.label}</span>}
        <span className="row" style={{ gap: 4 }} title={`autosaved · ${new Date(savedTick || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: savedTick ? "var(--ok)" : "var(--fg-faint)", display: "inline-block" }} />
          <span className="faint mono-sm" style={{ fontSize: 8 }}>auto</span>
        </span>

        <span style={{ flex: 1 }} />

        <button className="btn" data-active={showGuides} style={{ fontSize: 11, padding: "4px 8px" }} title="12-column guides" onClick={() => setShowGuides((v) => !v)}>⌗</button>
        <div className="row" style={{ border: "1px solid var(--line)" }}>
          <button className="btn" style={{ border: 0, fontSize: 11, padding: "4px 7px", borderRadius: 0 }} disabled={zoom === null} onClick={() => setZoom((z) => Math.max(0.25, (z ?? 1) - 0.1))}>−</button>
          <button className="btn" style={{ border: 0, fontSize: 9, padding: "4px 6px", borderRadius: 0, minWidth: 44 }} onClick={() => setZoom(null)} title="reset to fit">
            {zoom !== null ? `${Math.round(zoom * 100)}%` : "fit"}
          </button>
          <button className="btn" style={{ border: 0, fontSize: 11, padding: "4px 7px", borderRadius: 0 }} disabled={zoom !== null && zoom >= 1.5} onClick={() => setZoom((z) => Math.min(1.5, (z ?? 1) + 0.1))}>+</button>
        </div>
        <div className="row" style={{ border: "1px solid var(--line)" }}>
          {DEVICES.map((d) => (
            <button key={d.id} className="btn" data-active={devW === d.w} style={{ border: 0, fontSize: 9.5, padding: "5px 9px", borderRadius: 0 }} onClick={() => { setDevW(d.w); setSel(null); }}>{d.label}</button>
          ))}
        </div>
        {!single ? (
          <select className="input" style={{ width: 112, fontSize: 10, padding: "5px 6px" }} value={doc.transition} title="page transition — plays on page switches and in the export"
            onChange={(e) => commit({ ...doc, transition: e.target.value as CvTransition })}>
            {TRANSITIONS.map((t) => <option key={t} value={t}>{t === "none" ? "no transition" : `${t} pages`}</option>)}
          </select>
        ) : (
          <button className="row gap-1" style={{ border: "1px solid var(--line)", padding: "5px 9px", fontSize: 9.5, cursor: "default" }} title="single long page — transitions apply to multi-page sites">
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--fg-faint)" }} /> one long page
          </button>
        )}
        <span className="row gap-1" style={{ border: "1px solid var(--line)", padding: "4px 8px" }} title="live quality scores">
          <span className="mono-sm" style={{ fontSize: 9.5, color: audit.score >= 85 ? "var(--ok)" : audit.score >= 70 ? "var(--warn)" : "var(--bad)" }}>page {audit.score}</span>
          <span className="faint mono-sm" style={{ fontSize: 8.5 }}>pal {pAudit.score}</span>
        </span>
        <button className="btn" style={{ fontSize: 11, padding: "4px 8px" }} onClick={undo} disabled={!past.length} title="undo (ctrl+z)">↶</button>
        <button className="btn" style={{ fontSize: 11, padding: "4px 8px" }} onClick={redo} disabled={!future.length} title="redo (ctrl+shift+z)">↷</button>
        <button className="btn" style={{ fontSize: 10, padding: "5px 9px" }} onClick={() => setCedalionOpen(true)} title="ask cedalion about this page">☖</button>
        <button
          className="btn"
          style={{ fontSize: 10, padding: "5px 9px" }}
          onClick={() => {
            const el = document.querySelector("[data-site-options]");
            el?.scrollIntoView({ block: "center", behavior: "smooth" });
            if (el) { el.animate([{ background: "var(--raise)" }, { background: "transparent" }], { duration: 700, easing: "ease-out" }); }
            say("site options — twelve switches, and the export obeys every one");
          }}
          title="the site-wide switches: typeface, corners, depth, motion…"
        >⚙ site</button>
        <button className="btn" data-active={preview} style={{ fontSize: 10, padding: "5px 9px" }} onClick={() => openPreview()} title="open the site exactly as the export ships it">
          {preview ? "■ exit" : "▶ preview"}
        </button>
        <button className="btn btn-primary" style={{ fontSize: 10, padding: "5px 10px" }} onClick={exportHtml}>export .html</button>
      </div>

      {/* ================= body ================= */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* ---- left rail ---- */}
        <aside style={{ width: 198, borderRight: "1px solid var(--line)", background: "var(--surface)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 12px 8px" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">{single ? "the page" : "pages"}</span>
              {!single && <button className="faint" style={{ fontSize: 14, lineHeight: 1 }} onClick={addPage} title="add page">+</button>}
            </div>
            {single ? (
              <div className="faint mono-sm" style={{ fontSize: 8.5, lineHeight: 1.6, border: "1px dashed var(--line)", padding: "6px 8px", borderRadius: 8 }}>
                one long scroll — stack sections from the grid library, drag ⣿ at the page end to extend it.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {active.map((p, i) => (
                  <div key={p.id} className="row" style={{ gap: 4 }}>
                    <button
                      className="row gap-1"
                      style={{ flex: 1, border: i === pageIx ? "1px solid var(--fg-faint)" : "1px solid var(--line)", background: i === pageIx ? "var(--raise)" : "transparent", padding: "5px 9px", fontSize: 10.5, textAlign: "left", borderRadius: 7 }}
                      onClick={() => switchPage(i)}
                    >
                      <span style={{ color: "var(--accent)", fontSize: 9 }}>{i === pageIx ? "●" : "○"}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span className="faint mono-sm" style={{ marginLeft: "auto", fontSize: 8 }}>{p.blocks.length}</span>
                    </button>
                    {i !== pageIx && (
                      <button className="faint" style={{ fontSize: 11, padding: "0 3px" }} onClick={() => removePage(i)} title="delete page">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(doc.parked?.length ?? 0) > 0 && (
              <div className="faint mono-sm" style={{ fontSize: 8.5, marginTop: 6, lineHeight: 1.5 }}>
                {doc.parked!.length} page{doc.parked!.length === 1 ? "" : "s"} parked — switch to “multiple pages” to restore.
              </div>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="row gap-1" data-active={single} style={{ flex: 1, justifyContent: "center", border: "1px solid var(--line)", padding: "4px", fontSize: 9 }} title="site shape" onClick={toggleMode}>
                {single ? "▤ one long page" : "▥ multiple pages"}
              </button>
            </div>
          </div>
          <div className="rule" />
          <div style={{ padding: "10px 12px 4px", overflowY: "auto", flex: 1 }}>
            <button className="row gap-1" style={{ width: "100%", justifyContent: "space-between", border: "1px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, var(--raise))", padding: "8px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, marginBottom: 10 }}
              onClick={() => setShowGrids(true)}>
              <span>▦ grid library</span>
              <span className="mono-sm" style={{ fontSize: 8.5, opacity: 0.7 }}>{GRID_PRESETS.length} layouts</span>
            </button>
            {KIND_GROUPS.map((g) => (
              <div key={g.label} style={{ marginBottom: 10 }}>
                <div className="label" style={{ fontSize: 8, marginBottom: 4, letterSpacing: "0.14em" }}>{g.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {g.items.map((k) => (
                    <button key={k.id} className="row gap-1" style={{ border: "1px solid var(--line)", padding: "5px 6px", fontSize: 9.5, textAlign: "left", borderRadius: 6 }} onClick={() => addBlock(k.id)}>
                      <span style={{ width: 13, color: "var(--fg-dim)", fontSize: 10, textAlign: "center", flexShrink: 0 }}>{k.icon}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--line)", padding: "8px 12px" }}>
            <div className="faint mono-sm" style={{ fontSize: 8, lineHeight: 1.7 }}>
              click · select · drag · corners resize
              <br />dbl-click text · del · [ ] order · esc
            </div>
          </div>
        </aside>

        {/* ---- canvas ---- */}
        <section style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <div ref={viewRef} className="cv-dots" style={{ flex: 1, overflow: "auto", padding: "22px 24px 30px", position: "relative" }}>
            <div style={{ width: devW * scale, margin: "0 auto", position: "relative" }}>
              {/* page chrome */}
              <div style={{ height: 32, border: "1px solid var(--line)", borderBottom: "none", background: "var(--raise)", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
                <span className="row" style={{ gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f87171" }} />
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#fbbf24" }} />
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4ade80" }} />
                </span>
                <div style={{ margin: "0 auto", background: "var(--bg)", border: "1px solid var(--line-soft)", borderRadius: 999, padding: "2px 14px", fontSize: 9.5, color: "var(--fg-dim)", fontFamily: "ui-monospace, monospace" }}>
                  {doc.brand || "untitled"} / {page.name} · {devW}px
                </div>
                <span className="mono-sm faint" style={{ fontSize: 8.5 }}>{Math.round(H)}px tall</span>
              </div>
              {/* stage */}
              <div data-frame style={{ width: devW * scale, height: H * scale }}>
                <div
                  className={`cv-pg ${transClass}`}
                  onPointerDown={onPageDown}
                  onAnimationEnd={(e) => (e.currentTarget as HTMLElement).classList.remove("cv-fade", "cv-slide", "cv-scale")}
                  style={{
                    width: devW, minHeight: H,
                    background: page.bg ?? roleHex(pal, "background"),
                    position: "relative", transform: `scale(${scale})`, transformOrigin: "0 0",
                    overflow: devW < 1200 ? "hidden" : "visible",
                    borderRadius: "0 0 4px 4px",
                    boxShadow: "0 30px 80px -28px rgba(0,0,0,.55)",
                  }}
                >
                  {showGuides && !preview && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} style={{ position: "absolute", left: i * 100, top: 0, bottom: 0, width: 1, background: "color-mix(in srgb, var(--accent) 10%, transparent)" }} />
                      ))}
                    </div>
                  )}
                  {page.blocks.map((b) => (
                    <BlockView
                      key={b.id}
                      b={b}
                      pal={pal}
                      selected={sel === b.id}
                      editing={editId === b.id}
                      preview={preview}
                      brand={doc.brand}
                      others={others}
                      devW={devW}
                      sty={STY}
                      onDown={(e) => onBlockDown(b, e)}
                      onHandle={(ax, e) => onHandleDown(b, ax, e)}
                      onEdit={(id) => { setSel(id); setEditId(id); }}
                      onText={liveText}
                    />
                  ))}
                  {!preview && page.blocks.length === 0 && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                        <div className="label" style={{ fontSize: 13 }}>your canvas is empty</div>
                        <div className="faint" style={{ fontSize: 10.5, maxWidth: 300, lineHeight: 1.6 }}>
                          drop a whole section from the grid library, or start with a single block from the left rail. every block takes clicks: ⌥-click reaches the one behind, tab walks the stack.
                        </div>
                        <div className="row gap-1" style={{ marginTop: 6 }}>
                          <button className="btn btn-primary" style={{ fontSize: 11, padding: "7px 14px" }} onClick={() => setShowGrids(true)}>▦ open grid library</button>
                          <button className="btn" style={{ fontSize: 11, padding: "7px 14px" }} onClick={() => addBlock("heading")}>+ heading</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* extend handle */}
                  {!preview && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: H - 6, height: 12, zIndex: 25, pointerEvents: "none", display: "flex", justifyContent: "center" }}>
                      <div
                        onPointerDown={startPageExtend}
                        title="drag to extend the page"
                        style={{
                          pointerEvents: "auto", cursor: "ns-resize", userSelect: "none", touchAction: "none",
                          display: "flex", alignItems: "center", gap: 6, padding: "2px 14px",
                          borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)",
                          boxShadow: "0 6px 18px -6px rgba(0,0,0,.5)", fontSize: 9,
                          color: "var(--fg-dim)", letterSpacing: ".08em",
                        }}
                      >
                        ⣿ extend
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* status strip */}
          <div className="row" style={{ height: 26, borderTop: "1px solid var(--line)", background: "var(--surface)", padding: "0 14px", gap: 14, flexShrink: 0 }}>
            <span className="mono-sm faint" style={{ fontSize: 9 }}>
              {preview ? "▶ live preview of the export — links and pages work inside it" : single ? "▤ single page" : `▥ ${active.length} page${active.length === 1 ? "" : "s"}`} · {doc.transition}
            </span>
            <span className="mono-sm faint" style={{ fontSize: 9 }}>
              {selBlock ? `sel ${selBlock.kind} · ${selBlock.x},${selBlock.y} · ${selBlock.w}×${selBlock.h}` : page.blocks.length + " blocks"}
            </span>
            {devW < 1200 && !preview && <span className="mono-sm faint" style={{ fontSize: 9 }}>device view crops the right side — edit on desktop</span>}
            <span style={{ flex: 1 }} />
            {issues.length > 0 && (
              <span className="mono-sm" style={{ fontSize: 9, color: "var(--warn)" }}>{issues.length} issue{issues.length === 1 ? "" : "s"} · merkhet can fix</span>
            )}
          </div>
        </section>

        {/* ---- inspector ---- */}
        <Inspector
          options={doc.options}
          onOptions={setOption}
          block={selBlock}
          page={page}
          pageIx={pageIx}
          pages={active}
          pal={pal}
          audit={audit}
          notes={notes}
          single={single}
          onBlock={(id, mut) => liveBlock(id, mut)}
          onPage={(mut) => setDoc((d) => pageMap(mut, d))}
          onRename={(name) => renamePage(pageIx, name)}
          onDeleteBlock={removeBlock}
          onDuplicate={duplicate}
          onMoveZ={moveZ}
          onText={(id, t) => liveText(id, t)}
          onClearSel={() => { setSel(null); setEditId(null); }}
          onChat={() => setCedalionOpen(true)}
          onMerkhet={() => setShowMerq(true)}
          onRunMerkhet={runMerkhet}
          onMode={toggleMode}
        />
      </div>

      {/* grid library */}
      {showGrids && <GridLibrary onClose={() => setShowGrids(false)} onPick={addPreset} />}

      {preview && previewHtml !== null && (
        <SitePreview
          html={previewHtml}
          brand={doc.brand || "untitled"}
          pages={active.length}
          onRefresh={() => { setPreviewHtml(canvasToHtml(docRef.current, pal)); say("re-rendered from the canvas as it stands now"); }}
          onOpenTab={openInTab}
          onClose={closePreview}
        />
      )}

      {/* merkhet */}
      {!showMerq ? (
        <button
          style={{ position: "fixed", bottom: 40, right: 308, zIndex: 40, padding: "8px 14px", background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 999, fontSize: 11, fontWeight: 700, boxShadow: "0 12px 32px -12px rgba(0,0,0,.6)", cursor: "pointer" }}
          onClick={() => setShowMerq(true)}
        >
          ✦ merkhet — fix
        </button>
      ) : (
        <MerkhetPanel
          issues={issues}
          report={report}
          verdict={merq}
          onRun={runMerkhet}
          onCheck={checkMerkhet}
          onReveal={reveal}
          onClose={() => setShowMerq(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function counts(blocks: CvBlock[]) {
  const k: Record<string, number> = {};
  for (const b of blocks) k[b.kind] = (k[b.kind] ?? 0) + 1;
  return k;
}

/* ================= block view ================= */

const HANDLE_AXES: { ax: Axis; style: React.CSSProperties; cursor: string }[] = [
  { ax: { ex: -1, ey: -1 }, style: { left: -5, top: -5 }, cursor: "nwse-resize" },
  { ax: { ex: 0, ey: -1 }, style: { left: "50%", top: -5, marginLeft: -5 }, cursor: "ns-resize" },
  { ax: { ex: 1, ey: -1 }, style: { right: -5, top: -5 }, cursor: "nesw-resize" },
  { ax: { ex: -1, ey: 0 }, style: { left: -5, top: "50%", marginTop: -5 }, cursor: "ew-resize" },
  { ax: { ex: 1, ey: 0 }, style: { right: -5, top: "50%", marginTop: -5 }, cursor: "ew-resize" },
  { ax: { ex: -1, ey: 1 }, style: { left: -5, bottom: -5 }, cursor: "nesw-resize" },
  { ax: { ex: 0, ey: 1 }, style: { left: "50%", bottom: -5, marginLeft: -5 }, cursor: "ns-resize" },
  { ax: { ex: 1, ey: 1 }, style: { right: -5, bottom: -5 }, cursor: "nwse-resize" },
];

function BlockView({ b, pal, selected, editing, preview, brand, others, devW, sty, onDown, onHandle, onEdit, onText }: {
  b: CvBlock; pal: Palette; selected: boolean; editing: boolean; preview: boolean;
  sty: ReturnType<typeof optOf>;
  brand: string; others: CvPage[]; devW: number;
  onDown: (e: React.PointerEvent) => void;
  onHandle: (ax: Axis, e: React.PointerEvent) => void;
  onEdit: (id: string) => void;
  onText: (id: string, t: string) => void;
}) {
  const c = blockColors(b.kind, pal, b);
  const fg = b.fg ?? c.fg;
  const band = bandKind(b.kind);
  const handles = selected && !preview && !band && b.kind !== "spacer";
  const style: React.CSSProperties = {
    position: "absolute", left: b.x, top: b.y, width: b.w, minHeight: b.h,
    borderRadius: b.kind === "chip" ? 999 : Math.max(0, (b.radius ?? (b.kind === "card" ? 16 : b.kind === "stat" ? 14 : 10)) + sty.radius),
    fontFamily: sty.font,
    zIndex: selected ? 6 : b.z ?? STACK_BASE[b.kind] ?? 2,
    cursor: preview ? (b.kind === "nav" || b.kind === "button" ? "pointer" : "default") : band ? "default" : "move",
  };
  if (band) { style.width = devW; style.height = b.h; style.minHeight = undefined; style.left = 0; }
  if (b.kind === "spacer") { style.height = b.h; }
  if (b.kind === "image") {
    style.background = b.bg
      ? b.bg
      : sty.imageFill === "flat" ? roleHex(pal, "primary")
      : sty.imageFill === "duotone" ? `linear-gradient(165deg, ${roleHex(pal, "primary")} 0%, ${roleHex(pal, "accent")} 100%)`
      : sty.imageFill === "hatched" ? `repeating-linear-gradient(135deg, ${roleHex(pal, "primary")} 0 9px, ${roleHex(pal, "secondary")} 9px 18px)`
      : `linear-gradient(135deg, ${roleHex(pal, "primary")}, ${roleHex(pal, "secondary")})`;
    style.height = b.h;
  }
  else if (b.kind === "card" || b.kind === "stat") style.background = roleHex(pal, "surface", b.bg);
  else if (b.bg) style.background = b.bg;

  const inner = (() => {
    switch (b.kind) {
      case "heading":
        return (
          <div style={{ fontWeight: b.weight ?? 800, fontSize: Math.round((b.size ?? 52) * sty.typeScale), lineHeight: 1.08, letterSpacing: `${sty.headingTrack}em`, textTransform: sty.headingCase === "upper" ? "uppercase" : "none", color: fg, textAlign: b.align ?? "left", width: "100%" }}>
            {b.text}
          </div>
        );
      case "text":
        return <div style={{ fontSize: Math.round((b.size ?? 18) * sty.typeScale), lineHeight: 1.65, color: fg, textAlign: b.align ?? "left" }}>{b.text}</div>;
      case "quote":
        return (
          <div style={{ height: "100%", padding: "2px 0 2px 26px", borderLeft: `3px solid ${roleHex(pal, "accent")}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: Math.round((b.size ?? 26) * sty.typeScale), lineHeight: 1.4, fontWeight: 600, letterSpacing: "-.01em", color: fg }}>{b.text}</div>
            {b.sub && <div style={{ marginTop: 8, color: roleHex(pal, "muted"), fontSize: 13.5 }}>{b.sub}</div>}
          </div>
        );
      case "list": {
        const lines = (b.text ?? "").split("\n").map((t) => t.trim()).filter(Boolean).map((t) => t.replace(/^[•▪◦–—-]\s*/, ""));
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: Math.round((b.size ?? 17) * sty.typeScale), lineHeight: 1.5, color: fg, justifyContent: "center", minHeight: "100%" }}>
            {lines.map((t, i) => (
              <div key={i} className="row gap-1" style={{ alignItems: "flex-start" }}>
                <span style={{ color: roleHex(pal, "accent"), fontSize: ".8em", marginTop: ".4em" }}>▸</span>
                <span style={{ textAlign: b.align ?? "left", flex: 1 }}>{t}</span>
              </div>
            ))}
          </div>
        );
      }
      case "button": {
        const variant = (b.variant ?? "solid") as string;
        const solid = variant === "solid";
        const accentHex = roleHex(pal, "accent", b.bg);
        return (
          <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: b.align === "center" ? "center" : b.align === "right" ? "flex-end" : "flex-start" }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 22px", height: "100%",
                background: solid ? accentHex : variant === "outline" ? "transparent" : "transparent",
                color: solid ? readableOn(accentHex, roleHex(pal, "text")) : fg,
                border: variant === "outline" ? `2px solid ${b.line ?? roleHex(pal, "text")}` : variant === "ghost" ? "2px solid transparent" : "2px solid transparent",
                borderRadius: sty.buttonShape === "pill" ? 999 : sty.buttonShape === "square" ? 0 : Math.max(0, (b.radius ?? 10) + sty.radius),
                fontWeight: b.weight ?? 700, fontSize: Math.round((b.size ?? 17) * sty.typeScale), whiteSpace: "nowrap",
                opacity: variant === "ghost" ? 0.92 : 1,
              }}
            >
              {b.text}{b.link && !preview ? " ↗" : ""}
            </span>
          </div>
        );
      }
      case "card":
        return (
          <div style={{ height: "100%", background: roleHex(pal, "surface", b.bg), border: sty.cardBorder ? `1px solid ${b.line ?? roleHex(pal, "border")}` : "none", borderRadius: Math.max(0, (b.radius ?? 16) + sty.radius), padding: Math.round(20 * sty.airiness), display: "flex", flexDirection: "column", gap: Math.round(8 * sty.airiness) }}>
            <div style={{ fontWeight: 700, fontSize: Math.round(((b.size ?? 17) + 4) * sty.typeScale), color: b.fg ?? roleHex(pal, "text") }}>{b.text}</div>
            <div style={{ fontSize: Math.round((b.size ?? 15) * sty.typeScale), lineHeight: 1.55, color: roleHex(pal, "muted"), whiteSpace: "pre-line" }}>{b.sub}</div>
          </div>
        );
      case "stat":
        return (
          <div style={{ height: "100%", background: roleHex(pal, "surface", b.bg), border: sty.cardBorder ? `1px solid ${b.line ?? roleHex(pal, "border")}` : "none", borderRadius: Math.max(0, (b.radius ?? 14) + sty.radius), padding: `${Math.round(14 * sty.airiness)}px ${Math.round(18 * sty.airiness)}px`, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
            <div style={{ fontSize: Math.round((b.size ?? 40) * sty.typeScale), fontWeight: 800, letterSpacing: "-.02em", color: b.fg ?? roleHex(pal, "accent") }}>{b.text}</div>
            <div style={{ color: roleHex(pal, "muted"), fontSize: 13 }}>{b.sub}</div>
          </div>
        );
      case "image":
        return <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "rgba(255,255,255,.9)", fontSize: 26 }}>▣</div>;
      case "chip":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", height: "100%", padding: "0 18px", background: roleHex(pal, "accent", b.bg), color: readableOn(roleHex(pal, "accent", b.bg), "#fff"), fontSize: b.size ?? 13, fontWeight: 700, borderRadius: 999 }}>
            {b.text}
          </span>
        );
      case "divider": {
        const v = (b.variant as string) ?? "soft";
        const grad =
          v === "gradient" ? `linear-gradient(90deg, ${roleHex(pal, "primary")}, ${roleHex(pal, "accent")}, ${roleHex(pal, "secondary")})`
          : v === "solid" ? roleHex(pal, "border")
          : `linear-gradient(90deg, transparent, ${roleHex(pal, "border")} 16%, ${roleHex(pal, "border")} 84%, transparent)`;
        return <div style={{ width: "100%", height: Math.min(6, Math.max(2, b.h)), borderRadius: 999, background: grad, position: "relative", top: "50%", transform: "translateY(-50%)" }} />;
      }
      case "spacer":
        return <div style={{ width: "100%", height: "100%" }} />;
      case "nav":
        return <NavView b={b} pal={pal} brand={brand} others={others} />;
      case "footer":
        return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderTop: `1px solid ${roleHex(pal, "border")}`, color: roleHex(pal, "muted"), fontSize: b.size ?? 13 }}>{b.text}</div>;
      default:
        return null;
    }
  })();

  const dblKinds = ["heading", "text", "quote", "list", "button", "chip", "stat", "card", "footer"];

  return (
    <div
      className="cv-blk"
      data-blk={b.id}
      data-kind={b.kind}
      onPointerDown={onDown}
      onDoubleClick={(e) => {
        if (!preview && dblKinds.includes(b.kind)) { e.stopPropagation(); onEdit(b.id); }
      }}
      style={{
        ...style,
        outline: selected && !band ? "1.5px solid color-mix(in srgb, var(--accent) 80%, transparent)" : undefined,
        outlineOffset: selected ? 1 : 0,
      }}
    >
      {editing && !preview && dblKinds.includes(b.kind) ? (
        <EditText b={b} onDone={(t) => { onText(b.id, t); onEdit(""); }} />
      ) : (
        inner
      )}
      {handles &&
        HANDLE_AXES.map((h, i) => (
          <span
            key={i}
            onPointerDown={(e) => onHandle(h.ax, e)}
            style={{
              position: "absolute", width: 10, height: 10, ...h.style,
              background: "var(--surface)", border: "1.5px solid color-mix(in srgb, var(--accent) 85%, transparent)",
              borderRadius: "50%", cursor: h.cursor, zIndex: 8, boxShadow: "0 1px 4px rgba(0,0,0,.4)",
            }}
          />
        ))}
      {band && selected && !preview && (
        <span
          onPointerDown={(e) => onHandle({ ex: 0, ey: 1 }, e)}
          style={{ position: "absolute", left: "50%", bottom: -5, marginLeft: -5, width: 10, height: 10, background: "var(--surface)", border: "1.5px solid color-mix(in srgb, var(--accent) 85%, transparent)", borderRadius: "50%", cursor: "ns-resize", zIndex: 8 }}
        />
      )}
      {selected && !preview && (
        <span style={{ position: "absolute", left: 4, top: -19, background: "color-mix(in srgb, var(--accent) 90%, #000)", color: "var(--accent-fg)", fontSize: 8.5, padding: "1px 8px", borderRadius: 5, pointerEvents: "none", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", letterSpacing: ".02em", zIndex: 9 }}>
          {b.kind} · {b.x},{b.y} · {b.w}×{b.h}
        </span>
      )}
    </div>
  );
}

function EditText({ b, onDone }: { b: CvBlock; onDone: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    const w = window.getSelection();
    w?.removeAllRanges();
    w?.addRange(r);
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      style={{
        outline: "2px solid color-mix(in srgb, var(--accent) 80%, transparent)", outlineOffset: 2,
        minHeight: b.h, cursor: "text",
        fontWeight: b.weight ?? 700, fontSize: b.size ?? 20, lineHeight: 1.4,
      }}
      onBlur={(e) => onDone(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onDone((e.target as HTMLElement).innerText); }
        if (e.key === "Escape") { e.preventDefault(); onDone((e.target as HTMLElement).innerText); }
      }}
    >
      {b.text ?? ""}
    </div>
  );
}

function NavView({ b, pal, brand, others }: { b: CvBlock; pal: Palette; brand: string; others: CvPage[] }) {
  const v = (b.variant as string) ?? "minimal";
  const mut = roleHex(pal, "muted");
  const acc = roleHex(pal, "accent");
  const line = roleHex(pal, "border");
  const surf = roleHex(pal, "surface");
  const link = (name: string) => <span style={{ color: mut, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}>{name}</span>;
  const links = others.map((p) => <span key={p.id}>{link(p.name)}</span>);
  const right = others.length > 0 ? <div style={{ display: "flex", gap: 24, alignItems: "center" }}>{links}<span style={{ background: acc, color: readableOn(acc, "#fff"), fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 8, whiteSpace: "nowrap" }}>get started</span></div> : null;
  const brandEl = <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{brand}</span>;
  if (v === "centered")
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {brandEl}
        {others.length > 0 && <div style={{ display: "flex", gap: 24, fontWeight: 500, fontSize: 14, color: mut }}>{links}</div>}
      </div>
    );
  if (v === "pill")
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, background: surf, border: `1px solid ${line}`, borderRadius: 999, padding: "0 24px", height: Math.min(54, b.h - 10), boxShadow: "0 12px 30px -18px rgba(0,0,0,.4)" }}>
          {brandEl}
          {others.length > 0 && <div style={{ display: "flex", gap: 18, fontWeight: 500, fontSize: 14, color: mut }}>{links}</div>}
        </div>
      </div>
    );
  if (v === "glass")
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", background: "rgba(255,255,255,.05)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${line}` }}>
        {brandEl}{right}
      </div>
    );
  if (v === "bold")
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", borderBottom: `3px solid ${acc}`, textTransform: "uppercase" }}>
        {brandEl}{right}
      </div>
    );
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px" }}>
      {brandEl}{right}
    </div>
  );
}

/* ================= seeds ================= */

function seedBrand(purpose?: Purpose): string {
  if (purpose) {
    const words = purpose.label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (words.length >= 2) return words.slice(0, 2).join("");
  }
  return "new brand";
}
function seedBlocks(kind: "home" | "inner", brand: string) {
  return starterBlocks(kind).map((b) => (b.kind === "nav" ? { ...b, text: brand } : b));
}
function mkHeading(x: number, y: number, w: number, size: number, text: string): CvBlock {
  const b = emptyBlock("heading", x, y);
  return { ...b, w, size, weight: 800, h: Math.round(size * 1.5) + 24, text };
}
function mkText(x: number, y: number, w: number, text: string): CvBlock {
  const b = emptyBlock("text", x, y);
  return { ...b, w, h: 84, text };
}
function mkButton(x: number, y: number, w: number, text: string, variant = "solid"): CvBlock {
  const b = emptyBlock("button", x, y);
  return { ...b, w, h: 56, text, variant, size: 17, weight: 700 };
}
function mkCard(x: number, y: number, t: string, d: string): CvBlock {
  const b = emptyBlock("card", x, y);
  return { ...b, w: 340, h: 220, text: t, sub: d, size: 16 };
}
function mkStat(x: number, y: number, v: string, l: string): CvBlock {
  const b = emptyBlock("stat", x, y);
  return { ...b, w: 250, h: 130, text: v, sub: l, size: 42 };
}
function mkImage(x: number, y: number, w: number, h: number): CvBlock {
  const b = emptyBlock("image", x, y);
  return { ...b, w, h };
}
function mkFooter(brand: string, y: number): CvBlock {
  const b = emptyBlock("footer", 0, y);
  return { ...b, text: `© ${brand} — forged with hephaestus` };
}
function makeHome(c: ReturnType<typeof contentFor>): CvPage {
  const pg = freshPage("home");
  const feat = c.feats.slice(0, 3);
  const how = c.how.slice(0, 3);
  pg.blocks = [
    { ...emptyBlock("nav", 0, 0), x: 0, y: 0, w: FRAME_W, h: 74, text: c.brand },
    mkHeading(56, 150, 610, 60, c.heroH),
    mkText(56, 410, 560, c.heroS),
    mkButton(56, 560, 220, c.cta),
    { ...mkButton(310, 560, 250, c.cta2, "outline"), variant: "outline" },
    mkImage(706, 170, 440, 340),
    ...c.stats.slice(0, 4).map((s, i) => mkStat(56 + i * 282, 700, s.v, s.l)),
    mkHeading(56, 900, 640, 38, "Why it works"),
    ...feat.map((f, i) => mkCard(56 + i * 372, 1000, f.t, f.d)),
    mkHeading(56, 1280, 640, 38, "How it comes together"),
    ...how.map((h, i) => mkCard(56 + i * 372, 1380, `${i + 1}. ${h.t}`, h.d)),
    mkFooter(c.brand, 1660),
  ];
  return pg;
}
function makeInner(c: ReturnType<typeof contentFor>, name: string): CvPage {
  const pg = freshPage(name);
  const stat = c.stats[0];
  pg.blocks = [
    { ...emptyBlock("nav", 0, 0), x: 0, y: 0, w: FRAME_W, h: 74, text: c.brand },
    mkHeading(56, 150, 800, 52, name === "about" ? "Why it works" : "Get in touch"),
    mkText(56, 330, 720, name === "about" ? c.how.map((h) => h.t).join(" — ") : c.ctaS),
    stat ? mkStat(56, 480, stat.v, stat.l) : mkStat(56, 480, "4.9/5", "people who shipped"),
    name === "contact" ? mkButton(56, 660, 240, c.cta) : mkImage(660, 470, 440, 260),
    mkFooter(c.brand, 720),
  ];
  return pg;
}

/* ================= inspector ================= */

const BLOCK_TITLE: Partial<Record<CvKind, string>> = {
  heading: "heading", text: "paragraph", list: "bullets", quote: "quote", button: "button",
  chip: "chip", card: "card", stat: "stat", image: "image", divider: "divider",
  spacer: "spacer", nav: "navbar", footer: "footer",
};

function Inspector(props: {
  block: CvBlock | null; page: CvPage; pageIx: number; pages: CvPage[]; pal: Palette; single: boolean;
  audit: { score: number; issues: { sev: string; what: string; fix?: string }[] };
  notes: string[];
  onBlock: (id: string, mut: Partial<CvBlock> | ((b: CvBlock) => CvBlock)) => void;
  onPage: (mut: Partial<CvPage>) => void;
  onRename: (name: string) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicate: (b: CvBlock) => void;
  onMoveZ: (b: CvBlock, dir: -1 | 1) => void;
  onText: (id: string, t: string) => void;
  onClearSel: () => void;
  onChat: () => void; onMerkhet: () => void; onRunMerkhet: (m: MerkhetMode) => void;
  onMode: () => void;
  options?: CvOptions;
  onOptions: (patch: CvOptions) => void;
}) {
  const b = props.block;
  const pal = props.pal;
  const textKinds = ["heading", "text", "quote", "list", "button", "chip", "footer"];
  const subKinds = ["card", "stat", "quote"];
  const styleKinds = ["heading", "text", "quote", "list"];
  const palBgs = pal.swatches.filter((s) => ["background", "surface", "primary", "secondary", "accent"].includes(s.role));
  const palTxts = pal.swatches.filter((s) => ["text", "muted", "accent"].includes(s.role));

  return (
    <aside style={{ width: 288, borderLeft: "1px solid var(--line)", background: "var(--surface)", flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {b ? (
        <>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".01em", textTransform: "capitalize" }}>{BLOCK_TITLE[b.kind] ?? b.kind}</span>
            <span className="faint mono-sm" style={{ fontSize: 8.5 }}>{b.w}×{b.h}</span>
            <span style={{ flex: 1 }} />
            <button className="faint" style={{ fontSize: 11 }} onClick={props.onClearSel}>page ▸</button>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {textKinds.includes(b.kind) && (
              <Field label="text">
                <textarea className="input" style={{ width: "100%", minHeight: b.kind === "heading" ? 44 : 58, fontSize: 11, padding: 6, resize: "vertical" }} value={b.text ?? ""}
                  onChange={(e) => props.onText(b.id, e.target.value)} />
              </Field>
            )}
            {subKinds.includes(b.kind) && (
              <Field label={b.kind === "quote" ? "attribution" : "sub-line"}>
                <textarea className="input" style={{ width: "100%", minHeight: 42, fontSize: 11, padding: 6, resize: "vertical" }} value={b.sub ?? ""}
                  onChange={(e) => props.onBlock(b.id, { sub: e.target.value })} />
              </Field>
            )}
            {(textKinds.includes(b.kind) || subKinds.includes(b.kind) || b.kind === "heading") && (
              <Field label={`size · ${b.size ?? (b.kind === "heading" ? 52 : 18)}px`}>
                <input type="range" min={10} max={b.kind === "heading" ? 96 : b.kind === "quote" ? 60 : 40} value={b.size ?? (b.kind === "heading" ? 52 : 18)}
                  onChange={(e) => props.onBlock(b.id, { size: +e.target.value })} style={{ width: "100%" }} />
              </Field>
            )}
            {styleKinds.includes(b.kind) && (
              <>
                <Field label={`weight · ${b.weight ?? 700}`}>
                  <input type="range" min={300} max={900} step={100} value={b.weight ?? 700}
                    onChange={(e) => props.onBlock(b.id, { weight: +e.target.value })} style={{ width: "100%" }} />
                </Field>
                <Field label="alignment">
                  <div className="row gap-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} className="btn" data-active={(b.align ?? "left") === a} style={{ fontSize: 9.5, padding: "5px 9px", flex: 1 }}
                        onClick={() => props.onBlock(b.id, { align: a })}>{a}</button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            {b.kind === "button" && (
              <Field label="style">
                <div className="row gap-1">
                  {BTN_VARIANTS.map((v) => (
                    <button key={v} className="btn" data-active={(b.variant ?? "solid") === v} style={{ fontSize: 9.5, padding: "5px 9px", flex: 1 }} onClick={() => props.onBlock(b.id, { variant: v })}>{v}</button>
                  ))}
                </div>
              </Field>
            )}
            {b.kind === "nav" && (
              <Field label="navbar variant">
                <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                  {NAV_STYLES.map((v) => (
                    <button key={v} className="btn" data-active={(b.variant ?? "minimal") === v} style={{ fontSize: 9.5, padding: "5px 8px" }} onClick={() => props.onBlock(b.id, { variant: v })}>{v}</button>
                  ))}
                </div>
              </Field>
            )}
            {b.kind === "divider" && (
              <Field label="divider style">
                <div className="row gap-1">
                  {DIV_VARIANTS.map((v) => (
                    <button key={v} className="btn" data-active={(b.variant ?? "soft") === v} style={{ fontSize: 9.5, padding: "5px 9px", flex: 1 }} onClick={() => props.onBlock(b.id, { variant: v })}>{v}</button>
                  ))}
                </div>
              </Field>
            )}
            {b.kind === "button" && props.pages.length > 1 && (
              <Field label="links to page">
                <select className="input" style={{ width: "100%", fontSize: 10.5, padding: 6 }} value={b.link ?? ""}
                  onChange={(e) => props.onBlock(b.id, { link: e.target.value || undefined })}>
                  <option value="">— no link —</option>
                  {props.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="faint" style={{ fontSize: 8.5, lineHeight: 1.5 }}>click-through works in ▶ preview and in the exported file.</div>
              </Field>
            )}
            {b.kind === "button" && props.pages.length <= 1 && (
              <div className="faint" style={{ fontSize: 8.5, lineHeight: 1.5 }}>single-page site — buttons scroll the eye; link them when you switch to multiple pages.</div>
            )}
            {!["nav", "footer", "spacer", "divider"].includes(b.kind) && (
              <Field label="background">
                <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                  <Swatch role="auto" active={!b.bg} onPick={() => props.onBlock(b.id, { bg: undefined })} />
                  {palBgs.map((s) => (
                    <Swatch key={s.role} hex={s.hex} role={s.role} active={b.bg === s.hex} onPick={() => props.onBlock(b.id, { bg: s.hex })} />
                  ))}
                </div>
              </Field>
            )}
            {styleKinds.includes(b.kind) && (
              <Field label="text colour">
                <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                  <Swatch role="auto" active={!b.fg} onPick={() => props.onBlock(b.id, { fg: undefined })} />
                  {palTxts.map((s) => (
                    <Swatch key={s.role} hex={s.hex} role={s.role} active={b.fg === s.hex} onPick={() => props.onBlock(b.id, { fg: s.hex })} />
                  ))}
                </div>
              </Field>
            )}
            {!["nav", "footer", "spacer"].includes(b.kind) && (
              <Field label="radius">
                <input type="range" min={0} max={b.kind === "chip" ? 40 : 48} value={b.radius ?? (b.kind === "card" ? 16 : b.kind === "stat" ? 14 : 10)}
                  onChange={(e) => props.onBlock(b.id, { radius: +e.target.value })} style={{ width: "100%" }} />
              </Field>
            )}
            <div className="row gap-1" style={{ marginTop: 2, flexWrap: "wrap" }}>
              {!bandKind(b.kind) && b.kind !== "spacer" && (
                <>
                  <button className="btn" style={{ fontSize: 9.5, padding: "5px 8px" }} onClick={() => props.onDuplicate(b)}>⧉ dup</button>
                  <button className="btn" style={{ fontSize: 9.5, padding: "5px 8px" }} onClick={() => props.onMoveZ(b, -1)} title="send back — drops it below the block it overlaps ( [ )">⇤</button>
                  <button className="btn" style={{ fontSize: 9.5, padding: "5px 8px" }} onClick={() => props.onMoveZ(b, 1)} title="bring forward — lifts it above the block it overlaps ( ] )">⇥</button>
                </>
              )}
              <button className="btn" style={{ fontSize: 9.5, padding: "5px 8px", color: "var(--bad)" }} onClick={() => props.onDeleteBlock(b.id)}>✕ delete</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div className="row gap-1" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>page settings</span>
              <span className="mono-sm faint" style={{ fontSize: 9 }}>{props.pageIx + 1} / {props.pages.length}</span>
            </div>
            <div className="faint mono-sm" style={{ fontSize: 8.5, marginTop: 2 }}>nothing selected — click a block to style it</div>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="page name">
              <input className="input" style={{ width: "100%", fontSize: 11.5, padding: 6 }} value={props.page.name} onChange={(e) => props.onRename(e.target.value)} />
            </Field>
            <Field label="page background">
              <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                <Swatch role="auto" active={!props.page.bg} onPick={() => props.onPage({ bg: undefined })} />
                {palBgs.map((s) => (
                  <Swatch key={s.role} hex={s.hex} role={s.role} active={props.page.bg === s.hex} onPick={() => props.onPage({ bg: s.hex })} />
                ))}
              </div>
            </Field>
            <Field label={`page length · ${props.page.minH ? props.page.minH + "px" : "auto"}`}>
              <div className="row gap-1">
                <button className="btn" data-active={!props.page.minH} style={{ fontSize: 9.5, padding: "4px 8px" }} onClick={() => props.onPage({ minH: undefined })}>auto</button>
                <button className="btn" data-active={props.page.minH === 1600} style={{ fontSize: 9.5, padding: "4px 8px" }} onClick={() => props.onPage({ minH: 1600 })}>1600</button>
                <button className="btn" data-active={props.page.minH === 2600} style={{ fontSize: 9.5, padding: "4px 8px" }} onClick={() => props.onPage({ minH: 2600 })}>2600</button>
                <button className="btn" data-active={props.page.minH === 4200} style={{ fontSize: 9.5, padding: "4px 8px" }} onClick={() => props.onPage({ minH: 4200 })}>4200</button>
              </div>
              <input type="range" min={600} max={6000} step={50} value={props.page.minH ?? 600} style={{ width: "100%" }}
                onChange={(e) => props.onPage({ minH: +e.target.value })} />
              <div className="faint" style={{ fontSize: 8.5, lineHeight: 1.5 }}>drag the ⣿ handle at the bottom of the canvas for a free length.</div>
            </Field>
            <div className="rule" />
            {/* audit card */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, background: "var(--raise)" }}>
              <div className="row gap-1" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <span className="label" style={{ fontSize: 8.5 }}>page read</span>
                <span className="mono-sm" style={{ fontSize: 10, color: props.audit.score >= 85 ? "var(--ok)" : props.audit.score >= 70 ? "var(--warn)" : "var(--bad)" }}>
                  {props.audit.score}/100
                </span>
              </div>
              {props.audit.issues.length === 0 ? (
                <div className="faint" style={{ fontSize: 9, lineHeight: 1.5 }}>clean — nothing overlapping, everything clears contrast.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {props.audit.issues.slice(0, 4).map((i, k) => (
                    <div key={k} className="row gap-1" style={{ fontSize: 9, alignItems: "flex-start" }}>
                      <span style={{ color: i.sev === "critical" ? "var(--bad)" : "var(--warn)" }}>!</span>
                      <span style={{ lineHeight: 1.4 }}>{i.what}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="row gap-1" style={{ marginTop: 8, flexWrap: "wrap" }}>
                {(["theme", "contrast", "layout", "rhythm"] as const).map((m) => (
                  <button key={m} className="btn" style={{ fontSize: 8.5, padding: "3px 7px" }} onClick={() => props.onRunMerkhet(m)}>✦ {m}</button>
                ))}
              </div>
            </div>
            {props.notes.length > 0 && (
              <div style={{ borderLeft: "2px solid var(--accent)", padding: "2px 0 2px 10px" }}>
                <div className="label" style={{ fontSize: 8.5, marginBottom: 4 }}>cedalion notes</div>
                {props.notes.map((n, i) => (
                  <div key={i} className="faint" style={{ fontSize: 8.8, lineHeight: 1.55, marginBottom: 3 }}>{n}</div>
                ))}
              </div>
            )}
            <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={props.onChat}>☖ ask cedalion about this page</button>
            <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={props.onMerkhet}>✦ open merkhet fixer</button>
            <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={props.onMode}>{props.single ? "⇄ switch to multiple pages" : "⇄ make it one long page"}</button>
          </div>
        </>
      )}
      <SiteOptions options={props.options} onOptions={props.onOptions} />
    </aside>
  );
}

/** The site-wide choices. One component, so the inspector and the page panel can
 *  never offer two different sets of knobs. Everything here is honoured by the
 *  exporter too — it is not editor decoration. */
function SiteOptions({ options, onOptions }: { options?: CvOptions; onOptions: (patch: CvOptions) => void }) {
  const o = options ?? {};
  return (
    <div data-site-options style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", background: "var(--raise)", display: "flex", flexDirection: "column", gap: 9 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="label">site options</span>
        <button className="faint mono-sm" style={{ fontSize: 8.5 }} title="back to the defaults"
          onClick={() => onOptions({ typeScale: 1, radius: 0, depth: 0, fontStack: "modern", motionMs: 420, imageFill: "gradient", airiness: 1, headingCase: "none", headingTrack: -0.02, buttonShape: "soft", cardBorder: true })}>
          reset
        </button>
      </div>
      <div className="faint mono-sm" style={{ fontSize: 8.5, lineHeight: 1.55 }}>
        not editor decoration — the exported .html changes with every one of these.
      </div>

      <OptRow label="typeface">
        {([["modern", "modern sans"], ["editorial", "serif"], ["technical", "mono"]] as const).map(([id, lb]) => (
          <button key={id} className="btn" style={{ fontSize: 9.5, padding: "3px 7px", fontFamily: FONT_STACKS[id] }}
            data-active={(o.fontStack ?? "modern") === id} onClick={() => onOptions({ fontStack: id })}>{lb}</button>
        ))}
      </OptRow>

      <OptRow label={`text size · ×${(o.typeScale ?? 1).toFixed(2)}`}>
        <input type="range" min={0.85} max={1.25} step={0.05} value={o.typeScale ?? 1} style={{ flex: 1 }}
          onChange={(e) => onOptions({ typeScale: +e.target.value })} />
      </OptRow>

      <OptRow label={`corners · ${(o.radius ?? 0) > 0 ? "+" : ""}${o.radius ?? 0}px`}>
        <input type="range" min={-8} max={28} step={1} value={o.radius ?? 0} style={{ flex: 1 }}
          onChange={(e) => onOptions({ radius: +e.target.value })} />
      </OptRow>

      <OptRow label="card depth">
        {([[0, "flat"], [1, "soft"], [2, "raised"], [3, "floating"]] as const).map(([v, lb]) => (
          <button key={v} className="btn" style={{ fontSize: 9.5, padding: "3px 7px" }} data-active={(o.depth ?? 0) === v} onClick={() => onOptions({ depth: v })}>{lb}</button>
        ))}
      </OptRow>

      <OptRow label="image fill">
        {([["gradient", "blend"], ["flat", "flat"], ["duotone", "duotone"], ["hatched", "hatch"]] as const).map(([v, lb]) => (
          <button key={v} className="btn" style={{ fontSize: 9.5, padding: "3px 7px" }} data-active={(o.imageFill ?? "gradient") === v} onClick={() => onOptions({ imageFill: v })}>{lb}</button>
        ))}
      </OptRow>

      <OptRow label={`motion · ${o.motionMs ?? 420}ms`}>
        <input type="range" min={0} max={900} step={20} value={o.motionMs ?? 420} style={{ flex: 1 }}
          onChange={(e) => onOptions({ motionMs: +e.target.value })} />
        {(o.motionMs ?? 420) === 0 && <span className="faint mono-sm" style={{ fontSize: 8 }}>instant</span>}
      </OptRow>

      <OptRow label="headings">
        {([["none", "as written"], ["upper", "ALL CAPS"]] as const).map(([v, lb]) => (
          <button key={v} className="btn" style={{ fontSize: 9.5, padding: "3px 7px" }} data-active={(o.headingCase ?? "none") === v} onClick={() => onOptions({ headingCase: v })}>{lb}</button>
        ))}
      </OptRow>

      <OptRow label={`heading tracking · ${(o.headingTrack ?? -0.02).toFixed(3)}em`}>
        <input type="range" min={-0.05} max={0.12} step={0.005} value={o.headingTrack ?? -0.02} style={{ flex: 1 }}
          onChange={(e) => onOptions({ headingTrack: +e.target.value })} />
      </OptRow>

      <OptRow label="button shape">
        {([["square", "square"], ["soft", "soft"], ["pill", "pill"]] as const).map(([v, lb]) => (
          <button key={v} className="btn" style={{ fontSize: 9.5, padding: "3px 7px" }} data-active={(o.buttonShape ?? "soft") === v} onClick={() => onOptions({ buttonShape: v })}>{lb}</button>
        ))}
      </OptRow>

      <OptRow label="card outline">
        {([[true, "hairline"], [false, "none"]] as const).map(([v, lb]) => (
          <button key={String(v)} className="btn" style={{ fontSize: 9.5, padding: "3px 7px" }} data-active={(o.cardBorder ?? true) === v} onClick={() => onOptions({ cardBorder: v })}>{lb}</button>
        ))}
      </OptRow>

      <OptRow label={`airiness · ×${(o.airiness ?? 1).toFixed(2)}`}>
        <input type="range" min={0.7} max={1.6} step={0.05} value={o.airiness ?? 1} style={{ flex: 1 }}
          onChange={(e) => onOptions({ airiness: +e.target.value })} />
      </OptRow>
    </div>
  );
}

function OptRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="label" style={{ fontSize: 9 }}>{label}</span>
      <span className="row" style={{ gap: 4, flexWrap: "wrap", alignItems: "center" }}>{children}</span>
    </div>
  );
}

/** Full-size preview of the site as the export builds it — the same HTML string,
 *  in a frame, at the width you pick. Esc or “back to editing” closes it. */
function SitePreview({ html, brand, pages, onRefresh, onOpenTab, onClose }: {
  html: string; brand: string; pages: number;
  onRefresh: () => void; onOpenTab: () => void; onClose: () => void;
}) {
  const [w, setW] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const frameW = w ?? box.w;
  const scale = w ? Math.min(1, (box.w - 8) / w) : 1;
  return (
    <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 88, background: "var(--bg)", display: "flex", flexDirection: "column", padding: "10px 14px 14px", gap: 9 }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="row gap-2" style={{ alignItems: "baseline", minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "-.01em" }}>{brand}</span>
          <span className="faint mono-sm" style={{ fontSize: 8.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            the exported site · {pages > 1 ? `${pages} pages` : "one page"} · links work · esc closes
          </span>
        </div>
        <div className="row gap-1" style={{ flexWrap: "wrap" }}>
          <span className="label" style={{ fontSize: 8.5, paddingRight: 2 }}>view</span>
          <button className="btn" style={{ fontSize: 9.5, padding: "4px 9px" }} data-active={w === null} onClick={() => setW(null)}>fit</button>
          {[[1440, "wide"], [1200, "desktop"], [834, "tablet"], [390, "phone"]].map(([px, lb]) => (
            <button key={px} className="btn" style={{ fontSize: 9.5, padding: "4px 9px" }} data-active={w === px} onClick={() => setW(px as number)}>{lb}</button>
          ))}
          <span className="mono-sm faint" style={{ fontSize: 8.5, paddingLeft: 4, borderLeft: "1px solid var(--line)", marginLeft: 4 }}>
            {Math.round(scale * 100)}%
          </span>
          <button className="btn" style={{ fontSize: 9.5, padding: "4px 9px" }} onClick={onRefresh} title="re-build from the canvas as it stands">↻ refresh</button>
          <button className="btn" style={{ fontSize: 9.5, padding: "4px 9px" }} onClick={onOpenTab} title="opens a real file in a new tab">open in browser ↗</button>
          <button className="btn btn-primary" style={{ fontSize: 9.5, padding: "4px 11px" }} onClick={onClose}>■ back to editing</button>
        </div>
      </div>
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, display: "grid", placeItems: "start center", overflow: "hidden", background: "color-mix(in srgb, var(--bg) 82%, #000)", border: "1px solid var(--line)", borderRadius: 10 }}>
        <div style={{ width: frameW, height: box.h, transform: `scale(${scale})`, transformOrigin: "top left", marginLeft: w ? Math.max(0, (box.w - w * scale) / 2) : 0 }}>
          <iframe title={`preview of ${brand}`} srcDoc={html} style={{ width: frameW, height: box.h / scale, border: 0, display: "block", background: "#fff" }} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="label" style={{ fontSize: 9 }}>{label}</span>
      {children}
    </div>
  );
}

function Swatch({ hex, role, active, onPick }: { hex?: string; role: string; active: boolean; onPick: () => void }) {
  return (
    <button
      title={role}
      onClick={onPick}
      style={{
        width: 21, height: 21, borderRadius: 6, padding: 0, cursor: "pointer",
        border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
        background: hex ? hex : "repeating-conic-gradient(#9a9a9a 0% 25%, #e8e8e8 0% 50%) 0 0/9px 9px",
        boxShadow: hex ? "inset 0 0 0 1px rgba(0,0,0,.14)" : "none",
      }}
    />
  );
}

/* ================= merkhet panel ================= */

const MERKHET_MODES: { id: MerkhetMode; icon: string; name: string; desc: string; note: string }[] = [
  { id: "theme", icon: "◐", name: "put the colours back on one family", desc: "takes out the one-off colours you picked by hand, so the page matches your palette again", note: "it will not do this if the colour was the only thing keeping the text readable" },
  { id: "contrast", icon: "▤", name: "make everything readable", desc: "finds words you'd struggle to read where they sit, and darkens or lightens just those", note: "headings and paragraphs get checked against the card they're actually on, not the page behind it" },
  { id: "layout", icon: "⊞", name: "straighten the page", desc: "lines blocks up with the columns and pulls apart anything sitting on top of something else", note: "blocks inside a card follow the card — they don't get yanked out of it" },
  { id: "rhythm", icon: "≋", name: "even the spacing", desc: "rows that belong together get the same top line, and the gaps between them get equal", note: "only blocks that really overlap count as one row, so a heading never lands on its paragraph" },
];

function MerkhetPanel({ issues, report, verdict, onRun, onCheck, onReveal, onClose }: {
  issues: { sev: string; what: string; fix?: string }[]; report: string[];
  verdict: MerkhetVerdict | null;
  onRun: (m: MerkhetMode) => void; onCheck: () => void; onReveal: (id: string) => void; onClose: () => void;
}) {
  const [about, setAbout] = useState(false);
  return (
    <div style={{
      position: "fixed", right: 304, bottom: 40, width: 330, maxHeight: "72vh", zIndex: 50,
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14,
      boxShadow: "0 26px 70px -18px rgba(0,0,0,.55)", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ padding: "12px 14px", background: "var(--raise)", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 5 }}>
        <div className="row gap-1" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>✦ merkhet</span>
          <button className="faint" style={{ fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        <div className="faint" style={{ fontSize: 9.5, lineHeight: 1.5 }}>
          {about ? (
            <span>
              mer·khet was a shadow-clock: it measured something nobody could see by looking at where the light fell. this does the same with a page. it looks at what you built, finds the things that would make someone else's visit harder — words too faint, blocks stacked on each other, a row that doesn't line up, colours that stopped matching your palette — and changes only those.
              <br /><br />
              it never writes your site for you, and it never says it fixed something it hasn't checked twice: every change is measured before and after, and anything that made the page worse gets put straight back.
              <button className="faint underline" style={{ fontSize: 9, display: "block", marginTop: 4 }} onClick={() => setAbout(false)}>▴ collapse</button>
            </span>
          ) : (
            <button className="faint underline" style={{ fontSize: 9 }} onClick={() => setAbout(true)}>what is merkhet?</button>
          )}
        </div>
      </div>
      <div style={{ overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="faint" style={{ fontSize: 9 }}>
          {issues.length === 0 ? "this page reads clean — nothing to repair" : `this page: ${issues.length} finding${issues.length === 1 ? "" : "s"}`}
        </div>
        {issues.slice(0, 5).map((is, i) => (
          <div key={i} className="row gap-1" style={{ alignItems: "flex-start", fontSize: 9.5 }}>
            <span style={{ color: is.sev === "critical" ? "var(--bad)" : is.sev === "warning" ? "var(--warn)" : "var(--fg-dim)" }}>{is.sev === "note" ? "·" : "!"}</span>
            <span className="faint" style={{ lineHeight: 1.5 }}>{is.what}</span>
          </div>
        ))}
        {MERKHET_MODES.map((m) => (
          <button key={m.id} className="row gap-1" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", alignItems: "flex-start", textAlign: "left", background: "var(--raise)", cursor: "pointer" }}
            onClick={() => onRun(m.id)}>
            <span style={{ color: "var(--accent)", fontSize: 13 }}>{m.icon}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <b style={{ fontSize: 10.5 }}>{m.name}</b>
              <span className="faint" style={{ fontSize: 9 }}>{m.desc}</span>
              <span className="mono-sm faint" style={{ fontSize: 8 }}>{m.note}</span>
            </span>
          </button>
        ))}
        <button className="btn" style={{ fontSize: 9.5, padding: "4px 8px" }} onClick={onCheck} title="look at the page without changing anything">
          just check, don't change
        </button>

        {report.length > 0 && (() => {
          const clean = !verdict || verdict.ok;
          const nothing = verdict?.wasClean;
          const tone = nothing ? "var(--line)" : clean ? "var(--ok)" : "var(--warn)";
          const head = nothing
            ? "nothing to repair"
            : clean
              ? `checked twice: ${verdict!.fixed} of ${verdict!.before} fixed, nothing left`
              : `partial — ${verdict!.fixed} of ${verdict!.before}, ${verdict!.after} still open`;
          return (
            <div style={{ border: `1px solid ${tone}`, borderRadius: 10, padding: "8px 10px", background: `color-mix(in srgb, ${tone} 8%, transparent)` }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: tone }}>{clean ? "✓" : "◐"} {head}</span>
                {verdict && !verdict.ok && verdict.remainingIds.length > 0 && (
                  <button className="faint underline" style={{ fontSize: 8.5 }} onClick={() => onReveal(verdict.remainingIds[0])}>show me →</button>
                )}
              </div>
              {report.map((r, i) => (
                <div key={i} style={{ fontSize: 9, lineHeight: 1.65, color: "var(--fg-dim)" }}>· {r}</div>
              ))}
              {verdict && verdict.reverted > 0 && (
                <div className="faint mono-sm" style={{ fontSize: 8, marginTop: 4 }}>
                  {verdict.reverted} change{verdict.reverted === 1 ? "" : "s"} tried and put back
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ================= grid library ================= */

const THUMB_FILL: Record<string, React.CSSProperties> = {
  heading: { background: "rgba(120,122,134,.5)", borderRadius: 2 },
  text: { border: "1px dashed rgba(120,122,134,.4)" },
  list: { border: "1px dashed rgba(120,122,134,.4)" },
  button: { background: "rgba(190,191,200,.85)", borderRadius: 3 },
  chip: { background: "rgba(150,151,165,.75)", borderRadius: 999 },
  card: { background: "rgba(120,122,134,.22)", border: "1px solid rgba(140,142,155,.35)", borderRadius: 4 },
  stat: { background: "rgba(120,122,134,.22)", border: "1px solid rgba(140,142,155,.35)", borderRadius: 4 },
  image: { background: "repeating-linear-gradient(45deg, rgba(130,132,145,.28) 0 5px, rgba(130,132,145,.14) 5px 10px)", borderRadius: 4 },
  quote: { borderLeft: "3px solid rgba(190,191,200,.7)", background: "rgba(120,122,134,.10)" },
  divider: { background: "rgba(140,142,155,.5)", borderRadius: 999 },
  footer: { background: "rgba(120,122,134,.18)" },
  nav: { background: "rgba(120,122,134,.18)" },
  spacer: {},
};

function GridThumb({ preset }: { preset: GridPreset }) {
  const blocks = preset.build(FALLBACK);
  const span = blockSpan(blocks) + 140;
  const K = 0.15;
  return (
    <div style={{ width: "100%", height: Math.min(150, Math.max(60, span * K)), overflow: "hidden", position: "relative", background: "rgba(127,129,142,.06)", border: "1px solid var(--line)", borderRadius: 6 }}>
      <div style={{ width: 1200, transform: `scale(${K})`, transformOrigin: "0 0", position: "relative" }}>
        {blocks.map((b, i) => (
          <div key={i} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: Math.max(4, b.h), ...(THUMB_FILL[b.kind] ?? {}) }} />
        ))}
      </div>
    </div>
  );
}

function GridLibrary({ onClose, onPick }: { onClose: () => void; onPick: (p: GridPreset) => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(880px, 96vw)", maxHeight: "88vh", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 40px 120px -30px rgba(0,0,0,.7)" }}>
        <div className="row" style={{ justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>▦ grid library</div>
            <div className="faint" style={{ fontSize: 10, marginTop: 3 }}>
              full section layouts — pick one and it drops below your content, every piece fully editable.
            </div>
          </div>
          <button className="faint" style={{ fontSize: 16 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(205px, 1fr))", gap: 12 }}>
          {GRID_PRESETS.map((p) => (
            <button key={p.id} className="fade-in" onClick={() => onPick(p)} title={p.note}
              style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--line)", background: "var(--raise)", padding: 10, borderRadius: 10, cursor: "pointer" }}>
              <GridThumb preset={p} />
              <span>
                <b style={{ fontSize: 11.5 }}>{p.icon} {p.name}</b>
                <span className="faint mono-sm" style={{ fontSize: 8.5, display: "block", marginTop: 2 }}>{p.tag}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
