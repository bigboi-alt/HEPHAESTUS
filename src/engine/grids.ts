/**
 * HEPHAESTUS · grid library — ready-made section layouts for the canvas.
 *
 * Each preset is a pure function that returns positioned blocks. The Studio
 * drops them below the page's current content, where every block remains a
 * normal editable canvas block. Content is seeded from the chosen purpose
 * when available, otherwise from lively canned copy.
 */
import { emptyBlock, FRAME_W, type CvBlock, type CvPage } from "./canvas";

export type GridSeed = {
  brand: string;
  heroH: string;
  heroS: string;
  cta: string;
  cta2: string;
  feats: { t: string; d: string }[];
  how: { t: string; d: string }[];
  stats: { v: string; l: string }[];
  quotes: { q: string; a: string }[];
  logos: string[];
  plans: { name: string; tag: string; price: string }[];
  ctaH: string;
  ctaS: string;
};

/* generic fallback copy — used when no purpose is chosen */
export const FALLBACK: GridSeed = {
  brand: "new brand",
  heroH: "Make something worth pointing at.",
  heroS: "A sharp line about what this is and who it is for — plain words, real promises, no padding.",
  cta: "get started",
  cta2: "see how it works",
  feats: [
    { t: "Calm by default", d: "An interface that stays out of the way until you need it — then moves exactly as fast as you do." },
    { t: "Numbers that narrate", d: "Reports explain themselves: trends, anomalies and the next move, in plain language." },
    { t: "Trust you can audit", d: "Every decision logged, every access explicit. Trust is a feature, not a promise." },
  ],
  how: [
    { t: "Tell us what you need", d: "Thirty seconds of plain language. No forms that feel like interviews." },
    { t: "We take it from there", d: "A clear plan, honest timeline and one point of contact throughout." },
    { t: "Enjoy the outcome", d: "Delivered, followed up, guaranteed — because the work outlives the brief." },
  ],
  stats: [
    { v: "4.9/5", l: "from people who shipped with us" },
    { v: "12 min", l: "average time to first publish" },
    { v: "98%", l: "would start again tomorrow" },
    { v: "0", l: "surprise fees, ever" },
  ],
  quotes: [
    { q: "It finally feels like the software was designed for the way we actually work.", a: "ops lead, northwind" },
    { q: "We shipped in a week what we'd scheduled for a quarter.", a: "founder, halcyon labs" },
    { q: "The kind of tool you recommend before anyone asks.", a: "designer, emberline" },
  ],
  logos: ["northwind", "halcyon", "basalt & co", "juniper", "atlas", "emberline"],
  plans: [
    { name: "starter", tag: "for a first launch", price: "$0" },
    { name: "studio", tag: "for serious makers", price: "$29" },
    { name: "atelier", tag: "for teams & agencies", price: "$99" },
  ],
  ctaH: "Ready when you are.",
  ctaS: "No card, no call, no catch. Start free and keep what you make.",
};

/* ---------------- tiny construction helpers ---------------- */

function head(x: number, y: number, w: number, size: number, text: string): CvBlock {
  return { ...emptyBlock("heading", x, y), w, h: Math.round(size * 1.5) + 8, size, weight: 800, text };
}
function sub(x: number, y: number, w: number, text: string): CvBlock {
  return { ...emptyBlock("text", x, y), w, h: 90, text };
}
function btn(x: number, y: number, w: number, text: string, variant = "solid"): CvBlock {
  return { ...emptyBlock("button", x, y), w, h: 56, text, variant, size: 17, weight: 700 };
}
function chip(x: number, y: number, text: string): CvBlock {
  return { ...emptyBlock("chip", x, y), h: 40, text, size: 12 };
}
function img(x: number, y: number, w: number, h: number): CvBlock {
  return { ...emptyBlock("image", x, y), w, h };
}
function card(x: number, y: number, w: number, h: number, t: string, d: string): CvBlock {
  return { ...emptyBlock("card", x, y), w, h, text: t, sub: d, size: 16 };
}
function stat(x: number, y: number, w: number, v: string, l: string): CvBlock {
  return { ...emptyBlock("stat", x, y), w, h: 130, text: v, sub: l, size: 42 };
}
function quote(x: number, y: number, w: number, q: string, a: string): CvBlock {
  return { ...emptyBlock("quote", x, y), w, h: 190, text: q, sub: a, size: 22 };
}
function listB(x: number, y: number, w: number, lines: string): CvBlock {
  return { ...emptyBlock("list", x, y), w, h: 120, text: lines, size: 17 };
}
function divider(x: number, y: number, variant = "soft"): CvBlock {
  return { ...emptyBlock("divider", x, y), x: 60, w: FRAME_W - 120, h: 6, variant };
}
function wordmark(x: number, y: number, w: number, name: string): CvBlock {
  return { ...emptyBlock("text", x, y), w, h: 60, text: name, size: 21, align: "center", weight: 800 };
}

export type GridPreset = {
  id: string;
  name: string;
  tag: string;
  icon: string;
  note: string;
  build: (c: GridSeed) => CvBlock[];
};

export const GRID_PRESETS: GridPreset[] = [
  {
    id: "hero-split", name: "hero split", tag: "headline · buttons · image", icon: "▦",
    note: "big idea left, visual right — the classic opener",
    build: (c) => [
      head(60, 40, 640, 58, c.heroH),
      sub(60, 290, 560, c.heroS),
      btn(60, 430, 220, c.cta),
      btn(300, 430, 250, c.cta2, "outline"),
      img(720, 60, 420, 440),
    ],
  },
  {
    id: "hero-center", name: "hero centred", tag: "centred headline + CTA", icon: "⯃",
    note: "announcement style — chip, headline, two buttons",
    build: (c) => [
      chip(510, 20, "✦ now shipping"),
      (() => { const b = head(80, 110, 1040, 64, c.heroH); return { ...b, align: "center", textAlign: "center" as const }; })(),
      (() => { const b = sub(150, 360, 900, c.heroS); return { ...b, align: "center", textAlign: "center" as const }; })(),
      (() => { const b = btn(380, 500, 220, c.cta); return { ...b, align: "center" }; })(),
      (() => { const b = btn(625, 500, 250, c.cta2, "outline"); return { ...b, align: "center" }; })(),
    ],
  },
  {
    id: "features-3", name: "three features", tag: "3-up cards", icon: "▢▢▢",
    note: "the workhorse row — three cards under a heading",
    build: (c) => [
      head(60, 20, 700, 40, "Why it works"),
      ...c.feats.slice(0, 3).map((f, i) => card(60 + i * 376, 130, 340, 260, f.t, f.d)),
    ],
  },
  {
    id: "features-4", name: "four features", tag: "2×2 cards", icon: "▦▦",
    note: "denser grid — four short cards in two rows",
    build: (c) => [
      head(60, 20, 700, 40, "Everything it does"),
      ...c.feats.slice(0, 4).map((f, i) => card(60 + (i % 2) * 556, 130 + Math.floor(i / 2) * 250, 520, 220, f.t, f.d)),
    ],
  },
  {
    id: "stats-4", name: "stats band", tag: "4-up numbers", icon: "ΣΣΣΣ",
    note: "proof row — four numbers that earn trust",
    build: (c) => [
      head(60, 20, 700, 40, "The numbers"),
      ...c.stats.slice(0, 4).map((s, i) => stat(60 + i * 290, 140, 260, s.v, s.l)),
    ],
  },
  {
    id: "steps-3", name: "how it works", tag: "numbered steps", icon: "①②③",
    note: "three steps — number chips above short cards",
    build: (c) => [
      head(60, 20, 700, 40, "How it comes together"),
      ...c.how.slice(0, 3).map((h, i) => [
        chip(60 + i * 376, 130, "0" + (i + 1)),
        card(60 + i * 376, 200, 340, 210, h.t, h.d),
      ]).flat(),
    ],
  },
  {
    id: "pricing-3", name: "pricing", tag: "3 plans", icon: "₿",
    note: "three tiers — edit the plan lines in the cards",
    build: (c) => [
      head(60, 20, 700, 42, c.ctaH),
      sub(60, 150, 700, c.ctaS),
      ...c.plans.slice(0, 3).map((p, i) =>
        card(60 + i * 380, 300, 350, 300, p.name, `${p.tag}\n${p.price} / month\n✓ feature line one\n✓ feature line two\n✓ feature line three`),
      ),
    ],
  },
  {
    id: "logos", name: "logo strip", tag: "trusted by", icon: "™",
    note: "wordmarks row — replace names to taste",
    build: (c) => [
      (() => { const b = head(60, 10, 1080, 30, "Trusted by teams who ship"); return { ...b, align: "center", textAlign: "center" as const }; })(),
      ...c.logos.slice(0, 6).map((n, i) => wordmark(60 + i * 186, 120, 150, n)),
    ],
  },
  {
    id: "quotes-3", name: "testimonials", tag: "3 quotes", icon: "❝❝❝",
    note: "social proof — three quotes in a row",
    build: (c) => [
      head(60, 20, 700, 40, "Word of mouth"),
      ...c.quotes.slice(0, 3).map((q, i) => quote(60 + i * 372, 140, 345, q.q, q.a)),
    ],
  },
  {
    id: "split-image", name: "image + text split", tag: "2-up story", icon: "◫▦",
    note: "visual left, argument right — good mid-page break",
    build: (c) => [
      img(60, 40, 540, 420),
      (() => { const b = head(660, 70, 480, 46, c.how[0].t); return { ...b, align: "center" as const }; })(),
      sub(660, 220, 480, c.how[0].d + " " + c.how[1].d),
      listB(660, 380, 460, "✓ " + c.feats[0].t + "\n✓ " + c.feats[1].t + "\n✓ " + c.feats[2].t),
      btn(660, 560, 220, c.cta),
    ],
  },
  {
    id: "cta-band", name: "call to action", tag: "closing band", icon: "➔",
    note: "the closer — centred heading, sub-line, button",
    build: (c) => [
      (() => { const b = head(150, 30, 900, 56, c.ctaH); return { ...b, align: "center", textAlign: "center" as const }; })(),
      (() => { const b = sub(250, 190, 700, c.ctaS); return { ...b, align: "center", textAlign: "center" as const }; })(),
      (() => { const b = btn(470, 330, 260, c.cta); return { ...b, align: "center" }; })(),
    ],
  },
  {
    id: "gallery-3", name: "gallery", tag: "3 images", icon: "▣▣▣",
    note: "three image blocks — swap for your own visuals",
    build: (c) => [
      head(60, 20, 700, 40, "Selected work"),
      img(60, 140, 350, 300),
      img(425, 140, 350, 300),
      img(790, 140, 350, 300),
      sub(60, 470, 1080, c.feats[0].d),
    ],
  },
  {
    id: "contact-2", name: "contact split", tag: "info + list", icon: "✉",
    note: "invite left, details right — a quiet closing section",
    build: (c) => [
      head(60, 30, 560, 48, "Say hello"),
      sub(60, 200, 500, c.ctaS),
      btn(60, 340, 240, c.cta),
      card(660, 60, 460, 320, "Where to find us", "hello@" + c.brand + ".com\n+1 555 0134 · replies same day\nsomewhere warm, planet earth\n@ " + c.brand + " on most networks"),
    ],
  },
  {
    id: "bento", name: "bento", tag: "mixed sizes", icon: "▤",
    note: "editorial grid — big card, stat, image and list in one field",
    build: (c) => [
      card(60, 30, 560, 400, c.feats[0].t, c.feats[0].d + "\n\n" + c.feats[1].d),
      img(660, 30, 480, 190),
      stat(660, 240, 230, c.stats[0].v, c.stats[0].l),
      stat(910, 240, 230, c.stats[1].v, c.stats[1].l),
      listB(60, 460, 560, "✓ " + c.how[0].t + "\n✓ " + c.how[1].t + "\n✓ " + c.how[2].t),
      img(660, 460, 480, 190),
    ],
  },
  {
    id: "faq-accordion", name: "faq accordion", tag: "frequently asked questions", icon: "?",
    note: "clear answers to overcome objections before sign-up",
    build: (c) => [
      head(60, 20, 700, 42, "Frequently Asked Questions"),
      sub(60, 110, 600, "Everything you need to know about " + c.brand + " and how it works."),
      card(60, 200, 520, 150, "How does the trial work?", "Start immediately with no credit card. You get full access to all features for 14 days."),
      card(620, 200, 520, 150, "Can I export production code?", "Yes, one-click export generates clean, framework-agnostic HTML, CSS, and Tailwind code."),
      card(60, 380, 520, 150, "Does this require any external API or cloud?", "No. Hephaestus is 100% local and offline. All palette math, contrast scoring, and canvas editing run directly on your machine."),
      card(620, 380, 520, 150, "Where is my data stored?", "Everything is stored in your local browser storage. No analytics or tracking ever leave your device."),
    ],
  },
  { id: "divider-row", name: "section divider", tag: "full-width rule", icon: "―",
    note: "a breathing break — soft rule, or switch to solid / gradient",
    build: () => [divider(60, 20)],
  },
];

/** content-bottom of a block list (for spacing) */
export function blockSpan(blocks: CvBlock[]): number {
  let max = 0;
  for (const b of blocks) max = Math.max(max, b.y + b.h);
  return max;
}

/** place a preset's blocks onto an existing page: returns copies laid below content */
export function layBelow(preset: GridPreset, page: CvPage, seed: GridSeed): CvBlock[] {
  const base = blockSpan(page.blocks) + 56;
  const gap = preset.id === "divider-row" ? 0 : 0;
  void gap;
  return preset.build(seed).map((b) => ({ ...b, id: b.id + "-" + Math.random().toString(36).slice(2, 6), y: Math.round((b.y + base) / 8) * 8 }));
}
