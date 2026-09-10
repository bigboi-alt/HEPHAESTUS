#!/usr/bin/env node
/*
  Builds a single-file, offline-friendly copy of the site: site-preview.html.

  Why: the sandboxed file preview some tools use has no network access, so a page that
  fetches its own assets shows nothing. This inlines every local asset as a data URI and
  folds config.js into the document, so one file shows the whole site.

  It is a VIEWING copy. Deploy site/, never this file.

    node tools/site-preview.mjs [--out path]
*/
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const args = process.argv.slice(2);
const out = args[args.indexOf("--out") + 1] || join(root, "site-preview.html");

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif",
};

/** every src/href that points at a local file */
const REF = /(?:src|href)="(\.\/[^"]+|assets\/[^"]+)"/g;

function build(html, label) {
  let n = 0;
  const missing = [];
  // config.js is a script, not an asset — fold it in below instead of data-URI-ing it
  const cfgPath = join(site, "config.js");
  if (existsSync(cfgPath)) {
    const cfg = readFileSync(cfgPath, "utf8").replace(
      /window\.HEPH\s*=\s*\{[\s\S]*?\};/,
      "window.HEPH = { owner: \"\", repo: \"\", sourcePublic: false, contact: \"\" };");
    html = html.replace(/<script src="\.\/config\.js"><\/script>/, `<script>${cfg}</script>`);
  }
  html = html.replace(REF, (m, path) => {
    if (/\.js(\?|$)/.test(path)) return m;
    const abs = join(site, path.replace(/^\.\//, ""));
    if (!existsSync(abs)) { missing.push(path); return m; }
    if (statSync(abs).size > 3_000_000) { missing.push(path + " (too big)"); return m; }
    const ext = path.slice(path.lastIndexOf("."));
    const b64 = readFileSync(abs).toString("base64");
    n++;
    return `${m.slice(0, m.indexOf('"') + 1)}data:${MIME[ext] || "application/octet-stream"};base64,${b64}"`;
  });

  // the offline copy can't reach GitHub: make the status line honest
  html = html.replace(/<p class="status" id="status">[\s\S]*?<\/p>/,
    '<p class="status" id="status"><i>this is the offline preview — buttons point at the releases page</i></p>');

  console.error(`${label}: ${n} assets inlined${missing.length ? " — MISSING " + missing.join(", ") : ""}`);
  return { html, n, missing };
}

const page = build(readFileSync(join(site, "index.html"), "utf8"), "index.html");
if (page.missing.length) { console.error("!! some assets did not inline — check the paths"); process.exitCode = 1; }

// inject the banner into the page itself — no nested documents
const BAR = `<div style="position:sticky;top:0;z-index:99;background:#6f4429;color:#fdf9f4;
  font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:8px 16px;display:flex;gap:14px;
  align-items:center;flex-wrap:wrap"><b style="font-weight:600;opacity:.85">SINGLE-FILE PREVIEW</b>
  <span>every asset inlined (${page.n}) · deploy the <code>site/</code> folder, not this file</span></div>`;

const doc = page.html.replace(/<body([^>]*)>/, (m) => m + "\n" + BAR.replace(/\n\s+/g, " "));

writeFileSync(out, doc, "utf8");
const kb = (statSync(out).size / 1024).toFixed(0);
console.log(`site-preview.html  ${kb} KB`);
console.log(`  written to ${out}`);
