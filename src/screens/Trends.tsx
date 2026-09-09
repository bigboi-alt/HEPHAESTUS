import { useMemo, useState } from "react";
import { TRENDS, TRENDS_UPDATED, TRENDS_VERSION, type Trend, type TrendStatus } from "../data/trends";
import { useApp } from "../store";
import { matchTrends } from "../engine/cedalion";

const STATUS_COLOR: Record<TrendStatus, string> = {
  core: "var(--ok)",
  rising: "var(--accent)",
  polarizing: "var(--warn)",
  cooling: "var(--fg-faint)",
};

const STATUS_NOTE: Record<TrendStatus, string> = {
  core: "settled — safe to build on",
  rising: "early but real",
  polarizing: "works or embarrasses",
  cooling: "past peak",
};

export default function Trends() {
  const { current, settings, setSettings, say } = useApp();
  const [filter, setFilter] = useState<TrendStatus | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const matched = useMemo(
    () => (current ? matchTrends(current) : []).map((m) => m.id),
    [current]
  );

  const list = TRENDS.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (!q.trim()) return true;
    const n = q.toLowerCase();
    return (
      t.name.toLowerCase().includes(n) ||
      t.summary.toLowerCase().includes(n) ||
      t.tags.some((x) => x.includes(n)) ||
      t.signals.some((x) => x.toLowerCase().includes(n))
    );
  });

  async function sync() {
    const url = settings.trendsRemoteUrl.trim();
    if (!url) { say("set a trends URL in settings first"); return; }
    setSyncing(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      say(Array.isArray(data?.trends) ? `remote library v${data.version ?? "?"} reachable` : "unexpected format");
    } catch {
      say("could not reach the remote library");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ padding: "26px 22px 100px", maxWidth: 1200, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="label">trend library</div>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: "6px 0 2px" }}>What 2026 actually settled on</h1>
        </div>
        <div className="row gap-1">
          <span className="faint mono-sm">v{TRENDS_VERSION} · {TRENDS_UPDATED}</span>
          <button className="btn" onClick={sync} disabled={syncing}>{syncing ? "checking…" : "check for updates"}</button>
        </div>
      </div>

      <p className="dim" style={{ fontSize: 12, maxWidth: 720, margin: "0 0 20px" }}>
        Curated by hand, not scraped. Each entry carries the rules Cedalion scores against and a
        recipe you can implement directly. Point it at your own JSON in settings and every install
        updates when you push.
      </p>

      <div className="row gap-1" style={{ marginBottom: 18, flexWrap: "wrap" }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="search trends…" value={q} onChange={(e) => setQ(e.target.value)} />
        {(["all", "core", "rising", "polarizing", "cooling"] as const).map((s) => (
          <button key={s} className="btn" data-active={filter === s} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
        {list.map((t) => (
          <TrendRow
            key={t.id}
            t={t}
            open={open === t.id}
            matched={matched.includes(t.id)}
            onToggle={() => setOpen(open === t.id ? null : t.id)}
          />
        ))}
      </div>

      <div className="panel" style={{ padding: 16, marginTop: 22 }}>
        <div className="label" style={{ marginBottom: 8 }}>how this stays current</div>
        <p className="dim mono-sm" style={{ margin: 0, lineHeight: 1.7 }}>
          The library ships inside the app so it works with no network. If you set a remote URL, the
          app merges an updated <code>trends.json</code> by id on launch — you push once to a public
          gist or repo and every installed copy learns the new trend. Below that, the direction
          engine decomposes every trend into interchangeable atoms and recombines them, so the idea
          space keeps growing even between library updates.
        </p>
        <div className="row gap-1" style={{ marginTop: 12 }}>
          <input
            className="input"
            style={{ maxWidth: 420 }}
            placeholder="https://raw.githubusercontent.com/you/hephaestus-trends/main/trends.json"
            value={settings.trendsRemoteUrl}
            onChange={(e) => setSettings({ trendsRemoteUrl: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function TrendRow({ t, open, matched, onToggle }: { t: Trend; open: boolean; matched: boolean; onToggle: () => void }) {
  return (
    <div style={{ background: "var(--bg)" }}>
      <button onClick={onToggle} style={{ width: "100%", textAlign: "left", padding: "14px 16px", display: "block" }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div className="row gap-2" style={{ minWidth: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[t.status], flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{t.name}</span>
            {matched && <span className="mono-sm" style={{ color: "var(--accent)" }}>· matches your palette</span>}
          </div>
          <div className="row gap-2" style={{ flexShrink: 0 }}>
            <span className="faint mono-sm">{STATUS_NOTE[t.status]}</span>
            <span className="faint mono-sm">since {t.since}</span>
            <span className="faint">{open ? "−" : "+"}</span>
          </div>
        </div>
        <div className="dim mono-sm" style={{ marginTop: 6, lineHeight: 1.6, maxWidth: 860 }}>{t.summary}</div>
      </button>

      {open && (
        <div className="fade-in" style={{ padding: "0 16px 16px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
          <Block title="visual signals" items={t.signals} />
          <Block title="use when" items={t.useWhen} />
          {t.avoidWhen.length > 0 && <Block title="avoid when" items={t.avoidWhen} />}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>recipe</div>
            <code className="dim mono-sm" style={{ lineHeight: 1.6, display: "block" }}>{t.recipe}</code>
            {t.rules.contrastMin && (
              <div className="faint mono-sm" style={{ marginTop: 8 }}>contrast floor {t.rules.contrastMin}:1</div>
            )}
            {t.rules.chroma && (
              <div className="faint mono-sm">chroma band {t.rules.chroma[0]}–{t.rules.chroma[1]}</div>
            )}
            {t.rules.modeBias && t.rules.modeBias !== "either" && (
              <div className="faint mono-sm">{t.rules.modeBias} mode first</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((s) => (
          <li key={s} className="dim mono-sm" style={{ lineHeight: 1.5 }}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
