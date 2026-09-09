import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store";
import { PURPOSES, PURPOSE_GROUPS, getPurpose } from "../data/trends";
import { generateDirections, type Direction } from "../engine/directions";
import { generatePalette, type Palette, type Role } from "../engine/akmon";
import { auditPalette } from "../engine/cedalion";
import { buildSiteHtml, defaultSections, SITE_SECTIONS, type SiteKnobs, type SiteSection } from "../engine/sites";
import { download } from "../lib/storage";
import { PaletteStrip } from "../components/PaletteCard";

type Spec = {
  purposeId: string;
  palette: Palette;
  direction: Direction;
  sections: SiteSection[];
  seed: number;
  mode: "auto" | "myself";
  knobs: SiteKnobs;
};

const FONT_OVERRIDES: { id: string; label: string; stack: string }[] = [
  { id: "sans", label: "sans", stack: "'Inter Tight', system-ui, -apple-system, 'Helvetica Neue', sans-serif" },
  { id: "serif", label: "serif", stack: "'Instrument Serif', Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "mono", stack: "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace" },
];

export default function Build() {
  const { purposeId, setPurpose, go, say, palettes, setBuildMeta, setCedalionOpen, purposeId: globalPurpose } = useApp();
  const [spec, setSpec] = useState<Spec | null>(null);
  const [purpose, setPurposeLocal] = useState<string | null>(purposeId ?? globalPurpose ?? null);
  const [dirSeed, setDirSeed] = useState(3);
  const [palSeed, setPalSeed] = useState(7);
  const [tab, setTab] = useState<"palette" | "sections" | "style">("sections");
  const [pickedDir, setPickedDir] = useState<Direction | null>(null);

  const p = purpose ? getPurpose(purpose) : undefined;

  /* directions for the picker (candidate list is cached with the purpose) */
  const candidates = useMemo(() => {
    if (!p) return [];
    return generateDirections(p.id, undefined, dirSeed, 4);
  }, [p, dirSeed]);

  const forged = useMemo(
    () => (p ? generatePalette({ prompt: `${p.label} ${p.moodId ?? ""} site design`, seed: palSeed }) : null),
    [p, palSeed]
  );

  /* one forge to rule them all: purpose ⇄ palette always available */
  const activePalette = spec?.palette ?? forged;

  const audit = useMemo(
    () => (activePalette && p ? auditPalette(activePalette, p.id) : null),
    [activePalette, p]
  );

  /* ---------- build actions ---------- */
  function build(mode: "auto" | "myself") {
    if (!p) return;
    const dir = pickedDir ?? candidates[0];
    if (!dir || !forged) return;
    const sections = mode === "auto" ? defaultSections(p) : (["nav", "hero", "footer"] as SiteSection[]);
    setSpec({
      purposeId: p.id,
      palette: forged,
      direction: dir,
      sections,
      seed: Math.floor(Math.random() * 99999) + 1,
      mode,
      knobs: { ...dir.spec },
    });
    if (purposeId !== p.id) setPurpose(p.id);
  }

  function patchSpec(mut: Partial<Spec>) {
    setSpec((s) => (s ? { ...s, ...mut } : s));
  }

  function patchPalette(role: Role, hex: string) {
    setSpec((s) =>
      s
        ? {
            ...s,
            palette: {
              ...s.palette,
              swatches: s.palette.swatches.map((sw) => (sw.role === role ? { ...sw, hex } : sw)),
            },
          }
        : s
    );
  }

  function toggleSection(id: SiteSection) {
    setSpec((s) => {
      if (!s) return s;
      const on = s.sections.includes(id);
      const sections = on ? s.sections.filter((x) => x !== id) : [...s.sections, id].sort((a, b) => orderOf(a) - orderOf(b));
      return { ...s, sections };
    });
  }
  function orderOf(id: SiteSection) {
    return SITE_SECTIONS.findIndex((x) => x.id === id);
  }

  const html = useMemo(() => {
    if (!spec || !getPurpose(spec.purposeId)) return null;
    return buildSiteHtml({
      purpose: getPurpose(spec.purposeId)!,
      palette: spec.palette,
      knobs: spec.knobs,
      atoms: spec.direction.atoms,
      sections: spec.sections,
      seed: spec.seed,
    }).html;
  }, [spec]);

  /* tell cedalion what we're building, live */
  useEffect(() => {
    if (!spec) { setBuildMeta(null); return; }
    const names = spec.sections.filter((x) => x !== "nav" && x !== "footer");
    setBuildMeta({
      purposeLabel: getPurpose(spec.purposeId)?.label ?? "",
      sectionsOn: names.length,
      sectionNames: names.map((n) => SITE_SECTIONS.find((x) => x.id === n)?.label ?? n),
    });
  }, [spec, setBuildMeta]);

  useEffect(() => () => setBuildMeta(null), [setBuildMeta]);

  const setPurposeAndReset = (id: string | null) => {
    setPurposeLocal(id);
    setPickedDir(null);
  };

  /* ================= pick phase ================= */
  if (!spec || !p || !html) {
    return (
      <div style={{ padding: "26px 22px 110px", maxWidth: 1180, margin: "0 auto" }}>
        <div className="label">build</div>
        <h1 style={{ fontSize: 26, fontWeight: 400, margin: "6px 0 6px" }}>What are you making?</h1>
        <p className="dim" style={{ fontSize: 12, margin: "0 0 24px", maxWidth: 640 }}>
          pick a purpose — then press build and a real, live website comes out. scroll it, click it, restyle it.
          {!p && " (start by picking one)"}
        </p>

        {PURPOSE_GROUPS.map((g) => {
          const items = PURPOSES.filter((x) => x.group === g);
          return (
            <div key={g} style={{ marginBottom: 14 }}>
              <div className="faint mono-sm" style={{ marginBottom: 6, letterSpacing: "0.14em", textTransform: "uppercase" }}>{g}</div>
              <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                {items.map((x) => (
                  <button
                    key={x.id}
                    className="btn"
                    data-active={purpose === x.id}
                    style={{ textTransform: "none", fontSize: 11 }}
                    onClick={() => setPurposeAndReset(x.id)}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {p && (
          <div className="fade-in" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 18 }}>
            {/* palette preview + style candidates */}
            <div className="panel" style={{ padding: 16 }}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>{p.label}</div>
                  <div className="faint mono-sm" style={{ maxWidth: 560, lineHeight: 1.5 }}>{p.brief}</div>
                </div>
                <span className="dim mono-sm">{p.priorities[0]}</span>
              </div>
              {forged && (
                <div className="row gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
                  <div style={{ width: 220, border: "1px solid var(--line)" }}>
                    <PaletteStrip p={forged} height={24} />
                  </div>
                  <button className="btn" style={{ fontSize: 10 }} onClick={() => setPalSeed((s) => s + 1)}>↻ forge palette</button>
                  {audit && <span className={`mono-sm ${audit.score >= 82 ? "" : "faint"}`} style={{ color: audit.score >= 82 ? "var(--ok)" : "var(--warn)" }}>{audit.score}/100</span>}
                  <span className="faint mono-sm">uses {forged.mode === "dark" ? "dark" : "light"} colours</span>
                </div>
              )}
              {candidates.length > 0 && (
                <div className="row gap-1" style={{ marginTop: 14, flexWrap: "wrap" }}>
                  <span className="label" style={{ marginRight: 6 }}>style</span>
                  {candidates.map((d) => (
                    <button
                      key={d.id}
                      className="btn"
                      data-active={(pickedDir?.id ?? candidates[0]?.id) === d.id}
                      style={{ fontSize: 10, textTransform: "none" }}
                      onClick={() => setPickedDir(d)}
                    >
                      {d.name} · {d.fit}
                    </button>
                  ))}
                  <button className="btn" style={{ fontSize: 10 }} onClick={() => setDirSeed((s) => s + 1)}>↻ styles</button>
                </div>
              )}
            </div>

            {/* go buttons */}
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                style={{ padding: "12px 30px", fontSize: 13 }}
                onClick={() => build("auto")}
              >
                build the site →
              </button>
              <button
                className="btn"
                style={{ padding: "12px 22px", fontSize: 13 }}
                onClick={() => build("myself")}
              >
                build myself — I'll pick the sections
              </button>
              <span className="faint mono-sm">free-form canvas is the next milestone — for now you build from real sections, live.</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ================= workspace phase ================= */
  const dirs = generateDirections(spec.purposeId, spec.palette, dirSeed, 4);
  const sectionList = SITE_SECTIONS;
  const on = (id: SiteSection) => spec.sections.includes(id);

  const exportHtml = () => {
    const slug = (getPurpose(spec.purposeId)?.id ?? "site").toLowerCase();
    download(`hephaestus-${slug}-${spec.seed}.html`, html, "text/html");
    say("site exported — open it in any browser");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 58px)", minHeight: 480 }}>
      {/* workspace header */}
      <div
        className="row"
        style={{
          justifyContent: "space-between", gap: 14, flexWrap: "wrap",
          padding: "8px 16px", borderBottom: "1px solid var(--line)", background: "var(--bg)",
        }}
      >
        <div className="row gap-2" style={{ minWidth: 0, flexWrap: "wrap" }}>
          <button className="btn" style={{ fontSize: 10 }} onClick={() => { setSpec(null); setBuildMeta(null); }}>
            ← change
          </button>
          <span style={{ fontSize: 13 }}>{p.label}</span>
          <span className="faint mono-sm">{spec.mode === "auto" ? "auto-composed" : "hand-picked"}</span>
          {audit && (
            <span className="mono-sm" style={{ color: audit.score >= 82 ? "var(--ok)" : "var(--warn)" }}>palette {audit.score}</span>
          )}
          <button className="btn" style={{ fontSize: 10 }} onClick={() => setCedalionOpen(true)}>ask cedalion</button>
        </div>
        <div className="row gap-1">
          <button className="btn" style={{ fontSize: 10 }} onClick={() => patchSpec({ seed: spec.seed + 1 })} title="new copy & art">↻ shuffle</button>
          <button className="btn" style={{ fontSize: 10 }} onClick={exportHtml}>export .html</button>
        </div>
      </div>

      <div className="ws">
        {/* live site */}
        <div className="ws-stage">
          <iframe
            title="live site preview"
            className="ws-frame"
            sandbox="allow-scripts"
            srcDoc={html}
          />
        </div>

        {/* smart workspace panel */}
        <div className="ws-panel">
          <div className="row gap-1" style={{ padding: 10, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            {(["sections", "palette", "style"] as const).map((t) => (
              <button key={t} className="ws-tab" data-active={tab === t} onClick={() => setTab(t)}>{t}</button>
            ))}
            <span style={{ flex: 1 }} />
            <button className="faint mono-sm" style={{ fontSize: 10 }} onClick={() => patchSpec({ seed: spec.seed + 1 })}>surprise me</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 0 }}>
            {/* ---------- sections ---------- */}
            {tab === "sections" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="faint mono-sm" style={{ lineHeight: 1.5, marginBottom: 4 }}>
                  {spec.mode === "auto"
                    ? "auto-composed for this purpose. uncheck to take control."
                    : "your page, your call. build up from essentials."}
                </div>
                {sectionList.map((s) => (
                  <button
                    key={s.id}
                    className="ws-chip"
                    data-on={on(s.id)}
                    style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onClick={() => toggleSection(s.id)}
                  >
                    <span>{s.label}</span>
                    <span style={{ opacity: 0.6 }}>{on(s.id) ? "on" : "off"}</span>
                  </button>
                ))}
                <div className="faint mono-sm" style={{ marginTop: 10, lineHeight: 1.5 }}>
                  every section is real: real copy, real links, mobile menu, working pricing toggle. click anything in the preview.
                </div>
              </div>
            )}

            {/* ---------- palette ---------- */}
            {tab === "palette" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="mono-sm dim">{spec.palette.name}</span>
                  <button className="btn" style={{ fontSize: 10 }} onClick={() => patchSpec({ palette: generatePalette({ prompt: `${p.label} ${p.moodId ?? ""} site design`, seed: palSeed + Math.floor(Math.random() * 9000) }) })}>↻ re-forge</button>
                </div>
                {spec.palette.swatches.map((sw) => (
                  <div key={sw.role} className="row" style={{ gap: 10, justifyContent: "space-between", border: "1px solid var(--line-soft)", padding: "5px 8px" }}>
                    <span className="mono-sm" style={{ width: 86, textTransform: "lowercase" }}>{sw.role}</span>
                    <input
                      type="color"
                      value={sw.hex}
                      onChange={(e) => patchPalette(sw.role as Role, e.target.value)}
                      style={{ width: 26, height: 22, border: "1px solid var(--line)", background: sw.hex, padding: 0, cursor: "pointer" }}
                      title="click to change"
                    />
                    <span className="faint mono-sm">{sw.hex}</span>
                  </div>
                ))}
                {audit && (
                  <div style={{ marginTop: 8, border: "1px solid var(--line)", padding: 10 }}>
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                      <span className="label">cedalion</span>
                      <span className="mono-sm" style={{ color: audit.score >= 82 ? "var(--ok)" : "var(--warn)" }}>{audit.score}/100 {audit.grade}</span>
                    </div>
                    <div className="dim mono-sm" style={{ fontSize: 11, lineHeight: 1.55 }}>{audit.headline}</div>
                    <button className="btn" style={{ fontSize: 10, marginTop: 8 }} onClick={() => setCedalionOpen(true)}>talk it through</button>
                  </div>
                )}
                {palettes.length > 0 && (
                  <>
                    <div className="label" style={{ marginTop: 12, marginBottom: 6 }}>from your library</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {palettes.slice(0, 6).map((pl) => (
                        <button
                          key={pl.id}
                          className="row gap-1"
                          style={{ border: "1px solid var(--line-soft)", padding: 3, textAlign: "left" }}
                          onClick={() => patchSpec({ palette: pl })}
                          title={pl.name}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <PaletteStrip p={pl} height={14} />
                          </div>
                          <span className="faint mono-sm" style={{ padding: "0 6px" }}>{pl.name.slice(0, 16)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ---------- style ---------- */}
            {tab === "style" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>directions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {dirs.map((d) => (
                      <button
                        key={d.id}
                        className="ws-chip"
                        data-on={spec.direction.id === d.id && spec.knobs.radius === d.spec.radius && spec.knobs.fontStack === d.spec.fontStack}
                        style={{ textAlign: "left", lineHeight: 1.4 }}
                        onClick={() => patchSpec({ direction: d, knobs: { ...d.spec }, seed: spec.seed })}
                      >
                        <span style={{ display: "block" }}>{d.name} <span className="faint">· {d.fit} fit</span></span>
                        <span className="faint" style={{ fontSize: 10 }}>{Object.values(d.atoms).map((a) => a.label).slice(0, 4).join(" · ")}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>font</div>
                  <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                    {FONT_OVERRIDES.map((f) => (
                      <button
                        key={f.id}
                        className="ws-chip"
                        data-on={spec.knobs.fontStack === f.stack}
                        onClick={() => patchSpec({ knobs: { ...spec.knobs, fontStack: f.stack } })}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>corners</div>
                  <div className="row gap-1">
                    {[0, 4, 12, 24].map((r) => (
                      <button
                        key={r}
                        className="ws-chip"
                        data-on={spec.knobs.radius === r}
                        onClick={() => patchSpec({ knobs: { ...spec.knobs, radius: r } })}
                      >
                        {r}px
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>borders</div>
                  <div className="row gap-1">
                    {[0, 1, 2, 3].map((b) => (
                      <button
                        key={b}
                        className="ws-chip"
                        data-on={spec.knobs.borderWidth === b}
                        onClick={() => patchSpec({ knobs: { ...spec.knobs, borderWidth: b } })}
                      >
                        {b === 0 ? "none" : `${b}px`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="faint mono-sm" style={{ lineHeight: 1.5 }}>
                  changing any of these restyles the live site instantly — it's the site's real css, not a mockup.
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", padding: "8px 12px" }}>
            <div className="row gap-1" style={{ flexWrap: "wrap" }}>
              <select
                className="input"
                style={{ fontSize: 11, padding: "6px 8px", flex: 1, minWidth: 140 }}
                value={spec.purposeId}
                onChange={(e) => {
                  const id = e.target.value;
                  const np = getPurpose(id);
                  if (!np) return;
                  const sections = spec.mode === "auto" ? defaultSections(np) : spec.sections;
                  patchSpec({ purposeId: id, sections });
                  setPurpose(id);
                }}
              >
                {PURPOSES.map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
              <button className="btn" style={{ fontSize: 10 }} onClick={() => go("akmon")}>forge in akmon</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
