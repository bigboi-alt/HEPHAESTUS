import { SHOTS, FILE_URL } from "./paths.mjs";
import { chromium } from "playwright";

const AUDIT = () => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (s) => { const m = s.match(/\d+(\.\d+)?/g) || [0,0,0]; const [r,g,b] = m.slice(0,3).map(Number); return 0.2126*srgb(r)+0.7152*srgb(g)+0.0722*srgb(b); };
  const effBg = (el) => { let n = el; while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; n = n.parentElement; } return getComputedStyle(document.body).backgroundColor; };
  const rows = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *, h1, h2, h3, p, a, li, span, small, b, em")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || !el.textContent.trim()) continue;
    // the portrait is a picture made of glyphs: its font size is the size of a dot in an
    // image, not a run of copy, so the legibility floor below deliberately doesn't apply
    if (el.matches("pre.bust, .art-box")) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < 9) rows.push({ t: "TINY " + fs + "px " + (el.className || el.tagName), r: 0 });
    const key = el.tagName + "." + el.className + "@" + cs.fontSize + cs.color;
    if (seen.has(key)) continue; seen.add(key);
    const l1 = lum(cs.color), l2 = lum(effBg(el));
    const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const big = fs >= 24 || (fs >= 18.5 && parseFloat(cs.fontWeight) >= 700);
    const need = big ? 3 : 4.5;
    if (ratio < need) rows.push({ t: `${el.tagName}.${el.className||""} ${fs}px w${cs.fontWeight}`, r: +ratio.toFixed(2), need });
  }
  const imgs = [...document.images];
  return {
    contrastFails: rows,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
    broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc.slice(-40)),
    imgCount: imgs.length, height: document.documentElement.scrollHeight,
    stuckHidden: [...document.querySelectorAll(".reveal")].filter(e => getComputedStyle(e).opacity === "0").length,
    reveals: document.querySelectorAll(".reveal").length,
    distorted: [...document.images].filter((i) => {
      const box = i.getBoundingClientRect();
      if (!box.width || !i.naturalWidth) return false;
      const want = i.naturalWidth / i.naturalHeight, got = box.width / box.height;
      return Math.abs(want - got) / want > 0.02;
    }).map((i) => i.alt || i.src.slice(-24)),
    media: document.querySelectorAll("img,canvas,picture,iframe,video,svg").length,
    // nothing may sit flush against the screen. measured on the CONTENT, not on the boxes
    // that own the page's side padding — those stretch edge to width on purpose
    edge: Math.min(...[...document.querySelectorAll("main > section > *, .hero > *, header .bar > *, .fbar > *")]
      .filter((el) => el.getClientRects().length)
      .map((el) => { const r = el.getBoundingClientRect(); return Math.min(r.left, window.innerWidth - r.right); })),
    artEdge: (() => { const r = document.querySelector("pre.bust")?.getBoundingClientRect(); return r ? Math.round(Math.min(r.left, window.innerWidth - r.right)) : -1; })(),
    docTitle: document.title, h1: document.querySelector("h1")?.innerText.replace(/\n/g," "),
    links: [...document.querySelectorAll("a[href]")].length,
    extAssets: [...document.querySelectorAll("link[href^=http],script[src^=http],img[src^=http]")].length,
  };
};

const b = await chromium.launch();
const serve = process.env.SERVE || "http://127.0.0.1:8099/index.html";
const fileUrl = FILE_URL;

for (const [label, url, w, h, dsf] of [
  ["desktop 1440", serve, 1440, 950, 2],
  ["laptop 1280", serve, 1280, 800, 2],
  ["tablet 860", serve, 860, 900, 2],
  ["phone 390", serve, 390, 844, 3],
  ["phone 360", serve, 360, 780, 2],
  ["wide 1920", serve, 1920, 1000, 1],
  ["FILE preview", fileUrl, 1400, 900, 1],
]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 120)); });
  await page.goto(url, { waitUntil: url.startsWith("file") ? "load" : "networkidle" });
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" }).catch(() => {});
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise(r => setTimeout(r, 90)); } window.scrollTo({ top: 0, behavior: "instant" }); });
  await page.waitForTimeout(900);
  const r = await page.evaluate(AUDIT);
  const bad = r.contrastFails.length;
  console.log(`${label.padEnd(13)} ${bad ? "CONTRAST FAILS " + bad : "contrast ok "} | reveal:${r.reveals - r.stuckHidden}/${r.reveals} shown | overflow:${r.overflow ? "YES " + r.scrollW + ">" + r.innerW : "no"} | aspect:${r.distorted.length ? "STRETCHED " + JSON.stringify(r.distorted) : "true"} | imgs:${r.imgCount} broken:${r.broken.length} | media:${r.media} | edge:${r.edge >= 16 && r.artEdge >= 8 ? "ok" : "LOW " + Math.round(r.edge) + "/" + r.artEdge} | ext:${r.extAssets} | links:${r.links} | h:${r.height}`);
  r.contrastFails.slice(0, 6).forEach(f => console.log(`      ✗ ${f.t} → ${f.r}:1 (needs ${f.need})`));
  if (r.broken.length) console.log("      broken:", r.broken);
  if (errs.length) console.log("      ERRORS:", errs.slice(0, 4));
  if (label.startsWith("desktop")) {
    await page.screenshot({ path: `${SHOTS}/2-new-hero.png` });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.42));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/2-new-mid.png` });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/2-new-get.png`, fullPage: false });
    console.log("      title:", r.docTitle, "\n      h1:", r.h1);
  }
  if (label.startsWith("phone")) await page.screenshot({ path: `${SHOTS}/2-new-mobile.png`, fullPage: false });
  await ctx.close();
}
await b.close();
