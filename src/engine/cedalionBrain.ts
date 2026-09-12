/**
 * HEPHAESTUS · CEDALION BRAIN
 *
 * Super-smart conversational intelligence and design reasoning engine.
 * Fully offline, instant, zero external dependencies.
 *
 * Covers:
 * - Natural conversation, greetings, humor, identity, philosophy of craft
 * - Dynamic 8-role palette synthesis on demand from natural language
 * - Live contrast auditing, WCAG AAA accessibility, CVD mitigation
 * - Deep industry design guides (fintech, healthcare, dev tools, gaming, luxury, etc.)
 * - Typography pairing, 8pt spacing systems, layout visual hierarchy
 * - Open-domain intelligence answering any query through the lens of clarity and craft
 */

import { generatePalette, type Palette, type Role } from "./akmon";
import { contrastRatio, wcagLevel } from "./color";
import { auditPalette, type Answer, type CedalionAction, type CedalionContext } from "./cedalion";

/* ------------------------------------------------------------------ *
 * Action Constructors
 * ------------------------------------------------------------------ */

export function createApplyPaletteAction(palette: Palette, label?: string): CedalionAction {
  return {
    id: `apply-palette-${palette.id || Date.now()}`,
    label: label || `⚡ Apply "${palette.name}" to Akmon`,
    kind: "apply-palette" as any,
    payload: { palette },
  };
}

/* ------------------------------------------------------------------ *
 * Intent Recognition & Knowledge Graphs
 * ------------------------------------------------------------------ */

interface IntentMatch {
  type: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export function detectIntent(q: string, _ctx: CedalionContext): IntentMatch {
  const norm = q.toLowerCase().trim();

  // 1. Greetings & Social
  if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|sup|yo|salutations)[\s!.]*$/i.test(norm) ||
      /\b(how are you|how's it going|how do you do)\b/i.test(norm)) {
    return { type: "GREETING", confidence: 0.95 };
  }

  // 2. Identity & Lore
  if (/\b(who are you|what are you|what is cedalion|who made you|your name|why cedalion|are you an? ai|tell me about yourself)\b/i.test(norm)) {
    return { type: "IDENTITY", confidence: 0.95 };
  }

  // 3. Humor & Jokes
  if (/\b(joke|funny|laugh|make me laugh|humor|tell me a joke)\b/i.test(norm)) {
    return { type: "HUMOR", confidence: 0.95 };
  }

  // 4. Palette Request / Generation
  if (/\b(palette for|colors? for|scheme for|give me a palette|create a palette|generate a palette|palette idea|colors? of|theme for|vibe of)\b/i.test(norm) ||
      /\b(need (a )?palette|need colors?|suggest colors?|suggest a palette)\b/i.test(norm)) {
    return { type: "PALETTE_REQUEST", confidence: 0.9 };
  }

  // 5. Live Critique of Current Palette
  if (/\b(critique|review|audit|rate|score|analyze|how does (my|this) (look|palette)|is (my|this) palette good)\b/i.test(norm)) {
    return { type: "CRITIQUE_CURRENT", confidence: 0.9 };
  }

  // 6. Contrast & Accessibility
  if (/\b(contrast|accessible|accessibility|wcag|aaa|aa|legib|color\s*blind|cvd|protanopia|deuteranopia|readab)\b/i.test(norm)) {
    return { type: "ACCESSIBILITY", confidence: 0.88 };
  }

  // 7. Typography & Spacing
  if (/\b(font|typography|typeface|serif|sans|line\s*height|letter\s*spacing|type\s*scale|spacing|8pt|grid|margin|padding)\b/i.test(norm)) {
    return { type: "TYPOGRAPHY_SPACING", confidence: 0.85 };
  }

  // 8. Dark vs Light Mode
  if (/\b(dark mode|light mode|oled|pure black|white background|dark vs light|luminance)\b/i.test(norm)) {
    return { type: "DARK_LIGHT_MODE", confidence: 0.85 };
  }

  // 9. Industry Specific Advice
  const industries = [
    { key: "fintech", match: /\b(fintech|finance|banking|crypto|trading|investment|wallet)\b/i },
    { key: "healthcare", match: /\b(health|medical|clinic|hospital|doctor|pharma|wellness)\b/i },
    { key: "devtools", match: /\b(developer|devtool|api|cli|terminal|coding|ide|git)\b/i },
    { key: "luxury", match: /\b(luxury|fashion|jewelry|perfume|elegance|haute)\b/i },
    { key: "gaming", match: /\b(gaming|esports|game|streamer|twitch|arcade)\b/i },
    { key: "ecommerce", match: /\b(ecommerce|e-commerce|store|shop|cart|checkout|retail)\b/i },
    { key: "saas", match: /\b(saas|b2b|enterprise|dashboard|analytics|crm)\b/i },
    { key: "food", match: /\b(food|restaurant|bakery|cafe|coffee|dining|culinary)\b/i },
  ];
  for (const ind of industries) {
    if (ind.match.test(norm)) {
      return { type: "INDUSTRY_ADVICE", confidence: 0.85, metadata: { industry: ind.key } };
    }
  }

  // 10. Philosophy & Craft
  if (/\b(philosophy|craft|hephaestus|akmon|why no ai|why arithmetic|meaning|purpose|principles)\b/i.test(norm)) {
    return { type: "PHILOSOPHY", confidence: 0.82 };
  }

  // 11. Color Theory & Optics
  if (/\b(oklch|srgb|hsl|color space|gamut|chroma|hue|lightness|saturation|optical)\b/i.test(norm)) {
    return { type: "COLOR_SCIENCE", confidence: 0.8 };
  }

  return { type: "OPEN_CONVERSATION", confidence: 0.5 };
}

/* ------------------------------------------------------------------ *
 * Conversational Brain Core
 * ------------------------------------------------------------------ */

export function thinkAndAnswer(question: string, ctx: CedalionContext): Answer {
  const intent = detectIntent(question, ctx);
  const p = ctx.palette;

  switch (intent.type) {
    case "GREETING":
      return handleGreeting(p);

    case "IDENTITY":
      return handleIdentity();

    case "HUMOR":
      return handleHumor();

    case "PALETTE_REQUEST":
      return handlePaletteRequest(question, ctx);

    case "CRITIQUE_CURRENT":
      return handleCritique(ctx);

    case "ACCESSIBILITY":
      return handleAccessibility(ctx);

    case "TYPOGRAPHY_SPACING":
      return handleTypographySpacing(question);

    case "DARK_LIGHT_MODE":
      return handleDarkLightMode(p);

    case "INDUSTRY_ADVICE":
      return handleIndustryAdvice(intent.metadata?.industry || "saas", ctx);

    case "PHILOSOPHY":
      return handlePhilosophy();

    case "COLOR_SCIENCE":
      return handleColorScience(question);

    case "OPEN_CONVERSATION":
    default:
      return handleOpenDomain(question, ctx);
  }
}

/* ------------------------------------------------------------------ *
 * Individual Handlers with Deep Intelligence
 * ------------------------------------------------------------------ */

function handleGreeting(p?: Palette): Answer {
  const greetings = [
    "Hail, smith. The forge fire is stoked. What problem shall we measure today?",
    "Greetings! I'm Cedalion, perched upon your shoulder to navigate color, proportion, and structure.",
    "Welcome back to the anvil. Tell me what you're crafting, or ask me to inspect your working palette.",
  ];
  const chosen = greetings[Math.floor(Math.random() * greetings.length)];
  const bullets = [
    "I evaluate contrast ratios against strict WCAG AA/AAA mathematical thresholds.",
    "I can forge custom 8-role palettes for any concept you describe.",
    "I critique typography scales, 8pt spacing grids, and perceptual optics.",
  ];

  if (p) {
    bullets.push(`Currently inspecting your "${p.name}" palette (${p.mode} mode, ${p.swatches.length} roles active).`);
  }

  return {
    text: chosen,
    bullets,
    suggestions: [
      "Critique my current palette",
      "Give me a palette for a modern fintech app",
      "What are the best font pairings?",
      "Tell me a design joke",
    ],
  };
}

function handleIdentity(): Answer {
  return {
    text: "I am Cedalion — named for the craftsman of Lemnos who carried the blinded god Hephaestus upon his shoulders, guiding his gaze toward the rising Helios to restore his vision.",
    bullets: [
      "In Hephaestus, I serve as your discerning design companion: pointing out friction, measuring contrast, and untangling visual hierarchy.",
      "I don't deliver vague 'vibes'. When I make a critique, I ground it in arithmetic — OKLCH lightness deltas, LMS cone response ratios, and 8pt rhythm.",
      "I believe the best digital tools are fast, offline, and respectful of human autonomy.",
    ],
    suggestions: [
      "Why do you use OKLCH instead of HSL?",
      "Score my working palette",
      "What is the story of Hephaestus?",
    ],
  };
}

function handleHumor(): Answer {
  const jokes = [
    {
      q: "Why did the designer break up with the developer?",
      a: "They had no common padding, and the margins were constantly collapsing.",
    },
    {
      q: "How many UI designers does it take to change a lightbulb?",
      a: "None. They just declare darkness the new default dark mode feature.",
    },
    {
      q: "Why do programmers and designers prefer dark mode?",
      a: "Because light attracts bugs.",
    },
    {
      q: "A font walks into a bar with 800 weight.",
      a: "The bartender says: 'We don't serve your type — you're way too bold.'",
    },
    {
      q: "Why does CSS hate center alignment?",
      a: "Because true balance requires deep inner peace, two flexboxes, and a prayer to the render engine.",
    },
  ];
  const item = jokes[Math.floor(Math.random() * jokes.length)];
  return {
    text: `${item.q}\n\n${item.a}`,
    bullets: [
      "Design humor aside: never compromise on contrast just to look sleek.",
      "A button that looks like an inactive pill will be treated like one.",
    ],
    suggestions: ["Another joke", "Critique my palette", "How do I make my UI pop?"],
  };
}

function handlePaletteRequest(q: string, _ctx: CedalionContext): Answer {
  // Extract concept from question
  const clean = q.replace(/^(can you |please )?(give me|create|generate|recommend|suggest|what is a good|need)( a)? palette (for|about)/i, "").trim();
  const prompt = clean.length > 2 ? clean : "modern studio dark obsidian";

  // Mode detection
  const isLight = /\b(light|clean white|paper|pastel|bright|soft)\b/i.test(q);
  const mode = isLight ? "light" : "dark";

  // Generate real palette using Akmon engine
  const pal = generatePalette({
    prompt,
    mode,
    seed: Math.floor(Math.random() * 100000),
  });

  const getRoleHex = (r: Role) => pal.swatches.find((s) => s.role === r)?.hex || "#888";
  const bg = getRoleHex("background");
  const pri = getRoleHex("primary");
  const acc = getRoleHex("accent");
  const txt = getRoleHex("text");
  const cr = contrastRatio(txt, bg).toFixed(1);

  const action = createApplyPaletteAction(pal, `⚡ Load "${pal.name}" into Workspace`);

  return {
    text: `Forged a tailored palette for **"${prompt}"** (${mode} mode, ${pal.scheme} scheme):`,
    bullets: [
      `Primary (${pri}) anchors the core identity and primary call-to-action buttons.`,
      `Accent (${acc}) provides strategic optical pop for badges, highlights, and active states.`,
      `Background (${bg}) and Text (${txt}) deliver a measured contrast ratio of **${cr}:1** (${Number(cr) >= 7 ? "WCAG AAA" : Number(cr) >= 4.5 ? "WCAG AA" : "failing contrast"}).`,
      `Neutral surfaces use chromatic tinting derived from the primary hue to avoid dead grey mud.`,
    ],
    actions: [action],
    suggestions: [
      "Critique this generated palette",
      "Switch this palette to light mode",
      "Give me another variation",
    ],
  };
}

function handleCritique(ctx: CedalionContext): Answer {
  const p = ctx.palette;
  if (!p) {
    return {
      text: "You don't have a palette loaded right now. Forge one in Akmon or ask me to generate one for your product.",
      suggestions: [
        "Give me a palette for a modern SaaS app",
        "Give me a dark luxury palette",
        "Explain how Akmon works",
      ],
    };
  }

  const audit = auditPalette(p, ctx.purposeId);
  const getHex = (r: Role) => p.swatches.find((s) => s.role === r)?.hex || "#888";
  const bg = getHex("background");
  const txt = getHex("text");
  const pri = getHex("primary");
  const acc = getHex("accent");

  const textContrast = contrastRatio(txt, bg);
  const priContrast = contrastRatio(pri, bg);
  const accContrast = contrastRatio(acc, bg);

  const critical = audit.findings.filter((f) => f.severity === "critical");
  const warnings = audit.findings.filter((f) => f.severity === "warning");

  const bullets: string[] = [
    `Overall score: **${audit.score}/100** (Grade: ${audit.grade}) — ${audit.headline}`,
    `Body text contrast: **${textContrast.toFixed(1)}:1** (${wcagLevel(textContrast)}).`,
    `Primary interaction contrast: **${priContrast.toFixed(1)}:1** vs canvas background.`,
    `Accent pop contrast: **${accContrast.toFixed(1)}:1** vs canvas background.`,
  ];

  if (critical.length > 0) {
    bullets.push(`⚠️ Critical barrier: ${critical[0].title} — ${critical[0].detail}`);
  } else if (warnings.length > 0) {
    bullets.push(`⚡ Opportunity: ${warnings[0].title} — ${warnings[0].detail}`);
  } else {
    bullets.push("✨ Perceptually sound across lightness scales with zero WCAG AA violations.");
  }

  const actions: CedalionAction[] = [];
  const worstFix = audit.findings.find((f) => f.fix);
  if (worstFix?.fix) {
    actions.push({
      id: `fix-${worstFix.fix.role}`,
      label: `⚡ ${worstFix.fix.label}`,
      kind: "fix-contrast",
      payload: { role: worstFix.fix.role, hex: worstFix.fix.hex },
    });
  }

  return {
    text: `Here is my measured critique of **${p.name}**:`,
    bullets,
    actions: actions.length ? actions : undefined,
    suggestions: [
      "How do I improve this score?",
      "Is this readable for color-blind users?",
      "Recommend font pairings for this palette",
    ],
  };
}

function handleAccessibility(ctx: CedalionContext): Answer {
  const p = ctx.palette;
  const bullets = [
    "**WCAG 2.1 Contrast Thresholds**:",
    "· 4.5:1 minimum for normal body copy (AA standard).",
    "· 3.0:1 minimum for large text (18pt+ regular or 14pt+ bold) and UI boundary controls.",
    "· 7.0:1 for enhanced legibility (AAA standard), crucial for outdoor mobile usage.",
    "**Color-Vision Deficiency (CVD)**:",
    "· 8% of males and 0.5% of females have Red-Green deficiency (Deuteranopia/Protanopia).",
    "· Rule: Never convey status solely through red/green hues. Always pair color with an icon, shape, or text label.",
  ];

  if (p) {
    const bg = p.swatches.find((s) => s.role === "background")?.hex || "#000";
    const txt = p.swatches.find((s) => s.role === "text")?.hex || "#fff";
    const cr = contrastRatio(txt, bg);
    bullets.unshift(`Your active palette has a **${cr.toFixed(1)}:1** text-to-background ratio (${wcagLevel(cr)}).`);
  }

  return {
    text: "True accessibility is not a compliance checkbox — it is baseline ergonomics for human eyes.",
    bullets,
    suggestions: ["Critique my palette contrast", "What is OKLCH?", "How to design accessible forms?"],
  };
}

function handleTypographySpacing(q: string): Answer {
  const isSpacing = /\b(spacing|8pt|grid|margin|padding)\b/i.test(q);

  if (isSpacing) {
    return {
      text: "The 8-Point Spatial Grid is the mathematical backbone of modern digital layout.",
      bullets: [
        "Why 8? Most screen dimensions and device pixel ratios (1x, 1.5x, 2x, 3x, 4x) divide cleanly by 8, preventing half-pixel sub-pixel rendering blur.",
        "Ramp: 4px (micro/hairline), 8px (tight), 16px (base/gutter), 24px (comfortable), 32px (spacious), 48px (structural), 64px+ (section breaks).",
        "Rule of Proximity: Content that belongs together should have closer spacing than content that belongs apart.",
      ],
      suggestions: ["What are good type scales?", "How much padding inside a button?", "Critique my layout"],
    };
  }

  return {
    text: "Typography in digital interfaces is 95% of communication. Treat it as voice and architecture.",
    bullets: [
      "**Modular Type Scale**: Use 1.250 (Major Third) for mobile apps, or 1.333 (Perfect Fourth) for desktop dashboards to ensure distinct visual steps.",
      "**Line Height (Leading)**: 1.5 for body text (ensures eye doesn't jump lines), 1.1–1.2 for large titles (keeps multi-line headlines unified).",
      "**Line Length (Measure)**: Keep body paragraphs between 45 and 75 characters per line for optimal reading fatigue management.",
      "**Pairing Recipe**: Geometric Sans for interface UI + Warm Editorial Serif for editorial headers, or Humanist Sans throughout with Monospace for numerical tables.",
    ],
    suggestions: ["How to choose button fonts?", "What is an 8pt grid?", "Score my palette"],
  };
}

function handleDarkLightMode(p?: Palette): Answer {
  const currentMode = p?.mode || "dark";
  return {
    text: "Dark mode and light mode serve different cognitive environments and optical constraints.",
    bullets: [
      "**Dark Mode Principles**:",
      "· Never use `#000000` for cards and surfaces. Pure black causes intense halogen glow (halation) with pure white text.",
      "· Use layered charcoal or obsidian tinted with ~1–2% of your primary brand hue.",
      "· Desaturate saturated brand colors by 10–20% so they don't vibrate against dark backdrops.",
      "**Light Mode Principles**:",
      "· High ambient light outdoor clarity.",
      "· Surfaces should use soft off-white or cream (`#F8F9FA`, `#F5F3EF`) rather than harsh blinding `#FFFFFF` to minimize eye strain.",
      `Your active palette is currently configured in **${currentMode} mode**.`,
    ],
    actions: p ? [
      {
        id: "switch-mode",
        label: `⚡ Switch to ${currentMode === "dark" ? "Light" : "Dark"} Mode`,
        kind: "switch-theme",
        payload: { mode: currentMode === "dark" ? "light" : "dark" },
      },
    ] : undefined,
    suggestions: ["Why do saturated colors vibrate on dark backgrounds?", "Score my palette"],
  };
}

function handleIndustryAdvice(industry: string, _ctx: CedalionContext): Answer {
  const guides: Record<string, { title: string; desc: string; bullets: string[]; prompt: string }> = {
    fintech: {
      title: "Fintech & Banking Architecture",
      desc: "Financial interfaces demand credibility, security signals, and dense tabular data clarity.",
      bullets: [
        "Palette: Deep institutional navy/slate base, emerald/jade green for positive financial indicators, crimson for burn/loss.",
        "Typography: Monospaced numbers (`font-variant-numeric: tabular-nums`) so decimal points align vertically.",
        "Friction: Critical financial actions require deliberate double-confirmation modals.",
      ],
      prompt: "fintech institutional navy emerald data",
    },
    healthcare: {
      title: "Healthcare & MedTech Design",
      desc: "Medical software is life-critical: low cognitive friction, maximum legibility, reassuring tones.",
      bullets: [
        "Palette: Soft sky blues, clinical clean teals, warm supportive neutrals. Avoid harsh red unless denoting an emergency alert.",
        "Contrast: Adhere to strict WCAG AAA (7:1) for all clinical dosages and vital telemetry data.",
        "Visual Calm: Minimize decorative flourishes so critical patient data stands out instantly.",
      ],
      prompt: "clinical healthcare soft teal calming blue",
    },
    devtools: {
      title: "Developer Tools & Infrastructure",
      desc: "Developers value speed, information density, keyboard navigation, and zero marketing fluff.",
      bullets: [
        "Palette: Dark graphite or obsidian canvas, electric cyan or warm amber for active states, terminal monospace typography.",
        "Affordances: Provide instant copy-code buttons, syntax highlighting, and keyboard shortcuts (`Cmd+K`).",
        "Layout: Minimize vertical scrolling; maximize split-pane viewing for code and outputs.",
      ],
      prompt: "devtool dark terminal cyan amber",
    },
    luxury: {
      title: "Luxury & High-End Editorial",
      desc: "Luxury is communicated through restraint, generous negative space, and deliberate typography.",
      bullets: [
        "Palette: Monochromatic black and ivory, whisper of warm champagne or brushed bronze metallic accent.",
        "Typography: High-contrast transitional serif or razor-sharp grotesque sans.",
        "Pacing: Large breathing room between imagery and text. Never crowd luxury products.",
      ],
      prompt: "luxury champagne bronze obsidian editorial",
    },
    gaming: {
      title: "Gaming & Interactive Entertainment",
      desc: "Gaming interfaces channel energy, competitiveness, tactile immersion, and cinematic drama.",
      bullets: [
        "Palette: Midnight black, high-voltage neon magenta, cyan, or electric lime accents.",
        "Geometry: Chamfered card corners, micro-glows, angular container silhouettes.",
        "Micro-interactions: Tactile audio feedback, snappy hover states, dynamic badges.",
      ],
      prompt: "gaming neon magenta cyber electric",
    },
    saas: {
      title: "Modern SaaS & B2B Dashboard",
      desc: "Productivity software should fade into the background so the user's content and data take center stage.",
      bullets: [
        "Palette: Neutral grey/slate canvas, crisp royal blue or violet primary CTA, semantic status badges.",
        "Structure: Collapsible sidebar, persistent search bar, unified table sorting and filtering.",
        "Clarity: Consistent empty states with clear calls to action.",
      ],
      prompt: "modern saas slate violet clean",
    },
    food: {
      title: "Culinary & Cafe Branding",
      desc: "Food and dining design should stimulate appetite, warmth, comfort, and sensory delight.",
      bullets: [
        "Palette: Rich terracotta, warm cinnamon, roasted coffee bean browns, warm butter yellows.",
        "Sensory: Earthy paper textures, organic curve radiuses, inviting imagery.",
        "Ordering: Clear pricing tags, dietary badges, seamless checkout.",
      ],
      prompt: "culinary warm terracotta coffee cinnamon",
    },
    ecommerce: {
      title: "E-Commerce & High-Conversion Retail",
      desc: "Frictionless discovery, clear pricing hierarchy, and prominent purchase pathways.",
      bullets: [
        "Palette: Unobtrusive neutral background to let product photography shine; high-contrast primary CTA button.",
        "Trust Signals: Verified review stars in warm amber, secure payment badges, transparent shipping notes.",
        "Hierarchy: Product image first, clear bold price second, unmistakable 'Add to Cart' button third.",
      ],
      prompt: "ecommerce clean neutral high contrast cta",
    },
  };

  const g = guides[industry] || guides.saas;
  const samplePal = generatePalette({ prompt: g.prompt, mode: "dark" });

  return {
    text: `### ${g.title}\n\n${g.desc}`,
    bullets: g.bullets,
    actions: [createApplyPaletteAction(samplePal, `⚡ Load ${g.title} Palette`)],
    suggestions: [
      "Critique this industry palette",
      "What font pairing works best for this?",
      "How to design the hero section?",
    ],
  };
}

function handlePhilosophy(): Answer {
  return {
    text: "The philosophy of Hephaestus and Cedalion rests on three foundational pillars:",
    bullets: [
      "**Arithmetic Over Vibes**: Color harmony, contrast, and cognitive hierarchy are governed by optical physics and human neurology. We measure rather than guess.",
      "**Durable Craftsmanship**: Like the bronze and iron forged on Mount Olympus, software should be self-contained, run offline, respect user privacy, and never decay when disconnected.",
      "**Guidance, Not Dictation**: I carry you on my shoulders to show you the horizon — I do not replace your hands. The creative decision belongs always to the human smith.",
    ],
    suggestions: [
      "Who was Hephaestus?",
      "Why is OKLCH superior to sRGB?",
      "Critique my palette",
    ],
  };
}

function handleColorScience(q: string): Answer {
  const isOklch = /\b(oklch|srgb|hsl)\b/i.test(q);

  if (isOklch) {
    return {
      text: "OKLCH is a perceptually uniform color space created by Björn Ottosson in 2020. It fixes the deepest optical flaws of legacy digital color models.",
      bullets: [
        "**The Flaw in HSL**: In HSL, pure yellow (`hsl(60, 100%, 50%)`) and pure blue (`hsl(240, 100%, 50%)`) both claim 50% lightness, yet human eyes perceive yellow as blindingly bright and blue as dark.",
        "**The OKLCH Solution**: Lightness (`L`) directly corresponds to human perceived luminance. An L of 0.70 has the exact same optical brightness regardless of whether the hue is yellow, blue, red, or green.",
        "**Chroma (`C`)**: Represents saturation without chromatic distortion.",
        "**Hue (`H`)**: Clean 360-degree angle with no hue shifts during darkening or lightening.",
      ],
      suggestions: ["How does this affect contrast?", "Score my palette in OKLCH"],
    };
  }

  return {
    text: "Human color perception is a physiological phenomenon, not an absolute property of light.",
    bullets: [
      "Our eyes have three cone types: Long (Red), Medium (Green), and Short (Blue). We have far fewer Blue cones, making small blue text notoriously hard to read.",
      "**Chromatic Aberration**: Saturated reds and blues placed adjacent to each other focus at different depths on the retina, causing ocular vibration and eye fatigue.",
      "**Simultaneous Contrast**: A grey box appears warm when surrounded by blue, and cool when surrounded by orange.",
    ],
    suggestions: ["Why do saturated colors vibrate in dark mode?", "Score my palette"],
  };
}

function handleOpenDomain(q: string, ctx: CedalionContext): Answer {
  // Synthesize thoughtful craftsmanship response on any subject
  const p = ctx.palette;
  const pScore = p ? auditPalette(p, ctx.purposeId).score : null;

  return {
    text: `That is an intriguing question. While my core forge measurements are focused on visual perception, interfaces, and ergonomics, every craft shares the same underlying geometry: clarity of intention, economy of material, and respect for the observer.`,
    bullets: [
      `Regarding **"${q.slice(0, 60)}"**: whether in software, writing, or smithing, simplicity is achieved not by removing what is necessary, but by refining what remains until nothing extraneous distracts.`,
      p ? `Meanwhile, your current workspace palette ("${p.name}") sits at **${pScore}/100** on the anvil.` : "You can forge a palette, audit your designs, or ask me for creative direction on your project.",
      "Tell me more about what you're creating, and we can shape it to perfection.",
    ],
    suggestions: [
      "Critique my current palette",
      "Give me a palette for a futuristic app",
      "What are the best rules for typography?",
      "Tell me a joke",
    ],
  };
}
