/**
 * HEPHAESTUS · direction engine
 *
 * Recombines trend atoms into complete, compatible design directions.
 * The idea space is combinatorial, not generative: every direction is
 * assembled from parts that real 2026 interfaces are actually made of,
 * then scored against the purpose so incompatible pairs never surface.
 */

import {
  ATOM_GROUPS, DIRECTION_SPACE, getPurpose, getTrend,
  type Atom, type AtomGroup, type Purpose,
} from "../data/trends";
import { hexToOklch } from "./color";
import { hashString, type Palette } from "./akmon";

export type Direction = {
  id: string;
  name: string;
  atoms: Record<AtomGroup, Atom>;
  fit: number;                 // 0..100
  rationale: string[];
  cautions: string[];
  trendIds: string[];
  spec: DirectionSpec;
};

export type DirectionSpec = {
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

const NAME_A = ["Quiet", "Hard", "Warm", "Cold", "Open", "Tight", "Bright", "Deep", "Plain", "Sharp", "Slow", "Loud", "Clean", "Raw", "Still"];
const NAME_B = ["Signal", "Ledger", "Atlas", "Foundry", "Column", "Circuit", "Terrace", "Beacon", "Lattice", "Anvil", "Harbor", "Quarry", "Meridian", "Vault", "Prism"];

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

/** How well one atom serves this purpose and palette. -100..100 */
function scoreAtom(atom: Atom, purpose: Purpose, palette?: Palette): number {
  let s = 0;
  if (atom.fits.includes(purpose.group)) s += 40;
  for (const t of atom.from) {
    if (purpose.favours.includes(t)) s += 22;
    if (purpose.resists.includes(t)) s -= 45;
    const trend = getTrend(t);
    if (trend?.status === "core") s += 8;
    if (trend?.status === "rising") s += 5;
    if (trend?.status === "cooling") s -= 6;
  }
  if (palette) {
    const accent = palette.swatches.find((x) => x.role === "accent");
    const chroma = accent ? hexToOklch(accent.hex).c : 0.15;
    if (atom.id === "color-high-chroma" && chroma < 0.14) s -= 25;
    if (atom.id === "color-earth" && chroma > 0.2) s -= 25;
    if (atom.id === "color-neon-dark" && palette.mode === "light") s -= 30;
    if (atom.id === "color-mono-accent" && chroma > 0.1) s += 10;
    if (atom.id === "color-clinical" && chroma > 0.22) s -= 15;
  }
  return s;
}

function compatible(chosen: Atom[], candidate: Atom): boolean {
  for (const a of chosen) {
    if (a.conflicts?.includes(candidate.id)) return false;
    if (candidate.conflicts?.includes(a.id)) return false;
  }
  return true;
}

function buildSpec(atoms: Record<AtomGroup, Atom>, rng: () => number): DirectionSpec {
  const brutal = atoms.surface.id === "surf-hard" || atoms.type.id === "type-mono";
  const soft = atoms.surface.id === "surf-elevated" || atoms.type.id === "type-humanist";
  const glass = atoms.surface.id === "surf-glass";
  const dense = atoms.type.id === "type-compact" || atoms.layout.id === "dashboard-cards";

  const radius = brutal ? Math.round(rng() * 2) : glass ? 14 + Math.round(rng() * 12) : soft ? 12 + Math.round(rng() * 10) : 6 + Math.round(rng() * 6);
  const borderWidth = brutal ? 2 + Math.round(rng()) : 1;
  const spacingUnit = dense ? 4 : 8;
  const typeScale = atoms.type.id === "type-giant" ? 1.5 : dense ? 1.2 : 1.25 + rng() * 0.15;
  const baseFontPx = dense ? 13 : atoms.layout.id === "single-column" ? 18 : 15 + Math.round(rng() * 2);
  const maxWidth = atoms.layout.id === "single-column" ? 720 : atoms.layout.id === "sidebar-shell" ? 1600 : 1200;
  const motionMs = atoms.motion.id === "motion-none" ? 0 : atoms.motion.id === "motion-scroll" ? 420 : atoms.motion.id === "motion-physical" ? 320 : 180;

  const shadow =
    atoms.surface.id === "surf-hard" ? "4px 4px 0 var(--text)" :
    atoms.surface.id === "surf-elevated" ? "0 18px 40px -14px color-mix(in oklab, var(--accent) 40%, transparent)" :
    atoms.surface.id === "surf-glass" ? "0 8px 32px -8px rgb(0 0 0 / 0.28)" :
    "none";

  const fontStack =
    atoms.type.id === "type-mono" ? "ui-monospace, 'JetBrains Mono', 'SF Mono', monospace" :
    atoms.type.id === "type-serif-body" ? "'Instrument Serif', Georgia, 'Times New Roman', serif" :
    atoms.type.id === "type-humanist" ? "'Inter', system-ui, -apple-system, sans-serif" :
    "'Inter Tight', system-ui, -apple-system, 'Helvetica Neue', sans-serif";

  return { radius, borderWidth, spacingUnit, typeScale, baseFontPx, maxWidth, motionMs, shadow, fontStack };
}

export function generateDirections(
  purposeId: string,
  palette?: Palette,
  seed = 1,
  count = 6
): Direction[] {
  const purpose = getPurpose(purposeId);
  if (!purpose) return [];

  const out: Direction[] = [];
  const groups = Object.keys(ATOM_GROUPS) as AtomGroup[];

  for (let n = 0; n < count; n++) {
    const rng = mulberry32(hashString(`${purposeId}:${palette?.id ?? "none"}:${seed}:${n}`));
    const chosen: Atom[] = [];
    const atoms = {} as Record<AtomGroup, Atom>;

    for (const g of groups) {
      const safeOnly = n < Math.ceil(count / 2);
      const scoredPool = (ATOM_GROUPS[g] as readonly Atom[])
        .filter((a) => compatible(chosen, a))
        .map((a) => ({ a, s: scoreAtom(a, purpose, palette) }))
        .sort((x, y) => y.s - x.s);
      // The first half of the set never contradicts the purpose; the second
      // half is allowed to argue with it, and gets flagged when it does.
      const pool = safeOnly ? scoredPool.filter((x) => x.s > -10) : scoredPool;
      if (!pool.length) { if (scoredPool.length) { atoms[g] = scoredPool[0].a; chosen.push(scoredPool[0].a); } continue; }

      // Softmax-ish pick weighted by score, with an exploration temperature
      // that widens as n grows — direction 1 is safe, direction 6 is brave.
      const temp = 0.35 + (n / Math.max(1, count - 1)) * 1.15;
      const weights = pool.map(({ s }) => Math.exp((s / 40) / temp));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      let idx = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) { idx = i; break; }
      }
      const picked = pool[idx].a;
      atoms[g] = picked;
      chosen.push(picked);
    }

    const scores = groups.map((g) => scoreAtom(atoms[g], purpose, palette));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const worst = Math.min(...scores);
    // Fit is dragged down by its weakest part — a direction is only as
    // appropriate as its most inappropriate decision.
    const blended = avg * 0.6 + worst * 0.4;
    const fit = Math.max(4, Math.min(100, Math.round(50 + blended * 0.85)));

    const trendIds = Array.from(new Set(chosen.flatMap((a) => a.from)));
    const rationale: string[] = [];
    const cautions: string[] = [];

    for (const g of groups) {
      const a = atoms[g];
      if (a.fits.includes(purpose.group)) {
        rationale.push(`${a.label} — ${a.note}`);
      }
      const clashing = a.from.filter((t) => purpose.resists.includes(t));
      if (clashing.length) {
        const names = clashing.map((t) => getTrend(t)?.name ?? t).join(", ");
        cautions.push(`${a.label} pulls from ${names}, which usually fights ${purpose.label.toLowerCase()}. Deliberate choice or drop it.`);
      }
    }
    if (rationale.length < 3) {
      rationale.push(`${atoms.layout.label} + ${atoms.type.label} is an unusual pairing for ${purpose.label.toLowerCase()} — that is the point of this direction.`);
    }
    if (purpose.contrastFloor >= 7 && atoms.surface.id === "surf-glass") {
      cautions.push("Glass surfaces make guaranteeing 7:1 contrast hard. Keep blur on chrome only, never behind body text.");
    }

    const name = `${NAME_A[Math.floor(rng() * NAME_A.length)]} ${NAME_B[Math.floor(rng() * NAME_B.length)]}`;

    out.push({
      id: `dir_${purposeId}_${seed}_${n}`,
      name,
      atoms,
      fit,
      rationale: rationale.slice(0, 4),
      cautions,
      trendIds,
      spec: buildSpec(atoms, rng),
    });
  }

  return out.sort((a, b) => b.fit - a.fit);
}

/** Human-readable size of the compatible direction space. */
export function directionSpaceSize(): { raw: number; label: string } {
  return {
    raw: DIRECTION_SPACE,
    label: DIRECTION_SPACE.toLocaleString("en-US"),
  };
}

/** A direction rendered as design tokens the user can paste into a project. */
export function directionToTokens(d: Direction, palette?: Palette): string {
  const p = palette
    ? palette.swatches.map((s) => `  --${s.role}: ${s.hex};`).join("\n")
    : "  /* pick a palette in Akmon to fill these */";
  const s = d.spec;
  return `/* ${d.name} — ${Object.values(d.atoms).map((a) => a.label).join(" · ")} */
:root {
${p}

  --radius: ${s.radius}px;
  --border-width: ${s.borderWidth}px;
  --space-unit: ${s.spacingUnit}px;
  --space-1: ${s.spacingUnit}px;
  --space-2: ${s.spacingUnit * 2}px;
  --space-3: ${s.spacingUnit * 3}px;
  --space-4: ${s.spacingUnit * 6}px;
  --space-5: ${s.spacingUnit * 10}px;

  --font-family: ${s.fontStack};
  --font-base: ${s.baseFontPx}px;
  --font-sm: ${Math.round(s.baseFontPx / s.typeScale)}px;
  --font-lg: ${Math.round(s.baseFontPx * s.typeScale)}px;
  --font-xl: ${Math.round(s.baseFontPx * s.typeScale ** 2)}px;
  --font-2xl: ${Math.round(s.baseFontPx * s.typeScale ** 3)}px;
  --font-3xl: ${Math.round(s.baseFontPx * s.typeScale ** 4)}px;

  --measure: ${s.maxWidth}px;
  --motion: ${s.motionMs}ms;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --shadow: ${s.shadow};
}

@media (prefers-reduced-motion: reduce) {
  :root { --motion: 0ms; }
}
`;
}
