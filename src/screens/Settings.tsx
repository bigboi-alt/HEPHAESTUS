import { useState } from "react";
import { useApp } from "../store";
import { DEFAULT_SETTINGS, download, type ThemeId } from "../lib/storage";
import { TRENDS, TRENDS_UPDATED, TRENDS_VERSION } from "../data/trends";
import { SPACE_SIZE } from "../engine/akmon";

type Section = "general" | "profile" | "appearance" | "data" | "about";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "general", label: "general" },
  { id: "profile", label: "profile" },
  { id: "appearance", label: "appearance" },
  { id: "data", label: "data" },
  { id: "about", label: "about" },
];

const THEMES: { id: ThemeId; label: string; note: string; swatch: string[] }[] = [
  { id: "obsidian", label: "Obsidian", note: "pure black, maximum contrast", swatch: ["#000000", "#0b0b0b", "#1b1b1b", "#f2f2f2"] },
  { id: "graphite", label: "Graphite", note: "softer dark, easier at night", swatch: ["#0e1012", "#1a1e21", "#282c30", "#e9ebee"] },
  { id: "paper", label: "Paper", note: "warm light, print-adjacent", swatch: ["#faf9f6", "#f3f2ed", "#dedbd2", "#14150f"] },
  { id: "blueprint", label: "Blueprint", note: "cold blue-black, technical", swatch: ["#05070d", "#0e1421", "#17233a", "#dce6f5"] },
  { id: "ember", label: "Ember", note: "the forge itself", swatch: ["#0a0605", "#17100c", "#2a1a12", "#ff7043"] },
];

const ACCENTS = ["#F5F5F5", "#FF7043", "#7FB2FF", "#4ADE80", "#FBBF24", "#C084FC", "#F472B6"];

export default function Settings() {
  const { settings, setSettings, go, palettes, say } = useApp();
  const [section, setSection] = useState<Section>("general");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid var(--line)", padding: "26px 16px", position: "sticky", top: 0, height: "100vh" }}>
        <div className="label" style={{ marginBottom: 18, paddingLeft: 10 }}>settings</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                textAlign: "left", padding: "8px 10px", fontSize: 12,
                background: section === s.id ? "var(--raise)" : "transparent",
                color: section === s.id ? "var(--fg)" : "var(--fg-dim)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button className="faint" style={{ marginTop: 26, paddingLeft: 10, fontSize: 11 }} onClick={() => go("home")}>
          ← back to HEPHAESTUS
        </button>
      </aside>

      <div style={{ padding: "26px 40px 80px", maxWidth: 860 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 22 }}>
          <span className="label">settings / {section}</span>
          <button className="faint" style={{ fontSize: 11 }} onClick={() => go("home")}>close</button>
        </div>

        {section === "general" && (
          <Panel title="General settings.">
            <Toggle
              label="Cedalion auto-audit"
              note="Score every palette the moment it changes. Turn off if you'd rather ask than be told."
              value={settings.cedalionAutoAudit}
              onChange={(v) => setSettings({ cedalionAutoAudit: v })}
            />
            <Toggle
              label="Cedalion dock"
              note="Keep the floating console available on every screen."
              value={settings.cedalionDock}
              onChange={(v) => setSettings({ cedalionDock: v })}
            />
            <Toggle
              label="Interface motion"
              note="Fades and transitions. Off also respects prefers-reduced-motion behaviour in exports."
              value={settings.motion}
              onChange={(v) => setSettings({ motion: v })}
            />
            <Row label="Contrast target" note="The floor Cedalion holds palettes to when no purpose is selected.">
              <div className="row gap-1">
                {([4.5, 7] as const).map((c) => (
                  <button key={c} className="btn" data-active={settings.contrastFloor === c} onClick={() => setSettings({ contrastFloor: c })}>
                    {c}:1 {c === 4.5 ? "AA" : "AAA"}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Colour format" note="How values are displayed across the app. Exports always include every format.">
              <div className="row gap-1">
                {(["hex", "rgb", "hsl", "oklch"] as const).map((f) => (
                  <button key={f} className="btn" data-active={settings.colorFormat === f} onClick={() => setSettings({ colorFormat: f })}>
                    {f}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Trend library source" note="Leave empty to use the bundled library. Point it at raw JSON to update every install by pushing a file.">
              <input
                className="input"
                style={{ maxWidth: 380 }}
                placeholder="https://raw.githubusercontent.com/…/trends.json"
                value={settings.trendsRemoteUrl}
                onChange={(e) => setSettings({ trendsRemoteUrl: e.target.value })}
              />
            </Row>
          </Panel>
        )}

        {section === "profile" && (
          <Panel title="Profile.">
            <Row label="Display name" note="Shown on the dashboard and in the top bar.">
              <input className="input" style={{ maxWidth: 300 }} value={settings.displayName} onChange={(e) => setSettings({ displayName: e.target.value })} />
            </Row>
            <Row label="Handle" note="Cosmetic for now — it becomes your identity when cloud sync lands.">
              <input className="input" style={{ maxWidth: 300 }} value={settings.handle} onChange={(e) => setSettings({ handle: e.target.value })} />
            </Row>
            <Row label="Account" note="Hephaestus runs entirely on this machine. No account, no telemetry, no network calls.">
              <span className="faint mono-sm">local · offline</span>
            </Row>
          </Panel>
        )}

        {section === "appearance" && (
          <Panel title="Appearance.">
            <div style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Theme</div>
              <div className="faint mono-sm" style={{ marginBottom: 12 }}>
                The shell only. Palettes you design are never affected by this.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 10 }}>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSettings({ theme: t.id })}
                    className="panel"
                    style={{
                      padding: 10, textAlign: "left",
                      borderColor: settings.theme === t.id ? "var(--fg-dim)" : "var(--line)",
                    }}
                  >
                    <div style={{ display: "flex", height: 26, marginBottom: 8, border: "1px solid var(--line)" }}>
                      {t.swatch.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
                    </div>
                    <div style={{ fontSize: 12 }}>{t.label}</div>
                    <div className="faint mono-sm">{t.note}</div>
                  </button>
                ))}
              </div>
            </div>

            <Row label="Accent" note="Used for focus rings, Cedalion's marker and primary actions.">
              <div className="row gap-1">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setSettings({ accent: a })}
                    style={{
                      width: 26, height: 26, background: a,
                      border: settings.accent === a ? "2px solid var(--fg)" : "1px solid var(--line)",
                    }}
                    title={a}
                  />
                ))}
                <input
                  type="color"
                  value={settings.accent}
                  onChange={(e) => setSettings({ accent: e.target.value.toUpperCase() })}
                  style={{ width: 34, height: 26, background: "none", border: "1px solid var(--line)" }}
                />
              </div>
            </Row>

            <Row label="Density" note="Compact tightens padding throughout — useful on laptops.">
              <div className="row gap-1">
                {(["comfortable", "compact"] as const).map((d) => (
                  <button key={d} className="btn" data-active={settings.density === d} onClick={() => setSettings({ density: d })}>
                    {d}
                  </button>
                ))}
              </div>
            </Row>
          </Panel>
        )}

        {section === "data" && (
          <Panel title="Data.">
            <Row label="Storage" note="Everything lives in this browser's local storage. Nothing is uploaded.">
              <span className="faint mono-sm">{palettes.length} palettes saved</span>
            </Row>
            <Row label="Export" note="A portable JSON file with every palette and your settings.">
              <button
                className="btn"
                onClick={() => download("hephaestus-backup.json", JSON.stringify({ app: "Hephaestus", palettes, settings }, null, 2))}
              >
                download backup
              </button>
            </Row>
            <Row label="Reset settings" note="Restores defaults. Your palettes are not touched.">
              <button className="btn" onClick={() => { setSettings(DEFAULT_SETTINGS); say("settings reset"); }}>reset</button>
            </Row>
          </Panel>
        )}

        {section === "about" && (
          <Panel title="About HEPHAESTUS.">
            <Meta k="version" v="0.1.0 — Akmon milestone" />
            <Meta k="current release" v="palette engine · trend library · direction engine · Cedalion" />
            <Meta k="next" v="Akmon canvas · live composition scoring" />
            <Meta k="trend library" v={`v${TRENDS_VERSION} · ${TRENDS_UPDATED} · ${TRENDS.length} entries`} />
            <Meta k="colour space" v={`${SPACE_SIZE.pretty} addressable palettes`} />
            <Meta k="built with" v="React · TypeScript · Vite · Zustand" />
            <Meta k="dependencies for colour, trends or scoring" v="none" />
            <p className="faint mono-sm" style={{ lineHeight: 1.7, marginTop: 20 }}>
              Named for the smith who was thrown off Olympus and built better things than the gods who
              threw him. Akmon is the anvil. Cedalion is the guide who carried him to the sunrise —
              here, the critic that tells you what's actually wrong, with the measurement attached.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 26px", letterSpacing: "-0.01em" }}>{title}</h1>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

function Row({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <>
      <hr className="rule" />
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 24, padding: "18px 0" }}>
        <div style={{ maxWidth: 430 }}>
          <div style={{ fontSize: 13 }}>{label}</div>
          <div className="faint mono-sm" style={{ marginTop: 3, lineHeight: 1.55 }}>{note}</div>
        </div>
        <div style={{ flexShrink: 0 }}>{children}</div>
      </div>
    </>
  );
}

function Toggle({ label, note, value, onChange }: { label: string; note: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label} note={note}>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        style={{
          width: 46, height: 24, border: "1px solid var(--line)",
          background: value ? "var(--fg)" : "transparent",
          display: "flex", alignItems: "center",
          justifyContent: value ? "flex-end" : "flex-start", padding: 2,
          transition: "background 140ms",
        }}
      >
        <span style={{ width: 18, height: 18, background: value ? "var(--bg)" : "var(--fg-faint)", display: "block" }} />
      </button>
    </Row>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <>
      <hr className="rule" />
      <div className="row" style={{ justifyContent: "space-between", padding: "13px 0", gap: 20 }}>
        <span className="dim mono-sm">{k}</span>
        <span className="mono-sm" style={{ textAlign: "right" }}>{v}</span>
      </div>
    </>
  );
}
