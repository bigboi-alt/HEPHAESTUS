/**
 * HEPHAESTUS · the forge mark
 *
 * One palette per person, forged once from where and when the app was first opened, then frozen.
 *
 * The seed is deliberately short enough to say out loud, and every number behind it is shown in
 * Settings → About so a mark can be recomputed by hand:
 *
 *     lat + lon + year + dayOfYear + hour + minute + second + ms + weatherCode + temperature + humidity
 *
 * The rating is not a mood. `gradeMark` measures the finished palette with the same colour maths the
 * rest of the app uses — OKLab spacing, WCAG contrast on real role pairs, chroma discipline, and what
 * survives each colour-vision simulation — and the seven tiers are the boundaries a mark can land on.
 * A mark can reach 100 only by satisfying every component; nothing here grants a tier.
 *
 * There is one more piece: the founder's key. It is stored folded so the string is not sitting in the
 * bundle in plain text, which keeps a curious reader out but is obfuscation, not security — anything
 * shipped to a client can be found by someone determined enough. That trade-off is stated rather than
 * pretend-denied.
 */
import {
  contrastRatio,
  deltaE,
  hexToOklch,
  oklchToHex,
  round,
  simulateCvd,
} from "./color";
import type { Palette, Role, Swatch } from "./akmon";

/* ── the tiers ─────────────────────────────────────────────────────────────────────────────── */

export type Tier = { min: number; max: number; name: string; mark: string; note: string };

/** The ladder, verbatim. `identity-qa` pins these ranges, and so does the site's § 04 card. */
export const TIERS: readonly Tier[] = [
  { min: 0, max: 39, name: "RAW IRON", mark: "⚙️", note: "Unrefined, functional, little harmony" },
  { min: 40, max: 54, name: "TEMPERED IRON", mark: "🩶", note: "Solid and usable, some character" },
  { min: 55, max: 69, name: "SILVERFORGED", mark: "⚪", note: "Clean harmony, strong balance" },
  { min: 70, max: 79, name: "GILDED", mark: "🟡", note: "Distinctive, refined, visually memorable" },
  { min: 80, max: 89, name: "MASTERFORGED", mark: "🟠", note: "Exceptional harmony and personality" },
  { min: 90, max: 96, name: "HEPHAESTEAN", mark: "🔥", note: "Extremely rare, almost perfectly composed" },
  { min: 97, max: 100, name: "DIVINE FORGE", mark: "✦", note: "Exceptional enough to become an identity of its own" },
];

export function tierFor(score: number): Tier {
  const s = Math.round(clamp(score, 0, 100));
  return TIERS.find((t) => s >= t.min && s <= t.max) ?? TIERS[0];
}

/* ── the reading the mark is forged from ─────────────────────────────────────────────────────── */

export type SkyReading = {
  /** "coords" once a place was read; "clock" when the mark is forged from time alone (offline, or declined) */
  place: "coords" | "clock";
  lat: number;
  lon: number;
  tz: string;
  year: number;
  dayOfYear: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
  /** WMO weather interpretation code, or null when the sky was not read */
  weatherCode: number | null;
  temperature: number | null;   // °C
  humidity: number | null;      // %
  takenAt: number;              // epoch ms
};

export type Component = { key: string; label: string; value: number; max: number; detail: string };
export type Mark = {
  palette: Palette;
  seed: number;
  score: number;
  tier: Tier;
  components: Component[];
  inputs: { label: string; value: string }[];
  place: SkyReading["place"];
  /** the numbers this mark was forged from, kept so they can be read back and edited */
  reading: SkyReading | null;
  /** true only for the founder's own set, which is not forged from a reading */
  founder: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** FNV-1a over the fields in the order the formula names them, so the number is reproducible. */
export function seedOf(r: SkyReading): number {
  const parts = [
    r.place === "coords" ? round(r.lat, 4) : 0,
    r.place === "coords" ? round(r.lon, 4) : 0,
    r.year,
    r.dayOfYear,
    r.hour,
    r.minute,
    r.second,
    r.ms,
    r.weatherCode ?? 0,
    round(r.temperature ?? 0, 2),
    round(r.humidity ?? 0, 2),
  ];
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    for (const ch of String(p)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** leap years are part of "the type of year" the reading takes into account */
export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The sky nudges the metal. Each bias is a small, stated pull on chroma or warmth — it is what makes
 * a foggy morning and a dry noon produce different marks from the same minute.
 */
const SKY_BIAS: { test: (c: number) => boolean; chroma: number; warm: number; name: string }[] = [
  { test: (c) => c === 0, chroma: 0.018, warm: 4, name: "clear sky" },
  { test: (c) => c >= 1 && c <= 2, chroma: 0.010, warm: 2, name: "partly cloudy" },
  { test: (c) => c === 3, chroma: -0.014, warm: 0, name: "overcast" },
  { test: (c) => c === 45 || c === 48, chroma: -0.026, warm: -2, name: "fog" },
  { test: (c) => c >= 51 && c <= 67, chroma: -0.006, warm: -8, name: "drizzle or rain" },
  { test: (c) => c >= 71 && c <= 77, chroma: -0.002, warm: -6, name: "snow" },
  { test: (c) => c >= 80 && c <= 82, chroma: 0.008, warm: -4, name: "showers" },
  { test: (c) => c >= 95, chroma: 0.024, warm: 8, name: "thunderstorm" },
];
const skyBias = (code: number | null) =>
  code == null ? { chroma: 0, warm: 0, name: "no sky read" } : SKY_BIAS.find((b) => b.test(code)) ?? { chroma: 0, warm: 0, name: `weather code ${code}` };

/* ── forging ─────────────────────────────────────────────────────────────────────────────────── */

const CHORDS: { offsets: [number, number, number]; name: string }[] = [
  { offsets: [0, 28, 56], name: "analogous" },
  { offsets: [0, 145, 215], name: "split-complement" },
  { offsets: [0, 120, 240], name: "triadic" },
  { offsets: [0, 180, 208], name: "complement, shifted" },
  { offsets: [0, 180, 20], name: "complement, near neighbour" },
  { offsets: [0, 60, 180], name: "tetradic" },
  { offsets: [0, 34, 178], name: "warm pair against a cool" },
];

const ROLES: Role[] = ["background", "surface", "border", "text", "muted", "primary", "secondary", "accent"];
const NAMES: Record<Role, string> = {
  background: "ground", surface: "bench", border: "rim", text: "ink", muted: "ash",
  primary: "primary", secondary: "secondary", accent: "accent",
};

/** the identity itself: what a mark is *worn as*. The other two roles are furniture for the app. */
export const IDENTITY_ROLES: readonly Role[] = ["background", "text", "muted", "primary", "secondary", "accent"];

const at = (l: number, c: number, h: number) => oklchToHex({ l, c: Math.max(0, c), h: ((h % 360) + 360) % 360 });

/**
 * Build the eight role colours from a seed. `drift` — the amount the hues wander off their chord — is
 * itself derived from the reading, which is why some marks come out refined and some come out rough:
 * the grading below measures exactly that wander, it does not decide it.
 */
export function forgePalette(seed: number, sky: { chroma: number; warm: number }, day: boolean): { swatches: Swatch[]; scheme: string; drift: number } {
  const rng = rngFrom(seed);
  const chord = CHORDS[Math.floor(rng() * CHORDS.length)] ?? CHORDS[0];
  const h0 = Math.floor(rng() * 360);
  // 0° … 46° of wander, weighted up: most marks come out merely decent, a flawless one is rare by construction
  const drift = Math.round(Math.pow(rng(), 0.72) * 46 * 10) / 10;
  const jitter = () => (rng() - 0.5) * 2 * drift;
  // one in four marks has a voice that stepped off the chord entirely — that is most of what "raw" looks like
  const wayward = rng() < 0.27 ? (rng() < 0.5 ? -1 : 1) * (38 + rng() * 44) : 0;
  // and sometimes the whole set comes out coarse: voices the same lightness, everything shouting, ink sunk
  // into the ground. A forge that only ever produced good work would need no ladder at all.
  const coarse = rng() < 0.21;

  const slouch = (rng() - 0.5) * 0.09;                    // surfaces drift toward the ground
  const crowd = coarse ? 0.045 + rng() * 0.045 : 0;
  const dayL = { bg: 0.965, surf: 0.925 + slouch, border: 0.855 + slouch * 1.6, text: coarse ? 0.6 : 0.27 + rng() * 0.14, muted: 0.55 + slouch };
  const nightL = { bg: 0.175, surf: 0.235 - slouch, border: 0.345 + slouch, text: coarse ? 0.5 : 0.955 - rng() * 0.1, muted: 0.685 + slouch };
  const L = day ? dayL : nightL;
  const base = (coarse ? 0.155 : 0.075) + rng() * (coarse ? 0.07 : 0.115) + sky.chroma;

  const hues = chord.offsets.map((o, i) => h0 + o + sky.warm + jitter() + (i === 1 ? wayward : 0));
  const mk = (role: Role, hex: string): Swatch => ({ hex, role, name: NAMES[role], locked: false });

  const swatches: Swatch[] = [
    mk("background", at(L.bg, 0.016 + rng() * 0.014 + Math.max(0, sky.chroma) * 0.4, hues[0] + jitter() * 0.4)),
    mk("surface", at(L.surf, 0.024 + rng() * 0.016, hues[0] + jitter() * 0.4)),
    mk("border", at(L.border, 0.034 + rng() * 0.016, hues[0] + 12 + jitter() * 0.5)),
    mk("text", at(L.text, 0.02 + rng() * 0.014, hues[0] + 180 + jitter() * 0.3)),
    mk("muted", at(L.muted, 0.03 + rng() * 0.02, hues[1] + jitter() * 0.4)),
    mk("primary", at(day ? 0.51 : 0.74, base + rng() * 0.04, hues[0] + jitter() * 0.25)),
    mk("secondary", at((day ? 0.62 : 0.68) + (coarse ? crowd : 0) * (rng() < 0.5 ? -1 : 1), coarse ? base * 1.1 : base * 0.72 + rng() * 0.05, hues[1] + jitter() * 0.25)),
    mk("accent", at((day ? 0.63 + rng() * 0.1 : 0.8 - rng() * 0.12) + (coarse ? crowd : 0), base * (coarse ? 1.35 : 1.18) + rng() * 0.05, hues[2] + jitter() * 0.25)),
  ];
  return { swatches, scheme: chord.name, drift };
}

/** Forge the mark for a reading. Deterministic: same ten numbers in, same palette out. */
export function forgeMark(r: SkyReading): Mark {
  const seed = seedOf(r);
  const bias = skyBias(r.weatherCode);
  const day = r.hour >= 6 && r.hour < 19;
  const { swatches, scheme, drift } = forgePalette(seed, bias, day);

  const palette: Palette = {
    id: `mark-${seed.toString(16)}`,
    name: "Your forge mark",
    prompt: `${r.place === "coords" ? `${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}` : "clock only"} · ${r.year}/${String(r.dayOfYear).padStart(3, "0")} ${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}:${String(r.second).padStart(2, "0")}.${String(r.ms).padStart(3, "0")} · ${bias.name}`,
    scheme: scheme as Palette["scheme"],
    mode: day ? "light" : "dark",
    seed,
    swatches,
    createdAt: r.takenAt,
  };

  const grade = gradeMark(palette);
  const yearKind = isLeapYear(r.year) ? "leap year" : "common year";
  return {
    palette,
    seed,
    ...grade,
    place: r.place,
    reading: r,
    founder: false,
    inputs: [
      { label: "latitude", value: r.place === "coords" ? round(r.lat, 4).toFixed(4) : "— (not read)" },
      { label: "longitude", value: r.place === "coords" ? round(r.lon, 4).toFixed(4) : "— (not read)" },
      { label: "timezone", value: r.tz },
      { label: "year", value: String(r.year) },
      { label: "type of year", value: `${yearKind} · day ${r.dayOfYear}` },
      { label: "time", value: `${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}:${String(r.second).padStart(2, "0")}.${String(r.ms).padStart(3, "0")}` },
      { label: "weather code", value: r.weatherCode == null ? "— (no sky read)" : `${r.weatherCode} · ${bias.name}` },
      { label: "temperature", value: r.temperature == null ? "—" : `${round(r.temperature, 1)} °C` },
      { label: "humidity", value: r.humidity == null ? "—" : `${round(r.humidity, 0)} %` },
      { label: "seed", value: `${seed} (${scheme}, ${drift}° wander)` },
    ],
  };
}

/* ── grading: six measured components, one hundred points ─────────────────────────────────────── */

const hue = (hex: string) => hexToOklch(hex).h;
const chroma = (hex: string) => hexToOklch(hex).c;
const light = (hex: string) => hexToOklch(hex).l;
const dE = deltaE;                                   // OKLab distance, the same one Akmon measures with
const hueGap = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
};
const get = (p: Palette, role: Role) => p.swatches.find((s) => s.role === role)!.hex;

/**
 * Everything a mark is judged on. Each component saturates only when its criteria are all met, so
 * 100 means "every measurement passed", and a low mark names what it measured.
 */
export function gradeMark(p: Palette): { score: number; tier: Tier; components: Component[] } {
  const R = (role: Role) => get(p, role);
  const components: Component[] = [];

  // 1 · harmony — are the three voices on a real chord? tolerance 12°
  {
    const h = [R("primary"), R("secondary"), R("accent")].map(hue);
    const gaps = [hueGap(h[0], h[1]), hueGap(h[1], h[2]), hueGap(h[0], h[2])];
    const templates = CHORDS.map((c) => c.offsets);
    let worst = 999;
    for (const t of templates) {
      const want = [t[1], t[2] - t[1], t[2]].map((g) => hueGap(g, 0));
      const dev = Math.max(...gaps.map((g, i) => Math.abs(g - want[i])));
      worst = Math.min(worst, dev);
    }
    const value = worst <= 12 ? 22 : round(22 * clamp(1 - (worst - 12) / 40, 0, 1), 1);
    components.push({ key: "harmony", label: "harmony", value, max: 22, detail: `voices ${gaps.map((g) => Math.round(g)).join("°/")} apart, ${round(worst, 1)}° off the nearest chord (tolerance 12°)` });
  }

  // 2 · the lightness ladder — ink has to sit on ground with room for surfaces between
  {
    const Ls = ROLES.map((r) => light(R(r))).sort((a, b) => a - b);
    const spread = Ls[Ls.length - 1] - Ls[0];
    const gaps = Ls.slice(1).map((v, i) => v - Ls[i]);
    const minGap = Math.min(...gaps);
    const inkRoom = Math.abs(light(R("text")) - light(R("background"))) >= 0.5;
    const value = round(6 * clamp(spread / 0.6, 0, 1) + 5 * clamp((minGap - 0.005) / 0.015, 0, 1) + (inkRoom ? 5 : 0), 1);
    components.push({ key: "ladder", label: "lightness ladder", value, max: 16, detail: `${round(spread, 2)} of lightness across eight roles, closest pair ${round(minGap, 3)} apart${inkRoom ? ", ink has room" : ", ink sits too close to the ground"}` });
  }

  // 3 · contrast on the pairs a palette is actually used for
  {
    const needs: [Role, Role, number, string][] = [
      ["text", "background", 4.5, "ink on ground"],
      ["text", "surface", 4.5, "ink on a card"],
      ["muted", "background", 3, "ash on ground"],
      ["primary", "background", 4.5, "primary carries reversed text"],
      ["secondary", "background", 2.2, "secondary reads on ground"],
      ["accent", "background", 2.2, "accent reads on ground"],
    ];
    let value = 0;
    const fails: string[] = [];
    for (const [fg, bg, floor, label] of needs) {
      const ratio = contrastRatio(R(fg), R(bg));
      if (ratio >= floor) value += 22 / needs.length;
      else fails.push(`${label} ${round(ratio, 2)} < ${floor}`);
    }
    components.push({
      key: "contrast", label: "usable contrast", value: round(value, 1), max: 22,
      detail: fails.length ? fails.join("; ") : `all six role pairs clear their floor (ink ${round(contrastRatio(R("text"), R("background")), 2)}:1)`,
    });
  }

  // 4 · chroma discipline — one loud voice, not six
  {
    const cs = ROLES.map((r) => chroma(R(r)));
    const loud = cs.filter((c) => c > 0.13).length;
    const neutralGround = chroma(R("background")) <= 0.06 && chroma(R("surface")) <= 0.07;
    const hasQuiet = cs.some((c) => c < 0.04);
    const hasVoice = Math.max(...cs) >= 0.1;
    const ok = loud <= 2 && neutralGround && hasQuiet && hasVoice;
    const share = (ok ? 1 : 0.55) * clamp(1 - Math.max(0, loud - 2) * 0.28, 0, 1);
    components.push({ key: "chroma", label: "chroma discipline", value: round(14 * share, 1), max: 14, detail: `peak ${round(Math.max(...cs), 3)}, ${loud} role${loud === 1 ? "" : "s"} over 0.130${neutralGround ? ", ground kept neutral" : ", ground is loud"}` });
  }

  // 5 · colour-vision survival — the three voices must still be three voices
  {
    const sims = ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"] as const;
    const voices: Role[] = ["primary", "secondary", "accent"];
    let worst = 999;
    for (const t of sims) {
      for (let i = 0; i < voices.length; i++) {
        for (let j = i + 1; j < voices.length; j++) {
          const a = simulateCvd(R(voices[i]), t);
          const b = simulateCvd(R(voices[j]), t);
          worst = Math.min(worst, dE(a, b));
        }
      }
    }
    const value = round(14 * clamp((worst - 0.02) / (0.1 - 0.02), 0, 1), 1);
    components.push({ key: "cvd", label: "colour-blind separation", value, max: 14, detail: `the closest pair of voices still measures ${round(worst, 3)} apart in any simulation (full marks at 0.100)` });
  }

  // 6 · eight distinct roles — nothing is a duplicate of its neighbour
  {
    let min = 999;
    for (let i = 0; i < ROLES.length; i++) {
      for (let j = i + 1; j < ROLES.length; j++) {
        const same = ROLES[i] === "background" && ROLES[j] === "surface";
        const d = dE(R(ROLES[i]), R(ROLES[j]));
        if (!same) min = Math.min(min, d);
      }
    }
    const value = round(12 * clamp((min - 0.02) / (0.1 - 0.02), 0, 1), 1);
    components.push({ key: "distinct", label: "distinct roles", value, max: 12, detail: `nearest two roles are ${round(min, 3)} apart in OKLab (full marks at 0.100)` });
  }

  // floored, never rounded: 99.5 must not be promoted into the band above it
  const score = Math.floor(clamp(components.reduce((a, c) => a + c.value, 0), 0, 100));
  return { score, tier: tierFor(score), components };
}

/* ── the founder's set ───────────────────────────────────────────────────────────────────────── */

/**
 * Hand-built, and it is the same measurement as everyone else's: every component above maxes out on
 * these eight values, which is the only reason it is allowed to read 100. If a tweak ever breaks a
 * component, `identity-qa` fails rather than quietly promoting it.
 */
const FOUNDER_HEX: Record<Role, string> = {
  background: "#120704",   // the bench, lamp off
  surface: "#21130d",
  border: "#4d2a15",       // heat still in the anvil's edge
  text: "#e1ebf2",         // bone, the only cool thing in the set
  muted: "#bca399",
  primary: "#e56a2d",      // the metal, at working temperature
  secondary: "#35667e",    // the quench
  accent: "#ebaf60",       // scale, catching the light
};

export function founderMark(): Mark {
  const swatches: Swatch[] = ROLES.map((role) => ({
    hex: FOUNDER_HEX[role], role, name: NAMES[role], locked: true,
  }));
  const palette: Palette = {
    id: "mark-founder",
    name: "Founder set · Divine Forge",
    prompt: "NØX · the master's own anvil",
    scheme: "analogous",
    mode: "dark",
    seed: 0,
    swatches,
    createdAt: 0,
  };
  const grade = gradeMark(palette);
  return {
    palette,
    seed: 0,
    score: grade.score,
    tier: grade.tier,
    components: grade.components,
    place: "coords",
    reading: null,
    founder: true,
    inputs: [{ label: "source", value: "the founder's key — this set is not forged from a reading" }],
  };
}

/* ── the key ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * The founder's key, folded. Stored as offsets rather than a literal so the string is not sitting in
 * the shipped bundle for anyone who greps it; see the note at the top of this file for what that is
 * and is not. Decoded on demand, compared in a normalised form, and never written back out as text.
 */
const FOLD = 0x5a;
const FOLDED = [0x34, 0x35, 0x22, 0x60, 0x60, 0x2c, 0x3f, 0x28, 0x60, 0x60, 0x3b, 0x28, 0x2e, 0x60, 0x60, 0x3e, 0x3f, 0x33, 0x60, 0x60, 0x3d, 0x3b, 0x3e, 0x60, 0x60, 0x31, 0x3b, 0x36];

function unfold(): string {
  return FOLDED.map((b) => String.fromCharCode(b ^ FOLD)).join("");
}

/** normalise what a person actually types: case, spacing and the lookalike vowels all collapse */
export function normaliseKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[Øθø]/g, "o").replace(/[Ξξ€]/g, "e").replace(/[Λλʌ]/g, "a")
    .replace(/0/g, "o").replace(/[1|!]/g, "i").replace(/[3€]/g, "e").replace(/[4@]/g, "a").replace(/5/g, "s")
    .replace(/[^\p{Ll}]/gu, "");
}

/** true when the tail of `typed` is the key; the buffer is compared normalised, so `::` is optional */
export function keyMatches(typed: string): boolean {
  const want = normaliseKey(unfold());
  const got = normaliseKey(typed);
  return want.length > 0 && got.length >= want.length && got.slice(-want.length) === want;
}

/** the glyphed form, rebuilt for display rather than stored in the bundle */
export function keySigil(): string {
  return unfold()
    .replace(/o/g, "Ø").replace(/e/g, "Ξ").replace(/a/g, "Λ")
    .replace(/::/g, "::")
    .toUpperCase();
}
