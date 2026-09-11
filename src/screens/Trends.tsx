/**
 * TREND LIBRARY — 1,700+ entries, one screen.
 *
 * Two things had to be true at this size: it must stay fast, and it must not
 * read like a database dump. So: the grid is paged (24 rows), the search is
 * debounced by memo over a folded string, filters are chips instead of a
 * dropdown, and nothing renders its example until you open it — a 1,750-row
 * page of generated mocks would be the slowest thing in the app.
 */
import { useMemo, useState } from "react";
import { TRENDS_UPDATED, TRENDS_VERSION, type Trend, type TrendStatus } from "../data/trends";
import { CATALOG, CATALOG_INFO, CATALOG_TAGS } from "../engine/catalog";
import { useApp } from "../store";
import { matchTrends } from "../engine/cedalion";
import TrendExample from "../components/TrendExample";

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

const PER_PAGE = 24;

const nf = new Intl.NumberFormat("en-US");

export default function Trends() {
  const { current, settings, setSettings, say } = useApp();
  const [filter, setFilter] = useState<TrendStatus | "all">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"matched" | "newest" | "name">("newest");
  const [syncing, setSyncing] = useState(false);

  const matched = useMemo(
    () => (current ? matchTrends(current) : []).map((m) => m.id),
    [current]
  );
  const matchedSet = useMemo(() => new Set(matched), [matched]);

  /** one folded haystack per entry, computed once for the whole catalogue */
  const haystacks = useMemo(
    () =>
      new Map(
        CATALOG.map((t) => [
          t.id,
          `${t.name} ${t.summary} ${t.tags.join(" ")} ${t.signals.join(" ")}`.toLowerCase(),
        ])
      ),
    []
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = CATALOG.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (!needle) return true;
      return (haystacks.get(t.id) ?? "").includes(needle);
    });
    if (sort === "newest") out = out.slice().sort((a, b) => +b.since - +a.since || a.name.localeCompare(b.name));
    else if (sort === "name") out = out.slice().sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "matched") out = out.slice().sort((a, b) => Number(matchedSet.has(b.id)) - Number(matchedSet.has(a.id)) || +b.since - +a.since);
    return out;
  }, [q, filter, tag, sort, haystacks, matchedSet]);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const at = Math.min(page, pages - 1);
  const slice = list.slice(at * PER_PAGE, at * PER_PAGE + PER_PAGE);
  const go = (p: number) => {
    setPage(Math.max(0, Math.min(pages - 1, p)));
    setOpen(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
          <div className="label">trend library · v{TRENDS_VERSION} · {TRENDS_UPDATED}</div>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: "6px 0 2px" }}>
            {nf.format(CATALOG.length)} ways to build it
          </h1>
        </div>
        <div className="row gap-1">
          <span className="faint mono-sm">
            {CATALOG_INFO.curated} curated by hand · {nf.format(CATALOG_INFO.composed)} composed from {CATALOG_INFO.layouts} layouts × {CATALOG_INFO.accents} accents × {CATALOG_INFO.registers} registers
          </span>
          <button className="btn" onClick={sync} disabled={syncing}>{syncing ? "checking…" : "check for updates"}</button>
        </div>
      </div>

      <p className="dim" style={{ fontSize: 12, maxWidth: 760, margin: "0 0 18px" }}>
        The {CATALOG_INFO.curated} hand-written entries are what 2026 actually settled on. The rest are composed
        the same way the direction engine composes palettes — atoms, rules, no model — and every one of them
        carries the numbers Cedalion scores against plus a recipe that names the exact preset, blocks and site
        options to use. {nf.format(CATALOG_INFO.skippedIncompatible)} combinations were dropped for fighting each other.
      </p>

      <div className="row gap-1" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder={`search ${nf.format(CATALOG.length)} entries — bento, duotone, 8px, serif`}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
        />
        {(["all", "core", "rising", "polarizing", "cooling"] as const).map((s) => (
          <button key={s} className="btn" data-active={filter === s} onClick={() => { setFilter(s); setPage(0); }}>{s}</button>
        ))}
        <span style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
        {(["newest", "matched", "name"] as const).map((s) => (
          <button key={s} className="btn" data-active={sort === s} onClick={() => setSort(s)} title={s === "matched" ? "what fits the palette in Akmon first" : undefined}>
            {s === "matched" ? "by my palette" : `sort: ${s}`}
          </button>
        ))}
      </div>

      <div className="row gap-1" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <span className="label" style={{ alignSelf: "center", marginRight: 2 }}>tag</span>
        <button className="btn" style={{ fontSize: 9.5, padding: "3px 8px" }} data-active={tag === null} onClick={() => { setTag(null); setPage(0); }}>any</button>
        {CATALOG_TAGS.slice(0, 14).map(([t, n]) => (
          <button key={t} className="btn" style={{ fontSize: 9.5, padding: "3px 8px" }} data-active={tag === t} onClick={() => { setTag(tag === t ? null : t); setPage(0); }}>
            {t} <span className="faint">{nf.format(n)}</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
        <span className="faint mono-sm" style={{ fontSize: 9 }}>
          {list.length === CATALOG.length ? `all ${nf.format(list.length)}` : `${nf.format(list.length)} of ${nf.format(CATALOG.length)}`} matched
          {current ? ` · ${matched.length} match the palette in Akmon` : ""}
        </span>
        <Pager at={at} pages={pages} go={go} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
        {slice.length === 0 && (
          <div style={{ background: "var(--bg)", padding: "34px 16px", textAlign: "center" }}>
            <div className="dim" style={{ fontSize: 12 }}>nothing in the library matches “{q}” with those filters.</div>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => { setQ(""); setFilter("all"); setTag(null); }}>clear the search</button>
          </div>
        )}
        {slice.map((t) => (
          <TrendRow
            key={t.id}
            t={t}
            open={open === t.id}
            matched={matchedSet.has(t.id)}
            curated={!t.id.includes("__")}
            onToggle={() => setOpen(open === t.id ? null : t.id)}
          />
        ))}
      </div>

      <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        <Pager at={at} pages={pages} go={go} />
      </div>

      <div className="panel" style={{ padding: 16, marginTop: 22 }}>
        <div className="label" style={{ marginBottom: 8 }}>how this stays current</div>
        <p className="dim mono-sm" style={{ margin: 0, lineHeight: 1.7 }}>
          The library ships inside the app so it works with no network, and the {nf.format(CATALOG_INFO.composed)} composed entries are
          generated from atoms at startup — deterministic, so the same id is the same trend on every machine and nothing is fetched.
          If you set a remote URL, the app merges an updated <code>trends.json</code> by id on launch: you push once to a public
          gist or repo and every installed copy learns the new trend.
          {CATALOG_INFO.possible > CATALOG.length
            ? ` The atom space allows ${nf.format(CATALOG_INFO.possible)} combinations; ${nf.format(CATALOG_INFO.skippedIncompatible)} of them fight each other and are not shown, and the rest are capped at ${nf.format(CATALOG_INFO.composed)} so the list stays usable.`
            : ""}
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

function Pager({ at, pages, go }: { at: number; pages: number; go: (p: number) => void }) {
  if (pages <= 1) return null;
  const window: number[] = [];
  for (let i = Math.max(0, at - 2); i < Math.min(pages, at + 3); i++) window.push(i);
  return (
    <div className="row gap-1">
      <button className="btn" style={{ fontSize: 9.5, padding: "3px 8px" }} disabled={at === 0} onClick={() => go(0)}>«</button>
      <button className="btn" style={{ fontSize: 9.5, padding: "3px 8px" }} disabled={at === 0} onClick={() => go(at - 1)}>←</button>
      {window.map((p) => (
        <button key={p} className="btn" style={{ fontSize: 9.5, padding: "3px 9px" }} data-active={p === at} onClick={() => go(p)}>
          {p + 1}
        </button>
      ))}
      <button className="btn" style={{ fontSize: 9.5, padding: "3px 8px" }} disabled={at >= pages - 1} onClick={() => go(at + 1)}>→</button>
      <button className="btn" style={{ fontSize: 9.5, padding: "3px 8px" }} disabled={at >= pages - 1} onClick={() => go(pages - 1)}>»</button>
      <span className="faint mono-sm" style={{ fontSize: 8.5, paddingLeft: 4 }}>{at + 1} / {pages}</span>
    </div>
  );
}

function TrendRow({ t, open, matched, curated, onToggle }: {
  t: Trend; open: boolean; matched: boolean; curated: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ background: "var(--bg)" }}>
      <button onClick={onToggle} style={{ width: "100%", textAlign: "left", padding: "12px 16px", display: "block" }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div className="row gap-2" style={{ minWidth: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[t.status], flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{t.name}</span>
            {curated && (
              <span className="mono-sm" style={{ fontSize: 8, color: "var(--fg-faint)", border: "1px solid var(--line)", padding: "0 4px" }} title="written and checked by hand, not composed">curated</span>
            )}
            {matched && <span className="mono-sm" style={{ color: "var(--accent)", fontSize: 9 }}>· matches your palette</span>}
          </div>
          <div className="row gap-2" style={{ flexShrink: 0 }}>
            <span className="faint mono-sm">{STATUS_NOTE[t.status]}</span>
            <span className="faint mono-sm">since {t.since}</span>
            <span className="faint">{open ? "−" : "+"}</span>
          </div>
        </div>
        <div className="dim mono-sm" style={{ marginTop: 5, lineHeight: 1.6, maxWidth: 900 }}>{t.summary}</div>
      </button>

      {open && (
        <div className="fade-in" style={{ padding: "0 16px 16px 32px" }}>
          <div className="row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ width: 300, maxWidth: "100%", flexShrink: 0 }}>
              <div className="label" style={{ marginBottom: 6 }}>example</div>
              <TrendExample t={t} />
            </div>
            <div style={{ flex: "1 1 300px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
              <Block title="visual signals" items={t.signals} />
              <Block title="use when" items={t.useWhen} />
              {t.avoidWhen.length > 0 && <Block title="avoid when" items={t.avoidWhen} />}
              <div>
                <div className="label" style={{ marginBottom: 6 }}>how to build it here</div>
                <code className="dim mono-sm" style={{ lineHeight: 1.7, display: "block", whiteSpace: "pre-wrap" }}>{t.recipe}</code>
                <div className="row gap-1" style={{ marginTop: 8, flexWrap: "wrap" }}>
                  {t.rules.contrastMin && <span className="mono-sm faint" style={{ border: "1px solid var(--line)", padding: "1px 6px", fontSize: 8.5 }}>contrast floor {t.rules.contrastMin}:1</span>}
                  {t.rules.chroma && <span className="mono-sm faint" style={{ border: "1px solid var(--line)", padding: "1px 6px", fontSize: 8.5 }}>chroma {t.rules.chroma[0]}–{t.rules.chroma[1]}</span>}
                  {t.rules.radius && <span className="mono-sm faint" style={{ border: "1px solid var(--line)", padding: "1px 6px", fontSize: 8.5 }}>radius {t.rules.radius[0]}–{t.rules.radius[1]}px</span>}
                  {t.rules.modeBias && t.rules.modeBias !== "either" && (
                    <span className="mono-sm faint" style={{ border: "1px solid var(--line)", padding: "1px 6px", fontSize: 8.5 }}>{t.rules.modeBias} mode first</span>
                  )}
                </div>
              </div>
            </div>
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
        {items.map((s, i) => (
          <li key={`${s}-${i}`} className="dim mono-sm" style={{ lineHeight: 1.5 }}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
