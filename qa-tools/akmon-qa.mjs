import { SHOTS } from "./paths.mjs";
/** Akmon redesign QA: does the new surfaces/voice presentation render, read and react? */
import { chromium } from "playwright";
const URL = "http://127.0.0.1:5199/";
const OUT = SHOTS;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const browser = await chromium.launch();
for (const prompt of [
  "deep dusty teal with a burnt orange accent, dark",
  "sun-bleached terracotta and chalk, light",
]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((s) => localStorage.setItem("hephaestus.v1", JSON.stringify({ version: 1, palettes: [], sites: [], savedAt: Date.now(), settings: s })),
    { theme: "obsidian", displayName: "Smith", motion: true, cedalionDock: true, density: "comfortable", colorFormat: "hex", accent: "#F5F5F5" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "akmon", exact: true }).first().click();
  await page.locator("input.input").first().fill(prompt);
  await page.getByRole("button", { name: "forge", exact: true }).first().click();
  await page.waitForTimeout(600);

  const tag = prompt.includes("teal") ? "teal-dark" : "terra-light";
  console.log(`\n── ${tag}`);
  const body = await page.evaluate(() => document.body.innerText);
  ok(/voice vs surfaces/i.test(body), "the split panel is present");
  ok(/surfaces · the planes/i.test(body), "surfaces render as planes, not cards");
  ok(/\d+(\.\d+)? steps from (background|surface)/.test(body), "layer distance shown in 0–100 steps");
  ok(!/is indistinguishable from the background/.test(body), "a healthy palette is not falsely accused of flat planes");
  ok(/voice · the three that carry the brand/i.test(body), "voice keeps the card grid, titled by what it does");
  ok(/the one thing to click/.test(body), "each voice colour says what it is for");
  ok(/button text [\d.]+:1/.test(body) && /planes are [\d.]+ steps apart/.test(body), "both panels carry measured contrast + plane readouts");
  await page.screenshot({ path: `${OUT}/akmon-${tag}.png`, fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 620));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/akmon-${tag}-planes.png` });

  // the mistake switch actually repaints the right-hand fragment
  const grab = () => page.evaluate(() => {
    const cards = [...document.querySelectorAll("div")].filter((d) => getComputedStyle(d).backgroundClip === "border-box" && d.textContent?.trim().startsWith("ember&oak"));
    return cards.slice(0, 2).map((c) => c.parentElement?.previousElementSibling?.textContent?.slice(0, 40) ?? "").join("|")
      + "||" + cards.map((c) => getComputedStyle(c).backgroundColor).join(",");
  });
  const before = await grab();
  await page.getByRole("button", { name: "voice everywhere" }).click();
  await page.waitForTimeout(250);
  const after = await grab();
  ok(before !== after, "“show me the mistake” repaints the comparison");
  await page.screenshot({ path: `${OUT}/akmon-${tag}-loud.png` });
  await page.getByRole("button", { name: "swap the families" }).click();
  await page.waitForTimeout(250);
  const swapped = await page.evaluate(() => /button is painted with the page colour|families swapped/i.test(document.body.innerText));
  ok(swapped, "the swap mistake explains itself in words");
  await page.screenshot({ path: `${OUT}/akmon-${tag}-swap.png` });

  // CVD simulation has to keep working through the new panels
  const hexBefore = await page.evaluate(() => document.body.innerText.match(/#[0-9a-fA-F]{6}/g)?.slice(0, 6).join(",") ?? "");
  await page.locator("button", { hasText: "deut" }).first().click();
  await page.waitForTimeout(300);
  const hexAfter = await page.evaluate(() => document.body.innerText.match(/#[0-9a-fA-F]{6}/g)?.slice(0, 6).join(",") ?? "");
  ok(hexBefore !== hexAfter, `simulate still rewrites every colour readout (${hexAfter.slice(0, 24)}…)`);
  await page.screenshot({ path: `${OUT}/akmon-${tag}-cvd.png` });
  ok(errs.length === 0, "no page errors " + JSON.stringify(errs.slice(0, 2)));
  await ctx.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
