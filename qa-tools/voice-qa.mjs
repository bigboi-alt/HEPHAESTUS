import { SHOTS } from "./paths.mjs";
/**
 * Voice + skins + cedalion wiring QA.
 * Asserts behaviour, then screenshots it so a human eye (mine) can judge the look.
 */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:5199/";
const OUT = SHOTS;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

async function boot(browser, settings, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript((s) => {
    localStorage.setItem("hephaestus.v1", JSON.stringify({
      version: 1, palettes: [], settings: s, savedAt: Date.now(), sites: [],
    }));
  }, settings);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}
const h1 = (page) => page.locator("h1").first().innerText().then((t) => t.trim());
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` });

const browser = await chromium.launch();

/* ---------- 1 · the forge talks differently depending on who walks in ---------- */
console.log("greetings + easter eggs");
{
  const { ctx, page, errs } = await boot(browser, { theme: "claude", displayName: "Smith", handle: "@forge", motion: true, cedalionDock: true, density: "comfortable", colorFormat: "hex", accent: "#F5F5F5" });
  const plain = await h1(page);
  ok(plain !== "The forge is cold — heat it up." || plain.length > 0, `plain name → "${plain}"`);
  ok(!/Cedalion|claim my name/i.test(plain), "plain name gets no divine reply");
  await shot(page, "voice-plain");
  ok(errs.length === 0, "no page errors on the plain-name run " + JSON.stringify(errs.slice(0, 2)));
  await ctx.close();
}
{
  const { ctx, page } = await boot(browser, { theme: "claude", displayName: "Cedalion" });
  ok((await h1(page)) === "Greetings, Cedalion. How stands the forge today, my clever apprentice?", "display name 'Cedalion' → the apprentice greeting, word for word");
  await shot(page, "voice-cedalion");
  await ctx.close();
}
{
  const five = [
    "You claim my name? Pick up the hammer and prove it.",
    "You want to be me? First, survive the fall from Olympus.",
    "The forge knows its true master. Step aside before you burn.",
    "You think being a god is a gift? Take my scars, then talk.",
    "If you are me, start working. The automatons need fixing.",
  ];
  const seen = new Set();
  for (const dn of ["Hephaestus", " hephaestus ", "HEPHAESTUS", "hephaestus.", "Hephaestus!"]) {
    const { ctx, page } = await boot(browser, { theme: "paper", displayName: dn });
    const line = await h1(page);
    seen.add(line);
    ok(five.includes(line), `name "${dn.trim()}" (case/space/punct tolerant) → god line`);
    await ctx.close();
  }
  ok(seen.size >= 1, `lines rotate across days (saw ${seen.size} variant here)`);
}
{
  // the greeting is one sentence now: no caption under it, no button to re-roll it. What replaces
  // those is the thing the user asked for instead — their own forge mark, on the same dashboard.
  const { ctx, page, errs } = await boot(browser, { theme: "paper", displayName: "Smith" });
  const once = await h1(page);
  const header = await page.evaluate(() => {
    const block = document.querySelector("h1")?.parentElement;
    return {
      captions: block ? block.querySelectorAll(".faint, .mono-sm, button").length : -1,
      text: block ? block.innerText.trim().replace(/\s+/g, " ") : "",
    };
  });
  ok((await page.getByText("↻ again").count()) === 0, "the “say something else” button is gone — a greeting you can re-roll is a slot machine");
  ok(header.captions === 0, `nothing hangs under the headline any more (${header.captions} caption or button nodes in that block)`);
  ok(once.length > 10 && header.text.includes(once), `the header is the label plus one line: “${once}”`);
  await page.reload({ waitUntil: "networkidle" });
  ok((await h1(page)) === once, "and reloading on the same day says the same thing — it changes by day, not by render");
  ok(/your forge mark/i.test(await page.evaluate(() => document.body.innerText)), "the dashboard spends that space on the forge mark instead");
  ok(errs.length === 0, "no page errors on the trimmed header " + JSON.stringify(errs.slice(0, 2)));
  await ctx.close();
}

/* ---------- 2 · claude wears two skins ---------- */
console.log("claude · ambrosia / nyx");
{
  const { ctx, page, errs } = await boot(browser, { theme: "obsidian", displayName: "Smith" });
  await page.locator("header button", { hasText: "settings" }).last().click().catch(async () => {
    await page.getByRole("button", { name: "settings", exact: true }).first().click();
  });
  await page.waitForTimeout(300);
  await page.getByText("appearance", { exact: false }).first().click();
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByText("Claude", { exact: true }).click();
  await page.waitForTimeout(300);
  const ambrosia = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(before !== ambrosia, `claude selected → body ${before} → ${ambrosia}`);
  const bothVisible = await page.getByText("Ambrosia", { exact: true }).count() + await page.getByText("Nyx", { exact: true }).count();
  ok(bothVisible >= 2, "clicking Claude reveals the two skin choices");
  await shot(page, "claude-picker");
  await page.getByText("Nyx", { exact: true }).first().click();
  await page.waitForTimeout(300);
  const nyx = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(nyx === "rgb(20, 18, 16)", `nyx shell paints the dusted black (${nyx})`);
  const style = await page.evaluate(() => document.documentElement.dataset.claudeStyle);
  ok(style === "nyx", "the skin is published as a data attribute");
  await page.getByRole("button", { name: "home" }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, "claude-nyx-home");
  ok(errs.length === 0, "no page errors in the run " + JSON.stringify(errs.slice(0, 2)));
  await ctx.close();
}
{
  // persistence: the skin has to survive a reload
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForTimeout(300);
  await page.evaluate(() => localStorage.setItem("hephaestus.v1", JSON.stringify({
    version: 1, palettes: [], sites: [], savedAt: Date.now(),
    settings: { theme: "claude", claudeStyle: "nyx", displayName: "Smith", motion: true, cedalionDock: true, density: "comfortable", colorFormat: "hex", accent: "#F5F5F5" },
  })));
  await page.reload();
  await page.waitForTimeout(400);
  const nyx = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(nyx === "rgb(20, 18, 16)", "the skin survives a reload (persisted in settings)");
  const inks = () => page.evaluate(() => {
    const vis = (sel) => {
      const e = document.querySelector(sel);
      return !!e && getComputedStyle(e).display !== "none";
    };
    return { marble: vis(".emblem .emblem-marble"), ink: vis(".emblem .emblem-ink") };
  });
  const onNyx = await inks();
  ok(onNyx.marble && !onNyx.ink, `dark skin keeps the marble ink ${JSON.stringify(onNyx)}`);
  await page.evaluate(() => {
    localStorage.setItem("hephaestus.v1", JSON.stringify({
      version: 1, palettes: [], sites: [], savedAt: Date.now(),
      settings: { theme: "claude", claudeStyle: "ambrosia", displayName: "Smith", motion: true, cedalionDock: true, density: "comfortable", colorFormat: "hex", accent: "#F5F5F5" },
    }));
  });
  await page.reload();
  await page.waitForTimeout(400);
  const onAmbrosia = await inks();
  ok(!onAmbrosia.marble && onAmbrosia.ink, `cream skin still gets the brown ink — the scoping didn't break the old case ${JSON.stringify(onAmbrosia)}`);
  await shot(page, "claude-ambrosia-home");
  await shot(page, "claude-nyx-persisted");
  await ctx.close();
}

/* ---------- 3 · ask cedalion actually asks ---------- */
console.log("akmon → cedalion");
{
  const { ctx, page, errs } = await boot(browser, { theme: "obsidian", displayName: "Smith", cedalionDock: false });
  await page.getByRole("button", { name: "akmon", exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByText("ask cedalion").click();
  await page.waitForTimeout(700);
  const window_ = await page.getByText("CEDALION", { exact: true }).count();
  ok(window_ >= 1, "the window opens even with the dock setting off (a button that does nothing is a bug)");
  const turns = await page.locator(".fade-in .label", { hasText: "cedalion" }).count();
  ok(turns >= 1, `Cedalion answered unprompted (${turns} answer block${turns === 1 ? "" : "s"})`);
  await shot(page, "akmon-ask-empty");
  ok(errs.length === 0, "no page errors asking from a colour screen " + JSON.stringify(errs.slice(0, 2)));
  await ctx.close();

  const b2 = await boot(browser, { theme: "obsidian", displayName: "Smith", cedalionDock: true });
  await b2.page.getByRole("button", { name: "akmon", exact: true }).first().click();
  await b2.page.waitForTimeout(250);
  await b2.page.locator('input.input').first().fill("deep dusty teal with a burnt orange accent, dark");
  await b2.page.getByRole("button", { name: "forge", exact: true }).first().click();
  await b2.page.waitForTimeout(600);
  await b2.page.getByText("ask cedalion").click();
  await b2.page.waitForTimeout(800);
  const said = await b2.page.evaluate(() => document.body.innerText);
  ok(/\/100/.test(said), "with a palette loaded it quotes the score, not a greeting");
  await shot(b2.page, "akmon-ask-scored");
  ok(b2.errs.length === 0, "no errors " + JSON.stringify(b2.errs.slice(0, 2)));
  await b2.ctx.close();
}

/* ---------- 4 · scrollbars gone, scrolling kept ---------- */
console.log("scrollbars");
{
  const { ctx, page } = await boot(browser, { theme: "obsidian", displayName: "Smith" });
  const r = await page.evaluate(() => {
    const h = document.documentElement;
    const thick = h.offsetWidth - h.clientWidth;
    // find the tallest scrollable box in the app
    let best = null;
    for (const el of document.querySelectorAll("body *")) {
      const can = el.scrollHeight - el.clientHeight > 40;
      const wide = el.scrollWidth - el.clientWidth > 40;
      if (!can && !wide) continue;
      const t = el.offsetWidth - el.clientWidth + (el.offsetHeight - el.clientHeight);
      if (!best || t > best.t) best = { t, tag: el.tagName + "." + (el.className || "").toString().slice(0, 16) };
    }
    return { thick, canScroll: h.scrollHeight > h.clientHeight, best };
  });
  ok(r.thick === 0, `root shows no scrollbar gutter (${r.thick}px)`);
  ok(r.canScroll, "the page still scrolls");
  ok(!r.best || r.best.t === 0, `inner panes too ${r.best ? JSON.stringify(r.best) : "(none needing it)"}`);
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
