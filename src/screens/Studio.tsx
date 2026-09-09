/**
 * HEPHAESTUS · Studio — the free-build canvas.
 *
 * A proper little site-builder: pages, draggable & resizable blocks,
 * inline text editing, navbar variants, page transitions, live palette
 * theming, an inspector, and MERKHET — the fix engine.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store";
import { getPurpose, type Purpose } from "../data/trends";
import { generatePalette, type Palette } from "../engine/akmon";
import { auditPalette } from "../engine/cedalion";
import {
  blockColors, roleHex, readableOn, auditCanvas, merkhet, canvasToHtml,
  emptyBlock, freshDoc, freshPage, starterBlocks, uid, pageHeight,
  type CvBlock, type CvDoc, type CvKind, type CvPage, type CvTransition,
  type MerkhetMode,
} from "../engine/canvas";
import { contentFor } from "../engine/sites";
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
const NAV_STYLES = ["minimal", "centered", "pill", "glass", "bold"];
const BTN_VARIANTS = ["solid", "outline", "ghost"];
const KINDS: { id: CvKind; icon: string; label: string }[] = [
  { id: "heading", icon: "T", label: "heading" },
  { id: "text", icon: "¶", label: "text" },
  { id: "button", icon: "▭", label: "button" },
  { id: "card", icon: "▢", label: "card" },
  { id: "stat", icon: "Σ", label: "stat" },
  { id: "image", icon: "◫", label: "image" },
  { id: "chip", icon: "◆", label: "chip" },
  { id: "spacer", icon: "↕", label: "space" },
  { id: "nav", icon: "☰", label: "navbar" },
  { id: "footer", icon: "⌄", label: "footer" },
];

type Drag = { id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; ix: number } | null;

export default function Studio() {
  const { current, setCurrent, purposeId, go, say, setCedalionOpen } = useApp();
  const purpose = purposeId ? getPurpose(purposeId) : undefined;

  /* local palette — canvas retints when this changes */
  const [pal, setPal] = useState<Palette>(() => current ?? generatePalette({ prompt: purposeId ?? "modern site", seed: 5 }));
  const [doc, setDoc] = useState<CvDoc>(() => seedDoc(purpose));
  const [pageIx, setPageIx] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [devW, setDevW] = useState(1200);
  const [preview, setPreview] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [scale, setScale] = useState(1);
  const [showMerq, setShowMerq] = useState(false);
  const [report, setReport] = useState<string[]>([]);
  const [past, setPast] = useState<CvDoc[]>([]);
  const [future, setFuture] = useState<CvDoc[]>([]);
  const seedRef = useRef(Math.floor(Math.random() * 1e6) + 1);
  const viewRef = useRef<HTMLDivElement>(null);
  const bootRef = useRef(false);

  const page = doc.pages[pageIx] ?? doc.pages[0];
  const selBlock = page.blocks.find((b) => b.id === sel) ?? null;
  const audit = useMemo(() => auditCanvas(page, pal), [page, pal]);
  const pAudit = useMemo(() => auditPalette(pal, purposeId ?? undefined), [pal, purposeId]);

  /* boot once with purpose content */
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const s = seedRef.current;
    if (purpose) {
      const c = contentFor(purpose, mulberry32(s));
      const h = makeHome(c);
      const a2 = makeInner(c, "about", "Why it works", c.how.map((x) => x.t).join(" — "));
      const pr = makePricing(c);
      setDoc({ brand: c.brand, transition: "fade", pages: [h, a2, pr] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* fit scale */
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 56) / devW));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [devW]);

  function commit(next: CvDoc) {
    setPast((p) => [...p.slice(-49), doc]);
    setFuture([]);
    setDoc(next);
  }
  /** live edit — no history step (typing, sliders, drags) */
  function live(next: CvDoc) {
    setDoc(next);
  }
  function pageMap(mut: Partial<CvPage> | ((p: CvPage) => CvPage), d: CvDoc = doc, ix: number = pageIx): CvDoc {
    return { ...d, pages: d.pages.map((p, i) => (i === ix ? (typeof mut === "function" ? mut(p) : { ...p, ...mut }) : p)) };
  }
  function patchPage(mut: Partial<CvPage> | ((p: CvPage) => CvPage)) {
    commit(pageMap(mut));
  }
  function livePage(mut: Partial<CvPage> | ((p: CvPage) => CvPage)) {
    live(pageMap(mut));
  }
  function blockMap(id: string, mut: Partial<CvBlock> | ((b: CvBlock) => CvBlock), d: CvDoc = doc, ix: number = pageIx): CvDoc {
    return pageMap((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? (typeof mut === "function" ? mut(b) : { ...b, ...mut }) : b)) }), d, ix);
  }
  function liveBlock(id: string, mut: Partial<CvBlock> | ((b: CvBlock) => CvBlock)) {
    live(blockMap(id, mut));
  }
  function undo() {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setFuture((f) => [doc, ...f].slice(0, 50));
    setPast((p) => p.slice(0, -1));
    setDoc(prev);
    setSel(prev.pages[Math.min(pageIx, prev.pages.length - 1)]?.blocks[0]?.id ?? null);
  }
  function redo() {
    if (!future.length) return;
    const nx = future[0];
    setPast((p) => [...p, doc].slice(-50));
    setFuture((f) => f.slice(1));
    setDoc(nx);
  }

  /* ---------- page ops ---------- */
  const addPage = () => {
    const name = `page ${doc.pages.length + 1}`;
    const np = freshPage(name);
    np.blocks = starterBlocks("inner");
    np.blocks = np.blocks.map((b) => (b.kind === "nav" ? { ...b, text: doc.brand } : b));
    commit({ ...doc, pages: [...doc.pages, np] });
    setPageIx(doc.pages.length);
    setSel(null);
    say(`page “${name}” added`);
  };
  const removePage = (ix: number) => {
    if (doc.pages.length <= 1) { say("keep at least one page"); return; }
    const pages = doc.pages.filter((_, i) => i !== ix);
    commit({ ...doc, pages });
    setPageIx(Math.min(pageIx, pages.length - 1));
    setSel(null);
  };
  const renamePage = (ix: number, name: string) => {
    live({ ...doc, pages: doc.pages.map((p, i) => (i === ix ? { ...p, name } : p)) });
  };
  const switchPage = (ix: number) => {
    if (ix === pageIx) return;
    setPageIx(ix);
    setSel(null);
    setEditId(null);
  };

  /* ---------- block ops ---------- */
  const addBlock = (kind: CvKind) => {
    const b = emptyBlock(kind, 60, 120);
    if (kind === "nav") { b.x = 0; b.y = 0; b.w = devW; b.text = doc.brand; }
    if (kind === "footer") { b.x = 0; b.y = pageHeight(page); b.w = devW; b.text = `© ${doc.brand} — forged with hephaestus`; }
    patchPage((p) => ({ ...p, blocks: [...p.blocks, b] }));
    setSel(b.id);
    say(`${kind} added — drag it, click to edit`);
  };
  const removeBlock = (id: string) => {
    patchPage((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));
    setSel(null);
  };
  const duplicate = (b: CvBlock) => {
    const nb = { ...b, id: uid(), y: b.y + 30, x: Math.min(b.x + 24, devW - b.w) };
    patchPage((p) => ({ ...p, blocks: [...p.blocks, nb] }));
    setSel(nb.id);
  };

  /* pointer math in page coordinates */
  const toPage = (e: { clientX: number; clientY: number }) => {
    const el = viewRef.current?.querySelector("[data-frame]") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = r.width / devW;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };

  /* one gesture = one history step (pre-drag snapshot), moves are live */
  const startDrag = (id: string, mode: "move" | "resize", e: React.PointerEvent, b: CvBlock) => {
    const pt = toPage(e);
    if (!pt) return;
    setSel(id);
    setEditId(null);
    setDrag({ id, mode, sx: pt.x, sy: pt.y, ox: b.x, oy: b.y, ow: b.w, oh: b.h, ix: pageIx });
    setPast((p) => [...p.slice(-49), doc]);
    setFuture([]);
  };

  useEffect(() => {
    if (!drag) return;
    const move = (ev: PointerEvent) => {
      const pt = toPage(ev);
      if (!pt) return;
      const d = drag;
      setDoc((cur) => {
        if (d.mode === "move") {
          return blockMap(d.id, { x: Math.max(0, Math.round(d.ox + pt.x - d.sx)), y: Math.max(0, Math.round(d.oy + pt.y - d.sy)) }, cur, d.ix);
        }
        return blockMap(d.id, { w: Math.max(48, Math.round(d.ow + pt.x - d.sx)), h: Math.max(28, Math.round(d.oh + pt.y - d.sy)) }, cur, d.ix);
      });
    };
    const up = () => setDrag(null);
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, devW]);

  const onBlockDown = (b: CvBlock, e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest?.("[contenteditable]")) return; // let text caret work
    if (preview) {
      if (b.kind === "nav" || b.kind === "button") {
        const target = b.link ?? doc.pages[Math.min(pageIx + 1, doc.pages.length - 1)].id;
        const ix = doc.pages.findIndex((p) => p.id === target);
        if (ix >= 0) switchPage(ix);
      }
      return;
    }
    if (b.kind === "nav" || b.kind === "footer") { setSel(b.id); setEditId(null); return; } // select only
    startDrag(b.id, "move", e, b);
  };
  const onResizeDown = (b: CvBlock, e: React.PointerEvent) => {
    e.stopPropagation();
    if (preview) return;
    startDrag(b.id, "resize", e, b);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (editId) return;
    if (!sel) return;
    if (e.key === "Delete" || e.key === "Backspace") { removeBlock(sel); e.preventDefault(); }
    if (e.key === "Escape") setSel(null);
    const step = e.shiftKey ? 10 : 1;
    const b = page.blocks.find((x) => x.id === sel);
    if (!b) return;
    if (e.key === "ArrowUp") { e.preventDefault(); liveBlock(sel, { y: Math.max(0, b.y - step) }); }
    if (e.key === "ArrowDown") { e.preventDefault(); liveBlock(sel, { y: b.y + step }); }
    if (e.key === "ArrowLeft") { e.preventDefault(); liveBlock(sel, { x: Math.max(0, b.x - step) }); }
    if (e.key === "ArrowRight") { e.preventDefault(); liveBlock(sel, { x: b.x + step }); }
  };

  const liveText = (id: string, text: string) => liveBlock(id, { text });

  /* merkhet */
  const runMerkhet = (mode: MerkhetMode) => {
    const { page: np, report: rep } = merkhet(page, pal, mode);
    commit({ ...doc, pages: doc.pages.map((p, i) => (i === pageIx ? np : p)) });
    setReport(rep);
    say(`merkhet · ${mode} done`);
  };

  const exportHtml = () => {
    download(`hephaestus-${(purpose?.id ?? "site").toLowerCase()}.html`, canvasToHtml(doc, pal), "text/html");
    say("exported — open in any browser");
  };

  const reforge = () => {
    const np = generatePalette({ prompt: purpose ? `${purpose.label} ${purpose.moodId ?? ""} site` : "modern", seed: Math.floor(Math.random() * 1e6) + 1 });
    setPal(np);
    setCurrent(np);
    say("palette re-forged — whole canvas retinted");
  };

  /* ================= UI ================= */
  if (!page) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg)" }}>
        <div style={{ fontSize: 26 }}>⚒</div>
        <div className="label" style={{ fontSize: 12 }}>no pages on this site</div>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={addPage}>create a page</button>
      </div>
    );
  }
  const H = pageHeight(page);
  const transClass =
    doc.transition === "fade" ? "cv-fade" : doc.transition === "slide" ? "cv-slide" : doc.transition === "scale" ? "cv-scale" : "";
  const others = doc.pages.filter((p) => p.id !== page.id);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }} onKeyDown={onKey} tabIndex={0}>
      {/* ======== top bar ======== */}
      <div className="row" style={{ height: 46, padding: "0 10px", borderBottom: "1px solid var(--line)", background: "var(--surface)", gap: 8, flexShrink: 0 }}>
        <button className="btn" style={{ fontSize: 11 }} onClick={() => go("home")}>← exit</button>
        <div className="row gap-1" style={{ border: "1px solid var(--line)", padding: "3px 8px", cursor: "pointer" }} onClick={() => say(purpose?.label ?? "untitled site")}>
          <span style={{ display: "inline-flex", gap: 1 }}>
            {pal.swatches.map((s) => <span key={s.role} style={{ width: 7, height: 14, background: s.hex, display: "inline-block" }} />)}
          </span>
          <span className="mono-sm dim" style={{ fontSize: 10 }}>{pal.name.slice(0, 18)}</span>
        </div>
        <button className="btn" style={{ fontSize: 9, padding: "3px 8px" }} title="re-forge palette — canvas retints" onClick={reforge}>↻ palette</button>

        <span style={{ flex: 1 }} />

        {/* devices */}
        <div className="row" style={{ border: "1px solid var(--line)" }}>
          {DEVICES.map((d) => (
            <button key={d.id} className="btn" data-active={devW === d.w} style={{ border: 0, fontSize: 10, padding: "6px 10px", borderRadius: 0 }} onClick={() => { setDevW(d.w); setSel(null); }}>{d.label}</button>
          ))}
        </div>

        {/* transition */}
        <select className="input" style={{ width: 110, fontSize: 10, padding: "5px 6px" }} value={doc.transition} title="page transition"
          onChange={(e) => commit({ ...doc, transition: e.target.value as CvTransition })}>
          {TRANSITIONS.map((t) => <option key={t} value={t}>{t === "none" ? "no transition" : `${t} pages`}</option>)}
        </select>

        <span className="row gap-1" style={{ border: "1px solid var(--line)", padding: "3px 8px" }}>
          <span className="mono-sm" style={{ fontSize: 10, color: audit.score >= 85 ? "var(--ok)" : audit.score >= 70 ? "var(--warn)" : "var(--bad)" }}>canvas {audit.score}</span>
          <span className="faint mono-sm" style={{ fontSize: 9 }}>· pal {pAudit.score}</span>
        </span>

        <button className="btn" style={{ fontSize: 10 }} onClick={undo} disabled={!past.length} title="undo">↶</button>
        <button className="btn" style={{ fontSize: 10 }} onClick={redo} disabled={!future.length} title="redo">↷</button>
        <button className="btn" data-active={preview} style={{ fontSize: 10 }} onClick={() => { setPreview((v) => !v); setEditId(null); }}>
          {preview ? "exit preview" : "▶ preview"}
        </button>
        <button className="btn" style={{ fontSize: 10 }} onClick={() => setCedalionOpen(true)} title="ask cedalion about this page">☖ cedalion</button>
        <button className="btn btn-primary" style={{ fontSize: 10 }} onClick={exportHtml}>export .html</button>
      </div>

      {/* ======== body ======== */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* left rail */}
        <div style={{ width: 176, borderRight: "1px solid var(--line)", background: "var(--surface)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "10px 10px 4px" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
              <span className="label" style={{ fontSize: 9 }}>pages</span>
              <button className="faint" style={{ fontSize: 13 }} onClick={addPage} title="add page">+</button>
            </div>
            {doc.pages.map((p, i) => (
              <div key={p.id} className="row" style={{ gap: 4, marginBottom: 3 }}>
                <button
                  className="row gap-1"
                  data-active={i === pageIx}
                  style={{ flex: 1, border: "1px solid var(--line)", padding: "4px 8px", fontSize: 10, textAlign: "left", background: i === pageIx ? "var(--raise)" : "transparent" }}
                  onClick={() => switchPage(i)}
                >
                  <span style={{ color: "var(--accent)" }}>{i === pageIx ? "▸" : "·"}</span>
                  {p.name}
                </button>
                {i !== pageIx && (
                  <button className="faint" style={{ fontSize: 10 }} onClick={() => removePage(i)} title="delete page">×</button>
                )}
              </div>
            ))}
          </div>
          <div className="rule" />
          <div style={{ padding: "10px 10px 14px", overflowY: "auto" }}>
            <div className="label" style={{ fontSize: 9, marginBottom: 6 }}>add block</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {KINDS.map((k) => (
                <button key={k.id} className="row gap-1" style={{ border: "1px solid var(--line)", padding: "5px 7px", fontSize: 10, textAlign: "left" }} onClick={() => addBlock(k.id)}>
                  <span style={{ width: 14, color: "var(--fg-dim)", fontSize: 11, textAlign: "center" }}>{k.icon}</span>
                  <span style={{ fontSize: 9.5 }}>{k.label}</span>
                </button>
              ))}
            </div>
            <div className="faint mono-sm" style={{ fontSize: 8.5, lineHeight: 1.5, marginTop: 10 }}>
              drag to move · corner to resize · double-click text to edit · del to remove
            </div>
          </div>
          <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", padding: 8 }}>
            <div className="faint mono-sm" style={{ fontSize: 8.5, marginBottom: 5 }}>{audit.issues.length} issue{audit.issues.length === 1 ? "" : "s"} on this page</div>
            {audit.issues.slice(0, 3).map((is, i) => (
              <div key={i} className="mono-sm" style={{ fontSize: 8.5, color: is.sev === "note" ? "var(--fg-dim)" : "var(--warn)", lineHeight: 1.4 }}>{is.sev === "note" ? "·" : "!"} {is.what}</div>
            ))}
          </div>
        </div>

        {/* canvas */}
        <div ref={viewRef} className="cv-dots" style={{ flex: 1, overflow: "auto", padding: 18, position: "relative" }}>
          <div style={{ width: devW * scale, height: H * scale, margin: "0 auto", position: "relative" }}>
            <div data-frame style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: devW, height: H }}>
              <div
                key={page.id + doc.transition}
                className={`cv-pg ${preview ? transClass : ""}`}
                style={{ width: devW, minHeight: H, background: page.bg ?? roleHex(pal, "background"), position: "relative", boxShadow: "0 24px 70px -20px rgba(0,0,0,.5)", borderRadius: 2, cursor: preview ? "default" : "default" }}
              >
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
                    onEdit={(id) => { setSel(id); setEditId(id); }}
                    onText={(id, txt) => liveText(id, txt)}
                    onDown={(e) => onBlockDown(b, e)}
                    onResizeDown={(e) => onResizeDown(b, e)}
                    devW={devW}
                  />
                ))}
                {!preview && page.blocks.length === 0 && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="faint mono-sm">add a block from the left — or press ⚡ smart build</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Merkhet floating */}
          {!showMerq ? (
            <button
              className="btn"
              style={{ position: "fixed", bottom: 16, right: preview ? 16 : 296, zIndex: 40, padding: "8px 14px", background: "var(--accent)", color: "var(--accent-fg)", borderColor: "var(--accent)", fontSize: 11, boxShadow: "0 10px 30px -12px rgba(0,0,0,.6)" }}
              onClick={() => setShowMerq(true)}
            >
              ✦ merkhet — fix
            </button>
          ) : (
            <MerkhetPanel
              issues={audit.issues}
              report={report}
              onClose={() => setShowMerq(false)}
              onRun={(m) => runMerkhet(m)}
            />
          )}
        </div>

        {/* inspector */}
        <Inspector
          block={selBlock}
          page={page}
          pageIx={pageIx}
          pal={pal}
          pages={doc.pages}
          audit={audit}
          onBlock={(id, mut) => liveBlock(id, mut)}
          onPage={(mut) => livePage(mut)}
          onRename={(name) => renamePage(pageIx, name)}
          onDeleteBlock={(id) => removeBlock(id)}
          onDuplicate={(b) => duplicate(b)}
          onText={(id, txt) => liveText(id, txt)}
          onSetSel={() => setSel(null)}
          onOpenChat={() => setCedalionOpen(true)}
          onOpenMerkhet={() => setShowMerq(true)}
        />
      </div>
    </div>
  );
}

/* ================= block view ================= */
function BlockView({ b, pal, selected, editing, preview, brand, others, onEdit, onText, onDown, onResizeDown, devW }: {
  b: CvBlock; pal: Palette; selected: boolean; editing: boolean; preview: boolean; brand: string; others: CvPage[];
  onEdit: (id: string) => void; onText: (id: string, t: string) => void;
  onDown: (e: React.PointerEvent) => void; onResizeDown: (e: React.PointerEvent) => void;
  devW: number;
}) {
  const c = blockColors(b.kind, pal, b);
  const fg = b.fg ?? c.fg;
  const showHandles = selected && !preview && !["nav", "footer", "spacer"].includes(b.kind);
  const style: React.CSSProperties = {
    position: "absolute", left: b.x, top: b.y, width: b.w, minHeight: b.h,
    background: b.kind === "card" || b.kind === "stat" ? roleHex(pal, "surface", b.bg) : b.kind === "nav" || b.kind === "footer" ? "transparent" : b.kind === "image" ? undefined : b.bg ?? undefined,
    border: showHandles ? "1px dashed " + (selected ? "var(--accent, #7fb2ff)" : "rgba(0,0,0,.25)") : undefined,
    borderRadius: b.radius ?? (b.kind === "card" ? 16 : b.kind === "stat" ? 14 : b.kind === "chip" ? 999 : 10),
    cursor: preview ? (b.kind === "nav" || b.kind === "button" ? "pointer" : "default") : b.kind === "nav" || b.kind === "footer" ? "default" : "move",
    zIndex: selected ? 3 : 1,
  };

  if (b.kind === "nav" || b.kind === "spacer" || b.kind === "footer") {
    style.width = devW; style.left = b.kind === "nav" ? 0 : b.kind === "footer" ? 0 : b.x;
  }
  if (b.kind === "nav" || b.kind === "footer") {
    style.minHeight = undefined; style.height = b.h;
  }
  const content = (() => {
    switch (b.kind) {
      case "heading":
        return <div style={{ fontWeight: b.weight ?? 800, fontSize: b.size ?? 52, lineHeight: 1.08, letterSpacing: "-.02em", color: fg, textAlign: b.align ?? "left", width: "100%" }}>{b.text}</div>;
      case "text":
        return <div style={{ fontSize: b.size ?? 18, lineHeight: 1.65, color: fg, textAlign: b.align ?? "left" }}>{b.text}</div>;
      case "button": {
        const solid = (b.variant ?? "solid") !== "outline" && (b.variant ?? "solid") !== "ghost";
        return (
          <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: b.align === "center" ? "center" : b.align === "right" ? "flex-end" : "flex-start" }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 22px", height: "100%",
                background: solid ? roleHex(pal, "accent", b.bg) : "transparent",
                color: solid ? readableOn(roleHex(pal, "accent", b.bg), fg) : fg,
                border: (b.variant ?? "solid") === "outline" ? `2px solid ${b.line ?? roleHex(pal, "text")}` : "2px solid transparent",
                borderRadius: b.radius ?? 10, fontWeight: b.weight ?? 700, fontSize: b.size ?? 17, whiteSpace: "nowrap",
              }}
            >
              {b.text}
            </span>
          </div>
        );
      }
      case "card":
        return (
          <div style={{ height: "100%", background: roleHex(pal, "surface", b.bg), border: `1px solid ${b.line ?? roleHex(pal, "border")}`, borderRadius: b.radius ?? 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: (b.size ?? 17) + 4, color: b.fg ?? roleHex(pal, "text") }}>{b.text}</div>
            <div style={{ fontSize: b.size ?? 15, lineHeight: 1.55, color: roleHex(pal, "muted") }}>{b.sub}</div>
          </div>
        );
      case "stat":
        return (
          <div style={{ height: "100%", background: roleHex(pal, "surface", b.bg), border: `1px solid ${b.line ?? roleHex(pal, "border")}`, borderRadius: b.radius ?? 14, padding: "14px 18px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
            <div style={{ fontSize: b.size ?? 40, fontWeight: 800, letterSpacing: "-.02em", color: b.fg ?? roleHex(pal, "accent") }}>{b.text}</div>
            <div style={{ color: roleHex(pal, "muted"), fontSize: 13 }}>{b.sub}</div>
          </div>
        );
      case "image":
        return (
          <div style={{ width: "100%", height: "100%", borderRadius: b.radius ?? 14, background: `linear-gradient(135deg, ${roleHex(pal, "primary")}, ${roleHex(pal, "secondary")})`, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.9)", fontSize: 30 }}>▣</div>
        );
      case "chip":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", height: "100%", padding: "0 18px", background: roleHex(pal, "accent", b.bg), color: readableOn(roleHex(pal, "accent", b.bg), "#fff"), fontSize: b.size ?? 13, fontWeight: 700, borderRadius: 999 }}>
            {b.text}
          </span>
        );
      case "spacer":
        return <div style={{ height: b.h, border: showHandles ? "1px dashed rgba(0,0,0,.2)" : undefined, width: "100%" }} />;
      case "nav":
        return <NavView b={b} pal={pal} brand={brand} others={others} />;
      case "footer":
        return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderTop: `1px solid ${roleHex(pal, "border")}`, color: roleHex(pal, "muted"), fontSize: b.size ?? 13 }}>{b.text}</div>;
      default:
        return null;
    }
  })();

  return (
    <div
      style={style}
      data-blk={b.id}
      data-kind={b.kind}
      onPointerDown={onDown}
      onDoubleClick={(e) => { if (!preview && ["heading", "text", "button", "chip", "stat", "card", "footer"].includes(b.kind)) { e.stopPropagation(); onEdit(b.id); } }}
    >
      {editing && !preview && (b.kind === "heading" || b.kind === "text" || b.kind === "button" || b.kind === "chip") ? (
        <EditText b={b} onDone={(t) => { onText(b.id, t); onEdit(""); }} />
      ) : (
        content
      )}
      {showHandles && (
        <>
          <span
            onPointerDown={(e) => onResizeDown(e)}
            style={{ position: "absolute", right: -5, bottom: -5, width: 12, height: 12, background: "var(--accent, #7fb2ff)", border: "2px solid #fff", borderRadius: "50%", cursor: "nwse-resize", zIndex: 5 }}
          />
          <span style={{ position: "absolute", left: 6, top: -20, background: "rgba(0,0,0,.75)", color: "#fff", fontSize: 9, padding: "1px 7px", borderRadius: 4, pointerEvents: "none", fontFamily: "ui-monospace, monospace" }}>
            {b.kind} {b.x},{b.y}
          </span>
        </>
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
    const range = document.createRange();
    range.selectNodeContents(el);
    const selw = window.getSelection();
    selw?.removeAllRanges();
    selw?.addRange(range);
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      style={{ outline: "2px solid var(--accent, #7fb2ff)", outlineOffset: 2, minHeight: b.h, ...kindTextStyle(b) }}
      onBlur={(e) => onDone(e.currentTarget.innerText)}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onDone((e.target as HTMLElement).innerText); } if (e.key === "Escape") { e.preventDefault(); onDone((e.target as HTMLElement).innerText); } }}
      dangerouslySetInnerHTML={{ __html: escapeHtml(b.text ?? "") }}
    />
  );
}
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function kindTextStyle(b: CvBlock): React.CSSProperties {
  return { fontWeight: b.weight ?? 700, fontSize: b.size ?? 20, lineHeight: 1.4 };
}

function NavView({ b, pal, brand, others }: { b: CvBlock; pal: Palette; brand: string; others: CvPage[] }) {
  const v = (b.variant as string) ?? "minimal";
  const tx = roleHex(pal, "text");
  const mut = roleHex(pal, "muted");
  const surf = roleHex(pal, "surface");
  const line = roleHex(pal, "border");
  const links = (
    <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
      {others.map((p) => (
        <span key={p.id} style={{ color: mut, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>{p.name}</span>
      ))}
      <span style={{ background: roleHex(pal, "accent"), color: readableOn(roleHex(pal, "accent"), "#fff"), fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 8 }}>get started</span>
    </div>
  );
  if (v === "centered")
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: tx, fontWeight: 800, fontSize: 19 }}>
        <span>{brand}</span>
        <span style={{ display: "flex", gap: 24, fontWeight: 500, fontSize: 14, color: mut }}>{others.map((p) => <span key={p.id}>{p.name}</span>)}</span>
      </div>
    );
  if (v === "pill")
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, background: surf, border: `1px solid ${line}`, borderRadius: 999, padding: "0 24px", height: 54, boxShadow: "0 12px 30px -18px rgba(0,0,0,.4)", color: tx, fontWeight: 800 }}>
          {brand}<span style={{ display: "flex", gap: 20, fontWeight: 500, fontSize: 14, color: mut }}>{others.map((p) => <span key={p.id}>{p.name}</span>)}</span>
        </div>
      </div>
    );
  if (v === "glass")
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", background: "rgba(255,255,255,.05)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${line}`, color: tx, fontWeight: 800, fontSize: 19 }}>
        {brand}{links}
      </div>
    );
  if (v === "bold")
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", borderBottom: `3px solid ${roleHex(pal, "accent")}`, color: tx, fontWeight: 800, fontSize: 19, textTransform: "uppercase" }}>
        {brand}{links}
      </div>
    );
  return (
    <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", color: tx, fontWeight: 800, fontSize: 19 }}>
      {brand}{links}
    </div>
  );
}

/* ================= seeding helpers ================= */

function seedBrand(purpose?: Purpose): string {
  if (purpose) {
    const words = purpose.label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (words.length >= 2) return words.slice(0, 2).join("");
  }
  return "new brand";
}

function seedDoc(purpose: Purpose | undefined): CvDoc {
  const d = freshDoc(seedBrand(purpose));
  const seed = (home: boolean) => starterBlocks(home ? "home" : "inner").map((b) => (b.kind === "nav" ? { ...b, text: d.brand } : b));
  d.pages[0].name = "home";
  d.pages[0].blocks = seed(true);
  d.pages[1].blocks = seed(false);
  d.pages[2].blocks = seed(false);
  return d;
}

function mkNav(brand: string): CvBlock {
  const b = emptyBlock("nav", 0, 0);
  return { ...b, text: brand };
}
function txt(block: CvBlock, text: string): CvBlock {
  return { ...block, text };
}
function mkHeading(x: number, y: number, w: number, size: number, text: string): CvBlock {
  const b = emptyBlock("heading", x, y);
  return txt({ ...b, w, size, weight: 800, h: Math.round(size * 1.5) + 20 }, text);
}
function mkText(x: number, y: number, w: number, text: string): CvBlock {
  const b = emptyBlock("text", x, y);
  return txt({ ...b, w, h: 84 }, text);
}
function mkButton(x: number, y: number, w: number, text: string, variant = "solid"): CvBlock {
  const b = emptyBlock("button", x, y);
  return { ...b, w, h: 58, text, variant };
}
function mkCard(x: number, y: number, t: string, d: string): CvBlock {
  const b = emptyBlock("card", x, y);
  return txt({ ...b, sub: d, h: 210 }, t);
}
function mkStat(x: number, y: number, v: string, l: string): CvBlock {
  const b = emptyBlock("stat", x, y);
  return { ...b, w: 250, h: 130, text: v, sub: l, size: 44 };
}
function mkFooter(brand: string, y: number): CvBlock {
  const b = emptyBlock("footer", 0, y);
  return txt(b, `© ${brand} — forged with hephaestus`);
}

function makeHome(c: ReturnType<typeof contentFor>): CvPage {
  const pg = freshPage("home");
  const feat = c.feats.slice(0, 3);
  const how = c.how.slice(0, 3);
  pg.blocks = [
    mkNav(c.brand),
    mkHeading(56, 150, 610, 60, c.heroH),
    mkText(56, 400, 560, c.heroS),
    mkButton(56, 550, 230, c.cta),
    mkButton(310, 550, 250, c.cta2, "outline"),
    (() => { const b = emptyBlock("image", 706, 170); return { ...b, w: 440, h: 340 }; })(),
    ...c.stats.map((x, i) => mkStat(56 + i * 282, 700, x.v, x.l)),
    mkHeading(56, 900, 640, 38, "Why it works"),
    ...feat.map((f, i) => mkCard(56 + i * 372, 1000, f.t, f.d)),
    mkHeading(56, 1280, 640, 38, "How it comes together"),
    ...how.map((h, i) => mkCard(56 + i * 372, 1380, `${i + 1}. ${h.t}`, h.d)),
    mkFooter(c.brand, 1660),
  ];
  return pg;
}
function makeInner(c: ReturnType<typeof contentFor>, name: string, h: string, t: string): CvPage {
  const pg = freshPage(name);
  pg.blocks = [
    mkNav(c.brand),
    mkHeading(56, 150, 800, 52, h),
    mkText(56, 330, 700, t),
    ...c.stats.slice(0, 2).map((x, i) => mkStat(56 + i * 300, 520, x.v, x.l)),
    mkFooter(c.brand, 720),
  ];
  return pg;
}
function makePricing(c: ReturnType<typeof contentFor>): CvPage {
  const pg = freshPage("pricing");
  const card = (x: number, pl: { name: string; tag: string; price: string }) => {
    const b = emptyBlock("card", x, 300);
    return txt({ ...b, h: 300, text: pl.name, sub: `${pl.tag}\n${pl.price}` }, pl.name);
  };
  pg.blocks = [
    mkNav(c.brand),
    mkHeading(56, 150, 760, 52, c.ctaH),
    mkText(56, 320, 640, c.ctaS),
    ...c.plans.slice(0, 3).map((pl, i) => card(56 + i * 382, pl)),
    mkFooter(c.brand, 760),
  ];
  return pg;
}

/* ================= inspector ================= */

function Inspector(props: {
  block: CvBlock | null; page: CvPage; pageIx: number; pal: Palette; pages: CvPage[];
  audit: { score: number; issues: { sev: string; what: string }[] };
  onBlock: (id: string, mut: Partial<CvBlock>) => void; onPage: (mut: Partial<CvPage>) => void;
  onRename: (name: string) => void; onDeleteBlock: (id: string) => void; onDuplicate: (b: CvBlock) => void;
  onText: (id: string, t: string) => void; onSetSel: () => void;
  onOpenChat: () => void; onOpenMerkhet: () => void;
}) {
  const b = props.block;
  const pal = props.pal;
  const textKinds = ["heading", "text", "button", "chip"];
  const subKinds = ["card", "stat"];
  const palBgs = pal.swatches.filter((s) => s.role === "background" || s.role === "surface" || s.role === "primary" || s.role === "secondary" || s.role === "accent");
  const palTxts = pal.swatches.filter((s) => s.role === "text" || s.role === "muted" || s.role === "accent");

  return (
    <div style={{ width: 268, borderLeft: "1px solid var(--line)", background: "var(--surface)", flexShrink: 0, overflowY: "auto" }}>
      {b ? (
        <>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div className="row gap-1" style={{ justifyContent: "space-between" }}>
              <span className="mono-sm" style={{ fontSize: 10, fontWeight: 700 }}>{b.kind} block</span>
              <button className="faint" style={{ fontSize: 11 }} onClick={props.onSetSel}>page ▸</button>
            </div>
            <div className="faint mono-sm" style={{ fontSize: 8.5 }}>x {b.x} · y {b.y} · {b.w}×{b.h}</div>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {textKinds.includes(b.kind) && (
              <Field label="text">
                <textarea className="input" style={{ width: "100%", minHeight: 58, fontSize: 11, padding: 6, resize: "vertical" }} value={b.text ?? ""}
                  onChange={(e) => props.onText(b.id, e.target.value)} />
              </Field>
            )}
            {subKinds.includes(b.kind) && (
              <Field label="sub-line">
                <textarea className="input" style={{ width: "100%", minHeight: 46, fontSize: 11, padding: 6, resize: "vertical" }} value={b.sub ?? ""}
                  onChange={(e) => props.onBlock(b.id, { sub: e.target.value })} />
              </Field>
            )}
            {(textKinds.includes(b.kind) || subKinds.includes(b.kind)) && (
              <Field label={`font size · ${b.size ?? 18}px`}>
                <input type="range" min={11} max={b.kind === "heading" ? 90 : 60} value={b.size ?? 18}
                  onChange={(e) => props.onBlock(b.id, { size: +e.target.value })} style={{ width: "100%" }} />
              </Field>
            )}
            {b.kind !== "chip" && b.kind !== "spacer" && (
              <Field label="corner radius">
                <input type="range" min={0} max={40} value={b.radius ?? 0}
                  onChange={(e) => props.onBlock(b.id, { radius: +e.target.value })} style={{ width: "100%" }} />
              </Field>
            )}
            {b.kind === "button" && (
              <Field label="button style">
                <div className="row gap-1">
                  {BTN_VARIANTS.map((v) => (
                    <button key={v} className="btn" data-active={(b.variant ?? "solid") === v} style={{ fontSize: 9.5, padding: "5px 9px" }}
                      onClick={() => props.onBlock(b.id, { variant: v })}>{v}</button>
                  ))}
                </div>
              </Field>
            )}
            {b.kind === "nav" && (
              <Field label="navbar variant">
                <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                  {NAV_STYLES.map((v) => (
                    <button key={v} className="btn" data-active={(b.variant ?? "minimal") === v} style={{ fontSize: 9.5, padding: "5px 9px" }}
                      onClick={() => props.onBlock(b.id, { variant: v })}>{v}</button>
                  ))}
                </div>
              </Field>
            )}
            {b.kind === "button" && (
              <Field label="links to page">
                <select className="input" style={{ width: "100%", fontSize: 10, padding: 5 }}
                  value={b.link ?? ""}
                  onChange={(e) => props.onBlock(b.id, { link: e.target.value || undefined })}>
                  <option value="">— no link —</option>
                  {props.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="faint" style={{ fontSize: 8.5, lineHeight: 1.5 }}>in preview, clicking this button hops to that page.</div>
              </Field>
            )}
            {!["nav", "footer", "spacer"].includes(b.kind) && (
              <Field label="background tint">
                <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                  <Swatch role="auto" active={!b.bg} onPick={() => props.onBlock(b.id, { bg: undefined })} />
                  {palBgs.map((s) => (
                    <Swatch key={s.role} hex={s.hex} role={s.role} active={b.bg === s.hex} onPick={() => props.onBlock(b.id, { bg: s.hex })} />
                  ))}
                </div>
              </Field>
            )}
            {textKinds.includes(b.kind) && b.kind !== "button" && b.kind !== "chip" && (
              <Field label="text colour">
                <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                  <Swatch role="auto" active={!b.fg} onPick={() => props.onBlock(b.id, { fg: undefined })} />
                  {palTxts.map((s) => (
                    <Swatch key={s.role} hex={s.hex} role={s.role} active={b.fg === s.hex} onPick={() => props.onBlock(b.id, { fg: s.hex })} />
                  ))}
                </div>
              </Field>
            )}
            <div className="row gap-1" style={{ marginTop: 2 }}>
              <button className="btn" style={{ fontSize: 9.5 }} onClick={() => props.onDuplicate(b)}>⧉ duplicate</button>
              <button className="btn" style={{ fontSize: 9.5, color: "var(--bad, #ff5d5d)" }} onClick={() => props.onDeleteBlock(b.id)}>✕ delete</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div className="row gap-1" style={{ justifyContent: "space-between" }}>
              <span className="label">page settings</span>
              <span className="mono-sm faint" style={{ fontSize: 9 }}>{props.pageIx + 1} / {props.pages.length}</span>
            </div>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="page name">
              <input className="input" style={{ width: "100%", fontSize: 11, padding: 5 }} value={props.page.name}
                onChange={(e) => props.onRename(e.target.value)} />
            </Field>
            <Field label="page background">
              <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                <Swatch role="auto" active={!props.page.bg} onPick={() => props.onPage({ bg: undefined })} />
                {palBgs.map((s) => (
                  <Swatch key={s.role} hex={s.hex} role={s.role} active={props.page.bg === s.hex} onPick={() => props.onPage({ bg: s.hex })} />
                ))}
              </div>
            </Field>
            <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => props.onOpenChat()}>☖ ask cedalion about this page</button>
            <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={props.onOpenMerkhet}>✦ open merkhet fixer</button>
            {props.audit.issues.length > 0 && (
              <div className="faint" style={{ fontSize: 9, lineHeight: 1.6 }}>
                <b style={{ color: "var(--warn, #ffb454)" }}>{props.audit.issues.length} issue{props.audit.issues.length === 1 ? "" : "s"} found</b> — merkhet can repair them in one press.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="label" style={{ fontSize: 9 }}>{label}</span>
      {children}
    </label>
  );
}

function Swatch({ hex, role, active, onPick }: { hex?: string; role: string; active: boolean; onPick: () => void }) {
  return (
    <button
      title={role}
      onClick={onPick}
      style={{
        width: 20, height: 20, borderRadius: 5, border: active ? "2px solid var(--accent, #fff)" : "1px solid var(--line)",
        background: !hex ? "repeating-conic-gradient(#9a9a9a 0% 25%, #e8e8e8 0% 50%) 0 0/9px 9px" : hex,
        cursor: "pointer", padding: 0, boxShadow: hex ? "inset 0 0 0 1px rgba(0,0,0,.12)" : "none",
      }}
    />
  );
}

/* ================= merkhet panel ================= */

const MERKHET_MODES: { id: MerkhetMode; icon: string; name: string; desc: string; note: string }[] = [
  { id: "theme", icon: "◐", name: "harmonise colours", desc: "clear hand-picked tints so the page follows your palette again", note: "colour theory: one accent voice, tints from the same family" },
  { id: "contrast", icon: "▤", name: "fix readability", desc: "bump low-contrast text to WCAG floors", note: "targets 7:1 body · 7:1 headings · 4.5:1 buttons" },
  { id: "layout", icon: "⊞", name: "align layout", desc: "snap to the 12-column grid, 8px rhythm, unpile overlaps", note: "every x lands on a column edge, every y on an 8px beat" },
  { id: "rhythm", icon: "≋", name: "even the rhythm", desc: "group rows into 32px bands and equalise spacing gaps", note: "consistent gutters make pages feel composed, not accidental" },
];

function MerkhetPanel({ issues, report, onRun, onClose }: {
  issues: { sev: string; what: string; fix?: string }[]; report: string[];
  onRun: (m: MerkhetMode) => void; onClose: () => void;
}) {
  const [about, setAbout] = useState(false);
  return (
    <div style={{
      position: "fixed", right: 24, bottom: 24, width: 330, maxHeight: "70vh", zIndex: 50,
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14,
      boxShadow: "0 26px 70px -18px rgba(0,0,0,.55)", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ padding: "12px 14px", background: "var(--raise)", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 5 }}>
        <div className="row gap-1" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".01em" }}>✦ merkhet</span>
          <button className="faint" style={{ fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        <div className="faint" style={{ fontSize: 9.5, lineHeight: 1.5 }}>
          {about ? (
            <>
              <span className="row gap-1" style={{ flexWrap: "wrap" }}>
                mer·khet — the ancient Egyptian shadow-clock, the instrument that <b>measured time nobody could see</b>. in hephaestus, merkhet is the build-area physician: it reads the page you're composing — spacing, contrast, colour discipline, grid — and repairs what drifts off, using fixed rules of colour science (WCAG contrast floors, harmonic palette roles, 12-column & 8px rhythm). it never generates anything: it measures, then fixes <i>your</i> work, and tells you exactly what it changed. pick a discipline below, or let it read the page first.
              </span>
              <button className="faint" style={{ fontSize: 9 }} onClick={() => setAbout(false)}>▴ collapse</button>
            </>
          ) : (
            <button className="faint underline" style={{ fontSize: 9 }} onClick={() => setAbout(true)}>what is merkhet?</button>
          )}
        </div>
      </div>

      <div style={{ overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="faint" style={{ fontSize: 9 }}>{issues.length === 0 ? "this page reads clean — nothing to repair" : `this page: ${issues.length} finding${issues.length === 1 ? "" : "s"} to repair`}</div>
        {issues.slice(0, 5).map((is, i) => (
          <div key={i} className="row gap-1" style={{ alignItems: "flex-start", fontSize: 9.5 }}>
            <span style={{ color: is.sev === "critical" ? "var(--bad, #ff5d5d)" : is.sev === "warning" ? "var(--warn, #ffb454)" : "var(--fg-dim)" }}>{is.sev === "note" ? "·" : "!"}</span>
            <span className="faint" style={{ lineHeight: 1.5 }}>{is.what}</span>
          </div>
        ))}

        {MERKHET_MODES.map((m) => (
          <button key={m.id} className="row gap-1" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", alignItems: "flex-start", textAlign: "left", background: "var(--raise)" }}
            onClick={() => onRun(m.id)}>
            <span style={{ color: "var(--accent)", fontSize: 13 }}>{m.icon}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <b style={{ fontSize: 10.5 }}>{m.name}</b>
              <span className="faint" style={{ fontSize: 9 }}>{m.desc}</span>
              <span className="mono-sm faint" style={{ fontSize: 8 }}>{m.note}</span>
            </span>
          </button>
        ))}

        {report.length > 0 && (
          <div style={{ border: "1px solid var(--ok, #5fd38a)", borderRadius: 10, padding: "8px 10px", background: "color-mix(in srgb, var(--ok, #5fd38a) 8%, transparent)" }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: "var(--ok, #5fd38a)", marginBottom: 4 }}>✓ last fix applied</div>
            {report.map((r, i) => (
              <div key={i} className="mono-sm" style={{ fontSize: 8.5, lineHeight: 1.6, color: "var(--fg-dim)" }}>· {r}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
