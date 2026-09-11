import { useMemo, useState } from "react";
import { useApp } from "../store";
import {
  exportPalette, generatePalette, SCHEME_LABEL, SCHEMES, SPACE_SIZE,
  describeColor, type ExportFormat, type Mode, type Role, type Scheme,
} from "../engine/akmon";
import {
  contrastRatio, formatColor, hexToOklch, isValidHex, mix, mixMany,
  ramp, round, simulateCvd, wcagLevel, type CvdType,
} from "../engine/color";
import { auditPalette, type Audit } from "../engine/cedalion";
import { SurfacePlanes, VOICE_JOBS, VoiceSurfaceSplit } from "../components/ForgeSplit";
import { STUDIO_PRESETS } from "../data/presets";
import { download } from "../lib/storage";

const EXAMPLES = [
  "deep dusty teal with a burnt orange accent, dark",
  "sage and clay, soft brutalism",
  "trustworthy fintech, light mode",
  "plum brandy with an acid lime accent, dark",
];

type Tool = "mixer" | "scales" | "export";

/** one obvious verdict colour: S/A green, B amber, below red */
function gradeColor(score: number): string {
  return score >= 82 ? "var(--ok)" : score >= 70 ? "var(--warn)" : "var(--bad)";
}

const VOICE: Role[] = ["primary", "secondary", "accent"];

export default function Akmon() {
  const { current, generate, vary, toggleLock, setSwatch, savePalette, purposeId, askCedalion } = useApp();
  const [prompt, setPrompt] = useState(current?.prompt ?? "");
  const [tool, setTool] = useState<Tool | null>(null);
  const [cvd, setCvd] = useState<CvdType | "none">("none");

  const audit = useMemo(
    () => (current ? auditPalette(current, purposeId ?? undefined) : null),
    [current, purposeId]
  );
  const schemePreviews = useMemo(
    () =>
      SCHEMES.map((s) => ({
        s,
        p: (() => {
          try {
            const p = generatePalette({ prompt: prompt || "preview", scheme: s, mode: current?.mode ?? "dark", seed: current?.seed ?? 7 });
            const hex = (r: Role) => p.swatches.find((x) => x.role === r)?.hex ?? "#888";
            return [hex("background"), hex("surface"), hex("text"), hex("primary"), hex("accent")];
          } catch {
            return ["#666", "#777", "#888", "#999", "#aaa"];
          }
        })(),
      })),
    [prompt, current?.mode, current?.seed]
  );
  if (!current) return null;

  const shown = (hex: string) => (cvd === "none" ? hex : simulateCvd(hex, cvd));
  const swatch = (role: Role) => current.swatches.find((s) => s.role === role)!;
  const bg = swatch("background").hex;

  const forge = (opts: { p?: string; scheme?: Scheme; mode?: Mode } = {}) =>
    generate({ prompt: opts.p ?? prompt, scheme: opts.scheme, mode: opts.mode });

  return (
    <div style={{ padding: "22px 22px 96px", maxWidth: 1380, margin: "0 auto" }}>
      {/* ---------- header ---------- */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <div className="label">akmon · the anvil</div>
          <h1 style={{ fontSize: 27, fontWeight: 400, margin: "5px 0 0", letterSpacing: "-0.01em" }}>
            Forge a palette.
          </h1>
        </div>
        <div className="row gap-1">
          <button
            className="btn"
            style={{ fontSize: 10 }}
            onClick={() => askCedalion(current ? "Score my palette" : "What can you do?")}
            title="Cedalion reads this palette and tells you what is measurably wrong"
          >ask cedalion</button>
          <button className="btn" style={{ fontSize: 10 }} onClick={() => vary(0.35)}>nudge</button>
          <button className="btn" style={{ fontSize: 10 }} onClick={() => vary(0.9)}>shake</button>
        </div>
      </div>

      {/* ---------- forge bar ---------- */}
      <div className="panel" style={{ padding: 14, marginBottom: 16 }}>
        <div className="row gap-1" style={{ flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder='say what you want — "deep dusty teal with a burnt orange accent, dark"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && forge()}
            style={{ flex: "1 1 360px" }}
          />
          <button className="btn btn-primary" style={{ padding: "9px 26px", fontSize: 12 }} onClick={() => forge()}>forge</button>
          <div className="row" style={{ border: "1px solid var(--line)" }}>
            {(["dark", "light"] as Mode[]).map((m) => (
              <button
                key={m}
                data-active={current.mode === m}
                className="btn"
                style={{ border: 0, padding: "8px 12px", fontSize: 10, borderRadius: 0 }}
                onClick={() => forge({ mode: m })}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="row gap-1" style={{ marginTop: 10, flexWrap: "wrap" }}>
          {EXAMPLES.map((e) => (
            <button
              key={e}
              className="btn"
              style={{ fontSize: 10, padding: "4px 9px", textTransform: "none", color: prompt === e ? "var(--fg)" : undefined }}
              onClick={() => { setPrompt(e); forge({ p: e }); }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- schemes with live previews ---------- */}
      <div className="row gap-1" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <span className="label" style={{ marginRight: 4 }}>harmony</span>
        {schemePreviews.map(({ s, p }) => {
          return (
            <button
              key={s}
              data-active={current.scheme === s}
              className="row gap-1"
              style={{
                border: "1px solid var(--line)", padding: "3px 8px", fontSize: 10,
                color: current.scheme === s ? "var(--fg)" : "var(--fg-dim)",
              }}
              title={`${s} — ${SCHEME_LABEL[s]}`}
              onClick={() => forge({ scheme: s })}
            >
              <span style={{ display: "inline-flex", gap: 2 }}>
                {p.map((h) => (
                  <span key={h} style={{ width: 8, height: 10, background: h, display: "inline-block" }} />
                ))}
              </span>
              {s.replace("-", " ")}
            </button>
          );
        })}
      </div>

      {/* ---------- studio presets ---------- */}
      <div className="row" style={{ marginBottom: 20, flexWrap: "wrap", gap: 6 }}>
        <span className="label" style={{ marginRight: 2 }}>start from taste</span>
        {STUDIO_PRESETS.map((pr) => (
          <button
            key={pr.id}
            className="row gap-1"
            style={{ border: "1px solid var(--line)", padding: "3px 9px 3px 3px", fontSize: 10 }}
            title={pr.note}
            onClick={() => { setPrompt(pr.prompt); forge({ p: pr.prompt }); }}
          >
            <span style={{ display: "inline-flex", gap: 1, border: "1px solid var(--line-soft)" }}>
              {pr.swatch.map((h) => (
                <span key={h} style={{ width: 9, height: 12, background: h, display: "inline-block" }} />
              ))}
            </span>
            {pr.label}
          </button>
        ))}
      </div>

      {/* ---------- swatches ---------- */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <VoiceSurfaceSplit palette={current} shown={shown} />

          <SurfacePlanes
            palette={current}
            shown={shown}
            onHex={(r, h) => setSwatch(r, h)}
            onLock={toggleLock}
          />

          <SwatchGroup
            title="voice · the three that carry the brand"
            sub="these are the colours you edit. surfaces you only ever adjust."
            roles={VOICE}
            jobs={VOICE_JOBS}
            swatch={swatch}
            shown={shown}
            bg={bg}
            onLock={toggleLock}
            onHex={(r, h) => setSwatch(r, h)}
          />

          {/* tools */}
          <div className="row gap-1" style={{ flexWrap: "wrap" }}>
            <span className="label" style={{ marginRight: 4 }}>tools</span>
            {(["mixer", "scales", "export"] as Tool[]).map((t) => (
              <button key={t} className="btn" data-active={tool === t} style={{ fontSize: 10 }} onClick={() => setTool(tool === t ? null : t)}>
                {t === "scales" ? "tonal scales" : t}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <span className="faint mono-sm" style={{ alignSelf: "center" }}>
              {SPACE_SIZE.perSwatch.toLocaleString("en-US")} coords × {SPACE_SIZE.swatches} roles · {SPACE_SIZE.pretty} palettes
            </span>
          </div>

          {tool === "mixer" && <Mixer />}
          {tool === "scales" && <Scales shown={shown} />}
          {tool === "export" && <ExportPanel />}
        </div>

        {/* ---------- right rail: cedalion + save ---------- */}
        <div style={{ position: "sticky", top: 74, display: "flex", flexDirection: "column", gap: 12 }}>
          {audit && <AuditCard audit={audit} onOpenChat={() => askCedalion("What should I fix first?")} />}
          <div className="panel" style={{ padding: 12 }}>
            <div className="row gap-1" style={{ flexWrap: "wrap" }}>
              <button className="btn btn-primary" style={{ flex: 1, fontSize: 11 }} onClick={() => savePalette()}>save to library</button>
            </div>
            <div className="row gap-1" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <span className="label">simulate</span>
              {(["none", "deuteranopia", "protanopia", "tritanopia", "achromatopsia"] as const).map((t) => (
                <button
                  key={t}
                  data-active={cvd === t}
                  className="btn"
                  style={{ padding: "3px 8px", fontSize: 9 }}
                  onClick={() => setCvd(t)}
                >
                  {t === "none" ? "off" : t.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>
          <div className="panel" style={{ padding: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>your palette</div>
            <div style={{ fontSize: 12, marginBottom: 2 }}>{current.name}</div>
            <div className="faint mono-sm">{current.scheme} · {current.mode} · prompt: {current.prompt || "(typed)"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- one swatch group ---------- */
function SwatchGroup({ title, sub, roles, jobs, swatch, shown, bg, onLock, onHex }: {
  title: string; sub: string;
  roles: Role[];
  jobs?: Record<string, string>;
  swatch: (r: Role) => { hex: string; name: string; locked: boolean };
  shown: (h: string) => string;
  bg: string;
  onLock: (r: Role) => void;
  onHex: (r: Role, h: string) => void;
}) {
  const { settings, say } = useApp();
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13 }}>{title}</span>
        <span className="faint mono-sm" style={{ marginLeft: 10 }}>{sub}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(172px,1fr))", gap: 8 }}>
        {roles.map((role) => {
          const s = swatch(role);
          const ratio = contrastRatio(s.hex, bg);
          return (
            <div key={role} className="panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: 92, background: shown(s.hex), position: "relative", borderBottom: "1px solid var(--line)" }}>
                <button
                  onClick={() => onLock(role)}
                  title={s.locked ? "unlock" : "lock — keeps this colour on regeneration"}
                  style={{
                    position: "absolute", top: 5, right: 5,
                    background: "rgba(0,0,0,0.4)", color: "#fff",
                    border: "1px solid rgba(255,255,255,0.25)",
                    padding: "1px 7px", fontSize: 9, letterSpacing: "0.08em",
                  }}
                >
                  {s.locked ? "locked" : "lock"}
                </button>
              </div>
              <div style={{ padding: "8px 9px", display: "flex", flexDirection: "column", gap: 5 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="label" style={{ fontSize: 9 }}>{role}</span>
                  <span className="faint" style={{ fontSize: 9, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                </div>
                {jobs?.[role] && (
                  <div className="faint" style={{ fontSize: 9.5, lineHeight: 1.5 }}>{jobs[role]}</div>
                )}
                <div className="row" style={{ gap: 5 }}>
                  <input
                    type="color"
                    value={s.hex}
                    onChange={(e) => onHex(role, e.target.value)}
                    style={{ width: 24, height: 22, padding: 0, border: "1px solid var(--line)", background: shown(s.hex), cursor: "pointer" }}
                    title="pick a colour"
                  />
                  <button
                    className="input"
                    style={{ flex: 1, padding: "3px 7px", fontSize: 11, textAlign: "left", cursor: "copy" }}
                    onClick={() => { void navigator.clipboard?.writeText(s.hex); say(`copied ${s.hex}`); }}
                    title="click to copy"
                  >
                    {settings.colorFormat !== "hex" ? formatColor(s.hex, settings.colorFormat as never) : s.hex}
                  </button>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="faint mono-sm" style={{ fontSize: 9 }}>
                    L{round(hexToOklch(s.hex).l, 2)} · C{round(hexToOklch(s.hex).c, 2)}
                  </span>
                  {role !== "background" && (
                    <span className="mono-sm" style={{ fontSize: 9, color: ratio >= 4.5 ? "var(--ok)" : ratio >= 3 ? "var(--warn)" : "var(--bad)" }}>
                      {round(ratio, 2)}:1 {wcagLevel(ratio)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
/* ---------- audit card (score is always visible, colour tells the truth) ---------- */
function AuditCard({ audit, onOpenChat }: { audit: Audit; onOpenChat: () => void }) {
  const { setSwatch, say } = useApp();
  const col = gradeColor(audit.score);
  const top = audit.findings
    .filter((f) => f.severity === "critical" || f.severity === "warning")
    .slice(0, 3);
  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="label">cedalion says</span>
        <button className="faint mono-sm" style={{ fontSize: 10 }} onClick={onOpenChat}>chat →</button>
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 40, lineHeight: 1, fontWeight: 300, color: col }}>{audit.score}</span>
        <span className="faint mono-sm">/100 · {audit.grade}</span>
      </div>
      <p style={{ fontSize: 11.5, margin: "0 0 10px", lineHeight: 1.55 }}>{audit.headline}</p>
      <div style={{ display: "flex", height: 3, gap: 2, marginBottom: 10 }}>
        {audit.categories.map((c) => (
          <div key={c.id} title={`${c.label}: ${c.score}`} style={{ flex: c.weight, background: c.score >= 85 ? "var(--ok)" : c.score >= 60 ? "var(--warn)" : "var(--bad)" }} />
        ))}
      </div>
      {top.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {top.map((f) => (
            <div key={f.id} style={{ fontSize: 10.5, lineHeight: 1.5 }}>
              <div className="dim">{f.severity === "critical" ? "✕" : "!"} {f.title}</div>
              {f.fix && (
                <button
                  className="btn"
                  style={{ marginTop: 4, fontSize: 9, padding: "2px 7px", textTransform: "none" }}
                  onClick={() => { setSwatch(f.fix!.role, f.fix!.hex); say("fix applied"); }}
                >
                  fix: {f.fix.label} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {audit.findings.filter((f) => f.severity === "win").length > 0 && (
        <div className="ok" style={{ fontSize: 10.5, color: "var(--ok)" }}>
          ✓ {audit.findings.filter((f) => f.severity === "win").length} things already right
        </div>
      )}
    </div>
  );
}

/* ---------- scales (11-step tonal ramps) ---------- */
function Scales({ shown }: { shown: (h: string) => string }) {
  const { current, say } = useApp();
  if (!current) return null;
  return (
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
                  title={`${stop} · ${h}`}
                >
                  <span className="mono-sm" style={{ position: "absolute", bottom: 3, left: 0, right: 0, fontSize: 8.5, color: Number(stop) > 500 ? "#fff" : "#000", opacity: 0.7 }}>
                    {stop}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- mixer (blend two, or melt many) ---------- */
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
        <div className="label" style={{ marginBottom: 10 }}>blend two colours</div>
        <div className="row gap-2" style={{ marginBottom: 12 }}>
          <input type="color" value={a} onChange={(e) => setA(e.target.value.toUpperCase())} style={{ width: 42, height: 32, border: "1px solid var(--line)", background: "none", padding: 0 }} />
          <input className="input" value={a} onChange={(e) => isValidHex(e.target.value) && setA(e.target.value.toUpperCase())} style={{ width: 96, fontSize: 11 }} />
          <div style={{ flex: 1, height: 32, background: `linear-gradient(90deg, ${a}, ${result}, ${b})`, border: "1px solid var(--line)" }} />
          <input className="input" value={b} onChange={(e) => isValidHex(e.target.value) && setB(e.target.value.toUpperCase())} style={{ width: 96, fontSize: 11 }} />
          <input type="color" value={b} onChange={(e) => setB(e.target.value.toUpperCase())} style={{ width: 42, height: 32, border: "1px solid var(--line)", background: "none", padding: 0 }} />
        </div>
        <input type="range" min={0} max={100} value={t} onChange={(e) => setT(+e.target.value)} style={{ width: "100%", accentColor: "var(--accent)" }} />
        <div className="row gap-2" style={{ marginTop: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div className="row gap-1">
            {(["oklab", "oklch", "srgb"] as const).map((s) => (
              <button key={s} className="btn" data-active={space === s} style={{ fontSize: 10, padding: "4px 9px" }} onClick={() => setSpace(s)}>{s}</button>
            ))}
          </div>
          <div className="row gap-2">
            <div style={{ width: 40, height: 26, background: result, border: "1px solid var(--line)" }} />
            <button className="btn" onClick={() => { void navigator.clipboard?.writeText(result); say(`copied ${result}`); }}>{result}</button>
          </div>
        </div>
        <p className="faint mono-sm" style={{ margin: "10px 0 0" }}>
          {space === "srgb"
            ? "sRGB — what CSS does by default; mixing complements here turns to mud."
            : space === "oklch"
              ? "OKLCH — travels around the hue wheel; vivid but passes hues neither input had."
              : "OKLab — a perceptually straight line between the two. The honest blend."}
        </p>
      </div>
      <div className="panel" style={{ padding: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="label">crucible — melt many</span>
          <button className="btn" style={{ fontSize: 9, padding: "2px 8px" }} onClick={() => setPool([])}>clear</button>
        </div>
        <div className="row gap-1" style={{ flexWrap: "wrap", marginBottom: 10 }}>
          {current?.swatches.map((s) => (
            <button key={s.role} onClick={() => setPool((p) => [...p, s.hex])} title={`add ${s.role}`} style={{ width: 28, height: 28, background: s.hex, border: "1px solid var(--line)" }} />
          ))}
          <button className="btn" style={{ fontSize: 10 }} onClick={() => setPool((p) => [...p, a, b])}>+ pair</button>
        </div>
        {pool.length > 0 ? (
          <>
            <div className="row gap-1" style={{ flexWrap: "wrap", marginBottom: 10 }}>
              {pool.map((h, i) => (
                <button key={i} onClick={() => setPool((p) => p.filter((_, j) => j !== i))} title="remove" style={{ width: 22, height: 22, background: h, border: "1px solid var(--line)" }} />
              ))}
            </div>
            <div className="row gap-2">
              <div style={{ width: 52, height: 38, background: poolResult!, border: "1px solid var(--line)" }} />
              <div>
                <div style={{ fontSize: 12 }}>{poolResult}</div>
                <div className="faint mono-sm">{describeColor(poolResult!)} · {pool.length} colours, equal weight</div>
              </div>
            </div>
          </>
        ) : (
          <p className="faint mono-sm" style={{ margin: 0 }}>tap any swatch to throw it in the pot — they melt into one perceptual centroid.</p>
        )}
      </div>
    </div>
  );
}

/* ---------- export ---------- */
function ExportPanel() {
  const { current, say } = useApp();
  const [fmt, setFmt] = useState<ExportFormat>("css");
  if (!current) return null;
  const text = exportPalette(current, fmt);
  return (
    <div>
      <div className="row gap-1" style={{ marginBottom: 10, flexWrap: "wrap" }}>
        {(["css", "scss", "tailwind", "json", "svg"] as ExportFormat[]).map((f) => (
          <button key={f} className="btn" data-active={fmt === f} style={{ fontSize: 10 }} onClick={() => setFmt(f)}>{f}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn" style={{ fontSize: 10 }} onClick={() => { void navigator.clipboard?.writeText(text); say("copied"); }}>copy</button>
        <button className="btn" style={{ fontSize: 10 }} onClick={() => download(`${current.name.toLowerCase().replace(/\s+/g, "-")}.${fmt === "tailwind" ? "js" : fmt}`, text, fmt === "svg" ? "image/svg+xml" : "text/plain")}>
          download
        </button>
      </div>
      <pre className="panel" style={{ margin: 0, padding: 14, fontSize: 11, lineHeight: 1.6, maxHeight: 400, overflow: "auto", whiteSpace: "pre-wrap", color: "var(--fg-dim)" }}>
        {text}
      </pre>
    </div>
  );
}

