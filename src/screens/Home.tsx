import { useMemo, useState } from "react";
import { useApp } from "../store";
import { auditPalette } from "../engine/cedalion";
import { generatePalette, SPACE_SIZE } from "../engine/akmon";
import { DIRECTION_SPACE, TRENDS, TRENDS_UPDATED } from "../data/trends";
import { CATALOG } from "../engine/catalog";
import PaletteCard from "../components/PaletteCard";
import Emblem from "../components/Emblem";
import { forgeNote, forgeVoice } from "../lib/voice";

export default function Home() {
  const { palettes, current, setCurrent, go, deletePalette, toggleFavorite, purposeId, sites, deleteSite, setResumeId, settings } = useApp();
  const [prompt, setPrompt] = useState("");
  const [reroll, setReroll] = useState(0);

  const audit = useMemo(
    () => (current ? auditPalette(current, purposeId ?? undefined) : null),
    [current, purposeId]
  );

  /* what the forge says when you walk in — state-aware, and it changes by day,
     not by render, so the line can't flicker under your cursor */
  const voice = useMemo(
    () =>
      forgeVoice(
        { palettes: palettes.length, sites: sites.length, score: audit?.score ?? null, fresh: palettes.length === 0 && sites.length === 0 },
        settings.displayName,
        reroll
      ),
    [palettes.length, sites.length, audit?.score, settings.displayName, reroll]
  );

  const rising = TRENDS.filter((t) => t.status === "rising").slice(0, 3);

  function forge() {
    if (!prompt.trim()) { go("akmon"); return; }
    const p = generatePalette({ prompt: prompt.trim() });
    setCurrent(p);
    go("akmon");
  }
  const openSite = (id: string) => {
    setResumeId(id);
    go("build");
  };
  const newSite = () => {
    setResumeId(null);
    go("build");
  };

  return (
    <div style={{ padding: "36px 28px 140px", maxWidth: 1240, margin: "0 auto" }}>
      {/* ---------- header ---------- */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14, marginBottom: 26 }}>
        <div className="row gap-2" style={{ alignItems: "flex-start", flex: "1 1 460px", minWidth: 0, paddingRight: 8 }}>
          <Emblem size={62} alt="Hephaestus emblem" style={{ marginTop: -2 }} />
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              dashboard · {TRENDS_UPDATED}
              {voice.who !== "forge" && (
                <span style={{ color: "var(--accent)", marginLeft: 8 }}>
                  {voice.who === "hephaestus" ? "· the master's bench" : "· the apprentice's ear"}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
              {voice.line}
            </h1>
            <div className="row gap-2" style={{ marginTop: 7, alignItems: "baseline" }}>
              <span className="faint" style={{ fontSize: 11.5 }}>{voice.sub}</span>
              <button
                className="faint mono-sm"
                onClick={() => setReroll((r) => r + 1)}
                title="say something else"
                aria-label="say something else"
                style={{ fontSize: 10, border: "1px solid var(--line)", padding: "1px 7px", background: "transparent" }}
              >
                ↻ again
              </button>
            </div>
          </div>
        </div>
        <div className="row gap-1" style={{ alignSelf: "flex-end" }}>
          <button className="btn" onClick={() => go("library")}>library</button>
          <button className="btn" onClick={() => go("trends")}>trends</button>
          <button className="btn btn-primary" style={{ borderColor: "var(--accent)" }} onClick={newSite}>+ new site</button>
        </div>
      </div>

      {/* ---------- stat band ---------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)", marginBottom: 26 }}>
        <Stat label="saved palettes" value={String(palettes.length)} note="akmon · stored locally" />
        <Stat label="sites on the bench" value={String(sites.length)} note="autosaved as you build" />
        <Stat label="current palette" value={audit ? `${audit.score} · ${audit.grade}` : "—"} note="cedalion grade, live" />
        <Stat label="colour space" value={SPACE_SIZE.pretty} note="palettes to forge" />
        <Stat label="trend library" value={CATALOG.length.toLocaleString("en-US")} note={`${DIRECTION_SPACE.toLocaleString("en-US")} directions behind it`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 26, alignItems: "start" }}>
        {/* ==================== main column ==================== */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>

          {/* ---- continue building ---- */}
          <section>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>on the bench</div>
                <div className="faint mono-sm" style={{ fontSize: 9 }}>your builds autosave here the moment you touch the canvas</div>
              </div>
              <button className="btn" style={{ fontSize: 10 }} onClick={newSite}>▦ new build</button>
            </div>
            {sites.length === 0 ? (
              <div
                onClick={newSite}
                style={{ border: "1px dashed var(--line)", borderRadius: 14, padding: "30px 22px", textAlign: "center", cursor: "pointer", background: "var(--surface)" }}
              >
                <Emblem size={52} alt="" style={{ margin: "0 auto 12px", opacity: 0.9 }} />
                <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>Nothing on the bench yet.</div>
                <div className="faint" style={{ fontSize: 10.5 }}>
                  Start a site — a full canvas with pages, grids and a palette. It saves itself.
                </div>
                <button className="btn btn-primary" style={{ marginTop: 14, fontSize: 11, padding: "8px 16px" }}>start building</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
                {sites.map((s) => (
                  <SiteCard key={s.id} name={s.name} palette={s.palette} doc={s.doc} updatedAt={s.updatedAt}
                    onOpen={() => openSite(s.id)} onDelete={() => deleteSite(s.id)} />
                ))}
              </div>
            )}
          </section>

          {/* ---- palette strip ---- */}
          <section>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>palette library</div>
                <div className="faint mono-sm" style={{ fontSize: 9 }}>saved systems — open one and keep tuning</div>
              </div>
              <button className="btn" style={{ fontSize: 10 }} onClick={() => go("akmon")}>open akmon</button>
            </div>
            {palettes.length === 0 ? (
              <div className="panel" style={{ padding: 22, textAlign: "center" }}>
                <div className="dim" style={{ fontSize: 11.5, marginBottom: 4 }}>Nothing saved yet.</div>
                <div className="faint mono-sm" style={{ fontSize: 9 }}>Forge one in Akmon and hit save — it'll live here.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(235px,1fr))", gap: 12 }}>
                {palettes.slice(0, 6).map((p) => (
                  <PaletteCard key={p.id} p={p}
                    onOpen={() => { setCurrent(p); go("akmon"); }}
                    onFavorite={() => toggleFavorite(p.id)}
                    onDelete={() => deletePalette(p.id)} />
                ))}
              </div>
            )}
          </section>

          {/* ---- rising ---- */}
          <section className="panel" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <span className="label">rising now</span>
              <span className="faint mono-sm" style={{ fontSize: 8.5 }}>trend library · {TRENDS_UPDATED} · {CATALOG.length.toLocaleString("en-US")} entries</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              {rising.map((t) => (
                <button key={t.id} style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("trends")}>
                  <div style={{ fontSize: 12, marginBottom: 3, fontWeight: 600 }}>{t.name}</div>
                  <div className="faint mono-sm" style={{ fontSize: 8.5, lineHeight: 1.5 }}>
                    {t.summary.slice(0, 84)}…
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* ==================== right column ==================== */}
        <div style={{ position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* forge bar */}
          <div className="panel" style={{ padding: 18 }}>
            <div className="row gap-1" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <span className="label">on the anvil</span>
              {audit && (
                <span className="mono-sm" style={{ fontSize: 11, color: audit.score >= 82 ? "var(--ok)" : audit.score >= 70 ? "var(--warn)" : "var(--bad)" }}>
                  {audit.score}/100 · {audit.grade}
                </span>
              )}
            </div>
            {current ? (
              <PaletteMini p={current} />
            ) : (
              <div className="faint" style={{ fontSize: 11 }}>nothing forged yet.</div>
            )}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="row gap-1">
                <input
                  className="input"
                  style={{ fontSize: 11, padding: "7px 10px" }}
                  placeholder="describe a palette… “dusty teal, burnt orange”"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && forge()}
                />
              </div>
              <div className="row gap-1">
                <button className="btn btn-primary" style={{ flex: 1, fontSize: 10.5, padding: "7px 0" }} onClick={forge}>forge</button>
                <button
                  className="btn" style={{ fontSize: 10.5, padding: "7px 12px" }} title="a fresh palette, no input needed"
                  onClick={() => { const p = generatePalette({ prompt: "a surprise — follow the mood of the moment" }); setCurrent(p); go("akmon"); }}
                >
                  ↻ surprise
                </button>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => go("akmon")}>open akmon →</button>
            </div>
          </div>

          {/* purpose hint */}
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", background: "var(--surface)" }}>
            <div className="faint mono-sm" style={{ fontSize: 8.5, letterSpacing: ".14em", marginBottom: 6 }}>BRIEF</div>
            {purposeId ? (
              <>
                <div style={{ fontSize: 12.5 }}>building toward <b style={{ textTransform: "capitalize" }}>{purposeId.replace(/-/g, " ")}</b></div>
                <button className="btn" style={{ fontSize: 10, marginTop: 8, width: "100%" }} onClick={newSite}>go to the bench →</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>no purpose picked yet — start a site and choose one there; it tunes the palette, the copy and the critique.</div>
                <button className="btn" style={{ fontSize: 10, marginTop: 8, width: "100%" }} onClick={newSite}>start a site →</button>
              </>
            )}
          </div>

          {/* ask strip */}
          <div className="panel" style={{ padding: 16 }}>
            <span className="label">ask while you work</span>
            <p className="faint" style={{ fontSize: 10.5, lineHeight: 1.7, margin: "10px 0 12px" }}>
              Cedalion now reads the actual canvas — pages, blocks, spacing, nav, structure — and answers with what it can measure, on every screen.
            </p>
            <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => go("settings")}>settings</button>
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginTop: 30, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
        <span className="faint mono-sm" style={{ fontSize: 9.5, letterSpacing: ".04em" }}>{forgeNote(reroll)}</span>
        <span className="faint mono-sm" style={{ fontSize: 9.5 }}>local only · no account · no network</span>
      </div>
    </div>
  );
}

/* ---------------- pieces ---------------- */

function PaletteMini({ p }: { p: { name: string; swatches: { role: string; hex: string }[]; prompt?: string } }) {
  return (
    <div>
      <div className="row" style={{ marginBottom: 8, border: "1px solid var(--line)", overflow: "hidden", borderRadius: 8 }}>
        {p.swatches.map((s) => (
          <span key={s.role} title={s.role} style={{ flex: 1, height: 26, background: s.hex, borderRight: "1px solid rgba(0,0,0,.10)" }} />
        ))}
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-.01em" }}>{p.name}</span>
        <span className="faint mono-sm" style={{ fontSize: 8.5 }}>{p.swatches.length} roles</span>
      </div>
      {p.prompt && <div className="faint mono-sm" style={{ marginTop: 4, fontSize: 8.5, lineHeight: 1.5 }}>“{p.prompt.slice(0, 80)}{p.prompt.length > 80 ? "…" : ""}”</div>}
    </div>
  );
}

function SiteCard({ name, palette, doc, updatedAt, onOpen, onDelete }: {
  name: string; palette: { name: string; swatches: { role: string; hex: string }[] };
  doc: { mode?: string; pages: { blocks: { kind: string }[] }[] }; updatedAt: number;
  onOpen: () => void; onDelete: () => void;
}) {
  const blocks = doc.pages.reduce((n, p) => n + p.blocks.length, 0);
  const mode = doc.mode === "single" ? "one long page" : `${doc.pages.length} pages`;
  const kinds: Record<string, number> = {};
  for (const p of doc.pages) for (const b of p.blocks) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
  const bits = [kinds.heading ?? 0 ? "heading" : null, kinds.card ?? 0 ? "cards" : null, kinds.button ?? 0 ? "cta" : null, kinds.image ?? 0 ? "images" : null].filter(Boolean).join(" · ");
  const ago = (() => {
    const d = Date.now() - updatedAt;
    const m = Math.floor(d / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "var(--surface)", display: "flex", flexDirection: "column" }}>
      <button onClick={onOpen} style={{ textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column" }}>
        <div className="row" style={{ height: 30 }}>
          {palette.swatches.map((s) => <span key={s.role} style={{ flex: 1, height: "100%", background: s.hex }} />)}
        </div>
        <div style={{ padding: "12px 14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b style={{ fontSize: 13.5, letterSpacing: "-.01em" }}>{name}</b>
            <span className="faint mono-sm" style={{ fontSize: 8.5 }}>{ago}</span>
          </div>
          <span className="mono-sm faint" style={{ fontSize: 8.5 }}>{mode} · {blocks} blocks · {palette.name.slice(0, 22)}</span>
          <span className="faint" style={{ fontSize: 9.5, marginTop: 2, minHeight: 14 }}>{bits || "empty canvas"}</span>
        </div>
      </button>
      <div className="row" style={{ gap: 6, padding: "8px 12px", borderTop: "1px solid var(--line-soft)" }}>
        <button className="btn" style={{ flex: 1, fontSize: 9.5, padding: "5px 0" }} onClick={onOpen}>continue →</button>
        <button className="faint" style={{ fontSize: 10, padding: "0 4px" }} title="delete this build" onClick={onDelete}>✕</button>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={{ background: "var(--bg)", padding: "14px 16px" }}>
      <div className="label" style={{ fontSize: 8.5 }}>{label}</div>
      <div style={{ fontSize: 21, margin: "4px 0 2px", fontWeight: 500, letterSpacing: "-.01em" }}>{value}</div>
      <div className="faint mono-sm" style={{ fontSize: 8.5 }}>{note}</div>
    </div>
  );
}
