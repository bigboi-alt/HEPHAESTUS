import { useMemo, useState } from "react";
import { useApp } from "../store";
import {
  exportPalette, ROLE_ORDER, SCHEME_LABEL, SCHEMES, SPACE_SIZE,
  crossPalettes, describeColor, type ExportFormat, type Mode, type Role, type Scheme,
} from "../engine/akmon";
import {
  contrastRatio, formatColor, hexToOklch, isValidHex, mix, mixMany,
  ramp, round, simulateCvd, wcagLevel, type CvdType,
} from "../engine/color";
import { auditPalette } from "../engine/cedalion";
import PalettePreview from "../components/PalettePreview";
import AuditPanel from "../components/AuditPanel";
import { download } from "../lib/storage";

const EXAMPLES = [
  "deep dusty teal with a burnt orange accent, dark",
  "trustworthy fintech, muted, light mode",
  "neon retrofuturism on near black",
  "sage and clay, soft brutalism",
  "clinical cool blues, AAA contrast",
  "vivid dopamine triadic for a launch page",
];

type Tab = "swatches" | "mixer" | "scales" | "export";

export default function Akmon() {
  const { current, generate, vary, toggleLock, setSwatch, savePalette, settings, palettes, say, purposeId } = useApp();
  const [prompt, setPrompt] = useState(current?.prompt ?? "");
  const [tab, setTab] = useState<Tab>("swatches");
  const [cvd, setCvd] = useState<CvdType | "none">("none");

  const audit = useMemo(
    () => (current ? auditPalette(current, purposeId ?? undefined) : null),
    [current, purposeId]
  );

  if (!current) return null;

  const shown = (hex: string) => (cvd === "none" ? hex : simulateCvd(hex, cvd));
  const bg = current.swatches.find((s) => s.role === "background")!.hex;

  return (
    <div style={{ padding: "26px 22px 90px", maxWidth: 1440, margin: "0 auto" }}>
      {/* header */}
      <div style={{ marginBottom: 18 }}>
        <div className="label">akmon · the anvil</div>
        <h1 style={{ fontSize: 26, fontWeight: 400, margin: "6px 0 4px", letterSpacing: "-0.01em" }}>
          Describe a palette. Get a system.
        </h1>
        <p className="dim" style={{ margin: 0, fontSize: 12, maxWidth: 620 }}>
          Plain language in, eight accessibility-checked roles out. Lock what works, reforge the rest.
        </p>
      </div>

      {/* prompt bar */}
      <div className="row gap-1" style={{ marginBottom: 10 }}>
        <input
          className="input"
          placeholder='e.g. "deep dusty teal with a burnt orange accent, dark"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate({ prompt })}
        />
        <button className="btn btn-primary" onClick={() => generate({ prompt })}>forge</button>
        <button className="btn" onClick={() => generate({ prompt, keepLocks: false })} title="Ignore locks, start clean">
          reset
        </button>
      </div>

      <div className="row gap-1" style={{ flexWrap: "wrap", marginBottom: 22 }}>
        {EXAMPLES.map((e) => (
          <button
            key={e}
            className="btn"
            style={{ fontSize: 10, padding: "4px 9px", textTransform: "none" }}
            onClick={() => { setPrompt(e); generate({ prompt: e, keepLocks: false }); }}
          >
            {e}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {/* controls */}
          <div className="panel" style={{ padding: 14 }}>
            <div className="row gap-3" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                <span className="label">scheme</span>
                <select
                  className="input"
                  style={{ width: "auto", padding: "5px 8px", fontSize: 11 }}
                  value={current.scheme}
                  onChange={(e) => generate({ prompt, scheme: e.target.value as Scheme })}
                >
                  {SCHEMES.map((s) => (
                    <option key={s} value={s}>{s} — {SCHEME_LABEL[s]}</option>
                  ))}
                </select>
                <div className="row gap-1">
                  {(["dark", "light"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      className="btn"
                      data-active={current.mode === m}
                      style={{ padding: "5px 10px", fontSize: 10 }}
                      onClick={() => generate({ prompt, mode: m })}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="row gap-1">
                <button className="btn" onClick={() => vary(0.35)} title="Small perturbation">nudge</button>
                <button className="btn" onClick={() => vary(0.9)} title="Large perturbation">shake</button>
                <button className="btn" onClick={() => savePalette()}>save</button>
              </div>
            </div>

            <div className="row gap-2" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-soft)", flexWrap: "wrap" }}>
              <span className="label">simulate</span>
              {(["none", "deuteranopia", "protanopia", "tritanopia", "achromatopsia"] as const).map((t) => (
                <button
                  key={t}
                  className="btn"
                  data-active={cvd === t}
                  style={{ padding: "4px 9px", fontSize: 10 }}
                  onClick={() => setCvd(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* tabs */}
          <div>
            <div className="row gap-1" style={{ marginBottom: 12 }}>
              {(["swatches", "mixer", "scales", "export"] as Tab[]).map((t) => (
                <button key={t} className="btn" data-active={tab === t} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>

            {tab === "swatches" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                {ROLE_ORDER.map((role) => {
                  const s = current.swatches.find((x) => x.role === role)!;
                  const ratio = contrastRatio(s.hex, bg);
                  const ok = hexToOklch(s.hex);
                  return (
                    <div key={role} className="panel" style={{ overflow: "hidden" }}>
                      <div
                        style={{
                          height: 78, background: shown(s.hex), position: "relative",
                          borderBottom: "1px solid var(--line)",
                        }}
                      >
                        <button
                          onClick={() => toggleLock(role)}
                          title={s.locked ? "Unlock" : "Lock — survives regeneration"}
                          style={{
                            position: "absolute", top: 6, right: 6, fontSize: 10,
                            background: "rgba(0,0,0,0.45)", color: "#fff", padding: "2px 6px",
                          }}
                        >
                          {s.locked ? "locked" : "lock"}
                        </button>
                      </div>
                      <div style={{ padding: "9px 10px" }}>
                        <div className="label" style={{ marginBottom: 3 }}>{role}</div>
                        <input
                          className="input"
                          style={{ padding: "4px 6px", fontSize: 11, border: "1px solid var(--line-soft)" }}
                          value={s.hex}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (isValidHex(v)) setSwatch(role, v.startsWith("#") ? v : `#${v}`);
                            else if (v.length <= 7) setSwatch(role, v as string);
                          }}
                        />
                        <div className="faint mono-sm" style={{ marginTop: 5 }}>{s.name}</div>
                        <div className="faint mono-sm">
                          {settings.colorFormat !== "hex" && `${formatColor(s.hex, settings.colorFormat)} · `}
                          L{round(ok.l, 2)} C{round(ok.c, 2)}
                        </div>
                        {role !== "background" && (
                          <div
                            className="mono-sm"
                            style={{
                              marginTop: 4,
                              color: ratio >= 4.5 ? "var(--ok)" : ratio >= 3 ? "var(--warn)" : "var(--bad)",
                            }}
                          >
                            {round(ratio, 2)}:1 {wcagLevel(ratio)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "mixer" && <Mixer />}

            {tab === "scales" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {(["primary", "secondary", "accent"] as Role[]).map((role) => {
                  const hex = current.swatches.find((s) => s.role === role)!.hex;
                  const r = ramp(hex);
                  return (
                    <div key={role}>
                      <div className="label" style={{ marginBottom: 6 }}>{role} ramp</div>
                      <div style={{ display: "flex", border: "1px solid var(--line)" }}>
                        {Object.entries(r).map(([stop, h]) => (
                          <button
                            key={stop}
                            onClick={() => { void navigator.clipboard?.writeText(h); say(`copied ${h}`); }}
                            style={{ flex: 1, background: shown(h), height: 56, position: "relative" }}
                            title={`${stop} · ${h} — click to copy`}
                          >
                            <span
                              className="mono-sm"
                              style={{
                                position: "absolute", bottom: 3, left: 0, right: 0,
                                fontSize: 8.5, color: Number(stop) > 500 ? "#fff" : "#000", opacity: 0.75,
                              }}
                            >
                              {stop}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="faint mono-sm" style={{ margin: 0 }}>
                  Ramps are generated in OKLCH with a chroma bell curve, so tints stay clean and
                  shades don't go muddy. Click any stop to copy.
                </p>
              </div>
            )}

            {tab === "export" && <ExportPanel />}
          </div>

          <PalettePreview p={current} />
        </div>

        {/* right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 76 }}>
          {audit && <AuditPanel audit={audit} />}

          <div className="panel" style={{ padding: 14 }}>
            <div className="label" style={{ marginBottom: 8 }}>coordinate</div>
            <div className="faint mono-sm">seed {current.seed.toString(36)}</div>
            <div className="faint mono-sm">scheme {current.scheme}</div>
            {current.moodId && <div className="faint mono-sm">mood {current.moodId}</div>}
            <div className="faint mono-sm" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)" }}>
              addressable space ≈ {SPACE_SIZE.pretty} palettes
            </div>
            <div className="faint mono-sm">
              {SPACE_SIZE.perSwatch.toLocaleString("en-US")} coordinates per swatch × {SPACE_SIZE.swatches} roles
            </div>
          </div>

          {palettes.length > 1 && (
            <div className="panel" style={{ padding: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>crossbreed</div>
              <p className="faint mono-sm" style={{ margin: "0 0 8px" }}>
                Blend the current palette with a saved one, role by role, in OKLab.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {palettes.filter((p) => p.id !== current.id).slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    className="btn"
                    style={{ textAlign: "left", textTransform: "none", fontSize: 11 }}
                    onClick={() => useApp.getState().setCurrent(crossPalettes(current, p, 0.5))}
                  >
                    × {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Mixer() {
  const { current, say } = useApp();
  const [a, setA] = useState("#1F6FEB");
  const [b, setB] = useState("#F97316");
  const [t, setT] = useState(50);
  const [space, setSpace] = useState<"oklab" | "oklch" | "srgb">("oklab");
  const [pool, setPool] = useState<string[]>([]);

  const result = mix(a, b, t / 100, space);
  const poolResult = pool.length ? mixMany(pool) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel" style={{ padding: 14 }}>
        <div className="label" style={{ marginBottom: 10 }}>two-colour blend</div>
        <div className="row gap-2" style={{ marginBottom: 12 }}>
          <input type="color" value={a} onChange={(e) => setA(e.target.value.toUpperCase())} style={{ width: 44, height: 34, background: "none", border: "1px solid var(--line)" }} />
          <input className="input" value={a} onChange={(e) => isValidHex(e.target.value) && setA(e.target.value.toUpperCase())} style={{ width: 100 }} />
          <div style={{ flex: 1, height: 34, background: `linear-gradient(90deg, ${a}, ${result}, ${b})`, border: "1px solid var(--line)" }} />
          <input className="input" value={b} onChange={(e) => isValidHex(e.target.value) && setB(e.target.value.toUpperCase())} style={{ width: 100 }} />
          <input type="color" value={b} onChange={(e) => setB(e.target.value.toUpperCase())} style={{ width: 44, height: 34, background: "none", border: "1px solid var(--line)" }} />
        </div>
        <input type="range" min={0} max={100} value={t} onChange={(e) => setT(+e.target.value)} style={{ width: "100%", accentColor: "var(--accent)" }} />
        <div className="row gap-2" style={{ marginTop: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div className="row gap-1">
            {(["oklab", "oklch", "srgb"] as const).map((s) => (
              <button key={s} className="btn" data-active={space === s} style={{ fontSize: 10, padding: "4px 9px" }} onClick={() => setSpace(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="row gap-2">
            <div style={{ width: 40, height: 26, background: result, border: "1px solid var(--line)" }} />
            <button className="btn" onClick={() => { void navigator.clipboard?.writeText(result); say(`copied ${result}`); }}>
              {result}
            </button>
          </div>
        </div>
        <p className="faint mono-sm" style={{ margin: "10px 0 0" }}>
          {space === "srgb"
            ? "sRGB: what CSS does by default. Mixing complements here produces grey mud."
            : space === "oklch"
              ? "OKLCH: travels around the hue wheel — vivid, but passes through hues neither input contained."
              : "OKLab: a perceptually straight line between the two colours. This is the honest blend."}
        </p>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="label">crucible — melt many at once</span>
          <button className="btn" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => setPool([])}>clear</button>
        </div>
        <div className="row gap-1" style={{ flexWrap: "wrap", marginBottom: 10 }}>
          {current?.swatches.map((s) => (
            <button
              key={s.role}
              onClick={() => setPool((p) => [...p, s.hex])}
              title={`add ${s.role}`}
              style={{ width: 30, height: 30, background: s.hex, border: "1px solid var(--line)" }}
            />
          ))}
          <button className="btn" style={{ fontSize: 10 }} onClick={() => setPool((p) => [...p, a, b])}>+ mixer pair</button>
        </div>
        {pool.length > 0 && (
          <>
            <div className="row gap-1" style={{ flexWrap: "wrap", marginBottom: 10 }}>
              {pool.map((h, i) => (
                <button key={i} onClick={() => setPool((p) => p.filter((_, j) => j !== i))} style={{ width: 24, height: 24, background: h, border: "1px solid var(--line)" }} title="remove" />
              ))}
            </div>
            <div className="row gap-2">
              <div style={{ width: 56, height: 40, background: poolResult!, border: "1px solid var(--line)" }} />
              <div>
                <div style={{ fontSize: 12 }}>{poolResult}</div>
                <div className="faint mono-sm">{describeColor(poolResult!)} · {pool.length} inputs, equal weight</div>
              </div>
            </div>
          </>
        )}
        {pool.length === 0 && (
          <p className="faint mono-sm" style={{ margin: 0 }}>
            Add any number of colours and they melt into their perceptual centroid.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ExportPanel() {
  const { current, say } = useApp();
  const [fmt, setFmt] = useState<ExportFormat>("css");
  if (!current) return null;
  const text = exportPalette(current, fmt);

  return (
    <div>
      <div className="row gap-1" style={{ marginBottom: 10, flexWrap: "wrap" }}>
        {(["css", "scss", "tailwind", "json", "svg"] as ExportFormat[]).map((f) => (
          <button key={f} className="btn" data-active={fmt === f} onClick={() => setFmt(f)}>{f}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { void navigator.clipboard?.writeText(text); say("copied to clipboard"); }}>copy</button>
        <button
          className="btn"
          onClick={() =>
            download(
              `${current.name.toLowerCase().replace(/\s+/g, "-")}.${fmt === "tailwind" ? "js" : fmt}`,
              text,
              fmt === "svg" ? "image/svg+xml" : "text/plain"
            )
          }
        >
          download
        </button>
      </div>
      <pre
        className="panel"
        style={{
          margin: 0, padding: 14, fontSize: 11, lineHeight: 1.6,
          maxHeight: 380, overflow: "auto", whiteSpace: "pre-wrap", color: "var(--fg-dim)",
        }}
      >
        {text}
      </pre>
    </div>
  );
}
