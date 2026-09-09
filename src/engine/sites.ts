/**
 * HEPHAESTUS · sites — the live-site generator.
 *
 * Takes (purpose, palette, direction spec, section list, seed) and renders a
 * real, interactive marketing site as one self-contained HTML document:
 * real copy, real layout, nav that anchors, a pricing toggle, an FAQ, a
 * mobile menu, theme colours straight from the palette roles. No framework,
 * no network, no images — everything is CSS + tiny inline JS. Deterministic
 * per seed, so "surprise me" is honest and repeatable.
 */

import type { Palette } from "./akmon";
import { contrastRatio } from "./color";
import { getPurpose, type Purpose } from "../data/trends";
import type { Direction } from "./directions";

export type SiteSection =
  | "nav" | "hero" | "logos" | "features" | "how" | "stats"
  | "products" | "testimonials" | "pricing" | "faq" | "cta" | "footer";

export type SiteKnobs = {
  radius: number;
  borderWidth: number;
  spacingUnit: number;
  typeScale: number;
  baseFontPx: number;
  maxWidth: number;
  motionMs: number;
  shadow: string;
  fontStack: string;
};


export const SITE_SECTIONS: { id: SiteSection; label: string }[] = [
  { id: "nav", label: "nav" },
  { id: "hero", label: "hero" },
  { id: "logos", label: "proof strip" },
  { id: "features", label: "features" },
  { id: "how", label: "how it works" },
  { id: "products", label: "product grid" },
  { id: "stats", label: "stats" },
  { id: "testimonials", label: "voices" },
  { id: "pricing", label: "pricing" },
  { id: "faq", label: "faq" },
  { id: "cta", label: "final cta" },
  { id: "footer", label: "footer" },
];

/* ---------------- deterministic rng ---------------- */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length) % arr.length];

/* ---------------- copy banks (kept tight: templates, not essays) ------- */

const BRAND_A = ["Arc", "Cinder", "Haven", "Lumen", "North", "Basalt", "Fern", "Opal", "Clover", "Iron", "Juniper", "Larkspur", "Marlowe", "Oslo", "Parlance", "Quill", "Ridgetop", "Solace", "Turnkey", "Vesper", "Wren", "Yellowbird", "Zephyr", "Bramble", "Emberline", "Fieldnote", "Granite", "Halcyon", "Iris", "Kinfolk"];
const BRAND_B = ["works", "&co", "labs", "studio", "systems", "forge", "collective", "partners", "digital", "the", "hq", "one", "soft", "house", "field"];

export type SiteContent = {
  brand: string;
  heroH: string;
  heroS: string;
  cta: string;
  cta2: string;
  logos: string[];
  feats: { icon: string; t: string; d: string }[];
  how: { t: string; d: string }[];
  stats: { v: string; l: string }[];
  quotes: { q: string; a: string; r: string }[];
  products: { name: string; price: string; tag: string }[];
  plans: { name: string; tag: string; price: string; yearly: string; feats: string[] }[];
  faqs: { q: string; a: string }[];
  ctaH: string;
  ctaS: string;
};

const HEAD = {
  saas: ["The engine room for teams that ship", "Run your business on fewer tools", "Clarity for the way work actually happens", "One system. Every project. Zero chaos."],
  finance: ["Money, moving with certainty", "Your money, legible at a glance", "Banking-grade calm for every decision", "Numbers you can trust at 3 a.m."],
  ecommerce: ["Better things, fewer compromises", "Shop the edit worth obsessing over", "Delivered fast. Returned free. Loved longer.", "Small-batch goods, no middlemen"],
  marketplace: ["Find it. Trust it. Done.", "The marketplace that verifies both sides", "Buy and sell with receipts, not vibes", "Every listing, every payout, protected"],
  portfolio: ["Design that earns the second look", "Selected work, unselected noise", "I make interfaces that feel inevitable", "Work in public, taste in everything"],
  brand: ["Atmosphere you can book", "Craft, on record", "Make the ordinary worth remembering", "Taste you can point at"],
  docs: ["Documentation that answers first", "Read the docs. Ship faster.", "The manual people actually read", "Answers in under three clicks"],
  tools: ["For people who measure everything", "Tooling that respects your time", "Built for the terminal generation", "Speed you can measure"],
  product: ["The tool that shapes itself to you", "Output you can steer, never fake", "Your work, amplified honestly", "Software that explains itself"],
  health: ["Care that starts with calm", "Health, without the guesswork", "Serious medicine, gentler logistics", "Your health data, handled like a secret"],
  education: ["Learning that sticks the landing", "Progress you can see every day", "Small steps, serious gains", "Where curious people get fluent"],
  wellness: ["Feel human again", "Training that keeps the streak kind", "Move more, guilt less", "Your body, coached with warmth"],
  gaming: ["Step into the next world", "Play the patch everyone is talking about", "One more run. Always.", "Where the legend begins"],
  media: ["Press play, stay lost", "The catalog that remembers you", "Every mood, one screen away", "Stories that follow you home"],
  internal: ["The tool your team won't resent", "Work the system, not the work", "Boring on purpose. Fast on purpose.", "Respect for the 9-to-5"],
  personal: ["Hello, I'm {name}", "Notes from a working life", "Things I've made and learned", "A corner of the internet that is mine"],
  marketplace2: ["Every stay, verified", "Find the place that fits the feeling", "Real hosts, real reviews, real refunds", "Book with your eyes open"],
} as Record<string, string[]>;

function groupOf(p: Purpose): string {
  return p.group;
}

export function contentFor(p: Purpose, rng: () => number): SiteContent {
  const g = groupOf(p);
  const brand = `${pick(rng, BRAND_A)} ${pick(rng, BRAND_B)}`.trim().replace(/\s+/, " ");
  const heads = HEAD[g] ?? HEAD.product;
  const heroH = (pick(rng, heads) as string).replace("{name}", "Alex");
  const heroS = p.brief;
  const cta = pick(rng, ["get started", "start free", "try it now", "book a demo", "explore", "get early access", "claim your spot", "browse the collection", "talk to us"]);
  const cta2 = pick(rng, ["see how it works", "view the details", "watch the tour", "read the story", "no, show me more"]);

  const names = ["northwind", "halcyon", "basalt", "ferndale", "juniper&co", "marrow", "atlas", "quillbit", "solace", "ridgefield", "kinfolk", "emberline"];
  const logos = [...new Set([0, 1, 2, 3, 4].map(() => pick(rng, names) as string))];

  const feats =
    g === "finance" || g === "saas" || g === "product" || g === "tools" || g === "docs"
      ? [
          { icon: "shield", t: "Security you can audit", d: "Every decision logged, every access request explicit. Trust is a feature, not a promise." },
          { icon: "bolt", t: "Fast by default", d: "Sub-second interactions on a calm surface. Speed you feel, not benchmarks you read." },
          { icon: "chart", t: "Numbers that narrate", d: "Reports that explain themselves — trends, anomalies and what to do next, in plain language." },
          { icon: "grid", t: "One home for everything", d: "No tab archaeology. Projects, people and history arranged the way your work actually flows." },
          { icon: "bell", t: "Alerts that respect you", d: "Only the signals that need a human. The rest quietly resolves itself." },
          { icon: "chat", t: "Help from a human", d: "Real support with the context already attached. No retelling your story to six agents." },
        ]
      : g === "ecommerce" || g === "marketplace"
      ? [
          { icon: "truck", t: "Ships today", d: "Orders before noon leave the same day, tracked door to door with a human on call." },
          { icon: "rotate", t: "Free returns, no theatre", d: "Thirty days, prepaid label, refund the moment the scan hits. That's the whole policy." },
          { icon: "bag", t: "Curated, not endless", d: "A tight edit of things that earn their place — vetted by makers and testers, never algorithms." },
          { icon: "lock", t: "Payments with receipts", d: "Escrow on every transaction. Both sides protected, every dispute decided by evidence." },
          { icon: "chat", t: "Real humans on chat", d: "Answers in minutes from people who know the product, not a script tree." },
          { icon: "gift", t: "Wrapped and ready", d: "Gift orders arrive with handwritten notes and packaging worth keeping." },
        ]
      : [
          { icon: "spark", t: "The details do the talking", d: "Every pixel placed with intent — spacing, rhythm and contrast doing their quiet work." },
          { icon: "pen", t: "Made by hand, kept simple", d: "No templates, no stock flavour. Everything here was written, drawn or built for this." },
          { icon: "mail", t: "Say hello", d: "One inbox, answered by a person, usually the same day. Ask for anything." },
          { icon: "map", t: "Easy to find, hard to leave", d: "Clear directions, clear hours, clear prices. The friction lives somewhere else." },
          { icon: "users", t: "People over process", d: "A small team that keeps its promises and shows up — on site and on time." },
          { icon: "heart", t: "Worth coming back for", d: "The kind of place regulars describe to strangers. You'll be one of them." },
        ];

  const how =
    g === "saas" || g === "product" || g === "tools"
      ? [
          { t: "Connect your stack", d: "Two-minute setup with the tools you already run. No migration weekend." },
          { t: "See the pattern", d: "Live views surface what needs attention — before it becomes a problem." },
          { t: "Act with context", d: "Every action carries its history, so decisions are fast and defensible." },
        ]
      : [
          { t: "Tell us what you need", d: "Thirty seconds of plain language. No forms that feel like interviews." },
          { t: "We take it from there", d: "A clear plan, honest timeline and one point of contact throughout." },
          { t: "Enjoy the outcome", d: "Delivered, followed up, and guaranteed — because the relationship outlives the job." },
        ];

  const stats =
    g === "finance"
      ? [{ v: "99.99%", l: "uptime, audited quarterly" }, { v: "<40ms", l: "median decision latency" }, { v: "0", l: "unexplained transactions" }, { v: "7:1", l: "contrast on every screen" }]
      : g === "ecommerce"
      ? [{ v: "4.8★", l: "across 12,000 reviews" }, { v: "24h", l: "average dispatch time" }, { v: "31%", l: "of orders from returners" }, { v: "0", l: "questions left unanswered" }]
      : g === "health"
      ? [{ v: "92%", l: "fewer calls to the front desk" }, { v: "3min", l: "average booking time" }, { v: "2×", l: "faster follow-up" }, { v: "100%", l: "of data encrypted at rest" }]
      : g === "education"
      ? [{ v: "87%", l: "finish what they start" }, { v: "4.9/5", l: "from 2,300 learners" }, { v: "20k+", l: "lessons shipped" }, { v: "6wk", l: "median time to first win" }]
      : g === "gaming"
      ? [{ v: "120fps", l: "locked on console" }, { v: "60h", l: "campaign, zero filler" }, { v: "9.1", l: "press score, day one" }, { v: "2M", l: "players in the first week" }]
      : g === "wellness"
      ? [{ v: "11min", l: "average session length" }, { v: "83%", l: "still training at day 90" }, { v: "5min", l: "to your first session" }, { v: "24/7", l: "coach access, human-checked" }]
      : [{ v: "4.9/5", l: "average rating" }, { v: "2×", l: "faster than the old way" }, { v: "48h", l: "typical first response" }, { v: "10y+", l: "of craft behind it" }];

  const quotes = [
    { q: "The first tool in years where the default state is calm. It quietly does the job and gets out of the way.", a: "Sam R.", r: "head of product, halcyon" },
    { q: "We switched on a Tuesday. By Friday nobody mentioned the old software again. That has never happened.", a: "Priya K.", r: "operations lead" },
    { q: "It feels like it was designed by someone who actually does the work — because it was.", a: "Diego M.", r: "independent maker" },
  ];

  const products =
    g === "ecommerce"
      ? [
          { name: "Field jacket, waxed", price: "$189", tag: "bestseller" },
          { name: "Weekender, 28L", price: "$142", tag: "new" },
          { name: "Pocket knife, titanium", price: "$64", tag: "last few" },
        ]
      : g === "restaurant" || g === "brand"
      ? [
          { name: "Small plates · for the table", price: "$38", tag: "chef's pick" },
          { name: "The long lunch menu", price: "$65", tag: "three courses" },
          { name: "Sunday supper club", price: "$48", tag: "weekly" },
        ]
      : [
          { name: "Starter", price: "$12", tag: "per month" },
          { name: "Professional", price: "$49", tag: "most popular" },
          { name: "Enterprise", price: "$129", tag: "annual only" },
        ];

  const plans =
    g === "ecommerce"
      ? [
          { name: "Shopper", tag: "", price: "$0", yearly: "$0", feats: ["Standard checkout", "Order tracking", "Returns portal"] },
          { name: "Plus", tag: "free shipping", price: "$9", yearly: "$7", feats: ["Unlimited free shipping", "Early access drops", "Birthday credit"] },
          { name: "Collector", tag: "for the devoted", price: "$29", yearly: "$24", feats: ["Everything in Plus", "Private previews", "First-dibs concierge"] },
        ]
      : [
          { name: "Starter", tag: "", price: "$0", yearly: "$0", feats: ["3 active projects", "Community support", "Core reports"] },
          { name: "Pro", tag: "most popular", price: "$29", yearly: "$24", feats: ["Unlimited projects", "Priority support", "Advanced analytics", "SSO"] },
          { name: "Enterprise", tag: "talk to us", price: "$99", yearly: "$89", feats: ["Everything in Pro", "Dedicated success lead", "On-prem option", "SLA 99.99%"] },
        ];

  const faqs = [
    { q: "How long does setup take?", a: "Most teams are live inside an afternoon. Import tools exist for the common cases, and a human walks you through anything unusual." },
    { q: "What happens to my data if I leave?", a: "It is yours, always. Full export in open formats at any time — no hostage situations, no hidden fees on the way out." },
    { q: "Is there a free tier?", a: "Yes. The starter plan is free forever for small teams, and it is the same software — not a demo with the good parts locked." },
    { q: "Do you offer support for teams?", a: "Every paid plan includes real human support with context attached. Enterprise gets a named lead and a shared channel." },
  ];

  const ctaH = pick(rng, ["Ready when you are.", "Let's make it real.", "The best time was yesterday. The second best is now.", "Your move.", "Come see what's possible."]) as string;
  const ctaS = pick(rng, ["No pressure, no spam. Just a straight answer and a clear next step.", "Start in minutes. Change your mind anytime — your data comes with you."]) as string;

  return { brand, heroH, heroS, cta, cta2, logos, feats, how, stats, quotes, products, plans, faqs, ctaH, ctaS };
}

/* ---------------- palette → css ---------------- */

function role(p: Palette, role: string): string {
  return p.swatches.find((s) => s.role === role)?.hex ?? "#888";
}
function bestOn(hex: string, a: string, b: string): string {
  return contrastRatio(hex, a) >= contrastRatio(hex, b) ? a : b;
}

export type BuildInput = {
  purpose: Purpose;
  palette: Palette;
  knobs: SiteKnobs;
  atoms?: Direction["atoms"];
  sections: SiteSection[];
  seed: number;
};

const ICONS: Record<string, string> = {
  bolt: '<path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z"/>',
  shield: '<path d="M12 2 4 5.5v6c0 5 3.4 8.7 8 10.5 4.6-1.8 8-5.5 8-10.5v-6L12 2z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10.5 19a2 2 0 0 0 3 0"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  truck: '<path d="M1.5 6h13v10h-13zM14.5 9h4l3 3.5V16h-7z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  rotate: '<path d="M4 12a8 8 0 1 1 2.5 5.8M4 12v5.5M4 12h5.5"/>',
  bag: '<path d="M5 8h14l1.2 12H3.8L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="1.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  gift: '<rect x="4" y="9" width="16" height="4"/><rect x="4" y="13" width="16" height="7.5"/><path d="M12 9v11.5M12 9s-4.8.6-6-2.6C5 4 9 3.4 12 9zM12 9s4.8.6 6-2.6C19 4 15 3.4 12 9z"/>',
  spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/><path d="M19 16l.8 2.7L22 19.5l-2.2.8L19 23l-.8-2.7-2.2-.8 2.2-.8L19 16z"/>',
  pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M13.5 7.5l3 3"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.5 7 12 13l8.5-6"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14M15 6v14"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 5.6a3.2 3.2 0 0 1 0 5.9M17.6 13.8c2 .9 3.4 2.6 3.4 5.2"/>',
  heart: '<path d="M12 20.5S3.5 15 3.5 8.9C3.5 5.9 5.8 4 8.2 4c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2 2.4 0 4.7 1.9 4.7 4.9C20.5 15 12 20.5 12 20.5z"/>',
  play: '<path d="M7 4.5v15l13-7.5L7 4.5z"/>',
  check: '<path d="M4.5 12.5 10 18 19.5 6.5"/>',
  star: '<path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.3-5.7-3.1-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8L12 2.8z"/>',
  moon: '<path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  arrow: '<path d="M4 12h15M13 5.5 19.5 12 13 18.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.5 2"/>',
};

function icon(name: string): string {
  const d = ICONS[name] ?? ICONS.spark;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------------- the builder ---------------- */

export function buildSiteHtml(input: BuildInput): { html: string; sections: SiteSection[] } {
  const { purpose, palette, knobs, atoms, sections, seed } = input;
  const rng = mulberry32(seed);
  const c = contentFor(purpose, rng);

  const bg = role(palette, "background");
  const surf = role(palette, "surface");
  const border = role(palette, "border");
  const tx = role(palette, "text");
  const mut = role(palette, "muted");
  const pri = role(palette, "primary");
  const sec = role(palette, "secondary"); // used via --sec
  const acc = role(palette, "accent");

  const isDark = contrastRatio(bg, "#ffffff") > contrastRatio(bg, "#000000");

  const ctaBg = acc;
  const ctaTx = bestOn(ctaBg, bg, tx);
  const ctaBg2 = pri === acc ? sec : pri;
  const ctaTx2 = bestOn(ctaBg2, bg, tx);
  const ghost = bestOn(bg, tx, mut);

  const radius = knobs.radius;
  const bwidth = knobs.borderWidth;
  const font = knobs.fontStack;
  const scale = knobs.typeScale;
  const motion = knobs.motionMs;
  const shadows = knobs.shadow;

  const atomId = (axis: string) => (atoms as any)?.[axis]?.id ?? "";
  const layoutId = atomId("layout");
  const typeId = atomId("type");
  const surfId = atomId("surface");
  const motionId = atomId("motion");
  const bento = layoutId.startsWith("bento");
  const single = layoutId === "single-column";
  const hard = surfId === "surf-hard";
  const glass = surfId === "surf-glass";
  const giant = typeId === "type-giant";
  const kinetic = typeId === "type-kinetic";
  const calm = motionId === "motion-none" ? 0 : 1;

  const maxW = single ? Math.min(knobs.maxWidth, 780) : knobs.maxWidth;
  const line = `1px solid ${border}`;
  const hardLine = `${Math.max(bwidth, 1)}px solid ${border}`;
  const cardBg = glass ? `rgba(255,255,255,0.04)` : surf;
  const navBg = glass ? "rgba(0,0,0,0)" : `color-mix(in srgb, var(--bg) ${isDark ? "78%" : "88%"}, transparent)`;
  const sectionPad = Math.round(knobs.spacingUnit * (giant ? 18 : 13));

  const H: string[] = [];
  const push = (s: string) => H.push(s);

  const navId = `h-${(seed % 9000) + 1000}`;
  const js: string[] = [];

  const sectionOn = (s: SiteSection) => sections.includes(s);

  /* ---------- css ---------- */
  push(`<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(c.brand)} · ${esc(purpose.label)}</title>
<style>
:root{
  --bg:${bg};--surf:${surf};--line:${border};--tx:${tx};--mut:${mut};
  --pri:${pri};--sec:${sec};--acc:${acc};--cta:${ctaBg};--ctatx:${ctaTx};
  --cta2:${ctaBg2};--cta2tx:${ctaTx2};--ghost:${ghost};
  --r:${radius}px;--bw:${Math.max(bwidth,1)}px;--sp:${knobs.spacingUnit}px;
  --ts:${scale};--base:${Math.round(knobs.baseFontPx)}px;--mw:${maxW}px;
  --mot:${motion}ms;--f:${font};
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--tx);font-family:var(--f);font-size:var(--base);line-height:1.6;-webkit-font-smoothing:antialiased}
img,svg{display:block}
a{color:inherit}
.wrap{max-width:var(--mw);margin:0 auto;padding:0 calc(var(--sp)*2.5)}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--acc);font-weight:700;margin-bottom:calc(var(--sp)*1.2)}
h1,h2,h3{line-height:1.08;letter-spacing:-.02em;font-weight:750;text-wrap:balance}
.h-hero{font-size:clamp(2.4rem,${single ? 6.5 : giant ? 8 : 6.2}vw,${giant ? 5.4 : 4.6}rem)}
${kinetic ? ".kinetic span{display:inline-block;animation:rise .8s cubic-bezier(.2,.9,.3,1) both;animation-delay:calc(var(--i)*.06s)}@keyframes rise{from{transform:translateY(.6em);opacity:0}to{transform:none;opacity:1}}" : ""}
.lead{color:var(--mut);font-size:calc(var(--base)*1.15);max-width:58ch;margin:calc(var(--sp)*1.6) 0 calc(var(--sp)*2.2)}
.btn{display:inline-flex;align-items:center;gap:.5em;border:${hard ? "max(2px,var(--bw)) solid var(--tx)" : "var(--bw) solid transparent"};border-radius:var(--r);padding:calc(var(--sp)*1.1) calc(var(--sp)*2);font-weight:700;font-family:inherit;font-size:calc(var(--base)*.95);cursor:pointer;text-decoration:none;transition:transform ${motion}ms ease,box-shadow ${motion}ms ease,opacity ${motion}ms ease}
.btn-p{background:var(--cta);color:var(--ctatx)}.btn-p:hover{opacity:.9}
.btn-s{background:var(--cta2);color:var(--cta2tx)}.btn-s:hover{opacity:.9}
.btn-g{background:transparent;color:var(--ghost);border:var(--bw) solid var(--line)}.btn-g:hover{border-color:var(--tx)}
${calm ? `.btn:hover{transform:translateY(-1px)}${hard ? "" : `.btn:active{transform:none}`}` : ""}
.sec{padding:calc(var(--sp)*${sectionPad}) 0}
.sec-head{max-width:56ch;margin-bottom:calc(var(--sp)*3.5)}
.sec-head h2{font-size:clamp(1.7rem,4vw,2.7rem);margin-bottom:calc(var(--sp)*1.1)}
.sec-head p{color:var(--mut);font-size:calc(var(--base)*1.05)}
.grid{display:grid;gap:calc(var(--sp)*2)}
nav{position:sticky;top:0;z-index:50;background:${navBg};backdrop-filter:${glass ? "blur(14px) saturate(1.3)" : "none"};border-bottom:${line};}
.nav-in{display:flex;align-items:center;justify-content:space-between;height:calc(var(--sp)*6);gap:var(--sp)}
.logo{font-weight:800;letter-spacing:-.01em;text-decoration:none;display:flex;gap:9px;align-items:center}
.logo i{display:inline-block;width:11px;height:11px;background:var(--acc);border-radius:3px;flex:none}
.nav-links{display:flex;gap:calc(var(--sp)*2.2);align-items:center;list-style:none}
.nav-links a{color:var(--mut);text-decoration:none;font-size:calc(var(--base)*.92);font-weight:550}
.nav-links a:hover{color:var(--tx)}
.nav-cta{display:flex;gap:var(--sp);align-items:center}
.burger{display:none;background:none;border:var(--bw) solid var(--line);border-radius:var(--r);padding:7px 9px;color:var(--tx);cursor:pointer}
.burger svg{width:18px;height:18px}
.menu{display:none}
@media(max-width:760px){
 .nav-links,.nav-cta .btn-g{display:none}
 .burger{display:inline-flex}
 .menu.open{display:flex;flex-direction:column;gap:var(--sp);padding:calc(var(--sp)*1.6) 0;border-top:${line};list-style:none}
 .menu.open li{width:100%}
}
.hero{display:grid;grid-template-columns:${single ? "1fr" : "1.05fr .95fr"};gap:calc(var(--sp)*3);align-items:center;padding:calc(var(--sp)*${single ? 10 : 14}) 0 calc(var(--sp)*${sectionPad})}
.art{position:relative;aspect-ratio:4/3.4;${glass ? `border-radius:calc(var(--r)*1.6);overflow:hidden` : ""}}
.art-in{position:absolute;inset:0;border-radius:var(--r);border:${hardLine};background:${cardBg};${shadows ? `box-shadow:${shadows};` : ""}overflow:hidden;padding:6%;display:flex;flex-direction:column;gap:4%}
.art.bento .art-in{border-radius:calc(var(--r)*1.4)}
.art-bar{height:9%;border-radius:var(--r);display:flex;gap:2%;align-items:center;padding:0 2.6%}
.art-bar i{width:9px;height:9px;border-radius:50%;background:var(--line);flex:none}
.art-bar b{display:block;height:34%;width:34%;background:var(--line);border-radius:var(--r)}
.art-cards{display:grid;grid-template-columns:1fr 1fr;gap:4%;flex:1}
.art-cards .a{background:${isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.045)"};border-radius:var(--r);border:${line};display:flex;flex-direction:column;gap:8%;padding:7%}
.art-cards .a.big{grid-row:span 2}
.art-cards i{display:block;border-radius:var(--r);background:linear-gradient(135deg,var(--pri) 0%,var(--sec) 130%)}
.art-cards .a.big i{flex:1}
.art-cards .a:not(.big) i{height:30%}
.art-cards u{display:block;height:8%;background:${line};border-radius:var(--r)}
.art-cards u.u2{width:70%}
.chip{position:absolute;bottom:4%;right:4%;border:${hardLine};background:var(--cta);color:var(--ctatx);border-radius:var(--r);padding:3% 4%;font-weight:800;font-size:70%}
${calm ? ".chip{animation:float 5s ease-in-out infinite}@keyframes float{50%{transform:translateY(-6px)}}" : ""}
.points{display:flex;flex-wrap:wrap;gap:calc(var(--sp)*1.4);margin-top:calc(var(--sp)*2.2);color:var(--mut);font-size:calc(var(--base)*.92);font-weight:600}
.points b{color:var(--acc)}
.logos{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:calc(var(--sp)*1.8);align-items:center}
.logos .lg{color:var(--mut);opacity:.75;font-weight:800;letter-spacing:.04em;text-align:center;font-size:calc(var(--base)*1.05);white-space:nowrap}
.feats{display:grid;grid-template-columns:repeat(${bento ? "4" : single ? "2" : "3"},1fr);gap:calc(var(--sp)*2);${bento ? "" : ""}}
@media(max-width:900px){.feats{grid-template-columns:repeat(2,1fr)}.hero{grid-template-columns:1fr}.art{order:-1}}
@media(max-width:600px){.feats{grid-template-columns:1fr}}
${bento ? ".feats .f:first-child{grid-column:span 2;grid-row:span 2}.feats .f:nth-child(2){grid-column:span 2}.feats .f{min-height:220px}" : ""}
.f{background:${cardBg};border:${hard ? hardLine : line};border-radius:${bento ? "calc(var(--r)*1.4)" : "var(--r)"};padding:calc(var(--sp)*2.4);${shadows && !glass ? `box-shadow:${shadows}` : ""}transition:${calm ? `transform ${motion}ms ease,box-shadow ${motion}ms ease` : "none"}}
${calm ? ".f:hover{transform:translateY(-3px)}" : ""}
.f svg{width:26px;height:26px;color:var(--acc);margin-bottom:calc(var(--sp)*1.5)}
.f h3{font-size:calc(var(--base)*1.12);margin-bottom:calc(var(--sp)*.8)}
.f p{color:var(--mut);font-size:calc(var(--base)*.95)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--sp)*2.4);counter-reset:st}
@media(max-width:760px){.steps{grid-template-columns:1fr}}
.st{border-top:${hardLine};padding-top:calc(var(--sp)*1.8);counter-increment:st}
.st b{display:block;color:var(--acc);font-size:calc(var(--base)*.8);letter-spacing:.2em;margin-bottom:calc(var(--sp)*1)}
.st b::after{content:"0" counter(st)}
.st h3{font-size:calc(var(--base)*1.1);margin-bottom:calc(var(--sp)*.6)}
.st p{color:var(--mut);font-size:calc(var(--base)*.92)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:calc(var(--sp)*2);border:${hardLine};border-radius:var(--r);padding:calc(var(--sp)*2.6)}
@media(max-width:760px){.stats{grid-template-columns:repeat(2,1fr)}}
.stat b{display:block;font-size:clamp(1.5rem,3.6vw,2.6rem);letter-spacing:-.03em;color:var(--acc)}
.stat span{color:var(--mut);font-size:calc(var(--base)*.9)}
.prods{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--sp)*2.2)}
@media(max-width:900px){.prods{grid-template-columns:repeat(2,1fr)}.feats{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.prods,.feats{grid-template-columns:1fr}}
.prod{border:${line};border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;transition:${calm ? `transform ${motion}ms ease` : "none"}}
${calm ? ".prod:hover{transform:translateY(-3px)}" : ""}
.prod-img{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;position:relative}
.prod-img svg{width:38%;height:38%;color:${isDark ? "rgba(255,255,255,.9)" : "rgba(0,0,0,.85)"}}
.prod-img::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,var(--pri),var(--sec))}
.prod-img i{position:absolute;top:4%;left:4%;z-index:2;background:var(--cta);color:var(--ctatx);font-style:normal;font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;padding:2.5% 4%;border-radius:var(--r)}
.prod{border-top:none}
.prod-body{padding:calc(var(--sp)*1.6);display:flex;justify-content:space-between;align-items:baseline;gap:var(--sp);border-top:${line}}
.prod-body h3{font-size:calc(var(--base)*1.02)}
.prod-body p{color:var(--acc);font-weight:800}
.quotes{display:grid;grid-template-columns:repeat(${single ? 1 : 3},1fr);gap:calc(var(--sp)*2)}
@media(max-width:900px){.quotes{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}}
.q{border:${line};border-radius:var(--r);padding:calc(var(--sp)*2.2);background:${cardBg};display:flex;flex-direction:column;gap:calc(var(--sp)*1.2)}
.q p{font-size:calc(var(--base)*1.02)}
.q footer{color:var(--mut);font-size:calc(var(--base)*.88)}
.q footer b{color:var(--tx)}
.q svg{width:18px;height:18px;color:var(--acc)}
.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--sp)*2);align-items:stretch}
@media(max-width:900px){.plans{grid-template-columns:1fr}.plans .pl:nth-child(1){order:3}}
.pl{border:${hardLine};border-radius:calc(var(--r)*1.2);padding:calc(var(--sp)*2.4);display:flex;flex-direction:column;gap:calc(var(--sp)*1.1);position:relative;background:${cardBg}}
.pl.hot{border-color:var(--acc);${shadows ? `box-shadow:0 0 0 1px var(--acc),${shadows}` : "box-shadow:0 0 0 1px var(--acc)"}}
.pl .tag{position:absolute;top:-13px;left:calc(var(--sp)*2);background:var(--cta);color:var(--ctatx);font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;padding:4px 10px;border-radius:var(--r)}
.pl h3{font-size:calc(var(--base)*1.05)}
.pl .price{font-size:clamp(1.9rem,4vw,2.6rem);letter-spacing:-.03em;display:flex;align-items:baseline;gap:6px}
.pl .price small{font-size:calc(var(--base)*.8);color:var(--mut);font-weight:600}
.pl ul{list-style:none;display:flex;flex-direction:column;gap:9px;margin:calc(var(--sp)*.6) 0 calc(var(--sp)*1)}
.pl li{display:flex;gap:9px;color:var(--mut);font-size:calc(var(--base)*.92)}
.pl li svg{width:15px;height:15px;color:var(--acc);flex:none;margin-top:2px}
.switch{display:flex;align-items:center;gap:calc(var(--sp)*1.2);margin:calc(var(--sp)*1.4) 0 calc(var(--sp)*2.6);font-size:calc(var(--base)*.9);color:var(--mut);font-weight:600}
.switch button{border:var(--bw) solid var(--line);background:transparent;color:var(--ghost);border-radius:var(--r);padding:6px 12px;font-family:inherit;font-weight:700;cursor:pointer;font-size:calc(var(--base)*.88)}
.switch button.on{background:var(--tx);color:var(--bg);border-color:var(--tx)}
details{border:${line};border-radius:var(--r);margin-bottom:calc(var(--sp)*1.2);overflow:hidden}
details summary{cursor:pointer;padding:calc(var(--sp)*1.4) calc(var(--sp)*1.8);font-weight:700;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:var(--sp)}
details summary::-webkit-details-marker{display:none}
details summary::after{content:"+";color:var(--mut);font-size:1.3em;line-height:1}
details[open] summary::after{content:"–"}
details p{padding:0 calc(var(--sp)*1.8) calc(var(--sp)*1.5);color:var(--mut)}
.cta{border:${hardLine};border-radius:calc(var(--r)*1.4);padding:calc(var(--sp)*5) calc(var(--sp)*3);text-align:center;position:relative;overflow:hidden;background:${cardBg}}
${isDark ? "" : ".cta{background:" + cardBg + "}"}
.cta h2{font-size:clamp(1.8rem,4.4vw,3rem);margin-bottom:calc(var(--sp)*1.2)}
.cta p{color:var(--mut);margin:0 auto calc(var(--sp)*2.2);max-width:46ch}
.cta .row{display:flex;gap:var(--sp);justify-content:center;flex-wrap:wrap}
footer{border-top:${line};padding:calc(var(--sp)*4) 0 calc(var(--sp)*3);color:var(--mut);font-size:calc(var(--base)*.9)}
.f-in{display:flex;justify-content:space-between;gap:var(--sp)*2;flex-wrap:wrap;align-items:baseline}
.f-in a{color:var(--mut);text-decoration:none;margin-left:var(--sp)*1.4}
.f-in a:hover{color:var(--tx)}
.heph{text-align:center;margin-top:calc(var(--sp)*2.6);font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.55}
.news{display:flex;gap:var(--sp);max-width:520px;margin:0 auto}
.news input{flex:1;background:transparent;border:var(--bw) solid var(--line);border-radius:var(--r);padding:calc(var(--sp)*1) calc(var(--sp)*1.4);color:var(--tx);font:inherit;outline:none}
.news input:focus{border-color:var(--tx)}
.okmsg{display:none;color:var(--acc);font-weight:700;margin-top:var(--sp);font-size:calc(var(--base)*.9)}
</style></head><body>`);

  /* ---------- nav ---------- */
  if (sectionOn("nav")) {
    push(`<nav><div class="wrap nav-in">
<a class="logo" href="#top"><i></i>${esc(c.brand)}</a>
<ul class="nav-links" id="${navId}-links">
${sectionOn("features") ? `<li><a href="#features">features</a></li>` : ""}
${sectionOn("how") ? `<li><a href="#how">how it works</a></li>` : ""}
${sectionOn("products") ? `<li><a href="#products">shop</a></li>` : ""}
${sectionOn("pricing") ? `<li><a href="#pricing">pricing</a></li>` : ""}
${sectionOn("faq") ? `<li><a href="#faq">faq</a></li>` : ""}
</ul>
<div class="nav-cta"><a class="btn btn-g" href="#cta">${esc(c.cta2.toLowerCase())}</a><a class="btn btn-p" href="#cta">${esc(c.cta)}</a>
<button class="burger" id="${navId}-burger" aria-label="menu">${icon("grid")}</button></div>
</div>
<ul class="menu" id="${navId}-menu">
<li><a href="#features">features</a></li>
<li><a href="#pricing">pricing</a></li>
<li><a href="#cta">${esc(c.cta)}</a></li>
</ul>
</nav>`);
    js.push(`document.getElementById('${navId}-burger').addEventListener('click',function(){document.getElementById('${navId}-menu').classList.toggle('open')});`);
  }

  /* ---------- hero ---------- */
  if (sectionOn("hero")) {
    const words = kinetic ? `<span style="--i:0">${esc(c.heroH.split(" ").slice(0, Math.ceil(c.heroH.split(" ").length / 2)).join(" "))}</span> ${esc(c.heroH.split(" ").slice(Math.ceil(c.heroH.split(" ").length / 2)).join(" "))}` : esc(c.heroH);
    push(`<header id="top" class="hero wrap">
<div>
  ${kinetic ? "" : `<div class="eyebrow">${esc(purpose.label)} · ${esc(purpose.group)}</div>`}
  <h1 class="h-hero ${kinetic ? "kinetic" : ""}">${words}</h1>
  <p class="lead">${esc(c.heroS)}</p>
  <div style="display:flex;gap:var(--sp);flex-wrap:wrap">
    <a class="btn btn-p" href="#cta">${esc(c.cta)} ${icon("arrow")}</a>
    ${sectionOn("pricing") || sectionOn("products") ? `<a class="btn btn-g" href="#${sectionOn("pricing") ? "pricing" : "products"}">${esc(c.cta2)}</a>` : ""}
  </div>
  <div class="points">${sectionOn("stats") ? `<b>${esc(c.stats[0].v)}</b> ${esc(c.stats[0].l)}` : ""}</div>
</div>
<div class="art"><div class="art-in">
  <div class="art-bar"><i></i><i></i><i></i><b></b></div>
  <div class="art-cards">
    <div class="a big"><i></i><u></u><u class="u2"></u></div>
    <div class="a"><i></i><u></u></div>
    <div class="a"><i></i><u></u></div>
  </div>
</div>
<div class="chip">${esc(c.brand.split(" ")[0]).toUpperCase()}</div>
</div>
</header>`);
  }

  /* ---------- proof strip ---------- */
  if (sectionOn("logos")) {
    push(`<section class="sec" style="padding-top:0"><div class="wrap"><div class="eyebrow" style="text-align:center">trusted by teams at</div>
<div class="logos">${c.logos.slice(0, 5).map((l) => `<div class="lg">${esc(l)}</div>`).join("")}</div></div></section>`);
  }

  /* ---------- features ---------- */
  if (sectionOn("features")) {
    push(`<section class="sec" id="features"><div class="wrap">
<div class="sec-head"><h2>Everything that matters, ${bento ? "nothing that doesn't" : "in one place"}</h2><p>${purpose.priorities.slice(0, 3).join(" · ")}</p></div>
<div class="feats">${c.feats.map((f) => `<div class="f">${icon(f.icon)}<h3>${esc(f.t)}</h3><p>${esc(f.d)}</p></div>`).join("")}</div>
</div></section>`);
  }

  /* ---------- how ---------- */
  if (sectionOn("how")) {
    push(`<section class="sec" id="how" style="padding-top:0"><div class="wrap">
<div class="sec-head"><h2>Three steps. No theatre.</h2><p>${esc(c.heroS.split(".")[0])}.</p></div>
<div class="steps">${c.how.map((h) => `<div class="st"><b></b><h3>${esc(h.t)}</h3><p>${esc(h.d)}</p></div>`).join("")}</div>
</div></section>`);
  }

  /* ---------- stats ---------- */
  if (sectionOn("stats")) {
    push(`<section class="sec" style="padding-top:0"><div class="wrap"><div class="stats">${c.stats.map((s) => `<div class="stat"><b>${esc(s.v)}</b><span>${esc(s.l)}</span></div>`).join("")}</div></div></section>`);
  }

  /* ---------- products / menu ---------- */
  if (sectionOn("products")) {
    const shop = purpose.group === "ecommerce";
    push(`<section class="sec" id="products"><div class="wrap">
<div class="sec-head"><h2>${shop ? "The edit" : "What's on offer"}</h2><p>${shop ? "Curated, tested, and backed by a thirty-day promise." : "Current offerings, honest prices."}</p></div>
<div class="prods">${c.products.map((p) => `<div class="prod"><div class="prod-img">${icon(purpose.group === "restaurant" ? "heart" : "bag")}<i>${esc(p.tag)}</i></div><div class="prod-body"><h3>${esc(p.name)}</h3><p>${esc(p.price)}</p></div></div>`).join("")}</div>
</div></section>`);
  }

  /* ---------- testimonials ---------- */
  if (sectionOn("testimonials")) {
    push(`<section class="sec" id="voices"><div class="wrap">
<div class="sec-head"><h2>People say it better</h2></div>
<div class="quotes">${c.quotes.map((q) => `<blockquote class="q">${icon("star")}<p>“${esc(q.q)}”</p><footer><b>${esc(q.a)}</b> · ${esc(q.r)}</footer></blockquote>`).join("")}</div>
</div></section>`);
  }

  /* ---------- pricing ---------- */
  if (sectionOn("pricing")) {
    push(`<section class="sec" id="pricing"><div class="wrap">
<div class="sec-head"><h2>Pricing that survives contact</h2><p>Free to start. Fair when you grow. No surprises on the invoice.</p></div>
<div class="switch"><span>monthly</span><button id="bill" class="on" type="button">monthly</button><button id="bill-y" type="button">yearly −17%</button><span>yearly</span></div>
<div class="plans">${c.plans.map((pl, i) => `<div class="pl ${i === 1 ? "hot" : ""}">${pl.tag ? `<span class="tag">${esc(pl.tag)}</span>` : ""}<h3>${esc(pl.name)}</h3>
<div class="price" data-m="${esc(pl.price)}" data-y="${esc(pl.yearly)}">${esc(pl.price)}<small>per month</small></div>
<ul>${pl.feats.map((f) => `<li>${icon("check")}${esc(f)}</li>`).join("")}</ul>
<a class="btn ${i === 1 ? "btn-p" : "btn-g"}" href="#cta">choose ${esc(pl.name.toLowerCase())}</a></div>`).join("")}
</div></div></section>`);
    js.push(`(function(){var m=document.querySelectorAll('.price'),b1=document.getElementById('bill'),b2=document.getElementById('bill-y');
b1.addEventListener('click',function(){b1.classList.add('on');b2.classList.remove('on');m.forEach(function(e){e.firstChild.textContent=e.dataset.m;})});
b2.addEventListener('click',function(){b2.classList.add('on');b1.classList.remove('on');m.forEach(function(e){e.firstChild.textContent=e.dataset.y;})});})();`);
  }

  /* ---------- faq ---------- */
  if (sectionOn("faq")) {
    push(`<section class="sec" id="faq"><div class="wrap">
<div class="sec-head"><h2>Asked early, answered straight</h2></div>
${c.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}
</div></section>`);
  }

  /* ---------- final cta ---------- */
  if (sectionOn("cta")) {
    push(`<section class="sec" id="cta"><div class="wrap"><div class="cta">
<h2>${esc(c.ctaH)}</h2><p>${esc(c.ctaS)}</p>
<div class="row"><a class="btn btn-p" href="#top">${esc(c.cta)}</a><a class="btn btn-g" href="#top">${esc(c.cta2)}</a></div>
</div></div></section>`);
  }

  /* ---------- footer ---------- */
  if (sectionOn("footer")) {
    push(`<footer><div class="wrap"><div class="f-in">
<span class="logo"><i></i>${esc(c.brand)}</span>
<nav style="display:flex;flex-wrap:wrap">
<a href="#features">features</a>
${sectionOn("pricing") ? `<a href="#pricing">pricing</a>` : ""}
<a href="#cta">contact</a>
</nav>
</div><div class="heph">forged with hephaestus</div></div></footer>`);
  }

  push(`<script>${js.join("\n")}<\/script></body></html>`);

  return { html: H.join("\n"), sections };
}

/** Which sections a purpose gets by default, derived from its own brief. */
export function defaultSections(p: Purpose): SiteSection[] {
  const g = p.group;
  const s = p.sections.join(" ").toLowerCase();
  const set = new Set<SiteSection>(["nav", "hero", "footer"]);
  const add = (...x: SiteSection[]) => x.forEach((i) => set.add(i));

  if (/market|commer|shop|store|realestate|hotel|restaurant|menu|host/.test(s) || g === "ecommerce" || g === "marketplace") {
    add("products");
  } else {
    add("features");
  }
  if (/logo|proof|trust|social|clients/.test(s) || ["saas", "product", "tools", "docs", "ecommerce", "marketplace"].includes(g)) add("logos");
  if (/how|process|works|steps|method/.test(s) || ["saas", "product", "tools", "agency", "brand"].includes(g)) add("how");
  if (/impact|number|stat|metric|kpi|proof|result/.test(s) || ["finance", "saas", "health", "education", "gaming", "wellness", "nonprofit"].includes(g)) add("stats");
  if (/testimonial|review|quote|social proof|voice/.test(s) || ["saas", "ecommerce", "marketplace", "health", "wellness", "product", "realestate"].includes(g)) add("testimonials");
  if (/pricing|price|plan|ticket|edition|billing|course/.test(s) || ["saas", "product", "tools", "education", "event", "gaming", "media"].includes(g)) add("pricing");
  if (/faq|question/.test(s) || ["saas", "ecommerce", "marketplace", "product", "health", "wellness", "realestate", "docs"].includes(g)) add("faq");
  if (!["editorial", "docs", "internal", "personal", "media", "gaming"].includes(g)) add("cta");

  // keep order sane
  const order: SiteSection[] = ["nav", "hero", "logos", "products", "features", "how", "stats", "testimonials", "pricing", "faq", "cta", "footer"];
  return order.filter((i) => set.has(i));
}

export function demoPurpose(): Purpose | undefined {
  return getPurpose("saas-landing");
}
