/**
 * HEPHAESTUS · Akmon palette engine
 *
 * Turns natural language into structured, accessibility-aware palettes.
 * Deterministic: same prompt + same seed = same palette, forever.
 * Vary the seed and you walk a continuous OKLCH space — see SPACE_SIZE.
 */

import {
  contrastRatio, deltaE, fixContrast, hexToOklch, maxChroma, mix,
  oklchToHex, ramp, readableOn, round, type OKLCH,
} from "./color";
import {
  COLOR_NAMES, familyOfHue, findColorName, MODIFIERS, MOODS,
  MULTIWORD_NAMES, TEMPERATURE, type Mood,
} from "./vocabulary";

/* ------------------------------------------------------------------ *
 * types
 * ------------------------------------------------------------------ */

export type Role =
  | "background" | "surface" | "border" | "text" | "muted"
  | "primary" | "secondary" | "accent";

export const ROLE_ORDER: Role[] = [
  "background", "surface", "border", "text", "muted", "primary", "secondary", "accent",
];

export type Swatch = {
  hex: string;
  role: Role;
  name: string;
  locked: boolean;
};

export type Scheme =
  | "monochrome" | "analogous" | "complement" | "split-complement"
  | "triadic" | "tetradic" | "compound" | "neutral-accent" | "hue-drift";

export const SCHEMES: Scheme[] = [
  "monochrome", "analogous", "complement", "split-complement",
  "triadic", "tetradic", "compound", "neutral-accent", "hue-drift",
];

export const SCHEME_LABEL: Record<Scheme, string> = {
  monochrome: "one hue, many tones",
  analogous: "neighbouring hues",
  complement: "opposite hues",
  "split-complement": "opposite, softened",
  triadic: "three evenly spaced",
  tetradic: "two complementary pairs",
  compound: "warm/cool tension",
  "neutral-accent": "greys plus one voice",
  "hue-drift": "slow gradient across hues",
};

export type Mode = "dark" | "light";

export type Palette = {
  id: string;
  name: string;
  prompt: string;
  scheme: Scheme;
  mode: Mode;
  seed: number;
  swatches: Swatch[];
  createdAt: number;
  moodId?: string;
  favorite?: boolean;
};

export type AnchorRole = "primary" | "secondary" | "accent" | "background" | "text";

export type ParsedPrompt = {
  anchors: { hex: string; token: string; role?: AnchorRole }[];
  mood?: Mood;
  scheme?: Scheme;
  mode?: Mode;
  wantsMuted: boolean;
  wantsVivid: boolean;
  count?: number;
  unmatched: string[];
};

/* ------------------------------------------------------------------ *
 * deterministic randomness
 * ------------------------------------------------------------------ */

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

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

type Rng = ReturnType<typeof mulberry32>;
const pick = <T,>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)] ?? arr[0];
const between = (rng: Rng, a: number, b: number) => a + rng() * (b - a);

/**
 * Honest size of the addressable palette space, computed not marketed.
 * OKLCH quantised at the limit of what a 24-bit display can even show:
 * L 1000 steps x C 400 steps x H 3600 steps -> 1.44e9 distinguishable
 * coordinates per swatch, over 8 role swatches.
 */
export const SPACE_SIZE = {
  perSwatch: 1000 * 400 * 3600,
  swatches: 8,
  get total() {
    return this.perSwatch ** this.swatches;
  },
  get pretty() {
    // 1.44e9 ^ 8 = ~1.8e74
    const exp = Math.log10(this.perSwatch) * this.swatches;
    return `10^${Math.floor(exp)}`;
  },
};

/* ------------------------------------------------------------------ *
 * prompt parsing
 * ------------------------------------------------------------------ */

const SCHEME_WORDS: Record<string, Scheme> = {
  monochrome: "monochrome", mono: "monochrome", monochromatic: "monochrome",
  analogous: "analogous", neighbour: "analogous", neighboring: "analogous",
  complementary: "complement", complement: "complement", opposite: "complement",
  split: "split-complement", triad: "triadic", triadic: "triadic",
  tetradic: "tetradic", square: "tetradic", quad: "tetradic",
  compound: "compound", accent: "neutral-accent", minimal: "neutral-accent",
  gradient: "hue-drift", drift: "hue-drift", spectrum: "hue-drift",
};

export function parsePrompt(input: string): ParsedPrompt {
  const raw = input.toLowerCase().replace(/[,/]/g, " ");
  let text = ` ${raw.replace(/\s+/g, " ").trim()} `;

  const anchors: ParsedPrompt["anchors"] = [];
  const consumed = new Set<string>();

  // 1. greedy multi-word colour names first ("electric blue" before "blue")
  for (const name of MULTIWORD_NAMES) {
    const idx = text.indexOf(` ${name} `);
    if (idx !== -1) {
      const nc = findColorName(name)!;
      anchors.push({ hex: nc.hex, token: name });
      text = text.replace(` ${name} `, "  ");
      consumed.add(name);
    }
  }

  const tokens = text.split(/\s+/).filter(Boolean);

  // 2. explicit hex codes
  for (const t of tokens) {
    if (/^#?[0-9a-f]{6}$/i.test(t) || /^#?[0-9a-f]{3}$/i.test(t)) {
      const hex = t.startsWith("#") ? t : `#${t}`;
      anchors.push({ hex: hex.toUpperCase(), token: hex });
      consumed.add(t);
    }
  }

  // 3. modifier + colour pairs, scanning left for stacked modifiers
  const unmatched: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (consumed.has(t)) continue;
    const nc = findColorName(t);
    if (!nc) {
      if (!MODIFIERS[t] && !SCHEME_WORDS[t] && t.length > 2) unmatched.push(t);
      continue;
    }
    let c = hexToOklch(nc.hex);
    const applied: string[] = [];
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const m = tokens[i - back];
      const mod = MODIFIERS[m];
      if (!mod) break;
      c = {
        l: Math.min(0.99, Math.max(0.02, c.l + mod.dl)),
        c: Math.max(0, c.c * mod.cx + (mod.dc ?? 0)),
        h: (c.h + (TEMPERATURE[m] ?? 0) + 360) % 360,
      };
      applied.unshift(m);
      consumed.add(m);
    }
    c.c = Math.min(c.c, maxChroma(c.l, c.h));
    anchors.push({ hex: oklchToHex(c), token: [...applied, t].join(" ") });
    consumed.add(t);
  }

  // 3b. role hints — "burnt orange accent", "accent of teal", "navy background"
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ROLE_WORDS: [AnchorRole, string][] = [
    ["accent", "accents?"],
    ["primary", "primary|brand|main"],
    ["secondary", "secondary"],
    ["background", "background|bg|base|canvas"],
    ["text", "text|type|copy|foreground|fg"],
  ];
  for (const a of anchors) {
    const t = esc(a.token);
    for (const [role, words] of ROLE_WORDS) {
      const after = new RegExp(`${t}\\s+(?:as\\s+)?(?:the\\s+)?(?:${words})\\b`);
      const before = new RegExp(`\\b(?:${words})\\s+(?:colou?r\\s+)?(?:of\\s+|is\\s+|in\\s+)?${t}`);
      if (after.test(raw) || before.test(raw)) { a.role = role; break; }
    }
  }

  // 4. mood — score every mood by how many of its words appear
  let mood: Mood | undefined;
  let bestScore = 0;
  for (const m of MOODS) {
    const score = m.words.reduce((s, w) => s + (raw.includes(w) ? w.length : 0), 0);
    if (score > bestScore) { bestScore = score; mood = m; }
  }

  // 5. scheme + mode + count
  let scheme: Scheme | undefined;
  for (const t of tokens) if (SCHEME_WORDS[t]) { scheme = SCHEME_WORDS[t]; break; }

  const mode: Mode | undefined = /\b(dark|night|midnight|noir|black)\b/.test(raw)
    ? "dark"
    : /\b(light|bright|day|white|paper|airy)\b/.test(raw)
      ? "light"
      : undefined;

  const countMatch = raw.match(/\b(\d{1,2})\s*(colou?rs?|swatch|swatches|tones?)\b/);

  return {
    anchors,
    mood,
    scheme,
    mode,
    wantsMuted: /\b(muted|dusty|soft|subtle|calm|pastel|washed|faded)\b/.test(raw),
    wantsVivid: /\b(vivid|neon|electric|bold|punchy|saturated|loud|bright)\b/.test(raw),
    count: countMatch ? Math.min(12, Math.max(3, parseInt(countMatch[1], 10))) : undefined,
    unmatched,
  };
}

/* ------------------------------------------------------------------ *
 * hue geometry
 * ------------------------------------------------------------------ */

function hueSet(base: number, scheme: Scheme, rng: Rng): number[] {
  const j = () => between(rng, -6, 6); // organic jitter, keeps output alive
  const w = (n: number) => ((n % 360) + 360) % 360;
  switch (scheme) {
    case "monochrome":
      return [base, w(base + j()), w(base + j()), w(base + j())];
    case "analogous": {
      const step = between(rng, 18, 34);
      return [base, w(base + step), w(base - step), w(base + step * 2)];
    }
    case "complement":
      return [base, w(base + 180 + j()), w(base + j()), w(base + 180 + j())];
    case "split-complement": {
      const s = between(rng, 145, 168);
      return [base, w(base + s), w(base - s), w(base + 180)];
    }
    case "triadic":
      return [base, w(base + 120 + j()), w(base + 240 + j()), w(base + 120)];
    case "tetradic": {
      const off = between(rng, 55, 85);
      return [base, w(base + off), w(base + 180), w(base + 180 + off)];
    }
    case "compound": {
      const near = between(rng, 22, 40);
      return [base, w(base + near), w(base + 180 + j()), w(base - near)];
    }
    case "neutral-accent":
      return [base, base, base, w(base + between(rng, 150, 210))];
    case "hue-drift": {
      const d = between(rng, 12, 26);
      return [base, w(base + d), w(base + d * 2), w(base + d * 3)];
    }
  }
}

/* ------------------------------------------------------------------ *
 * generation
 * ------------------------------------------------------------------ */

export type GenerateOptions = {
  prompt?: string;
  seed?: number;
  scheme?: Scheme;
  mode?: Mode;
  keep?: Swatch[]; // locked swatches survive regeneration
};

export function generatePalette(opts: GenerateOptions = {}): Palette {
  const prompt = (opts.prompt ?? "").trim();
  const parsed = parsePrompt(prompt);
  const seed = opts.seed ?? (hashString(prompt || "hephaestus") ^ Date.now()) >>> 0;
  const rng = mulberry32(seed);

  const mood = parsed.mood;
  const scheme: Scheme =
    opts.scheme ?? parsed.scheme ??
    (mood ? (pick(rng, mood.schemes) as Scheme) : pick(rng, SCHEMES));
  const bgAnchorEarly = parsed.anchors.find((a) => a.role === "background");
  const mode: Mode =
    opts.mode ??
    parsed.mode ??
    (bgAnchorEarly ? (hexToOklch(bgAnchorEarly.hex).l < 0.5 ? "dark" : "light") : rng() > 0.42 ? "dark" : "light");

  // --- base hue -----------------------------------------------------
  const anchorFor = (role: AnchorRole) => {
    const hit = parsed.anchors.find((a) => a.role === role);
    return hit ? hexToOklch(hit.hex) : undefined;
  };
  const unassigned = parsed.anchors.filter((a) => !a.role);
  const bgAnchor = anchorFor("background");
  const textAnchor = anchorFor("text");
  // An anchor named as the accent never becomes the lead colour — if you say
  // "lime accent", lime stays the accent instead of taking over the palette.
  const leadAnchor =
    anchorFor("primary") ??
    (unassigned[0] ? hexToOklch(unassigned[0].hex) : undefined) ??
    anchorFor("secondary");

  let baseHue: number;
  let baseChroma: number;
  if (leadAnchor) {
    const a = leadAnchor;
    baseHue = a.h;
    baseChroma = a.c;
  } else if (mood?.hueBias?.length) {
    const [lo, hi] = pick(rng, mood.hueBias);
    baseHue = between(rng, lo, hi);
    baseChroma = between(rng, mood.chroma[0], mood.chroma[1]);
  } else {
    baseHue = rng() * 360;
    baseChroma = between(rng, 0.08, 0.22);
  }
  if (parsed.wantsMuted) baseChroma *= 0.5;
  if (parsed.wantsVivid) baseChroma = Math.max(baseChroma * 1.6, 0.19);
  baseChroma = Math.max(0.02, Math.min(baseChroma, 0.33));

  const hues = hueSet(baseHue, scheme, rng);
  const secondAnchor = anchorFor("secondary") ?? (unassigned[1] ? hexToOklch(unassigned[1].hex) : undefined);
  const accentAnchor =
    anchorFor("accent") ??
    (unassigned[2] ? hexToOklch(unassigned[2].hex) : undefined) ??
    (!anchorFor("secondary") && unassigned.length === 2 ? hexToOklch(unassigned[1].hex) : undefined);
  const secondHue = secondAnchor?.h ?? hues[1];
  const accentHue = accentAnchor?.h ?? hues[2];

  const dark = mode === "dark";
  // Neutral surfaces carry a whisper of the brand hue — this is the single
  // biggest tell between an amateur palette and a designed one.
  const tint = between(rng, 0.004, dark ? 0.018 : 0.012);

  const bgL = dark ? between(rng, 0.10, 0.17) : between(rng, 0.965, 0.995);
  const surfaceL = dark ? bgL + between(rng, 0.04, 0.07) : bgL - between(rng, 0.025, 0.045);
  const borderL = dark ? bgL + between(rng, 0.10, 0.16) : bgL - between(rng, 0.08, 0.13);
  const textL = dark ? between(rng, 0.93, 0.98) : between(rng, 0.14, 0.22);
  const mutedL = dark ? between(rng, 0.62, 0.72) : between(rng, 0.44, 0.54);

  const primaryL = dark
    ? between(rng, 0.62, 0.76)
    : mood ? between(rng, mood.lightness[0], mood.lightness[1]) : between(rng, 0.48, 0.62);

  const mk = (l: number, c: number, h: number): OKLCH => ({
    l, c: Math.min(c, maxChroma(l, h)), h,
  });

  // A named background ("navy background") is taken literally: its hue and
  // chroma become the neutral family, and every other surface is derived
  // from it so the whole palette stays in that world.
  const neutralHue = bgAnchor?.h ?? baseHue;
  const neutralTint = bgAnchor ? Math.min(bgAnchor.c, 0.09) : tint;
  const anchoredBgL = bgAnchor ? bgAnchor.l : bgL;
  const lift = dark ? 1 : -1;

  const background = oklchToHex(mk(anchoredBgL, neutralTint, neutralHue));
  const surface = oklchToHex(
    mk(bgAnchor ? anchoredBgL + lift * 0.05 : surfaceL, neutralTint * 1.25, neutralHue)
  );
  const border = oklchToHex(
    mk(bgAnchor ? anchoredBgL + lift * 0.12 : borderL, neutralTint * 1.6, neutralHue)
  );
  const text = textAnchor
    ? oklchToHex(mk(textAnchor.l, textAnchor.c, textAnchor.h))
    : oklchToHex(mk(textL, tint * 1.2, neutralHue));
  const muted = oklchToHex(mk(mutedL, Math.min(neutralTint * 2, 0.05), neutralHue));

  let primary = oklchToHex(mk(primaryL, baseChroma, baseHue));
  let accent = oklchToHex(
    mk(
      dark ? between(rng, 0.7, 0.84) : between(rng, 0.55, 0.68),
      accentAnchor
        ? Math.min(0.34, Math.max(accentAnchor.c, 0.06) * (parsed.wantsVivid ? 1.3 : 1))
        : Math.max(
            // a palette without a loud accent reads flat — keep one voice bright
            parsed.wantsMuted || scheme === "monochrome" ? baseChroma * 1.1 : 0.15,
            Math.min(0.34, baseChroma * between(rng, 1.15, 1.6))
          ),
      scheme === "monochrome" && !accentAnchor ? baseHue : accentHue
    )
  );
  let secondary = oklchToHex(
    mk(
      primaryL + between(rng, -0.06, 0.06),
      (secondAnchor?.c ?? Math.max(0.09, baseChroma * between(rng, 0.6, 0.9))) * (parsed.wantsMuted ? 0.6 : 1),
      secondHue
    )
  );

  // --- accessibility repair pass -------------------------------------
  const target = mood?.contrastTarget ?? 4.5;
  const fixedText = fixContrast(text, background, Math.max(target, 7));
  const fixedMuted = fixContrast(muted, background, 4.5);
  primary = fixContrast(primary, background, 3) ?? primary;
  secondary = fixContrast(secondary, background, 3) ?? secondary;
  accent = fixContrast(accent, background, 3) ?? accent;

  // secondary must not collapse into primary
  if (deltaE(primary, secondary) < 0.07) {
    const s = hexToOklch(secondary);
    secondary = oklchToHex(mk(s.l + (dark ? -0.12 : 0.12), s.c, (s.h + 28) % 360));
  }
  // ...and accent must not collapse into secondary either
  if (deltaE(secondary, accent) < 0.06) {
    const a = hexToOklch(accent);
    accent = accentAnchor
      ? oklchToHex(mk(dark ? Math.min(0.9, a.l + 0.1) : Math.max(0.32, a.l - 0.1), Math.min(0.34, a.c * 1.15), a.h))
      : oklchToHex(mk(a.l, Math.min(0.34, a.c * 1.2), (a.h + 36) % 360));
  }
  if (deltaE(accent, primary) < 0.09 && scheme !== "monochrome") {
    const a = hexToOklch(accent);
    accent = accentAnchor
      // An explicitly requested accent hue is never rotated away — separate
      // it by lightness and chroma instead.
      ? oklchToHex(mk(dark ? Math.min(0.9, a.l + 0.14) : Math.max(0.3, a.l - 0.14), Math.min(0.34, a.c * 1.2), a.h))
      : oklchToHex(mk(a.l, Math.min(0.34, a.c * 1.3), (a.h + 42) % 360));
  }
  // the separation moves above can push a colour back below its ratio —
  // re-run the repair pass so every guarantee still holds
  primary = fixContrast(primary, background, 3) ?? primary;
  secondary = fixContrast(secondary, background, 3) ?? secondary;
  accent = fixContrast(accent, background, 3) ?? accent;

  const built: Record<Role, string> = {
    background,
    surface,
    border,
    text: fixedText ?? readableOn(background),
    muted: fixedMuted ?? muted,
    primary,
    secondary,
    accent,
  };

  // honour locks from the previous palette
  const locks = new Map((opts.keep ?? []).filter((s) => s.locked).map((s) => [s.role, s]));
  const swatches: Swatch[] = ROLE_ORDER.map((role) => {
    const kept = locks.get(role);
    const hex = kept ? kept.hex : built[role];
    return { role, hex, locked: !!kept, name: describeColor(hex) };
  });

  return {
    id: `pal_${seed.toString(36)}_${Math.floor(rng() * 1e6).toString(36)}`,
    name: paletteName(prompt, swatches, scheme, rng),
    prompt,
    scheme,
    mode,
    seed,
    swatches,
    createdAt: Date.now(),
    moodId: mood?.id,
  };
}

/* ------------------------------------------------------------------ *
 * naming
 * ------------------------------------------------------------------ */

/** Nearest vocabulary anchor in OKLab, prefixed by a tone word. */
export function describeColor(hex: string): string {
  let best = COLOR_NAMES[0];
  let bestD = Infinity;
  for (const c of COLOR_NAMES) {
    const d = deltaE(hex, c.hex);
    if (d < bestD) { bestD = d; best = c; }
  }
  const { l, c } = hexToOklch(hex);
  if (c < 0.022) {
    if (l > 0.94) return "off white";
    if (l > 0.8) return "light grey";
    if (l > 0.55) return "grey";
    if (l > 0.3) return "dark grey";
    if (l > 0.14) return "near black";
    return "black";
  }
  const base = hexToOklch(best.hex);
  const dl = l - base.l;
  let tone = "";
  if (dl > 0.16) tone = "pale ";
  else if (dl > 0.07) tone = "light ";
  else if (dl < -0.16) tone = "deep ";
  else if (dl < -0.07) tone = "dark ";
  if (c < base.c * 0.5) tone = tone ? `${tone.trim()} muted ` : "muted ";
  else if (c > base.c * 1.45) tone = tone ? `${tone.trim()} vivid ` : "vivid ";
  return `${tone}${best.name}`.trim();
}

const NAME_SUFFIX = [
  "forge", "anvil", "ember", "quench", "kiln", "temper", "alloy", "cinder",
  "smelt", "billet", "flux", "slag", "ingot", "crucible", "hammer", "scale",
];

function paletteName(prompt: string, swatches: Swatch[], scheme: Scheme, rng: Rng): string {
  const lead = swatches.find((s) => s.role === "primary")!;
  const family = familyOfHue(hexToOklch(lead.hex).h);
  const words = prompt
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 2);
  const stem = words.length ? words.join(" ") : `${family} ${scheme.replace("-", " ")}`;
  return `${stem} ${pick(rng, NAME_SUFFIX)}`.replace(/\b\w/g, (m) => m.toUpperCase());
}

/* ------------------------------------------------------------------ *
 * variation + mixing
 * ------------------------------------------------------------------ */

/** A nearby palette: same DNA, shifted. Used by the "vary" control. */
export function varyPalette(p: Palette, amount = 0.5): Palette {
  const rng = mulberry32((p.seed ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const shift = between(rng, -28, 28) * amount;
  const swatches = p.swatches.map((s) => {
    if (s.locked) return s;
    const c = hexToOklch(s.hex);
    const isNeutral = c.c < 0.03;
    const next = oklchToHex({
      l: Math.max(0.03, Math.min(0.98, c.l + between(rng, -0.05, 0.05) * amount)),
      c: Math.max(0, c.c * (1 + between(rng, -0.25, 0.25) * amount)),
      h: (c.h + (isNeutral ? shift * 0.3 : shift) + 360) % 360,
    });
    return { ...s, hex: next, name: describeColor(next) };
  });
  return { ...p, id: `${p.id}_v${Math.floor(rng() * 1e5).toString(36)}`, swatches, createdAt: Date.now() };
}

/** Blend two palettes role-by-role — the crucible. */
export function crossPalettes(a: Palette, b: Palette, t = 0.5): Palette {
  const swatches = a.swatches.map((s, i) => {
    const other = b.swatches[i]?.hex ?? s.hex;
    const hex = mix(s.hex, other, t);
    return { ...s, hex, locked: false, name: describeColor(hex) };
  });
  return {
    ...a,
    id: `pal_x_${Date.now().toString(36)}`,
    name: `${a.name.split(" ")[0]} x ${b.name.split(" ")[0]}`,
    swatches,
    createdAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ *
 * export
 * ------------------------------------------------------------------ */

export type ExportFormat = "css" | "tailwind" | "json" | "svg" | "scss";

export function exportPalette(p: Palette, fmt: ExportFormat): string {
  const s = Object.fromEntries(p.swatches.map((x) => [x.role, x.hex])) as Record<Role, string>;

  if (fmt === "css") {
    const lines = p.swatches.map((x) => `  --hp-${x.role}: ${x.hex};`);
    const scales = ["primary", "accent"]
      .map((role) => {
        const r = ramp(s[role as Role]);
        return Object.entries(r).map(([k, v]) => `  --hp-${role}-${k}: ${v};`).join("\n");
      })
      .join("\n");
    return `/* ${p.name} — Hephaestus */\n:root {\n${lines.join("\n")}\n\n${scales}\n  --hp-on-primary: ${readableOn(s.primary)};\n  --hp-on-accent: ${readableOn(s.accent)};\n}\n`;
  }

  if (fmt === "scss") {
    return `// ${p.name} — Hephaestus\n` +
      p.swatches.map((x) => `$hp-${x.role}: ${x.hex};`).join("\n") + "\n";
  }

  if (fmt === "tailwind") {
    const colors = p.swatches.map((x) => `        ${x.role}: "${x.hex}",`).join("\n");
    const pr = ramp(s.primary);
    const prLines = Object.entries(pr).map(([k, v]) => `          ${k}: "${v}",`).join("\n");
    return `// ${p.name} — Hephaestus\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${colors}\n        brand: {\n${prLines}\n        },\n      },\n    },\n  },\n};\n`;
  }

  if (fmt === "svg") {
    const w = 160, h = 220;
    const rects = p.swatches
      .map((x, i) => {
        const fg = readableOn(x.hex);
        return `  <g transform="translate(${i * w},0)">
    <rect width="${w}" height="${h}" fill="${x.hex}"/>
    <text x="16" y="${h - 40}" font-family="ui-monospace,monospace" font-size="13" fill="${fg}">${x.hex}</text>
    <text x="16" y="${h - 20}" font-family="ui-monospace,monospace" font-size="11" fill="${fg}" opacity="0.7">${x.role}</text>
  </g>`;
      })
      .join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * p.swatches.length}" height="${h}" viewBox="0 0 ${w * p.swatches.length} ${h}">\n${rects}\n</svg>\n`;
  }

  return JSON.stringify(
    {
      name: p.name,
      prompt: p.prompt,
      scheme: p.scheme,
      mode: p.mode,
      seed: p.seed,
      generator: "Hephaestus/Akmon",
      colors: p.swatches.map((x) => ({
        role: x.role,
        hex: x.hex,
        name: x.name,
        oklch: (({ l, c, h }) => ({ l: round(l, 4), c: round(c, 4), h: round(h, 2) }))(hexToOklch(x.hex)),
        contrastOnBackground: round(contrastRatio(x.hex, s.background), 2),
      })),
    },
    null,
    2
  );
}

export function paletteToCssVars(p: Palette): Record<string, string> {
  return Object.fromEntries(p.swatches.map((x) => [`--pv-${x.role}`, x.hex]));
}
