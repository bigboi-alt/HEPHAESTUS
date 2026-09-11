/**
 * TREND EXAMPLE — a small visual mock of each trend, generated from the
 * trend's own machine-readable rules (radius, border weight, mode bias…).
 * Pure CSS/DOM, deterministic, offline. Shows the *shape* of the trend,
 * not a screenshot of a real site.
 */

import type { CSSProperties } from "react";
import type { Trend } from "../data/trends";
import { generatePalette, hashString } from "../engine/akmon";

function palFor(id: string) {
  const p = generatePalette({ prompt: `${id} modern ui design`, seed: hashString(id) });
  const hex = (r: string) => p.swatches.find((s) => s.role === r)?.hex ?? "#888";
  return { bg: hex("background"), surface: hex("surface"), border: hex("border"), text: hex("text"), muted: hex("muted"), pri: hex("primary"), sec: hex("secondary"), acc: hex("accent") };
}

type K =
  | "bento" | "editorial" | "brutal" | "soft" | "dashboard" | "kinetic"
  | "glass" | "depth" | "micro" | "a11y" | "tokens" | "saturated"
  | "exp-nav" | "chart" | "retro" | "gamified" | "grid";

const KIND: Record<string, K> = {
  bento: "bento", "active-bento": "bento",
  "calm-ui": "editorial", bold: "editorial", sustainable: "editorial",
  "neo-brutalism": "brutal", "soft-brutalism": "soft",
  "dark-default": "dashboard", "quiet-trust": "dashboard",
  "kinetic-type": "kinetic", "liquid-glass": "glass",
  "spatial-depth": "depth", "functional-micro": "micro",
  "a11y-first": "a11y", "design-tokens": "tokens",
  "saturated-color": "saturated", "experimental-nav": "exp-nav",
  "data-storytelling": "chart", retrofuturism: "retro",
  "gamified-onboarding": "gamified", "grid-rules": "grid",
};

/** the composed catalogue encodes its parts in the id —
 *  `layout__accent__register` — so the mock can be chosen from what it *is*
 *  instead of from a lookup table that would need 1,200 rows. */
const REGISTER_KIND: Record<string, K> = {
  atrium: "soft", ledger: "chart", foundry: "brutal", vitrine: "depth", signal: "dashboard",
  marginalia: "editorial", atelier: "retro", kiosk: "micro", corridor: "kinetic", console: "tokens",
  nook: "gamified", archive: "grid",
};
const ACCENT_KIND: Record<string, K> = {
  glass: "glass", "hard-shadow": "brutal", elevated: "depth", duotone: "saturated",
  earth: "soft", neon: "kinetic", giant: "kinetic", mono: "tokens", serif: "editorial",
  scroll: "kinetic", spring: "depth", command: "exp-nav", a11y: "a11y",
};

function kindFor(id: string): K {
  if (KIND[id]) return KIND[id];
  const parts = id.split("__");
  if (parts.length < 3) return "editorial";
  const [, accent, register] = parts;
  for (const key of Object.keys(ACCENT_KIND)) if (accent.includes(key)) return ACCENT_KIND[key];
  return REGISTER_KIND[register] ?? "editorial";
}

export default function TrendExample({ t }: { t: Trend }) {
  const c = palFor(t.id);
  const kind: K = kindFor(t.id);
  const [rLo, rHi] = t.rules.radius ?? [8, 12];
  const r = Math.round((rLo + rHi) / 2);
  const bw = t.rules.borderWeight ? Math.max(1, t.rules.borderWeight[0]) : 1;
  const dark = t.rules.modeBias !== "light";
  const bg = dark ? c.bg : c.surface;
  const panelBg = dark ? c.surface : "#ffffff";
  const ink = dark ? c.text : c.text;
  const mute = c.muted;
  const line = `1px solid ${c.border}`;
  const hard = `${bw}px solid ${c.border}`;

  const base: CSSProperties = {
    background: bg, color: ink, borderRadius: r + 4, border: hard,
    overflow: "hidden", padding: 14, fontSize: 10, lineHeight: 1.45,
    fontFamily: "ui-monospace, monospace", minHeight: 168, position: "relative",
  };

  const P = ({ w = "auto", h = 8, c: col, style }: { w?: string | number; h?: number; c: string; style?: CSSProperties }) => (
    <span style={{ display: "block", width: w, height: h, background: col, borderRadius: Math.max(2, Math.floor(r / 3)), ...style }} />
  );

  const chipRow = (n = 4, colors: string[]) => (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ padding: "3px 7px", borderRadius: Math.max(2, r / 2), background: colors[i % colors.length], color: i % 2 ? "#fff" : "#111", fontSize: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
          item
        </span>
      ))}
    </div>
  );

  switch (kind) {
    case "bento":
      return (
        <div style={base}>
          <P w="46%" h={9} c={c.acc} style={{ marginBottom: 8 }} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridTemplateRows: "repeat(2, auto)", gap: 6 }}>
            <div style={{ gridRow: "span 2", background: panelBg, border: line, borderRadius: r, padding: 8, display: "flex", flexDirection: "column", gap: 6, minHeight: 104 }}>
              <P w="70%" h={14} c={c.pri} /><P w="90%" c={mute} /><P w="60%" c={mute} />
              <span style={{ alignSelf: "flex-start", marginTop: "auto", background: c.acc, color: "#fff", borderRadius: r / 2, padding: "2px 7px", fontSize: 8 }}>cta</span>
            </div>
            <div style={{ background: panelBg, border: line, borderRadius: r, padding: 6 }}><P w="80%" c={mute} /></div>
            <div style={{ background: panelBg, border: line, borderRadius: r, padding: 6 }}><P w="65%" c={c.acc} /></div>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 6 }}>{[c.pri, c.sec, c.acc].map((col) => <P key={col} style={{ flex: 1 }} c={col} />)}</div>
        </div>
      );
    case "editorial":
      return (
        <div style={{ ...base, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: c.acc }}>eyebrow · {t.name}</div>
          <div style={{ fontSize: 21, lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.02em" }}>A headline with room to breathe</div>
          <P w="88%" c={mute} /><P w="70%" c={mute} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}><P w={64} h={20} c={c.pri} /><P w={44} h={20} c="transparent" style={{ border: line }} /></div>
        </div>
      );
    case "brutal":
      return (
        <div style={{ ...base, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ border: `2px solid ${ink}`, borderRadius: 2, boxShadow: "3px 3px 0 " + ink, padding: 10, background: panelBg }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>hard truths</div>
            <div style={{ color: mute }}>no gradients, no mercy</div>
          </div>
          {chipRow(4, [c.acc, c.pri, "#ffffff", c.sec])}
          <span style={{ border: `2px solid ${ink}`, padding: "4px 10px", alignSelf: "flex-start", fontWeight: 700, background: c.acc, color: "#111", borderRadius: 2, boxShadow: "2px 2px 0 " + ink }}>click me</span>
        </div>
      );
    case "soft":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>soft brutalism</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {[c.sec, c.pri, c.acc, c.surface].map((col, i) => (
              <div key={i} style={{ background: col, borderRadius: r, border: `1.5px solid ${c.border}`, padding: 8, minHeight: 44 }}>
                <div style={{ color: i === 3 ? mute : "#222", fontSize: 8, fontWeight: 700 }}>pastel tile</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "dashboard":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 5, alignItems: "center", borderBottom: line, paddingBottom: 6 }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: c.acc }} />
            <span style={{ fontSize: 8, letterSpacing: "0.14em" }}>{t.name.toUpperCase()}</span>
            <span style={{ marginLeft: "auto", background: panelBg, border: line, borderRadius: r / 2, padding: "1px 7px", fontSize: 8, color: mute }}>⌘K</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
            {[c.acc, c.pri, c.sec, "#ffffff"].map((col, i) => (
              <div key={i} style={{ background: dark ? col + "22" : col + "18", border: line, borderRadius: r / 2, padding: 6 }}>
                <P w="70%" h={5} c={col} style={{ marginBottom: 3 }} /><P w="90%" h={4} c={mute} />
              </div>
            ))}
          </div>
          <div style={{ background: dark ? "#ffffff08" : "#00000006", border: line, borderRadius: r / 2, flex: 1, padding: 8, display: "flex", alignItems: "flex-end", gap: 4 }}>
            {[28, 44, 33, 62, 48, 72, 55, 84].map((hh, i) => (
              <span key={i} style={{ flex: 1, height: hh, background: i === 7 ? c.acc : c.pri, opacity: 0.85, borderRadius: 2 }} />
            ))}
          </div>
        </div>
      );
    case "kinetic": {
      const word = "MOMENTUM";
      return (
        <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>
            {word.split("").map((ch, i) => (
              <span key={i} style={{ display: "inline-block", animation: `keK 1.2s cubic-bezier(.2,.9,.3,1) ${i * 0.05}s both`, color: i % 3 === 0 ? c.acc : ink }}>{ch}</span>
            ))}
          </div>
          <P w="55%" c={mute} />
          <style>{`@keyframes keK { from { transform: translateY(.9em); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        </div>
      );
    }
    case "glass":
      return (
        <div style={{ ...base, background: "linear-gradient(120deg, " + c.pri + "55, " + c.acc + "44, " + c.sec + "55)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.32)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.5)", borderRadius: 10, padding: 10, boxShadow: "0 8px 24px -10px rgba(0,0,0,.35)" }}>
              <P w="70%" h={7} c="#fff" style={{ marginBottom: 6, opacity: .9 }} /><P w="90%" h={5} c="#ffffffb0" />
            </div>
          ))}
        </div>
      );
    case "depth":
      return (
        <div style={{ ...base, padding: 16 }}>
          <div style={{ background: c.pri, borderRadius: r + 2, padding: 16, transform: "rotate(-3deg)", position: "absolute", inset: 12, opacity: .16 }} />
          <div style={{ background: c.sec, borderRadius: r, padding: 16, transform: "rotate(1.5deg)", position: "absolute", inset: 10, opacity: .28 }} />
          <div style={{ position: "relative", background: panelBg, border: line, borderRadius: r, padding: 14, boxShadow: "0 22px 44px -18px " + c.pri + "aa", minHeight: 120 }}>
            <P w="50%" h={10} c={c.acc} style={{ marginBottom: 6 }} /><P w="82%" c={mute} /><P w="66%" c={mute} />
            <span style={{ position: "absolute", right: 12, bottom: 10, background: c.acc, borderRadius: "50%", width: 26, height: 26, display: "grid", placeItems: "center", color: "#fff", fontSize: 12 }}>↗</span>
          </div>
        </div>
      );
    case "micro":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
          <P w="75%" c={ink} />
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ background: c.acc, color: "#fff", borderRadius: r / 2, padding: "5px 10px", fontSize: 9, fontWeight: 700, boxShadow: "0 3px 0 " + c.acc + "88", transition: "transform .12s" }}>save ✓</span>
            <span style={{ border: line, borderRadius: r / 2, padding: "5px 10px", fontSize: 9, color: mute }}>undo</span>
          </div>
          <div style={{ color: mute, fontSize: 8 }}>micro-feedback on every action — 120ms, meaningful</div>
        </div>
      );
    case "a11y":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <span style={{ background: c.acc, color: "#fff", borderRadius: r / 2, padding: "4px 9px", fontSize: 10, fontWeight: 800 }}>Aa</span>
            <div><div style={{ fontSize: 11, fontWeight: 700 }}>7:1 text contrast</div><div style={{ color: mute, fontSize: 8 }}>WCAG AAA on this background</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 5 }}>
            <div style={{ background: "#111", color: "#fff", padding: 6, borderRadius: r / 2, fontSize: 8 }}>focus ring always visible</div>
            <div style={{ background: c.acc, color: "#111", padding: 6, borderRadius: r / 2, fontSize: 8 }}>never colour alone</div>
          </div>
          <div style={{ border: "2px dashed " + c.acc, borderRadius: r / 2, padding: 6, fontSize: 8, color: mute }}>▸ every control ≥ 44×44px</div>
        </div>
      );
    case "tokens":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: mute }}>design tokens</div>
          {[["radius", "8px"], ["space", "4px"], ["text", c.text.slice(0, 7)], ["accent", c.acc.slice(0, 7)], ["font", "inter"]].map(([k, v]) => (
            <div key={k} className="row" style={{ justifyContent: "space-between", border: line, borderRadius: r / 2, padding: "4px 8px" }}>
              <span style={{ color: mute, fontSize: 8 }}>{k}</span>
              <span style={{ fontSize: 8, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      );
    case "saturated":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: ink }}>dopamine, on purpose</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {[c.acc, "#ff2e88", "#9b5cff", c.pri, c.sec, "#ffd400", "#00c2a8"].map((col) => (
              <span key={col} style={{ width: 30, height: 30, borderRadius: r, background: col, border: "1px solid rgba(0,0,0,.08)" }} />
            ))}
          </div>
          <P w="55%" c={c.acc} />
        </div>
      );
    case "exp-nav":
      return (
        <div style={{ ...base, padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: 10, borderBottom: hard, background: panelBg }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: c.acc }} />
            <span style={{ marginLeft: "auto", fontWeight: 700, transform: "rotate(-2deg)", fontSize: 11 }}>playful()</span>
            <span style={{ fontSize: 8, color: mute }}>← tilt me</span>
          </div>
          <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <P w="70%" h={16} c={ink} style={{ marginBottom: 6, transform: "rotate(-1.5deg)" }} /><P w="46%" c={mute} style={{ transform: "rotate(1deg)" }} />
          </div>
          <div style={{ display: "flex", gap: 5, padding: 8, borderTop: line, background: panelBg }}>
            {["01 home", "02 work", "03 about"].map((x) => <span key={x} style={{ border: line, borderRadius: r / 2, padding: "2px 6px", fontSize: 8, color: mute }}>{x}</span>)}
          </div>
        </div>
      );
    case "chart":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 700 }}>signals, narrated</span>
            <span style={{ fontSize: 8, color: c.acc, border: "1px solid " + c.acc + "55", borderRadius: r / 2, padding: "1px 6px" }}>+34% this week</span>
          </div>
          <div style={{ background: dark ? "#ffffff10" : "#00000008", borderRadius: r / 2, padding: 10, display: "flex", alignItems: "flex-end", gap: 4, minHeight: 92 }}>
            {[34, 52, 44, 66, 58, 82, 100].map((hh, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <span style={{ display: "block", height: hh * 0.8, background: i === 6 ? c.acc : c.pri, borderRadius: 2, opacity: i === 6 ? 1 : .6 }} />
              </div>
            ))}
          </div>
          <div style={{ color: mute, fontSize: 8 }}>one chart that tells the whole story — with the insight written under it</div>
        </div>
      );
    case "retro":
      return (
        <div style={{ ...base, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: c.pri + "22", border: hard, borderRadius: r, padding: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".08em" }}>RETRO·FUTURE</div>
            <div style={{ color: mute, fontSize: 8 }}>terminal green on plasma grids</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[c.acc, c.sec].map((col) => <span key={col} style={{ width: 34, height: 34, borderRadius: 6, background: col, border: "2px solid #111" }} />)}
          </div>
          <P w="70%" c={mute} />
        </div>
      );
    case "gamified":
      return (
        <div style={{ ...base, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 700 }}>day 3 of your streak 🔥</span>
            <span style={{ fontSize: 8, color: mute }}>2 of 5 done</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i <= 2 ? c.acc : dark ? "#ffffff18" : "#00000012" }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[["✓", "choose a goal"], ["✓", "first five minutes"], ["○", "share the win"]].map(([m, l]) => (
              <div key={l} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 8, color: m === "○" ? mute : ink }}>
                <span style={{ width: 13, height: 13, borderRadius: "50%", border: m === "○" ? "1px dashed " + c.border : "1px solid " + c.acc, background: m === "✓" ? c.acc : "none", display: "grid", placeItems: "center", fontSize: 8 }}>{m}</span>
                {l}
              </div>
            ))}
          </div>
        </div>
      );
    case "grid":
      return (
        <div style={{ ...base, padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: 44, gap: 0, backgroundImage: `linear-gradient(${c.border} 1px, transparent 1px), linear-gradient(90deg, ${c.border} 1px, transparent 1px)`, backgroundSize: "50% 50%" }}>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", padding: "0 10px", borderBottom: hard, fontSize: 9, fontWeight: 800 }}>visible grid, honest corners</div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", padding: 8, borderBottom: i < 2 ? line : "none", borderRight: i % 2 === 0 ? line : "none", fontSize: 8, color: mute }}>
                <span style={{ width: 7, height: 7, background: [c.pri, c.acc, c.sec, c.acc][i], borderRadius: 1, marginRight: 6 }} /> cell {i + 1}
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return <div style={base}>…</div>;
  }
}
