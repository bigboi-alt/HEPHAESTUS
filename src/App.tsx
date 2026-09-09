import { useEffect } from "react";
import { useApp } from "./store";
import TopBar from "./components/TopBar";
import CedalionDock from "./components/CedalionDock";
import Home from "./screens/Home";
import Akmon from "./screens/Akmon";
import Library from "./screens/Library";
import Trends from "./screens/Trends";
import Studio from "./screens/Studio";
import Settings from "./screens/Settings";

export default function App() {
  const { ready, screen, settings, toast, init } = useApp();

  useEffect(() => { void init(); }, [init]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.density = settings.density;
    root.dataset.motion = settings.motion ? "on" : "off";
    root.style.setProperty("--accent", settings.accent);
    root.style.setProperty(
      "--accent-fg",
      pickReadable(settings.accent)
    );
  }, [settings.theme, settings.density, settings.motion, settings.accent]);

  if (!ready) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <div className="label">heating the forge…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {screen !== "settings" && screen !== "build" && <TopBar />}
      <main style={{ flex: 1, position: "relative" }}>
        {screen === "home" && <Home />}
        {screen === "akmon" && <Akmon />}
        {screen === "library" && <Library />}
        {screen === "trends" && <Trends />}
        {screen === "build" && <Studio />}
        {screen === "settings" && <Settings />}
      </main>
      {screen !== "settings" && settings.cedalionDock && <CedalionDock />}
      {toast && (
        <div
          className="fade-in"
          style={{
            position: "fixed", bottom: 18, left: 18, zIndex: 60,
            border: "1px solid var(--line)", background: "var(--surface)",
            padding: "8px 14px", fontSize: 11, letterSpacing: "0.08em",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function pickReadable(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#000000";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  return L > 0.42 ? "#000000" : "#ffffff";
}
