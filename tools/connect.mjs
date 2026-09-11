#!/usr/bin/env node
/*
  One command to connect the site to your repo:

    node tools/connect.mjs <github-owner> [repo]      (repo defaults to "hephaestus")
    node tools/connect.mjs <owner> --check            asks GitHub what the page will do
    node tools/connect.mjs --clear                    back to the unconnected state

  It writes site/config.js, bakes your repo URL into the links that need one even when
  JavaScript is switched off, and regenerates the single-file preview. Run it once,
  commit site/. Everything else on the page fills itself in from the release feed.

  The rule this tool exists to protect: a link on the site may never be able to 404.
  The page therefore ships with same-page anchors only, and the download links point at
  <repo>/releases (a page GitHub always renders), never at /releases/latest, which
  404s while you have no releases. The runtime script upgrades each link to a real
  asset URL once the API has confirmed it exists.
*/
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const positional = args.filter((a) => !a.startsWith("--"));

const CFG = (owner, repo, pub) => `/* ─────────────────────────────────────────────────────────────────────────
   HEPHAESTUS · site config   —   ${owner ? "written by tools/connect.mjs" : "the file you edit to connect this site"}
   The ONLY place you edit to connect this site. Everything in site/ reads it.
   ───────────────────────────────────────────────────────────────────────── */

window.HEPH = {
  owner: "${owner}",
  repo: "${repo}",

  // true once the repo is public and anonymous visitors can see its releases.
  // while it's false the page keeps every link on itself instead of sending
  // visitors at a private repo's 404.
  sourcePublic: ${pub},

  // footer contact; "" hides it
  contact: "",
};
`;

if (flag("--clear")) {
  writeFileSync(join(root, "site/config.js"), CFG("", "hephaestus", false), "utf8");
  bake("", "hephaestus", "");
  console.log("cleared: the site is back to the unconnected state (links stay on the page)");
  process.exit(0);
}

const owner = positional[0];
const repo = positional[1] || "hephaestus";
if (!owner) {
  console.error("usage: node tools/connect.mjs <github-owner> [repo] [--check]");
  process.exit(1);
}
const gh = `https://github.com/${owner}/${repo}`;
// /releases, not /releases/latest: the first is a page GitHub renders even with no
// releases, so a baked-in fallback can't be a 404. assets are filled in at runtime.
const rel = `${gh}/releases`;
const api = `https://api.github.com/repos/${owner}/${repo}`;

if (flag("--check")) {
  const [meta, release] = await Promise.all([
    get(api),
    get(api + "/releases/latest"),
  ]);
  console.log(`\nchecking ${gh}`);
  console.log(`  repo:      ${meta ? "public and reachable" : "not visible to anonymous visitors — the page will keep its links on itself"}`);
  if (meta) console.log(`  stars:     ${meta.stargazers_count} · default branch ${meta.default_branch}`);
  console.log(`  release:   ${release ? (release.tag_name + ", " + (release.assets || []).length + " assets, " + new Date(release.published_at).toDateString()) : "none yet — the buttons will open the releases page"}`);
  const kinds = { windows: /setup\.exe$|\.msi$/i, mac: /\.dmg$/i, linux: /\.AppImage$|\.deb$/i };
  for (const [k, re] of Object.entries(kinds)) {
    const hit = ((release && release.assets) || []).filter((a) => re.test(a.name));
    console.log(`  ${k.padEnd(9)} ${hit.length ? hit.map((a) => `${a.name} (${(a.size / 1048576).toFixed(1)} MB)`).join(", ") : "no asset matching " + re}`);
  }
  if (!meta) process.exit(2);
  console.log("");
  process.exit(0);   // --check answers, it doesn't connect
}

writeFileSync(join(root, "site/config.js"), CFG(owner, repo, true), "utf8");
bake(owner, repo, rel);
execSync("node tools/site-preview.mjs", { cwd: root, stdio: "inherit" });
console.log(`\nconnected to ${gh}`);
console.log(`  the page reads ${api}/releases/latest at runtime`);
console.log("next: commit site/ and push — Cloudflare Pages redeploys on its own.");

async function get(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/vnd.github+json", "user-agent": "hephaestus-connect" } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** rewrite the fallback hrefs of every data-gh link, for visitors with JS off */
function bake(owner, repo, releasesUrl = "") {
  const p = join(root, "site", "index.html");
  let html = readFileSync(p, "utf8");
  const to = owner ? `https://github.com/${owner}/${repo}` : "";
  let n = 0;
  html = html.replace(/<a\b[^>]*>/g, (tag) => {
    const m = tag.match(/data-gh="([^"]+)"/);
    if (!m) return tag;
    const kind = m[1];
    const want = !to
      ? (kind === "main" ? "#get" : "#source")
      : kind === "repo" ? to
      : kind === "main" || kind.startsWith("asset") || kind === "releases" ? releasesUrl
      : "#source";
    const next = tag.replace(/href="[^"]*"/, `href="${want}"`);
    if (next !== tag) n++;
    return next;
  });
  writeFileSync(p, html, "utf8");
  console.log(`index.html: ${n} link${n === 1 ? "" : "s"} re-pointed${to ? ` at ${to}` : " to this page"}`);
}
