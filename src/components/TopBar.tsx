import { useApp, type Screen } from "../store";

const NAV: { id: Screen; label: string }[] = [
  { id: "home", label: "home" },
  { id: "akmon", label: "akmon" },
  { id: "library", label: "library" },
  { id: "trends", label: "trends" },
  { id: "build", label: "build" },
];

export default function TopBar() {
  const { screen, go, settings } = useApp();

  return (
    <header
      style={{
        borderBottom: "1px solid var(--line)",
        padding: "0 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 58,
        position: "sticky",
        top: 0,
        background: "var(--bg)",
        zIndex: 40,
      }}
    >
      <div className="row gap-3">
        <button className="row gap-2" onClick={() => go("home")} title="Hephaestus">
          <span
            style={{
              width: 26, height: 26, border: "1px solid var(--fg)",
              display: "grid", placeItems: "center", fontSize: 12, flexShrink: 0,
            }}
          >
            ⚒
          </span>
          <span style={{ textAlign: "left", lineHeight: 1.15 }}>
            <span style={{ fontSize: 13, letterSpacing: "0.22em", fontWeight: 500 }}>
              HEPHAESTUS
            </span>
            <br />
            <span className="label" style={{ fontSize: 8.5 }}>
              design forge
            </span>
          </span>
        </button>
      </div>

      <nav className="row gap-1" style={{ marginLeft: "auto", marginRight: 14 }}>
        {NAV.map((n) => (
          <button
            key={n.id}
            className="btn"
            data-active={screen === n.id}
            style={{ borderColor: screen === n.id ? "var(--fg-dim)" : "transparent" }}
            onClick={() => go(n.id)}
          >
            {n.label}
          </button>
        ))}
      </nav>

      <button
        className="row gap-2"
        onClick={() => go("settings")}
        style={{ border: "1px solid var(--line)", padding: "5px 10px 5px 6px" }}
        title="Settings"
      >
        <span
          style={{
            width: 22, height: 22, background: "var(--fg)", color: "var(--bg)",
            display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600,
          }}
        >
          {settings.displayName.trim().charAt(0).toUpperCase() || "H"}
        </span>
        <span style={{ textAlign: "left", lineHeight: 1.1 }}>
          <span style={{ fontSize: 11 }}>{settings.displayName || "you"}</span>
          <br />
          <span className="faint" style={{ fontSize: 9 }}>{settings.handle}</span>
        </span>
      </button>
    </header>
  );
}
