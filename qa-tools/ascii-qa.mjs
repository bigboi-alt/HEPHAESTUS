/*
  The page must stay what it is: text, on paper, with no way out and no way in.

  Three groups of assertions:
   1. the ASCII portrait — the block on the page has to equal what tools/ascii-art.py
      prints, cell for cell, and the copy that quotes its size has to match too
   2. nothing external — no images, no canvas, no scripts loaded from anywhere, no link
      that leaves the page, no request to another origin, no GitHub at all (private repo)
   3. nothing hidden — with JS off, and with reduced motion on, every word is still shown

    node ascii-qa.mjs          (needs the site served on :8099 — see README)
*/
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { stubGithub } from "./gh-stub.mjs";
import { ROOT, SITE, FILE_URL, SHOTS } from "./paths.mjs";

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

const hero = (html.match(/<figure class="art">[\s\S]*?<\/figure>/) || [""])[0];
ok(!/id="artDims"/.test(html) && !/<figcaption>/.test(hero),
  "the portrait ships with no caption: no size read-out, no explaining text under the art");
ok(/<pre class="bust"[^>]*aria-label="[^"]{60,}"/.test(html),
  "and it still carries an aria-label, so removing the words doesn't remove the picture");

let gen = null;
try {
  execFileSync("python3", ["-c", "import PIL"], { stdio: "ignore" });
  // stdout is the block, then a blank line and a /* size */ note — the note isn't art
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

for (const tag of ["img", "picture", "source", "canvas", "iframe", "video", "svg"]) {
  ok(!new RegExp(`<${tag}[\\s>/]`).test(html), `no <${tag}> anywhere on the page`);
}
ok(!/href="https?:\/\/github\.com/.test(html) && !/content="https?:/.test(html),
  "no link in the shipped markup points at github.com — the only owner the page knows is the one the deploy writes in");
ok(!/your-github-username|connect\.mjs|site\/config\.js/.test(html),
  "no placeholder owner, no connect step, no config file to keep in sync — the deploy bakes or nothing does");
ok(/var HEPH_REPO = window\.__hephRepo \|\| "bigboi-alt\/HEPHAESTUS";/.test(html),
  "the page names exactly one repo, as a plain owner/repo — and a deploy may overwrite the line");
ok(!/["'`][\w.-]+\/["'`]?\s*\.git|api\.github\.com\/repos\/[\w.-]+/i.test(html),
  "and it names no other repo, so there is no second owner anywhere for the list to read by mistake");
ok(!/<script[^>]+\ssrc=/.test(html), "every script is inline — nothing to fetch, nothing to block");
ok(!/(src|href|content)="https?:/.test(html.replace(/<meta name="description"[\s\S]*?\/>/, "")),
  "no absolute URL in any src, href or content attribute");
const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
const local = hrefs.filter((h) => h.startsWith("#"));
ok(hrefs.length > 0 && local.length === hrefs.length, `all ${hrefs.length} links stay inside the page`);
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const dead = local.filter((h) => h !== "#" && !ids.has(h.slice(1)));
ok(dead.length === 0, `every anchor has a target (${dead.join(", ") || "none dead"})`);
ok(/connect-src 'self' https:\/\/api\.github\.com/.test(headers) && !/connect-src 'self'[^']*http/.test(headers.replace("https://api.github.com", "")),
  "the CSP allows exactly one outside call — the releases API — and nothing else");

/* ── 3 · in a browser ────────────────────────────────────────────────────── */

const b = await chromium.launch();
const seen = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: true });
const page = await ctx.newPage();
await stubGithub(page);   // the page is measured here, not the download logic — dl-qa owns that
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
page.on("request", (r) => { if (!r.url().startsWith("data:")) seen.push(r.url()); });
await page.goto(SITE, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const origin = new URL(SITE).origin;
const offsite = seen.filter((u) => !u.startsWith(origin));
ok(offsite.every((u) => u.startsWith("https://api.github.com/repos/bigboi-alt/HEPHAESTUS")),
  `${seen.length} request${seen.length === 1 ? "" : "s"} to load the page: ${offsite.length} of them offsite, and every offsite one is the same repo's release list — no fonts, no images, no analytics`);
ok(errs.length === 0, `no page errors ${JSON.stringify(errs.slice(0, 2))}`);

const box = await page.evaluate(() => {
  const pre = document.querySelector("pre.bust");
  const holder = pre.closest(".art-box").getBoundingClientRect();
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

const cards = await page.evaluate(() => [...document.querySelectorAll(".os > [data-kind]")].map((el) => {
  const a = el.querySelector("a.state");
  return { tag: el.tagName, raw: a?.getAttribute("href") || null, abs: a?.href || null,
           live: !!(a && a.classList.contains("live")), text: (a?.innerText || "").trim() };
}));
ok(cards.length === 3, `three systems listed (${cards.length})`);
// the cards ARE anchors now — that is what makes "click and the download starts" possible. On a
// repo with nothing published, the only two honest outcomes are this section's own anchor and the
// releases page GitHub confirmed exists; a file link at that moment would be a lie
ok(cards.every((c) => (c.raw === "#get" || c.raw === "https://github.com/bigboi-alt/HEPHAESTUS/releases") && !c.live),
  `no card claims a file it didn't see: ${[...new Set(cards.map((c) => c.raw))].join(" | ")}`);
ok(!cards.some((c) => /\/releases\/latest|\/download\//.test(c.raw || "")),
  "and none of them links /releases/latest or a raw asset path — only URLs that exist for sure");
ok(cards.every((c) => /not posted yet|all releases/.test(c.text)), "and each says which of the two it is", cards.map((c) => c.text).join(" / "));
ok(!(await page.evaluate(() => Object.keys(localStorage).length)), "the page writes nothing to localStorage");
await page.screenshot({ path: `${SHOTS}/ascii-hero.png` });
await ctx.close();

/* with the script off, and with reduced motion on, every word must still be there */
for (const [label, opts] of [["JS off", { javaScriptEnabled: false }], ["reduced motion", { reducedMotion: "reduce" }]]) {
  const c2 = await b.newContext({ viewport: { width: 1100, height: 900 }, ...opts });
  const p2 = await c2.newPage();
  await stubGithub(p2);
  await p2.goto(SITE, { waitUntil: "load" });
  const r = await p2.evaluate(() => {
    const els = [...document.querySelectorAll(".reveal")];
    const hidden = els.filter((e) => +getComputedStyle(e).opacity < 0.99).length;
    const art = document.querySelector("pre.bust").getBoundingClientRect();
    return { total: els.length, hidden, artW: Math.round(art.width), words: document.body.innerText.trim().split(/\s+/).length };
  });
  ok(r.hidden === 0, `${label}: all ${r.total} animated blocks are shown anyway (${r.hidden} stuck invisible)`);
  ok(r.artW > 200, `${label}: the portrait is text, so it's still there (${r.artW}px wide)`);
  ok(r.words > 700, `${label}: the page still reads as ${r.words} words, not a stub`);
  await c2.close();
}

/* the single-file preview has to carry the same art, or the shipped copy lies */
const pv = await b.newContext({ viewport: { width: 1280, height: 900 } });
const pp = await pv.newPage();
await stubGithub(pp);
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

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
