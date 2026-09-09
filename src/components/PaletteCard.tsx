import type { Palette } from "../engine/akmon";

export function PaletteStrip({ p, height = 34 }: { p: Palette; height?: number }) {
  return (
    <div style={{ display: "flex", height, width: "100%" }}>
      {p.swatches.map((s) => (
        <div key={s.role} style={{ flex: 1, background: s.hex }} title={`${s.role} ${s.hex}`} />
      ))}
    </div>
  );
}

export default function PaletteCard({
  p,
  onOpen,
  onFavorite,
  onDelete,
  score,
}: {
  p: Palette;
  onOpen?: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
  score?: number;
}) {
  return (
    <div
      className="panel"
      style={{ display: "flex", flexDirection: "column", transition: "border-color 140ms" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--fg-faint)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
    >
      <button onClick={onOpen} style={{ display: "block", width: "100%" }} title="Open in Akmon">
        <PaletteStrip p={p} height={64} />
      </button>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <button onClick={onOpen} style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name}
            </div>
            <div className="faint mono-sm" style={{ marginTop: 2 }}>
              {p.scheme.replace("-", " ")} · {p.mode}
              {score !== undefined && ` · ${score}/100`}
            </div>
          </button>
          <div className="row gap-1" style={{ flexShrink: 0 }}>
            {onFavorite && (
              <button
                onClick={onFavorite}
                title="Favourite"
                style={{ fontSize: 11, color: p.favorite ? "var(--fg)" : "var(--fg-faint)", padding: 2 }}
              >
                {p.favorite ? "★" : "☆"}
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                title="Delete"
                style={{ fontSize: 11, color: "var(--fg-faint)", padding: 2 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bad)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-faint)")}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {p.prompt && (
          <div className="faint mono-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            "{p.prompt}"
          </div>
        )}
      </div>
    </div>
  );
}
