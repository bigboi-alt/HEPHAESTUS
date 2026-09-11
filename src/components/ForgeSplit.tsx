/**
 * AKMON · two families, two visual languages
 *
 * The old layout gave `surfaces` and `voice` the same grid of swatch cards, so
 * the one thing a palette actually teaches you — that these two families do
 * different jobs — was invisible. Cards are the right shape for voice (you edit
 * a brand colour, you compare its contrast) and the wrong shape for surfaces
 * (a surface is not a colour, it is a level of light).
 *
 * So: voice keeps the cards. Surfaces become a stack of planes you can see the
 * depth in, annotated with ΔE — the measured distance between one level and the
 * next. And between them sits a fragment of a real page, painted twice, so the
 * difference is something you look at rather than something you're told.
 *
 * Everything here is colour maths on the palette in front of you. No model.
 */
import { useState } from "react";
import { contrastRatio, deltaE, hexToOklch, readableOn, round } from "../engine/color";

/** `deltaE` here is raw OKLab distance, where ~0.02 is the just-noticeable limit.
 *  Designers read ΔE on a 0–100 scale, so everything in this file speaks in
 *  “steps”: the same number ×100. <2 = nobody can see it, 2–6 = quiet, >8 = a
 *  real step in light. */
const step = (a: string, b: string) => round(deltaE(a, b) * 100, 1);
import type { Palette, Role } from "../engine/akmon";

type Plane = { role: Role; hex: string; name: string; locked: boolean };

/* ─────────────────────────────────────────────────────────── the fragment ── */

/** What each colour is *for*, in the same words every time, so the two families
 *  can't be confused for one another. */
const JOBS: Record<Role, string> = {
  background: "the room everything sits in",
  surface: "a plane lifted off the room",
  border: "the edge of a plane",
  text: "what you actually read",
  muted: "secondary words",
  primary: "the one thing to click, on every page",
  secondary: "the supporting voice — links, tags, quiet brand",
  accent: "a spark. rare, or it stops meaning anything",
};

type Paint = {
  page: string; panel: string; line: string;
  head: string; body: string; btn: string; btnFg: string; link: string; rule: string;
};

/**
 * The same page, painted twice: once correctly, once with the two families
 * confused. Everything in the right-hand panel is the same geometry and the
 * same words — only the assignment of colour to job has changed, and that is
 * the whole difference between voice and surfaces.
 */
export function VoiceSurfaceSplit({
  palette,
  shown,
}: {
  palette: Palette;
  shown: (hex: string) => string;
}) {
  const [mistake, setMistake] = useState<"loud" | "silent" | "swap">("silent");
  const raw = (r: Role) => palette.swatches.find((s) => s.role === r)!.hex;
  const s = (r: Role) => shown(raw(r));

  const correct: Paint = {
    page: s("background"),
    panel: s("surface"),
    line: s("border"),
    head: s("text"),
    body: s("muted"),
    btn: s("primary"),
    btnFg: readableOn(raw("primary")),
    link: s("secondary"),
    rule: s("accent"),
  };

  const wrong: Paint =
    mistake === "silent"
      ? { ...correct, btn: s("surface"), btnFg: s("text"), link: s("muted"), rule: s("border") }
      : mistake === "loud"
        ? {
            ...correct,
            page: s("primary"),
            panel: s("secondary"),
            line: s("accent"),
            head: s("accent"),
            body: readableOn(raw("primary")),
            btn: s("accent"),
            btnFg: readableOn(raw("accent")),
            link: readableOn(raw("secondary")),
            rule: s("primary"),
          }
        : {
            ...correct,
            page: s("surface"),
            panel: s("primary"),
            line: s("secondary"),
            head: s("accent"),
            body: readableOn(raw("primary")),
            btn: s("background"),
            btnFg: s("muted"),
            link: s("border"),
            rule: s("surface"),
          };

  const readouts = (pt: Paint) => {
    const button = contrastRatio(pt.btnFg, pt.btn);
    const heading = contrastRatio(pt.head, pt.page);
    return (
      <div className="row gap-2" style={{ marginTop: 9, flexWrap: "wrap" }}>
        <span className="mono-sm" style={{ fontSize: 8.5, color: button >= 4.5 ? "var(--ok)" : "var(--bad)" }}>
          button text {round(button, 2)}:1
        </span>
        <span className="mono-sm" style={{ fontSize: 8.5, color: heading >= 4.5 ? "var(--ok)" : "var(--bad)" }}>
          heading {round(heading, 2)}:1
        </span>
        <span className="mono-sm" style={{ fontSize: 8.5, color: pt.panel === pt.page ? "var(--bad)" : "var(--fg-faint)" }}>
          {pt.panel === pt.page ? "no plane at all" : `planes are ${step(pt.panel, pt.page)} steps apart`}
        </span>
      </div>
    );
  };

  const draw = (pt: Paint, key: string) => (
    <div key={key} style={{ border: "1px solid var(--line)", background: pt.page, padding: 13, minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 11, borderBottom: `1px solid ${pt.line}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "-.01em", color: pt.head }}>ember&amp;oak</span>
        <span style={{ fontSize: 8.5, padding: "4px 9px", background: pt.btn, color: pt.btnFg, border: `1px solid ${pt.line}` }}>shop</span>
      </div>
      <div style={{ fontSize: 15.5, lineHeight: 1.22, fontWeight: 600, letterSpacing: "-.015em", color: pt.head, marginBottom: 6 }}>
        Furniture that survives <span style={{ color: pt.rule }}>three moves</span>.
      </div>
      <div style={{ fontSize: 9.5, lineHeight: 1.6, color: pt.body, marginBottom: 11 }}>
        Solid oak, mortise and tenon, no particle board anywhere in the build. Delivered flat, assembled in ten minutes.
      </div>
      <div className="row gap-1" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 9.5, padding: "7px 13px", background: pt.btn, color: pt.btnFg, border: `1px solid ${pt.line}` }}>see the range</span>
        <span style={{ fontSize: 9.5, color: pt.link, textDecoration: "underline", textUnderlineOffset: 3 }}>how it's built</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[["Joinery", "mortise + tenon"], ["Finish", "hard-wax oil"], ["Delivery", "flat-packed"]].map(([l, h]) => (
          <div key={l} style={{ border: `1px solid ${pt.line}`, background: pt.panel, padding: "7px 8px", minWidth: 0 }}>
            <div style={{ fontSize: 9, color: pt.head }}>{l}</div>
            <div style={{ fontSize: 8, color: pt.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const NOTES = {
    silent: "voice removed. the page is calm, correct and completely forgettable — this is what “minimal” turns into by accident.",
    loud: "voice on every plane. contrast on the button, none on the meaning: nothing is loud because everything is.",
    swap: "the two families swapped jobs. the button is painted with the page colour, so the thing you must click has vanished.",
  } as const;

  return (
    <div style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <span className="label">voice vs surfaces</span>
          <div style={{ fontSize: 12.5, marginTop: 5, lineHeight: 1.5 }}>
            surfaces carry the page. voice carries the meaning — and only three colours are allowed to.
          </div>
        </div>
        <div className="row gap-1" style={{ flexShrink: 0, flexWrap: "wrap" }}>
          <span className="label" style={{ fontSize: 8.5, alignSelf: "center" }}>show me the mistake</span>
          {([["silent", "no voice"], ["loud", "voice everywhere"], ["swap", "swap the families"]] as const).map(([id, label]) => (
            <button key={id} className="btn" data-active={mistake === id} style={{ fontSize: 10, padding: "4px 9px" }} onClick={() => setMistake(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 7 }}>
            <span className="label" style={{ fontSize: 8.5 }}>as assigned</span>
            <span className="faint mono-sm" style={{ fontSize: 8.5 }}>A</span>
          </div>
          {draw(correct, "a")}
          {readouts(correct)}
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 7 }}>
            <span className="label" style={{ fontSize: 8.5, color: "var(--bad)" }}>
              {mistake === "silent" ? "voice removed" : mistake === "loud" ? "voice everywhere" : "families swapped"}
            </span>
            <span className="faint mono-sm" style={{ fontSize: 8.5 }}>B</span>
          </div>
          {draw(wrong, "b")}
          {readouts(wrong)}
        </div>
      </div>

      <div style={{ marginTop: 11, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
        <span className="faint" style={{ fontSize: 10, lineHeight: 1.6 }}>{NOTES[mistake]}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── the surfaces, as planes ── */

/**
 * Surfaces read as depth or they don't read at all. ΔE is the perceptual distance
 * between two colours — under ~1.5 nobody can tell them apart, over ~6 the layer
 * is unmissable. So the card grid is replaced by a stack, and the number between
 * each pair of layers is the whole point.
 */
export function SurfacePlanes({
  palette,
  shown,
  onHex,
  onLock,
}: {
  palette: Palette;
  shown: (hex: string) => string;
  onHex: (r: Role, hex: string) => void;
  onLock: (r: Role) => void;
}) {
  const get = (r: Role): Plane => {
    const f = palette.swatches.find((s) => s.role === r);
    return { role: r, hex: f?.hex ?? "#000000", name: f?.name ?? r, locked: !!f?.locked };
  };
  const bg = get("background");
  const surface = get("surface");
  const border = get("border");

  /** planes are painted with themselves; inks are painted on their plane, because
   *  an ink on a big block of itself tells you nothing about how it reads */
  const planes: { s: Plane; over: Plane | null; job: string; inset: number }[] = [
    { s: bg, over: null, job: "the room everything sits in", inset: 0 },
    { s: surface, over: bg, job: "a plane lifted off the room — cards, panels, rows", inset: 1 },
    { s: border, over: surface, job: "the edge of a plane. hairline, not decoration", inset: 2 },
  ];
  const inks: { s: Plane; over: Plane; job: string; size: number; weight: number }[] = [
    { s: get("text"), over: surface, job: "what you actually read", size: 13, weight: 600 },
    { s: get("muted"), over: surface, job: "secondary words. present, never competing", size: 11, weight: 400 },
  ];

  const flatPlanes = planes.filter((r) => r.over && step(r.s.hex, r.over.hex) < 2);
  const weakInk = inks.filter((r) => contrastRatio(r.s.hex, r.over.hex) < 4.5);
  const verdict = (() => {
    if (flatPlanes.length && weakInk.length)
      return `two problems: ${flatPlanes.map((r) => r.s.role).join(" and ")} read as the same colour as the layer under them, and ${weakInk.map((r) => r.s.role).join(", ")} falls below 4.5:1 on ${weakInk[0].over.role}.`;
    if (flatPlanes.length)
      return `${flatPlanes.map((r) => r.s.role).join(" and ")} is ${flatPlanes.map((r) => step(r.s.hex, r.over!.hex)).join(", ")} steps off the layer below — under 2 steps nobody sees a plane at all. raise or lower its L by ~0.03.`;
    if (weakInk.length)
      return weakInk.map((r) => `${r.s.role} reads at ${round(contrastRatio(r.s.hex, r.over.hex), 2)}:1 on ${r.over.role} — under 4.5:1, so it fails at small sizes. darken or lighten one of the two.`).join(" ");
    return `planes hold: surface is ${step(surface.hex, bg.hex)} steps off the background, border ${step(border.hex, surface.hex)} off surface; text keeps ${round(contrastRatio(get("text").hex, surface.hex), 1)}:1. the structure is sound.`;
  })();

  const edit = (p: Plane, onInk: string) => (
    <div className="row gap-1" style={{ flexShrink: 0 }}>
      <input
        type="color"
        value={p.hex}
        onChange={(e) => onHex(p.role, e.target.value)}
        title={`pick ${p.role}`}
        style={{ width: 20, height: 18, padding: 0, border: `1px solid ${onInk}`, background: "transparent", cursor: "pointer" }}
      />
      <button
        className="btn"
        style={{ fontSize: 9, padding: "2px 6px", borderColor: "transparent", color: p.locked ? "var(--accent)" : onInk, opacity: p.locked ? 1 : 0.6 }}
        title={p.locked ? "locked — kept through regenerations" : `lock ${p.role}`}
        onClick={() => onLock(p.role)}
      >
        {p.locked ? "locked" : "lock"}
      </button>
    </div>
  );

  return (
    <div style={{ border: "1px solid var(--line)", background: "var(--surface)" }}>
      <div className="row" style={{ justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--line-soft)", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span className="label">surfaces · the planes</span>
          <div className="faint" style={{ fontSize: 10.5, marginTop: 4 }}>
            not colours — levels of light. the number on the right is how far apart two layers actually are.
          </div>
        </div>
        <span className="faint mono-sm" style={{ fontSize: 8.5 }}>under 2 steps = invisible · 2–6 = quiet · over 8 = a real step</span>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {planes.map(({ s, over, job, inset }) => {
          const ink = readableOn(s.hex);
          const d = over ? step(s.hex, over.hex) : 0;
          const flat = over ? d < 2 : false;
          return (
            <div
              key={s.role}
              className="row"
              style={{
                gap: 12, padding: "9px 11px", background: shown(s.hex),
                border: `1px solid ${shown(border.hex)}`, marginLeft: inset * 12,
                transition: "background 140ms",
              }}
            >
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div className="row gap-1" style={{ alignItems: "baseline" }}>
                  <span className="label" style={{ fontSize: 9, color: ink }}>{s.role}</span>
                  <span style={{ fontSize: 9.5, color: ink, opacity: 0.7 }}>{job}</span>
                </div>
                <div className="row gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
                  <span className="mono-sm" style={{ fontSize: 10, color: ink }}>{shown(s.hex).toUpperCase()}</span>
                  <span className="mono-sm" style={{ fontSize: 9, color: ink, opacity: 0.6 }}>L{round(hexToOklch(s.hex).l, 2)}</span>
                  {over && (
                    <span
                      className="mono-sm"
                      style={{
                        fontSize: 9, padding: "1px 5px",
                        color: flat ? "#fff" : ink,
                        background: flat ? "var(--bad)" : "transparent",
                        opacity: flat ? 1 : 0.62,
                      }}
                    >
                      {d} steps from {over.role}
                    </span>
                  )}
                  {over && (
                    <span title={`the layer under ${s.role}, then ${s.role}`} style={{ display: "flex", width: 46, height: 22, border: `1px solid ${ink}22` }}>
                      <span style={{ flex: 1, background: shown(over.hex) }} />
                      <span style={{ flex: 1, background: shown(s.hex) }} />
                    </span>
                  )}
                </div>
              </div>
              {edit(s, ink)}
            </div>
          );
        })}

        {inks.map(({ s, over, job, size, weight }) => {
          const cr = contrastRatio(s.hex, over.hex);
          const okRatio = cr >= 4.5;
          return (
            <div
              key={s.role}
              className="row"
              style={{ gap: 12, padding: "9px 11px", background: shown(over.hex), border: `1px solid ${shown(border.hex)}`, marginLeft: 36 }}
            >
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div className="row gap-1" style={{ alignItems: "baseline" }}>
                  <span className="label" style={{ fontSize: 9, color: shown(over.hex) === shown(bg.hex) ? readableOn(over.hex) : readableOn(over.hex) }}>{s.role}</span>
                  <span style={{ fontSize: 9.5, color: readableOn(over.hex), opacity: 0.7 }}>{job}</span>
                </div>
                {/* the colour doing its actual job, not a block of itself */}
                <div style={{ fontSize: size, fontWeight: weight, lineHeight: 1.35, color: shown(s.hex), margin: "5px 0 3px", letterSpacing: "-.01em" }}>
                  Furniture that survives three moves — delivered flat.
                </div>
                <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                  <span className="mono-sm" style={{ fontSize: 10, color: readableOn(over.hex) }}>{shown(s.hex).toUpperCase()}</span>
                  <span className="mono-sm" style={{ fontSize: 9, color: readableOn(over.hex), opacity: 0.6 }}>L{round(hexToOklch(s.hex).l, 2)}</span>
                  <span
                    className="mono-sm"
                    title={`measured against ${over.role}`}
                    style={{ fontSize: 9, padding: "1px 5px", color: okRatio ? "var(--ok)" : cr >= 3 ? "var(--warn)" : "var(--bad)", background: "var(--bg)", border: "1px solid var(--line)" }}
                  >
                    {round(cr, 2)}:1 on {over.role} · {okRatio ? "reads" : "too quiet"}
                  </span>
                </div>
              </div>
              {edit(s, readableOn(over.hex))}
            </div>
          );
        })}
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line-soft)" }}>
        <span className="mono-sm" style={{ fontSize: 9, color: flatPlanes.length || weakInk.length ? "var(--warn)" : "var(--fg-dim)", lineHeight: 1.6 }}>
          {verdict}
        </span>
      </div>
    </div>
  );
}

export const VOICE_JOBS = JOBS;
