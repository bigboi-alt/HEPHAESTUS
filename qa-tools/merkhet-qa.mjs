import { APP } from "./paths.mjs";
/**
 * Merkhet QA — the fixer must never claim a fix it hasn't measured.
 * Runs the real engine modules in the page (same code the UI calls), with
 * deliberately broken pages, and checks the verdict against independent maths.
 */
import { chromium } from "playwright";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);

const res = await page.evaluate(async () => {
  const cv = await import("/src/engine/canvas.ts");
  const ak = await import("/src/engine/akmon.ts");
  const col = await import("/src/engine/color.ts");
  const pal = ak.generatePalette({ prompt: "deep dusty teal with a burnt orange accent, dark", seed: 11 });

  const B = (o) => ({ id: o.kind + (o.n ?? 1), x: 0, y: 0, w: 400, h: 60, ...o });
  const PG = (blocks, bg) => ({ id: "p1", name: "home", blocks, ...(bg ? { bg } : {}) });
  const find = (pg, kind) => pg.blocks.find((b) => b.kind === kind);
  const out = {};

  /* 1 · text inside a bright card: contrast has to be measured on the CARD */
  {
    const cardBg = col.readableOn ? pal.swatches.find((s) => s.role === "primary").hex : "#333";
    const pg = PG([
      B({ kind: "card", n: 1, x: 100, y: 100, w: 600, h: 240, bg: cardBg }),
      B({ kind: "text", n: 1, x: 130, y: 140, w: 540, h: 90, text: "Solid oak, mortise and tenon.", fg: pal.swatches.find((s) => s.role === "muted").hex }),
    ]);
    const before = col.contrastRatio(find(pg, "text").fg, cardBg);
    const r = cv.merkhet(pg, pal, "contrast");
    const after = col.contrastRatio(find(r.page, "text").fg ?? "x", cardBg);
    out.c1 = { before: +before.toFixed(2), after: +after.toFixed(2), verdict: r.verdict, report: r.report, surfaceFn: cv.surfaceUnder(pg, find(pg, "text"), pal) === cardBg };
  }

  /* 2 · a surface where NO ink reaches 7:1 → it must admit it */
  {
    const mid = "#8a8a8a"; // white 3.5:1, black 4.7:1 — 7:1 is unreachable
    const pg = PG([
      B({ kind: "card", n: 2, x: 0, y: 0, w: 900, h: 300, bg: mid }),
      B({ kind: "text", n: 2, x: 40, y: 60, w: 700, h: 120, text: "Words nobody can read here.", fg: "#9a9a9a" }),
    ]);
    const r = cv.merkhet(pg, pal, "contrast");
    out.c2 = { verdict: r.verdict, report: r.report, best: Math.max(col.contrastRatio("#ffffff", mid), col.contrastRatio("#000000", mid)) };
  }

  /* 3 · layout must not rip a block out of its card */
  {
    const pg = PG([
      B({ kind: "card", n: 3, x: 100, y: 100, w: 620, h: 260, bg: pal.swatches.find((s) => s.role === "surface").hex }),
      B({ kind: "heading", n: 3, x: 113, y: 123, w: 566, h: 64, text: "Furniture" }),
      B({ kind: "text", n: 3, x: 121, y: 205, w: 540, h: 90, text: "Delivered flat." }),
    ]);
    const r = cv.merkhet(pg, pal, "layout");
    const card = find(r.page, "card"), head = find(r.page, "heading");
    const inside = card.x <= head.x && card.y <= head.y && card.x + card.w >= head.x + head.w && card.y + card.h >= head.y + head.h;
    out.c3 = { inside, card: { x: card.x, w: card.w }, head: { x: head.x, w: head.w }, verdict: r.verdict, report: r.report };
  }

  /* 4 · rhythm must not weld a heading onto its paragraph */
  {
    const pg = PG([
      B({ kind: "heading", n: 4, x: 100, y: 100, w: 600, h: 64, text: "A heading" }),
      B({ kind: "text", n: 4, x: 100, y: 178, w: 600, h: 96, text: "Its paragraph, below it." }),
    ]);
    const r = cv.merkhet(pg, pal, "rhythm");
    out.c4 = { hy: find(r.page, "heading").y, ty: find(r.page, "text").y, verdict: r.verdict, report: r.report };
  }

  /* 5 · harmonise colours must refuse when the palette colour would break reading */
  {
    const bright = pal.swatches.find((s) => s.role === "accent").hex;
    const pg = PG([
      B({ kind: "card", n: 5, x: 0, y: 0, w: 800, h: 220, bg: bright }),
      B({ kind: "text", n: 5, x: 40, y: 60, w: 700, h: 90, text: "Readable only because of the override.", fg: "#101010" }),
    ]);
    const sBefore = cv.auditCanvas(pg, pal).score;
    const r = cv.merkhet(pg, pal, "theme");
    const sAfter = cv.auditCanvas(r.page, pal).score;
    out.c5 = { kept: !!find(r.page, "text").fg, sBefore, sAfter, report: r.report, verdict: r.verdict };
  }

  /* 6 · measuring must be pure */
  {
    const pg = PG([B({ kind: "heading", n: 6, x: 33, y: 40, w: 600, h: 60, text: "hi" })]);
    const snapshot = JSON.stringify(pg);
    cv.merkhetProblems(pg, pal, "layout");
    out.c6 = { unchanged: JSON.stringify(pg) === snapshot };
  }
  return out;
});

console.log("merkhet verdicts");
ok(res.c1.surfaceFn, "surfaceUnder finds the card the text really sits on");
ok(res.c1.before < 7 && res.c1.after >= 7, `contrast mode fixed the real problem: ${res.c1.before}:1 → ${res.c1.after}:1 on the card`);
ok(res.c1.verdict.ok === true && res.c1.verdict.after === 0, "and the verdict says so because it re-measured (before " + res.c1.verdict.before + ", after " + res.c1.verdict.after + ")");

ok(res.c2.best < 7, `the mid-grey card genuinely can't reach 7:1 (best ink gives ${res.c2.best.toFixed(2)}:1)`);
ok(res.c2.verdict.ok === false, "merkhet does NOT claim success there");
ok(/could not fix|no ink|background itself|without breaking/i.test(res.c2.report.join(" ")), "and it says why, in plain words: “" + res.c2.report.filter((r) => /fix|background/.test(r))[0]?.slice(0, 88) + "…”");
ok(res.c2.verdict.reverted >= 0 && res.c2.verdict.remaining.length > 0, "remaining problems are listed, not hidden");

ok(res.c3.inside, `contained heading stays inside its card after an align pass (card x${res.c3.card.x} w${res.c3.card.w}, head x${res.c3.head.x} w${res.c3.head.w})`);

ok(res.c4.hy !== res.c4.ty, `rhythm leaves a heading and its paragraph on different lines (${res.c4.hy} vs ${res.c4.ty})`);

ok(res.c5.kept, "harmonise refuses to strip an override that was holding the text up");
ok(res.c5.sAfter >= res.c5.sBefore, `the page never scores worse after a pass (${res.c5.sBefore} → ${res.c5.sAfter})`);
ok(/left .* alone/.test(res.c5.report.join(" ")), "and explains the refusal: “" + (res.c5.report.find((r) => /left/.test(r)) ?? "").slice(0, 92) + "…”");

ok(res.c6.unchanged, "measuring without changing really doesn't touch the page");

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
