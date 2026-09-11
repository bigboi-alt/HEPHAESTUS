/**
 * qa-tools/dl-qa.mjs — the cards and the release list, against a stand-in GitHub.
 *
 * The promise this page makes is two parts: click a card and the right installer downloads, and
 * every published release is listed with its files. Neither may ever rest on a guess. So the
 * suite drives one question hard — *what does the page do when GitHub's answer is anything other
 * than the happy path* — plus the things that can go wrong inside the happy path: picking the
 * wrong file out of a release, listing a release whose name is really markup, trusting a URL that
 * isn't a URL, and being fooled by a 404 that means two opposite things.
 *
 * The repo the page asks is `window.__hephRepo`, the same slot the deploy step in
 * .github/workflows/site.yml writes into — so the QA drives the real mechanism, not a copy of it.
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
const OFF = "https://api.github.com";

const asset = (name, sizeMB, url) => ({
  name, size: Math.round(sizeMB * 1048576),
  browser_download_url: url === undefined ? `https://objects.githubusercontent.com/dl/${name}` : url,
});
const release = (tag, o = {}) => ({
  tag_name: tag, name: o.name ?? tag, prerelease: !!o.pre, draft: !!o.draft,
  published_at: `${o.date ?? "2026-09-02"}T10:00:00Z`,
  html_url: o.html_url ?? `https://github.com/${REPO}/releases/tag/${tag}`, assets: o.assets ?? [],
});
const FILES = [
  asset("Hephaestus_0.3.0_x64-setup.exe", 14.7),
  asset("Hephaestus_0.3.0_x64_en-US.msi", 16.1),      // decoy: never the one to pick
  asset("Hephaestus_0.3.0_x64.dmg", 15.2),
  asset("Hephaestus_0.3.0_aarch64.dmg", 14.9),
  asset("hephaestus_0.3.0_amd64.deb", 13.4),          // decoy unless there is no AppImage
  asset("Hephaestus_0.3.0_amd64.AppImage", 21.8),
];
const BIG = release("v0.3.0", { assets: FILES });
const MID = release("v0.2.0", { date: "2026-08-19", assets: [asset("Hephaestus_0.2.0_x64-setup.exe", 14.1), asset("Hephaestus_0.2.0_aarch64.dmg", 14.4)] });
const EMPTY = release("v0.1.0", { date: "2026-07-30", name: "the first one" });   // a tag with nothing on it

const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const notFound = () => ({ status: 404, contentType: "application/json", body: '{"message":"Not Found"}' });
const HTML = { status: 200, contentType: "text/html", body: "<html><body>a captive portal, not json</body></html>" };

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

/** one scenario: what GitHub answers, and what the page ends up showing */
async function scenario(name, { repo = REPO, api, delay = 0 }) {
  const page = await browser.newPage();
  const hits = [], requests = [], errs = [];
  await page.route(`**/api.github.com/**`, async (route) => {
    const url = route.request().url();
    hits.push(url);
    if (delay) await sleep(delay);
    const answer = api?.[new URL(url).pathname.endsWith("/releases") ? "rel" : "repo"] ?? notFound();
    if (answer === "abort") return route.abort("connectionrefused");
    return route.fulfill(answer);
  });
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errs.push(String(e)));
  if (repo) await page.addInitScript(([r]) => { window.__hephRepo = r; }, [repo]);
  const t0 = Date.now();
  await page.goto(`${origin}/index.html`, { waitUntil: "commit" });
  const wordsWhileWaiting = await page.evaluate(() => document.body.innerText.trim().split(/\s+/).filter(Boolean).length);
  const waited = Date.now() - t0;
  await settle(page);
  const state = await page.evaluate(() => {
    const band = document.getElementById("status");
    const list = document.getElementById("relList");
    const rows = [...list.querySelectorAll("li")].filter((li) => li.querySelector(".tag"));
    return {
      done: band.dataset.state, tone: (band.className || "").replace(/^status\s*/, ""),
      status: document.getElementById("statusText").textContent.replace(/\s+/g, " ").trim(),
      count: document.getElementById("relCount").textContent.replace(/\s+/g, " ").trim(),
      listText: list.innerText.replace(/\s+/g, " ").trim(),
      injected: list.querySelectorAll("img, script, iframe, object, svg").length,
      injectedAll: document.querySelectorAll("img, iframe, object, svg, embed").length,
      rows: rows.map((li) => {
        const tag = li.querySelector(".tag");
        return {
          tag: tag.textContent.trim(), href: tag.tagName === "A" ? tag.getAttribute("href") : null,
          meta: [...li.querySelectorAll(".r1 > span")].map((e) => e.textContent.trim()),
          files: [...li.querySelectorAll(".files a")].map((a) => ({
            text: a.textContent.trim(), href: a.getAttribute("href"),
            download: a.getAttribute("download"), target: a.getAttribute("target"),
          })),
          bare: li.querySelectorAll(".files li").length - li.querySelectorAll(".files a").length,
        };
      }),
      cards: [...document.querySelectorAll(".os [data-dl]")].map((a) => ({
        kind: a.dataset.dl, raw: a.getAttribute("href"), abs: a.href,
        live: a.classList.contains("live"), some: a.classList.contains("some"),
        download: a.getAttribute("download"), target: a.getAttribute("target"), text: a.innerText.trim(),
      })),
    };
  });
  const by = Object.fromEntries(state.cards.map((c) => [c.kind, c]));
  const offsite = requests.filter((u) => !u.startsWith(origin));
  await page.close();
  results.push({ label: `${name}: nothing thrown into the visitor's console`, ok: errs.length === 0, note: errs.join(" | ") });
  return { name, state, by, hits, offsite, wordsWhileWaiting, waited };
}

const allGet = (r) => r.state.cards.every((c) => c.raw === "#get" && !c.live && !c.some);
const listAsWritten = (r) => /nothing to update by hand/.test(r.state.listText);

/* 1 ── the page was never told which repo: it must not go looking */
{
  const r = await scenario("no-repo", { repo: "not a repo" });
  ok(r.state.done === "no-repo", "no-repo: the reader says so and stops", String(r.state.done));
  ok(allGet(r), "no-repo: every card stays a link to this section", r.state.cards.map((c) => c.raw).join(" "));
  ok(listAsWritten(r), "no-repo: the list keeps the sentence the markup shipped with");
  ok(r.offsite.length === 0 && r.hits.length === 0, "no-repo: zero requests off this machine", `${r.offsite.length} offsite`);
  ok(/wasn't told which repo/.test(r.state.status) && r.state.tone === "warn", "no-repo: in plain words", r.state.status);
}

/* 2 ── the whole feature: three releases, cards + a list of all of them */
{
  const r = await scenario("releases", { api: { rel: json(200, [BIG, MID, EMPTY]), repo: json(200, { full_name: REPO }) } });
  const w = r.by.windows, m = r.by.mac, l = r.by.linux;
  ok([w, m, l].every((c) => c.live), "releases: all three cards go live");
  ok(/setup\.exe$/.test(w.abs) && !/msi/.test(w.abs), "releases: windows picks the setup exe over the .msi", w.abs.split("/").pop());
  ok(/aarch64\.dmg$/.test(m.abs), "releases: mac picks the Apple Silicon dmg over the Intel one", m.abs.split("/").pop());
  ok(/AppImage$/.test(l.abs) && !/deb/.test(l.abs), "releases: linux picks the AppImage over the .deb", l.abs.split("/").pop());
  ok([w, m, l].every((c) => c.download && !c.target), "releases: each downloads in this tab, nothing opens elsewhere");
  ok([w, m, l].every((c) => /↓ \S+\.(exe|dmg|AppImage) · \d+\.\d MB$/.test(c.text)), "releases: label is the file and its size", w.text);
  ok(r.state.status === "v0.3.0 · published 2026-09-02 · 6 files on it · 3 of 3 cards filled · 3 releases listed below",
    "releases: the status line tells the whole story", r.state.status);
  ok(r.state.count === "3 releases · 8 files · newest v0.3.0 · " + REPO, "releases: the heading counts what it listed", r.state.count);
  ok(r.state.rows.length === 3, "releases: every release is a row, newest first", r.state.rows.map((x) => x.tag).join(", "));
  ok(r.state.rows.map((x) => x.tag).join() === "v0.3.0,v0.2.0,v0.1.0", "releases: in the order GitHub lists them", r.state.rows.map((x) => x.tag).join(","));
  ok(r.state.rows.every((x) => x.href === `https://github.com/${REPO}/releases/tag/${x.tag}`), "releases: each tag links its own release page");
  ok(r.state.rows[0].files.length === 6 && r.state.rows[1].files.length === 2,
    "releases: every file on every release is linked, not just the newest one", `${r.state.rows[0].files.length} + ${r.state.rows[1].files.length} links`);
  ok(r.state.rows.every((x) => x.files.every((f) => /^https:\/\/objects\.githubusercontent\.com\//.test(f.href || "") && f.download && !f.target)),
    "releases: the list's links are the asset URLs themselves, with download set");
  ok(r.state.rows[0].files.every((f) => /· \d+\.\d MB$/.test(f.text)), "releases: with sizes", r.state.rows[0].files[5].text);
  ok(r.state.rows[2].files.length === 0 && /no files on this one/.test(r.state.rows[2].meta.join(" ") + r.state.listText),
    "releases: a tag with nothing on it says so instead of vanishing", r.state.rows[2].meta.join(" | "));
  ok(/the first one/.test(r.state.rows[2].meta.join(" ")) && /2026-07-30/.test(r.state.rows[2].meta.join(" ")),
    "releases: its name and date still show", r.state.rows[2].meta.join(" | "));
  ok(!/not posted yet/.test(r.state.listText), "releases: the placeholder line is gone, replaced by real rows");
  ok(r.offsite.length === 2 && r.hits.every((u) => u.startsWith(OFF)), "releases: two requests, once, both to the one allowed host", r.hits.map((u) => u.replace(OFF + "/repos/" + REPO, "·")).join(" + "));
  ok(r.wordsWhileWaiting > 1100, "releases: the copy is all there before GitHub answers", `${r.wordsWhileWaiting} words`);
}

/* 3 ── a pre-release sits on top: the list shows it, the cards must not */
{
  const rc = release("v0.4.0-rc1", { pre: true, date: "2026-09-08", assets: [asset("Hephaestus_0.4.0-rc1_x64-setup.exe", 15.0)] });
  const r = await scenario("prerelease", { api: { rel: json(200, [rc, BIG]), repo: json(200, { full_name: REPO }) } });
  ok(/0\.3\.0/.test(r.by.windows.abs) && !/rc1/.test(r.state.cards.map((c) => c.abs).join(" ")),
    "prerelease: cards skip it and take v0.3.0", r.by.windows.abs.split("/").pop());
  ok(r.state.rows[0].tag === "v0.4.0-rc1" && /pre-release/.test(r.state.rows[0].meta.join(" ")),
    "prerelease: the list still shows it, and says what it is", r.state.rows[0].meta.join(" | "));
  ok(r.state.rows[0].files.length === 1, "prerelease: and links its file anyway — you asked for it by name");
  ok(r.state.count === "2 releases · 7 files · newest v0.3.0 · " + REPO, "prerelease: the count names the stable one", r.state.count);
}

/* 4 ── nothing stable yet: no card lies, the list is still the truth */
{
  const rc = release("v0.4.0-rc1", { pre: true, assets: [asset("Hephaestus_0.4.0-rc1_x64-setup.exe", 15.0)] });
  const r = await scenario("pre-only", { api: { rel: json(200, [rc]), repo: json(200, { full_name: REPO }) } });
  ok(r.state.done === "pre-release" && r.state.tone === "warn", "pre-only: it calls the state what it is", String(r.state.done));
  ok(r.state.cards.every((c) => !c.live && c.some && c.raw === `https://github.com/${REPO}/releases`),
    "pre-only: no card pretends to be an installer", r.state.by?.windows?.raw || r.state.cards[0].raw);
  ok(/pre-release, so no card points at it/.test(r.state.status), "pre-only: and says why", r.state.status);
  ok(r.state.rows.length === 1, "pre-only: the release is still listed", r.state.rows.map((x) => x.tag).join(","));
}

/* 5 ── public repo, zero releases: the one place a link to /releases is honest */
{
  const r = await scenario("empty", { api: { rel: json(200, []), repo: json(200, { full_name: REPO }) } });
  ok(r.state.done === "no-release", "empty: state", String(r.state.done));
  ok(r.state.cards.every((c) => c.raw === `https://github.com/${REPO}/releases` && !c.live),
    "empty: cards go to the releases page — which exists, even when empty — never /releases/latest, which 404s");
  ok(/Nothing published yet/.test(r.state.listText) && /no edit to this page/.test(r.state.listText),
    "empty: the list explains instead of showing a blank box", r.state.listText.slice(0, 90));
  ok(/See the releases page/.test(r.state.listText), "empty: with a way to look for yourself");
  ok(r.state.count === "no releases yet · " + REPO, "empty: and which repo it asked", r.state.count);
  ok(/no published release on someone\/hephaestus-app yet/.test(r.state.status), "empty: status names the repo", r.state.status);
}

/* 6 ── private repo: the honest ceiling, and no dead links behind it */
{
  const r = await scenario("private", { api: { rel: notFound(), repo: notFound() } });
  ok(r.state.done === "private" && r.state.tone === "warn", "private: it names the reason", String(r.state.done));
  ok(allGet(r), "private: cards stay inert rather than dead");
  ok(listAsWritten(r), "private: the list keeps its written sentence — no link to a wall");
  ok(!/github\.com/.test(r.state.cards.map((c) => c.raw).join(" ") + r.state.listText), "private: not one github.com link on the page");
  ok(new RegExp(REPO + " isn't readable from outside GitHub").test(r.state.status), "private: and says what to do about it", r.state.status);
  ok(!/404|HTTP|API|CSP/.test(r.state.status), "private: without dumping a status code at you", r.state.status);
}

/* 7 ── a release with only one platform on it */
{
  const only = release("v0.3.0", { assets: [asset("Hephaestus_0.3.0_x64-setup.exe", 14.7)] });
  const r = await scenario("partial", { api: { rel: json(200, [only]), repo: json(200, { full_name: REPO }) } });
  ok(r.by.windows.live, "partial: windows links its file");
  ok(!r.by.mac.live && r.by.mac.some && r.by.mac.raw.endsWith("/releases"), "partial: mac goes to the releases page instead");
  ok(/nothing for macOS in v0\.3\.0 yet/.test(r.by.mac.text) && !r.by.mac.download,
    "partial: and says which platform is missing", r.by.mac.text);
  ok(r.state.rows[0].files.length === 1, "partial: the list shows the one file that exists");
  ok(r.state.status.includes("1 of 3 cards filled"), "partial: counts what it filled", r.state.status);
}

/* 8 ── GitHub refusing, or answering in HTML: neither is evidence about your repo */
for (const [label, api, want] of [
  ["down", { rel: "abort", repo: "abort" }, "can't reach GitHub from here"],
  ["rubbish", { rel: HTML, repo: HTML }, "couldn't read the answer"],
]) {
  const r = await scenario(label, { api });
  ok(allGet(r), `${label}: no card is linked to anything off-page`);
  ok(listAsWritten(r), `${label}: the list stays as written`);
  ok(r.wordsWhileWaiting > 1100, `${label}: the page still reads as a page`, `${r.wordsWhileWaiting} words in ${r.waited} ms`);
  ok(new RegExp(want).test(r.state.status) && r.state.rows.length === 0, `${label}: status explains it without jargon`, r.state.status);
}

/* 9 ── release bodies are somebody's strings: they get text, not markup */
{
  const nasty = release("<img src=x onerror=alert(1)>", {
    name: "<script>alert(2)</script>",
    assets: [asset("<b>setup.exe</b>", 1.5), asset("ok.exe", 1.5, "javascript:alert(3)")],
    html_url: "javascript:alert(4)",
  });
  const r = await scenario("hostile", { api: { rel: json(200, [nasty]), repo: json(200, { full_name: REPO }) } });
  ok(r.state.injected === 0, "hostile: no img, script, iframe or svg was ever created", `${r.state.injected} nodes`);
  ok(/<img src=x onerror=alert\(1\)>/.test(r.state.listText), "hostile: the tag shows up as the text it is", r.state.rows[0]?.tag);
  ok(r.state.rows[0].href === null, "hostile: a release whose page URL isn't a github.com URL gets a plain tag, not a link");
  ok(!/javascript:/.test(JSON.stringify(r.state.rows)), "hostile: a javascript: download URL is never linked", r.state.rows[0]?.files.map((f) => f.href).join(" "));
  ok(r.state.rows[0].files.length === 1 && r.state.rows[0].bare === 1,
    "hostile: the linkable file links, the un-linkable one is named in plain text",
    `${r.state.rows[0].files.length} link + ${r.state.rows[0].bare} bare of 2`);
  ok(/<b>setup\.exe<\/b> · 1\.5 MB$/.test(r.state.rows[0].files[0].text) && /^https:\/\/objects\./.test(r.state.rows[0].files[0].href),
    "hostile: and the list still offers a real https asset whose name is absurd — as text", r.state.rows[0].files[0].text);
  // its name doesn't end in .exe, so it is *not* a Windows installer by rule: the card says so
  ok(!r.by.windows.live && /nothing for Windows in <img src=x onerror=alert\(1\)> yet/.test(r.by.windows.text),
    "hostile: a name that fails the extension test never becomes a card", r.by.windows.text);
  ok(r.state.injectedAll === 0, "hostile: zero img/script/iframe/object/svg anywhere on the page", `${r.state.injectedAll}`);
}

/* 10 ── more releases than the page lists */
{
  const many = Array.from({ length: 25 }, (_, i) => release(`v1.${i}.0`, { date: `2026-0${(i % 8) + 1}-0${(i % 9) + 1}`, assets: i ? [] : [asset("a-setup.exe", 1)] }));
  const r = await scenario("many", { api: { rel: json(200, many), repo: json(200, { full_name: REPO }) } });
  ok(r.state.rows.length === 24, "many: 24 rows, not 25 — the page doesn't grow without limit", `${r.state.rows.length}`);
  ok(/1 older release not shown here/.test(r.state.listText) && /all of them on GitHub/.test(r.state.listText),
    "many: and it says how many it left out", r.state.listText.slice(-80));
  ok(/24 releases · 1 file/.test(r.state.count), "many: the count matches what's on screen", r.state.count);
}

/* 11 ── a slow GitHub must not hold the page up */
{
  const r = await scenario("slow", { delay: 2500, api: { rel: json(200, [BIG]), repo: json(200, { full_name: REPO }) } });
  ok(r.waited < 2000, "slow: the words were there well before the answer arrived", `${r.wordsWhileWaiting} words after ${r.waited} ms of a 2.5 s wait`);
  ok(r.by.windows.live && r.state.rows.length === 1, "slow: and everything fills itself when it does");
}

/* 12 ── the shipped file, with nobody baking anything: it reads the repo in the markup */
{
  const r = await scenario("default", { repo: false, api: { rel: json(200, []), repo: json(200, { full_name: "bigboi-alt/HEPHAESTUS" }) } });
  ok(r.hits.length === 2 && r.hits.every((u) => u.startsWith("https://api.github.com/repos/bigboi-alt/HEPHAESTUS")),
    "default: with no test hook at all it asks the repo written in the file, twice at most, and no other host",
    r.hits.map((u) => new URL(u).pathname).join(" + "));
  ok(r.state.done === "no-release", "default: your repo is public and empty right now, which is exactly the state it finds", String(r.state.done));
  ok(r.state.cards.every((c) => c.raw === "https://github.com/bigboi-alt/HEPHAESTUS/releases" && !c.live),
    "default: so the cards point at that releases page and nothing else", r.state.cards[0].raw);
  ok(/bigboi-alt\/HEPHAESTUS/.test(r.state.count) && /Nothing published yet/.test(r.state.listText),
    "default: the list says what it read and what it found", r.state.count);
  ok(r.wordsWhileWaiting > 1100, "default: the page reads as a page either way", `${r.wordsWhileWaiting} words`);
}

await browser.close();
server.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
for (const f of failed) console.log(`  FAIL  ${f.label}${f.note ? `  (${f.note})` : ""}`);
process.exit(failed.length ? 1 : 0);
