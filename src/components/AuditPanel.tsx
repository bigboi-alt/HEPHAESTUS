import { useApp } from "../store";
import type { Audit, Severity } from "../engine/cedalion";

const COLOR: Record<Severity, string> = {
  critical: "var(--bad)",
  warning: "var(--warn)",
  note: "var(--fg-dim)",
  win: "var(--ok)",
};

const MARK: Record<Severity, string> = {
  critical: "✕",
  warning: "!",
  note: "·",
  win: "✓",
};

export default function AuditPanel({ audit }: { audit: Audit }) {
  const { setSwatch, say } = useApp();

  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <span className="label">cedalion · audit</span>
        <span style={{ fontSize: 11 }}>
          <b style={{ fontSize: 17, fontWeight: 500 }}>{audit.score}</b>
          <span className="faint">/100 · {audit.grade}</span>
        </span>
      </div>

      <div style={{ display: "flex", height: 3, gap: 2, marginBottom: 12 }}>
        {audit.categories.map((c) => (
          <div
            key={c.id}
            title={`${c.label}: ${c.score}`}
            style={{
              flex: c.weight,
              background: c.score >= 85 ? "var(--ok)" : c.score >= 60 ? "var(--warn)" : "var(--bad)",
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <p style={{ fontSize: 12, margin: "0 0 12px" }}>{audit.headline}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
        {audit.categories.map((c) => (
          <div key={c.id} className="row" style={{ justifyContent: "space-between", fontSize: 11 }}>
            <span className="dim">{c.label}</span>
            <span className="faint">{c.score}</span>
          </div>
        ))}
      </div>

      <hr className="rule" style={{ margin: "0 0 12px" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 340, overflowY: "auto" }}>
        {audit.findings.map((f) => (
          <div key={f.id}>
            <div className="row gap-2" style={{ alignItems: "flex-start" }}>
              <span style={{ color: COLOR[f.severity], fontSize: 11, lineHeight: 1.5 }}>{MARK[f.severity]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5 }}>{f.title}</div>
                <div className="faint mono-sm" style={{ marginTop: 3, lineHeight: 1.5 }}>{f.detail}</div>
                {f.evidence && (
                  <div className="faint mono-sm" style={{ marginTop: 3, opacity: 0.8 }}>{f.evidence}</div>
                )}
                {f.fix && (
                  <button
                    className="btn"
                    style={{ marginTop: 6, fontSize: 10, padding: "3px 8px", textTransform: "none" }}
                    onClick={() => { setSwatch(f.fix!.role, f.fix!.hex); say("fix applied"); }}
                  >
                    {f.fix.label} →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
