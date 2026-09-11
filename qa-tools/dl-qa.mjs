/**
 * qa-tools/dl-qa.mjs — the download cards, against a stand-in GitHub.
 *
 * What the feature actually promises: click a card and the installer downloads, with nobody
 * editing the site to make that happen. That needs three things to hold, and each is a way
 * this could go wrong, so each gets its own scenario:
 *
 *   1. it never links something that isn't there   → cards only point at GitHub once the API
 *      has confirmed a release, and every failure mode (no owner baked in, no published
 *      release, a private repo, GitHub down, garbage JSON) leaves the in-page fallback
 *   2. each card picks the right file out of a release → a real asset list with decoys
 *   3. the page is not held hostage by the network   → all the copy is there and readable
 *      while the request is still in flight, and the unbaked page makes no request at all
 *
 * The repo the page asks is `window.__hephRepo`, which is exactly what the deploy step in
 * .github/workflows/site.yml sed's in — so the QA drives the same slot, not a mock of the
 * mechanism.
 *
 * run:  cd hephaestus/qa-tools && node dl-qa.mjs
 */
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const SITE = path.resolve(import.meta.dirname, "..", "site");
const REPO = "someone/hephaestus-app";
const asset = (name, sizeMB) => ({ name, size: Math.round(sizeMB * 1024 * 1024), browser_download_url: `https://objects.githubusercontent.com/dl/${name}` });
const RELEASE = {
  tag_name: "v0.3.0",
  published_at: "2026-09-02T10:00:00Z",
  html_url: "https://github.com/someone/hephaestus-app/releases/tag/v0.3.0",
  assets: [
    asset("Hephaestus_0.3.0_x64-setup.exe", 14.7),
    asset("Hephaestus_0.3.0_x64_en-US.msi", 16.1),      // decoy: never the one to pick
    asset("Hephaestus_0.3.0_x64.dmg", 15.2),
    asset("Hephaestus_0.3.0_aarch64.dmg", 14.9),
    asset("hephaestus_0.3.0_amd64.deb", 13.4),          // decoy unless there is no AppImage
    asset("Hephaestus_0.3.0_amd64.AppImage", 21.8),
  ],
};
const HTML = { status: 200, contentType: "text/html", body: "<html><body>a captive portal, not json</body></html>" };
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const notFound = () => ({ status: 404, contentType: "application/json", body: '{"message":"Not Found"}' });

const results = [];
const ok = (cond, label, note = "") => { results.push({ label, ok: !!cond, note }); console.log(`  ${cond ? "✓" : "✗"} ${label}${note ? ` — ${note}` : ""}`); };

const server = http.createServer((req, res) => {
  const f = path.join(SITE, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (!f.startsWith(SITE) || !fs.existsSync(f)) { res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

const settle = (page) => page.waitForFunction(() => Boolean(document.getElementById("status").dataset.state), null, { timeout: 8000 }).catch(() => {});

/** one scenario: what the API answers, what the cards and the status line end up saying */
async function scenario(name, { repo = REPO, api, delay = 0 }) {
  const page = await browser.newPage();
  const hits = [];
  let t0 = Date.now();
  await page.route("**/api.github.com/**", async (route) => {
    hits.push(route.request().url());
    if (delay) await sleep(delay);
    const kind = route.request().url().endsWith("/releases/latest") ? "rel" : "repo";
    const answer = api?.[kind] ?? notFound();
    if (answer === "abort") return route.abort("connectionrefused");
    return route.fulfill(answer);
  });
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  if (repo) await page.addInitScript(([r]) => { window.__hephRepo = r; }, [repo]);
  t0 = Date.now();
  await page.goto(`${origin}/index.html`, { waitUntil: "commit" });
  // read the copy while the (delayed) API call is still outstanding
  const wordsWhileWaiting = await page.evaluate(() => document.body.innerText.trim().split(/\s+/).filter(Boolean).length);
  const waited = Date.now() - t0;
  await settle(page);
  const state = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".os > [data-kind]")].map((el) => {
      const a = el.querySelector("a.state");
      return {
        kind: el.dataset.kind,
        raw: a.getAttribute("href"),
        abs: a.href,
        live: a.classList.contains("live"),
        some: a.classList.contains("some"),
        download: a.getAttribute("download"),
        target: a.getAttribute("target"),
        text: a.innerText.trim(),
      };
    });
    const st = document.getElementById("status");
    return { cards, by: Object.fromEntries(cards.map((c) => [c.kind, c])), status: st.innerText.replace(/\s+/g, " ").trim(), tone: (st.className || "").replace(/^status\s*/, ""), done: st.dataset.state };
  });
  const external = requests.filter((u) => !u.startsWith(origin)).length;
  await page.close();
  results.push({ label: `${name}: nothing thrown into the visitor's console`, ok: errs.length === 0, note: errs.join(" | ") });
  return { name, state, hits, external, wordsWhileWaiting, waited, errs };
}

/* 1 ── nobody has baked the repo in: the page must not even ask */
{
  const r = await scenario("unbaked", { repo: null, api: { repo: json(200, {}) } });
  ok(r.state.cards.every((c) => c.raw === "#get" && !c.live), "unbaked: every card stays a link to this section", r.state.cards.map((c) => c.raw).join(" "));
  ok(r.external === 0 && r.hits.length === 0, "unbaked: zero requests to api.github.com — it doesn't go looking", `${r.external} offsite`);
  ok(/wasn't built by the deploy step/.test(r.state.status), "unbaked: the page says so in plain words", r.state.status);
  ok(r.state.done === "unbaked", "unbaked: state marker", String(r.state.done));
}

/* 2 ── public repo, published release: this is the whole point */
{
  const r = await scenario("release", { api: { repo: json(200, { full_name: REPO }), rel: json(200, RELEASE) } });
  const w = r.state.by.windows, m = r.state.by.mac, l = r.state.by.linux;
  ok(w.live && m.live && l.live, "release: all three cards go live");
  ok(/setup\.exe$/.test(w.abs) && !/msi/.test(w.abs), "windows picks the setup exe over the .msi", w.abs.split("/").pop());
  ok(/aarch64\.dmg$/.test(m.abs), "mac picks the Apple Silicon dmg over the Intel one", m.abs.split("/").pop());
  ok(/AppImage$/.test(l.abs) && !/deb/.test(l.abs), "linux picks the AppImage over the .deb", l.abs.split("/").pop());
  ok([w, m, l].every((c) => c.download && !c.target), "each one says download, and opens nothing in a new tab");
  ok([w, m, l].every((c) => /↓ \S+\.(exe|dmg|AppImage) · \d+(\.\d+)? MB$/.test(c.text)), "the label is the file and its size", w.text);
  ok(/v0\.3\.0 · published 2026-09-02 · 6 files on it · 3 of 3 cards filled/.test(r.state.status),
    "status: tag, date, what it found, and how much of the page it filled", r.state.status);
  ok(r.state.done === "live" && r.state.tone === "ok", "status band reads as settled and fine", r.state.tone);
  ok(r.external === 2 && r.hits.length === 2, "exactly two API calls, once, no polling", r.hits.map((u) => u.replace("https://api.github.com/repos/" + REPO, "·")).join(" + "));
    ok(r.wordsWhileWaiting > 1000, "the copy is all there before GitHub answers", `${r.wordsWhileWaiting} words`);
}

/* 3 ── public repo, nothing published: a link that works, and an honest label */
{
  const r = await scenario("no-release", { api: { repo: json(200, { full_name: REPO }), rel: notFound() } });
  ok(r.state.cards.every((c) => !c.live && c.some), "no release: nothing pretends to be a file");
  ok(r.state.cards.every((c) => c.abs === `https://github.com/${REPO}/releases` && c.raw === `https://github.com/${REPO}/releases`),
    "every card points at the releases page — never /releases/latest, which 404s when there is none", r.state.by.mac.raw);
  ok(/all releases/.test(r.state.by.mac.text) && /not posted yet/.test(r.state.by.windows.text) === false,
    "labels change to what you'll actually get", r.state.by.windows.text);
  ok(/no published release yet/.test(r.state.status) && r.state.tone === "warn", "status says there's no release yet", r.state.status);
  ok(r.state.done === "no-release" && r.state.tone === "warn", "state marker", String(r.state.done));
}

/* 4 ── private repo: the honest ceiling, and no dead links */
{
  const r = await scenario("private", { api: { repo: notFound(), rel: notFound() } });
  ok(r.state.cards.every((c) => c.raw === "#get" && !c.live && !c.some), "private: cards stay inert rather than dead");
  ok(/isn't readable from outside GitHub/.test(r.state.status) && r.state.tone === "warn", "private: it tells you the reason", r.state.status);
  ok(!/404|HTTP|API|CSP/.test(r.state.status), "and it never dumps a status code at you", r.state.status);
  ok(r.state.cards.every((c) => /not posted yet/.test(c.text) && !/github\.com/.test(c.raw)), "cards keep the wording the markup shipped with, and no off-page href", r.state.by.linux.text + " | " + r.state.by.linux.raw);
}

/* 5 ── a release with only Windows in it */
{
  const partial = { ...RELEASE, assets: [asset("Hephaestus_0.3.0_x64-setup.exe", 14.7)] };
  const r = await scenario("partial", { api: { repo: json(200, { full_name: REPO }), rel: json(200, partial) } });
  ok(r.state.by.windows.live, "partial: windows links its file");
  ok(!r.state.by.mac.live && r.state.by.mac.some && r.state.by.mac.raw.endsWith("/releases"), "partial: mac goes to the releases page instead");
  ok(/nothing for macOS in v0\.3\.0 yet/.test(r.state.by.mac.text) && !r.state.by.mac.download, "partial: and says which platform is missing", r.state.by.mac.text);
  ok(/1 file on it · 1 of 3 cards filled/.test(r.state.status), "partial: counts, and the plural is right", r.state.status);
}

/* 6 ── GitHub unreachable / returns rubbish: the page keeps its own counsel */
for (const [label, api, want, linked] of [
  ["down", { repo: "abort", rel: "abort" }, "can't reach GitHub from here", false],
  // a 200 whose body isn't JSON (captive portal, proxy page) must not throw, and must not be
  // mistaken for a release: cards keep the fallback wording, and nothing goes live
  ["rubbish", { repo: HTML, rel: HTML }, "couldn't read the answer", false],
  // and the opposite trap: repo readable, release missing — /releases genuinely exists, so
  // linking it is helpful, not a dead end
  ["half", { repo: json(200, { full_name: REPO }), rel: notFound() }, "no published release yet", true],
]) {
  const r = await scenario(label, { api });
  ok(!linked ? r.state.cards.every((c) => c.raw === "#get") : r.state.cards.every((c) => c.raw.endsWith("/releases")),
    `${label}: ${linked ? "cards link the releases page, which exists for a public repo" : "no card is linked to anything off-page"}`);
  ok(r.state.cards.every((c) => !c.live), `${label}: nothing claims to be a download`);
  ok(r.wordsWhileWaiting > 1000, `${label}: the page still reads as a page`, `${r.wordsWhileWaiting} words in ${r.waited} ms`);
  ok(new RegExp(want).test(r.state.status), `${label}: status explains it without jargon`, r.state.status);
}

/* 7 ── a slow GitHub must not hold the page up */
{
  const r = await scenario("slow", { delay: 2500, api: { repo: json(200, {}), rel: json(200, RELEASE) } });
  ok(r.waited < 2500, "the words were there well before the answer arrived", `${r.wordsWhileWaiting} words after ${r.waited} ms of a 2.5 s wait`);
  ok(r.state.by.windows.live, "…and the card fills itself the moment it does");
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
for (const f of failed) console.log(`  FAIL  ${f.label}${f.note ? `  (${f.note})` : ""}`);
process.exit(failed.length ? 1 : 0);
