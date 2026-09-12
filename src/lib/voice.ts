/**
 * HEPHAESTUS · voice
 *
 * The dashboard used to say one thing, whatever the state of the forge: "the
 * forge is cold — heat it up", even with twelve palettes on the bench. This is
 * the fix — a library of lines sorted by what is actually true right now, plus
 * two things that only show up if you put their name in the display-name field.
 *
 * Rotation is deterministic on purpose: the line is chosen from the day, so it
 * changes when you come back tomorrow and never flickers while you work. The
 * little dice button in the header re-rolls on demand.
 */

export type ForgeState = {
  palettes: number;
  sites: number;
  /** Cedalion's grade of the current palette, if one is loaded */
  score?: number | null;
  /** true on a visit where nothing has been forged yet */
  fresh: boolean;
};

export type Voice = { line: string; who: "forge" | "cedalion" | "hephaestus" };

/* ---------- the day's index, 0..n-1 over a cycle ---------- */

function dayIndex(): number {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

export function pick<T>(arr: readonly T[], salt: number): T {
  return arr[((salt % arr.length) + arr.length) % arr.length];
}

/* ---------- easter eggs, keyed on the display name ---------- */

export const CEDALION_GREETING =
  "Greetings, Cedalion. How stands the forge today, my clever apprentice?";

/** Verbatim, as given — the master does not share his bench with an impostor. */
export const HEPHAESTUS_GREETINGS = [
  "You claim my name? Pick up the hammer and prove it.",
  "You want to be me? First, survive the fall from Olympus.",
  "The forge knows its true master. Step aside before you burn.",
  "You think being a god is a gift? Take my scars, then talk.",
  "If you are me, start working. The automatons need fixing.",
] as const;

/** Names are matched on the display-name field, trimmed, case- and punctuation-insensitive. */
export function whoAmIDisplayedAs(displayName: string | undefined): Voice["who"] | null {
  const n = (displayName ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (n === "cedalion") return "cedalion";
  if (n === "hephaestus" || n === "hephaestusgod" || n === "thegod") return "hephaestus";
  return null;
}

/* ---------- the ordinary forge copy, by state ---------- *
 * One line only. The dashboard used to carry a caption under the headline and a "say something
 * else" button next to it; both are gone, because a greeting should be a sentence rather than a
 * caption with a re-roll control attached. The pools of second lines went with them. */

type Line = { line: string };

const COLD: readonly Line[] = [
  { line: "The forge is cold — heat it up." },
  { line: "Nothing on the bench yet." },
  { line: "The anvil is clean. That won't last." },
  { line: "Every good site starts as a bad first heat." },
  { line: "Two things today: a palette, and a reason for it." },
];

const WARM: readonly Line[] = [
  { line: "The forge is warm." },
  { line: "There is metal cooling on the bench." },
  { line: "You have things here now." },
  { line: "Steady hands, steady heat." },
  { line: "Some of these are already good." },
];

const BUSY: readonly Line[] = [
  { line: "Sites on the bench." },
  { line: "Half-built is a state, not a verdict." },
  { line: "The forge is loud today." },
  { line: "One more page won't save it. One better decision will." },
];

const STRONG: readonly Line[] = [
  { line: "That one's holding." },
  { line: "The heat is right." },
];

const WEAK: readonly Line[] = [
  { line: "Something in there is wrong." },
  { line: "The metal's not ready." },
];

/** One line for the header. Deterministic per day + salted by state. */
export function forgeVoice(state: ForgeState, displayName?: string, reroll = 0): Voice {
  const day = dayIndex();
  const salt = day + reroll;
  const who = whoAmIDisplayedAs(displayName);

  if (who === "hephaestus") {
    return {
      line: pick(HEPHAESTUS_GREETINGS, salt),
      who: "hephaestus",
    };
  }
  if (who === "cedalion") {
    return {
      line: CEDALION_GREETING,
      who: "cedalion",
    };
  }

  const pool =
    state.score != null && state.score < 70 ? WEAK
    : state.score != null && state.score >= 88 && state.sites > 0 ? STRONG
    : state.sites > 0 ? BUSY
    : state.fresh || state.palettes === 0 ? COLD
    : WARM;
  const v = pick(pool, salt);
  return { line: v.line, who: "forge" };
}

/* ---------- the same trick for the small label under the stat band ---------- */

const NOTES = [
  "everything here is local. nothing phones anyone. no plan, no key",
  "free forever, deterministic forever — the maths is the product",
  "no model between you and the contrast ratio",
  "the tool is the tool. your eye still decides",
] as const;

export function forgeNote(reroll = 0): string {
  return pick(NOTES, dayIndex() * 7 + reroll * 5);
}
