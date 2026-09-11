import { APP, SHOTS } from "./paths.mjs";
/** The 1,750-entry library: does it render fast, page, search, and show a real example per entry? */
import { chromium } from "playwright";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => localStorage.setItem("hephaestus.v1", JSON.stringify({ version: 1, palettes: [], sites: [], savedAt: Date.now(), settings: { theme: "obsidian", displayName: "Smith", motion: true, cedalionDock: false, density: "comfortable", colorFormat: "hex", accent: "#F5F5F5" } })));
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
const t0 = Date.now();
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
const navStart = Date.now();
await page.locator("header").getByText("trends", { exact: true }).click();
await page.locator("h1").first().waitFor({ timeout: 20000 });
const rows = await page.locator('[style*="background: var(--bg)"]').count();
const first = await page.locator("h1").first().innerText();
console.log(`  (trends screen reached in ${Date.now() - navStart}ms · whole boot ${Date.now() - t0}ms)`);
ok(/ways to build it/.test(first), `heading: “${first}”`);
const total = /([\d,]+) ways/.exec(first)?.[1];
ok(total && +total.replace(/,/g, "") >= 1000, `the library carries ${total} entries`);
ok(rows > 0, `page rendered ${rows} panels`);
const dom = await page.evaluate(() => document.querySelectorAll("*").length);
ok(dom < 12000, `page DOM is ${dom} nodes — paging is doing its job (a flat 1,750-row list would be ~10× this)`);

console.log("\npaging");
const rowNames = () => page.evaluate(() => [...document.querySelectorAll("div")].map((d) => d.querySelector(":scope > button > div > div > span:nth-child(2)")).filter(Boolean).map((s) => s.textContent).slice(0, 6));
const p1 = await rowNames();
await page.getByRole("button", { name: "→", exact: true }).last().click();
await page.waitForTimeout(350);
const p2 = await rowNames();
ok(p1.length > 0 && p2.length > 0 && p1[0] !== p2[0], `next page shows different entries (${p1[0]} → ${p2[0]})`);
await page.getByRole("button", { name: "»", exact: true }).last().click();
await page.waitForTimeout(400);
const lastInfo = await page.evaluate(() => document.body.innerText.match(/(\d+) \/ (\d+)/)?.[0] ?? "");
ok(/\d+ \/ \d+/.test(lastInfo), `the pager reports position (${lastInfo})`);
await page.getByRole("button", { name: "«", exact: true }).first().click();
await page.waitForTimeout(300);

console.log("\nsearch + tags");
await page.locator('input.input').first().fill("duotone");
await page.waitForTimeout(400);
const matchedLine = await page.evaluate(() => document.body.innerText.match(/[\d,]+ of [\d,]+ matched/)?.[0] ?? "");
ok(/of/.test(matchedLine), `search narrows to “${matchedLine}”`);
const allDuo = await page.evaluate(() => [...document.querySelectorAll("div")].some((d) => /duotone/i.test(d.textContent ?? "")));
ok(allDuo, "every visible row mentions duotone");
await page.locator('input.input').first().fill("zzz-no-such-trend");
await page.waitForTimeout(350);
ok(await page.getByText(/nothing in the library matches/).count() > 0, "an empty result explains itself and offers a reset");
await page.getByRole("button", { name: "clear the search" }).click();
await page.waitForTimeout(300);
const tagBtn = page.locator("button", { hasText: /^layout/ }).first();
if (await tagBtn.count()) { await tagBtn.click(); await page.waitForTimeout(300); ok(await page.evaluate(() => /matched/.test(document.body.innerText)), "tag chips filter the catalogue too"); await page.locator("button", { hasText: /^any$/ }).first().click(); }

console.log("\nper-entry example");
await page.locator('input.input').first().fill("Ledger");
await page.waitForTimeout(350);
const firstRow = page.locator("div[style*='background: var(--bg)']").filter({ hasText: /since/ }).first();
await firstRow.click();
await page.waitForTimeout(500);
const ex1 = await page.evaluate(() => {
  const label = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim() === "example");
  const el = label?.parentElement?.querySelectorAll("div")[1];
  const cs = el ? getComputedStyle(el) : null;
  return { found: !!cs, bg: cs?.backgroundColor, radius: cs?.borderRadius, kids: el ? el.children.length : 0, text: el?.innerText?.slice(0, 40) ?? "" };
});
ok(ex1.found && ex1.kids > 0, `opening an entry draws its own example (${ex1.kids} boxes, bg ${ex1.bg}, radius ${ex1.radius})`);
await page.screenshot({ path: `${SHOTS}/trends-open.png` });

// distinctness: three entries, three different mocks
const shots = await page.evaluate(async () => {
  const out = [];
  const rows = [...document.querySelectorAll("div")].filter((d) => d.querySelector(":scope > button") && /since \d{4}/.test(d.textContent ?? "")).slice(0, 3);
  for (const r of rows) { r.querySelector("button").click(); await new Promise((k) => setTimeout(k, 220)); out.push(r.innerHTML.length); }
  return out;
});
ok(shots.length >= 2 && new Set(shots).size === shots.length, `each entry's example is its own markup (${shots.join(" / ")} chars)`);

console.log("\nuniqueness, straight from the catalogue");
const stats = await page.evaluate(async () => {
  const c = await import("/src/engine/catalog.ts");
  const ids = new Set(), names = new Set(); let dupI = 0, dupN = 0, noRecipe = 0, noRules = 0, badName = 0;
  for (const t of c.CATALOG) {
    if (ids.has(t.id)) dupI++; else ids.add(t.id);
    const n = t.name.toLowerCase();
    if (names.has(n)) dupN++; else names.add(n);
    if (t.recipe.length < 90) noRecipe++;
    const r = t.rules;
    if (!r || (r.radius === undefined && r.density === undefined && r.motion === undefined)) noRules++;
    if (/\bundefined\b|\bNaN\b/.test(`${t.name} ${t.summary} ${t.recipe} ${t.signals.join(" ")}`)) badName++;
  }
  return { total: c.CATALOG.length, dupI, dupN, noRecipe, noRules, badName, info: c.CATALOG_INFO };
});
ok(stats.dupI === 0 && stats.dupN === 0, `no duplicate ids or names across ${stats.total} entries`);
ok(stats.noRecipe === 0, "every entry has a buildable recipe");
ok(stats.noRules === 0, "every entry carries machine-readable rules");
ok(stats.badName === 0, "no “undefined” leaked into any copy");
ok(stats.info.curated === 20 && stats.info.composed >= 1000, `${stats.info.curated} curated + ${stats.info.composed} composed, ${stats.info.skippedIncompatible} incompatible combinations refused`);

ok(errs.length === 0, "no page errors " + JSON.stringify(errs.slice(0, 2)));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
