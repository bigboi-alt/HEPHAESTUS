import { useEffect, useRef, useState } from "react";
import { useApp } from "../store";
import { ask, auditPalette, CEDALION_STARTERS } from "../engine/cedalion";

export function CedalionChat({ compact = false }: { compact?: boolean }) {
  const { chat, pushChat, clearChat, current, purposeId, screen } = useApp();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [chat.length]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    pushChat({ role: "you", text: q });
    const a = ask(q, { palette: current ?? undefined, purposeId: purposeId ?? undefined, screen });
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
              No model, no API key, no network. Contrast maths, OKLab distance, colour-vision
              simulation, and a curated rule base. Ask me anything.
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
            <div className="label" style={{ marginBottom: 5, color: t.role === "you" ? "var(--fg-faint)" : "var(--accent)" }}>
              {t.role}
            </div>
            <div style={{ fontSize: 12, color: t.role === "you" ? "var(--fg-dim)" : "var(--fg)" }}>
              {t.text}
            </div>
            {t.bullets && t.bullets.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                {t.bullets.map((b, i) => (
                  <li key={i} className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{b}</li>
                ))}
              </ul>
            )}
            {t.refs && t.refs.length > 0 && (
              <div style={{ marginTop: 8, borderLeft: "1px solid var(--line)", paddingLeft: 10 }}>
                {t.refs.map((r, i) => (
                  <div key={i} className="faint mono-sm">{r}</div>
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

export default function CedalionDock() {
  const { cedalionOpen, setCedalionOpen, current, purposeId, settings } = useApp();
  const audit = current && settings.cedalionAutoAudit ? auditPalette(current, purposeId ?? undefined) : null;

  if (!cedalionOpen) {
    return (
      <button
        onClick={() => setCedalionOpen(true)}
        className="row gap-2"
        style={{
          position: "fixed", right: 18, bottom: 18, zIndex: 50,
          border: "1px solid var(--line)", background: "var(--surface)",
          padding: "9px 14px",
        }}
        title="Open Cedalion"
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
        <span style={{ fontSize: 11, letterSpacing: "0.1em" }}>cedalion</span>
        {audit && (
          <span className="faint mono-sm" style={{ borderLeft: "1px solid var(--line)", paddingLeft: 9 }}>
            {audit.score}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      className="fade-in"
      style={{
        position: "fixed", right: 18, bottom: 18, zIndex: 50,
        width: 380, height: "min(560px, calc(100vh - 100px))",
        border: "1px solid var(--line)", background: "var(--surface)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div
        className="row"
        style={{ justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid var(--line)" }}
      >
        <div className="row gap-2">
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
          <span style={{ fontSize: 12, letterSpacing: "0.12em" }}>CEDALION</span>
          {audit && (
            <span className="faint mono-sm">
              {audit.score}/100 · {audit.grade}
            </span>
          )}
        </div>
        <button className="faint" style={{ fontSize: 14 }} onClick={() => setCedalionOpen(false)} title="Close">
          ×
        </button>
      </div>
      <CedalionChat compact />
    </aside>
  );
}
