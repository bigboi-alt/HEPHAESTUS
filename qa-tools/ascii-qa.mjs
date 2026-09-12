/*
  The page must stay what it is: text, on paper, with no way out and no way in.

  Groups of assertions:
   1. the ASCII portrait — the block on the page has to equal what tools/ascii-art.py prints, cell
      for cell, and the copy that quotes its size has to match too
   2. nothing external — no images, no canvas, no scripts loaded from anywhere, no link that leaves
      the page, and no request to another origin. Not "GitHub is allowed": nothing is
   3. nothing hidden — with JS off, and with reduced motion on, every word is still shown
   4. nothing invented — every number printed on the page is recomputed from this repository
   5. the release file — what the buttons read is valid, same-origin, and says "preparing" in git

    node ascii-qa.mjs          (drives its own fixture server; needs no :8099)
*/
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { startSite } from "./fixture-site.mjs";
import { ROOT, FILE_URL, SHOTS } from "./paths.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const html = readFileSync(`${ROOT}/site/index.html`, "utf8");
const headers = readFileSync(`${ROOT}/site/_headers`, "utf8");

/* ── 1 · the portrait ────────────────────────────────────────────────────── */

const pre = html.match(/<pre class="bust"([^>]*)>([\s\S]*?)<\/pre>/);
ok(!!pre, "the hero carries a <pre class=\"bust\"> and nothing else pretends to be it");
const attrs = pre ? pre[1] : "";
const body = pre ? pre[2].replace(/^\n|\n$/g, "") : "";
const lines = body.split("\n");
const cols = +(attrs.match(/data-cols="(\d+)"/) || [])[1];
const rows = +(attrs.match(/data-rows="(\d+)"/) || [])[1];
ok(lines.length === rows, `data-rows=${rows} and the block has ${lines.length} lines`);
ok(lines.every((l) => l.length === cols),
  `every line is exactly ${cols} characters — no ragged right edge to skew the centring`);
ok(!/[<>&]/.test(body), "the block holds no < > or & (the generator refuses a ramp that would)");
const inked = lines.filter((l) => l.trim().length).length;
ok(inked / rows > 0.9, `${inked}/${rows} rows carry a mark — the picture is present, not a smudge at the top`);
const density = body.replace(/ /g, "").length / (cols * rows);
ok(density > 0.25 && density < 0.85, `the grid is ${(density * 100).toFixed(0)}% inked — shading, not a solid block`);
ok(!/<figure/.test(html) && !/<figcaption>/.test(html), "the art is a block of text, not a figure with a caption hanging off it");
ok(!/id="artDims"/.test(html), "and there is no size read-out next to it, on purpose");
ok(/<pre class="bust"[^>]*aria-label="[^"]{60,}"/.test(html),
  "while it still carries an aria-label, so removing the words doesn't remove the picture");

let gen = null;
try {
  execFileSync("python3", ["-c", "import PIL"], { stdio: "ignore" });
  gen = execFileSync("python3", ["tools/ascii-art.py"], { cwd: ROOT, encoding: "utf8" })
    .split("\n\n/*")[0].replace(/\n+$/, "");
} catch (e) {
  console.log(`  – skipped the generator diff (${String(e).slice(0, 60)}) — needs Pillow`);
}
if (gen) {
  const want = gen.replace(/\n+$/, "");
  ok(want === body.replace(/\n+$/, ""), "the block on the page is byte-identical to what tools/ascii-art.py prints");
}

/* ── 2 · nothing out, nothing in ─────────────────────────────────────────── */

for (const tag of ["img", "picture", "source", "canvas", "iframe", "video", "svg", "audio"]) {
  ok(!new RegExp(`<${tag}[\\s>/]`).test(html), `no <${tag}> anywhere on the page`);
}
ok(!/github/i.test(html), "the word github appears nowhere in the file: no release page, no API host, no badge");
ok(!/api\.github\.com|releases\/download|releases\/latest|__hephRepo|HEPH_REPO/.test(html),
  "and neither do any of the shapes a GitHub-backed download page would need");
ok(!/your-github-username|connect\.mjs|site\/config\.js|window\.__/.test(html),
  "no placeholder owner, no connect step, no config file for a human to keep in sync");
ok(!/<script[^>]+\ssrc=/.test(html), "every script is inline — nothing to fetch, nothing that can be blocked");
ok(!/(src|href)="https?:/.test(html), "no absolute URL in any src or href attribute");
ok(!/rel="stylesheet"|@import|fonts\.googleapis|\.woff/.test(html), "no webfont anywhere: the page draws with system faces");
const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
const local = hrefs.filter((h) => h.startsWith("#"));
ok(hrefs.length > 0 && local.length === hrefs.length, `all ${hrefs.length} links in the shipped markup stay inside the page`);
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const dead = local.filter((h) => h !== "#" && !ids.has(h.slice(1)));
ok(dead.length === 0, `every anchor has a target (${dead.join(", ") || "none dead"})`);
ok(/connect-src 'self';/.test(headers) && !/connect-src 'self' [^;]*http/.test(headers),
  "the CSP lets the page talk to its own origin and to nothing else");
ok(/default-src 'self'/.test(headers) && /frame-ancestors 'none'/.test(headers), "and the rest of the CSP is as closed as it was");
ok(/font-src 'self'/.test(headers) && /style-src 'self' 'unsafe-inline'/.test(headers),
  "no third party is granted anything, so none can be added by oversight");
const redirects = readFileSync(`${ROOT}/site/_redirects`, "utf8");
ok(/\/dl\s+\/#get\s+301/.test(redirects), "the old /dl path still forwards to the download section");
ok(!/github/.test(redirects), "and no redirect leaves for another host");
for (const f of ["favicon.svg", "favicon.png", "og.png", "logo-touch.png", "logo-ink-512.png"]) {
  ok(existsSync(`${ROOT}/site/assets/${f}`) && statSync(`${ROOT}/site/assets/${f}`).size > 200, `site/assets/${f} is really there`);
}

/* ── 3 · the release file the buttons read ───────────────────────────────── */

const rel = JSON.parse(readFileSync(`${ROOT}/site/release.json`, "utf8"));
ok(rel.schema === 1, "site/release.json is a schema-1 document");
ok(rel.status === "preparing" && rel.version === null && rel.files.length === 0,
  "in git it says preparing with no files — the honest pre-release state, not a fabricated one");
ok(/signing/.test(JSON.stringify(rel)) && /unsigned/.test(JSON.stringify(rel.signing.windows)),
  "and it states the signing truth before any release exists to misstate it");
ok(/"previous":\s*\[\]/.test(readFileSync(`${ROOT}/site/release.json`, "utf8")), "with an empty history, not an omitted field");
ok(/fetch\("release\.json"/.test(html), "the page reads it by relative path, so it works on any host and any port");
ok(!/fetch\(["'`]?\//.test(html), "and never with a root-absolute path a subfolder deploy would miss");

/* ── 4 · in a browser, with a release actually published ────────────────── */

const site = await startSite("ready");
const b = await chromium.launch();
const seen = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: true });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
page.on("request", (r) => { if (!r.url().startsWith("data:")) seen.push(r.url()); });
await page.goto(site.url, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const origin = new URL(site.url).origin;
const offsite = seen.filter((u) => !u.startsWith(origin));
ok(offsite.length === 0,
  `${seen.length} request${seen.length === 1 ? "" : "s"} to load a page that has releases: ${offsite.length} offsite (fonts, images and analytics would show up here)`);
ok(seen.filter((u) => /release\.json/.test(u)).length === 1, "release.json is read once, not on a timer");
ok(errs.length === 0, `no page errors ${JSON.stringify(errs.slice(0, 2))}`);

const box = await page.evaluate(() => {
  const pre = document.querySelector("pre.bust");
  const holder = pre.parentElement.getBoundingClientRect();
  const r = pre.getBoundingClientRect();
  const cs = getComputedStyle(pre);
  const cols = +pre.dataset.cols, rows = +pre.dataset.rows;
  return { w: Math.round(r.width), h: Math.round(r.height), fs: parseFloat(cs.fontSize),
           lh: parseFloat(cs.lineHeight), colour: cs.color, bg: cs.backgroundColor,
           noOverflow: pre.scrollWidth <= pre.clientWidth + 1,
           textW: Math.round(cols * 0.6 * parseFloat(cs.fontSize)), holderW: Math.round(holder.width),
           cols, rows };
});
ok(box.fs >= 6 && box.fs <= 14, `the portrait sets itself to ${box.fs}px characters at 1440 (${box.w}×${box.h})`);
ok(box.noOverflow, `it fits its column exactly — ${box.textW}px of characters in ${box.holderW}px, no sideways scroll`);
ok(/rgba\(0, 0, 0, 0\)|transparent/.test(box.bg), "there is no panel behind it: the art sits on the page's own paper");
ok(box.colour === "rgb(111, 68, 41)", `the characters are the page's brown ink (${box.colour})`);
const want = (box.rows * box.lh) / (box.cols * 0.6 * box.fs);   // the grid's own shape
ok(Math.abs(box.h / box.w - want) / want < 0.03,
  `the block is ${box.w}×${box.h} against a wanted ${want.toFixed(3)} — the mark's proportions, not stretched by the column`);

const cards = await page.evaluate(() => [...document.querySelectorAll(".dl [data-slot]")].map((a) => ({
  slot: a.getAttribute("data-slot"), raw: a.getAttribute("href"), live: a.classList.contains("ready"),
  target: a.getAttribute("target"), rel: a.getAttribute("rel"), text: a.innerText.replace(/\s+/g, " ").trim(),
})));
ok(cards.length === 5, `five platform cards: ${cards.map((c) => c.slot).join(", ")}`);
ok(cards.every((c) => c.raw === "#get" || /^\/downloads\//.test(c.raw)), "each one is either this section or a file on this host");
ok(cards.every((c) => !c.target && !c.rel), "nothing opens in a new tab or sheds its referrer on the way out");
ok(cards.every((c) => !/github/i.test(c.text)), "and none of the labels mentions another service while handing over a file");
ok(cards.filter((c) => c.live).length === 5, "with a release published, all five filled themselves");
const figs = await page.evaluate(() => [...document.querySelectorAll("[data-check]")].map((el) => [el.getAttribute("data-check"), el.textContent.trim()]));
  ok(figs.length === 1 && figs[0][0] === "version", `the page leaves exactly one figure checkable — the version in the footer (got: ${figs.map((f) => f[0]).join(", ") || "none"})`);

const inert = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"], a[href^="/downloads/"]')].filter((a) => !a.textContent.trim() && !a.getAttribute("aria-label")).length);
ok(inert === 0, `every link on the page has a name a screen reader can read (${inert} without)`);
ok(!(await page.evaluate(() => Object.keys(localStorage).length)), "the page writes nothing to localStorage");
await page.screenshot({ path: `${SHOTS}/ascii-hero.png` });
await ctx.close();

/* ── 5 · with the script off, and with reduced motion on ─────────────────── */

for (const [label, opts] of [["JS off", { javaScriptEnabled: false }], ["reduced motion", { reducedMotion: "reduce" }]]) {
  const c2 = await b.newContext({ viewport: { width: 1100, height: 900 }, ...opts });
  const p2 = await c2.newPage();
  await p2.goto(site.url, { waitUntil: "load" });
  const r = await p2.evaluate(() => {
    const els = [...document.querySelectorAll(".reveal")];
    // nothing on this page may be held invisible: the reveal is a slide, and opacity is checked
    // anyway, because "decoration must never gate content" is the rule the slide has to obey
    const hidden = els.filter((e) => +getComputedStyle(e).opacity < 0.99 || getComputedStyle(e).display === "none").length;
    const art = document.querySelector("pre.bust").getBoundingClientRect();
    const dl = [...document.querySelectorAll(".dl [data-slot]")].map((a) => a.getAttribute("href"));
    return { total: els.length, hidden, artW: Math.round(art.width), dl,
             words: document.body.innerText.trim().split(/\s+/).length,
             status: document.getElementById("statusText").textContent.trim() };
  });
  ok(r.hidden === 0, `${label}: all ${r.total} reveal blocks are legible without a script or a scroll (${r.hidden} stuck invisible)`);
  ok(r.artW > 200, `${label}: the portrait is text, so it's still there (${r.artW}px wide)`);
  ok(r.words > 1200, `${label}: the page still reads as ${r.words} words, not a stub`);
  if (label === "JS off") ok(r.dl.every((h) => h === "#get"), `${label}: a reader with no script is offered no download it can't confirm`);
  else ok(r.dl.every((h) => h === "#get" || /^\/downloads\//.test(h)), `${label}: with motion off the links still resolve locally only`);
  ok(!/reading|loading|\.\.\.$/.test(r.status), `${label}: and the status line is a sentence, not a spinner ("${r.status.slice(0, 54)}…")`);
  await c2.close();
}

/* ── 6 · what the page claims about itself, against what the repo is ─────── */
{
  const num = (v) => String(v).replace(/,/g, "");
  const version = (figs[0]?.[1] || "").trim().split(" ")[0];
  const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8"));
  ok(num(version) === num(pkg.version), `the version printed in the footer (${version}) is package.json's (${pkg.version})`);
  const conf = JSON.parse(readFileSync(`${ROOT}/src-tauri/tauri.conf.json`, "utf8"));
  ok(conf.version === pkg.version, "which is the version the desktop bundle will carry");

  // these read the shipped HTML rather than a live page: the browser context is already closed by
  // this point in the suite, and none of what follows needs a layout engine to confirm
  const navBlock = (html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/) || ["", ""])[1];
  const nav = [...navBlock.matchAll(/href="(#[a-z]+)"/g)].map((m) => m[1]);
  ok(nav.join(" ") === "#does #thinks #mark #get", `the nav walks exactly the four sections that exist: ${nav.join(" ")}`);
  const missing = nav.filter((h) => !new RegExp(`<section[^>]*id="${h.slice(1)}"`).test(html));
  ok(missing.length === 0, `and every one of them lands somewhere (${missing.join(", ") || "all present"})`);

  // the copy the user cut stays cut — a removed confession must not survive under another heading
  const cut = {
    sections: (html.match(/id="(catch|details)"/g) || []).length,
    prose: /what that costs you|small print|no analytics|self-host|the catch/i.test(html.replace(/<style[\s\S]*?<\/style>/g, "")),
    figures: (html.match(/data-check="/g) || []).length,
  };
  ok(cut.sections === 0, "no confession or small-print section is left in the document");
  ok(!cut.prose, "and none of that prose survived by moving under another heading");
  ok(cut.figures === 1, "the stats table went with it, so one figure is all that is left to check");

  const thinksBlock = (html.match(/<section class="wrap" id="thinks">([\s\S]*?)<\/section>/) || ["", ""])[1];
  const thinks = [...thinksBlock.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  ok(thinks.length === 4, `how it thinks is four cards, not a list: ${thinks.join(" · ")}`);
  ok(thinks.every((t) => t.length > 6), "and each card has a real title rather than a bullet");

  /* the forge-mark ladder on the page has to be the app's own table, not a copy that can drift */
  const tiers = [...html.matchAll(/<span(?: class="div")?><b>(\d+)–(\d+)<\/b>([A-Z ]+)<small>([^<]+)<\/small>/g)]
    .map((m) => ({ range: `${m[1]}–${m[2]}`, name: m[3].trim(), note: m[4].trim() }));
  const src = readFileSync(`${ROOT}/src/engine/identity.ts`, "utf8");
  const want = [...src.matchAll(/\{ min: (\d+), max: (\d+), name: "([^"]+)", mark: "([^"]+)", note: "([^"]+)" \}/g)]
    .map((m) => ({ range: `${m[1]}–${m[2]}`, name: m[3], note: m[5] }));
  ok(tiers.length === want.length, `the page prints ${tiers.length} tiers, and the app defines ${want.length}`);
  const drift = tiers.filter((t, i) => !want[i] || t.range !== want[i].range
    || t.name.toLowerCase() !== want[i].name.toLowerCase() || t.note.toLowerCase() !== want[i].note.toLowerCase());
  ok(drift.length === 0, `every band on the page matches TIERS in src/engine/identity.ts${drift.length ? ` — off: ${JSON.stringify(drift[0])}` : ""}`);
  const markBlock = (html.match(/<section class="wrap" id="mark">([\s\S]*?)<\/section>/) || ["", ""])[1];
  const promises = markBlock.replace(/<[^>]+>/g, " ").toLowerCase();
  ok(promises.includes("clock alone") || promises.includes("clock only"),
    "the mark section says out loud that declining the location leaves a clock-only mark");
  ok(promises.includes("scored") && promises.includes("100"),
    "and it promises a measured score rather than a gift");
}

/* ── 7 · the offline single-file copy ───────────────────────────────────── */

const pv = await b.newContext({ viewport: { width: 1280, height: 900 } });
const pp = await pv.newPage();
const pvErrs = [];
pp.on("pageerror", (e) => pvErrs.push(String(e)));
await pp.goto(FILE_URL, { waitUntil: "load" });
await pp.waitForTimeout(500);
const pblock = await pp.evaluate(() => {
  const el = document.querySelector("pre.bust");
  return el ? el.textContent.replace(/^\n|\n$/g, "") : null;
});
ok(pblock === body.replace(/^\n|\n$/g, ""), "site-preview.html carries the identical block, from file:// with no server");
ok(pvErrs.length === 0, `the offline copy runs clean ${JSON.stringify(pvErrs.slice(0, 2))}`);
await pv.close();

await site.close();
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
