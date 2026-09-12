/**
 * qa-tools/fixture-site.mjs — a real deployable bundle, in a temp folder, on a real port.
 *
 * The site used to be tested against a stand-in api.github.com. There is no stand-in any more
 * because there is no outside service: the page reads ./release.json, and a release.json plus a
 * downloads/ folder are exactly the two things the publish job produces. So the fixture produces
 * them the same way — the files exist, with real byte lengths and real sha256 sums — and the suite
 * can then ask the question that actually matters: does the page, and does the pipeline's own
 * verifier, behave when the two disagree?
 *
 * Every fixture is served from one origin, so "no off-site request" is a measurable claim rather
 * than a hope, and `broken`/`offsite` exist to prove the verifier fails where the page alone cannot.
 */
import { createHash } from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SITE = path.resolve(import.meta.dirname, "..", "site");
export const SLOTS = ["windows-x64", "macos-arm64", "macos-x64", "linux-x64-appimage", "linux-x64-deb"];

const bytes = (n) => Buffer.alloc(n, 7);
const MB = 1048576;

/** A file entry whose size and hash describe bytes that really exist on disk. */
function file(slot, version, opts = {}) {
  const labels = {
    "windows-x64": ["Windows installer", "Hephaestus", `${version}_x64-setup.exe`, "installer"],
    "windows-x64-msi": ["Windows package", "Hephaestus", `${version}_x64_en-US.msi`, "package"],
    "macos-arm64": ["macOS · Apple silicon", "Hephaestus", `${version}_aarch64.dmg`, "disk image"],
    "macos-x64": ["macOS · Intel", "Hephaestus", `${version}_x64.dmg`, "disk image"],
    "linux-x64-appimage": ["Linux · AppImage", "Hephaestus", `${version}_amd64.AppImage`, "self-contained"],
    "linux-x64-deb": ["Linux · .deb", "hephaestus", `${version}_amd64.deb`, "package"],
    "linux-x64-rpm": ["Linux · .rpm", "hephaestus", `${version}-1.x86_64.rpm`, "package"],
  };
  const [label, stem, name, kind] = labels[slot];
  const arch = /arm64/.test(slot) ? "arm64" : "x64";
  const osn = slot.startsWith("macos") ? "macos" : slot.startsWith("windows") ? "windows" : "linux";
  const size = opts.size ?? (kind === "package" ? 2 * MB + 1000 : 3 * MB + slot.length * 111);
  const buf = bytes(size);
  const sha = createHash("sha256").update(buf).digest("hex");
  const fname = `${stem}_${name}`;
  const url = opts.url ?? `/downloads/${fname}`;
  return {
    entry: {
      id: slot, os: osn, arch, label, hint: opts.hint ?? `the ${slot} build`, required: !opts.optional,
      signing: osn === "macos" ? "unsigned, not notarised" : "unsigned",
      advisory: osn === "macos" ? "Unsigned build: right-click the app and choose Open the first time you launch it." : null,
      file: fname, url, size, sha256: sha, kind,
    },
    fname, buf, skip: opts.skip,
  };
}

export const FIXTURES = {
  /** everything published, an extra .msi nobody carded, and one earlier release still hosted */
  ready() {
    const want = [...SLOTS.map((s) => ({ slot: s })), { slot: "windows-x64-msi", optional: true }];
    const cur = want.map((w) => file(w.slot, "0.4.0", w));
    const prev = [file("windows-x64", "0.3.0"), file("linux-x64-appimage", "0.3.0")];
    return {
      doc: {
        schema: 1, status: "ready", product: "Hephaestus", version: "0.4.0",
        publishedAt: "2026-09-09", channel: "stable",
        signing: { windows: "unsigned", macos: "unsigned, not notarised", linux: "unsigned" },
        files: cur.map((f) => f.entry),
        previous: [{ version: "0.3.0", publishedAt: "2026-08-21", files: prev.map((f) => f.entry) }],
      },
      put: [...cur, ...prev],
    };
  },
  /** the committed placeholder, verbatim — proves the file in git is one the page can read */
  preparing() {
    const doc = JSON.parse(fs.readFileSync(path.join(SITE, "release.json"), "utf8"));
    return { doc, put: [] };
  },
  /** two platforms built, three still missing: the page must not invent buttons for them */
  partial() {
    const cur = [file("windows-x64", "0.4.0"), file("linux-x64-appimage", "0.4.0")];
    return {
      doc: {
        schema: 1, status: "ready", product: "Hephaestus", version: "0.4.0", publishedAt: "2026-09-09",
        channel: "stable", signing: { windows: "unsigned", macos: "unsigned, not notarised", linux: "unsigned" },
        files: cur.map((f) => f.entry), previous: [],
      },
      put: cur,
    };
  },
  /** the manifest promises a file the bundle does not contain — only the verifier can catch this */
  broken() {
    const base = FIXTURES.ready();
    const target = base.put.find((f) => f.entry.id === "macos-x64");
    target.skip = true;
    return base;
  },
  /** a download that points at somebody else's host: the page must not link it, CI must fail on it */
  offsite() {
    const base = FIXTURES.ready();
    base.doc.files[0] = { ...base.doc.files[0], url: "https://github.com/bigboi-alt/HEPHAESTUS/releases/download/v0.4.0/x.exe" };
    const i = base.put.findIndex((f) => f.entry.id === "windows-x64");
    base.put[i] = { ...base.put[i], skip: true };
    return base;
  },
  /** not JSON at all: the page has to say so instead of throwing */
  malformed() { return { raw: '{ "schema": 1, "status": "ready", ', put: [] }; },
  /** a manifest that lists nothing: "ready" with no files is a contradiction */
  empty() {
    const base = FIXTURES.ready();
    base.doc.files = [];
    base.put = [];
    base.doc.previous = [];
    return base;
  },
};

/**
 * Boot a bundle. `fixture` names one of the above; `extraHeaders` lets a suite assert the site's
 * own _headers file if it wants (it doesn't — that's ascii-qa's job, statically).
 */
export async function startSite(fixture = "ready", { port = 0 } = {}) {
  const build = FIXTURES[fixture];
  if (!build) throw new Error(`no fixture named ${fixture} (have: ${Object.keys(FIXTURES).join(", ")})`);
  const { doc, put = [], raw } = build();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "heph-site-"));
  fs.cpSync(SITE, tmp, { recursive: true });
  fs.rmSync(path.join(tmp, "README.md"), { force: true });
  fs.mkdirSync(path.join(tmp, "downloads"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "release.json"), raw ?? JSON.stringify(doc, null, 2) + "\n");
  const onDisk = new Set();
  for (const f of put) {
    if (f.skip) continue;
    fs.writeFileSync(path.join(tmp, "downloads", f.fname), f.buf);
    onDisk.add(f.fname);
  }
  const reqs = [];
  const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    reqs.push({ method: req.method, path: p });
    const rel = p === "/" ? "/index.html" : p;
    const fileOnDisk = path.join(tmp, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
    if (!fileOnDisk.startsWith(tmp) || !fs.existsSync(fileOnDisk) || !fs.statSync(fileOnDisk).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not here");
      return;
    }
    const ext = path.extname(fileOnDisk);
    const heads = { "content-type": TYPES[ext] || "application/octet-stream", "content-length": fs.statSync(fileOnDisk).size };
    if (rel.startsWith("/downloads/")) heads["content-disposition"] = `attachment; filename="${path.basename(rel)}"`;
    res.writeHead(200, heads);
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(fileOnDisk).pipe(res);
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    url: `${origin}/index.html`,
    tmp,
    doc,
    onDisk,
    reqs,
    external: () => reqs.filter((q) => /^https?:/.test(q.path)).length,
    close: () => new Promise((r) => { server.close(r); fs.rmSync(tmp, { recursive: true, force: true }); }),
  };
}
