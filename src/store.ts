/**
 * HEPHAESTUS · global state
 * Zustand + a debounced write to whatever Store is active.
 */

import { create } from "zustand";
import {
  generatePalette, varyPalette, type Palette, type Scheme, type Mode, type Role,
} from "./engine/akmon";
import { describeColor } from "./engine/akmon";
import {
  DEFAULT_SETTINGS, LocalStore, SNAPSHOT_VERSION, store as backend,
  type IdentityConsent, type SavedSite, type Settings, type Snapshot,
} from "./lib/storage";
import { founderMark, forgeMark, type Mark } from "./engine/identity";
import { readSky } from "./lib/sky";
import { checkForUpdate, DEFAULT_FEED, dueForCheck, IDLE_CHECK, type UpdateCheck } from "./lib/updates";

/** the running version, baked at build time; a literal fallback keeps plain `node` imports honest */
export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0-dev";

export type Screen = "home" | "akmon" | "library" | "trends" | "build" | "settings";

export type BuildMeta = {
  purposeLabel: string;
  sectionsOn: number;
  sectionNames: string[];
};

/** live facts about the canvas build — fed to Cedalion while you're in the studio */
export type CanvasCtx = {
  mode: "single" | "multi";
  pageName: string;
  pageIx: number;
  pageCount: number;
  pageHeight: number;
  blockCount: number;
  kinds: Record<string, number>;
  auditScore: number;
  issues: { sev: string; what: string; fix?: string }[];
  purposeLabel?: string;
  transition: string;
  hasNav: boolean;
  hasFooter: boolean;
};

export type CedalionAction = {
  id: string;
  label: string;
  kind: "fix-contrast" | "harmonize-neutrals" | "switch-theme" | "make-pop" | "insert-section" | "copy-tokens" | "open-screen";
  payload?: any;
};

export type ChatTurn = {
  id: string;
  role: "you" | "cedalion";
  text: string;
  bullets?: string[];
  refs?: string[];
  suggestions?: string[];
  actions?: CedalionAction[];
  at: number;
};

type State = {
  ready: boolean;
  screen: Screen;
  settings: Settings;
  palettes: Palette[];
  current: Palette | null;
  purposeId: string | null;
  chat: ChatTurn[];
  buildMeta: BuildMeta | null;
  cedalionOpen: boolean;
  /** a question handed to Cedalion from elsewhere in the app, waiting to be spoken */
  cedalionSeed: string | null;
  toast: string | null;
  sites: SavedSite[];
  resumeId: string | null;
  canvasCtx: CanvasCtx | null;
  /** the forge mark: captured once, then kept exactly as it was forged */
  mark: Mark | null;
  identityBusy: boolean;
  /** true once the founder's key has been typed */
  founder: boolean;
  update: UpdateCheck;

  init: () => Promise<void>;
  go: (s: Screen) => void;
  setSettings: (patch: Partial<Settings>) => void;

  generate: (opts?: { prompt?: string; scheme?: Scheme; mode?: Mode; keepLocks?: boolean }) => void;
  setCurrent: (p: Palette | null) => void;
  toggleLock: (role: Role) => void;
  setSwatch: (role: Role, hex: string) => void;
  vary: (amount?: number) => void;
  savePalette: (p?: Palette) => void;
  deletePalette: (id: string) => void;
  toggleFavorite: (id: string) => void;
  renamePalette: (id: string, name: string) => void;
  importPalettes: (list: Palette[]) => void;

  setPurpose: (id: string | null) => void;
  pushChat: (turn: Omit<ChatTurn, "id" | "at">) => void;
  clearChat: () => void;
  setBuildMeta: (m: BuildMeta | null) => void;
  setCedalionOpen: (v: boolean) => void;
  /** open the dock and, if given, actually answer something — a button that only
      flips a flag is a button that does nothing the second time you press it */
  askCedalion: (question?: string) => void;
  clearCedalionSeed: () => void;
  say: (msg: string) => void;
  upsertSite: (site: SavedSite) => void;
  deleteSite: (id: string) => void;
  setResumeId: (id: string | null) => void;
  setCanvasCtx: (c: CanvasCtx | null) => void;

  /** read place + sky (if allowed), forge the mark, freeze it */
  forgeIdentity: () => Promise<void>;
  /** the answer to the card's one question; both answers end with a forged mark */
  setIdentityConsent: (c: IdentityConsent) => Promise<void>;
  /** replace the frozen mark on purpose, from the edited numbers in About */
  adoptMark: (m: Mark) => void;
  /** load the mark into Akmon as the working palette */
  applyMark: () => void;
  /** the founder's key, typed anywhere in the app */
  unlockFounder: () => void;
  /** ask the download feed what the latest version is */
  checkNow: () => Promise<void>;
};

/** the in-flight update check, so a double mount or two screens asking share one request */
let checking: Promise<void> | null = null;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist(get: () => State) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = get();
    const snap: Snapshot = {
      version: SNAPSHOT_VERSION,
      palettes: s.palettes,
      settings: s.settings,
      savedAt: Date.now(),
      sites: s.sites,
      identity: s.mark,
      founder: s.founder,
      update: s.update.status === "idle" ? null : s.update,
    };
    void backend.save(snap);
  }, 400);
}

export const useApp = create<State>((set, get) => ({
  ready: false,
  screen: "home",
  settings: DEFAULT_SETTINGS,
  palettes: [],
  current: null,
  purposeId: null,
  chat: [],
  buildMeta: null,
  cedalionOpen: false,
  cedalionSeed: null,
  toast: null,
  sites: [],
  resumeId: null,
  canvasCtx: null,
  mark: null,
  identityBusy: false,
  founder: false,
  update: IDLE_CHECK,

  async init() {
    const loaded = (await backend.load()) ?? (await new LocalStore().load());
    set({
      ready: true,
      settings: loaded?.settings ?? DEFAULT_SETTINGS,
      palettes: loaded?.palettes ?? [],
      current: loaded?.palettes?.[0] ?? generatePalette({ prompt: "deep ember on obsidian, technical" }),
      sites: loaded?.sites ?? [],
      mark: loaded?.identity ?? null,
      founder: loaded?.founder ?? false,
      update: loaded?.update ?? IDLE_CHECK,
    });

    // Someone who has never been asked, or who was asked and left: the card handles it.
    // Someone who already has a mark keeps it — that is what "frozen" means.
    const consent = loaded?.settings?.identityConsent ?? "unset";
    if (!loaded?.identity && consent !== "unset") void get().forgeIdentity();

    // one quiet check a day, if they want it; About always has "check now"
    const settings = get().settings;
    if (settings.autoUpdateCheck && dueForCheck(loaded?.update?.at ?? 0)) void get().checkNow();
  },

  async forgeIdentity() {
    if (get().mark || get().identityBusy) return;
    set({ identityBusy: true });
    const reading = await readSky(get().settings.identityConsent);
    const mark = forgeMark(reading);
    set({ mark, identityBusy: false });
    persist(get);
    get().say(
      mark.place === "coords"
        ? `forge mark set · ${mark.score}/100 · ${mark.tier.name}`
        : `forge mark set from the clock alone · ${mark.score}/100 · ${mark.tier.name}`,
    );
  },

  async setIdentityConsent(c) {
    set({ settings: { ...get().settings, identityConsent: c } });
    persist(get);
    if (!get().mark) await get().forgeIdentity();
  },

  adoptMark(mark) {
    set({ mark });
    persist(get);
    get().say(`mark updated · ${mark.score}/100 · ${mark.tier.name}`);
  },

  applyMark() {
    const m = get().mark;
    if (!m) { get().say("no mark yet"); return; }
    set({ current: { ...m.palette, createdAt: Date.now() } });
    get().say(`${m.tier.mark} ${m.tier.name} loaded into akmon`);
  },

  unlockFounder() {
    if (get().founder) return;
    const mark = founderMark();
    set({ founder: true, mark, current: { ...mark.palette, createdAt: Date.now() } });
    persist(get);
    get().say(`${mark.tier.mark} ${mark.tier.name} — the master's own set`);
  },

  async checkNow() {
    if (checking) return checking;                     // one request at a time, however many screens ask
    checking = (async () => {
      const feed = get().settings.updateFeedUrl || DEFAULT_FEED;
      set({ update: { ...IDLE_CHECK, status: "checking", current: APP_VERSION, at: Date.now() } });
      const next = await checkForUpdate({ current: APP_VERSION, feed });
      set({ update: next });
      persist(get);
    })();
    try {
      await checking;
    } finally {
      checking = null;
    }
  },

  go: (screen) => set({ screen }),

  setSettings: (patch) => {
    set({ settings: { ...get().settings, ...patch } });
    persist(get);
  },

  generate: (opts = {}) => {
    const prev = get().current;
    const p = generatePalette({
      prompt: opts.prompt ?? prev?.prompt ?? "",
      scheme: opts.scheme,
      mode: opts.mode,
      keep: opts.keepLocks === false ? [] : prev?.swatches,
    });
    set({ current: p });
  },

  setCurrent: (current) => set({ current }),

  toggleLock: (role) => {
    const c = get().current;
    if (!c) return;
    set({
      current: {
        ...c,
        swatches: c.swatches.map((s) => (s.role === role ? { ...s, locked: !s.locked } : s)),
      },
    });
  },

  setSwatch: (role, hex) => {
    const c = get().current;
    if (!c) return;
    set({
      current: {
        ...c,
        swatches: c.swatches.map((s) =>
          s.role === role ? { ...s, hex: hex.toUpperCase(), name: describeColor(hex) } : s
        ),
      },
    });
  },

  vary: (amount = 0.5) => {
    const c = get().current;
    if (!c) return;
    set({ current: varyPalette(c, amount) });
  },

  savePalette: (p) => {
    const target = p ?? get().current;
    if (!target) return;
    const exists = get().palettes.some((x) => x.id === target.id);
    const palettes = exists
      ? get().palettes.map((x) => (x.id === target.id ? target : x))
      : [{ ...target }, ...get().palettes];
    set({ palettes, toast: exists ? "palette updated" : "saved to library" });
    persist(get);
    setTimeout(() => set({ toast: null }), 1800);
  },

  deletePalette: (id) => {
    set({ palettes: get().palettes.filter((p) => p.id !== id) });
    persist(get);
  },

  toggleFavorite: (id) => {
    set({
      palettes: get().palettes.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)),
    });
    persist(get);
  },

  renamePalette: (id, name) => {
    set({ palettes: get().palettes.map((p) => (p.id === id ? { ...p, name } : p)) });
    const c = get().current;
    if (c?.id === id) set({ current: { ...c, name } });
    persist(get);
  },

  importPalettes: (list) => {
    const have = new Set(get().palettes.map((p) => p.id));
    const fresh = list.filter((p) => p && p.swatches && !have.has(p.id));
    set({ palettes: [...fresh, ...get().palettes], toast: `imported ${fresh.length}` });
    persist(get);
    setTimeout(() => set({ toast: null }), 1800);
  },

  setPurpose: (purposeId) => set({ purposeId }),

  pushChat: (turn) =>
    set({
      chat: [
        ...get().chat,
        { ...turn, id: `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() },
      ],
    }),

  clearChat: () => set({ chat: [], cedalionSeed: null }),
  setBuildMeta: (buildMeta) => set({ buildMeta }),
  setCedalionOpen: (cedalionOpen) => set({ cedalionOpen }),
  askCedalion: (question) => set({ cedalionOpen: true, cedalionSeed: question?.trim() ? question.trim() : null }),
  clearCedalionSeed: () => set({ cedalionSeed: null }),

  upsertSite: (site) => {
    const exists = get().sites.some((x) => x.id === site.id);
    const rest = exists ? get().sites.map((x) => (x.id === site.id ? site : x)) : [site, ...get().sites];
    const sites = rest.slice(0, 10);
    set({ sites });
    persist(get);
  },

  deleteSite: (id) => {
    set({ sites: get().sites.filter((x) => x.id !== id) });
    persist(get);
  },

  setResumeId: (resumeId) => set({ resumeId }),
  setCanvasCtx: (canvasCtx) => set({ canvasCtx }),
  say: (toast) => {
    set({ toast });
    setTimeout(() => set({ toast: null }), 1800);
  },
}));
