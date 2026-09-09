import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store";
import { PURPOSES, PURPOSE_GROUPS, getPurpose } from "../data/trends";
import { generateDirections, type Direction } from "../engine/directions";
import { generatePalette, type Palette, type Role } from "../engine/akmon";
import { auditPalette } from "../engine/cedalion";
import { buildSiteHtml, defaultSections, SITE_SECTIONS, type SiteSection } from "../engine/sites";
import { download } from "../lib/storage";
import { PaletteStrip } from "../components/PaletteCard";

const FONTS = [
  { id: "sans", label: "sans", stack: "'Inter Tight', system-ui, -apple-system, 'Helvetica Neue', sans-serif" },
  { id: "serif", label: "serif", stack: "'Instrument Serif', Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "mono", stack: "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace" },
];
const CORNERS = [0, 6, 14, 24];

type Spec = {
  purposeId: string;
  palette: Palette;
  direction: Direction;
  sections: SiteSection[];
  seed: number;
  empty: boolean; // true = hand-picked minimal start
};

export default function Build() {
  const { setPurpose, go, say, palettes, setBuildMeta, setCedalionOpen, purposeId: storedPurpose } = useApp();

  const [purposeId, setPurposeIdLocal] = useState<string | null>(
    storedPurpose && PURPOSES.some((p) => p.id === storedPurpose) ? storedPurpose : null
  );
  const [spec, setSpec] = useState<Spec | null>(null);

  // idea cycles — every click on these gives a whole new set (the infinite dial)
  const [palCycle, setPalCycle] = useState(0);
  const [dirCycle, setDirCycle] = useState(0);
  const [chosenPalette, setChosenPalette] = useState<Palette | null>(null);
  const [chosenDir, setChosenDir] = useState<Direction | null>(null);

  const purpose = purposeId ? getPurpose(purposeId) : undefined;

  /* palettes for the purpose — four options per cycle, endless cycles */
  const candidates4 = useMemo(() => {
    if (!purpose) return [];
    const base = 7 + palCycle * 4;
    return [0, 1, 2, 3].map((i) =>
      generatePalette({ prompt: `${purpose.label} ${purpose.moodId ?? ""} site`, seed: base + i })
    );
  }, [purpose, palCycle]);

  /* looks for the purpose — six per cycle, endless cycles */
  const looks = useMemo(() => {
    if (!purpose) return [];
    return generateDirections(purpose.id, undefined, 3 + dirCycle * 11, 6);
  }, [purpose, dirCycle]);

  const activePalette = spec?.palette ?? chosenPalette ?? candidates4[0] ?? null;
  const activeLook = spec?.direction ?? chosenDir ?? looks[0] ?? null;
  const audit = useMemo(
    () => (purpose && activePalette ? auditPalette(activePalette, purpose.id) : null),
    [purpose, activePalette]
  );

  const pickPurpose = (id: string | null) => {
    setPurposeIdLocal(id);
    setSpec(null);
    setChosenDir(null);
    if (id) setPurpose(id);
  };

  /** build with whatever ingredients are on screen */
  const buildSite = (empty: boolean, palIn?: Palette | null, dirIn?: Direction | null, pidIn?: string | null) => {
    const pur = pidIn ? getPurpose(pidIn) : purpose;
    if (!pur) return;
    const dir = dirIn ?? activeLook ?? looks[0];
    const pal = palIn ?? activePalette ?? candidates4[0];
    if (!dir || !pal) return;
    setSpec({
      purposeId: pur.id,
      palette: pal,
      direction: dir,
      sections: empty ? (["nav", "hero", "footer"] as SiteSection[]) : defaultSections(pur),
      seed: Math.floor(Math.random() * 99999) + 1,
      empty,
    });
    if (pidIn) { setPurposeIdLocal(pidIn); setPurpose(pidIn); }
    window.scrollTo(0, 0);
  };

  /** surprise: jump to a (possibly random) purpose with fresh ingredients and build */
  const surprise = () => {
    const pid = purpose?.id ?? PURPOSES[Math.floor(Math.random() * PURPOSES.length)].id;
    const pur = getPurpose(pid);
    if (!pur) return;
    const pal = generatePalette({ prompt: `${pur.label} ${pur.moodId ?? ""} site`, seed: 7 + (palCycle + 1) * 4 + 2 });
    const dir = generateDirections(pid, undefined, 3 + (dirCycle + 1) * 11, 6)[0];
    setPalCycle((c) => c + 1);
    setDirCycle((c) => c + 1);
    setChosenPalette(pal);
    setChosenDir(dir);
    setTimeout(() => buildSite(false, pal, dir, pid), 60);
  };

  /* ---------- live html for the workspace ---------- */
  const html = useMemo(() => {
    if (!spec) return null;
    const p = getPurpose(spec.purposeId);
    if (!p) return null;
    return buildSiteHtml({
      purpose: p,
      palette: spec.palette,
      knobs: spec.direction.spec,
      atoms: spec.direction.atoms,
      sections: spec.sections,
      seed: spec.seed,
    }).html;
  }, [spec]);

  useEffect(() => {
    if (!spec || !html) { setBuildMeta(null); return; }
    const names = spec.sections.filter((x) => x !== "nav" && x !== "footer");
    setBuildMeta({
      purposeLabel: getPurpose(spec.purposeId)?.label ?? "",
      sectionsOn: names.length,
      sectionNames: names.map((n) => SITE_SECTIONS.find((x) => x.id === n)?.label ?? n),
    });
  }, [spec, html, setBuildMeta]);
  useEffect(() => () => setBuildMeta(null), [setBuildMeta]);

  /* ================================================================
   * WORKSPACE
   * ================================================================ */
  if (spec && purpose && html) {
    const sectionOn = (id: SiteSection) => spec.sections.includes(id);
    const grade = audit ? audit.score : null;
    const toggle = (id: SiteSection) =>
      setSpec((s) => {
        if (!s) return s;
        const on = s.sections.includes(id);
        const order = SITE_SECTIONS.map((x) => x.id);
        const sections = on
          ? s.sections.filter((x) => x !== id)
          : [...s.sections, id].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return { ...s, sections };
      });
    const setPal = (p: Palette) => setSpec((s) => (s ? { ...s, palette: p, seed: s.seed } : s));
    const applyLook = (d: Direction) => setSpec((s) => (s ? { ...s, direction: d, seed: s.seed } : s));
    const exportHtml = () => {
      download(`hephaestus-${purpose.id}-${spec.seed}.html`, html, "text/html");
      say("site saved — open it in any browser");
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 58px)", minHeight: 470 }}>
        {/* toolbar */}
        <div className="row" style={{ justifyContent: "space-between", gap: 12, padding: "7px 14px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <button className="btn" style={{ fontSize: 10 }} onClick={() => { setSpec(null); setBuildMeta(null); }}>← change</button>
            <span style={{ fontSize: 13 }}>{purpose.label}</span>
            {grade !== null && (
              <span className="mono-sm" style={{ color: grade >= 82 ? "var(--ok)" : grade >= 70 ? "var(--warn)" : "var(--bad)" }}>
                palette {grade}/100
              </span>
            )}
            <span className="faint mono-sm">{spec.empty ? "hand-picked start" : "auto-composed"}</span>
            <button className="btn" style={{ fontSize: 10 }} onClick={() => setCedalionOpen(true)}>ask cedalion</button>
          </div>
          <div className="row gap-1">
            <button className="btn" style={{ fontSize: 10 }} onClick={() => setSpec({ ...spec, seed: spec.seed + 1 })}>↻ new copy</button>
            <button className="btn btn-primary" style={{ fontSize: 10 }} onClick={exportHtml}>export .html</button>
          </div>
        </div>

        <div className="ws">
          <div className="ws-stage">
            <iframe title="your live site" className="ws-frame" sandbox="allow-scripts" srcDoc={html} />
          </div>

          {/* right: the smart panel */}
          <div className="ws-panel" style={{ width: 330, minWidth: 280, maxWidth: "42vw" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="faint mono-sm" style={{ lineHeight: 1.6, borderLeft: "2px solid var(--accent)", paddingLeft: 8 }}>
                this is a real site — scroll it, click it, and change anything from here.
              </div>

              {/* sections */}
              <div>
                <div className="label" style={{ marginBottom: 6 }}>sections</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {SITE_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      className="ws-chip"
                      data-on={sectionOn(s.id)}
                      style={{ textAlign: "left", display: "flex", justifyContent: "space-between", fontSize: 9 }}
                      onClick={() => toggle(s.id)}
                    >
                      <span>{s.label}</span>
                      <span style={{ opacity: 0.55, fontSize: 8 }}>{sectionOn(s.id) ? "✓" : "·"}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* colours */}
              <div>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="label">colours</span>
                  <button
                    className="btn"
                    style={{ fontSize: 9, padding: "2px 7px" }}
                    onClick={() => {
                      const fresh = generatePalette({ prompt: `${purpose.label} ${purpose.moodId ?? ""} site`, seed: Math.floor(Math.random() * 1e6) + 1 });
                      setPal(fresh);
                      say("re-forged");
                    }}
                  >
                    ↻ re-forge all
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {spec.palette.swatches.map((sw) => (
                    <div key={sw.role} className="row" style={{ gap: 7, border: "1px solid var(--line-soft)", padding: "3px 7px" }}>
                      <input
                        type="color"
                        value={sw.hex}
                        onChange={(e) => {
                          const role = sw.role as Role;
                          setSpec((s) => (s ? { ...s, palette: { ...s.palette, swatches: s.palette.swatches.map((x) => (x.role === role ? { ...x, hex: e.target.value } : x)) } } : s));
                        }}
                        style={{ width: 24, height: 20, padding: 0, border: "1px solid var(--line)", cursor: "pointer" }}
                      />
                      <span className="mono-sm" style={{ width: 64, fontSize: 9, textTransform: "lowercase" }}>{sw.role}</span>
                      <span className="faint mono-sm" style={{ fontSize: 9 }}>{sw.hex}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* look */}
              <div>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="label">look</span>
                  <button className="btn" style={{ fontSize: 9, padding: "2px 7px" }} onClick={() => { setDirCycle((c) => c + 1); }}>more looks</button>
                </div>
                <div style={{ fontSize: 11, marginBottom: 4 }}>
                  {spec.direction.name} <span className="faint mono-sm">· {spec.direction.fit} fit</span>
                </div>
                <div className="faint mono-sm" style={{ fontSize: 9, lineHeight: 1.5, marginBottom: 8 }}>
                  {Object.values(spec.direction.atoms).map((a) => a.label).slice(0, 4).join(" · ")}
                </div>
                <div className="row gap-1" style={{ marginBottom: 4 }}>
                  <button className="btn" style={{ fontSize: 9, padding: "2px 7px" }} onClick={() => { const i = looks.findIndex((d) => d.id === spec.direction.id); applyLook(looks[(i + 1) % looks.length] ?? spec.direction); }}>← prev</button>
                  <button className="btn" style={{ fontSize: 9, padding: "2px 7px" }} onClick={() => { const i = looks.findIndex((d) => d.id === spec.direction.id); applyLook(looks[(i + looks.length - 1) % looks.length] ?? spec.direction); }}>next →</button>
                  <button className="btn" style={{ fontSize: 9, padding: "2px 7px" }} onClick={() => setSpec((s) => (s ? { ...s, seed: s.seed + 1 } : s))}>↻ shuffle copy</button>
                </div>
                <div className="row gap-1" style={{ marginTop: 7, flexWrap: "wrap" }}>
                  {looks.slice(0, 6).map((d) => (
                    <button key={d.id} className="ws-chip" data-on={spec.direction.id === d.id} style={{ fontSize: 8, padding: "2px 6px" }} onClick={() => applyLook(d)}>
                      {d.name}
                    </button>
                  ))}
                </div>
                <div className="row gap-1" style={{ marginTop: 9, flexWrap: "wrap" }}>
                  <span className="faint mono-sm" style={{ fontSize: 8, alignSelf: "center" }}>corners</span>
                  {CORNERS.map((c) => (
                    <button key={c} className="ws-chip" data-on={spec.direction.spec.radius === c} style={{ fontSize: 8, padding: "2px 6px" }} onClick={() => applyLook({ ...spec.direction, spec: { ...spec.direction.spec, radius: c } })}>
                      {c === 0 ? "sharp" : `${c}px`}
                    </button>
                  ))}
                </div>
                <div className="row gap-1" style={{ marginTop: 6, flexWrap: "wrap" }}>
                  <span className="faint mono-sm" style={{ fontSize: 8, alignSelf: "center" }}>font</span>
                  {FONTS.map((f) => (
                    <button key={f.id} className="ws-chip" data-on={spec.direction.spec.fontStack === f.stack} style={{ fontSize: 8, padding: "2px 6px" }} onClick={() => applyLook({ ...spec.direction, spec: { ...spec.direction.spec, fontStack: f.stack } })}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* footer actions */}
            <div style={{ borderTop: "1px solid var(--line)", padding: 9, display: "flex", flexDirection: "column", gap: 7 }}>
              <button className="btn btn-primary" style={{ width: "100%", fontSize: 11 }} onClick={exportHtml}>export this site (.html)</button>
              <div className="row gap-1">
                <button className="btn" style={{ flex: 1, fontSize: 9 }} onClick={() => { setSpec(null); setBuildMeta(null); }}>start over</button>
                <button className="btn" style={{ flex: 1, fontSize: 9 }} onClick={() => go("library")}>library</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================
   * STAGE — choose + build
   * ================================================================ */
  return (
    <div style={{ padding: "22px 22px 110px", maxWidth: 1180, margin: "0 auto" }}>
      <div className="label">build</div>
      <h1 style={{ fontSize: 30, fontWeight: 400, margin: "6px 0 2px", letterSpacing: "-0.01em" }}>
        {purpose ? `Build a ${purpose.label.toLowerCase()}.` : "What are you building?"}
      </h1>
      <p className="dim" style={{ fontSize: 12, margin: "0 0 22px", maxWidth: 560 }}>
        {purpose
          ? "Pick a palette and a look — or hit surprise and watch it compose itself. Then live-edit anything."
          : "Pick the thing you're making and we'll compose a real site around it."}
      </p>

      {/* ---- step 1: purpose ---- */}
      {!purpose && (
        <>
          <button className="btn btn-primary" style={{ padding: "10px 18px", marginBottom: 22, fontSize: 11 }} onClick={() => surprise()}>
            ✨ I can't decide — surprise me
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {PURPOSE_GROUPS.map((g) => (
              <div key={g}>
                <div className="faint mono-sm" style={{ marginBottom: 8, letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 10 }}>{g}</div>
                <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                  {PURPOSES.filter((x) => x.group === g).map((x) => (
                    <button key={x.id} onClick={() => pickPurpose(x.id)} className="btn" style={{ padding: "10px 16px", fontSize: 12, textTransform: "none", flexDirection: "column", alignItems: "flex-start", gap: 2, height: "auto" }}>
                      {x.label}
                      <span className="faint" style={{ fontSize: 9, fontWeight: 400 }}>{x.priorities[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- steps 2+3: palette, look, build ---- */}
      {purpose && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* palette */}
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <span className="label">1 · colours</span>
              <div className="row gap-1">
                <button className="btn" style={{ fontSize: 10 }} onClick={() => setPalCycle((c) => c + 1)}>↻ more palettes</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              {candidates4.map((p, i) => (
                <PaletteOption
                  key={`${p.id}-${palCycle}`}
                  p={p}
                  active={activePalette?.id === p.id}
                  big={i === 0}
                  onClick={() => setChosenPalette(p)}
                />
              ))}
            </div>
            {palettes.length > 0 && (
              <div className="row gap-1" style={{ marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="faint mono-sm" style={{ fontSize: 9 }}>or from your library:</span>
                {palettes.slice(0, 5).map((pl) => (
                  <button
                    key={pl.id}
                    className="row gap-1"
                    style={{ border: "1px solid var(--line)", padding: 2, cursor: "pointer" }}
                    title={pl.name}
                    onClick={() => setChosenPalette(pl)}
                  >
                    <span style={{ width: 60 }}><PaletteStrip p={pl} height={12} /></span>
                    <span className="faint mono-sm" style={{ fontSize: 8, paddingRight: 5 }}>{pl.name.slice(0, 12)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* look */}
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <span className="label">2 · look</span>
              <button className="btn" style={{ fontSize: 10 }} onClick={() => setDirCycle((c) => c + 1)}>↻ more looks</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
              {looks.map((d) => (
                <LookCard
                  key={`${d.id}-${dirCycle}`}
                  d={d}
                  palette={activePalette}
                  active={activeLook?.id === d.id}
                  onClick={() => setChosenDir(d)}
                />
              ))}
            </div>
          </div>

          {/* build CTA */}
          <div className="panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderWidth: 2 }}>
            <div style={{ flex: "1 1 300px", minWidth: 220 }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>
                {audit ? <>palette scores <b style={{ color: gradeColor(audit.score) }}>{audit.score}/100</b> — ready</> : "everything's ready"}
              </div>
              <div className="faint mono-sm">a real site with working nav, pricing & copy appears on the right. you can edit everything after.</div>
            </div>
            <div className="row gap-1" style={{ flexWrap: "wrap" }}>
              <button className="btn" style={{ padding: "11px 18px", fontSize: 11 }} onClick={() => setCedalionOpen(true)}>ask cedalion</button>
              <button className="btn" style={{ padding: "11px 18px", fontSize: 11 }} onClick={() => buildSite(true)}>empty start</button>
              <button className="btn btn-primary" style={{ padding: "14px 34px", fontSize: 14 }} onClick={() => buildSite(false)}>
                build my site →
              </button>
            </div>
          </div>

          <button className="faint mono-sm" style={{ alignSelf: "flex-start", fontSize: 10 }} onClick={() => pickPurpose(null)}>← different purpose</button>
        </div>
      )}
    </div>
  );

  function gradeColor(score: number) {
    return score >= 82 ? "var(--ok)" : score >= 70 ? "var(--warn)" : "var(--bad)";
  }
}

/* ---------- one palette option ---------- */
function PaletteOption({ p, active, onClick, big }: { p: Palette; active: boolean; onClick: () => void; big?: boolean }) {
  const audit = auditPalette(p);
  return (
    <button
      onClick={onClick}
      className="row"
      style={{
        border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
        background: active ? "var(--raise)" : "var(--surface)",
        padding: 4, gap: 8, textAlign: "left", alignItems: "stretch", height: big ? 64 : 48,
      }}
    >
      <div style={{ width: big ? 26 : 18, display: "flex", flexDirection: "column" }}>
        {p.swatches.map((s) => (
          <div key={s.role} style={{ flex: 1, background: s.hex }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
        <div style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
        <div className="faint mono-sm" style={{ fontSize: 9 }}>
          {audit.score}/100 {audit.grade} · {p.mode}
        </div>
      </div>
      {active && <span className="faint" style={{ marginLeft: "auto", alignSelf: "center", fontSize: 10 }}>✓</span>}
    </button>
  );
}

/* ---------- one look card ---------- */
function LookCard({ d, palette, active, onClick }: { d: Direction; palette: Palette | null; active: boolean; onClick: () => void }) {
  const hex = (r: string) => palette?.swatches.find((s) => s.role === r)?.hex ?? "#888";
  const r = d.spec.radius;
  const lineCol = hex("border");
  return (
    <button
      onClick={onClick}
      style={{
        border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
        background: active ? "var(--raise)" : "var(--surface)",
        padding: 10, textAlign: "left", display: "flex", flexDirection: "column", gap: 8, height: "100%",
      }}
    >
      {/* mini composition made from the palette + the direction's own tokens */}
      <div style={{ background: hex("background"), border: `1px solid ${lineCol}`, borderRadius: Math.max(2, Math.round(r / 3)), padding: 8, display: "flex", flexDirection: "column", gap: 5, minHeight: 84 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: hex("accent") }} />
          <span style={{ width: 30, height: 3, background: hex("text"), opacity: 0.7 }} />
          <span style={{ marginLeft: "auto", width: 16, height: 6, borderRadius: 2, background: hex("primary") }} />
        </div>
        <span style={{ width: "80%", height: 8, background: hex("text"), opacity: 0.85, borderRadius: 1, marginTop: 3 }} />
        <span style={{ width: "60%", height: 4, background: hex("muted"), borderRadius: 1 }} />
        <div style={{ display: "flex", gap: 3, marginTop: "auto" }}>
          {[hex("primary"), hex("secondary"), hex("accent")].map((c) => (
            <span key={c} style={{ width: 14, height: 10, borderRadius: 2, background: c, flex: 1 }} />
          ))}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 11 }}>{d.name}</span>
        <span className="mono-sm" style={{ fontSize: 9, color: d.fit >= 78 ? "var(--ok)" : d.fit >= 55 ? "var(--warn)" : "var(--bad)" }}>{d.fit} fit</span>
      </div>
      <div className="faint mono-sm" style={{ fontSize: 8, lineHeight: 1.4 }}>
        {Object.values(d.atoms).slice(0, 3).map((a) => a.label).join(" · ")}
      </div>
    </button>
  );
}
