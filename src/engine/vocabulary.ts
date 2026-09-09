/**
 * HEPHAESTUS · colour vocabulary
 * The lexicon Akmon uses to turn "deep dusty teal with a burnt orange accent"
 * into actual OKLCH coordinates. No AI — just a dense dictionary plus
 * compositional modifiers, which is how humans actually name colour.
 */

export type NamedColor = { name: string; hex: string; family: ColorFamily };

export type ColorFamily =
  | "red" | "orange" | "yellow" | "green" | "teal" | "blue"
  | "purple" | "pink" | "brown" | "neutral";

/** 210 anchors: CSS names that designers actually use + studio vocabulary. */
export const COLOR_NAMES: NamedColor[] = [
  // reds
  { name: "red", hex: "#FF0000", family: "red" },
  { name: "crimson", hex: "#DC143C", family: "red" },
  { name: "scarlet", hex: "#FF2400", family: "red" },
  { name: "ruby", hex: "#9B111E", family: "red" },
  { name: "cherry", hex: "#D2042D", family: "red" },
  { name: "cardinal", hex: "#C41E3A", family: "red" },
  { name: "vermilion", hex: "#E34234", family: "red" },
  { name: "brick", hex: "#8B3A3A", family: "red" },
  { name: "maroon", hex: "#800000", family: "red" },
  { name: "burgundy", hex: "#800020", family: "red" },
  { name: "wine", hex: "#722F37", family: "red" },
  { name: "oxblood", hex: "#4A0000", family: "red" },
  { name: "rust", hex: "#B7410E", family: "red" },
  { name: "tomato", hex: "#FF6347", family: "red" },
  { name: "coral", hex: "#FF7F50", family: "red" },
  { name: "salmon", hex: "#FA8072", family: "red" },
  { name: "blush", hex: "#DE5D83", family: "red" },
  { name: "rose", hex: "#FF007F", family: "red" },
  { name: "terracotta", hex: "#E2725B", family: "red" },
  { name: "clay", hex: "#B66A50", family: "red" },

  // oranges
  { name: "orange", hex: "#FF7A00", family: "orange" },
  { name: "tangerine", hex: "#F28500", family: "orange" },
  { name: "amber", hex: "#FFBF00", family: "orange" },
  { name: "apricot", hex: "#FBCEB1", family: "orange" },
  { name: "peach", hex: "#FFCBA4", family: "orange" },
  { name: "pumpkin", hex: "#FF7518", family: "orange" },
  { name: "copper", hex: "#B87333", family: "orange" },
  { name: "bronze", hex: "#CD7F32", family: "orange" },
  { name: "ochre", hex: "#CC7722", family: "orange" },
  { name: "sienna", hex: "#A0522D", family: "orange" },
  { name: "marigold", hex: "#EAA221", family: "orange" },
  { name: "papaya", hex: "#FF9E4F", family: "orange" },
  { name: "cantaloupe", hex: "#FFA062", family: "orange" },
  { name: "flame", hex: "#E25822", family: "orange" },

  // yellows
  { name: "yellow", hex: "#FFE800", family: "yellow" },
  { name: "gold", hex: "#FFD700", family: "yellow" },
  { name: "lemon", hex: "#FFF44F", family: "yellow" },
  { name: "butter", hex: "#FFF1B5", family: "yellow" },
  { name: "mustard", hex: "#D4A017", family: "yellow" },
  { name: "honey", hex: "#EBA937", family: "yellow" },
  { name: "wheat", hex: "#F5DEB3", family: "yellow" },
  { name: "sand", hex: "#E2CA9B", family: "yellow" },
  { name: "champagne", hex: "#F7E7CE", family: "yellow" },
  { name: "citron", hex: "#DFDF00", family: "yellow" },
  { name: "canary", hex: "#FFEF60", family: "yellow" },
  { name: "brass", hex: "#B5A642", family: "yellow" },
  { name: "olive", hex: "#808000", family: "yellow" },
  { name: "khaki", hex: "#C3B091", family: "yellow" },

  // greens
  { name: "green", hex: "#00A550", family: "green" },
  { name: "emerald", hex: "#50C878", family: "green" },
  { name: "jade", hex: "#00A86B", family: "green" },
  { name: "forest", hex: "#228B22", family: "green" },
  { name: "pine", hex: "#01796F", family: "green" },
  { name: "moss", hex: "#8A9A5B", family: "green" },
  { name: "sage", hex: "#9CAF88", family: "green" },
  { name: "mint", hex: "#98FF98", family: "green" },
  { name: "lime", hex: "#BFFF00", family: "green" },
  { name: "chartreuse", hex: "#7FFF00", family: "green" },
  { name: "fern", hex: "#4F7942", family: "green" },
  { name: "avocado", hex: "#568203", family: "green" },
  { name: "seafoam", hex: "#9FE2BF", family: "green" },
  { name: "shamrock", hex: "#009E60", family: "green" },
  { name: "hunter", hex: "#355E3B", family: "green" },
  { name: "eucalyptus", hex: "#44D7A8", family: "green" },
  { name: "matcha", hex: "#A7C957", family: "green" },
  { name: "pistachio", hex: "#93C572", family: "green" },
  { name: "basil", hex: "#579229", family: "green" },
  { name: "kelp", hex: "#354230", family: "green" },

  // teals / cyans
  { name: "teal", hex: "#008080", family: "teal" },
  { name: "cyan", hex: "#00FFFF", family: "teal" },
  { name: "aqua", hex: "#00E5EE", family: "teal" },
  { name: "turquoise", hex: "#40E0D0", family: "teal" },
  { name: "aquamarine", hex: "#7FFFD4", family: "teal" },
  { name: "cerulean", hex: "#007BA7", family: "teal" },
  { name: "lagoon", hex: "#00A6A6", family: "teal" },
  { name: "petrol", hex: "#124E52", family: "teal" },
  { name: "peacock", hex: "#1B7F79", family: "teal" },
  { name: "verdigris", hex: "#43B3AE", family: "teal" },
  { name: "tiffany", hex: "#0ABAB5", family: "teal" },
  { name: "glacier", hex: "#BFEFFF", family: "teal" },

  // blues
  { name: "blue", hex: "#0057FF", family: "blue" },
  { name: "azure", hex: "#007FFF", family: "blue" },
  { name: "sky", hex: "#87CEEB", family: "blue" },
  { name: "cobalt", hex: "#0047AB", family: "blue" },
  { name: "sapphire", hex: "#0F52BA", family: "blue" },
  { name: "navy", hex: "#000080", family: "blue" },
  { name: "midnight", hex: "#191970", family: "blue" },
  { name: "denim", hex: "#1560BD", family: "blue" },
  { name: "steel", hex: "#4682B4", family: "blue" },
  { name: "powder", hex: "#B0E0E6", family: "blue" },
  { name: "ice", hex: "#D6ECF3", family: "blue" },
  { name: "indigo", hex: "#4B0082", family: "blue" },
  { name: "ultramarine", hex: "#3F00FF", family: "blue" },
  { name: "electric blue", hex: "#0FF0FC", family: "blue" },
  { name: "royal blue", hex: "#4169E1", family: "blue" },
  { name: "cornflower", hex: "#6495ED", family: "blue" },
  { name: "prussian", hex: "#003153", family: "blue" },
  { name: "slate blue", hex: "#6A5ACD", family: "blue" },
  { name: "periwinkle", hex: "#CCCCFF", family: "blue" },
  { name: "arctic", hex: "#E0F4FF", family: "blue" },

  // purples
  { name: "purple", hex: "#7B2FF7", family: "purple" },
  { name: "violet", hex: "#8F00FF", family: "purple" },
  { name: "amethyst", hex: "#9966CC", family: "purple" },
  { name: "lavender", hex: "#B57EDC", family: "purple" },
  { name: "lilac", hex: "#C8A2C8", family: "purple" },
  { name: "mauve", hex: "#E0B0FF", family: "purple" },
  { name: "plum", hex: "#8E4585", family: "purple" },
  { name: "eggplant", hex: "#614051", family: "purple" },
  { name: "aubergine", hex: "#3D0734", family: "purple" },
  { name: "orchid", hex: "#DA70D6", family: "purple" },
  { name: "grape", hex: "#6F2DA8", family: "purple" },
  { name: "iris", hex: "#5A4FCF", family: "purple" },
  { name: "wisteria", hex: "#C9A0DC", family: "purple" },
  { name: "byzantium", hex: "#702963", family: "purple" },
  { name: "heliotrope", hex: "#DF73FF", family: "purple" },

  // pinks
  { name: "pink", hex: "#FF69B4", family: "pink" },
  { name: "magenta", hex: "#FF00FF", family: "pink" },
  { name: "fuchsia", hex: "#FF1493", family: "pink" },
  { name: "bubblegum", hex: "#FFC1CC", family: "pink" },
  { name: "flamingo", hex: "#FC8EAC", family: "pink" },
  { name: "raspberry", hex: "#E30B5C", family: "pink" },
  { name: "watermelon", hex: "#FC6C85", family: "pink" },
  { name: "dusty rose", hex: "#DCAE96", family: "pink" },
  { name: "ballet", hex: "#F4C2C2", family: "pink" },
  { name: "punch", hex: "#DC4C6D", family: "pink" },
  { name: "hot pink", hex: "#FF3399", family: "pink" },
  { name: "shell", hex: "#FFF5EE", family: "pink" },

  // browns
  { name: "brown", hex: "#8B5A2B", family: "brown" },
  { name: "chocolate", hex: "#7B3F00", family: "brown" },
  { name: "coffee", hex: "#6F4E37", family: "brown" },
  { name: "espresso", hex: "#3B2219", family: "brown" },
  { name: "mocha", hex: "#967969", family: "brown" },
  { name: "caramel", hex: "#C68E17", family: "brown" },
  { name: "hazelnut", hex: "#AE7250", family: "brown" },
  { name: "walnut", hex: "#5C4033", family: "brown" },
  { name: "chestnut", hex: "#954535", family: "brown" },
  { name: "tan", hex: "#D2B48C", family: "brown" },
  { name: "beige", hex: "#E8DCC4", family: "brown" },
  { name: "taupe", hex: "#8B8589", family: "brown" },
  { name: "camel", hex: "#C19A6B", family: "brown" },
  { name: "cinnamon", hex: "#8B4513", family: "brown" },
  { name: "oat", hex: "#DDD3C0", family: "brown" },
  { name: "leather", hex: "#7A4B32", family: "brown" },

  // neutrals
  { name: "black", hex: "#000000", family: "neutral" },
  { name: "white", hex: "#FFFFFF", family: "neutral" },
  { name: "grey", hex: "#808080", family: "neutral" },
  { name: "gray", hex: "#808080", family: "neutral" },
  { name: "silver", hex: "#C0C0C0", family: "neutral" },
  { name: "charcoal", hex: "#36454F", family: "neutral" },
  { name: "graphite", hex: "#3B3B3B", family: "neutral" },
  { name: "slate", hex: "#708090", family: "neutral" },
  { name: "ash", hex: "#B2BEB5", family: "neutral" },
  { name: "smoke", hex: "#738276", family: "neutral" },
  { name: "ivory", hex: "#FFFFF0", family: "neutral" },
  { name: "cream", hex: "#FFFDD0", family: "neutral" },
  { name: "bone", hex: "#E3DAC9", family: "neutral" },
  { name: "porcelain", hex: "#F2F0EB", family: "neutral" },
  { name: "pearl", hex: "#EAE0C8", family: "neutral" },
  { name: "onyx", hex: "#0F0F0F", family: "neutral" },
  { name: "obsidian", hex: "#0B0B0D", family: "neutral" },
  { name: "gunmetal", hex: "#2A3439", family: "neutral" },
  { name: "pewter", hex: "#899499", family: "neutral" },
  { name: "linen", hex: "#FAF0E6", family: "neutral" },
  { name: "concrete", hex: "#95978A", family: "neutral" },
  { name: "carbon", hex: "#141414", family: "neutral" },
  { name: "paper", hex: "#FAF9F6", family: "neutral" },
  { name: "chalk", hex: "#F0EDE5", family: "neutral" },
];

/**
 * Modifiers compose onto any anchor. Values are OKLCH deltas:
 * dl = lightness shift, cx = chroma multiplier, dc = chroma offset.
 */
export const MODIFIERS: Record<string, { dl: number; cx: number; dc?: number }> = {
  light: { dl: 0.14, cx: 0.82 },
  lighter: { dl: 0.2, cx: 0.75 },
  pale: { dl: 0.24, cx: 0.45 },
  soft: { dl: 0.1, cx: 0.62 },
  pastel: { dl: 0.22, cx: 0.42 },
  washed: { dl: 0.18, cx: 0.35 },
  faded: { dl: 0.12, cx: 0.4 },
  dark: { dl: -0.16, cx: 0.92 },
  darker: { dl: -0.24, cx: 0.9 },
  deep: { dl: -0.18, cx: 1.15 },
  rich: { dl: -0.08, cx: 1.25 },
  midnight: { dl: -0.3, cx: 0.85 },
  shadow: { dl: -0.26, cx: 0.7 },
  bright: { dl: 0.06, cx: 1.35 },
  vivid: { dl: 0.02, cx: 1.55 },
  neon: { dl: 0.1, cx: 1.9, dc: 0.05 },
  electric: { dl: 0.08, cx: 1.8, dc: 0.04 },
  saturated: { dl: 0, cx: 1.5 },
  bold: { dl: -0.02, cx: 1.4 },
  muted: { dl: 0.02, cx: 0.45 },
  dusty: { dl: 0.04, cx: 0.38 },
  dull: { dl: -0.02, cx: 0.4 },
  matte: { dl: 0, cx: 0.55 },
  smoky: { dl: -0.06, cx: 0.35 },
  earthy: { dl: -0.04, cx: 0.6 },
  burnt: { dl: -0.14, cx: 0.95 },
  warm: { dl: 0.02, cx: 1.05 },
  cool: { dl: 0.02, cx: 1.05 },
};

/** Hue nudges in degrees for temperature words. */
export const TEMPERATURE: Record<string, number> = { warm: -8, cool: 8 };

/**
 * Moods map to palette *behaviour*, not to fixed colours — that's what keeps
 * the output space open instead of returning the same 12 canned palettes.
 */
export type Mood = {
  id: string;
  words: string[];
  hueBias?: [number, number][]; // preferred hue windows
  chroma: [number, number]; // min,max chroma for the lead colour
  lightness: [number, number];
  contrastTarget: number;
  schemes: string[];
};

export const MOODS: Mood[] = [
  {
    id: "trustworthy",
    words: ["trust", "trustworthy", "corporate", "bank", "banking", "finance", "financial", "secure", "enterprise", "professional", "institutional"],
    hueBias: [[210, 265], [180, 210]],
    chroma: [0.06, 0.16],
    lightness: [0.42, 0.62],
    contrastTarget: 7,
    schemes: ["analogous", "monochrome", "neutral-accent", "split-complement"],
  },
  {
    id: "calm",
    words: ["calm", "quiet", "serene", "gentle", "soothing", "wellness", "meditation", "spa", "restful", "soft"],
    hueBias: [[150, 220], [80, 150]],
    chroma: [0.03, 0.09],
    lightness: [0.55, 0.82],
    contrastTarget: 4.5,
    schemes: ["analogous", "monochrome", "neutral-accent"],
  },
  {
    id: "energetic",
    words: ["energetic", "energy", "bold", "loud", "vibrant", "punchy", "sport", "sports", "fitness", "gym", "hype", "dopamine", "playful", "fun"],
    hueBias: [[0, 60], [280, 340]],
    chroma: [0.17, 0.32],
    lightness: [0.55, 0.75],
    contrastTarget: 4.5,
    schemes: ["complement", "triadic", "split-complement", "tetradic"],
  },
  {
    id: "premium",
    words: ["premium", "luxury", "luxe", "elegant", "high-end", "boutique", "couture", "jewellery", "jewelry", "sophisticated", "refined"],
    hueBias: [[20, 50], [260, 300], [0, 20]],
    chroma: [0.04, 0.12],
    lightness: [0.2, 0.45],
    contrastTarget: 7,
    schemes: ["monochrome", "neutral-accent", "analogous"],
  },
  {
    id: "technical",
    words: ["technical", "developer", "dev", "terminal", "code", "coding", "engineering", "infra", "devtool", "cli", "hacker", "matrix"],
    hueBias: [[120, 190], [200, 260]],
    chroma: [0.1, 0.24],
    lightness: [0.5, 0.78],
    contrastTarget: 7,
    schemes: ["neutral-accent", "monochrome", "complement"],
  },
  {
    id: "organic",
    words: ["organic", "natural", "earth", "earthy", "eco", "sustainable", "farm", "botanical", "nature", "artisan", "handmade", "craft"],
    hueBias: [[60, 140], [20, 60]],
    chroma: [0.05, 0.14],
    lightness: [0.45, 0.7],
    contrastTarget: 4.5,
    schemes: ["analogous", "neutral-accent", "compound"],
  },
  {
    id: "clinical",
    words: ["clinical", "medical", "health", "healthcare", "hospital", "clean", "sterile", "pharma", "lab", "science"],
    hueBias: [[170, 220]],
    chroma: [0.05, 0.13],
    lightness: [0.5, 0.72],
    contrastTarget: 7,
    schemes: ["analogous", "neutral-accent", "monochrome"],
  },
  {
    id: "retro",
    words: ["retro", "vintage", "y2k", "nostalgia", "nostalgic", "70s", "80s", "90s", "arcade", "retrofuturism", "synthwave", "vaporwave"],
    hueBias: [[280, 340], [20, 60], [180, 210]],
    chroma: [0.15, 0.3],
    lightness: [0.5, 0.72],
    contrastTarget: 4.5,
    schemes: ["triadic", "complement", "tetradic", "compound"],
  },
  {
    id: "dark",
    words: ["dark", "moody", "noir", "gothic", "cinematic", "dramatic", "night", "stealth", "brooding"],
    hueBias: [[240, 300], [0, 30]],
    chroma: [0.06, 0.18],
    lightness: [0.28, 0.52],
    contrastTarget: 7,
    schemes: ["monochrome", "neutral-accent", "analogous"],
  },
  {
    id: "editorial",
    words: ["editorial", "magazine", "blog", "journal", "publication", "reading", "longform", "news", "print", "literary"],
    hueBias: [[10, 45], [200, 240]],
    chroma: [0.03, 0.1],
    lightness: [0.35, 0.6],
    contrastTarget: 7,
    schemes: ["neutral-accent", "monochrome", "complement"],
  },
];

/* ------------------------------------------------------------------ *
 * lookup helpers
 * ------------------------------------------------------------------ */

const NAME_INDEX = new Map(COLOR_NAMES.map((c) => [c.name, c]));

export function findColorName(token: string): NamedColor | undefined {
  return NAME_INDEX.get(token.toLowerCase().trim());
}

/** Every multi-word anchor, longest first, for greedy phrase matching. */
export const MULTIWORD_NAMES = COLOR_NAMES
  .filter((c) => c.name.includes(" "))
  .map((c) => c.name)
  .sort((a, b) => b.length - a.length);

export function familyOfHue(h: number): ColorFamily {
  const x = ((h % 360) + 360) % 360;
  if (x < 25 || x >= 350) return "red";
  if (x < 60) return "orange";
  if (x < 100) return "yellow";
  if (x < 165) return "green";
  if (x < 205) return "teal";
  if (x < 265) return "blue";
  if (x < 315) return "purple";
  return "pink";
}
