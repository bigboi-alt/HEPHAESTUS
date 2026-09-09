/**
 * HEPHAESTUS · trend intelligence
 *
 * Two layers, because "know the latest trends" and "have infinite ideas"
 * are different problems:
 *
 *  1. TRENDS  — a curated, versioned, human-verified library of what is
 *     actually happening in 2026 UI. Ships offline, refreshable from a
 *     remote JSON you control (see lib/trendSync.ts).
 *  2. ATOMS   — the trends decomposed into interchangeable parts. Layout x
 *     type x colour behaviour x motion x surface x interaction, filtered by
 *     compatibility, recombine into a direction space of millions. That's
 *     where the endless ideas come from — not from a model, from combinatorics.
 */

export const TRENDS_VERSION = 3;
export const TRENDS_UPDATED = "2026-09";

export type TrendStatus = "core" | "rising" | "polarizing" | "cooling";

export type Trend = {
  id: string;
  name: string;
  status: TrendStatus;
  since: string;
  summary: string;
  signals: string[];
  useWhen: string[];
  avoidWhen: string[];
  rules: {
    chroma?: [number, number];
    contrastMin?: number;
    radius?: [number, number];
    borderWeight?: [number, number];
    density?: "airy" | "balanced" | "dense";
    modeBias?: "dark" | "light" | "either";
    typeScale?: [number, number];
    motion?: "none" | "restrained" | "expressive";
  };
  recipe: string;
  tags: string[];
};

export const TRENDS: Trend[] = [
  {
    id: "bento",
    name: "Bento Grid",
    status: "core",
    since: "2023",
    summary:
      "Asymmetric modular tiles of varying span that give content natural weight instead of a uniform 12-column march. Settled into the default layout language for product and feature pages.",
    signals: ["mixed tile spans", "one hero tile", "consistent gutters", "rounded containers", "content-first tiles"],
    useWhen: ["feature overviews", "product landing pages", "dashboards", "anything with 5-9 unequal ideas"],
    avoidWhen: ["long-form reading", "single linear task flows", "under 4 content blocks"],
    rules: { radius: [8, 20], density: "balanced", modeBias: "either", motion: "restrained" },
    recipe: "grid-template-columns: repeat(6, 1fr); tiles span 2-4 cols, 1-2 rows; gap 12-20px; one tile at 2x scale carries the headline.",
    tags: ["layout", "modular", "product"],
  },
  {
    id: "active-bento",
    name: "Active Bento",
    status: "rising",
    since: "2026",
    summary:
      "Bento's second act: tiles stop being static. Hover expands a tile, reveals a second data layer, or plays a muted loop. Grid as interface, not decoration.",
    signals: ["hover-expand tiles", "inline video tiles", "variable aspect ratios", "tall cards on mobile"],
    useWhen: ["feature pages that must demo, not describe", "dense product marketing"],
    avoidWhen: ["performance-critical pages", "touch-only flows with no hover"],
    rules: { radius: [10, 22], density: "balanced", motion: "expressive", modeBias: "either" },
    recipe: "Base bento + transform: scale(1.02) and a revealed detail layer on hover, 180-220ms ease-out. Never reflow siblings.",
    tags: ["layout", "motion", "interaction"],
  },
  {
    id: "calm-ui",
    name: "Calm Interfaces",
    status: "core",
    since: "2025",
    summary:
      "The correction to motion theatrics. Fewer competing signals, generous rest space, animation reserved for state change. Reads as confidence rather than effort.",
    signals: ["restrained motion", "muted secondary text", "one accent only", "large whitespace", "no decorative gradients"],
    useWhen: ["SaaS dashboards used daily", "healthcare", "banking", "content-heavy products"],
    avoidWhen: ["campaign microsites", "brands competing on personality"],
    rules: { chroma: [0.02, 0.12], contrastMin: 4.5, density: "airy", motion: "restrained", modeBias: "either" },
    recipe: "One accent hue at most. Everything else neutral with <0.03 chroma. Motion budget: 2 animated properties per screen.",
    tags: ["philosophy", "motion", "color"],
  },
  {
    id: "neo-brutalism",
    name: "Neo-Brutalism / Anti-Design",
    status: "polarizing",
    since: "2022",
    summary:
      "Raw, unpolished, deliberately loud. Hard borders, offset shadows, visible grids, monospace, colours that fight. Reads as honest and unmarketed — or as amateur, depending on execution.",
    signals: ["2-4px hard borders", "0 or 2px radius", "flat offset shadows", "monospace type", "high-chroma clashes"],
    useWhen: ["dev tools", "indie products", "portfolios", "brands that need to not look like everyone else"],
    avoidWhen: ["enterprise procurement", "finance", "healthcare", "anything trust-critical"],
    rules: { chroma: [0.15, 0.34], contrastMin: 7, radius: [0, 4], borderWeight: [2, 4], density: "dense", motion: "none" },
    recipe: "border: 3px solid text; box-shadow: 5px 5px 0 text; radius 0-2px; no gradients; monospace or grotesque at heavy weights.",
    tags: ["aesthetic", "typography", "color"],
  },
  {
    id: "soft-brutalism",
    name: "Soft Brutalism",
    status: "rising",
    since: "2026",
    summary:
      "Brutalism's structure with the hostility removed. Visible grid lines and bold borders, but friendly neo-grotesque type, muted pastels and real whitespace. The usable version.",
    signals: ["visible grid rules", "1-2px borders", "sage/butter/clay pastels", "generous padding", "large plain headings"],
    useWhen: ["indie SaaS", "editorial", "studios", "products wanting character without risk"],
    avoidWhen: ["ultra-conservative sectors", "dense data tables"],
    rules: { chroma: [0.05, 0.14], contrastMin: 4.5, radius: [2, 8], borderWeight: [1, 2], density: "airy", motion: "restrained" },
    recipe: "Muted pastel base, 1.5px borders on every container, 32-48px padding, headings at 600 weight not 800.",
    tags: ["aesthetic", "layout", "color"],
  },
  {
    id: "dark-default",
    name: "Dark Mode as Default",
    status: "core",
    since: "2024",
    summary:
      "Dark is the designed-first theme and light is the port, not the reverse. Driven by OLED energy use, long working sessions, and developer-tool aesthetics leaking into everything.",
    signals: ["#0A-#16 backgrounds not pure black", "elevation by lightness not shadow", "desaturated accents"],
    useWhen: ["dev tools", "media", "long-session apps", "anything with a terminal adjacency"],
    avoidWhen: ["print-adjacent editorial", "heavy long-form reading", "medical imaging"],
    rules: { chroma: [0.04, 0.2], contrastMin: 7, modeBias: "dark", density: "balanced" },
    recipe: "Background L 0.10-0.16 with 0.005-0.02 chroma of the brand hue. Elevate surfaces by +0.04 L, never by shadow alone.",
    tags: ["color", "theme", "accessibility"],
  },
  {
    id: "kinetic-type",
    name: "Kinetic Typography",
    status: "polarizing",
    since: "2025",
    summary:
      "Type that moves, stretches, or responds — variable font axes driven by scroll, hover or cursor. High impact on a hero, exhausting anywhere else.",
    signals: ["variable font weight on scroll", "oversized headlines", "letter-by-letter reveals", "marquee bands"],
    useWhen: ["hero sections", "portfolios", "brand statement pages", "launch microsites"],
    avoidWhen: ["body copy", "dashboards", "anything read more than once"],
    rules: { typeScale: [1.333, 1.618], motion: "expressive", density: "airy" },
    recipe: "One variable font, animate wght 400->700 across scroll on the hero only. prefers-reduced-motion must kill it entirely.",
    tags: ["typography", "motion"],
  },
  {
    id: "bold-type",
    name: "Typographic Hierarchy as Layout",
    status: "core",
    since: "2024",
    summary:
      "Scale does the work images used to. Oversized headlines against small dense body text create hierarchy with nothing but type — cheap, fast, and impossible to get wrong at the performance level.",
    signals: ["clamp() hero type", "4-6x size ratio head to body", "tight heading tracking", "one typeface, many weights"],
    useWhen: ["almost everything", "text-first products", "low-asset budgets"],
    avoidWhen: ["never really — only the ratio changes"],
    rules: { typeScale: [1.25, 1.5], contrastMin: 4.5, density: "balanced" },
    recipe: "clamp(2.5rem, 6vw, 5.5rem) headline, 1rem body, -0.02em heading tracking, 1.6 body line-height.",
    tags: ["typography", "layout"],
  },
  {
    id: "liquid-glass",
    name: "Liquid Glass / Evolved Glassmorphism",
    status: "rising",
    since: "2026",
    summary:
      "Translucency with dynamic, scroll-reactive blur — depth used to signal layering (nav, modal, overlay) rather than as surface decoration. Apple's 2025 language pushed it mainstream.",
    signals: ["backdrop-filter blur 12-24px", "1px light border on glass", "content visibly moving beneath", "no glass on glass"],
    useWhen: ["sticky navigation", "modals", "floating toolbars", "media-rich backdrops"],
    avoidWhen: ["flat backgrounds where there is nothing to blur", "low-end devices", "text-heavy panels"],
    rules: { radius: [12, 28], contrastMin: 4.5, motion: "restrained", modeBias: "either" },
    recipe: "background: color-mix(in oklab, surface 62%, transparent); backdrop-filter: blur(18px) saturate(1.4); border-top: 1px solid rgba(255,255,255,.14).",
    tags: ["surface", "depth", "navigation"],
  },
  {
    id: "spatial-depth",
    name: "Spatial Depth",
    status: "rising",
    since: "2026",
    summary:
      "Layered cards, coloured diffuse shadows and physics-correct parallax that read as depth without a headset. Foreground snaps, background drifts.",
    signals: ["coloured soft shadows", "layered stacked cards", "differential scroll speeds", "3D product previews"],
    useWhen: ["product showcases", "mobile-first marketing", "commerce detail pages"],
    avoidWhen: ["dense admin UI", "accessibility-critical flows", "tight performance budgets"],
    rules: { radius: [12, 24], motion: "expressive", density: "airy" },
    recipe: "box-shadow: 0 18px 40px -12px color-mix(in oklab, accent 35%, transparent). Parallax deltas under 12% of viewport.",
    tags: ["depth", "motion", "surface"],
  },
  {
    id: "functional-micro",
    name: "Functional Micro-interactions",
    status: "core",
    since: "2024",
    summary:
      "Motion that reports state — validation, progress, success, undo — instead of motion that decorates. The 2026 filter: if removing it loses no information, remove it.",
    signals: ["inline field validation", "optimistic UI", "success morphs not toasts", "skeletons that match final layout"],
    useWhen: ["forms", "checkout", "settings", "any destructive action"],
    avoidWhen: ["purely decorative surfaces"],
    rules: { motion: "restrained", contrastMin: 4.5 },
    recipe: "120-220ms, ease-out entering, ease-in leaving. Only transform + opacity. Every animation reports a state change.",
    tags: ["motion", "interaction", "forms"],
  },
  {
    id: "a11y-first",
    name: "Accessibility-First Systems",
    status: "core",
    since: "2025",
    summary:
      "Contrast, focus order, target size and reduced-motion designed at token level, not patched at audit. Now legally enforced in the EU (EAA) with rising litigation in the US.",
    signals: ["4.5:1 minimum body contrast", "visible focus rings", "44px+ targets", "prefers-reduced-motion honoured", "no colour-only meaning"],
    useWhen: ["everything, without exception"],
    avoidWhen: [],
    rules: { contrastMin: 4.5, density: "balanced", motion: "restrained" },
    recipe: "Bake AA into the palette tokens. Focus ring: 2px solid accent, 2px offset. Never encode state in hue alone — pair with icon or text.",
    tags: ["accessibility", "system", "legal"],
  },
  {
    id: "design-tokens",
    name: "Token-Based Design Systems",
    status: "core",
    since: "2023",
    summary:
      "Colour, spacing, radius, type and motion live as named tokens with semantic aliases. The unglamorous trend that every other trend depends on to ship.",
    signals: ["semantic aliases over raw hex", "spacing scale of 4 or 8", "one radius scale", "theme swap by token override"],
    useWhen: ["any product that will outlive one redesign"],
    avoidWhen: ["one-off campaign pages"],
    rules: { density: "balanced" },
    recipe: "primitive (blue-600) -> semantic (--action-bg) -> component (--button-bg). Components never reference primitives.",
    tags: ["system", "engineering"],
  },
  {
    id: "saturated-color",
    name: "Saturated Colour + Strategic Neutral",
    status: "core",
    since: "2025",
    summary:
      "Muted-everything is over. One or two genuinely loud colours carried by a big neutral base. The restraint is in the ratio, not the saturation.",
    signals: ["one high-chroma accent", "90% neutral surface area", "mesh gradients", "high-contrast pairings"],
    useWhen: ["lifestyle", "youth brands", "consumer apps", "launches"],
    avoidWhen: ["dense data UI", "conservative B2B"],
    rules: { chroma: [0.18, 0.33], contrastMin: 4.5, density: "airy" },
    recipe: "Accent chroma > 0.18, used on <10% of pixels. Everything else under 0.03 chroma.",
    tags: ["color"],
  },
  {
    id: "experimental-nav",
    name: "Experimental Navigation",
    status: "polarizing",
    since: "2025",
    summary:
      "Radial menus, drawers, nonlinear maps, scroll-as-journey. Memorable when the content is the experience, hostile when the user came to do a job.",
    signals: ["no visible top nav", "drawer or overlay menu", "spatial/map navigation", "scroll-driven chapters"],
    useWhen: ["portfolios", "editorial features", "brand experiences", "award submissions"],
    avoidWhen: ["commerce", "SaaS", "support", "anything with a conversion funnel"],
    rules: { motion: "expressive", density: "airy" },
    recipe: "If you hide the nav, guarantee a persistent escape hatch and keyboard access to every destination.",
    tags: ["navigation", "layout"],
  },
  {
    id: "data-storytelling",
    name: "Minimalist Data Storytelling",
    status: "rising",
    since: "2026",
    summary:
      "Charts stripped to one message each, with the insight written in plain language beside the visual. Fewer axes, more sentences.",
    signals: ["no chart junk", "direct labels over legends", "one insight per chart", "sparklines in tables"],
    useWhen: ["analytics", "fintech", "reporting", "dashboards"],
    avoidWhen: ["exploratory analysis tools needing full control"],
    rules: { chroma: [0.06, 0.2], contrastMin: 4.5, density: "balanced" },
    recipe: "Max 4 series per chart. Label lines directly. Grey everything except the series being discussed.",
    tags: ["data", "layout", "content"],
  },
  {
    id: "quiet-trust",
    name: "Quiet Trust / Passkey-First",
    status: "rising",
    since: "2026",
    summary:
      "Authentication and consent designed to disappear: passkeys, device trust, progressive disclosure of permissions. Friction removed without hiding what is happening.",
    signals: ["passkey primary, password secondary", "no forced signup before value", "plain-language permission copy"],
    useWhen: ["onboarding", "checkout", "any account creation"],
    avoidWhen: ["nothing — this is a floor, not a ceiling"],
    rules: { density: "airy", contrastMin: 4.5, motion: "restrained" },
    recipe: "Show value before the wall. One primary auth path, everything else behind 'other ways to sign in'.",
    tags: ["ux", "onboarding", "trust"],
  },
  {
    id: "sustainable",
    name: "Sustainable / Performance-First Design",
    status: "rising",
    since: "2025",
    summary:
      "Design decisions scored by payload. SVG over raster, system fonts or one variable font, dark themes on OLED, no autoplay video above the fold.",
    signals: ["under 500KB pages", "one webfont", "SVG illustration", "no hero video", "lazy everything below fold"],
    useWhen: ["all production sites", "emerging-market audiences", "mobile-heavy traffic"],
    avoidWhen: [],
    rules: { motion: "restrained", density: "balanced" },
    recipe: "Budget: 1 font file, <150KB JS, SVG icons inline, images AVIF with width hints. Measure on a throttled 4G profile.",
    tags: ["performance", "sustainability"],
  },
  {
    id: "retrofuturism",
    name: "Retrofuturism",
    status: "polarizing",
    since: "2024",
    summary:
      "Neon on near-black, chrome, scanlines, pixel type, gradient horizons. Vintage optimism about the future, deployed as personality.",
    signals: ["neon accents on dark", "chrome or gradient text", "grain overlay", "monospace/pixel type"],
    useWhen: ["music", "gaming", "portfolios", "entertainment", "crypto-adjacent"],
    avoidWhen: ["finance", "healthcare", "enterprise", "anything needing sobriety"],
    rules: { chroma: [0.18, 0.32], contrastMin: 4.5, modeBias: "dark", motion: "expressive", radius: [0, 8] },
    recipe: "Near-black base, 2 neon accents max, 4% grain overlay, glow via layered box-shadow not filter.",
    tags: ["aesthetic", "color", "nostalgia"],
  },
  {
    id: "gamified-onboarding",
    name: "Gamified Progress",
    status: "cooling",
    since: "2023",
    summary:
      "Streaks, progress rings, completion states applied to onboarding and setup. Works for habit products, feels manipulative when bolted onto tools.",
    signals: ["progress rings", "checklists with celebration", "streak counters", "unlock states"],
    useWhen: ["habit apps", "learning", "fitness", "multi-step setup"],
    avoidWhen: ["professional tools", "one-time transactions"],
    rules: { motion: "expressive", chroma: [0.12, 0.28] },
    recipe: "Only gamify things the user already wanted to finish. Never invent a streak for a task done once.",
    tags: ["engagement", "onboarding"],
  },
];

/* ------------------------------------------------------------------ *
 * ATOMS — the recombination space
 * ------------------------------------------------------------------ */

export type Atom = {
  id: string;
  label: string;
  note: string;
  from: string[];      // trend ids it derives from
  fits: string[];      // purpose groups it suits
  conflicts?: string[]; // atom ids it must not combine with
};

export const LAYOUT_ATOMS: Atom[] = [
  { id: "bento-6", label: "6-col bento", note: "Asymmetric tiles, one 2x hero tile.", from: ["bento"], fits: ["saas", "product", "portfolio", "media"] },
  { id: "bento-active", label: "active bento", note: "Tiles expand and reveal a second layer on hover.", from: ["active-bento"], fits: ["saas", "product", "media"], conflicts: ["motion-none"] },
  { id: "split-hero", label: "split hero", note: "50/50 statement left, live artefact right.", from: ["bold-type"], fits: ["saas", "product", "finance"] },
  { id: "single-column", label: "single column", note: "One 68ch measure, everything stacked.", from: ["calm-ui", "sustainable"], fits: ["editorial", "docs", "personal"] },
  { id: "sidebar-shell", label: "sidebar shell", note: "Persistent left rail, dense content pane.", from: ["design-tokens"], fits: ["saas", "internal", "finance"] },
  { id: "grid-rules", label: "exposed grid", note: "Visible hairlines between every region.", from: ["soft-brutalism", "neo-brutalism"], fits: ["portfolio", "editorial", "product"] },
  { id: "scroll-chapters", label: "scroll chapters", note: "Full-height sections that snap as chapters.", from: ["experimental-nav"], fits: ["portfolio", "media", "brand"], conflicts: ["motion-none"] },
  { id: "catalogue-grid", label: "catalogue grid", note: "Uniform cards, filter rail, dense pagination.", from: ["design-tokens"], fits: ["ecommerce", "media", "marketplace"] },
  { id: "canvas-workspace", label: "canvas workspace", note: "Infinite surface, floating tool clusters.", from: ["liquid-glass", "spatial-depth"], fits: ["tools", "saas"] },
  { id: "dashboard-cards", label: "metric cards + table", note: "KPI row above a dense sortable table.", from: ["data-storytelling"], fits: ["finance", "saas", "internal"] },
];

export const TYPE_ATOMS: Atom[] = [
  { id: "type-giant", label: "giant grotesque", note: "clamp() headline at 5-6x body, tight tracking.", from: ["bold-type"], fits: ["portfolio", "brand", "product", "media"] },
  { id: "type-mono", label: "monospace system", note: "Mono for everything, including headings.", from: ["neo-brutalism"], fits: ["tools", "saas", "personal"] },
  { id: "type-serif-body", label: "serif body", note: "Serif for reading, sans for UI chrome.", from: ["bold-type"], fits: ["editorial", "finance", "brand"] },
  { id: "type-compact", label: "compact UI", note: "13-14px base, 1.45 line-height, dense labels.", from: ["design-tokens"], fits: ["saas", "internal", "finance", "tools"] },
  { id: "type-kinetic", label: "kinetic hero", note: "Variable weight animated on scroll, hero only.", from: ["kinetic-type"], fits: ["portfolio", "brand", "media"], conflicts: ["motion-none"] },
  { id: "type-humanist", label: "humanist warm", note: "Rounded sans, generous line-height, soft rhythm.", from: ["soft-brutalism", "calm-ui"], fits: ["wellness", "education", "personal", "ecommerce"] },
];

export const COLOR_ATOMS: Atom[] = [
  { id: "color-mono-accent", label: "neutral + one accent", note: "90% neutral surface, single loud accent.", from: ["calm-ui", "saturated-color"], fits: ["saas", "finance", "editorial", "tools"] },
  { id: "color-duotone", label: "duotone tension", note: "Two hues at opposite temperature, no third.", from: ["saturated-color"], fits: ["brand", "media", "portfolio"] },
  { id: "color-earth", label: "earthbound", note: "Clay, sage, oat; chroma under 0.10 throughout.", from: ["soft-brutalism"], fits: ["wellness", "ecommerce", "personal", "brand"] },
  { id: "color-neon-dark", label: "neon on near-black", note: "Two neons max on an L 0.12 base.", from: ["retrofuturism", "dark-default"], fits: ["media", "tools", "portfolio", "gaming"] },
  { id: "color-clinical", label: "clinical cool", note: "Blue-teal narrow band, high contrast, no warmth.", from: ["a11y-first", "calm-ui"], fits: ["health", "finance", "internal"] },
  { id: "color-high-chroma", label: "dopamine", note: "3+ saturated hues in deliberate collision.", from: ["saturated-color", "neo-brutalism"], fits: ["brand", "ecommerce", "education", "gaming"] },
];

export const SURFACE_ATOMS: Atom[] = [
  { id: "surf-flat", label: "flat + hairline", note: "No shadows anywhere; 1px borders define everything.", from: ["calm-ui", "sustainable"], fits: ["saas", "tools", "editorial", "finance"] },
  { id: "surf-glass", label: "glass chrome", note: "Blur on nav and modals only; content stays opaque.", from: ["liquid-glass"], fits: ["product", "media", "saas"] },
  { id: "surf-hard", label: "hard shadow", note: "Flat offset shadow, no blur, 0-2px radius.", from: ["neo-brutalism"], fits: ["portfolio", "tools", "personal"] },
  { id: "surf-elevated", label: "coloured elevation", note: "Diffuse accent-tinted shadows for depth.", from: ["spatial-depth"], fits: ["ecommerce", "product", "wellness"] },
  { id: "surf-paper", label: "paper", note: "Warm off-white, subtle grain, no elevation.", from: ["sustainable", "soft-brutalism"], fits: ["editorial", "personal", "brand"] },
];

export const MOTION_ATOMS: Atom[] = [
  { id: "motion-none", label: "static", note: "No animation beyond instant state change.", from: ["neo-brutalism", "sustainable"], fits: ["tools", "internal", "editorial"] },
  { id: "motion-state", label: "state-only", note: "120-220ms transform/opacity, on state change only.", from: ["functional-micro", "calm-ui"], fits: ["saas", "finance", "health", "ecommerce"] },
  { id: "motion-scroll", label: "scroll-driven", note: "Reveals and parallax tied to scroll position.", from: ["spatial-depth", "kinetic-type"], fits: ["portfolio", "brand", "media"] },
  { id: "motion-physical", label: "spring physics", note: "Spring easing on drag, drop and reorder.", from: ["spatial-depth", "active-bento"], fits: ["tools", "product", "gaming"] },
];

export const INTERACTION_ATOMS: Atom[] = [
  { id: "int-command", label: "command palette", note: "Cmd-K as the primary navigation surface.", from: ["design-tokens"], fits: ["saas", "tools", "internal"] },
  { id: "int-progressive", label: "progressive disclosure", note: "One decision per screen, advanced behind a fold.", from: ["quiet-trust", "calm-ui"], fits: ["finance", "health", "saas", "education"] },
  { id: "int-direct", label: "direct manipulation", note: "Drag, resize and edit in place, no modal forms.", from: ["active-bento"], fits: ["tools", "product"] },
  { id: "int-inline-validate", label: "inline validation", note: "Field-level feedback the moment it can be known.", from: ["functional-micro"], fits: ["ecommerce", "finance", "saas", "health"] },
  { id: "int-guided", label: "guided path", note: "Numbered steps with a persistent progress spine.", from: ["gamified-onboarding", "quiet-trust"], fits: ["education", "health", "finance"] },
];

export const ATOM_GROUPS = {
  layout: LAYOUT_ATOMS,
  type: TYPE_ATOMS,
  color: COLOR_ATOMS,
  surface: SURFACE_ATOMS,
  motion: MOTION_ATOMS,
  interaction: INTERACTION_ATOMS,
} as const;

export type AtomGroup = keyof typeof ATOM_GROUPS;

/** Raw combination count before compatibility filtering. */
export const DIRECTION_SPACE = Object.values(ATOM_GROUPS).reduce(
  (n, g) => n * g.length,
  1
);

/* ------------------------------------------------------------------ *
 * PURPOSES — "what are you building?"
 * ------------------------------------------------------------------ */

export type Purpose = {
  id: string;
  label: string;
  group: string;
  brief: string;
  priorities: string[];
  sections: string[];
  favours: string[];   // trend ids
  resists: string[];   // trend ids
  moodId?: string;
  contrastFloor: number;
};

export const PURPOSES: Purpose[] = [
  { id: "saas-landing", label: "SaaS landing page", group: "saas", brief: "Convince a technical buyer in 40 seconds, then get them to a trial.", priorities: ["clear value proposition", "proof over adjectives", "one dominant CTA", "fast first paint"], sections: ["hero + single CTA", "logo proof strip", "3-5 feature bento", "how it works", "pricing preview", "FAQ", "footer CTA"], favours: ["bento", "bold-type", "calm-ui", "design-tokens"], resists: ["experimental-nav", "retrofuturism"], moodId: "trustworthy", contrastFloor: 4.5 },
  { id: "saas-dashboard", label: "SaaS dashboard", group: "saas", brief: "A surface someone stares at for six hours a day without fatigue.", priorities: ["information density without noise", "scannable hierarchy", "keyboard-first", "calm colour"], sections: ["sidebar nav", "KPI row", "primary table or chart", "detail drawer", "empty states", "settings"], favours: ["calm-ui", "data-storytelling", "design-tokens", "a11y-first"], resists: ["kinetic-type", "retrofuturism", "experimental-nav"], moodId: "technical", contrastFloor: 7 },
  { id: "fintech-app", label: "Fintech / banking", group: "finance", brief: "Move money without ever making the user feel uncertain.", priorities: ["trust signals", "no ambiguity in numbers", "confirmation before irreversibility", "AA+ contrast"], sections: ["balance summary", "transaction list", "transfer flow", "confirmation + receipt", "security settings"], favours: ["quiet-trust", "a11y-first", "data-storytelling", "calm-ui"], resists: ["neo-brutalism", "retrofuturism", "experimental-nav", "gamified-onboarding"], moodId: "trustworthy", contrastFloor: 7 },
  { id: "investing", label: "Investing / trading", group: "finance", brief: "Dense real-time data that stays readable under stress.", priorities: ["number legibility", "green/red never alone", "latency perception", "dark theme first"], sections: ["watchlist", "chart workspace", "order ticket", "positions table", "alerts"], favours: ["dark-default", "data-storytelling", "design-tokens", "a11y-first"], resists: ["kinetic-type", "experimental-nav"], moodId: "technical", contrastFloor: 7 },
  { id: "ecommerce", label: "E-commerce store", group: "ecommerce", brief: "Get a stranger from browse to paid with no unanswered question.", priorities: ["product imagery first", "price and stock always visible", "frictionless checkout", "mobile thumb reach"], sections: ["category grid", "product detail", "cart drawer", "checkout", "order confirmation", "returns info"], favours: ["spatial-depth", "functional-micro", "saturated-color", "quiet-trust"], resists: ["experimental-nav", "neo-brutalism"], contrastFloor: 4.5 },
  { id: "marketplace", label: "Marketplace", group: "marketplace", brief: "Two-sided trust: buyers must believe sellers, sellers must believe payouts.", priorities: ["search and filter quality", "reputation surfaces", "clear fee disclosure"], sections: ["search results", "listing detail", "seller profile", "messaging", "payout dashboard"], favours: ["design-tokens", "a11y-first", "functional-micro"], resists: ["retrofuturism", "kinetic-type"], contrastFloor: 4.5 },
  { id: "portfolio", label: "Portfolio", group: "portfolio", brief: "Be memorable in eight seconds and legible in eighty.", priorities: ["personality", "work above bio", "fast load despite imagery"], sections: ["statement hero", "selected work", "case study detail", "about", "contact"], favours: ["bold-type", "kinetic-type", "experimental-nav", "neo-brutalism"], resists: ["calm-ui"], contrastFloor: 4.5 },
  { id: "agency", label: "Agency / studio", group: "brand", brief: "Prove taste through the site itself; the site is the case study.", priorities: ["craft signals", "case study depth", "one memorable interaction"], sections: ["hero statement", "client logos", "case grid", "process", "team", "enquiry form"], favours: ["bold-type", "spatial-depth", "grid-rules", "liquid-glass"], resists: ["gamified-onboarding"], contrastFloor: 4.5 },
  { id: "editorial", label: "Editorial / blog", group: "editorial", brief: "Make long reading effortless and everything else invisible.", priorities: ["measure and rhythm", "reading contrast", "no layout shift", "clear article hierarchy"], sections: ["index", "article", "author", "archive", "newsletter capture"], favours: ["bold-type", "sustainable", "calm-ui", "a11y-first"], resists: ["kinetic-type", "liquid-glass", "spatial-depth"], moodId: "editorial", contrastFloor: 7 },
  { id: "docs", label: "Documentation", group: "docs", brief: "Answer the question in under three interactions.", priorities: ["search first", "code legibility", "persistent structure", "copy buttons everywhere"], sections: ["sidebar tree", "article body", "code samples", "on-page TOC", "version switcher"], favours: ["design-tokens", "sustainable", "a11y-first", "dark-default"], resists: ["kinetic-type", "experimental-nav", "spatial-depth"], moodId: "technical", contrastFloor: 7 },
  { id: "devtool", label: "Developer tool", group: "tools", brief: "Earn credibility with engineers who distrust marketing.", priorities: ["show the code immediately", "no fluff copy", "terminal-adjacent aesthetic", "keyboard everything"], sections: ["hero with live snippet", "install block", "feature grid", "benchmarks", "docs link", "GitHub proof"], favours: ["dark-default", "neo-brutalism", "design-tokens", "sustainable"], resists: ["gamified-onboarding", "spatial-depth"], moodId: "technical", contrastFloor: 7 },
  { id: "ai-product", label: "AI product", group: "product", brief: "Make a probabilistic system feel controllable and honest.", priorities: ["show provenance", "editable output", "graceful failure", "explicit cost/limits"], sections: ["prompt surface", "streaming output", "history", "settings/limits", "pricing"], favours: ["calm-ui", "liquid-glass", "functional-micro", "design-tokens"], resists: ["gamified-onboarding"], contrastFloor: 4.5 },
  { id: "health", label: "Health / medical", group: "health", brief: "Reduce anxiety while conveying clinical seriousness.", priorities: ["plain language", "no colour-only meaning", "large targets", "privacy visible"], sections: ["symptom or service entry", "provider list", "booking flow", "records", "consent screens"], favours: ["a11y-first", "calm-ui", "quiet-trust"], resists: ["neo-brutalism", "retrofuturism", "kinetic-type"], moodId: "clinical", contrastFloor: 7 },
  { id: "education", label: "Education / course", group: "education", brief: "Sustain attention across sessions without cheapening the material.", priorities: ["progress visibility", "chunked lessons", "resumable state"], sections: ["course catalogue", "syllabus", "lesson player", "progress dashboard", "certificate"], favours: ["gamified-onboarding", "functional-micro", "a11y-first", "bold-type"], resists: ["experimental-nav"], contrastFloor: 4.5 },
  { id: "wellness", label: "Wellness / fitness", group: "wellness", brief: "Feel human and encouraging, never clinical or punishing.", priorities: ["warm palette", "generous space", "streaks without guilt"], sections: ["today view", "programme browser", "session player", "progress", "profile"], favours: ["soft-brutalism", "calm-ui", "spatial-depth", "gamified-onboarding"], resists: ["neo-brutalism", "dark-default"], moodId: "organic", contrastFloor: 4.5 },
  { id: "restaurant", label: "Restaurant / hospitality", group: "brand", brief: "Communicate atmosphere, then make booking trivial.", priorities: ["photography", "menu legibility", "booking in two taps", "location clarity"], sections: ["atmosphere hero", "menu", "booking", "hours + map", "gallery"], favours: ["bold-type", "spatial-depth", "sustainable"], resists: ["design-tokens", "data-storytelling"], contrastFloor: 4.5 },
  { id: "realestate", label: "Real estate", group: "marketplace", brief: "Big-ticket browsing that has to feel credible and searchable.", priorities: ["map + list parity", "photo quality", "filter precision", "agent trust"], sections: ["search with map", "listing detail", "gallery", "mortgage calculator", "agent contact"], favours: ["spatial-depth", "data-storytelling", "functional-micro"], resists: ["neo-brutalism", "retrofuturism"], contrastFloor: 4.5 },
  { id: "nonprofit", label: "Non-profit / cause", group: "brand", brief: "Convert empathy into a completed donation.", priorities: ["one story, told well", "donation path always visible", "transparency about spend"], sections: ["story hero", "impact numbers", "donate flow", "programmes", "annual report"], favours: ["bold-type", "data-storytelling", "a11y-first", "sustainable"], resists: ["retrofuturism", "neo-brutalism"], contrastFloor: 4.5 },
  { id: "gaming", label: "Gaming / entertainment", group: "gaming", brief: "Sell a feeling; performance is still non-negotiable.", priorities: ["atmosphere", "trailer prominence", "platform clarity", "community links"], sections: ["cinematic hero", "trailer", "feature beats", "editions", "community", "system requirements"], favours: ["retrofuturism", "dark-default", "spatial-depth", "kinetic-type"], resists: ["calm-ui", "a11y-first"], contrastFloor: 4.5 },
  { id: "internal", label: "Internal tool", group: "internal", brief: "Nobody chose to use this. Respect their time absolutely.", priorities: ["density", "bulk actions", "keyboard shortcuts", "zero decoration"], sections: ["record list", "detail edit", "bulk actions", "audit log", "permissions"], favours: ["design-tokens", "calm-ui", "sustainable", "a11y-first"], resists: ["kinetic-type", "spatial-depth", "retrofuturism", "gamified-onboarding"], moodId: "technical", contrastFloor: 7 },
  { id: "personal", label: "Personal site", group: "personal", brief: "Sound like a person, not a company.", priorities: ["writing first", "opinion visible", "loads instantly"], sections: ["intro", "writing list", "projects", "now page", "contact"], favours: ["sustainable", "bold-type", "neo-brutalism", "soft-brutalism"], resists: ["gamified-onboarding", "liquid-glass"], contrastFloor: 4.5 },
  { id: "event", label: "Event / conference", group: "brand", brief: "Date, place, price, speakers — then persuasion.", priorities: ["facts above the fold", "schedule clarity", "ticket urgency without sleaze"], sections: ["hero with date/place", "speakers", "schedule", "tickets", "venue", "sponsors"], favours: ["bold-type", "bento", "saturated-color"], resists: ["experimental-nav"], contrastFloor: 4.5 },
  { id: "media", label: "Streaming / media", group: "media", brief: "Get someone into content within two interactions.", priorities: ["artwork density", "resume state", "dark surfaces", "fast scrubbing"], sections: ["continue watching", "browse rails", "detail page", "player", "search"], favours: ["dark-default", "active-bento", "spatial-depth"], resists: ["soft-brutalism"], contrastFloor: 4.5 },
  { id: "portfolio-photo", label: "Photography", group: "portfolio", brief: "Get the interface out of the way of the image.", priorities: ["neutral chrome", "colour accuracy", "full-bleed imagery", "fast galleries"], sections: ["gallery grid", "series view", "lightbox", "about", "prints/contact"], favours: ["calm-ui", "sustainable", "dark-default"], resists: ["saturated-color", "neo-brutalism"], contrastFloor: 4.5 },
];

export const PURPOSE_GROUPS = Array.from(new Set(PURPOSES.map((p) => p.group)));

export const getTrend = (id: string) => TRENDS.find((t) => t.id === id);
export const getPurpose = (id: string) => PURPOSES.find((p) => p.id === id);
