import { useMemo, useState } from "react";
import { useApp } from "../store";
import { auditPalette } from "../engine/cedalion";
import { generatePalette, SPACE_SIZE } from "../engine/akmon";
import { DIRECTION_SPACE, TRENDS, TRENDS_UPDATED } from "../data/trends";
import PaletteCard from "../components/PaletteCard";

export default function Home() {
  const { palettes, current, setCurrent, go, deletePalette, toggleFavorite, purposeId } = useApp();
  const [prompt, setPrompt] = useState("");

  const audit = useMemo(
    () => (current ? auditPalette(current, purposeId ?? undefined) : null),
    [current, purposeId]
  );

  const rising = TRENDS.filter((t) => t.status === "rising").slice(0, 3);

  function forge() {
    if (!prompt.trim()) { go("akmon"); return; }
    const p = generatePalette({ prompt: prompt.trim() });
    setCurrent(p);
    go("akmon");
  }

  return (
    <div style={{ padding: "34px 26px 130px", maxWidth: 1240, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 26, alignItems: "start" }}>
        {/* ================= left ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {/* heading */}
          <div>
            <div className="label" style={{ marginBottom: 14 }}>design forge · {TRENDS_UPDATED}</div>
            <h1 style={{ fontSize: 44, fontWeight: 600, margin: "0 0 10px", letterSpacing: "-0.03em", lineHeight: 1.05, maxWidth: 640 }}>
              A feeling in.
              <br />
              <span className="dim" style={{ fontWeight: 400 }}>A site you can drag around, out.</span>
            </h1>
            <p className="faint" style={{ margin: 0, fontSize: 12.5, maxWidth: 600, lineHeight: 1.7 }}>
              Hephaestus turns plain language into colour systems and full sites — palette, pages,
              navigation and typography — with every number on the table. Free, offline, no AI: an old god, new rules.
            </p>
          </div>

          {/* two big doors */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button
              className="panel"
              onClick={() => go("build")}
              style={{ textAlign: "left", padding: "20px 22px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--accent)", background: "var(--surface)" }}
            >
              <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--fg-dim)", fontSize: 15 }}>▦</span>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>build a site</span>
              <span className="faint" style={{ fontSize: 11, lineHeight: 1.6 }}>
                free canvas — drag text, buttons & cards; add pages, pick a navbar, preview and export real HTML.
              </span>
              <span style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--accent)", fontWeight: 600 }}>start building →</span>
            </button>
            <button
              className="panel"
              onClick={() => go("akmon")}
              style={{ textAlign: "left", padding: "20px 22px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}
            >
              <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--fg-dim)", fontSize: 15 }}>◐</span>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>forge a palette</span>
              <span className="faint" style={{ fontSize: 11, lineHeight: 1.6 }}>
                one sentence becomes a full colour system — swatches, roles, contrast and an S→D grade you can trust.
              </span>
              <span style={{ fontSize: 10, letterSpacing: "0.16em", fontWeight: 600 }}>open akmon →</span>
            </button>
          </div>

          {/* forge line */}
          <div className="row gap-1" style={{ maxWidth: 700 }}>
            <input
              className="input"
              placeholder="…or describe a palette directly — “dusty teal, burnt orange, light”"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && forge()}
            />
            <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={forge}>forge</button>
          </div>

          {/* stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            <Stat label="saved palettes" value={String(palettes.length)} note="stored locally, offline" />
            <Stat label="current score" value={audit ? `${audit.score} · ${audit.grade}` : "—"} note="cedalion, live" />
            <Stat label="colour space" value={SPACE_SIZE.pretty} note="addressable palettes" />
            <Stat label="direction space" value={DIRECTION_SPACE.toLocaleString("en-US")} note="trend combinations" />
          </div>

          {/* library */}
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>library</div>
                <div className="faint mono-sm">saved palettes — open one, keep working on it</div>
              </div>
              <button className="btn" onClick={() => go("library")}>view all</button>
            </div>
            {palettes.length === 0 ? (
              <div className="panel" style={{ padding: 24, textAlign: "center" }}>
                <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>Nothing saved yet.</div>
                <div className="faint mono-sm">Forge a palette in Akmon and hit save — it'll appear here.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                {palettes.slice(0, 4).map((p) => (
                  <PaletteCard
                    key={p.id}
                    p={p}
                    onOpen={() => { setCurrent(p); go("akmon"); }}
                    onFavorite={() => toggleFavorite(p.id)}
                    onDelete={() => deletePalette(p.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* rising */}
          <div className="panel" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <span className="label">rising now</span>
              <span className="faint mono-sm">trend library · {TRENDS_UPDATED}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
              {rising.map((t) => (
                <button key={t.id} style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("trends")}>
                  <div style={{ fontSize: 12, marginBottom: 3, fontWeight: 600 }}>{t.name}</div>
                  <div className="faint mono-sm" style={{ lineHeight: 1.5 }}>
                    {t.summary.slice(0, 90)}…
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================= right ================= */}
        <div style={{ position: "sticky", top: 74, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel" style={{ padding: 18 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <span className="label">on the anvil</span>
              {audit && (
                <span className="mono-sm" style={{ fontSize: 11, color: audit.score >= 82 ? "var(--ok)" : audit.score >= 70 ? "var(--warn)" : "var(--bad)" }}>
                  {audit.score}/100 · {audit.grade}
                </span>
              )}
            </div>
            {current ? (
              <CurrentPaletteMini p={current} />
            ) : (
              <div className="faint" style={{ fontSize: 11 }}>nothing forged yet.</div>
            )}
            <div className="row gap-1" style={{ marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn" style={{ fontSize: 10 }} onClick={() => go("akmon")}>open in akmon</button>
              <button
                className="btn" style={{ fontSize: 10 }} title="forge a fresh palette"
                onClick={() => { const p = generatePalette({ prompt: "a fresh surprise — follow the mood" }); setCurrent(p); go("akmon"); }}
              >
                ↻ surprise me
              </button>
            </div>
          </div>

          <div className="panel" style={{ padding: 18 }}>
            <span className="label">ask while you work</span>
            <p className="faint" style={{ fontSize: 11, lineHeight: 1.7, margin: "10px 0 0" }}>
              Cedalion reads the palette on screen and argues with it — contrast maths,
              purpose fit, trend sense. It lives in a window you can drag anywhere,
              on every screen.
            </p>
            <div className="row gap-1" style={{ marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => go("trends")}>what's trending</button>
              <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => go("settings")}>settings</button>
            </div>
          </div>

          {/* mini purpose/next strip */}
          <div style={{ border: "1px solid var(--line)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="faint mono-sm" style={{ fontSize: 8.5, letterSpacing: ".14em" }}>NEXT ON THE BENCH</div>
            {purposeId ? (
              <div style={{ fontSize: 12 }}>keep building toward <b style={{ textTransform: "capitalize" }}>{purposeId.replace(/-/g, " ")}</b></div>
            ) : (
              <div style={{ fontSize: 12 }}>no purpose chosen yet — start a site and pick one there.</div>
            )}
            <button className="btn" style={{ fontSize: 10, alignSelf: "flex-start", marginTop: 2 }} onClick={() => go("build")}>go to the bench →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentPaletteMini({ p }: { p: { name: string; swatches: { role: string; hex: string }[]; prompt?: string } }) {
  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        {p.swatches.map((s) => (
          <span key={s.role} title={s.role} style={{ flex: 1, height: 26, background: s.hex, borderRight: "1px solid rgba(0,0,0,.12)" }} />
        ))}
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-.01em" }}>{p.name}</span>
        <span className="faint mono-sm">{p.swatches.length} roles</span>
      </div>
      {p.prompt && <div className="faint mono-sm" style={{ marginTop: 4, lineHeight: 1.5, fontSize: 9 }}>“{p.prompt.slice(0, 90)}{p.prompt.length > 90 ? "…" : ""}”</div>}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={{ background: "var(--bg)", padding: "15px 16px" }}>
      <div className="label">{label}</div>
      <div style={{ fontSize: 22, margin: "5px 0 2px", fontWeight: 400, letterSpacing: "-.01em" }}>{value}</div>
      <div className="faint mono-sm">{note}</div>
    </div>
  );
}
