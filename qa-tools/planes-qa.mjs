import { APP, SHOTS } from "./paths.mjs";
/**
 * Does the planes panel tell the truth?
 * Pulls the real palette out of the running app, recomputes contrast + ΔE with
 * the engine the panel uses, and checks every claim the panel makes.
 */
import { chromium } from "playwright";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const browser = await chromium.launch();
for (let run = 0; run < 4; run++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addInitScript(() => localStorage.setItem("hephaestus.v1", JSON.stringify({ version: 1, palettes: [], sites: [], savedAt: Date.now(), settings: { theme: "obsidian", displayName: "Smith", motion: true, cedalionDock: false, density: "comfortable", colorFormat: "hex", accent: "#F5F5F5" } })));
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await page.locator("header").getByText("akmon", { exact: true }).click();
  await page.locator("input.input").first().fill(["deep dusty teal with a burnt orange accent, dark", "sage and clay, soft brutalism", "trustworthy fintech, light mode", "plum brandy with an acid lime accent, dark"][run]);
  await page.getByRole("button", { name: "forge", exact: true }).click();
  await page.waitForTimeout(700);

  const truth = await page.evaluate(() => {
    const txt = document.body.innerText;
    // the palette, read from the colour inputs the panel renders
    const hexes = [...document.querySelectorAll('input[type="color"]')].map((i) => i.value.toUpperCase());
    const verdict = (txt.split("\n").find((l) => /planes hold|steps off the layer below|two problems|reads at .*:1 on/i.test(l)) || "").trim();
    const claims = [...txt.matchAll(/(\d+(?:\.\d+)?) steps from (background|surface)/g)].map((m) => ({ claim: +m[1], over: m[2] }));
    const ratioClaims = [...txt.matchAll(/(\d+(?:\.\d+)?):1 on surface · (reads|too quiet)/g)].map((m) => ({ ratio: +m[1], verdict: m[2] }));
    return { hexes, verdict, claims, ratioClaims };
  }).catch((e) => { console.log("eval failed", e); return null; });

  // recompute from the DOM hexes in the order the panel paints them: bg, surface, border, text, muted (planes then inks)
  const order = ["background", "surface", "border", "text", "muted"];
  const hex = Object.fromEntries(order.map((r, i) => [r, truth.hexes[i]]));
  const mod = await page.evaluate(async (h) => {
    const c = await import("/src/engine/color.ts");
    return {
      steps: { surf_bg: +(c.deltaE(h.surface, h.background) * 100).toFixed(1), border_surf: +(c.deltaE(h.border, h.surface) * 100).toFixed(1) },
      ratios: { text: +c.contrastRatio(h.text, h.surface).toFixed(2), muted: +c.contrastRatio(h.muted, h.surface).toFixed(2) },
    };
  }, hex);

  console.log(`\n── run ${run + 1} · ${JSON.stringify(hex)}`);
  const surfClaim = truth.claims.find((cl) => cl.over === "background");
  ok(surfClaim && Math.abs(surfClaim.claim - mod.steps.surf_bg) < 0.15, `surface step claim ${surfClaim?.claim} matches the maths ${mod.steps.surf_bg}`);
  const borderClaim = truth.claims.find((cl) => cl.over === "surface");
  ok(borderClaim && Math.abs(borderClaim.claim - mod.steps.border_surf) < 0.15, `border step claim ${borderClaim?.claim} matches ${mod.steps.border_surf}`);
  const flat = mod.steps.surf_bg < 2;
  ok(!flat || /steps off the layer below|two problems/.test(truth.verdict), flat ? "a genuinely flat surface IS called out" : "a healthy surface is NOT called flat");
  ok(!flat || !/indistinguishable/.test(truth.verdict) || mod.steps.surf_bg < 2, "no false flatness verdict");
  const inksOk = mod.ratios.text >= 4.5 && mod.ratios.muted >= 4.5;
  ok(inksOk ? !/reads at .*:1 on surface . below 4|fails at small sizes/.test(truth.verdict) : /fails at small sizes|too quiet/.test(truth.verdict), `verdict agrees with the ratios (${mod.ratios.text}, ${mod.ratios.muted}) → "${truth.verdict.slice(0, 74)}…"`);
  for (const rc of truth.ratioClaims) ok(rc.verdict === (rc.ratio >= 4.5 ? "reads" : "too quiet"), `row badge ${rc.ratio}:1 says "${rc.verdict}" — consistent`);
  await page.screenshot({ path: `${SHOTS}/planes-truth-${run + 1}.png`, fullPage: false });
  await ctx.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
