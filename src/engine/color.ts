/**
 * HEPHAESTUS · color engine
 * Pure, dependency-free color math. sRGB <-> Linear <-> OKLab <-> OKLCH,
 * WCAG contrast, colour-vision simulation, perceptual mixing, nearest-name lookup.
 *
 * Everything downstream (Akmon, Cedalion) speaks OKLCH because it is
 * perceptually uniform: equal numeric steps look like equal visual steps.
 */

export type RGB = { r: number; g: number; b: number }; // 0..255
export type HSL = { h: number; s: number; l: number }; // 0..360, 0..100, 0..100
export type OKLCH = { l: number; c: number; h: number }; // 0..1, 0..0.4ish, 0..360
export type OKLab = { L: number; a: number; b: number };

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const round = (v: number, p = 2) => {
  const m = 10 ** p;
  return Math.round(v * m) / m;
};

/* ------------------------------------------------------------------ *
 * hex / rgb
 * ------------------------------------------------------------------ */

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const t = (v: number) =>
    Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`.toUpperCase();
}

export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex.trim());
}

/* ------------------------------------------------------------------ *
 * hsl
 * ------------------------------------------------------------------ */

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
  }
  h = (h * 60 + 360) % 360;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const S = clamp(s / 100), L = clamp(l / 100);
  const H = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if (H < 60) [rp, gp, bp] = [c, x, 0];
  else if (H < 120) [rp, gp, bp] = [x, c, 0];
  else if (H < 180) [rp, gp, bp] = [0, c, x];
  else if (H < 240) [rp, gp, bp] = [0, x, c];
  else if (H < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

/* ------------------------------------------------------------------ *
 * OKLab / OKLCH  (Björn Ottosson's transform)
 * ------------------------------------------------------------------ */

const srgbToLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (v: number) => {
  const x = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return clamp(x, 0, 1) * 255;
};

export function rgbToOklab({ r, g, b }: RGB): OKLab {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb({ L, a, b }: OKLab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return {
    r: linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function oklabToOklch({ L, a, b }: OKLab): OKLCH {
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-6 ? 0 : h };
}

export function oklchToOklab({ l, c, h }: OKLCH): OKLab {
  const rad = (h * Math.PI) / 180;
  return { L: l, a: c * Math.cos(rad), b: c * Math.sin(rad) };
}

export const hexToOklch = (hex: string): OKLCH =>
  oklabToOklch(rgbToOklab(hexToRgb(hex)));

/** Is this OKLCH coordinate representable in sRGB without clipping? */
function inGamut({ l, c, h }: OKLCH): boolean {
  const lab = oklchToOklab({ l, c, h });
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const b = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const e = 0.0005;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e;
}

/**
 * Convert OKLCH -> hex, reducing chroma by binary search until the colour
 * fits inside sRGB. Preserves hue and lightness, which is what a designer
 * actually cares about; naive clipping shifts hue and ruins palettes.
 */
export function oklchToHex(color: OKLCH): string {
  const l = clamp(color.l, 0, 1);
  const h = ((color.h % 360) + 360) % 360;
  let c = Math.max(0, color.c);
  if (!inGamut({ l, c, h })) {
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut({ l, c: mid, h })) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  return rgbToHex(oklabToRgb(oklchToOklab({ l, c, h })));
}

/** Largest chroma that still fits in sRGB for a given L + H. */
export function maxChroma(l: number, h: number): number {
  let lo = 0, hi = 0.45;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h })) lo = mid;
    else hi = mid;
  }
  return lo;
}

/* ------------------------------------------------------------------ *
 * contrast + accessibility
 * ------------------------------------------------------------------ */

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG 2.2 contrast ratio, 1..21 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagLevel = "AAA" | "AA" | "AA Large" | "Fail";

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/** Black or white — whichever is legible on top of `hex`. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, "#FFFFFF") >= contrastRatio(hex, "#000000")
    ? "#FFFFFF"
    : "#000000";
}

/**
 * Nudge `fg` lightness until it clears `target` contrast against `bg`,
 * keeping hue + chroma. Returns null when even pure black/white can't.
 */
export function fixContrast(fg: string, bg: string, target = 4.5): string | null {
  if (contrastRatio(fg, bg) >= target) return fg;
  const base = hexToOklch(fg);
  const bgL = relativeLuminance(bg);
  const dirs = bgL > 0.35 ? [-1, 1] : [1, -1]; // darken on light bg first
  for (const dir of dirs) {
    for (let step = 1; step <= 100; step++) {
      const l = clamp(base.l + dir * step * 0.01, 0, 1);
      const candidate = oklchToHex({ ...base, l });
      if (contrastRatio(candidate, bg) >= target) return candidate;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * colour vision deficiency simulation
 * Brettel/Viénot-style LMS projection — good enough to catch real
 * "these two swatches collapse into one" failures.
 * ------------------------------------------------------------------ */

export type CvdType = "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";

const CVD_MATRIX: Record<CvdType, number[][]> = {
  protanopia: [
    [0.1121, 0.8853, -0.0005],
    [0.1127, 0.8897, -0.0001],
    [0.0045, 0.0, 1.0019],
  ],
  deuteranopia: [
    [0.292, 0.7054, -0.0003],
    [0.2934, 0.7089, 0.0001],
    [-0.0195, 0.0333, 0.9905],
  ],
  tritanopia: [
    [1.0166, 0.0859, -0.1029],
    [0.0102, 0.7317, 0.2586],
    [0.0538, 0.5215, 0.4233],
  ],
  achromatopsia: [
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
  ],
};

export function simulateCvd(hex: string, type: CvdType): string {
  const { r, g, b } = hexToRgb(hex);
  const lin = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const m = CVD_MATRIX[type];
  const out = m.map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
  return rgbToHex({
    r: linearToSrgb(out[0]),
    g: linearToSrgb(out[1]),
    b: linearToSrgb(out[2]),
  });
}

/* ------------------------------------------------------------------ *
 * distance + mixing
 * ------------------------------------------------------------------ */

/** Perceptual distance in OKLab. ~0.02 = barely distinguishable. */
export function deltaE(a: string, b: string): number {
  const A = rgbToOklab(hexToRgb(a)), B = rgbToOklab(hexToRgb(b));
  return Math.sqrt((A.L - B.L) ** 2 + (A.a - B.a) ** 2 + (A.b - B.b) ** 2);
}

export type MixSpace = "oklab" | "oklch" | "srgb";

/** Mix two colours. OKLab is the honest default; sRGB is the "web dev" one. */
export function mix(a: string, b: string, t = 0.5, space: MixSpace = "oklab"): string {
  const k = clamp(t);
  if (space === "srgb") {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex({
      r: A.r + (B.r - A.r) * k,
      g: A.g + (B.g - A.g) * k,
      b: A.b + (B.b - A.b) * k,
    });
  }
  if (space === "oklch") {
    const A = hexToOklch(a), B = hexToOklch(b);
    let dh = B.h - A.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    return oklchToHex({
      l: A.l + (B.l - A.l) * k,
      c: A.c + (B.c - A.c) * k,
      h: A.h + dh * k,
    });
  }
  const A = rgbToOklab(hexToRgb(a)), B = rgbToOklab(hexToRgb(b));
  return rgbToHex(
    oklabToRgb({
      L: A.L + (B.L - A.L) * k,
      a: A.a + (B.a - A.a) * k,
      b: A.b + (B.b - A.b) * k,
    })
  );
}

/** Weighted mix of N colours in OKLab — the "throw it all in the crucible" mode. */
export function mixMany(colors: string[], weights?: number[]): string {
  if (!colors.length) return "#000000";
  const w = weights ?? colors.map(() => 1);
  const total = w.reduce((s, x) => s + x, 0) || 1;
  let L = 0, a = 0, b = 0;
  colors.forEach((hex, i) => {
    const lab = rgbToOklab(hexToRgb(hex));
    const k = w[i] / total;
    L += lab.L * k; a += lab.a * k; b += lab.b * k;
  });
  return rgbToHex(oklabToRgb({ L, a, b }));
}

export function lighten(hex: string, amount = 0.08): string {
  const c = hexToOklch(hex);
  return oklchToHex({ ...c, l: clamp(c.l + amount) });
}
export function darken(hex: string, amount = 0.08): string {
  const c = hexToOklch(hex);
  return oklchToHex({ ...c, l: clamp(c.l - amount) });
}
export function saturate(hex: string, amount = 0.03): string {
  const c = hexToOklch(hex);
  return oklchToHex({ ...c, c: Math.max(0, c.c + amount) });
}
export function rotateHue(hex: string, deg: number): string {
  const c = hexToOklch(hex);
  return oklchToHex({ ...c, h: (c.h + deg + 360) % 360 });
}

/** 11-step tonal ramp (50..950) from a single seed colour. */
export function ramp(hex: string): Record<string, string> {
  const base = hexToOklch(hex);
  const stops = [
    [50, 0.975], [100, 0.94], [200, 0.88], [300, 0.8], [400, 0.72],
    [500, 0.63], [600, 0.55], [700, 0.46], [800, 0.37], [900, 0.28], [950, 0.19],
  ] as const;
  const out: Record<string, string> = {};
  for (const [name, l] of stops) {
    // chroma follows a bell curve — pale tints and deep shades hold less chroma
    const falloff = 1 - Math.abs(l - 0.62) * 1.25;
    const c = Math.min(base.c * Math.max(0.22, falloff), maxChroma(l, base.h));
    out[String(name)] = oklchToHex({ l, c, h: base.h });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * formats
 * ------------------------------------------------------------------ */

export function formatColor(
  hex: string,
  fmt: "hex" | "rgb" | "hsl" | "oklch"
): string {
  if (fmt === "hex") return hex.toUpperCase();
  if (fmt === "rgb") {
    const { r, g, b } = hexToRgb(hex);
    return `rgb(${r} ${g} ${b})`;
  }
  if (fmt === "hsl") {
    const { h, s, l } = rgbToHsl(hexToRgb(hex));
    return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  }
  const { l, c, h } = hexToOklch(hex);
  return `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(h, 1)})`;
}
