#!/usr/bin/env node
/*
  tools/release-manifest.mjs — the one place that decides what a "release" is.

  It is deliberately dumb and total: it reads a folder of installers produced by the build jobs,
  refuses the whole batch if any required file is missing, empty, absurdly large, or named for a
  different version than the three config files agree on, and only then writes two things a static
  host can serve:

      <downloads>/<exact filenames>        the installers themselves
      <out>/release.json                   what exists, where it is, how big, and its sha256

  The website reads release.json from its own origin and nothing else — no GitHub API, no
  artifact URLs, no visitor-side network call beyond one same-origin fetch — so the pipeline behaves
  identically whether the repository is public or private, and a GitHub outage cannot break a
  download.

  `--check-only` is the mode the preflight run uses: every rule is enforced, and nothing is
  written, so a build can be validated without a deploy existing.

  usage
    node tools/release-manifest.mjs --check-config                 [--expect-tag v0.4.0]
    node tools/release-manifest.mjs --print-required
    node tools/release-manifest.mjs --scan <dir>… [--version 0.4.0]
          [--out site-built/release.json] [--downloads site-built/downloads]
          [--carry-from <dir|https://project.pages.dev>] [--check-only] [--date YYYY-MM-DD] [--json]

  No dependencies, no network unless you hand it an https --carry-from.
*/
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** The floor for a real Tauri bundle. Anything smaller is a truncated or empty upload. */
export const MIN_BYTES = 1024 * 1024;
/** The ceiling: above this, something was packaged wrong (a target/ dir swept up by a bad glob). */
export const MAX_BYTES = 400 * 1024 * 1024;
/**
 * What the delivery host can actually hold. Cloudflare Pages refuses any single asset over 25 MiB —
 * a platform rule with no setting behind it — and a bundle containing a bigger file fails inside
 * `wrangler pages deploy`, i.e. after four platforms were built and paid for, and again on every
 * later site deploy that carries that release forward. So the number is checked here, where the
 * answer can still be a decision rather than a stack trace.
 */
export const PAGES_MAX_FILE = 25 * 1024 * 1024;
export const OVER_PAGES = (f) =>
  `${f.file} is ${(f.size / 1048576).toFixed(1)} MB and Cloudflare Pages refuses any single file over 25 MiB, ` +
  `so it cannot live in the site's own bundle. Two ways out: ` +
  `(1) take "${f.ext}" out of src-tauri/tauri.conf.json bundle.targets — the required-slot list follows the config, ` +
  `and the site then says "not in this release" for that platform instead of lying about a link; ` +
  `(2) keep it and serve it from outside Pages (R2 behind the same /downloads/ url via a Pages Function — ` +
  `PLAN.md §"Files bigger than Pages"). Nothing half-published: the release stops here, live site untouched.`;

/* ── config ─────────────────────────────────────────────────────────────── */

export function readVersions(root = ROOT) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const cargo = /version\s*=\s*"([^"]+)"/.exec(readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8"))?.[1];
  const conf = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));
  return { npm: pkg, cargo, tauri: conf.version ?? pkg, targets: conf.bundle?.targets ?? "all", productName: conf.productName ?? "Hephaestus" };
}

/**
 * Which files a release must contain. Derived from tauri.conf's bundle.targets rather than
 * hard-coded, so changing the config changes the gate — and the gate can be read before a build
 * is paid for. `all` means "whatever each runner's default set produces", which for Tauri v2 is:
 * NSIS + MSI on Windows, DMG on macOS (one build per arch), DEB + AppImage on Linux.
 */
export function slotsFor(targets) {
  const all = targets === "all" || !Array.isArray(targets);
  const wants = (t) => all || targets.includes(t);       // did the config ask for this bundler at all
  return [
    { id: "windows-x64", os: "windows", arch: "x64", ext: "exe", prefer: /setup/i, primary: wants("nsis"),
      label: "Windows installer", hint: "Windows 10 and 11, 64-bit", signing: "unsigned" },
    { id: "windows-x64-msi", os: "windows", arch: "x64", ext: "msi", from: "msi",
      label: "Windows package", hint: "for managed machines that deploy with .msi", signing: "unsigned" },
    { id: "macos-arm64", os: "macos", arch: "arm64", ext: "dmg", primary: wants("dmg"),
      label: "macOS · Apple Silicon", hint: "M1, M2, M3, M4", signing: "unsigned, not notarised",
      advisory: "Unsigned build: right-click the app and choose Open the first time you launch it." },
    { id: "macos-x64", os: "macos", arch: "x64", ext: "dmg", primary: wants("dmg"),
      label: "macOS · Intel", hint: "Macs from 2015-2020", signing: "unsigned, not notarised",
      advisory: "Unsigned build: right-click the app and choose Open the first time you launch it." },
    { id: "linux-x64-appimage", os: "linux", arch: "x64", ext: "appimage", primary: wants("appimage"),
      label: "Linux · AppImage", hint: "any recent distro: chmod +x and run", signing: "unsigned" },
    { id: "linux-x64-deb", os: "linux", arch: "x64", ext: "deb", primary: wants("deb"),
      label: "Linux · .deb", hint: "Debian and Ubuntu", signing: "unsigned" },
    { id: "linux-x64-rpm", os: "linux", arch: "x64", ext: "rpm", from: "rpm",
      label: "Linux · .rpm", hint: "Fedora and openSUSE", signing: "unsigned" },
  ].map((s) => ({
    ...s,
    required: !!s.primary,                                             // a release without this is a partial release
    configured: s.primary !== undefined ? s.primary : wants(s.from),  // built if present, missed if not
  }));
}

/* ── classifying what the runners produced ───────────────────────────────── */

const EXT_OF = (name) => (/\.[A-Za-z0-9]+$/.exec(name)?.[0] || "").toLowerCase();
const ARCH_OF = (name) => (/aarch64|arm64|apple[-_ ]silicon/i.test(name) ? "arm64"
  : /x86_64|amd64|x64/i.test(name) ? "x64" : /i686|x86(?!_64)/i.test(name) ? "x86" : "any");
const VER_OF = (name) => /[-_ ](\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)[-_.]/.exec(name)?.[1] ?? null;

/** The files a release may ship, and the ones that must never be published. */
export function classify(dir) {
  const out = [];
  for (const name of walk(dir)) {
    const ext = EXT_OF(name);
    const f = { file: name, ext, arch: ARCH_OF(name), version: VER_OF(name) };
    if (ext === ".sig") f.reject = "an updater signature — there is no updater configured, and it is not a download";
    else if (ext === ".app") f.reject = "a bare .app inside a bundle dir; the .dmg is the deliverable";
    else if (ext === ".dmg" || ext === ".exe" || ext === ".msi" || ext === ".deb" || ext === ".appimage" || ext === ".rpm") {
      f.os = ext === ".dmg" ? "macos" : ext === ".exe" || ext === ".msi" ? "windows" : "linux";
      // a .dmg built for arm64 says so; a bare .dmg on an Intel runner is x64
      if (f.os === "macos" && f.arch === "any") f.arch = "x64";
    } else f.reject = "not a package this pipeline knows how to publish";
    out.push(f);
  }
  return out;
}

function walk(dir, prefix = "") {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) found.push(...walk(join(dir, e.name), rel));
    else if (e.isFile()) found.push(rel);
  }
  return found;
}

/* ── the rules ───────────────────────────────────────────────────────────── */

/**
 * One function, all the rules. Returns { errors, warnings, release } — and `release` is only
 * meaningful when errors is empty, because a manifest is never written for a broken batch.
 */
export function build({ scanned, version, date, productName, carry = null, slots = null, githubRepo = null, baseUrl = null }) {
  const errors = [];
  const warnings = [];
  const want = slots ?? slotsFor("all");
  const files = [];
  for (const s of scanned) {
    const st = statSync(resolve(s.dir, s.file));
    s.size = st.size;
    s.sha256 = sha256(join(s.dir, s.file));
    if (s.reject) { warnings.push(`skipped ${s.file}: ${s.reject}`); continue; }
    files.push(s);
  }

  if (!version) errors.push("no version to check against: pass --version or keep package.json/Cargo.toml/tauri.conf.json in sync (node tools/bump.mjs 0.4.0)");
  if (version && !/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(version)) errors.push(`version "${version}" is not x.y.z`);

  const bySlot = new Map();
  for (const slot of want) {
    const pool = files.filter((f) => f.os === slot.os && f.ext === `.${slot.ext}`
      && (f.arch === slot.arch || f.arch === "any" || slot.arch === "any"));
    const best = (slot.prefer ? pool.find((f) => slot.prefer.test(f.file)) : null) || pool[0] || null;
    if (!best) {
      if (slot.required) errors.push(`missing ${slot.id} (${slot.ext}) — required for a complete release`);
      else if (slot.configured) warnings.push(`${slot.id} is in bundle.targets but nothing matched it — it ships as an extra when it exists, and its absence is not a failed release`);
      continue;
    }
    bySlot.set(slot.id, best);
  }

  const effectiveRepo = githubRepo || (process.env.GITHUB_REPOSITORY || null);
  const urlPrefix = effectiveRepo
    ? `https://github.com/${effectiveRepo}/releases/download/v${version}/`
    : baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/`
      : "/downloads/";
  const isExternal = urlPrefix.startsWith("http://") || urlPrefix.startsWith("https://");

  for (const f of files) {
    if (f.size < MIN_BYTES) errors.push(`${f.file} is ${f.size} bytes — below the ${MIN_BYTES / 1024} KiB floor for a real bundle. Empty or truncated upload.`);
    if (f.size > MAX_BYTES) errors.push(`${f.size / 1048576 | 0} MB for ${f.file} is past the ${MAX_BYTES / 1048576} MB ceiling — a build glob probably swept the target dir`);
    if (!isExternal && f.size > PAGES_MAX_FILE) errors.push(OVER_PAGES(f));
    if (version && f.version && f.version !== version)
      errors.push(`${f.file} carries version ${f.version} while the config says ${version} — a stale artifact would have shipped`);
    if (version && !f.version) warnings.push(`${f.file} has no version in its filename; trusting the build's config check`);
  }

  const seen = new Set();
  for (const [, f] of bySlot) {
    if (seen.has(f.file)) errors.push(`${f.file} matched two slots — the classifier cannot tell them apart, name files with their arch`);
    seen.add(f.file);
  }

  const list = want.filter((s) => bySlot.has(s.id)).map((s) => {
    const f = bySlot.get(s.id);
    const fileUrl = isExternal ? `${urlPrefix}${basename(f.file)}` : `/downloads/${basename(f.file)}`;
    return {
      id: s.id, os: s.os, arch: s.arch, label: s.label, hint: s.hint ?? null,
      required: !!s.required, signing: s.signing ?? "unsigned",
      advisory: s.advisory ?? null,
      file: basename(f.file), url: fileUrl,
      size: f.size, sha256: f.sha256, kind: KIND[`.${s.ext}`] ?? "installer",
    };
  });

  const release = {
    schema: 1,
    status: "ready",
    product: productName ?? "Hephaestus",
    version: version ?? null,
    publishedAt: date ?? new Date().toISOString().slice(0, 10),
    channel: /[-+]/.test(version || "") ? "prerelease" : "stable",
    signing: { windows: "unsigned", macos: "unsigned, not notarised", linux: "unsigned" },
    files: list,
    previous: carry?.previous ?? [],
  };
  if (!list.some((f) => f.required)) errors.unshift("nothing required was found — refusing to write a manifest with no installers");
  return { errors, warnings, release, bySlot };
}
const KIND = { ".exe": "installer", ".msi": "package", ".dmg": "disk image", ".deb": "package", ".rpm": "package", ".appimage": "self-contained" };

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Live metadata to carry forward, from a directory or a deployed URL. Best-effort by design:
 *  the first release has nowhere to carry from, and that is not a failure. */
export async function readCarry(from) {
  if (!from) return null;
  let doc = null;
  let dir = null;
  if (/^https?:\/\//.test(from)) {
    const base = from.replace(/\/$/, "");
    try {
      // ?_ defeats this host's own 60-second cache on /release.json: reading a cached manifest here
      // would carry the previous release's file list instead of the one published seconds ago.
      const r = await fetch(`${base}/release.json?_=${Date.now()}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) return { ok: false, why: `the live site answered ${r.status} for /release.json` };
      const body = await r.text();
      try { doc = JSON.parse(body); }
      catch (e) {
        const kind = /html/i.test(r.headers.get("content-type") || "") || /^\s*<(!doctype|html)/i.test(body)
          ? "an HTML page, not JSON — the live host is running an older build with no release.json of its own"
          : `a body that is not JSON (${e.message})`;
        return { ok: false, why: `the live site answered with ${kind}` };
      }
    } catch (e) { return { ok: false, why: `could not reach the live release file (${e.message})` }; }
    dir = null;   // files are pulled by fetchLiveFile below
  } else {
    dir = resolve(from);
    const p = join(dir, "release.json");
    if (!existsSync(p)) return { ok: false, why: `${p} does not exist` };
    doc = JSON.parse(readFileSync(p, "utf8"));
  }
  if (!doc || doc.status !== "ready") return { ok: false, why: "the live release file isn't a published release (probably still preparing)" };
  const keep = (doc.files || []).concat((doc.previous || []).flatMap((v) => v.files || []));
  return { ok: true, doc, dir, base: dir ? null : from, keep, previous: carryPrevious(doc) };
}

/** The old release becomes history; history is kept for five releases and never duplicated. */
function carryPrevious(doc) {
  const entry = { version: doc.version, publishedAt: doc.publishedAt, files: doc.files || [] };
  const rest = (doc.previous || []).filter((p) => p.version !== entry.version);
  if (!entry.version) return rest.slice(0, 4);
  return [entry, ...rest].slice(0, 4);
}

export async function fetchLiveFile(base, urlPath, intoDir) {
  const r = await fetch(`${base.replace(/\/$/, "")}${urlPath}`, { signal: AbortSignal.timeout(120000), redirect: "follow" });
  if (!r.ok) throw new Error(`${r.status} for ${urlPath}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const dest = join(intoDir, basename(urlPath));
  writeFileSync(dest, buf);
  return dest;
}

/* ── writing ─────────────────────────────────────────────────────────────── */

/**
 * `out` is a file path, `downloads` a directory. History is pulled from wherever it lives — a
 * directory when a previous build was checked out next to this one, the live site when not — and a
 * file that can't be fetched is only a note: an old installer going missing must never block a new
 * release, and it never deletes anything, because nothing is deleted here.
 */
export async function writeRelease({ release, out, downloads, bySlot, carry, noCopy = false }) {
  mkdirSync(resolve(out, ".."), { recursive: true });
  const placed = [];
  const kept = [];
  const lost = [];

  if (!noCopy && downloads) {
    mkdirSync(downloads, { recursive: true });
    for (const [, f] of bySlot) {
      copyFileSync(resolve(f.dir, f.file), join(downloads, basename(f.file)));
      placed.push(basename(f.file));
    }
    if (carry?.ok) {
      for (const f of carry.keep) {
        const name = basename(f.url || f.file);
        const dest = join(downloads, name);
        if (existsSync(dest)) { kept.push(name); continue; }
        if (carry.dir) {
          const src = join(carry.dir, "downloads", name);
          if (existsSync(src)) { copyFileSync(src, dest); kept.push(name); continue; }
        }
        if (carry.base) {
          try { await fetchLiveFile(carry.base, f.url || `/${name}`, downloads); kept.push(name); continue; }
          catch (e) { lost.push(`${name} (${e.message})`); continue; }
        }
        lost.push(name);
      }
    }
  } else {
    for (const [, f] of bySlot) placed.push(basename(f.file));
  }

  writeFileSync(resolve(out), JSON.stringify(release, null, 2) + "\n");
  return { placed, kept, lost };
}

/* ── cli ────────────────────────────────────────────────────────────────── */
/*  Everything above is importable, so the QA can run the very functions CI runs. The CLI only
    fires when this file is executed as a program — importing it must never exit the process. */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

async function main() {

  const args = process.argv.slice(2);
  const flag = (n) => args.includes(n);
  const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const allVals = (n) => args.reduce((acc, a, i) => (a === n ? [...acc, args[i + 1]] : acc), []);

  if (flag("--print-required")) {
    const v = readVersions();
    console.log(`tauri bundle.targets: ${JSON.stringify(v.targets)}`);
    for (const s of slotsFor(v.targets)) {
      const state = s.required ? "required" : s.configured ? "built, optional" : "not built";
      console.log(`  ${state.padEnd(16)}${s.id.padEnd(20)} ${s.os}/${s.arch} .${s.ext}`);
    }
    console.log(`\nversions: package.json ${v.npm} · Cargo.toml ${v.cargo} · tauri.conf.json ${v.tauri}`);
    process.exit(0);
  }

  if (flag("--check-config")) {
    const v = readVersions();
    const errs = [];
    if (!(v.npm === v.cargo && v.npm === v.tauri)) errs.push(`version drift: package.json ${v.npm}, Cargo.toml ${v.cargo}, tauri.conf.json ${v.tauri} — fix with node tools/bump.mjs ${v.npm}`);
    const tag = val("--expect-tag");
    if (tag) {
      const want = tag.replace(/^v/, "");
      if (want !== v.npm) errs.push(`the tag says v${want} and the configs say ${v.npm} — a release built from this ref would be mislabelled (bump first, then tag)`);
    }
    if (errs.length) { for (const e of errs) console.log(`::error::${e}`); process.exit(1); }
    console.log(`configs agree on ${v.npm}; targets ${JSON.stringify(v.targets)}`);
    process.exit(0);
  }

  const scanDirs = allVals("--scan");
  if (!scanDirs.length) {
    console.error("usage: node tools/release-manifest.mjs --scan <dir> [--scan <dir>…] [--version 0.4.0] [--out site-built/release.json] [--downloads site-built/downloads] [--carry-from <dir|url>] [--check-only]");
    process.exit(2);
  }
  const cfg = readVersions();
  const version = val("--version") || (cfg.npm === cfg.cargo && cfg.npm === cfg.tauri ? cfg.npm : null);
  const scanned = scanDirs.flatMap((d) => classify(resolve(d)).map((f) => ({ ...f, dir: resolve(d) })));
  const carry = await readCarry(val("--carry-from"));
  const githubRepoVal = val("--github-release") || (flag("--github-release") ? "bigboi-alt/HEPHAESTUS" : undefined);
  const baseUrlVal = val("--base-url");
  const noCopy = flag("--no-copy") || Boolean(githubRepoVal || baseUrlVal);

  const { errors, warnings, release, bySlot } = build({
    scanned, version, date: val("--date"), productName: cfg.productName, carry, slots: slotsFor(cfg.targets),
    githubRepo: githubRepoVal, baseUrl: baseUrlVal,
  });
  if (carry && !carry.ok) warnings.push(`carry-forward skipped: ${carry.why} — the live site's older files will not be re-uploaded, so nothing is deleted either`);

  for (const w of warnings) console.log(`  note  ${w}`);
  if (errors.length) {
    for (const e of errors) console.log(`  FAIL  ${e}`);
    if (process.env.GITHUB_ACTIONS) for (const e of errors) console.log(`::error::${e}`);
    console.error(`\nrelease rejected: ${errors.length} problem${errors.length === 1 ? "" : "s"} in ${scanned.length} file${scanned.length === 1 ? "" : "s"} scanned`);
    process.exit(1);
  }

  const out = val("--out") || join(ROOT, "site-built/release.json");
  const downloads = val("--downloads") || join(ROOT, "site-built/downloads");
  if (flag("--check-only")) {
    console.log(`release verified: ${version} · ${release.files.length} file${release.files.length === 1 ? "" : "s"} · ${(release.files.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(1)} MB total`);
    for (const f of release.files) console.log(`  ok  ${f.id.padEnd(20)} ${(f.size / 1048576).toFixed(1).padStart(6)} MB  ${f.file}`);
    if (flag("--json")) console.log(JSON.stringify(release, null, 2));
    process.exit(0);
  }
  const { placed, kept, lost } = await writeRelease({ release, out, downloads, bySlot, carry, noCopy });
  console.log(`wrote ${out} (${release.files.length} files, ${release.previous.length} previous release${release.previous.length === 1 ? "" : "s"})`);
  if (!noCopy) {
    console.log(`downloads: ${placed.length} new${kept.length ? `, ${kept.length} carried forward` : ""} in ${downloads}`);
  } else {
    console.log(`downloads: ${placed.length} files referenced via external release host`);
  }
  if (lost.length) console.log(`  note  ${lost.length} older file${lost.length === 1 ? "" : "s"} could not be carried and stays only on its own deployment: ${lost.join(", ")}`);
  if (flag("--json")) console.log(JSON.stringify(release, null, 2));
}
