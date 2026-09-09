import { useMemo, useState } from "react";
import { useApp } from "../store";
import { PURPOSES, PURPOSE_GROUPS, getPurpose, getTrend, DIRECTION_SPACE } from "../data/trends";
import { generateDirections, directionToTokens, type Direction } from "../engine/directions";
import { auditPalette } from "../engine/cedalion";
import { PaletteStrip } from "../components/PaletteCard";
import { download } from "../lib/storage";

export default function Build() {
  const { purposeId, setPurpose, current, go, say } = useApp();
  const [q, setQ] = useState("");
  const [seed, setSeed] = useState(1);
  const [openDir, setOpenDir] = useState<string | null>(null);

  const purpose = purposeId ? getPurpose(purposeId) : undefined;
  const directions = useMemo(
    () => (purposeId ? generateDirections(purposeId, current ?? undefined, seed, 6) : []),
    [purposeId, current, seed]
  );
  const audit = useMemo(() => (current ? auditPalette(current, purposeId ?? undefined) : null), [current, purposeId]);

  const filtered = PURPOSES.filter(
    (p) => !q.trim() || p.label.toLowerCase().includes(q.toLowerCase()) || p.group.includes(q.toLowerCase())
  );

  return (
    <div style={{ padding: "26px 22px 100px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="label">build</div>
      <h1 style={{ fontSize: 24, fontWeight: 400, margin: "6px 0 4px" }}>What are you making?</h1>
      <p className="dim" style={{ fontSize: 12, maxWidth: 700, margin: "0 0 22px" }}>
        Pick a purpose and Hephaestus assembles complete design directions from current trend atoms —
        layout, type, colour behaviour, surface, motion and interaction — filtered so incompatible
        combinations never reach you. {DIRECTION_SPACE.toLocaleString("en-US")} raw combinations before filtering.
      </p>

      {/* step 1 — palette check */}
      <div className="panel" style={{ padding: 14, marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div className="row gap-3" style={{ minWidth: 0 }}>
            <span className="label">1 · palette</span>
            {current ? (
              <>
                <div style={{ width: 160, border: "1px solid var(--line)" }}>
                  <PaletteStrip p={current} height={22} />
                </div>
                <span className="dim mono-sm">{current.name}</span>
                {audit && <span className="faint mono-sm">{audit.score}/100</span>}
              </>
            ) : (
              <span className="faint mono-sm">no palette selected</span>
            )}
          </div>
          <div className="row gap-1">
            <button className="btn" onClick={() => go("akmon")}>{current ? "change in akmon" : "create one"}</button>
            <button className="btn" onClick={() => go("library")}>pick from library</button>
          </div>
        </div>
      </div>

      {/* step 2 — purpose */}
      <div style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <span className="label">2 · purpose</span>
          <input className="input" style={{ maxWidth: 240 }} placeholder="search purposes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {PURPOSE_GROUPS.map((g) => {
          const items = filtered.filter((p) => p.group === g);
          if (!items.length) return null;
          return (
            <div key={g} style={{ marginBottom: 12 }}>
              <div className="faint mono-sm" style={{ marginBottom: 6 }}>{g}</div>
              <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                {items.map((p) => (
                  <button
                    key={p.id}
                    className="btn"
                    data-active={purposeId === p.id}
                    style={{ textTransform: "none", fontSize: 11 }}
                    onClick={() => { setPurpose(purposeId === p.id ? null : p.id); setOpenDir(null); }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {purpose && (
        <div className="fade-in">
          <div className="panel" style={{ padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 15, marginBottom: 4 }}>{purpose.label}</div>
            <p className="dim" style={{ fontSize: 12, margin: "0 0 14px", maxWidth: 720 }}>{purpose.brief}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 18 }}>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>priorities</div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {purpose.priorities.map((x) => <li key={x} className="dim mono-sm" style={{ lineHeight: 1.6 }}>{x}</li>)}
                </ul>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>sections you'll need</div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {purpose.sections.map((x) => <li key={x} className="dim mono-sm" style={{ lineHeight: 1.6 }}>{x}</li>)}
                </ul>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>trend posture</div>
                <div className="dim mono-sm" style={{ lineHeight: 1.6 }}>
                  favours: {purpose.favours.map((t) => getTrend(t)?.name ?? t).join(", ")}
                </div>
                <div className="faint mono-sm" style={{ lineHeight: 1.6, marginTop: 6 }}>
                  resists: {purpose.resists.map((t) => getTrend(t)?.name ?? t).join(", ") || "nothing in particular"}
                </div>
                <div className="faint mono-sm" style={{ marginTop: 6 }}>contrast floor {purpose.contrastFloor}:1</div>
              </div>
            </div>
          </div>

          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <span className="label">3 · directions</span>
            <div className="row gap-1">
              <button className="btn" onClick={() => setSeed((s) => s + 1)}>regenerate</button>
              <button className="btn" onClick={() => { setSeed(1); say("back to the safest set"); }}>reset</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>
            {directions.map((d) => (
              <DirectionCard key={d.id} d={d} open={openDir === d.id} onToggle={() => setOpenDir(openDir === d.id ? null : d.id)} />
            ))}
          </div>

          <div className="panel" style={{ padding: 18, marginTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>build myself — the canvas</div>
                <p className="faint mono-sm" style={{ margin: 0, maxWidth: 620, lineHeight: 1.6 }}>
                  Infinite canvas with frames, snapping, layers and Cedalion scoring the composition
                  live as you draw. It is the next milestone, not a stub pretending to work — the
                  palette engine, trend library, direction engine and critic it depends on all had to
                  exist first. They do now.
                </p>
              </div>
              <button className="btn" disabled>next release</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DirectionCard({ d, open, onToggle }: { d: Direction; open: boolean; onToggle: () => void }) {
  const { current, say } = useApp();
  const bar = d.fit >= 78 ? "var(--ok)" : d.fit >= 55 ? "var(--warn)" : "var(--bad)";

  return (
    <div className="panel" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span style={{ fontSize: 13 }}>{d.name}</span>
        <span className="mono-sm" style={{ color: bar }}>{d.fit} fit</span>
      </div>

      <div className="row gap-1" style={{ flexWrap: "wrap" }}>
        {Object.values(d.atoms).map((a) => (
          <span key={a.id} className="mono-sm" style={{ border: "1px solid var(--line)", padding: "2px 6px", color: "var(--fg-dim)", fontSize: 10 }}>
            {a.label}
          </span>
        ))}
      </div>

      <ul style={{ margin: 0, paddingLeft: 14 }}>
        {d.rationale.slice(0, open ? 4 : 2).map((r, i) => (
          <li key={i} className="dim mono-sm" style={{ lineHeight: 1.55 }}>{r}</li>
        ))}
      </ul>

      {open && d.cautions.length > 0 && (
        <div style={{ borderLeft: "2px solid var(--warn)", paddingLeft: 9 }}>
          {d.cautions.map((c, i) => (
            <div key={i} className="mono-sm" style={{ color: "var(--warn)", lineHeight: 1.55 }}>{c}</div>
          ))}
        </div>
      )}

      {open && (
        <div className="faint mono-sm" style={{ lineHeight: 1.6, borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
          radius {d.spec.radius}px · border {d.spec.borderWidth}px · space {d.spec.spacingUnit}px ·
          type {d.spec.baseFontPx}px @ {d.spec.typeScale.toFixed(2)} · motion {d.spec.motionMs}ms
        </div>
      )}

      <div className="row gap-1">
        <button className="btn" style={{ fontSize: 10, padding: "4px 9px" }} onClick={onToggle}>
          {open ? "less" : "details"}
        </button>
        <button
          className="btn"
          style={{ fontSize: 10, padding: "4px 9px" }}
          onClick={() => {
            void navigator.clipboard?.writeText(directionToTokens(d, current ?? undefined));
            say("tokens copied");
          }}
        >
          copy tokens
        </button>
        <button
          className="btn"
          style={{ fontSize: 10, padding: "4px 9px" }}
          onClick={() => download(`${d.name.toLowerCase().replace(/\s+/g, "-")}-tokens.css`, directionToTokens(d, current ?? undefined), "text/css")}
        >
          .css
        </button>
      </div>
    </div>
  );
}
