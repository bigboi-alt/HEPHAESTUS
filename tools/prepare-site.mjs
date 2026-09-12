#!/usr/bin/env node
/*
  tools/prepare-site.mjs — the one way this repo turns `site/` into something to deploy, used by
  both workflows so neither can invent its own idea of a build.

  It is a copy, plus one rule that matters: **a deploy must never delete a published release.**
  `site/` in the repo carries a `preparing` placeholder because the installers are not in git, so
  uploading the folder as-is over a live release would leave every download link pointing at a
  file that used to exist. So the build directory is assembled from the repo *and* whatever the
  live site currently serves.

      node tools/prepare-site.mjs --into site-built                      # local, no carry
      node tools/prepare-site.mjs --into site-built \
           --carry-from https://hephaestus-app.pages.dev                  # docs deploy: keep live release
      node tools/prepare-site.mjs --into site-built --files-only \
           --carry-from https://hephaestus-app.pages.dev                  # release deploy: keep old files,
                                                                           # release.json comes next from
                                                                           # tools/release-manifest.mjs

  Carrying is best-effort on purpose: a first deploy has nothing to carry, and that is not a
  failure. A failed fetch is reported and the deploy proceeds with what the repo has.
*/
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES_MAX_FILE } from "./release-manifest.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
// args[i+1] on a missing flag would return args[0] — i.e. the *other* flag's value. Guard it.
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes(n);

const into = resolve(val("--into") || join(ROOT, "site-built"));
const siteDir = resolve(val("--site-dir") || join(ROOT, "site"));
const carryFrom = val("--carry-from");
const filesOnly = flag("--files-only");
const PLACEHOLDER = {
  schema: 1, status: "preparing", product: "Hephaestus", version: null, publishedAt: null,
  channel: "stable", signing: { windows: "unsigned", macos: "unsigned, not notarised", linux: "unsigned" },
  files: [], previous: [],
  note: "Written by hand into the repo on purpose. The publish job in .github/workflows/release.yml replaces it with a generated manifest listing real files; until then the site says \"not published yet\", which is the truth rather than a broken link.",
};

if (!existsSync(join(siteDir, "index.html"))) { console.error(`no site/index.html under ${siteDir}`); process.exit(1); }

rmSync(into, { recursive: true, force: true });
mkdirSync(into, { recursive: true });
cpSync(siteDir, into, { recursive: true });
// the folder's own notes belong to the repository, not to the people visiting the site
rmSync(join(into, "README.md"), { force: true });

let doc = null;
let base = null;
if (carryFrom) {
  if (/^https?:\/\//.test(carryFrom)) base = carryFrom.replace(/\/$/, "");
  else if (existsSync(join(resolve(carryFrom), "release.json"))) doc = JSON.parse(readFileSync(join(resolve(carryFrom), "release.json"), "utf8"));
  else console.log(`  note  nothing to carry at ${carryFrom} — proceeding with the repo's own copy`);
}
const list = async () => {
  if (doc) return doc;
  if (!base) return null;
  try {
    // The query string is load-bearing, not noise: /release.json is served with max-age=60, so a
    // deploy that runs seconds after a release publish could otherwise read the PREVIOUS manifest out
    // of the cache and upload a bundle without the new release's files in it.
    const r = await fetch(`${base}/release.json?_=${Date.now()}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) { console.log(`  note  the live site answered ${r.status} for /release.json — nothing to carry`); return null; }
    const body = await r.text();
    try { return JSON.parse(body); }
    catch (e) {
      const kind = /html/i.test(r.headers.get("content-type") || "") || /^\s*<(!doctype|html)/i.test(body)
        ? "an HTML page, not JSON — that host is serving an older build of the site, one that predates release.json"
        : `a body that is not JSON (${e.message})`;
      console.log(`  note  the live site answered with ${kind} — nothing to carry, and nothing deleted either`);
      return null;
    }
  } catch (e) { console.log(`  note  could not reach the live release file (${e.message}) — nothing to carry`); return null; }
};
const live = await list();
const downloads = join(into, "downloads");
mkdirSync(downloads, { recursive: true });
let carried = 0;
let lost = 0;
const tooBig = [];
const liveSize = (name) => {
  const all = ((live && live.files) || []).concat(((live && live.previous) || []).flatMap((v) => v.files || []));
  return (all.find((f) => basename(String(f.url || f.file || "")) === name) || {}).size ?? 0;
};
if (live && live.status === "ready") {
  const files = (live.files || []).concat((live.previous || []).flatMap((v) => v.files || []));
  for (const f of files) {
    const name = basename(String(f.url || f.file || ""));
    if (!name || existsSync(join(downloads, name))) continue;
    // Checked before fetching: a bundle containing a >25 MiB file is refused by Pages outright, so
    // downloading it to find out would waste the transfer and fail the deploy step anyway. A site
    // push must not be held hostage by this either — it exits with the reason, naming the file.
    if (Number(f.size) > PAGES_MAX_FILE) { tooBig.push({ name, size: Number(f.size), ext: name.split(".").pop() }); continue; }
    const fromDir = !base ? resolve(carryFrom) : null;
    if (fromDir && existsSync(join(fromDir, "downloads", name))) { copyFileSync(join(fromDir, "downloads", name), join(downloads, name)); carried++; continue; }
    if (base) {
      try {
        const r = await fetch(`${base}${f.url}`, { signal: AbortSignal.timeout(180000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        writeFileSync(join(downloads, name), Buffer.from(await r.arrayBuffer()));
        carried++;
        continue;
      } catch (e) { lost++; console.log(`  note  could not carry ${name} (${e.message})`); continue; }
    }
    lost++;
  }
  // Then measure what actually landed, because a manifest is a claim: a file it declared as 8 MB that
  // arrives at 76 MB would pass the check above and be refused by Pages at the deploy step instead.
  for (const name of readdirSync(downloads)) {
    const size = statSync(join(downloads, name)).size;
    if (size > PAGES_MAX_FILE && !tooBig.some((t) => t.name === name))
      tooBig.push({ name, size, lied: true });
  }
  if (tooBig.length) {
    // Refusing here is the honest half of the rule. Dropping those files and deploying anyway would
    // ship a bundle whose release.json still advertises them — a hole in the live site, which is the
    // one thing this folder's whole design exists to prevent.
    console.log("");
    for (const t of tooBig)
      console.log(`  FAIL  ${t.name} is ${(t.size / 1048576).toFixed(1)} MB${t.lied ? ` (its release.json claims ${(Number(liveSize(t.name)) / 1048576).toFixed(1)} MB — the manifest and the bytes disagree, which is its own problem)` : ""} — Cloudflare Pages refuses any single file over `
        + `${PAGES_MAX_FILE / 1048576} MiB, so it cannot be carried into this bundle, and carrying the release without it `
        + `would leave the site advertising a download that 404s`);
    console.log("  This deploy stops here. Fix the release, not the deploy:");
    console.log("    · take that bundler out of src-tauri/tauri.conf.json bundle.targets, bump, and publish again; or");
    console.log('    · host those files outside Pages and keep the same url (R2 behind a Pages Function) — PLAN.md §"Files bigger than Pages".');
    if (process.env.GITHUB_ACTIONS) for (const t of tooBig) console.log(`::error::${t.name} is over the 25 MiB Pages file ceiling and cannot be carried into the bundle`);
    process.exit(1);
  }
  if (!filesOnly) { writeFileSync(join(into, "release.json"), JSON.stringify(live, null, 2) + "\n"); doc = live; }
} else if (live) console.log(`  note  the live release.json is not a published release (${live.status}) — keeping the repo's`);

if (!existsSync(join(into, "release.json"))) writeFileSync(join(into, "release.json"), JSON.stringify(PLACEHOLDER, null, 2) + "\n");

const shown = JSON.parse(readFileSync(join(into, "release.json"), "utf8"));
console.log(`built ${into}`);
console.log(`  release.json: ${shown.status}${shown.version ? ` ${shown.version}` : ""} · ${(shown.files || []).length} file${(shown.files || []).length === 1 ? "" : "s"}`);
console.log(`  downloads/: ${readdirSync(downloads).length} file${readdirSync(downloads).length === 1 ? "" : "s"} (${carried} carried${lost ? `, ${lost} unreachable` : ""})`);
if (filesOnly) console.log("  (--files-only: the metadata in the folder is left to the release manifest to write)");
