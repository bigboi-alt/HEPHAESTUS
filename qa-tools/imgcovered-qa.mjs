import { APP, SHOTS } from "./paths.mjs";
/**
 * The exact complaint: an image box that sits under a card in a grid.
 * A site is seeded with precise geometry so nothing depends on dragging, then
 * we check the image takes the click, moves, and is still reachable after being
 * deliberately sent behind — the case where "send back" used to mean "unselectable".
 */
import { chromium } from "playwright";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const pal = {
  name: "test", mode: "dark", scheme: "analogous", seed: 3, prompt: "", favorite: false,
  swatches: [
    { role: "background", hex: "#0B0F10", name: "pit", locked: false },
    { role: "surface", hex: "#141A1C", name: "slab", locked: false },
    { role: "border", hex: "#26343A", name: "edge", locked: false },
    { role: "text", hex: "#E7EFF0", name: "chalk", locked: false },
    { role: "muted", hex: "#8FA3A8", name: "ash", locked: false },
    { role: "primary", hex: "#5B8898", name: "teal", locked: false },
    { role: "secondary", hex: "#8FB0BC", name: "mist", locked: false },
    { role: "accent", hex: "#E8A06B", name: "ember", locked: false },
  ],
};
const B = (o) => ({ id: o.kind + o.n, x: 0, y: 0, w: 400, h: 60, ...o });
const doc = {
  brand: "covered test", transition: "fade", mode: "multi",
  pages: [{
    id: "p1", name: "home", minH: 900,
    blocks: [
      // image FIRST, card AFTER it in array order: the old paint rule put the card on top
      B({ kind: "image", n: 1, x: 240, y: 220, w: 420, h: 240 }),
      B({ kind: "card", n: 1, x: 120, y: 140, w: 700, h: 420, text: "A card dropped over the image", sub: "This box used to swallow every click that belonged to the picture under it." }),
      B({ kind: "heading", n: 1, x: 120, y: 620, w: 700, h: 70, text: "Something below" }),
    ],
  }],
};
const snap = JSON.stringify({
  version: 1, palettes: [pal], savedAt: Date.now(),
  sites: [{ id: "site-covered", name: "covered", doc, palette: pal, pageCount: 1, updatedAt: Date.now() }],
  settings: { theme: "obsidian", displayName: "Smith", motion: false, cedalionDock: false, cedalionAutoAudit: false, density: "compact", colorFormat: "hex", accent: "#F5F5F5", contrastFloor: 4.5, trendsRemoteUrl: "", trendsAutoRefresh: false, handle: "@forge", chatRect: null },
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await ctx.addInitScript((s) => localStorage.setItem("hephaestus.v1", s), snap);
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.locator("header").getByText("home", { exact: true }).click();
await page.waitForTimeout(400);
await page.locator('button:has-text("continue")').first().click();   // opens the seeded site in the studio
await page.waitForTimeout(700);
const onBench = await page.locator('[data-blk="card1"]').count();
ok(onBench === 1, "the seeded site opened from the bench with its blocks intact");

const geom = await page.evaluate(() => {
  const g = (id) => {
    const el = document.querySelector(`[data-blk="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { x: r.x, y: r.y, w: r.width, h: r.height, z: cs.zIndex, hit: top?.closest?.("[data-blk]")?.getAttribute("data-blk") ?? "nothing" };
  };
  return { img: g("image1"), card: g("card1"), found: !!g("image1") };
});
ok(geom.found, "the seeded page rendered with the image and the covering card");
if (geom.found) {
  ok(geom.card.x <= geom.img.x + 2 && geom.card.y <= geom.img.y + 2 && geom.card.x + geom.card.w >= geom.img.x + geom.img.w - 2,
    `the card really does cover the image (card ${Math.round(geom.card.w)}×${Math.round(geom.card.h)} at ${Math.round(geom.card.x)},${Math.round(geom.card.y)} vs image at ${Math.round(geom.img.x)},${Math.round(geom.img.y)} ${Math.round(geom.img.w)}×${Math.round(geom.img.h)})`);
  ok(Number(geom.card.z) < Number(geom.img.z), `a surface paints below its content (card z${geom.card.z}, image z${geom.img.z})`);
  ok(geom.img.hit === "image1", `the image takes the click at its own centre (hit ${geom.img.hit})`);

  await page.mouse.move(geom.img.x + geom.img.w / 2, geom.img.y + geom.img.h / 2);
  await page.mouse.down();
  await page.mouse.move(geom.img.x + geom.img.w / 2 + 70, geom.img.y + geom.img.h / 2 + 46, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(220);
  const moved = await page.evaluate(() => {
    const el = document.querySelector('[data-blk="image1"]');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
  ok(moved.x - geom.img.x > 30 && moved.y - geom.img.y > 18, `and dragging it moves it, over the card (+${Math.round(moved.x - geom.img.x)}, +${Math.round(moved.y - geom.img.y)}px)`);

  // now the deliberate case: send the image behind, and it must still be reachable
  await page.locator('[data-blk="image1"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.press("BracketLeft");
  await page.waitForTimeout(220);
  await page.mouse.move(40, 40);          // leave the block so hover styling can't fake a selection
  await page.keyboard.press("Escape");    // the app's own "deselect"
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const el = document.querySelector('[data-blk="image1"]'), c = document.querySelector('[data-blk="card1"]');
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { z: getComputedStyle(el).zIndex, cardZ: getComputedStyle(c).zIndex, hit: top?.closest?.("[data-blk]")?.getAttribute("data-blk") ?? "nothing" };
  });
  ok(Number(after.z) < Number(after.cardZ), `send-back genuinely re-layers it (image z${after.z} below card z${after.cardZ})`);
  await page.evaluate(() => document.querySelector('[data-blk="card1"]')?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 })));
  await page.waitForTimeout(200);
  const marked = () => page.evaluate(() => [...document.querySelectorAll("[data-blk]")]
    .filter((e) => [...e.children].some((k) => /·\s*\d+,\d+\s*·/.test(k.textContent ?? "")))
    .map((e) => e.getAttribute("data-blk")));
  const beforeTab = await marked();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  const afterTab = await marked();
  ok(beforeTab.length === 1 && afterTab.length === 1 && beforeTab[0] !== afterTab[0], `tab walks the stack: ${JSON.stringify(beforeTab)} → ${JSON.stringify(afterTab)}`);
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(200);
  const backAgain = await marked();
  ok(backAgain[0] === beforeTab[0], `shift-tab walks it back (${JSON.stringify(backAgain)})`);
}
ok(errs.length === 0, "no page errors " + JSON.stringify(errs.slice(0, 2)));
await page.screenshot({ path: `${SHOTS}/covered-image.png` });
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
