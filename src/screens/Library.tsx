import { useMemo, useRef, useState } from "react";
import { useApp } from "../store";
import { auditPalette } from "../engine/cedalion";
import PaletteCard from "../components/PaletteCard";
import { download, fromFile, SNAPSHOT_VERSION } from "../lib/storage";
import { exportPalette } from "../engine/akmon";

type Sort = "recent" | "score" | "name";

export default function Library() {
  const { palettes, setCurrent, go, deletePalette, toggleFavorite, importPalettes, settings, purposeId } = useApp();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [favOnly, setFavOnly] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const scored = useMemo(
    () => palettes.map((p) => ({ p, score: auditPalette(p, purposeId ?? undefined).score })),
    [palettes, purposeId]
  );

  const list = useMemo(() => {
    let out = scored;
    if (favOnly) out = out.filter((x) => x.p.favorite);
    if (q.trim()) {
      const needle = q.toLowerCase();
      out = out.filter(
        (x) =>
          x.p.name.toLowerCase().includes(needle) ||
          x.p.prompt.toLowerCase().includes(needle) ||
          x.p.scheme.includes(needle) ||
          x.p.swatches.some((s) => s.hex.toLowerCase().includes(needle) || s.name.includes(needle))
      );
    }
    return [...out].sort((a, b) =>
      sort === "recent" ? b.p.createdAt - a.p.createdAt
        : sort === "score" ? b.score - a.score
          : a.p.name.localeCompare(b.p.name)
    );
  }, [scored, q, sort, favOnly]);

  function exportAll() {
    download(
      "hephaestus-library.json",
      JSON.stringify({ app: "Hephaestus", version: SNAPSHOT_VERSION, palettes, settings }, null, 2)
    );
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = fromFile(String(reader.result));
      if (parsed?.palettes) importPalettes(parsed.palettes);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div style={{ padding: "26px 22px 100px", maxWidth: 1440, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="label">library</div>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: "6px 0 2px" }}>Saved palettes</h1>
          <p className="faint mono-sm" style={{ margin: 0 }}>
            {palettes.length} card{palettes.length === 1 ? "" : "s"} · stored on this machine, no account required
          </p>
        </div>
        <div className="row gap-1">
          <button className="btn" onClick={() => fileRef.current?.click()}>import</button>
          <button className="btn" onClick={exportAll} disabled={!palettes.length}>export all</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
        </div>
      </div>

      <div className="row gap-1" style={{ marginBottom: 18, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 300 }}
          placeholder="search name, prompt, hex…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(["recent", "score", "name"] as Sort[]).map((s) => (
          <button key={s} className="btn" data-active={sort === s} onClick={() => setSort(s)}>{s}</button>
        ))}
        <button className="btn" data-active={favOnly} onClick={() => setFavOnly((v) => !v)}>★ favourites</button>
      </div>

      {list.length === 0 ? (
        <div className="panel" style={{ padding: 40, textAlign: "center" }}>
          <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>
            {palettes.length ? "Nothing matches that filter." : "The library is empty."}
          </div>
          <div className="faint mono-sm" style={{ marginBottom: 14 }}>
            Palettes you save in Akmon show up here as cards.
          </div>
          <button className="btn" onClick={() => go("akmon")}>open akmon</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {list.map(({ p, score }) => (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <PaletteCard
                p={p}
                score={score}
                onOpen={() => { setCurrent(p); go("akmon"); }}
                onFavorite={() => toggleFavorite(p.id)}
                onDelete={() => deletePalette(p.id)}
              />
              <div className="row gap-1">
                <button
                  className="btn"
                  style={{ fontSize: 10, padding: "3px 8px", flex: 1 }}
                  onClick={() => {
                    void navigator.clipboard?.writeText(exportPalette(p, "css"));
                    useApp.getState().say("css copied");
                  }}
                >
                  copy css
                </button>
                <button
                  className="btn"
                  style={{ fontSize: 10, padding: "3px 8px", flex: 1 }}
                  onClick={() => download(`${p.name.toLowerCase().replace(/\s+/g, "-")}.json`, exportPalette(p, "json"))}
                >
                  json
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
