import { APP, SHOTS } from "./paths.mjs";
/** Build: does preview show the real site, and do the site options reach the export? */
import { chromium } from "playwright";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => localStorage.setItem("hephaestus.v1", JSON.stringify({ version: 1, palettes: [], sites: [], savedAt: Date.now(), settings: { theme: "obsidian", displayName: "Smith", motion: false, cedalionDock: false, density: "compact", colorFormat: "hex", accent: "#F5F5F5" } })));
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.locator("header").getByText("build", { exact: true }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${SHOTS}/studio-panel.png` });

// put a card on the page first: depth and radius are measured on it
await page.locator("button", { hasText: "card" }).first().click();
await page.waitForTimeout(300);
ok(await page.locator('[data-kind="card"]').count() > 0, "a card block is on the canvas to measure");
await page.locator("button", { hasText: "image" }).first().click();
await page.waitForTimeout(300);
ok(await page.locator('[data-kind="image"]').count() > 0, "and an image block for the fill options");

console.log("site options");
const panel = page.locator("aside").last();
ok(await panel.getByText("site options").count() > 0, "the right panel carries a site-options block");
const blockStyle = () => page.evaluate(() => {
  const el = document.querySelector('[data-blk^="card"]') ?? document.querySelector('[data-kind="card"]');
  const img = document.querySelector('[data-kind="image"]');
  const cs = el ? getComputedStyle(el) : null;
  return { radius: cs?.borderRadius, shadow: cs?.boxShadow, font: document.querySelector('[data-kind="heading"] div') ? getComputedStyle(document.querySelector('[data-kind="heading"] div')).fontFamily : "" , img: img ? getComputedStyle(img).backgroundImage.slice(0, 40) : "" };
});
const before = await blockStyle();
await panel.getByRole("button", { name: "serif" }).click();
await page.waitForTimeout(200);
const afterFont = await blockStyle();
ok(afterFont.font !== before.font && /serif|Georgia|Iowan/.test(afterFont.font), `typeface reaches the canvas (${afterFont.font.slice(0, 34)})`);
await panel.getByRole("button", { name: "hatch" }).click();
await page.waitForTimeout(200);
const afterFill = await blockStyle();
ok(/repeating-linear-gradient/.test(afterFill.img), `image fill changes to hatching (${afterFill.img})`);
const slider = async (label) => {
  const idx = await page.evaluate((lb) => {
    const all = [...document.querySelectorAll("aside input[type=range]")];
    return all.findIndex((i) => (i.closest("div")?.querySelector("span")?.textContent ?? "").includes(lb));
  }, label);
  if (idx < 0) return null;
  return page.locator("aside input[type=range]").nth(idx);
};
const corner = await slider("corners");
ok(!!corner, "the corners slider is findable by its own label");
await corner.fill("24");
await page.waitForTimeout(220);
const afterRadius = await blockStyle();
ok(afterRadius.radius !== before.radius && afterRadius.radius !== undefined, `corner slider moves the card radius (${before.radius} → ${afterRadius.radius})`);

console.log("the options reach the exported html too");
// honest route: open the preview and read the iframe document, then change an option and compare
const readPreview = async () => {
  await page.getByRole("button", { name: "▶ preview" }).click();
  await page.waitForTimeout(700);
  const frame = page.frames().find((f) => f === page.mainFrame() ? false : true);
  const out = frame ? await frame.evaluate(() => ({
    font: getComputedStyle(document.body).fontFamily,
    cards: [...document.querySelectorAll(".blk")].length,
    text: document.body.innerText.slice(0, 60).replace(/\s+/g, " "),
    anim: document.querySelector("style")?.textContent?.match(/cvFade ([\d.]+m?s)/)?.[1] ?? "?",
  })) : null;
  return out;
};
const pv1 = await readPreview();
ok(!!pv1, "preview opened with a real document inside");
ok(pv1 && pv1.cards > 0, `the preview renders the site's own blocks (${pv1?.cards} of them)`);
ok(pv1 && /Iowan|Georgia|serif/.test(pv1.font), `the serif choice is in the export (${pv1?.font.slice(0, 30)})`);
await page.screenshot({ path: `${SHOTS}/studio-preview.png` });

// width buttons
await page.getByRole("button", { name: "phone", exact: true }).click();
await page.waitForTimeout(300);
const phoneW = await page.evaluate(() => { const f = document.querySelector("iframe"); const r = f.getBoundingClientRect(); return { w: Math.round(r.width), scale: Math.round((r.width / 390) * 100) / 100 }; });
ok(phoneW.w > 300 && phoneW.w < 520, `phone view sizes the frame (${phoneW.w}px wide, scale ${phoneW.scale})`);
await page.screenshot({ path: `${SHOTS}/studio-preview-phone.png` });
await page.getByRole("button", { name: "fit", exact: true }).last().click();
await page.waitForTimeout(250);
const fitW = await page.evaluate(() => Math.round(document.querySelector("iframe").getBoundingClientRect().width));
ok(fitW > 1300, `fit view fills the window (${fitW}px)`);

// links inside the preview must navigate
const nav = await page.evaluate(() => {
  const f = document.querySelector("iframe");
  const doc = f.contentDocument;
  const before = [...doc.querySelectorAll(".pg.on")].map((p) => p.id)[0];
  const link = doc.querySelector('a[data-page]');
  link?.click();
  const after = [...doc.querySelectorAll(".pg.on")].map((p) => p.id)[0];
  return { before, after, has: !!link };
});
ok(nav.has && nav.before !== nav.after, `clicking a nav link inside the preview changes page (${nav.before} → ${nav.after})`);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
ok(await page.locator("iframe").count() === 0, "esc closes the preview");

// change motion to instant → export must lose the animation timing
await page.locator("aside").last().getByRole("button", { name: "flat" }).first().click(); // card depth = flat
await page.getByRole("button", { name: "▶ preview" }).click();
await page.waitForTimeout(600);
const pv2 = await page.frames().filter((f) => f !== page.mainFrame())[0]?.evaluate(() => ({
  anim: document.querySelector("style")?.textContent?.match(/cvFade ([\d.]+m?s)/)?.[1] ?? "?",
  shadow: getComputedStyle(document.querySelector(".blk > div") ?? document.body).boxShadow,
}));
ok(pv2?.shadow === "none", `card depth "flat" is in the export (${pv2?.shadow})`);

console.log("the four extra site-wide choices");
{
  await page.keyboard.press("Escape");   // close the preview this section re-opened
  await page.waitForTimeout(300);
  const headText = () => page.evaluate(() => {
    const el = document.querySelector('[data-kind="heading"] div');
    return el ? getComputedStyle(el).textTransform + "|" + getComputedStyle(el).letterSpacing : "none";
  });
  const before = await headText();
  ok(!before.startsWith("uppercase"), `headings were not all caps before the switch (${before})`);
  await page.locator("aside").last().getByRole("button", { name: "ALL CAPS" }).click();
  await page.waitForTimeout(220);
  ok((await headText()).startsWith("uppercase"), `headings go ALL CAPS on the canvas (${await headText()})`);
  await page.locator("aside").last().getByRole("button", { name: "pill" }).click();
  await page.waitForTimeout(220);
  const btnR = await page.evaluate(() => {
    const blk = document.querySelector('[data-kind="button"]');
    if (!blk) return "no button block";
    const kids = [blk, ...blk.querySelectorAll("*")];
    return kids.map((k) => getComputedStyle(k).borderRadius).find((r) => r === "999px") ?? kids.map((k) => getComputedStyle(k).borderRadius).join(",");
  });
  ok(btnR.includes("999px"), `buttons turn into pills (${btnR.slice(0, 40)})`);
  await page.locator("aside").last().getByRole("button", { name: "none", exact: true }).last().click();  // card outline
  await page.waitForTimeout(220);
  const cardBorder = await page.evaluate(() => { const c = document.querySelector('[data-kind="card"] > div'); return c ? getComputedStyle(c).borderTopWidth : "gone"; });
  ok(cardBorder === "0px" || cardBorder === "0", `card outline switched off (${cardBorder})`);
  await page.getByRole("button", { name: "▶ preview" }).click();
  await page.waitForTimeout(700);
  const fr = page.frames().find((f) => f !== page.mainFrame());
  const inExport = await fr.evaluate(() => {
    const caps = [...document.querySelectorAll(".blk, .blk *")].some((e) => getComputedStyle(e).textTransform === "uppercase");
    const card = [...document.querySelectorAll(".blk > div")].find((d) => /Feature|card/i.test(d.textContent ?? ""));
    const pill = [...document.querySelectorAll(".blk, .blk *")].some((e) => getComputedStyle(e).borderRadius === "999px");
    return { caps: caps ? "uppercase" : "none", border: card ? getComputedStyle(card).borderTopWidth : "?", pill };
  });
  ok(inExport.caps === "uppercase" && inExport.pill === true && (inExport.border === "0px" || inExport.border === "0"), `caps, pill buttons and the borderless card all reach the exported html (${JSON.stringify(inExport)})`);
  await page.keyboard.press("Escape");
}
await page.keyboard.press("Escape");

ok(errs.length === 0, "no page errors " + JSON.stringify(errs.slice(0, 2)));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
