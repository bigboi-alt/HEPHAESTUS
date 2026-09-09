import { useEffect, useRef, useState } from "react";
import { useApp } from "../store";
import { ask, auditPalette, CEDALION_STARTERS } from "../engine/cedalion";
import CedalionBuddy, { type BuddyMode } from "./CedalionBuddy";

export function CedalionChat({ compact = false }: { compact?: boolean }) {
  const { chat, pushChat, clearChat, current, purposeId, screen, buildMeta } = useApp();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [chat.length]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    pushChat({ role: "you", text: q });
    const a = ask(q, {
      palette: current ?? undefined,
      purposeId: purposeId ?? undefined,
      screen,
      buildSite: buildMeta
        ? {
            purposeLabel: buildMeta.purposeLabel,
            sectionsOn: buildMeta.sectionsOn,
            sectionNames: buildMeta.sectionNames,
            score: current ? auditPalette(current, purposeId ?? undefined).score : undefined,
          }
        : undefined,
    });
    pushChat({
      role: "cedalion",
      text: a.text,
      bullets: a.bullets,
      refs: a.refs,
      suggestions: a.suggestions,
    });
    setDraft("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: compact ? "12px 14px" : "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minHeight: 0,
        }}
      >
        {chat.length === 0 && (
          <div className="fade-in">
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              I read what's on screen and tell you what's measurably wrong with it.
            </div>
            <div className="faint mono-sm" style={{ marginBottom: 14 }}>
              no model, no api key, no network — colour maths and a rule base. ask me anything.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {CEDALION_STARTERS.slice(0, compact ? 4 : 6).map((s) => (
                <button
                  key={s}
                  className="btn"
                  style={{ textAlign: "left", textTransform: "none", fontSize: 11 }}
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chat.map((t) => (
          <div key={t.id} className="fade-in">
            <div className="label" style={{ marginBottom: 5, color: t.role === "you" ? "var(--fg-faint)" : "var(--acc-s, #c4562a)" }}>
              {t.role === "cedalion" ? "cedalion" : "you"}
            </div>
            <div style={{ fontSize: 12, color: t.role === "you" ? "var(--fg-dim)" : "var(--fg)", lineHeight: 1.6 }}>
              {t.text}
            </div>
            {t.bullets && t.bullets.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                {t.bullets.map((b, i) => (
                  <li key={i} className="dim" style={{ fontSize: 11.5, lineHeight: 1.55 }}>{b}</li>
                ))}
              </ul>
            )}
            {t.refs && t.refs.length > 0 && (
              <div style={{ marginTop: 8, borderLeft: "1px solid var(--line)", paddingLeft: 10 }}>
                {t.refs.map((r, i) => (
                  <div key={i} className="faint mono-sm" style={{ lineHeight: 1.5 }}>{r}</div>
                ))}
              </div>
            )}
            {t.suggestions && (
              <div className="row gap-1" style={{ marginTop: 8, flexWrap: "wrap" }}>
                {t.suggestions.map((s) => (
                  <button key={s} className="btn" style={{ fontSize: 10, padding: "4px 8px", textTransform: "none" }} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: "1px solid var(--line)", padding: 10 }}>
        <div className="row gap-1">
          <input
            className="input"
            placeholder="ask cedalion…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(draft)}
          />
          <button className="btn" onClick={() => send(draft)} disabled={!draft.trim()}>send</button>
        </div>
        {chat.length > 0 && (
          <button className="faint mono-sm" style={{ marginTop: 8 }} onClick={clearChat}>
            clear conversation
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The dock: a chat window with the buddy sitting on its roof.
 * Choreography — open: buddy gets bumped into the air, lands, sits.
 * Close: he drops and settles on the closed pill.
 */
export default function CedalionDock() {
  const { cedalionOpen, setCedalionOpen, current, purposeId, settings } = useApp();
  const [closing, setClosing] = useState(false);
  const [mode, setMode] = useState<BuddyMode>("hop");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audit = current && settings.cedalionAutoAudit ? auditPalette(current, purposeId ?? undefined) : null;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // when the chat appears, the buddy gets bumped up, lands and settles into idle bob
  useEffect(() => {
    if (cedalionOpen) {
      setMode("hop");
      later(() => setMode("idle"), 700);
    }
  }, [cedalionOpen]);

  function close() {
    setClosing(true);
    setMode("fall");
    later(() => {
      setClosing(false);
      setCedalionOpen(false);
    }, 500);
  }

  // closed: the pill with the buddy sitting on top
  if (!cedalionOpen) {
    return (
      <button
        onClick={() => setCedalionOpen(true)}
        className="row gap-2"
        style={{
          position: "fixed", right: 18, bottom: 14, zIndex: 50,
          border: "1px solid var(--line)", background: "var(--surface)",
          padding: "6px 14px 8px",
        }}
        title="Open Cedalion"
      >
        <span className="row gap-2" style={{ position: "relative" }}>
          <span
            style={{ position: "absolute", bottom: "100%", right: "50%", transform: "translateX(50%)", marginBottom: 2 }}
          >
            <CedalionBuddy mode="idle" size={40} />
          </span>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
          <span style={{ fontSize: 11, letterSpacing: "0.1em" }}>cedalion</span>
        </span>
        {audit && (
          <span className="faint mono-sm" style={{ borderLeft: "1px solid var(--line)", paddingLeft: 9 }}>
            {audit.score}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="fade-in"
      style={{ position: "fixed", right: 18, bottom: 14, zIndex: 50, width: 384 }}
    >
      {/* the buddy on the roof */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: 10, height: 52 }}>
        <CedalionBuddy mode={closing ? "fall" : mode} size={54} />
      </div>
      <aside
        className={closing ? "" : "fade-in"}
        style={{
          width: 384, height: "min(540px, calc(100vh - 130px))",
          border: "1px solid var(--line)", background: "var(--surface)",
          display: "flex", flexDirection: "column",
          marginTop: -6,
        }}
      >
        <div
          className="row"
          style={{ justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--line)" }}
        >
          <div className="row gap-2">
            <span style={{ fontSize: 12, letterSpacing: "0.12em" }}>CEDALION</span>
            {audit && (
              <span className="faint mono-sm">
                {audit.score}/100 · {audit.grade}
              </span>
            )}
          </div>
          <button className="faint" style={{ fontSize: 14 }} onClick={close} title="Close">
            ×
          </button>
        </div>
        <CedalionChat compact />
      </aside>
    </div>
  );
}
