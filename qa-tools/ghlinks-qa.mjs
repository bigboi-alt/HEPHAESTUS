/**
 * The link rule for this page: a link on it may not be able to 404.
 *
 * The user's complaint, verbatim: "the cards arent connected to the github it
 * redirected to github 404". So every GitHub URL is written at runtime, and only
 * after the repo has been checked — and when it can't be checked, the links land on
 * the "the code" section of this same page instead of a dead repo.
 *
 * config.js and the GitHub API are both intercepted, so this suite is deterministic
 * and needs no network: five states, and what the page is allowed to do in each.
 */
import { chromium } from "playwright";

const SITE = process.env.SITE || "http://127.0.0.1:8099/index.html";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const cfg = (o) => `window.HEPH = ${JSON.stringify(o)};`;
const ASSETS = [
  { name: "Hephaestus_0.3.0_x64-setup.exe", size: 8808038, browser_download_url: "https://objects.example/setup.exe" },
  { name: "Hephaestus_0.3.0_x64.msi", size: 9000000, browser_download_url: "https://objects.example/x64.msi" },
  { name: "Hephaestus_0.3.0_aarch64.dmg", size: 10485760, browser_download_url: "https://objects.example/arm.dmg" },
  { name: "Hephaestus_0.3.0_x64.dmg", size: 11000000, browser_download_url: "https://objects.example/intel.dmg" },
  { name: "Hephaestus_0.3.0_amd64.AppImage", size: 7340032, browser_download_url: "https://objects.example/app.appimage" },
  { name: "Hephaestus_0.3.0_amd64.deb", size: 7000000, browser_download_url: "https://objects.example/deb" },
];

/**
 * config: the site's window.HEPH
 * api:    what GET /repos/<o>/<r> answers
 * rel:    what GET /repos/<o>/<r>/releases/latest answers
 */
async function run(label, { config, api = { status: 404 }, rel = { status: 404 } }) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  await page.route("**/config.js", (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: config ? cfg(config) : "" }));
  // narrow first, and the broad one defers: playwright takes the FIRST matching route
  await page.route("**/releases/latest", (r) =>
    r.fulfill(rel.status === 200 ? { status: 200, contentType: "application/json", body: JSON.stringify(rel.body) }
                                 : { status: rel.status, body: "{}" }));
  await page.route(/api\.github\.com\/repos\/[^/]+\/[^/]+$/, (r) => r.fulfill(
    api.status === 200 ? { status: 200, contentType: "application/json", body: JSON.stringify(api.body) }
                       : { status: api.status, body: "{}" }));
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const r = await page.evaluate(() => {
    const cards = {};
    document.querySelectorAll("[data-kind]").forEach((a) => {
      cards[a.getAttribute("data-kind")] = {
        href: a.getAttribute("href"),
        file: a.querySelector(".file").innerText.replace(/\s+/g, " ").trim(),
      };
    });
    const g = (id) => { const e = document.getElementById(id); return e ? e.getAttribute("href") : null; };
    return {
      cards,
      main: g("mainBtn"),
      foot: document.querySelector("[data-gh=repo]").getAttribute("href"),
      status: document.getElementById("statusText").textContent.trim(),
      statusCls: document.getElementById("status").className.replace("status", "").trim(),
      note: document.getElementById("note").innerText.replace(/\s+/g, " ").trim().slice(0, 90),
      // anything that could send a visitor somewhere that doesn't exist
      ghHrefs: [...document.querySelectorAll("a[href^='http']")].map((a) => a.getAttribute("href")).filter((h) => /^https:\/\/github\.com\//.test(h)),
      anchors: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).slice(1),
      missingTargets: [...document.querySelectorAll('a[href^="#"]')].filter((a) => a.getAttribute("href").length > 1 && !document.querySelector(a.getAttribute("href"))).map((a) => a.getAttribute("href")),
      you: [...document.querySelectorAll(".tag")].filter((t) => !t.hidden).map((t) => t.closest("[data-kind]").getAttribute("data-kind")),
    };
  });
  console.log(`\n${label}\n  status: [${r.statusCls || "—"}] ${r.status}`);
  await b.close();
  return { ...r, errs };
}

/* ── 1 · the shipped state: no owner yet ────────────────────────────────────── */
{
  const r = await run("unconnected (the placeholder config someone clones)", {
    config: { owner: "your-github-username", repo: "hephaestus", sourcePublic: false, contact: "" },
  });
  ok(r.ghHrefs.length === 0, "not one link points at github.com — nothing to 404 on");
  ok(Object.values(r.cards).every((c) => c.href === "#source"), "all three cards hand the visitor to “the code” on this page");
  ok(r.main === "#get", `the headline button scrolls to the download section instead (${r.main})`);
  ok(/isn't connected/.test(r.status), "and says so plainly");
  ok(/connect\.mjs/.test(r.note), `the note tells the owner the one command (${r.note.slice(0, 46)}…)`);
}

/* ── 2 · connected, release with installers ────────────────────────────────── */
{
  const r = await run("connected and published", {
    config: { owner: "ada", repo: "hephaestus", sourcePublic: true, contact: "" },
    api: { status: 200, body: { html_url: "https://github.com/ada/hephaestus" } },
    rel: { status: 200, body: { tag_name: "v0.3.0", published_at: "2026-09-01T10:00:00Z", body: "## What's in it\n\nLayouts keep their spacing when you drag, and the reviewer re-measures every fix.\n\n- `npm run tauri build`", assets: ASSETS } },
  });
  ok(r.cards.windows.href === "https://objects.example/setup.exe", `windows → ${r.cards.windows.href}`);
  ok(r.cards.mac.href === "https://objects.example/arm.dmg", `mac → ${r.cards.mac.href}`);
  ok(r.cards.linux.href === "https://objects.example/app.appimage", `linux → ${r.cards.linux.href}`);
  ok(/8\.4 MB/.test(r.cards.windows.file) && /setup\.exe/.test(r.cards.windows.file), `the card shows the real file and size: “${r.cards.windows.file}”`);
  ok(/^v0\.3\.0/.test(r.status) && r.statusCls === "live", `status reads the release: ${r.status.slice(0, 58)}`);
  ok(!/```|##/.test(r.status), "changelog markdown didn't leak into that line");
  ok(r.main === "https://objects.example/app.appimage", "the headline button picks the visitor's own platform");
  ok(r.foot === "https://github.com/ada/hephaestus", `the footer source link is now the repo (${r.foot})`);
  ok(r.you.length === 1 && r.you[0] === "linux", "exactly one card is flagged as this machine's");
  ok(r.errs.length === 0, "no page errors");
}

/* ── 3 · repo up, nothing released yet ─────────────────────────────────────── */
{
  const r = await run("connected, repo public, no release", {
    config: { owner: "ada", repo: "hephaestus", sourcePublic: true, contact: "" },
    api: { status: 200, body: { html_url: "https://github.com/ada/hephaestus" } },
    rel: { status: 404 },
  });
  ok(Object.values(r.cards).every((c) => c.href === "https://github.com/ada/hephaestus/releases"),
     "cards go to the releases page, which GitHub renders even when it's empty");
  ok(/no release published/.test(r.status), `status says what's true: ${r.status}`);
  ok(r.ghHrefs.length > 0 && r.ghHrefs.every((h) => h.startsWith("https://github.com/ada/hephaestus")),
     `every github link on the page is a page that exists (${r.ghHrefs.length} links, all under the repo)`);
}

/* ── 4 · owner named the repo but it isn't public ──────────────────────────── */
{
  const r = await run("connected, but the repo 404s (private or a typo)", {
    config: { owner: "ada", repo: "hephaestus", sourcePublic: true, contact: "" },
    api: { status: 404 },
  });
  ok(r.ghHrefs.length === 0, "the page refuses to link at a repo it couldn't confirm");
  ok(Object.values(r.cards).every((c) => c.href === "#source"), "cards fall back to this page");
  ok(/isn't public yet/.test(r.status) && r.statusCls === "warn", `and explains: ${r.status}`);
  ok(r.foot === "#source", `even the footer link stays put (${r.foot})`);
}

/* ── 5 · no network at all (opened from a file, or offline) ────────────────── */
{
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.route("**/config.js", (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: cfg({ owner: "ada", repo: "hephaestus", sourcePublic: true, contact: "" }) }));
  await ctx.route("**/api.github.com/**", (r) => r.abort("failed"));
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => ({
    status: document.getElementById("statusText").textContent.trim(),
    gh: [...document.querySelectorAll("a[href^='http']")].map((a) => a.href).filter((h) => /github\.com/.test(h)).length,
    hidden: [...document.querySelectorAll(".reveal")].filter((e) => getComputedStyle(e).opacity === "0").length,
  }));
  console.log("\nGitHub unreachable\n  status: " + r.status);
  ok(/can't reach GitHub/.test(r.status), "a network failure is reported as a network failure, not as “no repo”");
  ok(r.gh === 0, "and no dead external link is invented to fill the gap");
  ok(errs.length === 0, "no page errors from the failed fetch");
  await b.close();
}

/* ── 6 · every in-page anchor lands somewhere ──────────────────────────────── */
{
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  await page.goto(SITE, { waitUntil: "networkidle" });
  const r = await page.evaluate(() => {
    const dead = [...document.querySelectorAll('a[href^="#"]')].filter((a) => {
      const h = a.getAttribute("href");
      return h.length > 1 && !document.getElementById(h.slice(1));
    }).map((a) => a.getAttribute("href"));
    const ext = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => /^https?:/.test(h));
    const cdn = ext.filter((h) => !/github\.com/.test(h));
    return { dead, external: ext.length, cdn, bodyText: document.body.innerText };
  });
  console.log("\nanchors and assets");
  ok(r.dead.length === 0, `no in-page link points at a missing id ${JSON.stringify(r.dead)}`);
  ok(r.cdn.length === 0, "and nothing reaches off-box for a font, script or image");
  ok(!/404|not found/i.test(r.bodyText), "the page never prints “404” at a visitor");
  await b.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
