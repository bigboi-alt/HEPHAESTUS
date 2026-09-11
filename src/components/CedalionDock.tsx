/**
 * CEDALION — floating, draggable critic console.
 *
 * Lives in a corner as a small launcher; opens into a window you can grab by
 * the header and drop anywhere. Position persists across restarts.
 */
import { useEffect, useRef, useState } from "react";
import { useApp } from "../store";
import { ask, auditPalette, cedalionStarters } from "../engine/cedalion";

export function CedalionChat({ compact = false }: { compact?: boolean }) {
  const { chat, pushChat, clearChat, current, purposeId, screen, buildMeta, canvasCtx, cedalionSeed, clearCedalionSeed } = useApp();
  const starters = cedalionStarters(screen);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [chat.length]);

  /* a question handed over from another screen — speak it once, then forget it */
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!cedalionSeed || cedalionSeed === seededRef.current) return;
    seededRef.current = cedalionSeed;
    send(cedalionSeed);
    clearCedalionSeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedalionSeed]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    pushChat({ role: "you", text: q });
    const a = ask(q, {
      palette: current ?? undefined,
      purposeId: purposeId ?? undefined,
      screen,
      canvas: screen === "build" ? canvasCtx ?? undefined : undefined,
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
              {starters.slice(0, compact ? 4 : 6).map((s) => (
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

const W = 388;
const H = 560;

function defaultPos(screen: string) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const h = Math.min(H, Math.max(300, vh - 140));
  // in the studio, open top-right so it never hides the canvas toolbar corner
  if (screen === "build") {
    return { x: Math.max(8, vw - 388 - 288 - 14), y: 10, w: W, h };
  }
  return { x: Math.max(8, vw - W - 18), y: Math.max(58, vh - h - 92), w: W, h };
}

/** The launcher + draggable floating window. No mascot, no anchor. */
export default function CedalionDock() {
  const { cedalionOpen, setCedalionOpen, screen, current, purposeId, settings, setSettings } = useApp();
  const [minimized, setMinimized] = useState(false);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number }>(() => {
    const saved = settings.chatRect;
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") return saved;
    return defaultPos(screen);
  });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const lastRect = useRef(rect);
  lastRect.current = rect;

  const audit = current && settings.cedalionAutoAudit ? auditPalette(current, purposeId ?? undefined) : null;

  /* header drag: live move, persist on release */
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setRect((r) => {
        const topBar = screen === "build" ? 4 : 56;
        const x = Math.min(Math.max(e.clientX - d.dx, -r.w + 90), window.innerWidth - 60);
        const y = Math.min(Math.max(e.clientY - d.dy, topBar), window.innerHeight - 30);
        return { ...r, x, y };
      });
    };
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setSettings({ chatRect: lastRect.current });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  /* launcher — hidden inside the studio (the studio has its own chat buttons), and
     hidden entirely when the shell setting turns the dock off: if nobody asked for
     a floating pill, don't stick one on the screen */
  if (!cedalionOpen) {
    if (screen === "build" || !settings.cedalionDock) return null;
    return (
      <button
        onClick={() => {
          setCedalionOpen(true);
          setMinimized(false);
        }}
        className="row gap-2"
        style={{
          position: "fixed", right: 18, bottom: 16, zIndex: 50,
          border: "1px solid var(--line)", background: "var(--surface)",
          padding: "8px 14px", boxShadow: "0 8px 24px -14px rgba(0,0,0,.5)",
        }}
        title="Open Cedalion — drag the window anywhere once open"
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
    <div
      className={settings.motion ? "fade-in" : undefined}
      style={{
        position: "fixed", left: rect.x, top: rect.y, zIndex: 50,
        width: rect.w,
        height: minimized ? 40 : rect.h,
        border: "1px solid var(--line)", background: "var(--surface)",
        display: "flex", flexDirection: "column",
        boxShadow: "0 30px 80px -24px rgba(0,0,0,.55)",
        resize: "none",
      }}
    >
      <div
        className="row"
        style={{
          justifyContent: "space-between", padding: "0 6px 0 14px", flexShrink: 0,
          borderBottom: minimized ? "none" : "1px solid var(--line)",
          height: 40, cursor: "grab", userSelect: "none", touchAction: "none",
        }}
        onPointerDown={(e) => {
          dragRef.current = { dx: e.clientX - rect.x, dy: e.clientY - rect.y };
        }}
      >
        <div className="row gap-2">
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
          <span style={{ fontSize: 11, letterSpacing: "0.14em", fontWeight: 500 }}>CEDALION</span>
          {audit && !minimized && (
            <span className="faint mono-sm">
              {audit.score}/100 · {audit.grade}
            </span>
          )}
        </div>
        <div className="row gap-1">
          <span className="faint mono-sm" style={{ fontSize: 8.5, paddingRight: 4 }}>drag me</span>
          <button
            className="btn" title={minimized ? "expand" : "minimise"}
            style={{ padding: "3px 9px", fontSize: 11 }}
            onClick={() => setMinimized((m) => !m)}
          >
            {minimized ? "▢" : "–"}
          </button>
          <button
            className="btn" title="close (chat stays)"
            style={{ padding: "3px 9px", fontSize: 12 }}
            onClick={() => setCedalionOpen(false)}
          >
            ×
          </button>
        </div>
      </div>
      {!minimized && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <CedalionChat compact />
        </div>
      )}
    </div>
  );
}
