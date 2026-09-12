/**
 * The forge mark, on screen.
 *
 * Compact form on the dashboard (six colours, one tier, one line about where it came from); full form in
 * Settings → About, where every measurement and every input is laid out and the numbers can be changed on
 * purpose. Nothing here moves on its own: the mark is forged once and then it sits still.
 */
import { useMemo, useState } from "react";
import { useApp } from "../store";
import {
  forgeMark, isLeapYear, IDENTITY_ROLES, TIERS, keySigil,
  type SkyReading,
} from "../engine/identity";
import type { Role } from "../engine/akmon";
import sigUrl from "../assets/signature.png";

const GITHUB = "https://github.com/bigboi-alt";

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

/**
 * An external link with a way out if the shell refuses to open one: the address is always printed, and
 * clicking tries the browser first, then the clipboard.
 */
function LinkOut({ href }: { href: string }) {
  const say = useApp((s) => s.say);
  const [copied, setCopied] = useState(false);
  async function open(e: React.MouseEvent) {
    e.preventDefault();
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (w) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      say("link copied");
    } catch {
      say("copy it from the line below");
    }
  }
  return (
    <span className="row gap-1" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
      <a href={href} onClick={open} style={{ fontSize: 11.5, color: "var(--accent)", textDecoration: "underline" }}>
        {copied ? "copied ✓" : "github.com/bigboi-alt"}
      </a>
      <span className="mono-sm faint" style={{ fontSize: 8.5, userSelect: "all" }}>{href}</span>
    </span>
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
        <div style={{ minWidth: 190, flex: "0 1 260px" }}>
          <Ink />
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 4 }}>
            <LinkOut href={GITHUB} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── the editable numbers ──────────────────────────────────────────────────────────────────────── */

type Field = { key: keyof SkyReading; label: string; hint: string };

const FIELDS: Field[] = [
  { key: "lat", label: "latitude", hint: "−90 … 90" },
  { key: "lon", label: "longitude", hint: "−180 … 180"},
  { key: "year", label: "year", hint: ""},
  { key: "dayOfYear", label: "day of year", hint: "1 … 366"},
  { key: "hour", label: "hour", hint: "0 … 23"},
  { key: "minute", label: "minute", hint: "0 … 59"},
  { key: "second", label: "second", hint: "0 … 59"},
  { key: "ms", label: "millisecond", hint: "0 … 999"},
  { key: "weatherCode", label: "weather code", hint: "blank = no sky read"},
  { key: "temperature", label: "temperature °C", hint: "blank = none"},
  { key: "humidity", label: "humidity %", hint: "blank = none"},
];

const num = (v: string, lo: number, hi: number, fallback: number) => {
  const t = v.trim();
  if (!t) return fallback;
  const n = Number(t);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

function MarkEditor({ reading }: { reading: SkyReading }) {
  const adoptMark = useApp((st) => st.adoptMark);
  const say = useApp((st) => st.say);
  const currentSeed = useApp((st) => st.mark?.seed);
  const asDraft = (r: SkyReading) => ({
    lat: String(r.lat), lon: String(r.lon), year: String(r.year),
    dayOfYear: String(r.dayOfYear), hour: String(r.hour), minute: String(r.minute),
    second: String(r.second), ms: String(r.ms),
    weatherCode: r.weatherCode == null ? "" : String(r.weatherCode),
    temperature: r.temperature == null ? "" : String(r.temperature),
    humidity: r.humidity == null ? "" : String(r.humidity),
  });
  // seeded from the reading on mount; the parent keys this component by mark, so adopting a new mark
  // remounts it with the new numbers rather than syncing state in an effect
  const [draft, setDraft] = useState<Record<string, string>>(() => asDraft(reading));
  const [place, setPlace] = useState<SkyReading["place"]>(reading.place);

  const next = useMemo<SkyReading>(() => ({
    ...reading,
    place,
    lat: num(draft.lat ?? "", -90, 90, 0),
    lon: num(draft.lon ?? "", -180, 180, 0),
    year: Math.round(num(draft.year ?? "", 1900, 2200, reading.year)),
    dayOfYear: Math.round(num(draft.dayOfYear ?? "", 1, 366, 1)),
    hour: Math.round(num(draft.hour ?? "", 0, 23, 0)),
    minute: Math.round(num(draft.minute ?? "", 0, 59, 0)),
    second: Math.round(num(draft.second ?? "", 0, 59, 0)),
    ms: Math.round(num(draft.ms ?? "", 0, 999, 0)),
    weatherCode: (draft.weatherCode ?? "").trim() === "" ? null : Math.round(num(draft.weatherCode ?? "", 0, 99, 0)),
    temperature: (draft.temperature ?? "").trim() === "" ? null : num(draft.temperature ?? "", -60, 60, 0),
    humidity: (draft.humidity ?? "").trim() === "" ? null : num(draft.humidity ?? "", 0, 100, 0),
  }), [reading, draft, place]);

  const preview = useMemo(() => forgeMark(next), [next]);
  const same = preview.seed === currentSeed;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row gap-1" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 9 }}>
        <span className="row gap-1" style={{ alignItems: "baseline" }}>
          <span className="label">the ten numbers</span>
          <span className="faint mono-sm" style={{ fontSize: 8.5 }}>
            {isLeapYear(next.year) ? "leap year" : "common year"} · {next.tz}
          </span>
        </span>
        <span className="row gap-1">
          {(["coords", "clock"] as const).map((p) => (
            <button
              key={p}
              className={`btn ${place === p ? "btn-primary" : ""}`}
              style={{ fontSize: 9.5, padding: "4px 9px" }}
              onClick={() => setPlace(p)}
              title={p === "coords" ? "forge from the place as well as the time" : "forge from the clock only"}
            >
              {p === "coords" ? "place + clock" : "clock only"}
            </button>
          ))}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        {FIELDS.map((f) => (
          <label key={String(f.key)} style={{ display: "block" }}>
            <span className="faint mono-sm" style={{ fontSize: 8, letterSpacing: ".08em", display: "block", marginBottom: 3 }}>
              {f.label.toUpperCase()}{f.hint ? ` · ${f.hint}` : ""}
            </span>
            <input
              className="input"
              style={{ fontSize: 11, padding: "5px 8px", width: "100%" }}
              value={draft[String(f.key)] ?? ""}
              inputMode="decimal"
              onChange={(e) => setDraft((d) => ({ ...d, [String(f.key)]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      <div style={{ marginTop: 13 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
          <span className="label">this would give</span>
          <TierChip score={preview.score} tier={preview.tier.name} mark={preview.tier.mark} />
        </div>
        <Swatches hexes={IDENTITY_ROLES.map((r) => preview.palette.swatches.find((s) => s.role === r)!)} />
      </div>

      <div className="row gap-1" style={{ marginTop: 11 }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: 10.5, padding: "7px 13px" }}
          disabled={same}
          title={same ? "these numbers are what your mark is already forged from" : "freeze this instead of the mark you have"}
          onClick={() => { adoptMark(preview); say(`adopted · ${preview.score}/100 · ${preview.tier.name}`); }}
        >
          {same ? "this is your mark" : "adopt as my mark"}
        </button>
        <button
          className="btn"
          style={{ fontSize: 10.5, padding: "7px 13px" }}
          disabled={same}
          onClick={() => { setDraft(asDraft(reading)); setPlace(reading.place); }}
        >
          undo my edits
        </button>
      </div>
      <div className="faint mono-sm" style={{ fontSize: 8.5, lineHeight: 1.6, marginTop: 8 }}>
        nothing changes until you press adopt — and it stays put again afterwards.
      </div>
    </div>
  );
}

/* ── the card ────────────────────────────────────────────────────────────────────────────────── */

export default function ForgeMark({ full = false }: { full?: boolean }) {
  const { mark, identityBusy, founder, setIdentityConsent, applyMark, go } = useApp();
  const [tab, setTab] = useState<"mark" | "measure" | "numbers">("mark");

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
            {([["mark", "the mark"], ["measure", "the measurements"], ["numbers", "the numbers"]] as const).map(([id, label]) => (
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
          {tab === "numbers" && (mark.reading ? <MarkEditor key={mark.seed} reading={mark.reading} /> : (
            <div className="faint" style={{ fontSize: 11, lineHeight: 1.7 }}>
              the founder set is not forged from a reading, so there is nothing here to edit.
            </div>
          ))}
        </>
      )}
      {full && founder && mark.founder && <FounderCard />}
    </div>
  );
}

