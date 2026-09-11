/**
 * HEPHAESTUS · persistence
 *
 * One narrow interface, two implementations. Today everything is local and
 * works offline; when we bolt Firebase on, only CloudStore changes — no
 * screen, store or engine has to know.
 */

import type { Palette } from "../engine/akmon";
import type { CvDoc } from "../engine/canvas";

export type ThemeId = "obsidian" | "graphite" | "paper" | "claude" | "blueprint" | "ember";

/**
 * Claude ships in two skins. `ambrosia` is the cream shell it has always had;
 * `nyx` is the same voice on dusted black with orange coals. Only the claude
 * theme reads this — every other theme ignores it.
 */
export type ClaudeStyle = "ambrosia" | "nyx";

export type Settings = {
  theme: ThemeId;
  /** which Claude the shell is wearing; ignored by every other theme */
  claudeStyle?: ClaudeStyle;
  accent: string;
  density: "compact" | "comfortable";
  colorFormat: "hex" | "rgb" | "hsl" | "oklch";
  motion: boolean;
  cedalionAutoAudit: boolean;
  cedalionDock: boolean;
  contrastFloor: 4.5 | 7;
  trendsRemoteUrl: string;
  trendsAutoRefresh: boolean;
  displayName: string;
  handle: string;
  /** last position of the floating cedalion window */
  chatRect?: { x: number; y: number; w: number; h: number } | null;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "obsidian",
  claudeStyle: "ambrosia",
  accent: "#F5F5F5",
  density: "comfortable",
  colorFormat: "hex",
  motion: true,
  cedalionAutoAudit: true,
  cedalionDock: true,
  contrastFloor: 4.5,
  trendsRemoteUrl: "",
  trendsAutoRefresh: false,
  displayName: "Smith",
  handle: "@forge",
};

/** a saved canvas build — shown on the dashboard as “continue building” */
export type SavedSite = {
  id: string;
  name: string;
  doc: CvDoc;
  palette: Palette;
  pageCount: number;
  updatedAt: number;
};

export type Snapshot = {
  version: number;
  palettes: Palette[];
  settings: Settings;
  savedAt: number;
  sites?: SavedSite[];
};

export const SNAPSHOT_VERSION = 1;

export interface Store {
  readonly kind: "local" | "cloud";
  load(): Promise<Snapshot | null>;
  save(s: Snapshot): Promise<void>;
  clear(): Promise<void>;
}

const KEY = "hephaestus.v1";

export class LocalStore implements Store {
  readonly kind = "local" as const;

  async load(): Promise<Snapshot | null> {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Snapshot;
      if (!parsed || typeof parsed !== "object") return null;
      return {
        version: parsed.version ?? SNAPSHOT_VERSION,
        palettes: Array.isArray(parsed.palettes) ? parsed.palettes : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        savedAt: parsed.savedAt ?? Date.now(),
        sites: Array.isArray(parsed.sites) ? parsed.sites : [],
      };
    } catch {
      return null;
    }
  }

  async save(s: Snapshot): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      console.warn("[hephaestus] save failed", e);
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(KEY);
  }
}

/**
 * Placeholder for the Firebase free tier. Deliberately not wired: shipping a
 * fake sync that silently drops data is worse than shipping none.
 */
export class CloudStore implements Store {
  readonly kind = "cloud" as const;
  private fallback: Store;
  constructor(fallback: Store = new LocalStore()) {
    this.fallback = fallback;
  }
  load() { return this.fallback.load(); }
  save(s: Snapshot) { return this.fallback.save(s); }
  clear() { return this.fallback.clear(); }
}

export const store: Store = new LocalStore();

/* --- portable file export/import ---------------------------------- */

export function toFile(snapshot: Snapshot): string {
  return JSON.stringify({ ...snapshot, app: "Hephaestus", exportedAt: Date.now() }, null, 2);
}

export function fromFile(text: string): Partial<Snapshot> | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.palettes)) return null;
    return parsed as Partial<Snapshot>;
  } catch {
    return null;
  }
}

export function download(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
