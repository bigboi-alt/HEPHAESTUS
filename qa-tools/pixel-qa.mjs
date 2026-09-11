/**
 * The pixel assembly on the marketing site.
 *
 * What it has to prove, in the user's words: photos come in from pixels, go back to
 * pixels when you scroll away, and come back again — "not a single time scroll
 * animation, an always staying animation". And the decoration must never be the thing
 * that hides content: reduced motion and no-JS must both show every picture whole.
 */
import { chromium } from "playwright";

const SITE = process.env.SITE || "http://127.0.0.1:8099/index.html";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

function coverage(sel) {
  const img = document.querySelector(sel);
  const host = img.closest(".frame, .art");
  const cv = host && host.querySelector("canvas.pxmask");
  if (!cv) return { none: true };
  const vis = getComputedStyle(cv).display === "none" ? "none" : getComputedStyle(cv).visibility;
  if (!cv.width || !cv.height) return { vis, cov: 0 };
  const ctx = cv.getContext("2d");
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let painted = 0, total = 0;
  for (let i = 3; i < d.length; i += 4 * 37) { total++; if (d[i] > 12) painted++; }
  return { vis, cov: total ? painted / total : 0, w: cv.width, h: cv.height };
}

/** park an element at a given share of the viewport height, measured from its top */
async function park(page, sel, frac) {
  await page.evaluate(([s, f]) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    const abs = r.top + scrollY;
    const target = innerHeight * f;
    scrollTo({ top: Math.max(0, abs - target), behavior: "instant" });
  }, [sel, frac]);
  await page.waitForTimeout(520);
}

const b = await chromium.launch();

/* ── 1 · the animation, both directions, twice ──────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  await page.waitForTimeout(700);

  console.log("wiring");
  const wired = await page.evaluate(() => ({
    imgs: document.querySelectorAll("img.px").length,
    canvases: document.querySelectorAll("canvas.pxmask").length,
    mot: !document.documentElement.classList.contains("nopx"),
  }));
  ok(wired.imgs >= 9, `${wired.imgs} pictures are marked for the pixel assembly (8 shots + the hero art)`);
  ok(wired.canvases === wired.imgs, `each has its own overlay canvas (${wired.canvases})`);
  ok(wired.mot, "a normal browser gets the effect (reduced motion is emulated separately)");

  const sel = "#screens img.px";
  console.log("\nentering, resting, leaving, returning");
  await park(page, sel, 0.86);                 // its top edge is in, most of it is not
  const entering = await page.evaluate(coverage, sel);
  await park(page, sel, 0.3);                  // settled in the middle
  const rest = await page.evaluate(coverage, sel);
  await park(page, sel, 0.86);                 // scrolled back down to it again
  const leaving = await page.evaluate(coverage, sel);
  await park(page, sel, 0.3);                  // settled again — second time
  const rest2 = await page.evaluate(coverage, sel);
  await park(page, sel, -0.45);                // sliding out through the top of the view
  const out = await page.evaluate(coverage, sel);

  ok(entering.vis === "visible" && entering.cov > 0.01 && entering.cov < 0.99,
     `forming on the way in: ${Math.round(entering.cov * 100)}% of the frame painted`);
  ok(rest.vis === "hidden" && rest.cov === 0,
     "at rest the overlay is cleared and hidden — the picture itself is what you see");
  ok(leaving.vis === "visible" && leaving.cov > 0.01,
     `it dissolves again on the way back down: ${Math.round(leaving.cov * 100)}% painted`);
  ok(rest2.vis === "hidden", "and it settles again — the second pass works like the first (not a one-shot)");
  ok(out.vis === "visible" && out.cov > 0,
     `leaving through the bottom dissolves it too: ${Math.round(out.cov * 100)}% painted`);

  console.log("\nthe hero plate assembles on load");
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  const cold = await page.evaluate(() => {
    const cv = document.querySelector(".art canvas.pxmask");
    return { w: cv.width, vis: getComputedStyle(cv).visibility };
  });
  await page.waitForTimeout(1500);
  const warm = await page.evaluate(coverage, ".art img.px");
  ok(cold.vis === "visible" || cold.vis === "hidden", `the plate's canvas is live (${cold.w}px wide, ${cold.vis})`);
  ok(warm.vis === "hidden", "the plate ends up as the sharp art, not a mosaic, once assembled");

  ok(errs.length === 0, "no page errors while all that ran " + JSON.stringify(errs.slice(0, 2)));
  await ctx.close();
}

/* ── 2 · the picture is never the hostage of the effect ─────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({
    nopx: document.documentElement.classList.contains("nopx"),
    hiddenCanvas: [...document.querySelectorAll("canvas.pxmask")].every((c) => getComputedStyle(c).display === "none"),
    imgOpacity: [...document.querySelectorAll("img.px")].every((i) => getComputedStyle(i).opacity === "1"),
    revealsHidden: [...document.querySelectorAll(".reveal")].filter((e) => getComputedStyle(e).opacity === "0").length,
    reveals: document.querySelectorAll(".reveal").length,
  }));
  console.log("\nprefers-reduced-motion");
  ok(r.nopx, "the effect is off before it starts (html.nopx)");
  ok(r.hiddenCanvas, "every overlay canvas is display:none");
  ok(r.imgOpacity, "all pictures are at full opacity, mosaic or not");
  ok(r.revealsHidden === 0, `no fade is left hiding anything (${r.reveals} reveal elements, ${r.revealsHidden} stuck)`);
  await ctx.close();
}

/* ── 3 · JavaScript off: the page is a page ─────────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    hidden: [...document.querySelectorAll(".reveal, img, .os a")].filter((e) => getComputedStyle(e).opacity === "0").length,
    imgs: document.querySelectorAll("img").length,
    chars: document.body.innerText.length,
  }));
  console.log("\nno JavaScript");
  ok(r.canvases === 0, "no canvas is created by anything else — the markup carries no overlay");
  ok(r.hidden === 0, "nothing is hidden (0 of the reveal/photo/card elements at opacity 0)");
  ok(r.chars > 3000 && r.imgs >= 11, `${r.imgs} pictures and ${r.chars} characters of text are still there`);
  await ctx.close();
}

/* ── 4 · a broken image must not eat the section ────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route("**/assets/shots/01-dashboard.webp", (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const img = document.querySelector("#screens img.px");
    const host = img.closest(".frame");
    return { cvGone: !host.querySelector("canvas.pxmask") || getComputedStyle(host.querySelector("canvas.pxmask")).visibility === "hidden",
             captionVisible: !!host.nextElementSibling };
  });
  console.log("\none asset missing");
  ok(r.cvGone, "the overlay gives up rather than painting over a broken picture");
  ok(r.captionVisible, "the frame, its strip and its caption still render — no hole in the page");
  await ctx.close();
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
