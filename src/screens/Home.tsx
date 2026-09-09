import { useMemo, useState } from "react";
import { useApp } from "../store";
import { auditPalette } from "../engine/cedalion";
import { generatePalette, SPACE_SIZE } from "../engine/akmon";
import { DIRECTION_SPACE, TRENDS, TRENDS_UPDATED } from "../data/trends";
import { CedalionChat } from "../components/CedalionDock";
import PaletteCard from "../components/PaletteCard";

export default function Home() {
  const { settings, palettes, current, setCurrent, go, deletePalette, toggleFavorite, purposeId } = useApp();
  const [prompt, setPrompt] = useState("");

  const score = useMemo(
    () => (current ? auditPalette(current, purposeId ?? undefined).score : null),
    [current, purposeId]
  );

  const rising = TRENDS.filter((t) => t.status === "rising").slice(0, 3);

  function forge() {
    const p = generatePalette({ prompt: prompt.trim() });
    setCurrent(p);
    go("akmon");
  }

  return (
    <div style={{ padding: "30px 22px 100px", maxWidth: 1440, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 22, alignItems: "start" }}>
        {/* left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          <div className="panel" style={{ padding: 26 }}>
            <div className="label">welcome back</div>
            <h1 style={{ fontSize: 40, fontWeight: 400, margin: "8px 0 10px", letterSpacing: "-0.02em" }}>
              {settings.displayName || "Maker"}
            </h1>
            <p className="dim" style={{ margin: "0 0 20px", fontSize: 13, maxWidth: 560 }}>
              Describe a palette and Akmon forges it. Pick what you're building and Hephaestus
              assembles a direction from what's actually working in 2026. Cedalion scores all of it,
              out loud, with the numbers.
            </p>

            <div className="row gap-1" style={{ maxWidth: 620 }}>
              <input
                className="input"
                placeholder="describe a palette — colours, mood, or the thing you're building"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && forge()}
              />
              <button className="btn btn-primary" onClick={forge}>forge</button>
            </div>

            <div className="row gap-1" style={{ marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => go("akmon")}>open akmon</button>
              <button className="btn" onClick={() => go("build")}>choose a purpose</button>
              <button className="btn" onClick={() => go("trends")}>trend library</button>
            </div>
          </div>

          {/* stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            <Stat label="saved palettes" value={String(palettes.length)} note="stored locally, offline" />
            <Stat label="current score" value={score !== null ? String(score) : "—"} note="cedalion, live" />
            <Stat label="colour space" value={SPACE_SIZE.pretty} note="addressable palettes" />
            <Stat label="direction space" value={DIRECTION_SPACE.toLocaleString("en-US")} note="trend combinations" />
          </div>

          {/* recent */}
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14 }}>library</div>
                <div className="faint mono-sm">one card per palette</div>
              </div>
              <button className="btn" onClick={() => go("library")}>view all</button>
            </div>

            {palettes.length === 0 ? (
              <div className="panel" style={{ padding: 24, textAlign: "center" }}>
                <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>Nothing saved yet.</div>
                <div className="faint mono-sm">Forge a palette in Akmon and hit save — it'll appear here as a card.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
                {palettes.slice(0, 6).map((p) => (
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

          {/* trend ticker */}
          <div className="panel" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <span className="label">rising now</span>
              <span className="faint mono-sm">library {TRENDS_UPDATED}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              {rising.map((t) => (
                <button key={t.id} style={{ textAlign: "left" }} onClick={() => go("trends")}>
                  <div style={{ fontSize: 12, marginBottom: 3 }}>{t.name}</div>
                  <div className="faint mono-sm" style={{ lineHeight: 1.5 }}>
                    {t.summary.slice(0, 96)}…
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* right — cedalion lives here too */}
        <div style={{ position: "sticky", top: 76, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel" style={{ height: 560, display: "flex", flexDirection: "column" }}>
            <div className="row" style={{ justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
              <div className="row gap-2">
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
                <span style={{ fontSize: 12, letterSpacing: "0.12em" }}>CEDALION</span>
              </div>
              <span className="faint mono-sm">always on</span>
            </div>
            <CedalionChat />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={{ background: "var(--bg)", padding: "16px 18px" }}>
      <div className="label">{label}</div>
      <div style={{ fontSize: 24, margin: "6px 0 2px", fontWeight: 300 }}>{value}</div>
      <div className="faint mono-sm">{note}</div>
    </div>
  );
}
