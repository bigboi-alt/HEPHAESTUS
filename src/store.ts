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
  type Settings, type Snapshot,
} from "./lib/storage";

export type Screen = "home" | "akmon" | "library" | "trends" | "build" | "settings";

export type BuildMeta = {
  purposeLabel: string;
  sectionsOn: number;
  sectionNames: string[];
};

export type ChatTurn = {
  id: string;
  role: "you" | "cedalion";
  text: string;
  bullets?: string[];
  refs?: string[];
  suggestions?: string[];
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
  toast: string | null;

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
  say: (msg: string) => void;
};

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
  toast: null,

  async init() {
    const loaded = (await backend.load()) ?? (await new LocalStore().load());
    set({
      ready: true,
      settings: loaded?.settings ?? DEFAULT_SETTINGS,
      palettes: loaded?.palettes ?? [],
      current: loaded?.palettes?.[0] ?? generatePalette({ prompt: "deep ember on obsidian, technical" }),
    });
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

  clearChat: () => set({ chat: [] }),
  setBuildMeta: (buildMeta) => set({ buildMeta }),
  setCedalionOpen: (cedalionOpen) => set({ cedalionOpen }),
  say: (toast) => {
    set({ toast });
    setTimeout(() => set({ toast: null }), 1800);
  },
}));
