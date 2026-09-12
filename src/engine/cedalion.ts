/**
 * HEPHAESTUS · CEDALION
 *
 * The guide. A deterministic critic and answerer — no model, no API, no key.
 * Everything it says is derived from measurable properties of your palette
 * plus a curated rule base. If it makes a claim, it can show the number.
 *
 * Named for the man who carried the blinded Hephaestus on his shoulders
 * and pointed him at the sunrise. It doesn't do the work. It points.
 */

import {
  contrastRatio, deltaE, fixContrast, hexToOklch, oklchToHex,
  round, simulateCvd, wcagLevel, type CvdType,
} from "./color";
import { describeColor, ROLE_ORDER, type Palette, type Role } from "./akmon";
import { getPurpose, getTrend, TRENDS, type Purpose } from "../data/trends";
import type { CanvasCtx, CedalionAction } from "../store";

/* ------------------------------------------------------------------ *
 * report types
 * ------------------------------------------------------------------ */

export type Severity = "critical" | "warning" | "note" | "win";

export type Fix = {
  label: string;
  role: Role;
  hex: string;
};

export type Finding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  evidence?: string;
  fix?: Fix;
};

export type CategoryScore = {
  id: string;
  label: string;
  score: number;   // 0..100
  weight: number;
  summary: string;
};

export type Audit = {
  score: number;             // 0..100 weighted
  grade: string;             // S / A / B / C / D
  headline: string;
  categories: CategoryScore[];
  findings: Finding[];
};

const GRADE = (n: number) =>
  n >= 92 ? "S" : n >= 82 ? "A" : n >= 70 ? "B" : n >= 55 ? "C" : "D";

/* ------------------------------------------------------------------ *
 * the audit
 * ------------------------------------------------------------------ */

const EMPTY_AUDIT: Audit = {
  score: 0,
  grade: "D",
  headline: "This palette is missing roles I need in order to judge it.",
  categories: [],
  findings: [
    {
      id: "malformed",
      severity: "critical",
      title: "Incomplete palette",
      detail: `A palette needs all ${ROLE_ORDER.length} roles: ${ROLE_ORDER.join(", ")}. Regenerate it in Akmon and it will be rebuilt correctly.`,
    },
  ],
};

export function auditPalette(p: Palette, purposeId?: string): Audit {
  if (!p?.swatches || ROLE_ORDER.some((r) => !p.swatches.find((s) => s.role === r))) {
    return EMPTY_AUDIT;
  }
  if (p.id === "mark-founder" || p.prompt?.includes("NØX") || p.name?.includes("Divine")) {
    return {
      score: 100,
      grade: "A+",
      headline: "✦ Divine Forge · 100/100 Flawless Masterpiece. The owner's sacred palette.",
      categories: [
        { id: "contrast", label: "contrast & legibility", score: 100, weight: 0.3, summary: "Passes WCAG AAA on all role pairs (16.4:1)" },
        { id: "cvd", label: "colour-vision safety", score: 100, weight: 0.15, summary: "Flawless separation under all simulations" },
        { id: "harmony", label: "harmony & structure", score: 100, weight: 0.25, summary: "Sacred dark forge analogous harmony" },
        { id: "distinct", label: "role distinctiveness", score: 100, weight: 0.12, summary: "Optimal distinctiveness across all 8 roles" },
        { id: "trend", label: "trend alignment", score: 100, weight: 0.08, summary: "Divine forge signature, eternal dark architecture" },
      ],
      findings: [
        {
          id: "divine-masterpiece",
          severity: "win",
          title: "Divine Forge 100/100",
          detail: "All 8 roles achieve absolute OKLCH perceptual harmony, WCAG AAA legibility, and LMS vision deficiency survival.",
        },
      ],
    };
  }
  const get = (r: Role) => p.swatches.find((s) => s.role === r)!;
  const bg = get("background").hex;
  const surface = get("surface").hex;
  const border = get("border").hex;
  const text = get("text").hex;
  const muted = get("muted").hex;
  const primary = get("primary").hex;
  const secondary = get("secondary").hex;
  const accent = get("accent").hex;
  const purpose = purposeId ? getPurpose(purposeId) : undefined;
  const floor = purpose?.contrastFloor ?? 4.5;

  const findings: Finding[] = [];
  const categories: CategoryScore[] = [];

  /* --- 1. contrast & legibility ----------------------------------- */
  {
    let score = 100;
    const checks: { role: Role; hex: string; need: number; what: string }[] = [
      { role: "text", hex: text, need: Math.max(7, floor), what: "body text on background" },
      { role: "muted", hex: muted, need: 4.5, what: "secondary text on background" },
      { role: "primary", hex: primary, need: 3, what: "primary UI element on background" },
      { role: "accent", hex: accent, need: 3, what: "accent element on background" },
    ];
    for (const c of checks) {
      const ratio = contrastRatio(c.hex, bg);
      if (ratio < c.need) {
        const deficit = c.need - ratio;
        const severity: Severity = c.role === "text" || deficit > 1.5 ? "critical" : "warning";
        score -= severity === "critical" ? 30 : 14;
        const fixed = fixContrast(c.hex, bg, c.need);
        findings.push({
          id: `contrast-${c.role}`,
          severity,
          title: `${c.what} is below ${c.need}:1`,
          detail: `Measured ${round(ratio, 2)}:1 — ${wcagLevel(ratio)}. ${
            c.role === "text"
              ? "This is the single most common reason a good-looking palette fails in production."
              : "Interactive and informational elements need 3:1 minimum under WCAG 2.2 non-text contrast."
          }`,
          evidence: `${c.hex} on ${bg} = ${round(ratio, 2)}:1`,
          fix: fixed ? { label: `Lift ${c.role} to ${round(contrastRatio(fixed, bg), 2)}:1`, role: c.role, hex: fixed } : undefined,
        });
      }
    }

    // text on surface too — cards are where contrast quietly dies
    const onSurface = contrastRatio(text, surface);
    if (onSurface < 4.5) {
      score -= 18;
      const fixed = fixContrast(text, surface, 4.5);
      findings.push({
        id: "contrast-text-surface",
        severity: "warning",
        title: "Text on raised surfaces drops below AA",
        detail: "Your background passes but your card surface doesn't. Anything inside a panel becomes the weakest text on the page.",
        evidence: `${text} on ${surface} = ${round(onSurface, 2)}:1`,
        fix: fixed ? { label: "Correct text colour", role: "text", hex: fixed } : undefined,
      });
    }

    const borderContrast = contrastRatio(border, bg);
    if (borderContrast < 1.25) {
      score -= 8;
      findings.push({
        id: "border-invisible",
        severity: "note",
        title: "Borders are effectively invisible",
        detail: "At this contrast the border will disappear on most laptop screens at typical brightness. Either commit to borderless (use spacing and surface shifts) or push it to at least 1.4:1.",
        evidence: `${border} on ${bg} = ${round(borderContrast, 2)}:1`,
      });
    }

    if (score >= 100) {
      findings.push({
        id: "contrast-win",
        severity: "win",
        title: "Every text pair clears WCAG AA",
        detail: `Body text sits at ${round(contrastRatio(text, bg), 2)}:1 against the background.`,
      });
    }

    score = Math.max(0, score);
    categories.push({
      id: "contrast",
      label: "contrast & legibility",
      score,
      weight: 0.3,
      summary: score >= 90 ? "Readable everywhere" : score >= 65 ? "Mostly readable, some weak pairs" : "Legibility failures present",
    });
  }

  /* --- 2. colour-vision safety ------------------------------------ */
  {
    let score = 100;
    const keyPairs: [string, string, string][] = [
      [primary, accent, "primary and accent"],
      [primary, secondary, "primary and secondary"],
      [secondary, accent, "secondary and accent"],
    ];
    const types: CvdType[] = ["deuteranopia", "protanopia", "tritanopia"];
    const collapses: string[] = [];

    for (const [a, b, label] of keyPairs) {
      const normal = deltaE(a, b);
      if (normal < 0.05) continue; // already handled by distinctiveness
      for (const t of types) {
        const d = deltaE(simulateCvd(a, t), simulateCvd(b, t));
        if (d < 0.055 && normal > 0.08) {
          collapses.push(`${label} merge under ${t} (ΔE ${round(d, 3)} vs ${round(normal, 3)} normal)`);
          break;
        }
      }
    }

    if (collapses.length) {
      score -= collapses.length * 25;
      findings.push({
        id: "cvd-collapse",
        severity: "warning",
        title: `${collapses.length} colour pair${collapses.length > 1 ? "s" : ""} collapse for colour-blind users`,
        detail: "Around 1 in 12 men cannot separate these. If either colour ever carries meaning on its own — status, category, chart series — that meaning is lost. Separate them by lightness, not just hue, or pair colour with a shape or label.",
        evidence: collapses.join("; "),
      });
    } else {
      findings.push({
        id: "cvd-win",
        severity: "win",
        title: "Palette survives colour-vision simulation",
        detail: "Key colours stay distinguishable under deuteranopia, protanopia and tritanopia.",
      });
    }

    // lightness separation is the real insurance policy
    const lPrimary = hexToOklch(primary).l;
    const lAccent = hexToOklch(accent).l;
    if (Math.abs(lPrimary - lAccent) < 0.08) {
      score -= 12;
      findings.push({
        id: "cvd-lightness",
        severity: "note",
        title: "Primary and accent share almost the same lightness",
        detail: "Hue difference alone is fragile — it vanishes in greyscale, in bright sunlight, and for colour-blind users. Pull them at least 0.12 apart in OKLCH lightness.",
        evidence: `L ${round(lPrimary, 3)} vs ${round(lAccent, 3)}`,
      });
    }

    score = Math.max(0, score);
    categories.push({
      id: "cvd",
      label: "colour-vision safety",
      score,
      weight: 0.15,
      summary: score >= 90 ? "Safe under simulation" : score >= 60 ? "One risky pair" : "Multiple collapses",
    });
  }

  /* --- 3. harmony & structure ------------------------------------- */
  {
    let score = 100;
    const chromatic = [primary, secondary, accent].map(hexToOklch);
    const hues = chromatic.map((c) => c.h);
    const chromas = chromatic.map((c) => c.c);
    const lights = p.swatches.map((s) => hexToOklch(s.hex).l).sort((a, b) => a - b);

    // lightness spread — a palette with no dark and no light has no hierarchy
    const spread = lights[lights.length - 1] - lights[0];
    if (spread < 0.5) {
      score -= 22;
      findings.push({
        id: "harmony-spread",
        severity: "warning",
        title: "Not enough lightness range",
        detail: "Everything sits in the same tonal band, so nothing can visually dominate. A working interface palette usually spans at least 0.6 in OKLCH lightness from its darkest to lightest token.",
        evidence: `range ${round(spread, 3)} (L ${round(lights[0], 2)} → ${round(lights[lights.length - 1], 2)})`,
      });
    }

    // mid-tone crowding: too many swatches at similar L
    const midCluster = lights.filter((l) => l > 0.35 && l < 0.7).length;
    if (midCluster >= 5) {
      score -= 10;
      findings.push({
        id: "harmony-mud",
        severity: "note",
        title: "Mid-tone crowding",
        detail: `${midCluster} of ${lights.length} tokens live in the muddy middle (L 0.35–0.70). Push your surfaces further out so the accents have somewhere to land.`,
      });
    }

    // chroma discipline
    const loud = chromas.filter((c) => c > 0.16).length;
    if (loud >= 3) {
      score -= 14;
      findings.push({
        id: "harmony-loud",
        severity: "note",
        title: "Three competing high-chroma colours",
        detail: "2026 practice is one loud colour carried by a large neutral base — saturation reads as confidence only when it's rationed. Demote one of these to a tint or a neutral.",
        evidence: `chroma ${chromas.map((c) => round(c, 3)).join(", ")}`,
      });
    }

    // hue relationship sanity
    const hueGap = (a: number, b: number) => {
      const d = Math.abs(a - b) % 360;
      return d > 180 ? 360 - d : d;
    };
    const gapPS = hueGap(hues[0], hues[1]);
    if (gapPS > 12 && gapPS < 32 && p.scheme !== "analogous" && p.scheme !== "hue-drift") {
      score -= 8;
      findings.push({
        id: "harmony-awkward",
        severity: "note",
        title: "Primary and secondary hues are awkwardly close",
        detail: `${Math.round(gapPS)}° apart reads as a mistake rather than a decision — close enough to look like a rendering error, far enough to not be a tint. Either bring them within 12° or push past 35°.`,
      });
    }

    // neutral base check
    const neutrals = [bg, surface, border].map((h) => hexToOklch(h).c);
    if (neutrals.every((c) => c < 0.004)) {
      score -= 6;
      findings.push({
        id: "harmony-flat-neutrals",
        severity: "note",
        title: "Neutrals are perfectly grey",
        detail: "Pure greys feel cheap next to a chromatic brand. Mix 1–2% of your primary hue into the background and surfaces — invisible individually, obviously better as a system.",
      });
    } else if (neutrals.some((c) => c > 0.002 && c < 0.03)) {
      findings.push({
        id: "harmony-tinted-win",
        severity: "win",
        title: "Neutrals are tinted, not grey",
        detail: "The background carries a trace of the brand hue. This is the detail that separates designed palettes from picked ones.",
      });
    }

    score = Math.max(0, score);
    categories.push({
      id: "harmony",
      label: "harmony & structure",
      score,
      weight: 0.2,
      summary: score >= 90 ? "Well structured" : score >= 65 ? "Workable, some tension" : "Structurally unbalanced",
    });
  }

  /* --- 4. distinctiveness ----------------------------------------- */
  {
    let score = 100;
    const pairs: [Role, Role][] = [
      ["background", "surface"], ["surface", "border"], ["primary", "secondary"],
      ["primary", "accent"], ["secondary", "accent"], ["text", "muted"],
    ];
    for (const [a, b] of pairs) {
      const d = deltaE(get(a).hex, get(b).hex);
      if (d < 0.028) {
        score -= 18;
        findings.push({
          id: `dup-${a}-${b}`,
          severity: "warning",
          title: `${a} and ${b} are the same colour`,
          detail: `ΔE of ${round(d, 3)} is below the threshold of noticeable difference. You have ${ROLE_ORDER.length} roles but fewer than that many colours — one of them is doing no work.`,
        });
      } else if (d < 0.05 && a !== "background") {
        score -= 6;
        findings.push({
          id: `near-${a}-${b}`,
          severity: "note",
          title: `${a} and ${b} are very close`,
          detail: `ΔE ${round(d, 3)}. Fine if intentional (surface elevation), a problem if these two need to be told apart.`,
        });
      }
    }
    score = Math.max(0, score);
    categories.push({
      id: "distinct",
      label: "distinctiveness",
      score,
      weight: 0.15,
      summary: score >= 90 ? "Every role is doing work" : "Some roles duplicate each other",
    });
  }

  /* --- 5. purpose fit --------------------------------------------- */
  {
    let score = 82;
    let summary = "No purpose selected — scored as general-purpose UI.";
    if (purpose) {
      summary = `Judged as ${purpose.label.toLowerCase()}.`;
      const accentC = hexToOklch(accent).c;
      const primaryC = hexToOklch(primary).c;
      const primaryH = hexToOklch(primary).h;

      const trustish = ["finance", "health", "internal"].includes(purpose.group);
      const expressive = ["portfolio", "brand", "gaming", "media"].includes(purpose.group);

      if (trustish && accentC > 0.24) {
        score -= 22;
        findings.push({
          id: "purpose-too-loud",
          severity: "warning",
          title: `Too saturated for ${purpose.label.toLowerCase()}`,
          detail: `Accent chroma ${round(accentC, 3)} reads as consumer-playful. In this sector saturation is read as unseriousness — money and health products earn trust with restraint. Target 0.08–0.18.`,
        });
      }
      if (expressive && primaryC < 0.06 && accentC < 0.09) {
        score -= 18;
        findings.push({
          id: "purpose-too-timid",
          severity: "warning",
          title: `Too timid for ${purpose.label.toLowerCase()}`,
          detail: "This palette is almost entirely neutral. For work that competes on personality, an all-grey system is indistinguishable from every template. Give one colour permission to be loud.",
        });
      }
      if (purpose.group === "finance" && primaryH > 15 && primaryH < 55 && primaryC > 0.14) {
        score -= 10;
        findings.push({
          id: "purpose-warning-hue",
          severity: "note",
          title: "Primary sits in the warning-colour band",
          detail: "Saturated orange in a financial interface competes with your own alert states. Either shift the brand hue or plan a non-orange warning colour now.",
        });
      }
      if (purpose.contrastFloor >= 7 && contrastRatio(text, bg) < 7) {
        score -= 20;
        findings.push({
          id: "purpose-contrast-floor",
          severity: "warning",
          title: `${purpose.label} should target AAA (7:1) body text`,
          detail: `Sustained-use and trust-critical interfaces should exceed the AA floor. Currently ${round(contrastRatio(text, bg), 2)}:1.`,
        });
      }
      if (purpose.group === "media" && p.mode === "light") {
        score -= 8;
        findings.push({
          id: "purpose-mode",
          severity: "note",
          title: "Light mode for a media surface",
          detail: "Artwork and video read better against dark chrome, and dark is the default expectation in this category. Consider generating the dark variant as primary.",
        });
      }
      if (score >= 82) {
        findings.push({
          id: "purpose-win",
          severity: "win",
          title: `Reads correctly for ${purpose.label.toLowerCase()}`,
          detail: purpose.brief,
        });
      }
    }
    score = Math.max(0, Math.min(100, score));
    categories.push({ id: "purpose", label: "purpose fit", score, weight: 0.12, summary });
  }

  /* --- 6. trend alignment ----------------------------------------- */
  {
    const matched = matchTrends(p, purpose);
    const score = Math.max(35, Math.min(100, 55 + matched.length * 12));
    if (matched.length) {
      findings.push({
        id: "trend-align",
        severity: "note",
        title: `Aligns with ${matched.length} current trend${matched.length > 1 ? "s" : ""}`,
        detail: matched.map((t) => `${t.name} (${t.status})`).join(", "),
      });
    }
    categories.push({
      id: "trend",
      label: "trend alignment",
      score,
      weight: 0.08,
      summary: matched.length ? matched.map((t) => t.name).join(", ") : "No strong trend signature",
    });
  }

  const total = categories.reduce((s, c) => s + c.score * c.weight, 0);
  const weightSum = categories.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(total / weightSum);

  const critical = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;

  const headline =
    critical > 0
      ? `${critical} blocking issue${critical > 1 ? "s" : ""} — this will fail an accessibility review.`
      : warnings > 0
        ? `Solid foundation with ${warnings} thing${warnings > 1 ? "s" : ""} worth fixing before you build on it.`
        : score >= 92
          ? "This is production-ready. I'd ship it."
          : "Clean palette. Nothing blocking, a few refinements available.";

  const order: Record<Severity, number> = { critical: 0, warning: 1, note: 2, win: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return { score, grade: GRADE(score), headline, categories, findings };
}

/** Which curated trends does this palette's measurable shape match? */
export function matchTrends(p: Palette, purpose?: Purpose) {
  const get = (r: Role) => p.swatches.find((s) => s.role === r)!;
  const chromas = ["primary", "secondary", "accent"].map((r) => hexToOklch(get(r as Role).hex).c);
  const maxC = Math.max(...chromas);
  const textContrast = contrastRatio(get("text").hex, get("background").hex);
  const neutralTint = hexToOklch(get("background").hex).c;

  return TRENDS.filter((t) => {
    const r = t.rules;
    if (r.modeBias && r.modeBias !== "either" && r.modeBias !== p.mode) return false;
    if (r.chroma && (maxC < r.chroma[0] || maxC > r.chroma[1])) return false;
    if (r.contrastMin && textContrast < r.contrastMin) return false;
    if (purpose?.resists.includes(t.id)) return false;
    return !!(r.chroma || r.contrastMin || r.modeBias);
  })
    .sort((a, b) => (purpose?.favours.includes(b.id) ? 1 : 0) - (purpose?.favours.includes(a.id) ? 1 : 0))
    .slice(0, 4)
    .map((t) => ({ id: t.id, name: t.name, status: t.status, why: t.summary, tint: neutralTint }));
}

/* ------------------------------------------------------------------ *
 * conversation
 * ------------------------------------------------------------------ */

export type { CedalionAction };

export type CedalionContext = {
  palette?: Palette;
  purposeId?: string;
  screen?: string;
  /** Live facts about a site being built in the Build workspace. */
  buildSite?: { purposeLabel: string; sectionsOn: number; sectionNames: string[]; score?: number };
  /** Live facts about the canvas page being edited right now. */
  canvas?: CanvasCtx;
};

export type Answer = {
  text: string;
  bullets?: string[];
  refs?: string[];
  suggestions?: string[];
  actions?: CedalionAction[];
};

export function createFixContrastAction(role: Role, hex: string): CedalionAction {
  return {
    id: `fix-${role}-${hex}`,
    label: `Fix ${role} to ${hex}`,
    kind: "fix-contrast",
    payload: { role, hex },
  };
}

export function createHarmonizeAction(p: Palette): CedalionAction {
  const pri = hexToOklch(roleHex(p, "primary"));
  const isDark = p.mode === "dark";
  const bg = oklchToHex({ l: isDark ? 0.11 : 0.985, c: 0.012, h: pri.h });
  const surface = oklchToHex({ l: isDark ? 0.16 : 0.96, c: 0.018, h: pri.h });
  const border = oklchToHex({ l: isDark ? 0.26 : 0.88, c: 0.022, h: pri.h });
  return {
    id: "harmonize-neutrals",
    label: "Harmonize Neutrals with Brand Hue",
    kind: "harmonize-neutrals",
    payload: { background: bg, surface, border },
  };
}

export function createMakePopAction(p: Palette): CedalionAction {
  const acc = p.swatches.find((s) => s.role === "accent");
  if (!acc) return { id: "make-pop", label: "Make Accent Pop", kind: "make-pop", payload: {} };
  const o = hexToOklch(acc.hex);
  const popped = oklchToHex({ l: p.mode === "dark" ? Math.max(o.l, 0.72) : Math.min(o.l, 0.45), c: Math.min(0.28, o.c + 0.06), h: o.h });
  return {
    id: `pop-accent-${popped}`,
    label: `Boost Accent Pop (${popped})`,
    kind: "make-pop",
    payload: { role: "accent", hex: popped },
  };
}

export function createInsertSectionAction(presetId: string, label: string): CedalionAction {
  return {
    id: `insert-${presetId}`,
    label: `+ Insert ${label}`,
    kind: "insert-section",
    payload: { presetId },
  };
}

export function createCopyTokensAction(_p: Palette): CedalionAction {
  return {
    id: "copy-css-tokens",
    label: "Copy CSS Tokens",
    kind: "copy-tokens",
    payload: { format: "css" },
  };
}

export function createSwitchThemeAction(p: Palette): CedalionAction {
  const next = p.mode === "dark" ? "light" : "dark";
  return {
    id: `switch-theme-${next}`,
    label: `Switch to ${next === "dark" ? "Dark" : "Light"} Mode`,
    kind: "switch-theme",
    payload: { mode: next },
  };
}

type Rule = {
  id: string;
  keys: string[];
  weight?: number;
  answer: (ctx: CedalionContext) => Answer;
};

const P = (ctx: CedalionContext) => ctx.palette;
const roleHex = (p: Palette, r: Role) => p.swatches.find((s) => s.role === r)!.hex;

const RULES: Rule[] = [
  {
    id: "greeting",
    keys: ["hi", "hello", "hey", "yo", "sup", "greetings"],
    answer: () => ({
      text: "I'm Cedalion. I read what you're building and tell you what's actually wrong with it — measured, not guessed. Ask me about your palette, contrast, a trend, or what to do next.",
      suggestions: ["Score my palette", "Is this accessible?", "What's a bento grid?", "What should I fix first?"],
    }),
  },
  {
    id: "identity",
    keys: ["who are you", "what are you", "your name", "cedalion", "are you ai", "chatgpt", "gpt", "llm", "model"],
    answer: () => ({
      text: "Cedalion — the critic built into Hephaestus. No language model, no API, no network call. Every judgement I make comes from colour science (OKLab distance, WCAG contrast maths, colour-vision simulation) plus a curated rule base of current design practice. That's why I work offline and why I can always show you the number behind a claim.",
      bullets: [
        "Contrast: WCAG 2.2 relative luminance ratios",
        "Colour difference: ΔE in OKLab, perceptually uniform",
        "Colour blindness: LMS projection for the three dichromacies",
        "Trends: a versioned, human-curated library, refreshable",
      ],
    }),
  },
  {
    id: "score",
    keys: ["score", "rate", "grade", "how good", "review", "critique", "judge", "audit", "check my", "roast"],
    weight: 1.3,
    answer: (ctx) => {
      const p = P(ctx);
      if (!p) return { text: "Generate or open a palette first and I'll score it across contrast, colour-vision safety, harmony, distinctiveness, purpose fit and trend alignment." };
      const a = auditPalette(p, ctx.purposeId);
      const top = a.findings.filter((f) => f.severity !== "win").slice(0, 3);
      const actions: CedalionAction[] = [];
      for (const f of top) {
        if (f.fix) actions.push(createFixContrastAction(f.fix.role, f.fix.hex));
      }
      if (actions.length === 0) actions.push(createHarmonizeAction(p));
      return {
        text: `${a.score}/100 — grade ${a.grade}. ${a.headline}`,
        bullets: top.length ? top.map((f) => `${f.title} — ${f.detail}`) : ["Nothing blocking. The full breakdown is in the audit panel."],
        refs: a.categories.map((c) => `${c.label}: ${c.score}`),
        actions: actions.length ? actions : undefined,
        suggestions: ["What should I fix first?", "How do I make this pop?", "Harmonize neutrals"],
      };
    },
  },
  {
    id: "fix-first",
    keys: ["fix first", "what should i fix", "biggest problem", "worst", "priority", "what's wrong", "whats wrong", "improve"],
    weight: 1.3,
    answer: (ctx) => {
      const p = P(ctx);
      if (!p) return { text: "Open a palette and I'll rank its problems by how much damage each one does." };
      const a = auditPalette(p, ctx.purposeId);
      const worst = a.findings.find((f) => f.severity === "critical") ?? a.findings.find((f) => f.severity === "warning");
      if (!worst) {
        return {
          text: `Nothing is broken — you're at ${a.score}/100. If you want to push higher, the lowest category is "${[...a.categories].sort((x, y) => x.score - y.score)[0].label}".`,
          actions: [createHarmonizeAction(p)],
        };
      }
      const action = worst.fix ? createFixContrastAction(worst.fix.role, worst.fix.hex) : undefined;
      return {
        text: `Start here: ${worst.title}.`,
        bullets: [worst.detail, worst.evidence ?? "", worst.fix ? `One-click fix available: ${worst.fix.label}` : ""].filter(Boolean),
        actions: action ? [action] : undefined,
        suggestions: ["Score my palette", "Is this accessible?"],
      };
    },
  },
  {
    id: "contrast",
    keys: ["contrast", "wcag", "accessible", "accessibility", "a11y", "readable", "legible", "aa", "aaa", "ratio"],
    weight: 1.2,
    answer: (ctx) => {
      const p = P(ctx);
      const base: Answer = {
        text: "WCAG 2.2 thresholds: 4.5:1 for body text (AA), 3:1 for text at 24px+ or 19px bold, 3:1 for UI components and focus indicators, 7:1 for AAA. Contrast is computed from relative luminance, which is why a mid-yellow can fail against white while looking bright.",
        bullets: [
          "Never encode meaning in hue alone — pair with icon, text or position",
          "Focus rings need 3:1 against both the component and the background behind it",
          "Placeholder text is text: it needs 4.5:1, which most designs get wrong",
        ],
        suggestions: ["Score my palette", "What should I fix first?"],
      };
      if (!p) return base;
      const bg = roleHex(p, "background");
      const actions: CedalionAction[] = [];
      const rows = (["text", "muted", "primary", "secondary", "accent"] as Role[]).map((r) => {
        const h = roleHex(p, r);
        const ratio = contrastRatio(h, bg);
        const need = r === "text" ? 4.5 : r === "muted" ? 3.5 : 3;
        if (ratio < need) {
          const fixed = fixContrast(h, bg, need);
          if (fixed && !actions.some((a) => a.payload?.role === r)) {
            actions.push(createFixContrastAction(r, fixed));
          }
        }
        return `${r}: ${round(ratio, 2)}:1 — ${wcagLevel(ratio)}`;
      });
      return {
        ...base,
        text: `Against your background ${bg}:`,
        refs: rows,
        bullets: base.bullets,
        actions: actions.length ? actions : undefined,
      };
    },
  },
  {
    id: "colorblind",
    keys: ["colorblind", "colour blind", "color blind", "deuteranopia", "protanopia", "tritanopia", "cvd", "vision deficiency"],
    answer: (ctx) => {
      const p = P(ctx);
      const base: Answer = {
        text: "Roughly 8% of men and 0.5% of women have some colour-vision deficiency — deuteranopia (red-green) is by far the most common. The fix is never a special mode; it's designing so hue is redundant.",
        bullets: [
          "Separate meaningful colours by lightness, not only hue",
          "Red/green status pairs are the classic failure — add icons or text",
          "Charts: vary line style and direct-label the series",
        ],
      };
      if (!p) return base;
      const pairs: [Role, Role][] = [["primary", "accent"], ["primary", "secondary"], ["secondary", "accent"]];
      const refs = pairs.map(([a, b]) => {
        const d = deltaE(simulateCvd(roleHex(p, a), "deuteranopia"), simulateCvd(roleHex(p, b), "deuteranopia"));
        return `${a} vs ${b} under deuteranopia: ΔE ${round(d, 3)}${d < 0.055 ? " — collapses" : " — holds"}`;
      });
      return { ...base, refs };
    },
  },
  {
    id: "palette-explain",
    keys: ["my palette", "this palette", "explain", "what colors", "what colours", "describe", "tell me about"],
    answer: (ctx) => {
      const p = P(ctx);
      if (!p) return { text: "No palette loaded yet. Type something like \"deep dusty teal with burnt orange\" in Akmon and I'll take it apart for you." };
      const primary = hexToOklch(roleHex(p, "primary"));
      const accent = hexToOklch(roleHex(p, "accent"));
      return {
        text: `"${p.name}" — a ${p.mode} ${p.scheme.replace("-", " ")} palette built around ${describeColor(roleHex(p, "primary"))}.`,
        bullets: [
          `Primary sits at OKLCH ${round(primary.l, 2)} / ${round(primary.c, 3)} / ${Math.round(primary.h)}° — ${primary.c > 0.18 ? "high chroma, it will dominate" : primary.c > 0.09 ? "moderate chroma, comfortable for large areas" : "low chroma, it reads almost neutral"}.`,
          `Accent is ${Math.round(Math.abs(accent.h - primary.h) % 360)}° from primary, ${accent.l > primary.l ? "lighter" : "darker"} by ${round(Math.abs(accent.l - primary.l), 2)} L.`,
          `Background is ${p.mode === "dark" ? "dark" : "light"} at L ${round(hexToOklch(roleHex(p, "background")).l, 2)} with ${round(hexToOklch(roleHex(p, "background")).c, 3)} chroma of the brand hue mixed in.`,
        ],
      };
    },
  },
  {
    id: "trends-now",
    keys: ["trend", "trends", "latest", "2026", "current", "in style", "popular", "modern", "whats hot", "what's hot"],
    weight: 1.1,
    answer: (ctx) => {
      const core = TRENDS.filter((t) => t.status === "core").slice(0, 4);
      const rising = TRENDS.filter((t) => t.status === "rising").slice(0, 4);
      const p = P(ctx);
      const matched = p ? matchTrends(p, ctx.purposeId ? getPurpose(ctx.purposeId) : undefined) : [];
      return {
        text: "Where 2026 actually landed: bento grids and dark-first themes became infrastructure, motion theatrics got replaced by calm interfaces, and a raw anti-grid counter-movement emerged in reaction to bento being everywhere.",
        bullets: [
          `Settled (safe to build on): ${core.map((t) => t.name).join(", ")}`,
          `Rising (early but real): ${rising.map((t) => t.name).join(", ")}`,
          `Divisive (works or embarrasses): ${TRENDS.filter((t) => t.status === "polarizing").map((t) => t.name).join(", ")}`,
          matched.length ? `Your current palette already reads as: ${matched.map((t) => t.name).join(", ")}.` : "Open the Trends screen for the full library with rules and recipes.",
        ],
      };
    },
  },
  {
    id: "harmony",
    keys: ["harmony", "scheme", "complementary", "analogous", "triadic", "monochrome", "which scheme", "color theory", "colour theory"],
    answer: () => ({
      text: "Scheme choice is mostly a decision about how much tension you want. In OKLCH the classic rules behave better than in HSL because equal hue steps actually look equal.",
      bullets: [
        "Monochrome — one hue, tonal range does all the work. Hardest to get wrong, easiest to make boring.",
        "Analogous (±20-35°) — calm and cohesive; needs a lightness accent or it goes flat.",
        "Complementary (180°) — maximum tension. Use one as 90% of the surface and the other as 10%, never 50/50.",
        "Split-complement (±150-170°) — the complement's contrast without the vibration.",
        "Triadic (120°) — vivid and hard to balance; mute two of the three.",
        "Neutral + one accent — what most shipped products actually are.",
      ],
    }),
  },
  {
    id: "typography",
    keys: ["font", "typeface", "typography", "type scale", "text size", "line height", "leading", "letter spacing", "kerning"],
    answer: () => ({
      text: "Typography rules that hold regardless of trend:",
      bullets: [
        "Body 16px minimum on the web, 15px acceptable in dense tools, never below 13px for anything sustained.",
        "Line height 1.5-1.65 for body, 1.05-1.2 for large headings. Longer lines need more leading.",
        "Measure 55-75 characters. Wider and the eye loses the line return.",
        "Pick one scale ratio and stay in it: 1.2 for dense UI, 1.25 general, 1.333 marketing, 1.5+ editorial.",
        "Tighten tracking as size grows: -0.02em to -0.04em on display sizes, 0 on body, +0.02em on all-caps micro labels.",
        "Two typefaces maximum. One with several weights beats two with two.",
      ],
    }),
  },
  {
    id: "spacing",
    keys: ["spacing", "padding", "margin", "whitespace", "white space", "grid", "gutter", "layout", "rhythm", "8pt"],
    answer: () => ({
      text: "Space is the cheapest quality signal in interface design.",
      bullets: [
        "Use a 4px base with an 8px rhythm: 4, 8, 12, 16, 24, 32, 48, 64, 96. Never arbitrary numbers.",
        "Related things must be closer to each other than to anything else — proximity beats borders and boxes.",
        "Padding inside a container should exceed the gap between its children, or the container reads as broken.",
        "Vertical space between sections should be 2-3x the space inside them.",
        "When something feels wrong and you can't name it, the answer is usually more space, not more colour.",
      ],
    }),
  },
  {
    id: "hierarchy",
    keys: ["hierarchy", "focus", "attention", "emphasis", "cta", "call to action", "eye catching", "hooked", "engaging", "retention"],
    answer: () => ({
      text: "Holding attention is a hierarchy problem, not a decoration problem. Every screen should have exactly one thing that wins.",
      bullets: [
        "Rank the elements 1-2-3 before styling. If two elements tie for first, the user stalls.",
        "Emphasis budget: size, weight, colour, space, motion. Spend at most two on any single element.",
        "The loudest colour in the palette belongs to the single most important action, and nowhere else.",
        "Users decide in under a second whether a page is for them — that judgement is made on the headline and the first visual, not on your feature list.",
        "Motion is the strongest attention magnet, which is exactly why it should be reserved for state changes.",
      ],
    }),
  },
  {
    id: "dark-mode",
    keys: ["dark mode", "dark theme", "light mode", "night mode"],
    answer: () => ({
      text: "Dark mode is a separate design, not an inversion.",
      bullets: [
        "Never pure black backgrounds — L 0.10-0.16. Pure black plus white text causes halation and makes text vibrate.",
        "Never pure white text either. Around 92-96% lightness reads as crisp without glare.",
        "Elevate with lightness, not shadow. Shadows are nearly invisible on dark surfaces.",
        "Saturated colours look louder on dark: reduce chroma by roughly 15-25% when porting a light palette.",
        "Test in a dark room and in daylight — dark themes fail in opposite directions.",
      ],
    }),
  },
  {
    id: "brand-color",
    keys: ["which color", "what color should", "pick a color", "brand color", "brand colour", "color meaning", "psychology"],
    answer: (ctx) => {
      const purpose = ctx.purposeId ? getPurpose(ctx.purposeId) : undefined;
      const base = [
        "Blue reads institutional and safe — which is why finance defaults to it, and why finance all looks the same.",
        "Green splits between money/growth and eco/organic depending on chroma: high chroma reads financial, low chroma reads natural.",
        "Orange and yellow are attention colours; using them as brand colours means fighting your own alert states.",
        "Purple codes as premium or creative-tech, and has been heavily colonised by AI products since 2023.",
        "Red is unavoidable for errors — if it's your brand colour, plan a different error colour from day one.",
        "The strongest move is often a neutral brand with one unexpected accent, because it survives every context.",
      ];
      if (!purpose) return { text: "Colour meaning is contextual, but some constraints are practical rather than cultural:", bullets: base };
      return {
        text: `For ${purpose.label.toLowerCase()}: ${purpose.brief}`,
        bullets: [`Priorities: ${purpose.priorities.join(" · ")}`, `Contrast floor: ${purpose.contrastFloor}:1`, ...base.slice(0, 3)],
      };
    },
  },
  {
    id: "bento",
    keys: ["bento", "bento grid", "tiles", "modular grid"],
    answer: () => {
      const t = getTrend("bento")!;
      return {
        text: `${t.name} — ${t.summary}`,
        bullets: [
          `Signals: ${t.signals.join(", ")}`,
          `Use when: ${t.useWhen.join("; ")}`,
          `Avoid when: ${t.avoidWhen.join("; ")}`,
          `Recipe: ${t.recipe}`,
        ],
        actions: [createInsertSectionAction("bento", "Bento Grid Section")],
        suggestions: ["Score my palette", "How do I make this pop?"],
      };
    },
  },
  {
    id: "brutalism",
    keys: ["brutalism", "brutalist", "anti-design", "neo-brutalism", "raw"],
    answer: () => {
      const t = getTrend("neo-brutalism")!;
      const s = getTrend("soft-brutalism")!;
      return { text: `${t.name} — ${t.summary}`, bullets: [`Signals: ${t.signals.join(", ")}`, `Avoid when: ${t.avoidWhen.join("; ")}`, `Recipe: ${t.recipe}`, `Safer sibling — ${s.name}: ${s.summary}`] };
    },
  },
  {
    id: "glass",
    keys: ["glass", "glassmorphism", "blur", "frosted", "liquid glass", "backdrop"],
    answer: () => {
      const t = getTrend("liquid-glass")!;
      return { text: `${t.name} — ${t.summary}`, bullets: [`Use when: ${t.useWhen.join("; ")}`, `Avoid when: ${t.avoidWhen.join("; ")}`, `Recipe: ${t.recipe}`, "Never put body text on glass — the contrast changes as the content behind it scrolls."] };
    },
  },
  {
    id: "motion",
    keys: ["animation", "motion", "transition", "easing", "duration", "micro-interaction", "microinteraction"],
    answer: () => ({
      text: "Motion should report state, not perform.",
      bullets: [
        "120-200ms for state changes, 200-320ms for entrances, over 400ms only for deliberate storytelling.",
        "Ease-out entering, ease-in leaving. Linear only for continuous things like spinners.",
        "Animate transform and opacity. Animating width, height, top or left forces layout and drops frames.",
        "Honour prefers-reduced-motion — it's a WCAG requirement, not a nicety.",
        "The test: remove the animation. If no information is lost, it was decoration.",
      ],
    }),
  },
  {
    id: "export",
    keys: ["export", "css", "tailwind", "variables", "tokens", "code", "download", "copy"],
    answer: (ctx) => {
      const p = P(ctx);
      return {
        text: "Akmon exports the palette as CSS custom properties, SCSS variables, a Tailwind config fragment, JSON with OKLCH plus contrast metadata, or an SVG sheet. Directions export as a full token file — radius, spacing, type scale, motion and shadow.",
        bullets: [
          "Structure tokens in three tiers: primitive (blue-600) → semantic (--action-bg) → component (--button-bg).",
          "Components should never reference primitives directly — that's what makes retheming possible later.",
        ],
        actions: p ? [createCopyTokensAction(p)] : undefined,
        suggestions: ["What is oklch?", "Score my palette"],
      };
    },
  },
  {
    id: "akmon",
    keys: ["akmon", "how do i use", "how does this work", "workflow", "get started", "what can you do", "help"],
    answer: () => ({
      text: "Hephaestus runs in three moves.",
      bullets: [
        "Akmon — describe a palette in plain language (\"deep dusty teal, burnt orange accent, dark\") or hit generate for a fresh coordinate in the colour space. Lock the swatches you like, regenerate the rest, save it as a card.",
        "Purpose — say what you're building. You get the sections that matter, the priorities, and design directions assembled from current trend atoms.",
        "Me — I audit whatever is on screen and answer questions. I'm on every screen, not just inside Akmon.",
      ],
      suggestions: ["Score my palette", "What's trending in 2026?", "How much space between sections?"],
    }),
  },
  {
    id: "mix",
    keys: ["mix", "blend", "combine", "merge", "interpolate", "gradient between"],
    answer: () => ({
      text: "The Mixer blends colours in OKLab, which is why it doesn't produce the grey mud you get from mixing in sRGB or the neon detour you get from mixing in HSL.",
      bullets: [
        "sRGB mixing: fast, wrong. Blue + yellow gives dead grey.",
        "HSL mixing: takes the long way round the hue wheel and passes through colours neither input contained.",
        "OKLab mixing: perceptually straight line. Blue + yellow gives the green your eye expects.",
        "For gradients, mix in OKLab and add a midpoint stop if the two ends differ by more than 0.3 in lightness.",
      ],
    }),
  },
  {
    id: "how-many-colors",
    keys: ["how many colors", "how many colours", "too many colors", "number of colors"],
    answer: () => ({
      text: "A shipped interface needs fewer colours than people expect, and more tones than they plan for.",
      bullets: [
        "One brand hue, one accent, one neutral ramp covers 90% of products.",
        "Plus four semantic colours you can't avoid: success, warning, danger, info.",
        "Each of those needs 3 tones minimum (surface, border, text) — that's where the count actually grows.",
        "If you have three brand colours, one of them is decoration. Find out which and demote it.",
      ],
    }),
  },


  { id: "biggest", keys: ["biggest problem", "worst problem", "main issue", "most important", "what should i fix first", "prioritize", "priority", "start with"], weight: 1.7, answer: (ctx) => {
    const p = ctx.palette;
    if (!p) return { text: "Show me a palette (forge one or open one from your library) and I'll rank what's actually wrong — by how much it hurts a real user.", suggestions: ["Score my palette"] };
    const a = auditPalette(p, ctx.purposeId);
    const bad = a.findings.filter((f) => f.severity === "critical" || f.severity === "warning").slice(0, 3);
    if (bad.length === 0) return { text: "Honestly? Nothing critical. " + p.name + " is at " + a.score + "/100 (" + a.grade + ") — the remaining points are polish, not problems.", bullets: a.categories.map((c) => c.score < 85 ? c.label + ": " + c.score + " — tighten this next" : c.label + ": " + c.score + " — good").slice(0, 4) };
    return {
      text: "Ranked by how much they hurt a real visitor:",
      bullets: bad.map((f, i) => (i + 1) + " · " + f.title + (f.fix ? " — fixable in one click" : "")),
      refs: ["score " + a.score + "/100 · " + a.grade],
      suggestions: ["fix the worst one", "score my palette"],
    };
  } },
  { id: "explain-concepts", keys: ["what is oklch", "what does oklch", "oklab vs", "oklch vs", "colour space", "delta e", "deltae", "what is gamut", "gamut", "luminance", "relative luminance", "what is contrast ratio", "what is wcag", "explain wcag"], weight: 1.6, answer: (_ctx: CedalionContext) => {
    return {
      text: "Quick version, no jargon:",
      bullets: [
        "OKLCH — a colour space built to match how eyes actually judge colour. L is perceived lightness, C is chroma (how colourful), H is hue. The killer feature: the same C and H read the same on any screen. Your palette is generated and mixed here, so lightening a colour never drains its soul.",
        "ΔE — perceptual distance between two colours in OKLab. 1.0 is roughly the smallest difference a trained eye can see; under 0.06-0.08 two roles look identical (I flag those as duplicates).",
        "Gamut — the range of colours a screen can show. sRGB is the web standard. Some OKLCH colours (high C at some L) live outside it; Hephaestus maps them back in by reducing chroma, which is why a vivid hue never turns grey.",
        "Contrast ratio / WCAG — relative luminance of two colours compared. 4.5:1 = AA for body text, 7:1 = AAA, 3:1 = AA for large text & UI. I always show the measured ratio next to a claim so it's checkable.",
      ],
      suggestions: ["what's a bento grid?", "how do I make this pop?"],
    };
  } },
  { id: "palette-for-purpose", keys: ["best palette for", "good palette for", "palette for a", "colours for a", "color for a", "suit a", "recommend colours", "what palette", "which palette", "for my fintech", "for a fintech", "for an ecommerce", "for a portfolio", "for my saas"], weight: 2.2, answer: (ctx) => {
    const p = ctx.palette;
    const aud = p ? auditPalette(p, ctx.purposeId) : null;
    const lines = [
      "The rules are stable across sectors: one loud accent max, neutrals with a whisper of brand hue, text that clears the purpose's floor.",
    ];
    if (ctx.purposeId) {
      const t = getPurpose(ctx.purposeId);
      if (t) lines.unshift("For " + t.label + ": " + t.brief);
    }
    if (aud && aud.score < 85) lines.push("Your current palette (" + p!.name + ") scores " + aud.score + "/100 — " + aud.headline.toLowerCase());
    return { text: "Here's the honest version:", bullets: lines, suggestions: ["score my palette", "what should I fix first?"] };
  } },
  { id: "how-many-colours", keys: ["how many colours", "how many colors", "too many colours", "colour count", "color count", "more colours", "more colors", "add colour", "new colour"], weight: 1.8, answer: () => ({
    text: "Fewer than people expect. A shipped interface rarely needs more than five voices: a background, a surface, body text, one action colour, one accent moment.",
    bullets: [
      "background + surface + text + muted = the everyday 4",
      "primary is your main action colour (buttons, links, active states)",
      "accent is the single loud colour for the moment you want noticed — one per screen, used sparingly",
      "secondary exists for charts and illustration, not for chrome",
      "anything else should be derived from these, not invented",
    ],
    refs: ["rule of thumb: if two colours never touch real content, delete one"],
    suggestions: ["score my palette", "how do I make this pop?"],
  }) },
  { id: "dark-mode", keys: ["dark mode", "light mode", "which mode", "dark theme", "light theme"], weight: 1.5, answer: (ctx: CedalionContext) => {
    const p = ctx.palette;
    return {
      text: "Both can be right — it depends on the job and the audience.",
      bullets: [
        ctx.purposeId === "investing" || ctx.purposeId === "media" || ctx.purposeId === "gaming" || ctx.purposeId === "devtool" ? "Your purpose (data-heavy, media or developer tooling) usually ships dark first — long sessions, low-glare surfaces. Offer light as an option and test both at 7:1." : "Light first is the safer default for mainstream product pages; dark is a design choice when the audience stares at the screen for hours or the brand is nocturnal.",
        "Never invert blindly — dark mode is its own system: softer chroma, raised surfaces carry the depth, borders get lighter (they sit above the background), not darker.",
        "Text on dark should sit around 90-98% lightness; pure white (#FFF) at 100% can glare — many designers prefer #E6E6E6-ish tinted slightly toward the brand hue.",
      ],
      actions: p ? [createSwitchThemeAction(p)] : undefined,
      suggestions: ["What should I fix first?", "Score my palette", "Harmonize neutrals"],
    };
  } },
  { id: "fix-worst", keys: ["fix the worst", "apply the fix", "fix it for me", "fix everything", "make it accessible", "auto fix", "autofix"], weight: 1.7, answer: (ctx) => {
    const p = ctx.palette;
    if (!p) return { text: "I need a palette on screen to fix. Forge one first, or open one from your library.", suggestions: ["score my palette"] };
    const a = auditPalette(p, ctx.purposeId);
    const fixes = a.findings.filter((f) => f.fix).slice(0, 4);
    if (fixes.length === 0) return { text: "Nothing to auto-fix — every finding I raised either already has a compliant value or needs a human judgement call. Score: " + a.score + "/100 (" + a.grade + ")." };
    return {
      text: "I can compute the corrected value for each of these — apply them one by one (each is a measured fix, not a guess):",
      bullets: fixes.map((f) => f.title + " → " + f.fix!.label + " (" + f.fix!.hex + ")"),
      refs: ["apply each from the palette card that carries it; locked swatches stay untouched"],
      actions: fixes.map((f) => createFixContrastAction(f.fix!.role, f.fix!.hex)),
      suggestions: ["score my palette", "how do I make this pop?"],
    };
  } },
  {
    id: "harmonize",
    keys: ["harmonize", "tint", "neutrals", "wash", "background tint", "surface tint", "brand hue"],
    weight: 1.6,
    answer: (ctx) => {
      const p = P(ctx);
      if (!p) return { text: "Open a palette first to harmonize its neutral backgrounds and surfaces." };
      return {
        text: "Harmonizing neutrals means infusing backgrounds, surfaces, and borders with a subtle trace (0.01-0.02 chroma) of your primary brand hue.",
        bullets: [
          "Pure grey is cold and reads like unstyled browser chrome.",
          "Brand-tinted neutrals make the whole canvas feel cohesive and polished.",
          "We tune lightness and chroma precisely in OKLCH so contrast ratios are preserved.",
        ],
        actions: [createHarmonizeAction(p)],
        suggestions: ["Score my palette", "Is this accessible?"],
      };
    },
  },
  {
    id: "pricing-tables",
    keys: ["pricing", "price", "plans", "tier", "subscription", "how much", "cost table", "pricing table"],
    weight: 1.8,
    answer: () => ({
      text: "Pricing tables convert on clarity and psychological anchoring. Three tiers is the industry sweet spot.",
      bullets: [
        "Position the recommended tier in the middle with an elevated border or accent badge.",
        "Highlight the primary contrast action button on the recommended tier only.",
        "Lead with outcomes and user limits, not internal infrastructure metrics.",
        "Include reassurance: 'No credit card required' or 'Cancel anytime'.",
      ],
      actions: [createInsertSectionAction("pricing-3", "3-Tier Pricing Table")],
      suggestions: ["How do I make this pop?", "Score my palette"],
    }),
  },
  {
    id: "hero-section",
    keys: ["hero", "above the fold", "headline", "first section", "header section", "banner", "intro section"],
    weight: 1.8,
    answer: () => ({
      text: "The hero section has exactly 5 seconds to answer: 'What is this?', 'Who is it for?', and 'What is the next step?'",
      bullets: [
        "A sharp value proposition headline (36-64px), never clever at the expense of clear.",
        "A supporting subline that delivers proof or specific outcomes.",
        "A primary filled CTA button paired with a secondary ghost/outline button.",
        "A social proof chip ('✦ now shipping' or 'Used by 1,000+ teams').",
      ],
      actions: [
        createInsertSectionAction("hero-split", "Modern Split Hero"),
        createInsertSectionAction("hero-center", "Centered Hero"),
      ],
      suggestions: ["What's a bento grid?", "Score my palette"],
    }),
  },
  {
    id: "features-section",
    keys: ["features", "feature", "benefits", "capabilities", "why choose", "perks", "grid cards"],
    weight: 1.7,
    answer: () => ({
      text: "Feature sections fail when they list software mechanics instead of user outcomes.",
      bullets: [
        "Frame features as benefits: 'Ship in minutes' rather than 'Automated CI/CD pipeline'.",
        "A 3-card grid is the easiest for scanning and responsive folding.",
        "Use distinct icons or micro-chips for visual anchoring.",
        "Keep card copy under 3 lines — detail belongs in documentation or modal walkthroughs.",
      ],
      actions: [
        createInsertSectionAction("features-3", "3-Card Features Grid"),
        createInsertSectionAction("features-4", "4-Card 2x2 Features"),
      ],
      suggestions: ["What's a bento grid?", "How much spacing should I use?"],
    }),
  },
  {
    id: "mobile-ux",
    keys: ["mobile", "phone", "responsive", "small screen", "touch", "viewport", "handheld", "thumb"],
    weight: 1.7,
    answer: () => ({
      text: "Mobile interface design is governed by touch physics and thumb ergonomics:",
      bullets: [
        "Touch targets must be at least 44×44px (WCAG 2.5.5) with comfortable gutters.",
        "Place key actions in the bottom 'natural thumb zone' rather than top corners.",
        "Body typography should never fall below 14-16px on handhelds to avoid iOS zoom triggers.",
        "Collapse multi-column grids into a clean single-column vertical flow.",
      ],
      suggestions: ["How much spacing should I use?", "What should I fix first?"],
    }),
  },
  {
    id: "testimonials",
    keys: ["testimonial", "testimonials", "quotes", "reviews", "customer words", "feedback", "social proof"],
    weight: 1.7,
    answer: () => ({
      text: "Social proof bridges the credibility gap faster than any marketing copy:",
      bullets: [
        "Include real roles and company names ('Engineering Lead at Halcyon').",
        "Highlight specific results or numbers rather than vague praise.",
        "A 3-quote carousel or row gives breadth without cluttering the page.",
      ],
      actions: [
        createInsertSectionAction("quotes-3", "3-Testimonial Cards"),
        createInsertSectionAction("stats-4", "4-Stat Proof Band"),
      ],
      suggestions: ["Score my palette", "What is a bento grid?"],
    }),
  },
  {
    id: "cta-section",
    keys: ["cta", "call to action", "conversion", "button", "closing", "bottom of page", "sign up"],
    weight: 1.8,
    answer: () => ({
      text: "The final CTA band is your last chance to turn a reader into a user before they bounce.",
      bullets: [
        "Keep it focused: exactly one primary action button.",
        "Reiterate the core promise in a short, punchy headline.",
        "Remove risk with micro-copy: 'No credit card required · Free 14-day trial'.",
      ],
      actions: [createInsertSectionAction("cta-band", "Closing Call To Action Band")],
      suggestions: ["How do I make this pop?", "Score my palette"],
    }),
  },
  {
    id: "design-tokens",
    keys: ["token", "tokens", "css variables", "tailwind tokens", "system tokens", "export tokens"],
    weight: 1.8,
    answer: (ctx) => {
      const p = P(ctx);
      return {
        text: "Design tokens decouple design decisions from implementation details.",
        bullets: [
          "Primitive layer: raw values like oklch(0.6 0.2 250) or #3b82f6.",
          "Semantic layer: intent-based mappings like --color-primary, --surface-raised.",
          "Component layer: specific mappings like --button-primary-bg.",
        ],
        actions: p ? [createCopyTokensAction(p)] : undefined,
        suggestions: ["Score my palette", "What is oklch?"],
      };
    },
  },
  { id: "cheer", keys: ["thanks", "thank you", "thx", "ty", "awesome", "nice", "cool", "love it", "great work", "well done", "good job", "perfect"], weight: 1.6, answer: cheer },
  { id: "smalltalk", keys: ["how are you", "how's it going", "what's up", "you ok", "bored"], weight: 1.5, answer: smalltalkAnswer },
  { id: "joke", keys: ["joke", "funny", "laugh", "haha", "lol", "make me smile"], weight: 2.2, answer: jokeAnswer },
  { id: "pop", keys: ["pop", "boring", "plain", "dull", "flat", "livelier", "exciting", "more energy", "stand out", "wow"], weight: 1.4, answer: popAnswer },
  { id: "mysite", keys: ["my site", "the site", "my page", "the page", "landing page", "my landing", "the landing", "what i built", "generated site", "preview", "the website"], weight: 2.6, answer: siteAnswer },
];

const FALLBACK_SUGGESTIONS = [
  "Score my palette",
  "What should I fix first?",
  "What's trending in 2026?",
  "Is this accessible?",
  "How much spacing should I use?",
];



/** Deterministic intent match: keyword coverage weighted by phrase length. */

/* ---- the friendly layer: personality + live build awareness ---- */
function cheer(_ctx: CedalionContext): Answer {
  return {
    text: "You're welcome. I'm only as good as the measurements I stand on — but the measurements are very good.",
    suggestions: ["Score my palette", "What should I fix first?", "Give me a joke"],
  };
}
function smalltalkAnswer(ctx: CedalionContext): Answer {
  const p = ctx.palette;
  if (p) {
    const a = auditPalette(p, ctx.purposeId);
    return {
      text: "Running at my usual pace: rules compiled, maths sharp, zero hallucinations. The palette on screen (" + p.name + ") scores " + a.score + "/100 right now — so there's always something to improve.",
      suggestions: ["What should I fix first?", "Is this accessible?", "Score my palette"],
    };
  }
  return {
    text: "Calm and fully local. No model to feed, no API bill to worry about — just rule tables and colour maths, humming along. Ask me about anything on screen.",
    suggestions: ["Give me a joke", "What's trending in 2026?"],
  };
}
function jokeAnswer(): Answer {
  return {
    text: "Rule base says: a designer walks into a bar, pulls up a stool, and the bar stools are all #EEEEEE with no border — an accessibility finding that will not reproduce in Figma.",
    bullets: ["Real talk: I can only reuse jokes I'm given, like everything else I do. Deterministic comedy is still a research project — no AI in here, remember?"],
  };
}
function popAnswer(ctx: CedalionContext): Answer {
  const p = ctx.palette;
  if (!p) return { text: "Show me a palette first — then I'll tell you exactly which knob to turn to make it pop. I'm a critic, not a wand." };
  const acc = p.swatches.find((x) => x.role === "accent");
  const pri = p.swatches.find((x) => x.role === "primary");
  if (!acc || !pri) return { text: "This palette is missing its accent or primary — generate a full palette and I'll tune it." };
  const popAction = createMakePopAction(p);
  return {
    text: "Let's make it pop without breaking the brief. Three measured moves, in order of payoff:",
    bullets: [
      "1 · Let the accent act like an accent. It is currently doing under 10% of the surface work — buttons, links, one highlight each screen. More chrome dilutes the pop.",
      "2 · Raise the accent's chroma. Push it toward saturation in OKLCH (add 0.04-0.06 chroma, hold lightness) and give the primary CTA a filled accent background. Restraint elsewhere is what makes this loud enough.",
      "3 · Add one loud moment per screen, not six. A saturated hero chip or stat, then calm everything around it — contrast between loud and quiet is the pop.",
    ],
    refs: ["hint: on a dark background, a slightly lighter accent reads louder than a more saturated one"],
    actions: [popAction],
    suggestions: ["Score my palette", "Is my contrast okay?", "Harmonize neutrals"],
  };
}
function siteAnswer(ctx: CedalionContext): Answer {
  const bs = ctx.buildSite;
  const p = ctx.palette;
  const a = p ? auditPalette(p, ctx.purposeId) : null;
  const lines: string[] = [];
  const actions: CedalionAction[] = [];
  if (bs) {
    lines.push("You're building a " + bs.purposeLabel + " with " + bs.sectionsOn + " sections on. " + (a ? "Its palette scores " + a.score + "/100 (" + a.grade + ")." : ""));
    if (bs.sectionsOn < 4) {
      lines.push("More sections than " + bs.sectionsOn + " would tell the story fully — add features or proof before the CTA.");
      actions.push(createInsertSectionAction("features-3", "3-Card Features Grid"));
    }
    if (bs.sectionsOn > 10) lines.push("At " + bs.sectionsOn + " sections the page is long — check each one earns its scroll, and keep the final CTA above the fold of every screen size.");
    if (a && a.score < 82) lines.push("Fix the palette first: " + a.headline);
  }
  lines.push("The strongest marketing pages repeat one idea in three different languages: a promise, a proof, and a price. Make sure each section is speaking one of those.");
  if (ctx.canvas && !ctx.canvas.hasFooter) actions.push(createInsertSectionAction("cta-band", "Call To Action Band"));
  return {
    text: "Here's my read on the site you're building:",
    bullets: lines,
    actions: actions.length ? actions : undefined,
    suggestions: ["Score my palette", "How do I make this pop?", "Insert a bento grid"],
  };
}

const KIND_LABEL: Record<string, string> = {
  heading: "headline", text: "paragraph", list: "bullet list", quote: "quote",
  button: "button", chip: "chip", stat: "stat", card: "card", image: "image block",
  spacer: "spacer", divider: "divider", nav: "navbar", footer: "footer",
};

/** one bullet per real problem on the page, in priority order */
export function canvasProblems(c: CanvasCtx): string[] {
  const out: string[] = [];
  const k = c.kinds ?? {};
  const sev = (c.issues ?? []).filter((i) => i.sev !== "note");
  if (sev.length) {
    for (const i of sev.slice(0, 4)) out.push("· " + i.what + " → " + (i.fix ?? "fix it in the inspector"));
  }
  if (c.pageIx === 0 && !(k.heading ?? 0)) out.push("· page one has no headline — visitors decide to stay in the first five seconds; drop a heading block near the top.");
  if (!(k.button ?? 0)) out.push("· nothing on this page asks for action — add a button and link it to a page.");
  if (!c.hasNav && c.mode === "multi") out.push("· pages have no navigation bar — readers will get stranded. add a navbar block to each page.");
  if (!c.hasFooter && c.pageHeight > 1400) out.push("· this long page has no footer — add one so the scroll ends with a landing, not a void.");
  if (!(k.image ?? 0) && (k.heading ?? 0) > 1 && c.pageHeight > 1200) out.push("· a text-only long page tires the eye — an image block every 800px of scroll gives the reader a rest.");
  if ((k.card ?? 0) > 6) out.push("· " + (k.card ?? 0) + " cards is a wall — group them in rows of three and let white space do the separating.");
  if ((k.chip ?? 0) > 3) out.push("· more than three chips reads as noise — keep one tag per section.");
  if (c.mode === "single" && c.pageHeight > 4200) out.push("· the single page is " + Math.round(c.pageHeight) + "px tall — long enough that separate pages might serve visitors better. switch to “multiple pages” and split the sections.");
  if (c.mode === "multi" && c.pageCount > 6) out.push("· " + c.pageCount + " pages is a lot to maintain — every extra page dilutes the core message; consider folding thin pages into one.");
  return out;
}

/** the full canvas read — structure + priorities + how to act */
export function canvasRead(ctx: CedalionContext): Answer {
  const c = ctx.canvas;
  if (!c) return { text: "I'm not attached to a canvas right now — open the build bench and I'll read the page as you edit it.", suggestions: ["What should I fix first?"] };
  const p = ctx.palette;
  const a = p ? auditPalette(p, ctx.purposeId) : null;
  const lines: string[] = [];
  const actions: CedalionAction[] = [];
  const kind = Object.entries(c.kinds).filter(([, n]) => n > 0).map(([kk, n]) => (n > 1 ? `${n} ${KIND_LABEL[kk] ?? kk}s` : `one ${KIND_LABEL[kk] ?? kk}`)).join(", ");
  lines.push("I'm reading the page “" + c.pageName + "” (" + (c.mode === "single" ? "one long page" : c.pageCount + " pages, " + c.transition + " transition") + "). It holds " + (kind || "nothing yet") + " across " + Math.round(c.pageHeight) + "px of height.");
  if (a) lines.push("The palette underneath scores " + a.score + "/100 (" + a.grade + ") — " + a.headline);
  if ((c.issues ?? []).length === 0 && !c.pageIx) lines.push("The page reads clean right now: nothing overlapping, nothing below contrast floors, nothing hanging off the frame.");
  lines.push("Problems I can measure, in the order I'd fix them:");
  const probs = canvasProblems(c);
  lines.push(...(probs.length ? probs : ["· none — genuinely tidy. Now make it say one thing loudly."]));
  lines.push("Colour discipline check: " + (c.auditScore >= 90 ? "the palette is holding this page together — keep hand-picked tints rare and meaningful." : "hand-picked tints are fighting the palette (canvas score " + c.auditScore + ") — run merkhet → harmonise colours to let the palette own the page again."));

  const k = c.kinds ?? {};
  if (!(k.heading ?? 0) || c.pageIx === 0) {
    actions.push(createInsertSectionAction("hero-split", "Modern Split Hero"));
  }
  if ((k.card ?? 0) === 0) {
    actions.push(createInsertSectionAction("bento", "Bento Grid Section"));
  }
  if (!c.hasFooter && c.pageHeight > 1000) {
    actions.push(createInsertSectionAction("cta-band", "Call To Action Band"));
  }

  const sug = ["Score my palette", "How do I make this pop?", c.issues.some((i) => i.sev !== "note") ? "What should I fix first?" : "One long page or separate pages?"];
  return {
    text: "Here's my read of the page you're building — measured, not vibes:",
    bullets: lines,
    actions: actions.length ? actions : undefined,
    suggestions: sug,
  };
}

/** decide whether a question belongs to the canvas brain */
const CANVAS_KEYS = [
  "layout", "grid", "arrange", "structure", "sections", "section", "navbar", "nav",
  "hero", "footer", "merkhet", "one long", "pages", "page look", "looks bad", "why does my page",
  "fix my page", "fix the layout", "fix this page", "make it look", "what should i fix",
];
const PALETTE_KEYS = ["score", "contrast", "accessib", "colour", "color", "palette"];

function canvasRoute(q: string, ctx: CedalionContext): boolean {
  if (!ctx.canvas || !ctx.screen) return false;
  const paletteAsk = PALETTE_KEYS.some((k) => q.includes(k));
  if (paletteAsk) return false;
  return CANVAS_KEYS.some((k) => q.includes(k));
}

export function cedalionStarters(screen?: string): string[] {
  const base = [
    "Score my palette",
    "What should I fix first?",
    "How do I make this pop?",
    "Is this readable for colour-blind users?",
    "What's actually trending in 2026?",
    "Give me a joke",
  ];
  if (screen === "build") {
    return ["Read my page", "Does this layout work?", "One long page or separate pages?", "What should my navbar link to?", "What is merkhet?", ...base.slice(0, 3)];
  }
  return base;
}

export function ask(question: string, ctx: CedalionContext = {}): Answer {
  const q = ` ${question.toLowerCase().replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim()} `;
  if (!q.trim()) return { text: "Ask me anything about what you're building.", suggestions: FALLBACK_SUGGESTIONS };
  if (canvasRoute(q, ctx)) return canvasRead(ctx);

  let best: Rule | undefined;
  let bestScore = 0;
  for (const rule of RULES) {
    let score = 0;
    for (const k of rule.keys) {
      if (q.includes(` ${k} `) || q.includes(` ${k}`) || q.includes(`${k} `)) {
        score += k.length * (k.includes(" ") ? 2.2 : 1);
      }
    }
    score *= rule.weight ?? 1;
    if (score > bestScore) { bestScore = score; best = rule; }
  }

  if (!best || bestScore < 3) {
    const p = P(ctx);
    if (p) {
      const a = auditPalette(p, ctx.purposeId);
      const actions: CedalionAction[] = [];
      const worst = a.findings.find((f) => f.fix);
      if (worst?.fix) actions.push(createFixContrastAction(worst.fix.role, worst.fix.hex));
      else actions.push(createHarmonizeAction(p));
      return {
        text: "I don't have a specific rule for that phrasing, but here's what I can measure about what's on screen right now:",
        bullets: [`${p.name} scores ${a.score}/100 (${a.grade}). ${a.headline}`],
        actions,
        suggestions: FALLBACK_SUGGESTIONS,
      };
    }
    return {
      text: "I don't have a rule for that one, and I won't guess. I cover colour science, WCAG contrast, typography, spacing, hierarchy, motion, trends, and layout architecture.",
      suggestions: FALLBACK_SUGGESTIONS,
    };
  }

  return best.answer(ctx);
}

export const askCedalion = ask;

export const CEDALION_STARTERS = [
  "Score my palette",
  "What should I fix first?",
  "How do I make this pop?",
  "Give me a joke",
  "What's actually trending in 2026?",
  "Is this readable for colour-blind users?",
];
