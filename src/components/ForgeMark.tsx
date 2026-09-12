/**
 * The forge mark, on screen.
 *
 * Compact form on the dashboard (six colours, one tier, one line about where it came from); full form in
 * Settings → About, where every measurement and every input is laid out and the numbers can be changed on
 * purpose. Nothing here moves on its own: the mark is forged once and then it sits still.
 */
import { useState } from "react";
import { useApp } from "../store";
import { IDENTITY_ROLES, TIERS, keySigil } from "../engine/identity";
import type { Role } from "../engine/akmon";
import sigUrl from "../assets/signature.png";

/* ── pieces ──────────────────────────────────────────────────────────────────────────────────── */

function Swatches({ hexes, big }: { hexes: { role: string; hex: string; name: string }[]; big?: boolean }) {
  return (
    <div>
      <div className="row" style={{ border: "1px solid var(--line)", overflow: "hidden", borderRadius: 10 }}>
        {hexes.map((s) => (
          <span
            key={s.role}
            title={`${s.role} · ${s.hex}`}
            style={{ flex: 1, height: big ? 46 : 32, background: s.hex, borderRight: "1px solid var(--line-soft)" }}
          />
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {hexes.map((s) => (
          <span key={s.role} className="mono-sm faint" style={{ fontSize: 8.5, letterSpacing: ".04em" }}>
            {s.role} {s.hex}
          </span>
        ))}
      </div>
    </div>
  );
}

/** the band marks are colour glyphs, so they need an emoji-capable fallback: a plain mono font
 * renders them as empty boxes on machines that have no emoji font of their own */
export const GLYPH_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export function TierChip({ score, tier, mark }: { score: number; tier: string; mark: string }) {
  return (
    <span
      className="mono-sm"
      style={{
        fontSize: 9.5, letterSpacing: ".1em", padding: "3px 8px", border: "1px solid var(--line)",
        borderRadius: 999, color: "var(--accent)", whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontFamily: GLYPH_FONT }}>{mark}</span> {tier} · {score}/100
    </span>
  );
}

function Ladder({ score }: { score: number }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      {TIERS.map((t) => {
        const now = score >= t.min && score <= t.max;
        return (
          <div
            key={t.name}
            className="row"
            style={{
              gap: 10, padding: "7px 11px", alignItems: "baseline", borderBottom: "1px solid var(--line-soft)",
              background: now ? "var(--surface)" : "transparent",
              borderLeft: now ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            <span className="mono-sm" style={{ fontSize: 9, width: 46, flexShrink: 0 }}>
              {t.min}–{t.max}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: now ? 700 : 500, letterSpacing: ".04em", whiteSpace: "nowrap" }}>
              <span style={{ fontFamily: GLYPH_FONT }}>{t.mark}</span> {t.name}
            </span>
            <span className="faint mono-sm" style={{ fontSize: 8.5, lineHeight: 1.5 }}>{t.note}</span>
          </div>
        );
      })}
    </div>
  );
}

function Measurements({ components }: { components: { key: string; label: string; value: number; max: number; detail: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {components.map((c) => (
        <div key={c.key}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 11.5 }}>{c.label}</span>
            <span className="mono-sm" style={{ fontSize: 9.5, color: c.value === c.max ? "var(--ok)" : "var(--fg)" }}>
              {c.value}/{c.max}
            </span>
          </div>
          <div style={{ height: 3, background: "var(--line-soft)", borderRadius: 2, margin: "5px 0 4px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(c.value / c.max) * 100}%`, background: c.value === c.max ? "var(--ok)" : "var(--accent)" }} />
          </div>
          <div className="faint mono-sm" style={{ fontSize: 8.5, lineHeight: 1.5 }}>{c.detail}</div>
        </div>
      ))}
    </div>
  );
}

/** painted with the card's own text colour, so the signature reads on all six themes */
function Ink({ size = 1 }: { size?: number }) {
  return (
    <div
      role="img"
      aria-label="the founder's signature"
      style={{
        height: 40 * size, color: "currentColor",
        WebkitMaskImage: `url(${sigUrl})`, maskImage: `url(${sigUrl})`,
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }}
    />
  );
}

function FounderCard() {
  const mark = useApp((s) => s.mark);
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "16px 16px 14px", background: "var(--surface)", marginTop: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="label" style={{ marginBottom: 5 }}>the master's own set</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            {keySigil()} · carried over from the forge, where it measures{" "}
            <b>{mark?.score ?? 100}/100</b> — {mark?.tier.name.toLowerCase() ?? "divine forge"}.
          </div>
        </div>
        <div style={{ minWidth: 160, flex: "0 1 200px" }}>
          <Ink />
        </div>
      </div>
    </div>
  );
}

/* ── the card ────────────────────────────────────────────────────────────────────────────────── */

export default function ForgeMark({ full = false }: { full?: boolean }) {
  const { mark, identityBusy, founder, setIdentityConsent, applyMark, go } = useApp();
  const [tab, setTab] = useState<"mark" | "measure">("mark");

  if (!mark) {
    return (
      <div className="panel" style={{ padding: "16px 18px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span className="label">your forge mark</span>
          <span className="faint mono-sm" style={{ fontSize: 8.5 }}>once, then frozen</span>
        </div>
        <p className="faint" style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 12px" }}>
          The app can read where you are and what the sky is doing, once, and forge one palette from that
          plus the exact minute. Location goes to a keyless weather lookup and nowhere else; decline and the
          mark is forged from the clock alone.
        </p>
        <div className="row gap-1">
          <button
            className="btn btn-primary"
            style={{ fontSize: 10.5, padding: "7px 13px" }}
            disabled={identityBusy}
            onClick={() => void setIdentityConsent("granted")}
          >
            {identityBusy ? "reading…" : "read place + sky"}
          </button>
          <button className="btn" style={{ fontSize: 10.5, padding: "7px 13px" }} disabled={identityBusy} onClick={() => void setIdentityConsent("declined")}>
            clock only
          </button>
        </div>
      </div>
    );
  }

  const worn = IDENTITY_ROLES.map((r) => mark.palette.swatches.find((s) => s.role === (r as Role))!);
  const all = mark.palette.swatches;

  return (
    <div className="panel" style={{ padding: full ? "18px 20px 16px" : "16px 18px" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span className="row gap-1" style={{ alignItems: "baseline" }}>
          <span className="label">your forge mark</span>
          {mark.founder && <span className="mono-sm" style={{ fontSize: 8.5, color: "var(--accent)" }}>· founder set</span>}
        </span>
        <TierChip score={mark.score} tier={mark.tier.name} mark={mark.tier.mark} />
      </div>

      <Swatches hexes={worn} big={full} />
      {full && (
        <div style={{ marginTop: 10 }}>
          <Swatches hexes={all.filter((s) => !IDENTITY_ROLES.includes(s.role))} />
        </div>
      )}

      <div className="faint mono-sm" style={{ fontSize: 9, lineHeight: 1.7, marginTop: 11 }}>
        {mark.place === "coords" ? "place + clock" : "clock only"} · seed {mark.seed} ·{" "}
        {mark.tier.note.toLowerCase()} · {mark.components.filter((c) => c.value === c.max).length} of{" "}
        {mark.components.length} measurements at full marks
      </div>

      <div className="row gap-1" style={{ marginTop: 12 }}>
        <button className="btn" style={{ fontSize: 10, padding: "6px 12px" }} onClick={applyMark}>load into akmon</button>
        {full ? (
          <button className="btn" style={{ fontSize: 10, padding: "6px 12px" }} onClick={() => setTab(tab === "measure" ? "mark" : "measure")}>
            {tab === "measure" ? "hide the arithmetic" : "show the arithmetic"}
          </button>
        ) : (
          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "6px 12px" }} onClick={() => go("settings")}>
            details →
          </button>
        )}
      </div>

      {full && (
        <>
          <div className="row gap-1" style={{ marginTop: 14, borderBottom: "1px solid var(--line-soft)", paddingBottom: 8 }}>
            {([["mark", "the mark"], ["measure", "the measurements"]] as const).map(([id, label]) => (
              <button
                key={id}
                className="btn"
                style={{
                  fontSize: 9.5, padding: "4px 10px", border: "none", background: "transparent",
                  color: tab === id ? "var(--fg)" : "var(--fg-3)", borderBottom: tab === id ? "2px solid var(--accent)" : "2px solid transparent",
                  borderRadius: 0,
                }}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "mark" && <Ladder score={mark.score} />}
          {tab === "measure" && <Measurements components={mark.components} />}
        </>
      )}
      {full && founder && mark.founder && <FounderCard />}
    </div>
  );
}

