import { APP, SHOTS } from "./paths.mjs";
/**
 * Do image blocks behave like every other block?
 * Drops grid presets into the real editor, then for every image: clicks the
 * exact centre of the box (must select), drags it (must move), and repeats with
 * a card dropped on top of it — the case where a box you can see is a box you
 * cannot click.
 */
import { chromium } from "playwright";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => localStorage.setItem("hephaestus.v1", JSON.stringify({
  version: 1, palettes: [], sites: [], savedAt: Date.now(),
  settings: { theme: "obsidian", displayName: "Smith", motion: false, cedalionDock: false, density: "compact", colorFormat: "hex", accent: "#F5F5F5" },
})));
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.locator("header").getByText("build", { exact: true }).click();
await page.waitForTimeout(500);

const selectOf = (id) => page.evaluate((i) => {
  const el = document.querySelector(`[data-blk="${i}"]`);
  if (!el) return { found: false };
  const r0 = el.getBoundingClientRect();
  const off = r0.top < 60 || r0.bottom > window.innerHeight - 20 || r0.left < 0 || r0.right > window.innerWidth;
  if (off) { el.scrollIntoView({ block: "center" }); }
  void 0;
  const r = el.getBoundingClientRect();
  void 0;
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  const owner = top?.closest?.("[data-blk]");
  return { found: true, x: r.x, y: r.y, w: r.width, h: r.height, hitId: owner?.getAttribute("data-blk") ?? null, hitKind: owner?.getAttribute("data-kind") ?? null, outline: getComputedStyle(el).outlineStyle };
}, id);

/** which presets actually contain an image block — read from the engine, not guessed */
const imagePresets = await page.evaluate(async () => {
  const g = await import("/src/engine/grids.ts");
  const out = [];
  for (const p of g.GRID_PRESETS) {
    try { if (p.build(g.FALLBACK).some((b) => b.kind === "image")) out.push(p.name); } catch { }
  }
  return out;
});
ok(imagePresets.length > 0, `the grid library has ${imagePresets.length} presets containing image blocks: ${imagePresets.join(", ")}`);

const openLibrary = async () => {
  await page.locator("button", { hasText: "grid library" }).first().click();
  await page.waitForTimeout(350);
};

for (const preset of imagePresets.slice(0, 5)) {
  await openLibrary();
  await page.locator(`button:has-text("${preset}")`).first().click();
  await page.waitForTimeout(450);

  const ids = await page.locator('[data-kind="image"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-blk")));
  ok(ids.length > 0, `“${preset}” placed ${ids.length} image block(s)`);
  for (const id of ids.slice(0, 2)) {
    const first = await selectOf(id);
    ok(first.hitId === id, `${preset}: clicking the centre of the image selects the image (hit ${first.hitKind ?? "nothing"})`);
    await page.mouse.move(first.x + first.w / 2, first.y + first.h / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + first.w / 2 + 64, first.y + first.h / 2 + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(160);
    const after = await selectOf(id);
    const dx = after.x - first.x, dy = after.y - first.y;
    ok(Math.abs(dx) > 12 && Math.abs(dy) > 8, `${preset}: dragging it moves it (${dx.toFixed(0)}, ${dy.toFixed(0)}px on screen)`);
    const outline = await page.evaluate((i) => { const el = document.querySelector(`[data-blk="${i}"]`); return el ? getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineWidth : "gone"; }, id);
    ok(!/^none/.test(outline), `${preset}: and it stays visibly selected (${outline})`);
  }
  // put the page back so the next preset starts clean
  await page.locator("[data-frame]").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(220);
}

/* the covered-image case is checked properly in imgcovered-qa.mjs, which seeds
   exact geometry instead of trying to resize a card by dragging its handle. */

ok(errs.length === 0, "no page errors " + JSON.stringify(errs.slice(0, 2)));
await page.screenshot({ path: `${SHOTS}/image-select.png` });
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
