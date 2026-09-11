#!/usr/bin/env node
/*
  The screenshots on the site, taken from the running app. No mockups anywhere in
  site/assets/shots: this script seeds a real project, drives the real UI, shoots each
  screen at 1600 × 1000 (2×, downscaled) and writes webp.

    npm run dev -- --port 5199        # one terminal
    node tools/shots.mjs              # another, once. or: node tools/shots.mjs canvas review

  Needs playwright:  npm i -D playwright && npx playwright install chromium
  It writes straight into site/assets/shots, so re-running it is how the pictures on the
  page stay true after a change to the app.
*/
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const APP = process.env.APP || "http://127.0.0.1:5199/";
const OUT = process.env.SHOTDIR || "/tmp/hephaestus-shots";
const FINAL = new URL("../site/assets/shots", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const W = 1600, H = 1000;

/* ── the demo build, in canvas coordinates for a 1200-wide page ───────────── */
const B = (kind, x, y, w, h, extra = {}) => ({ id: kind + x + "y" + y, kind, x, y, w, h, ...extra });
const page = (name, blocks, minH) => ({ id: name, name, blocks, minH });

const HOME = page("home", [
  B("nav", 0, 0, 1200, 52, { text: "Kiln & Co", variant: "pill" }),
  B("chip", 60, 116, 210, 30, { text: "handmade in Sheffield" }),
  B("heading", 60, 168, 660, 130, { text: "Furniture that admits how it was made", weight: 700 }),
  B("text", 60, 312, 520, 92, { text: "Oak, mortise and tenon, linseed oil. No particle board, no flat-pack, no lies about where the timber came from." }),
  B("button", 60, 424, 168, 44, { text: "see the range", variant: "solid" }),
  B("button", 244, 424, 150, 44, { text: "how it's built", variant: "outline" }),
  B("image", 636, 168, 504, 300, {}),
  B("card", 60, 520, 340, 190, { text: "Ten years, one joint", sub: "Every table uses the same mortise. We tuned it for a decade so you never think about it." }),
  B("card", 430, 520, 340, 190, { text: "Kiln-dried slowly", sub: "Four weeks in the kiln at 55°C. Faster drying splits the boards; we stopped doing it in 2016." }),
  B("card", 800, 520, 340, 190, { text: "Repaired, not replaced", sub: "Send it back any time. We re-oil it and quote before we touch it." }),
  B("stat", 60, 760, 200, 96, { text: "1,400", sub: "tables out the door" }),
  B("stat", 280, 760, 200, 96, { text: "0", sub: "flat-pack screws" }),
  B("stat", 500, 760, 200, 96, { text: "34 yrs", sub: "at the bench" }),
  B("quote", 736, 760, 404, 132, { text: "“The only firm answer in the trade. They quoted eight weeks and it was eight weeks.”", sub: "— R. Halloway, The Fete" }),
  B("divider", 60, 930, 1080, 4, {}),
  B("footer", 0, 960, 1200, 72, { text: "© Kiln & Co — forged with hephaestus" }),
], 1080);

const RANGE = page("range", [
  B("nav", 0, 0, 1200, 52, { text: "Kiln & Co", variant: "pill", link: "home" }),
  B("heading", 60, 110, 700, 74, { text: "The range", weight: 700 }),
  B("text", 60, 196, 560, 60, { text: "Six pieces, all from the same bench. Anything else you saw was a one-off." }),
  B("card", 60, 288, 340, 240, { text: "Board table", sub: "Seats six. 2.2 m, white oak, oiled." }),
  B("card", 430, 288, 340, 240, { text: "Stool 01", sub: "Ash seat, splayed legs, 46 cm." }),
  B("card", 800, 288, 340, 240, { text: "Shelf 12", sub: "One board, two brackets, no fixings." }),
  B("button", 60, 570, 168, 44, { text: "back home", variant: "ghost", link: "home" }),
  B("footer", 0, 700, 1200, 72, { text: "© Kiln & Co — forged with hephaestus" }),
], 820);

const DOC = {
  brand: "Kiln & Co", transition: "fade", mode: "multi", pages: [HOME, RANGE],
  // the site-wide switches, set here so the shots show the exported file doing it
  options: {
    fontStack: "editorial", imageFill: "duotone", radius: 10, depth: 1, airiness: 1.1,
    headingCase: "none", headingTrack: -0.01, buttonShape: "soft", cardBorder: true, typeScale: 1,
  },
};

/* ── palette generation happens inside the page, with the real engine ─────── */
async function buildSeed(page, { theme, style, prompt, extraPrompts = [], name = "Kiln & Co" }) {
  return page.evaluate(async ({ theme, style, prompt, extraPrompts, name, doc, chatRect }) => {
    const ak = await import("/src/engine/akmon.ts");
    const mk = (p, seed, mode) => ak.generatePalette({ prompt: p, seed, mode, scheme: "analogous" });
    const pal = mk(prompt, 9, "light");
    pal.name = name + " · day";
    pal.favorite = true;
    const pals = [pal];
    for (let i = 0; i < extraPrompts.length; i++) {
      const q = extraPrompts[i];
      const p = mk(q.prompt, q.seed ?? 3 + i, q.mode ?? "dark");
      p.name = q.name;
      pals.push(p);
    }
    const now = Date.now();
    return JSON.stringify({
      version: 1,
      savedAt: now,
      palettes: pals,
      sites: [
        { id: "site-kiln", name, doc, palette: pal, pageCount: doc.pages.length, updatedAt: now - 1000 * 60 * 7 },
        { id: "site-night", name: "Foundry (night)",
          doc: { ...doc, brand: "Foundry", mode: "single", pages: [doc.pages[1]] },
          palette: pals[1] || pal, pageCount: 1, updatedAt: now - 1000 * 60 * 60 * 26 },
      ],
      settings: {
        theme, claudeStyle: style, accent: "#F5F5F5", density: "comfortable", colorFormat: "hex",
        motion: false, cedalionAutoAudit: false, cedalionDock: false, contrastFloor: 4.5,
        trendsRemoteUrl: "", trendsAutoRefresh: false, displayName: "Smith", handle: "@forge",
        chatRect,
      },
    });
  }, { theme, style, prompt, extraPrompts, name, doc: DOC, chatRect: { x: 1130, y: 84, w: 430, h: 560 } });
}

const b = await chromium.launch();
const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const shots = [];

async function session(settingsJson, prep) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => localStorage.setItem("hephaestus.v1", s), settingsJson);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const made = await prep(page);
  if (errs.length) console.log("   ! page errors:", errs.slice(0, 2));
  await ctx.close();
  return made;
}

async function shoot(page, file, opts = {}) {
  await page.waitForTimeout(220);
  await page.screenshot({ path: `${OUT}/${file}.png`, ...(opts.clip ? { clip: opts.clip } : {}) });
  shots.push(file);
  console.log("   • " + file);
}

const boot = await chromium.launch();
const bootPage = await (await boot.newContext()).newPage();
await bootPage.goto(APP, { waitUntil: "domcontentloaded" });
const seedBase = await buildSeed(bootPage, {
  theme: "claude", style: "ambrosia",
  prompt: "warm sand and deep slate, light, calm banking app",
  extraPrompts: [
    { prompt: "dusted black with a burnt orange accent, dark", name: "Foundry · night", mode: "dark", seed: 4 },
    { prompt: "paper white with ink blue, light, editorial", name: "Ledger", mode: "light", seed: 8 },
  ],
});
await boot.close();
const seedNyx = seedBase.replace('"theme":"claude"', '"theme":"claude"').replace('"claudeStyle":"ambrosia"', '"claudeStyle":"nyx"');
const seedObs = seedBase.replace('"theme":"claude"', '"theme":"obsidian"').replace('"claudeStyle":"nyx"', '"claudeStyle":"ambrosia"');

/* 1 · the dashboard, in the cream Claude skin */
if (want("dashboard")) await session(seedBase, async (page) => {
  await page.locator("header").getByText("home", { exact: true }).click();
  await page.waitForTimeout(400);
  await shoot(page, "01-dashboard");
});

/* 2 · akmon: palette forged, contrast cards + planes */
if (want("colour")) await session(seedBase, async (page) => {
  await page.locator("header").getByText("akmon", { exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('input[placeholder*="say what you want"]').fill("deep dusty teal with a burnt orange accent, dark");
  await page.getByRole("button", { name: "forge", exact: true }).click();
  await page.waitForTimeout(700);
  await shoot(page, "02-colour");
});

/* 3 · the canvas, one block selected, grid on */
if (want("canvas")) await session(seedBase, async (page) => {
  await page.locator("header").getByText("home", { exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("continue")').first().click();
  await page.waitForTimeout(700);
  await page.locator('[data-blk="heading60y168"]').click({ timeout: 5000 });
  await shoot(page, "03-canvas");
});

/* 4 · ▶ preview — the exported site, full screen */
if (want("preview")) await session(seedBase, async (page) => {
  await page.locator("header").getByText("home", { exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("continue")').first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "▶ preview" }).click();
  await page.waitForTimeout(1400);
  await shoot(page, "04-preview");
});

/* 5 · merkhet: a report with a verdict it earned */
if (want("review")) await session(seedBase, async (page) => {
  await page.locator("header").getByText("home", { exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("continue")').first().click();
  await page.waitForTimeout(600);
  // break a couple of things on purpose, so the reviewer has something to say
  await page.evaluate(async () => {
    const st = (await import("/src/store.ts")).useApp.getState();
    st.setSettings({ contrastFloor: 7 });
  });
  await page.getByRole("button", { name: /open merkhet fixer/ }).click();
  await page.waitForTimeout(400);
  await page.locator("button:has-text('make everything readable')").first().click();
  await page.waitForTimeout(900);
  await shoot(page, "05-review");
});

/* 6 · trends: 1,750 directions, paged */
if (want("library")) await session(seedBase, async (page) => {
  await page.locator("header").getByText("trends", { exact: true }).click();
  await page.locator("h1").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  await shoot(page, "06-library");
});

/* 7 · the night skin, on the surfaces panel */
if (want("night")) await session(seedNyx, async (page) => {
  await page.locator("header").getByText("akmon", { exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('input[placeholder*="say what you want"]').fill("dusted black with a burnt orange accent, dark");
  await page.getByRole("button", { name: "forge", exact: true }).click();
  await page.waitForTimeout(900);
  await shoot(page, "07-night");
});

/* 8 · cedalion answering, not just opening */
if (want("ask")) await session(seedObs, async (page) => {
  await page.locator("header").getByText("akmon", { exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('input[placeholder*="say what you want"]').fill("amber and slate, dark, editorial");
  await page.getByRole("button", { name: "forge", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "ask cedalion" }).click();
  await page.waitForTimeout(1600);
  await shoot(page, "08-ask");
});

/* ── encode: 2× capture → downscale → webp, so text stays crisp and small ── */
const list = shots.length ? shots : [];
if (list.length) {
  writeFileSync(`${OUT}/encode.py`, `
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(src)):
    if not f.endswith(".png"): continue
    p = os.path.join(src, f)
    im = Image.open(p).convert("RGB")
    im = im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS)
    out = os.path.join(dst, f[:-4] + ".webp")
    im.save(out, "WEBP", quality=74, method=6)
    print(os.path.basename(out), im.size, f"{os.path.getsize(out)/1024:.0f} KB")
`);
  execSync(`python3 ${OUT}/encode.py ${OUT} ${FINAL}`, { stdio: "inherit" });
}
await b.close();
console.log(`\n${list.length} shots → ${FINAL}`);
