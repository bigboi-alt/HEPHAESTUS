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

export type Voice = { line: string; sub: string; who: "forge" | "cedalion" | "hephaestus" };

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

/** What the master says back, one line under the headline. */
const HEPHAESTUS_SUBS = [
  "the bench is yours for today. no gods, no masters — just the work",
  "prove it in the next hour, not in the name field",
  "I lost the foot, the wife and the Olympus vote. you still have to build",
  "automatons checked: gold ones walking, the rest are on me",
] as const;

const CEDALION_SUBS = [
  "I have read the palette while you were away. it wants one more pass",
  "every contrast in there is a number, and every number is a decision",
  "your apprentice is at the far end of the bench, as usual",
  "ask me to fix it and I will not pretend it was already fine",
] as const;

/** Names are matched on the display-name field, trimmed, case- and punctuation-insensitive. */
export function whoAmIDisplayedAs(displayName: string | undefined): Voice["who"] | null {
  const n = (displayName ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (n === "cedalion") return "cedalion";
  if (n === "hephaestus" || n === "hephaestusgod" || n === "thegod") return "hephaestus";
  return null;
}

/* ---------- the ordinary forge copy, by state ---------- */

type Line = { line: string; sub: string };

const COLD: readonly Line[] = [
  { line: "The forge is cold — heat it up.", sub: "one prompt is enough to get the metal moving" },
  { line: "Nothing on the bench yet.", sub: "forge a palette, then let Cedalion try to break it" },
  { line: "The anvil is clean. That won't last.", sub: "start with a feeling, not a colour" },
  { line: "Every good site starts as a bad first heat.", sub: "make the bad one here, where it's free" },
  { line: "Two things today: a palette, and a reason for it.", sub: "the reason is the harder half" },
];

const WARM: readonly Line[] = [
  { line: "The forge is warm.", sub: "saved work below — pick up where the last heat left off" },
  { line: "There is metal cooling on the bench.", sub: "read the grades, then re-forge the one that embarrassed you" },
  { line: "You have things here now.", sub: "a palette nobody audits is a guess with good lighting" },
  { line: "Steady hands, steady heat.", sub: "trends are moving on the left; your eye is the tiebreaker" },
  { line: "Some of these are already good.", sub: "which ones is measurable — Cedalion will tell you the cost" },
];

const BUSY: readonly Line[] = [
  { line: "Sites on the bench.", sub: "finish one before you start another. that's the whole discipline" },
  { line: "Half-built is a state, not a verdict.", sub: "the autosave means you can leave and come back to the same heat" },
  { line: "The forge is loud today.", sub: "blocks, palettes and grades all waiting on the same decision" },
  { line: "One more page won't save it. One better decision will.", sub: "look at what Cedalion keeps repeating — that's the real thing" },
];

const STRONG: readonly Line[] = [
  { line: "That one's holding.", sub: "the grade says it works; say what it's for and prove it in the build" },
  { line: "The heat is right.", sub: "a passing palette is a starting point, not a finish line" },
];

const WEAK: readonly Line[] = [
  { line: "Something in there is wrong.", sub: "Cedalion already knows what. ask instead of hoping" },
  { line: "The metal's not ready.", sub: "contrast first, taste second — in that order, always" },
];

/** One line for the header. Deterministic per day + salted by state. */
export function forgeVoice(state: ForgeState, displayName?: string, reroll = 0): Voice {
  const day = dayIndex();
  const salt = day + reroll;
  const who = whoAmIDisplayedAs(displayName);

  if (who === "hephaestus") {
    return {
      line: pick(HEPHAESTUS_GREETINGS, salt),
      sub: pick(HEPHAESTUS_SUBS, day + reroll * 3),
      who: "hephaestus",
    };
  }
  if (who === "cedalion") {
    return {
      line: CEDALION_GREETING,
      sub: pick(CEDALION_SUBS, salt),
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
  return { line: v.line, sub: v.sub, who: "forge" };
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
