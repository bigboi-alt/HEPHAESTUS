#!/usr/bin/env node
/*
  One command to connect the site to your repo:

    node tools/connect.mjs <github-owner> [repo]     (repo defaults to "hephaestus")

  It writes site/config.js, replaces the fallback links in the two pages with your real
  releases URL, and regenerates the single-file preview. Run it once; commit site/.
*/
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [owner, repo = "hephaestus"] = process.argv.slice(2);
if (!owner || owner.startsWith("-")) {
  console.error("usage: node tools/connect.mjs <github-owner> [repo]");
  process.exit(1);
}
const gh = `https://github.com/${owner}/${repo}`;
const rel = `${gh}/releases/latest`;

const cfg = `/* ─────────────────────────────────────────────────────────────────────────
   HEPHAESTUS · site config   —   written by tools/connect.mjs
   The ONLY place you edit to connect this site. Everything in site/ reads it.
   ───────────────────────────────────────────────────────────────────────── */

window.HEPH = {
  owner: "${owner}",
  repo: "${repo}",

  // the repo's releases are visible to anonymous visitors, so the download
  // buttons can fill themselves in. flip to false if you ever go private.
  sourcePublic: true,

  // footer contact; "" hides it
  contact: "",
};
`;
writeFileSync(join(root, "site/config.js"), cfg, "utf8");

for (const page of ["index.html"]) {
  const p = join(root, "site", page);
  let t = readFileSync(p, "utf8");
  // 1. collapse anything a previous run baked in, back to the bare sentinel
  t = t.replace(/href="https:\/\/github\.com(?:\/[^"']*)?"/g, 'href="https://github.com"');
  // 2. then aim each kind of link where it belongs
  const before = t;
  t = t.replace(/href="https:\/\/github\.com"( data-kind=)/g, `href="${rel}"$1`);
  t = t.replace(/(id="mainBtn" href=")https:\/\/github\.com(")/g, `$1${rel}$2`);
  t = t.replace(/(id="srcLink" href=")https:\/\/github\.com(")/g, `$1${gh}$2`);
  t = t.replace(/href="https:\/\/github\.com"( id="srcFoot")/g, `href="${gh}"$1`);
  const n = (t.match(new RegExp(gh.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  writeFileSync(p, t, "utf8");
  console.log(`${page}: ${n} links now point at your repo (${n ? "releases + repo root" : "nothing to rewrite"})`);
  if (t === before && !owner) console.log("  (no changes)");
}

execSync("node tools/site-preview.mjs", { cwd: root, stdio: "inherit" });
console.log(`\nconnected to ${gh}`);
console.log(`  releases feed: ${rel}`);
console.log("next: commit site/ and push — Cloudflare Pages redeploys on its own.");
