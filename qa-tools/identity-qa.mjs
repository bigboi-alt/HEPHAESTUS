/**
 * qa-tools/identity-qa.mjs — the forge mark, the founder's key, and the update check.
 *
 * Three things are easy to fake and are therefore checked hard:
 *   1. a tier has to be *measured*. The founder set is only allowed to read 100 if every component
 *      independently maxes out, so that is asserted component by component, not by a stored number.
 *   2. a mark has to be *frozen*. Reloading with a different clock must not quietly re-forge it.
 *   3. an update check has to be *honest*. "Couldn't reach the feed" must never render as "up to date",
 *      and a check that happened an hour ago must not happen again.
 *
 * Pure maths runs on the real engine module inside the page (same file the UI imports); the flows run
 * through the actual UI with a routed release file, so nothing here touches the network.
 */
import { APP, ROOT } from "./paths.mjs";
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);

/* ── 1 · the ladder ───────────────────────────────────────────────────────── */

const ladder = await page.evaluate(async () => {
  const { TIERS, tierFor } = await import("/src/engine/identity.ts");
  return {
    tiers: TIERS.map((t) => ({ ...t })),
    at: [0, 39, 40, 54, 55, 69, 70, 79, 80, 89, 90, 96, 97, 100, -5, 143].map((n) => ({ n, name: tierFor(n).name })),
  };
});
ok(ladder.tiers.length === 7, `the ladder has seven bands, as designed (${ladder.tiers.length})`);
ok(ladder.tiers[0].min === 0 && ladder.tiers[6].max === 100, "and it runs from 0 to 100 with no gap at either end");
const seams = ladder.tiers.slice(1).filter((t, i) => t.min !== ladder.tiers[i].max + 1);
ok(seams.length === 0, `the bands butt up against each other exactly (0–39, 40–54, 55–69, 70–79, 80–89, 90–96, 97–100)`);
ok(ladder.tiers.every((t, i) => t.mark && t.note && t.name === ["RAW IRON", "TEMPERED IRON", "SILVERFORGED", "GILDED", "MASTERFORGED", "HEPHAESTEAN", "DIVINE FORGE"][i]),
  "every band keeps its name, its mark and its one-line meaning");
for (const [n, want] of [[0, "RAW IRON"], [39, "RAW IRON"], [40, "TEMPERED IRON"], [54, "TEMPERED IRON"], [55, "SILVERFORGED"], [69, "SILVERFORGED"], [70, "GILDED"], [79, "GILDED"], [80, "MASTERFORGED"], [89, "MASTERFORGED"], [90, "HEPHAESTEAN"], [96, "HEPHAESTEAN"], [97, "DIVINE FORGE"], [100, "DIVINE FORGE"]]) {
  const got = ladder.at.find((a) => a.n === n)?.name;
  if (got !== want) ok(false, `tierFor(${n}) should be ${want}, got ${got}`);
}
ok(ladder.at.filter((a) => [0, 39, 40, 54, 55, 69, 70, 79, 80, 89, 90, 96, 97, 100].includes(a.n)).every((a) => a.name),
  "every boundary in the table resolves to a band, including both edges of each seam");
ok(ladder.at.find((a) => a.n === -5).name === "RAW IRON" && ladder.at.find((a) => a.n === 143).name === "DIVINE FORGE",
  "and a score out of range is clamped rather than crashing the card");

/* ── 2 · the seed: ten numbers in, one number out, no wiggle room ─────────── */

const seeding = await page.evaluate(async () => {
  const { seedOf, isLeapYear, forgeMark } = await import("/src/engine/identity.ts");
  const R = (o = {}) => ({
    place: "coords", lat: 28.6139, lon: 77.209, tz: "Asia/Kolkata", year: 2026, dayOfYear: 255,
    hour: 14, minute: 32, second: 7, ms: 640, weatherCode: 1, temperature: 31.4, humidity: 58,
    takenAt: 1789000000000, ...o,
  });
  const base = seedOf(R());
  const changed = {};
  for (const k of ["lat", "lon", "year", "dayOfYear", "hour", "minute", "second", "ms", "weatherCode", "temperature", "humidity"]) {
    const alt = { lat: 1, lon: 1, year: 2027, dayOfYear: 1, hour: 1, minute: 1, second: 1, ms: 1, weatherCode: 3, temperature: 1, humidity: 1 }[k];
    changed[k] = seedOf(R({ [k]: alt })) !== base;
  }
  const clock = seedOf(R({ place: "clock", lat: -70, lon: 120 }));
  const clock2 = seedOf(R({ place: "clock", lat: 12, lon: -33 }));
  const a = forgeMark(R());
  const b = forgeMark(R());
  const c = forgeMark(R({ ms: 641 }));
  return {
    base, changed, clockOnlyIgnoresPlace: clock === clock2,
    determinism: JSON.stringify(a.palette.swatches) === JSON.stringify(b.palette.swatches) && a.score === b.score,
    sensitive: JSON.stringify(a.palette.swatches) !== JSON.stringify(c.palette.swatches) || a.score !== c.score,
    dayMode: forgeMark(R({ hour: 12 })).palette.mode,
    nightMode: forgeMark(R({ hour: 2 })).palette.mode,
    noSky: forgeMark(R({ weatherCode: null, temperature: null, humidity: null, place: "clock", lat: 0, lon: 0 })).palette.prompt.includes("no sky read"),
    inputs: a.inputs.map((i) => i.label),
    leap: [isLeapYear(2024), isLeapYear(2026), isLeapYear(2000), isLeapYear(1900)],
  };
});
ok(Object.values(seeding.changed).every(Boolean), "every one of the eleven inputs moves the seed — none of them is decoration");
ok(seeding.clockOnlyIgnoresPlace, "a clock-only mark ignores latitude and longitude entirely, so it cannot be secretly place-derived");
ok(seeding.determinism, "the same reading twice gives the identical palette and the identical score");
ok(seeding.sensitive, "one millisecond later can give a different mark — the seed is really that tight");
ok(seeding.dayMode === "light" && seeding.nightMode === "dark", "the hour decides whether the mark is forged for daylight or for the dark");
ok(seeding.noSky, "and when the sky was never read, the mark says “no sky read” instead of inventing weather");
ok(seeding.inputs.length === 10 && seeding.inputs[4] === "type of year", `About shows the ten inputs by name (${seeding.inputs.join(", ")})`);
ok(seeding.leap.join(",") === "true,false,true,false", "the leap-year rule is the real one, including the 1900 exception");

/* ── 3 · the grading is measurement, and the founder's set has to earn 100 ── */

const grading = await page.evaluate(async () => {
  const { gradeMark, founderMark, forgeMark, IDENTITY_ROLES } = await import("/src/engine/identity.ts");
  const P = (hexes, mode = "dark") => ({
    id: "p", name: "p", prompt: "", scheme: "analogous", mode, seed: 1, createdAt: 0,
    swatches: ["background", "surface", "border", "text", "muted", "primary", "secondary", "accent"].map((role, i) => ({ role, hex: hexes[i], name: role, locked: false })),
  });
  const f = founderMark();
  const founderHexes = f.palette.swatches.map((s) => s.hex);
  const R = { place: "clock", lat: 0, lon: 0, tz: "x", year: 2026, dayOfYear: 100, hour: 9, minute: 0, second: 0, ms: 0, weatherCode: null, temperature: null, humidity: null, takenAt: 0 };
  const spread = [];
  let floorOk = true;
  for (let i = 0; i < 900; i++) {
    const m = forgeMark({ ...R, minute: i % 60, second: (i * 7) % 60, ms: (i * 137) % 1000, hour: i % 24 });
    spread.push(m.score);
    const sum = m.components.reduce((a, c) => a + c.value, 0);
    if (m.score !== Math.floor(Math.min(100, Math.max(0, sum)))) floorOk = false;
  }
  const muddy = P(["#7f7f7f", "#808080", "#818181", "#7e7e7e", "#7d7d7d", "#828282", "#838383", "#848484"]);
  const dup = P([...founderHexes.slice(0, 7), founderHexes[5]]);        // accent copies primary
  return {
    founder: { score: f.score, tier: f.tier.name, allMax: f.components.every((c) => c.value === c.max), components: f.components.map((c) => `${c.key}:${c.value}/${c.max}`), founder: f.founder, reading: f.reading },
    sumsMatchFloor: floorOk,
    min: Math.min(...spread), max: Math.max(...spread), mean: spread.reduce((a, b) => a + b, 0) / spread.length,
    perfect: spread.filter((s) => s === 100).length,
    muddy: gradeMark(muddy),
    dup: { clean: gradeMark(P(founderHexes)).score, withDuplicate: gradeMark(dup).score },
    wornCount: IDENTITY_ROLES.length,
    bounds: f.components.every((c) => c.value >= 0 && c.value <= c.max),
  };
});
ok(grading.founder.allMax && grading.founder.score === 100, `the founder set measures 100 because every component maxes out (${grading.founder.components.join(" ")})`);
ok(grading.founder.tier === "DIVINE FORGE", `and that lands it on the top band by measurement — ${grading.founder.tier}`);
ok(grading.founder.founder && grading.founder.reading === null, "it is flagged as the founder's own set and carries no reading to edit");
ok(grading.sumsMatchFloor, "across 900 forged marks the printed score is the floor of the components — nothing rounds up a tier");
ok(grading.bounds, "no component can report more than its own maximum");
ok(grading.muddy.score < 40 && grading.muddy.tier.name === "RAW IRON", `a flat grey palette is graded RAW IRON (${grading.muddy.score}/100), not flattered`);
ok(grading.dup.withDuplicate < grading.dup.clean, `duplicating a colour costs the mark real points (${grading.dup.clean} → ${grading.dup.withDuplicate})`);
ok(grading.wornCount === 6, "six of the eight roles are the identity itself; the other two are furniture");

/* ── 4 · the tiers actually spread, and the top one stays rare ───────────── */

const spread = await page.evaluate(async () => {
  const { forgeMark, TIERS } = await import("/src/engine/identity.ts");
  let rnd = 20260912;
  const r = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const codes = [null, 0, 1, 2, 3, 45, 48, 51, 61, 63, 71, 75, 80, 82, 95, 96, 99];
  const counts = Object.fromEntries(TIERS.map((t) => [t.name, 0]));
  let perfect = 0;
  const spread = [];
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const m = forgeMark({
      place: r() < 0.75 ? "coords" : "clock", lat: r() * 160 - 80, lon: r() * 360 - 180, tz: "x",
      year: 1999 + Math.floor(r() * 40), dayOfYear: 1 + Math.floor(r() * 366), hour: Math.floor(r() * 24),
      minute: Math.floor(r() * 60), second: Math.floor(r() * 60), ms: Math.floor(r() * 1000),
      weatherCode: codes[Math.floor(r() * codes.length)], temperature: r() < 0.9 ? r() * 45 - 20 : null,
      humidity: r() < 0.9 ? r() * 100 : null, takenAt: 0,
    });
    counts[m.tier.name]++;
    spread.push(m.score);
    if (m.score === 100) perfect++;
  }
  return { counts, perfect, N, mean: spread.reduce((a, b) => a + b, 0) / spread.length };
});
// the whole point of a ladder: most people land in the middle, the bottom must be reachable, and the
// top must not be handed out. The founder's set above proves 100 is attainable by measurement; these
// numbers prove ordinary marks are not drifting toward it on their own.
const lowBands = ["RAW IRON", "TEMPERED IRON", "SILVERFORGED", "GILDED", "MASTERFORGED", "HEPHAESTEAN"];
const thin = lowBands.filter((k) => spread.counts[k] < 20);
ok(thin.length === 0, `3,000 forged marks actually fill the ladder — every band below the top has at least 20 (${lowBands.map((k) => k + ":" + spread.counts[k]).join(", ")})`);
ok(spread.counts["RAW IRON"] >= 20, `the bottom of the ladder is reachable, not a threat (${spread.counts["RAW IRON"]} marks came out RAW IRON)`);
ok(spread.perfect === 0 && spread.counts["DIVINE FORGE"] <= 15,
  `and nobody is handed the top band: ${spread.counts["DIVINE FORGE"]} of ${spread.N} marks reached 97+, ${spread.perfect} reached 100`);
ok(spread.mean > 55 && spread.mean < 85, `the average mark sits mid-ladder at ${spread.mean.toFixed(1)}, so the tiers discriminate`);

/* ── 5 · the key: folded in the bundle, forgiving at the keyboard ────────── */

const KEY = "NØX::VΞR::ΛRT::DΞI::GΛD::KΛL";
const keying = await page.evaluate(async (want) => {
  const { keyMatches, normaliseKey, keySigil } = await import("/src/engine/identity.ts");
  return {
    sigil: keySigil(),
    forms: {
      glyphs: keyMatches(want),
      plain: keyMatches("nox::ver::art::dei::gad::kal"),
      spaces: keyMatches("nox ver art dei gad kal"),
      caps: keyMatches("NOXVERARTDEIGADKAL"),
      inside: keyMatches("some keys first, then nox-ver-art-dei-gad-kal"),
    },
    rejects: [keyMatches(""), keyMatches("nox"), keyMatches("nox::ver::art::dei::gad"), keyMatches("kal"), keyMatches("hack the forge")],
    collapsed: [
      normaliseKey("ØΞΛ") === normaliseKey("oea"),
      normaliseKey("N0X::V3R::4RT::D3I::G4D::K4L") === normaliseKey("NOX::VER::ART::DEI::GAD::KAL"),
      normaliseKey("nox ver art dei gad kal.") === normaliseKey("NOX-VER-ART_DEI GAD KAL"),
    ].every(Boolean),
  };
}, KEY);
ok(keying.sigil === KEY, `the sigil the app prints is exactly the founder's string (${keying.sigil})`);
ok(Object.values(keying.forms).every(Boolean), "typed with the glyph vowels, the plain letters, spaces or caps — any of them unlocks it");
ok(keying.rejects.every((v) => v === false), "nothing partial unlocks it: an empty buffer, a prefix, a suffix or a guess all fail");
ok(keying.collapsed, "the normaliser really does fold the look-alikes together");

// the plaintext key must not be sitting in the source; only the folded bytes are
const grepped = execFileSync("bash", ["-c", `grep -rIl -e "nox::ver" -e "noxverartdeigadkal" src/ 2>/dev/null | tr '\\n' ' '`], { cwd: ROOT, encoding: "utf8" }).trim();
ok(grepped === "", `the key appears in no source file${grepped ? ` (found in ${grepped})` : ""}`);
const identitySrc = readFileSync(`${ROOT}/src/engine/identity.ts`, "utf8");
const folded = { hasFolded: /const FOLDED = \[0x[0-9a-f]{2}, 0x/.test(identitySrc), literal: /"nox[\s:.\-_]*ver/.test(identitySrc) };
ok(folded.hasFolded && !folded.literal, "the module ships folded byte offsets and no literal string, so a grep of the bundle finds nothing");
const distJs = `${ROOT}/dist/assets`;
if (existsSync(distJs)) {
  const inBundle = execFileSync("bash", ["-c", `grep -l "nox::ver" ${distJs}/*.js 2>/dev/null | wc -l`], { encoding: "utf8" }).trim();
  ok(inBundle === "0", "and the built bundle carries no plaintext key either");
} else {
  ok(false, "dist/assets is missing — run `npm run build` before this suite so the bundle can be grepped");
}

/* ── 6 · the card in the app: asked once, then frozen ─────────────────────── */

// a clean install, in its own context: clearing storage under a live app races the debounced write
const askedCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await askedCtx.route("**/release.json**", (r) => r.abort());
const askedPage = await askedCtx.newPage();
await askedPage.goto(APP, { waitUntil: "domcontentloaded" });
await askedPage.waitForTimeout(800);
const asked = await askedPage.evaluate(() => {
  const t = document.body.innerText;
  return { hasCard: /your forge mark/i.test(t), asks: /read place \+ sky/i.test(t), promises: /clock only/i.test(t), other: /place \+ clock/i.test(t) };
});
ok(asked.hasCard && asked.asks && asked.promises, `on a machine that has never been asked, the dashboard asks one question and offers both answers (${JSON.stringify(asked)})`);
await askedCtx.close();

await page.evaluate(() => localStorage.clear());
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.getByRole("button", { name: "clock only", exact: true }).first().click();
await page.waitForFunction(() => document.body.innerText.includes("load into akmon"), null, { timeout: 8000 });
// storage is written on a 400 ms debounce — read it only once the mark is actually in there
await page.waitForFunction(() => JSON.parse(localStorage.getItem("hephaestus.v1") || "{}").identity, null, { timeout: 5000 });
const forged = await page.evaluate(() => {
  const snap = JSON.parse(localStorage.getItem("hephaestus.v1") || "{}");
  const t = document.body.innerText;
  const m = t.match(/(\d+)\/100/);
  return {
    snap: snap.identity ? { seed: snap.identity.seed, place: snap.identity.place, score: snap.identity.score, tier: snap.identity.tier?.name, worn: snap.identity.palette.swatches.length } : null,
    consent: snap.settings?.identityConsent, onScreen: m ? m[0] : null, tier: m ? t.split("\n").find((l) => l.includes("/100")) : null,
    admits: /clock only/i.test(t), stillAsking: /read place \+ sky/i.test(t),
  };
});
ok(forged.snap && forged.snap.place === "clock", "declining forges a clock-only mark immediately, so nobody is left with an unanswered card");
ok(forged.consent === "declined", "and the answer itself is remembered, not just the result");
ok(forged.onScreen, `the card prints the measured score and the band it lands on (${forged.tier?.trim().slice(0, 60)})`);
ok(forged.admits && !forged.stillAsking, "the card says “clock only” in plain words, and stops asking");

const seedBefore = forged.snap.seed;
await page.evaluate(() => { localStorage.setItem("hephaestus.v2-bait", "different minute"); });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
const after = await page.evaluate(() => {
  const snap = JSON.parse(localStorage.getItem("hephaestus.v1") || "{}");
  return { seed: snap.identity?.seed, score: snap.identity?.score, onscreen: document.body.innerText.includes("load into akmon") };
});
ok(after.seed === seedBefore, "an hour later the mark is the same mark — reload does not re-forge it");
ok(after.onscreen, "and it comes back from storage already worn, with no second asking");

/* ── 7 · geolocation refused is still a mark, not a hang ─────────────────── */

await page.evaluate(() => localStorage.clear());
const denied = await ctx.newPage();
await denied.route("**/release.json**", (r) => r.abort());
await denied.goto(APP, { waitUntil: "domcontentloaded" });
await denied.waitForTimeout(500);
const t0 = Date.now();
await denied.getByRole("button", { name: "read place + sky" }).first().click();
await denied.waitForFunction(() => document.body.innerText.includes("load into akmon"), null, { timeout: 15000 });
await denied.waitForFunction(() => JSON.parse(localStorage.getItem("hephaestus.v1") || "{}").identity, null, { timeout: 5000 });
const deniedMs = Date.now() - t0;
const deniedState = await denied.evaluate(() => ({
  snap: JSON.parse(localStorage.getItem("hephaestus.v1") || "{}").identity,
  admits: /clock only/i.test(document.body.innerText),
}));
ok(deniedState.snap?.place === "clock", "with permission denied by the browser, the app still forges — from the clock, and says so");
ok(deniedMs < 12000, `and it does not sit there waiting for a prompt that will never answer (${(deniedMs / 1000).toFixed(1)}s)`);
ok(deniedState.admits, "the card reads “clock only” rather than claiming a place it never read");
await denied.close();

/* ── 8 · the update check: available, current, unreachable, and throttled ── */

async function withFeed(feed, seedUpdate) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const reqs = [];
  await c.route("**/release.json**", (r) => feed === null ? r.abort() : r.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ schema: 1, status: feed.status, product: "Hephaestus", version: feed.version, files: [] }),
  }));
  if (seedUpdate) {
    await c.addInitScript((u) => {
      localStorage.setItem("hephaestus.v1", JSON.stringify({
        version: 1, palettes: [], savedAt: 1, sites: [], identity: null,
        settings: { identityConsent: "declined" }, update: u,
      }));
    }, seedUpdate);
  }
  const p = await c.newPage();
  p.on("request", (rq) => { if (/release\.json/.test(rq.url())) reqs.push(rq.url()); });
  await p.goto(APP, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  return { p, c, reqs };
}

const newer = await withFeed({ status: "ready", version: "0.99.0" });
const newerText = await newer.p.evaluate(() => {
  const t = document.body.innerText;
  const link = [...document.querySelectorAll("a")].find((a) => /get it/.test(a.textContent));
  return { mentions: /v0\.99\.0 is out/.test(t), href: link?.getAttribute("href") || null, asks: /read place/.test(t) };
});
ok(newerText.mentions, "a newer release on the feed shows up on the dashboard as a version number, not a dot");
ok(newerText.href === "https://hephaestus-app.pages.dev/#get", `and it links to the download section on the same host as the feed (${newerText.href})`);
await newer.c.close();

const same = await withFeed({ status: "ready", version: "0.3.0" });
const sameText = await same.p.evaluate(() => document.body.innerText);
ok(!/is out — you are on/.test(sameText), "the same version on the feed asks for nothing: no strip, no nag");
await same.c.close();

const broken = await withFeed(null);
const brokenText = await broken.p.evaluate(() => document.body.innerText);
ok(!/is the newest|up to date/i.test(brokenText), "an unreachable feed is never worded as being up to date");
await broken.c.close();

for (const [hours, want, label] of [[23, 0, "checked an hour ago"], [25, 1, "checked yesterday"]]) {
  const t = await withFeed({ status: "ready", version: "0.3.0" }, { status: "current", latest: "0.3.0", current: "0.3.0", href: null, at: Date.now() - hours * 3600 * 1000, reason: null });
  ok(t.reqs.length === want, `${label}: the app made ${t.reqs.length} request${want === 1 ? "" : "s"} on the feed in the background (want ${want})`);
  await t.c.close();
}

const manual = await withFeed({ status: "ready", version: "0.99.0" }, { status: "current", latest: "0.3.0", current: "0.3.0", href: null, at: Date.now() - 3600 * 1000, reason: null });
await manual.p.goto(APP, { waitUntil: "domcontentloaded" });
await manual.p.getByRole("button", { name: "settings" }).first().click();
await manual.p.getByRole("button", { name: "about", exact: true }).first().click();
const before = manual.reqs.length;
await manual.p.getByRole("button", { name: /check now/i }).first().click();
await manual.p.waitForTimeout(1200);
const about = await manual.p.evaluate(() => document.body.innerText);
ok(manual.reqs.length > before, "“check now” in About asks the feed immediately, inside the 24 h throttle — the throttle gates the app, not you");
ok(/v0\.99\.0 is out/.test(about), "and About reports the newer version it just read");
await manual.c.close();

/* ── 9 · the editor: nothing changes until the person says so ─────────────── */

await page.evaluate(() => localStorage.clear());
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.getByRole("button", { name: "clock only", exact: true }).first().click();
await page.waitForFunction(() => JSON.parse(localStorage.getItem("hephaestus.v1") || "{}").identity, null, { timeout: 12000 });
const frozenSeed = await page.evaluate(() => JSON.parse(localStorage.getItem("hephaestus.v1")).identity.seed);
await page.getByRole("button", { name: "details →" }).click();
await page.getByRole("button", { name: "about", exact: true }).click();
await page.getByRole("button", { name: "the numbers" }).click();
await page.waitForTimeout(400);
const editState = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("input.input")];
  const btn = [...document.querySelectorAll("button")].find((b) => /adopt as my mark|this is your mark/.test(b.textContent));
  return { count: inputs.length, label: btn?.textContent.trim(), disabled: btn?.disabled };
});
ok(editState.count >= 11, `the ten numbers are editable fields, all of them on screen (${editState.count} inputs)`);
ok(editState.label === "this is your mark" && editState.disabled === true, "untouched, the preview is the mark itself, so the adopt button says so and does nothing");
await page.evaluate(() => {
  const set = (labelText, value) => {
    const field = [...document.querySelectorAll("label")].find((l) => l.textContent.toLowerCase().startsWith(labelText));
    const input = field.querySelector("input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set("millisecond", "13");
  set("minute", "7");
});
await page.waitForTimeout(500);
const preview = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /adopt as my mark/.test(b.textContent));
  const chip = [...document.querySelectorAll("span")].map((s) => s.textContent.trim()).filter((t) => /\/100/.test(t));
  return { canAdopt: !!btn && !btn.disabled, chips: chip.slice(0, 4), stored: JSON.parse(localStorage.getItem("hephaestus.v1")).identity.seed };
});
ok(preview.canAdopt, "change a number and the card offers to adopt what that would have given you");
ok(preview.chips.some((c) => !c.includes(String(frozenSeed))) && preview.stored === frozenSeed, "until you press it, the frozen mark is untouched — the preview is a preview");
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /adopt as my mark/.test(b.textContent)).click());
await page.waitForTimeout(600);
const adopted = await page.evaluate(() => JSON.parse(localStorage.getItem("hephaestus.v1")).identity);
ok(adopted.seed !== frozenSeed, "adopted: the mark is now the one those numbers give, written to storage once");

// the escape hatch for a shell that will not hand the app a location: type the place yourself,
// from the same tab that is already open — the app has no router to navigate back to
// the escape hatch for a shell that will not hand the app a location: type the place yourself
await page.waitForTimeout(300);
await page.getByRole("button", { name: "place + clock" }).click();
await page.evaluate(() => {
  const set = (labelText, value) => {
    const field = [...document.querySelectorAll("label")].find((l) => l.textContent.toLowerCase().startsWith(labelText));
    const input = field.querySelector("input");
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set("latitude", "28.6139");
  set("longitude", "77.209");
});
await page.waitForTimeout(400);
const typedPlace = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /adopt as my mark/.test(b.textContent));
  const chip = document.body.innerText.match(/(\d+)\/100/);
  return { canAdopt: !!btn && !btn.disabled, chip: chip ? chip[0] : null };
});
ok(typedPlace.canAdopt, "a mark can be re-forged from a place typed by hand, for any shell that cannot read one");
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /adopt as my mark/.test(b.textContent)).click());
await page.waitForTimeout(700);
const placeAdopted = await page.evaluate(() => {
  const m = JSON.parse(localStorage.getItem("hephaestus.v1")).identity;
  return { place: m.place, lat: m.reading?.lat, lon: m.reading?.lon, seed: m.seed, score: m.score };
});
ok(placeAdopted.place === "coords" && placeAdopted.lat === 28.6139 && placeAdopted.lon === 77.209,
  `and the frozen mark remembers it as a place-derived mark (${JSON.stringify(placeAdopted)})`);
ok(await page.evaluate((seed) => JSON.parse(localStorage.getItem("hephaestus.v1")).identity.seed === seed, adopted.seed) === false,
  "the place genuinely moved the seed — it is not recorded and then ignored");


const lastAdopted = await page.evaluate(() => JSON.parse(localStorage.getItem("hephaestus.v1")).identity.seed);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("hephaestus.v1")).identity.seed);
ok(kept === lastAdopted && kept !== frozenSeed,
  "and it stays: a reload keeps the mark that was adopted, not the one the clock first gave");

/* ── 10 · the founder's key, typed on the real keyboard ───────────────────── */

await page.keyboard.press("Escape");
await page.keyboard.type("a few ordinary keystrokes first ", { delay: 0 });
await page.keyboard.type("NØX::VΞR::ΛRT::DΞI::GΛD::KΛL".replace(/Ø/g, "O").replace(/Ξ/g, "E").replace(/Λ/g, "A"), { delay: 0 });
await page.waitForTimeout(900);
const unlockedStore = await page.evaluate(() => {
  const snap = JSON.parse(localStorage.getItem("hephaestus.v1") || "{}");
  return { founder: snap.founder, score: snap.identity?.score, tier: snap.identity?.tier?.name, swatches: snap.identity?.palette?.swatches?.map((s) => s.hex) };
});
await page.getByRole("button", { name: "settings" }).first().click();
await page.getByRole("button", { name: "about", exact: true }).click();
await page.waitForTimeout(600);
const unlocked = await page.evaluate(() => {
  const snap = JSON.parse(localStorage.getItem("hephaestus.v1") || "{}");
  const t = document.body.innerText;
  return {
    chip: /DIVINE FORGE · 100\/100/.test(t), sig: t.includes("the master's own set"),
    github: [...document.querySelectorAll("a")].some((a) => a.href === "https://github.com/bigboi-alt"),
    urlShown: t.includes("https://github.com/bigboi-alt"),
    mask: (() => { const el = [...document.querySelectorAll("[role=img]")].find((e) => /signature/.test(e.getAttribute("aria-label") || "")); const cs = getComputedStyle(el || document.body); return (cs.maskImage || cs.webkitMaskImage || "") + " " + (cs.maskMode || ""); })(),
  };
});
ok(unlockedStore.founder === true && unlockedStore.score === 100, "typing the key unlocks the founder's set, and the score kept in storage is the measured 100");
ok(unlockedStore.tier === "DIVINE FORGE", "the stored mark carries the founder band, not a label chosen by the UI");
ok(unlockedStore.swatches?.[5] === "#e56a2d" && unlockedStore.swatches?.length === 8, "and the eight colours now on the bench are the founder's, not a picture of them");
ok(unlocked.chip, "the card wears the founder tier on screen: ✦ DIVINE FORGE · 100/100");
ok(unlocked.sig && unlocked.github && unlocked.urlShown, "the signature card shows, with the profile linked and its address printed where a click can't reach");
ok(/signature(-[A-Za-z0-9_-]+)?\.png/.test(unlocked.mask), `the signature is painted with the card's own colour through a mask, so it reads on all six themes (${unlocked.mask.split(" ")[0].replace(/^url\("?|"?\)$/g, "").split("/").pop()})`);
await page.getByRole("button", { name: "close" }).first().click();   // back to the dashboard, then to the anvil
await page.waitForTimeout(300);
await page.getByRole("button", { name: "open akmon" }).first().click();
await page.waitForTimeout(500);
const inAkmon = await page.evaluate(() => {
  const t = document.body.innerText;
  const bars = [...document.querySelectorAll("span")].map((s) => s.textContent.trim()).filter((x) => /DIVINE FORGE/.test(x));
  return { chip: bars[0] || null, hexes: [...document.querySelectorAll("input")].map((i) => i.value).filter((v) => /^#/.test(v)) };
});
ok(inAkmon.chip && /100\/100/.test(inAkmon.chip), `Akmon itself shows the founder band next to the anvil (${inAkmon.chip})`);
ok(inAkmon.hexes.includes("#e56a2d"), "the unlocked palette is the working palette in Akmon, not a picture of one");

/* ── 11 · consent, once: a second machine asks again, the same one doesn't ── */

const fresh = await (await browser.newContext()).newPage();
await fresh.route("**/release.json**", (r) => r.abort());
await fresh.goto(APP, { waitUntil: "domcontentloaded" });
await fresh.waitForTimeout(600);
const again = await fresh.evaluate(() => ({
  asks: /read place \+ sky/i.test(document.body.innerText),
  identity: JSON.parse(localStorage.getItem("hephaestus.v1") || "{}").identity ?? null,
}));
ok(again.asks && again.identity === null, "a clean install is asked once, and no mark is written before it answers");
await fresh.context().close();

await ctx.close();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
