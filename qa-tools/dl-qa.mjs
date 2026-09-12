/**
 * qa-tools/dl-qa.mjs — the download buttons, against the release file rather than a web service.
 *
 * The page makes one promise: a button appears when and only when the file behind it exists on this
 * host. That is a claim about three things at once — release.json, the bundle beside it, and the
 * script that reads the first into the second — so the suite drives all of it against real
 * directories: real bytes at real sizes, real sha256 sums, a real HTTP server. Nothing is stubbed,
 * because the thing being tested is what happens when the files disagree with the manifest.
 *
 * It also runs the pipeline's own verifier (tools/verify-release.mjs) against each bundle, since
 * two of these states are invisible to a browser and are exactly the ones a release must not ship.
 *
 * run:  cd hephaestus/qa-tools && node dl-qa.mjs
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { startSite } from "./fixture-site.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const REPO = new URL("..", import.meta.url).pathname;
const VER = "0.4.0";

const browser = await chromium.launch();
async function view(fixture, opts = {}) {
  const site = await startSite(fixture);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(opts.javaScript === false ? { javaScriptEnabled: false } : {}),
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message)));
  await page.goto(site.url, { waitUntil: "load" });
  if (opts.javaScript !== false) {
    await page.waitForFunction(() => {
      const s = document.getElementById("status");
      return s && s.dataset.state && s.dataset.state !== "live?";
    }, null, { timeout: 8000 }).catch(() => {});
  }
  const dom = await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)];
    const cards = q(".dl [data-slot]").map((a) => ({
      slot: a.getAttribute("data-slot"),
      cls: a.className,
      href: a.getAttribute("href"),
      dl: a.getAttribute("download"),
      state: (a.querySelector(".state span") || {}).textContent || "",
      sizes: (a.querySelector(".sizes") || {}).textContent || "",
      you: !!(a.querySelector(".you") && !a.querySelector(".you").hidden),
      title: a.getAttribute("title") || "",
    }));
    return {
      cards,
      status: document.getElementById("status").dataset.state || "",
      tone: document.getElementById("status").className.replace("status", "").trim(),
      text: document.getElementById("statusText").textContent.trim(),
      extras: q("#extras li").map((li) => ({ text: li.textContent, href: (li.querySelector("a") || {}).getAttribute?.("href") || "" })),
      extrasHidden: document.getElementById("extras").hidden,
      olderHidden: document.getElementById("older").hidden,
      olderCount: (document.getElementById("olderCount") || {}).textContent || "",
      olderLinks: q("#olderList a").map((a) => ({ text: a.textContent, href: a.getAttribute("href") })),
      hashRows: q("#hashBody tbody tr").map((tr) => [...tr.children].map((td) => td.textContent.trim())),
      hashesOpen: document.getElementById("hashes").open,
      hero: (() => { const h = document.getElementById("heroGet"); return { text: h.textContent.trim(), href: h.getAttribute("href"), dl: h.getAttribute("download") }; })(),
      anchors: q("a[href]").map((a) => a.getAttribute("href")),
      media: q("img,video,audio,canvas,iframe,source,link[rel=stylesheet],[src]").length,
      bodyWords: document.body.innerText.split(/\s+/).filter(Boolean).length,
      bodyGithub: /github/i.test(document.body.innerText),
      h1: q("h1").length,
      headings: q("h1,h2,h3").map((h) => h.tagName),
      scripts: q("script").map((s) => (s.src ? "src:" + s.src : "inline")),
    };
  });
  return { site, page, dom, errs, ctx, close: async () => { await ctx.close(); await site.close(); } };
}
/* async because the bundle being verified is served by this very process: spawnSync would freeze
   the event loop, the server would stop answering, and the verifier would fail its own test */
const verify = (base, extra = []) => new Promise((done) => {
  const c = spawn("node", [REPO + "tools/verify-release.mjs", "--base", base, ...extra], { cwd: REPO });
  let out = "";
  c.stdout.on("data", (d) => { out += d; });
  c.stderr.on("data", (d) => { out += d; });
  c.on("close", (code) => done({ code, out }));
});
const bySlot = (dom, slot) => dom.cards.find((c) => c.slot === slot);

console.log("\ndl-qa · the buttons the site can honestly offer");

// ── 1. a complete release ───────────────────────────────────────────────────────────────────────
{
  const v = await view("ready");
  const { dom } = v;
  ok(dom.status === "live" && dom.tone === "ok", `status reads "${dom.status}" and shows the good tone`);
  ok(/release 0\.4\.0 · published 2026-09-09/.test(dom.text), `status names the version and its date: ${dom.text.slice(0, 78)}`);
  ok(/5 of 5 buttons filled/.test(dom.text), "and says all five buttons were filled");
  ok(dom.cards.length === 5, `there are ${dom.cards.length} platform cards`);
  for (const c of dom.cards) {
    ok(c.cls === "ready", `${c.slot}: card is live (${c.cls})`);
    ok(c.href === `/downloads/${c.dl}`, `${c.slot}: href is the file itself, ${c.href}`);
    ok(/^Hephaestus|hephaestus/.test(c.dl || ""), `${c.slot}: download attribute names ${c.dl}`);
    ok(c.state.startsWith("↓ " + c.dl), `${c.slot}: the label is the file, not a slogan`);
    ok(/\d+(\.\d+)? MB · sha256 [0-9a-f]{10}…$/.test(c.sizes), `${c.slot}: size + short hash shown (${c.sizes})`);
    ok(c.href.startsWith("/downloads/"), `${c.slot}: same-origin path only`);
  }
  ok(dom.cards.every((c) => !/github|objects\.git|releases\/download/.test(c.href + c.state)), "no card mentions or points at any other host");
  const extra = dom.extras.find((e) => /\.msi/.test(e.href));
  ok(!!extra && !v.dom.extrasHidden, "the .msi nobody carded is still offered in the extras row");
  ok(!!extra && /Windows package — /.test(extra.text), `extras say what it is: ${extra ? extra.text : ""}`);
  ok(dom.olderHidden === false && /1 earlier release/.test(dom.olderCount), `older releases listed: ${dom.olderCount}`);
  ok(dom.olderLinks.length === 2 && dom.olderLinks.every((l) => l.href.startsWith("/downloads/") && /0\.3\.0/.test(l.href)),
    `both 0.3.0 files still link (${dom.olderLinks.map((l) => l.href.split("/").pop()).join(", ")})`);
  ok(dom.olderLinks.every((l) => /· [\d.]+ (MB|KB)$/.test(l.text)), `history rows carry their byte size too (${dom.olderLinks[0].text})`);
  const dbg = JSON.stringify(dom.hashRows.map((r) => [String(r[0]).slice(0, 30), (r[2] || "").length]));
  ok(dom.hashRows.length === 6 && dom.hashRows.every((r) => r.length === 3 && /^[0-9a-f]{64}$/.test(r[2])), `the checksum table shows one 64-char hash per file ${dbg}`);
  ok(dom.hashRows.some((r) => /_x64-setup\.exe/.test(r[0])) && dom.hashRows.some((r) => /\.AppImage/.test(r[0])), "the table covers the .exe and the AppImage by name");
  const mac = bySlot(dom, "macos-arm64");
  ok(/right-click|Open/.test(mac.title), `macOS card carries the unsigned-build warning where it belongs: ${mac.title.slice(0, 46)}…`);
  ok(/MB/.test(dom.hero.text) || /Download for/.test(dom.hero.text), `hero button: "${dom.hero.text}"`);
  ok(dom.cards.some((c) => c.you), "the visitor's own platform is marked on its card");
  ok(!dom.extrasHidden ? dom.extras.length === 1 : dom.extras.length === 0, `extras row has ${dom.extras.length} entry, not five duplicates`);
  ok(v.site.reqs.filter((q) => q.path === "/release.json").length === 1, "release.json is read exactly once per load");
  ok(v.site.external() === 0 && !v.site.reqs.some((q) => q.path !== "/index.html" && !/^(\/release\.json|\/downloads\/|\/assets\/)/.test(q.path)),
    `every request stayed on this host (${v.site.reqs.length} requests)`);
  ok(dom.media === 0, "the page pulls in no image, canvas, iframe, stylesheet or src attribute");
  ok(dom.scripts.every((s) => s === "inline"), `${dom.scripts.length} script tags, none of them fetched from anywhere`);
  ok(!dom.bodyGithub, "the words on the page never route a visitor through GitHub");
  ok(dom.h1 === 1 && dom.headings[0] === "H1", "one H1, at the top of the heading order");
  ok(dom.bodyWords > 1200, `the page still explains itself with JS on: ${dom.bodyWords} words`);
  ok(v.errs.length === 0, `no page errors (${v.errs.join(" | ") || "clean"})`);
  const r = await verify(v.site.origin);
  ok(r.code === 0, "the pipeline's verifier agrees this bundle is publishable");
  await v.close();
}

// ── 2. the state a first deploy is actually in ──────────────────────────────────────────────────
{
  const v = await view("preparing");
  ok(v.dom.status === "preparing" && v.dom.tone === "warn", `placeholder release.json reads "${v.dom.status}"`);
  ok(/no release is published on this site yet/.test(v.dom.text), `and says so plainly: ${v.dom.text}`);
  ok(v.dom.cards.every((c) => c.cls === "none" && c.href === "#get"), "no card is given a destination it cannot honour");
  ok(v.dom.cards.every((c) => !c.dl), "no download attribute is invented either");
  ok(v.dom.extrasHidden === true && v.dom.olderHidden === true, "no extras row, no history list");
  ok(/honest answer|no release/.test(v.dom.text + (await v.page.locator("#hashBody").innerText())), "the checksum panel admits there is nothing to list");
  const r = await verify(v.site.origin);
  ok(r.code === 1 && /status is "preparing"/.test(r.out), "and CI would refuse to call this a published release");
  const r2 = await verify(v.site.origin, ["--allow-preparing"]);
  ok(r2.code === 0, "site.yml may deploy it, because a docs push is allowed to have no release");
  await v.close();
}

// ── 3. only some platforms built ────────────────────────────────────────────────────────────────
{
  const v = await view("partial");
  const ready = v.dom.cards.filter((c) => c.cls === "ready").map((c) => c.slot);
  ok(ready.length === 2 && ready.includes("windows-x64") && ready.includes("linux-x64-appimage"), `two cards filled: ${ready.join(", ")}`);
  ok(v.dom.cards.filter((c) => c.cls === "none").every((c) => /not in this release/.test(c.state)), "the other three say the truth instead of guessing a name");
  ok(/2 of 5 buttons filled/.test(v.dom.text), `status counts honestly: ${v.dom.text}`);
  ok(v.dom.cards.filter((c) => c.cls === "none").every((c) => c.href === "#get"), "unfilled buttons scroll to this section rather than 404");
  await v.close();
}

// ── 4. manifest says one thing, bundle says another ─────────────────────────────────────────────
{
  const v = await view("broken");
  const r = await verify(v.site.origin);
  ok(r.code === 1 && /macos-x64.*404/.test(r.out), "a file that vanished from the bundle fails the verifier: " + (r.out.match(/FAIL.*macos-x64[^\n]*/) || [""])[0].trim());
  ok(v.dom.cards.find((c) => c.slot === "macos-x64").href.includes("dmg"), "and the page alone could not have noticed — which is why CI checks it");
  await v.close();
}
{
  const v = await view("offsite");
  const c = bySlot(v.dom, "windows-x64");
  ok(c.cls === "none" && c.href === "#get", "a manifest pointing at github.com is not followed by the card");
  ok(/not published at this address/.test(c.state), `it says why: ${c.state}`);
  ok(!v.dom.anchors.some((h) => /^https?:/.test(h)), "and the page ships no absolute link at all");
  const r = await verify(v.site.origin);
  ok(r.code === 1 && /not a path under \/downloads\//.test(r.out), "the verifier refuses the same file before it can go live");
  ok(/must not send visitors there/.test(r.out), "and says the reason out loud");
  await v.close();
}

// ── 5. unreadable, empty, stale ─────────────────────────────────────────────────────────────────
{
  const v = await view("malformed");
  ok(v.dom.status === "unreadable", `half a JSON file reads "${v.dom.status}"`);
  ok(/could not be read/.test(v.dom.text), `status: ${v.dom.text}`);
  ok(v.dom.cards.every((c) => c.href === "#get" && c.cls === "none"), "and every button stays where it was authored");
  ok(v.errs.length === 0, "a parse failure is caught, not thrown at the console");
  await v.close();
}
{
  const v = await view("empty");
  ok(v.dom.cards.every((c) => c.cls === "none"), "ready-with-no-files leaves all five cards inert");
  const r = await verify(v.site.origin);
  ok(r.code === 1 && /files\[\] is empty/.test(r.out), "verifier: a release with no downloads is not a release");
  await v.close();
}

// ── 6. with the script blocked ──────────────────────────────────────────────────────────────────
{
  const v = await view("ready", { javaScript: false });
  ok(v.dom.cards.every((c) => c.href === "#get"), "no JS: every card exists and none of them lies about a file");
  ok(v.dom.cards.every((c) => /not published yet/.test(c.state)), "no JS: each says it is not published yet");
  ok(/fill themselves/.test(v.dom.text), `no JS: the status line is written to be true unaided — "${v.dom.text.slice(0, 70)}…"`);
  ok(v.dom.bodyWords > 1200, `no JS: ${v.dom.bodyWords} words of the page are still there`);
  ok(await v.page.locator("#does .feat").first().isVisible(), "no JS: the reveal sections are visible, not waiting for a script that never came");
  await v.close();
}

// ── 7. keyboard and focus ───────────────────────────────────────────────────────────────────────
{
  const v = await view("ready");
  const order = [];
  for (let i = 0; i < 14; i++) {
    await v.page.keyboard.press("Tab");
    order.push(await v.page.evaluate(() => {
      const a = document.activeElement;
      return a && a.href ? new URL(a.href).pathname + (a.dataset.slot ? "#" + a.dataset.slot : "") : (a ? a.tagName : "-");
    }));
  }
  const landed = v.dom.cards.map((c) => "#" + c.slot).filter((s) => order.some((o) => o.endsWith(s)));
  ok(landed.length === 5, `Tab reaches all five download cards from the top (${order.join(" ")})`);
  await v.page.keyboard.press("Tab");
  const focusVisible = await v.page.evaluate(() => {
    const a = document.activeElement;
    const cs = getComputedStyle(a);
    return cs.outlineStyle !== "none" || a.href.includes("#") || cs.boxShadow !== "none";
  });
  ok(focusVisible, "whatever is focused can be seen to be focused");
  await v.close();
}

await browser.close();
console.log(`\n${pass} assertions passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
