/**
 * HEPHAESTUS · studio presets
 *
 * Hand-tuned starting phrases for Akmon. Each preset says what the finished
 * system should FEEL like and names the anchor colours explicitly (with the
 * role words the parser understands: "accent", "background", "dark/light"),
 * so the engine's own colour science does the rest. These are the strongest
 * known combinations — the "start from taste" row in Akmon and Build.
 */

export type StudioPreset = {
  id: string;
  label: string;
  note: string;
  prompt: string;
  swatch: string[]; // bg, accent hint — shown as a tiny strip
};

export const STUDIO_PRESETS: StudioPreset[] = [
  {
    id: "clay-ink",
    label: "clay & ink",
    note: "warm editorial · light",
    prompt: "terracotta clay primary with deep ink text, warm neutrals, editorial, light mode",
    swatch: ["#f6efe6", "#c65d3b", "#22201c"],
  },
  {
    id: "ocean-signal",
    label: "ocean signal",
    note: "calm + one loud voice · light",
    prompt: "deep ocean teal with an electric coral accent, calm, light mode",
    swatch: ["#eef4f4", "#0e6f74", "#ff6f61"],
  },
  {
    id: "midnight-orchard",
    label: "midnight orchard",
    note: "plum on black · dark",
    prompt: "plum brandy with an acid lime accent, near black background, dark mode",
    swatch: ["#120a10", "#b4558d", "#d4e157"],
  },
  {
    id: "sage-linen",
    label: "sage & linen",
    note: "soft brutalism · light",
    prompt: "sage green and oat cream, soft brutalism, warm, light mode",
    swatch: ["#f3f1e8", "#9caf88", "#3f4a3a"],
  },
  {
    id: "vault",
    label: "the vault",
    note: "fintech trust · light",
    prompt: "banknote blue primary, mercury grey neutrals, trustworthy fintech, light mode",
    swatch: ["#f4f6f8", "#1f4fa3", "#8b9bb0"],
  },
  {
    id: "cobalt-amber",
    label: "cobalt & amber",
    note: "confident dark",
    prompt: "royal cobalt with a warm amber accent, confident, dark mode",
    swatch: ["#0b1020", "#2e5bff", "#f5a623"],
  },
  {
    id: "quiet-tech",
    label: "quiet tech",
    note: "glacial calm · dark",
    prompt: "graphite and glacial blue, calm technical, dark mode",
    swatch: ["#0e1216", "#7ea8c9", "#3c4752"],
  },
  {
    id: "golden-hour",
    label: "golden hour",
    note: "dusted rose · airy light",
    prompt: "dusted rose and marigold, airy, warm, light mode",
    swatch: ["#faf3ec", "#e8a1b4", "#f2b25c"],
  },
  {
    id: "ferrous-dusk",
    label: "ferrous dusk",
    note: "steel + ember · dark",
    prompt: "gunmetal steel with a burnt orange accent, dark mode",
    swatch: ["#101014", "#c9ccd2", "#f48946"],
  },
  {
    id: "papyrus",
    label: "papyrus",
    note: "ancient paper · light",
    prompt: "aged paper background with oxblood red text and bronze accents, literary, light mode",
    swatch: ["#ece5d3", "#6e1f1f", "#a97e3f"],
  },
];
