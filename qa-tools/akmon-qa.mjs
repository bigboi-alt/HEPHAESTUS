import { SHOTS } from "./paths.mjs";
/**
 * Akmon, as it was before the "planes" experiment: two labelled swatch grids — surfaces and voice —
 * every card editable, lockable, copyable, and annotated with its own measurements.
 *
 * This suite was written to police the replacement design (nested planes, a "show me the mistake"
 * switch, 0–100 step readouts). That design has been reverted at the owner's request, so the
 * assertions are too: they now check the restored screen does its job AND that the rejected shape
 * stays gone, which is the only way a revert survives the next round of well-meant improvement.
 *
 * run:  the app on :5199, then  node akmon-qa.mjs
 */
import { chromium } from "playwright";
const URL = "http://127.0.0.1:5199/";
const OUT = SHOTS;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const ROLES = ["background", "surface", "border", "text", "muted", "primary", "secondary", "accent"];
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
  ok(/surfaces/.test(body) && /background, surface, border, text, muted — with a whisper of the brand hue/.test(body),
    "the surfaces group is there, subtitled the way it reads");
  ok(/voice/.test(body) && /the three colours that carry the brand — primary, secondary, accent/.test(body),
    "and the voice group is a separate labelled grid, not a panel glued to it");

  const cards = await page.evaluate((roles) => {
    const els = [...document.querySelectorAll("div.panel")].filter((d) => roles.includes(d.querySelector(".label")?.textContent?.trim()));
    return els.map((el) => ({
      role: el.querySelector(".label").textContent.trim(),
      text: el.innerText.replace(/\s+/g, " "),
      lock: !!el.querySelector('button[title^="lock"], button[title="unlock"]'),
      copy: !!el.querySelector('button[title="click to copy"]'),
      pick: !!el.querySelector('input[type="color"][title="pick a colour"], button[title="pick a colour"]'),
      hex: (el.innerText.match(/#[0-9a-fA-F]{6}/g) || [])[0] || "",
    }));
  }, ROLES);
  ok(cards.length === 8, `eight swatch cards render (${cards.map((c) => c.role).join(", ")})`);
  ok(ROLES.every((r, i) => cards[i]?.role === r), "in the order the roles are declared, surfaces first then voice");
  ok(cards.every((c) => c.lock), "every colour can be held still before a re-forge");
  ok(cards.every((c) => c.copy), "every colour copies with one click on its own field");
  ok(cards.every((c) => c.pick), "and every colour can be replaced by another one you pick");
  ok(cards.filter((c) => /L\d+(\.\d+)? · C\d+(\.\d+)?/.test(c.text)).length === 8,
    "each card carries its OKLab lightness and chroma, so the numbers are on screen, not behind a button");
  const graded = cards.filter((c) => /\d+(\.\d+)?:1 (AAA|AA|AA Large|Fail)/.test(c.text));
  ok(graded.length === 7, "the seven non-background swatches each show their measured contrast and its WCAG grade");
  ok(cards[0] && !/:1 /.test(cards[0].text), "and the background is not graded against itself");
  ok(/:\d \d+/ .test(graded[0]?.text || "") || /:1 /.test(graded[0]?.text || ""), `a grade reads like "${(graded[0]?.text.match(/\d+(\.\d+)?:1 \w+( \w+)?/) || [""])[0]}"`);
  ok(/#([0-9a-fA-F]{6})/.test(cards.map((c) => c.hex).join("")), "swatches print real hexes");

  // the rejected experiment must not be reachable any more
  ok(!/voice vs surfaces|surfaces · the planes|steps from (background|surface)|show me the mistake|swap the families/i.test(body),
    "no trace of the planes panel: no split fragment, no step ruler, no mistake switch");
  ok((await page.locator("button", { hasText: "voice everywhere" }).count()) === 0, "and its comparison buttons are gone with it");

  // locking is the one thing a re-forge is judged by
  const before = await page.evaluate(() => [...document.querySelectorAll("div.panel")].map((d) => d.innerText.match(/#[0-9a-fA-F]{6}/)?.[0] || "").filter(Boolean));
  await page.locator('button[title^="lock"]').first().click();
  await page.waitForTimeout(200);
  ok((await page.locator('button[title="unlock"]').count()) === 1, "the button changes to 'unlock', so a lock is visible and not a guess");
  await page.getByRole("button", { name: "shake", exact: true }).click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => [...document.querySelectorAll("div.panel")].map((d) => d.innerText.match(/#[0-9a-fA-F]{6}/)?.[0] || "").filter(Boolean));
  ok(before[0] === after[0], `the locked swatch survived a shake (${before[0]})`);
  ok(before.filter((h, i) => h !== after[i]).length >= 3, `and the unlocked ones moved (${before.filter((h, i) => h !== after[i]).length} of ${before.length})`);
  await page.screenshot({ path: `${OUT}/akmon-${tag}.png`, fullPage: false });

  // colour-vision simulation: the swatch a person sees is repainted, the hex they read is not
  const paint = () => page.evaluate((roles) => [...document.querySelectorAll("div.panel")]
    .filter((d) => roles.includes(d.querySelector(".label")?.textContent?.trim()))
    .map((d) => getComputedStyle(d.firstElementChild).backgroundColor).join(","), ROLES);
  const hexText = () => page.evaluate(() => [...document.querySelectorAll("div.panel")].map((d) => d.innerText.match(/#[0-9a-fA-F]{6}/)?.[0] || "").filter(Boolean).join(","));
  const paintBefore = await paint();
  const textBefore = await hexText();
  await page.getByRole("button", { name: "deut", exact: true }).click();
  await page.waitForTimeout(350);
  const paintSim = await paint();
  const changed = paintSim.split(",").filter((c, i) => c !== paintBefore.split(",")[i]).length;
  ok(paintSim !== paintBefore && changed >= 4 && /^rgb\(/.test(paintSim),
    `deuteranopia repaints ${changed} of 8 swatch blocks, measured on the painted square`);
  const active = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].filter((x) => /^(off|deut|prot|trit|achr)$/.test(x.textContent.trim()));
    return { on: b.filter((x) => x.dataset.active === "true").map((x) => x.textContent.trim()), n: b.length };
  });
  ok(active.n === 5 && active.on.join() === "deut", `the simulate row holds ${active.n} buttons and exactly one reads as on (${active.on.join(",") || "none"})`);
  ok((await hexText()) === textBefore, "while the hexes in the fields stay the true values, because the simulation is a lens, not an edit");
  await page.screenshot({ path: `${OUT}/akmon-${tag}-cvd.png` });
  await page.getByRole("button", { name: "off", exact: true }).click();
  await page.waitForTimeout(350);
  ok(await paint() === paintBefore, "and switching it off gives back exactly the colours that were there before");

  ok(errs.length === 0, "no page errors " + JSON.stringify(errs.slice(0, 2)));
  await ctx.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
