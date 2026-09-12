/**
 * HEPHAESTUS · “is there a new version?”
 *
 * This is a *check*, not an updater: it reads the same `release.json` the website reads, compares the
 * version string, and tells you whether to go get the installer. Nothing here downloads or installs a
 * thing, so it cannot half-update a desktop app.
 *
 * The version comparison does two jobs, as asked:
 *   · `0.4.0` vs `0.10.0` compares **numerically** — segment by segment, so ten beats four;
 *   · anything that isn't three dotted numbers (`0.4.0-rc1`, `2026.09.12-forge.2`) falls back to a
 *     **lexicographic** comparison, so a suffix still orders somewhere sensible.
 *
 * Reads are throttled to one every 24 hours so opening the app never phones anyone; About always has a
 * “check now” button for when you want one. A failure is reported as “couldn’t check”, never as “up to
 * date” — those are different facts and only one of them is a reason to relax.
 */

export const DEFAULT_FEED = "https://hephaestus-app.pages.dev/release.json";
export const POLL_INTERVAL_HOURS = 24;
const FETCH_TIMEOUT_MS = 8000;

export type UpdateStatus = "idle" | "checking" | "available" | "current" | "unreachable";

export type ReleaseFile = {
  id: string;
  os: string;
  arch?: string;
  label?: string;
  hint?: string;
  file: string;
  url: string;
  size?: number;
  kind?: string;
  sha256?: string;
};

export type UpdateCheck = {
  status: UpdateStatus;
  /** the version the feed advertises, when there was one to read */
  latest: string | null;
  /** what we are running */
  current: string;
  /** where to go for it — direct download URL for the installer or web link */
  href: string | null;
  /** direct installer download URL for user's platform */
  downloadUrl: string | null;
  /** name of the installer file (e.g. Hephaestus_0.4.0_x64-setup.exe) */
  fileName: string | null;
  /** size in bytes of the installer file */
  fileSize: number | null;
  /** detected platform (windows | macos | linux | unknown) */
  platform: string | null;
  /** all files in the release */
  files: ReleaseFile[];
  /** epoch ms of the last attempt, successful or not */
  at: number;
  /** one honest line, only when status is "unreachable" */
  reason: string | null;
};

export const IDLE_CHECK: UpdateCheck = {
  status: "idle",
  latest: null,
  current: "",
  href: null,
  downloadUrl: null,
  fileName: null,
  fileSize: null,
  platform: null,
  files: [],
  at: 0,
  reason: null,
};

export type PlatformOS = "windows" | "macos" | "linux" | "unknown";

export function detectPlatform(): { os: PlatformOS; arch?: "arm64" | "x64" } {
  if (typeof navigator === "undefined") return { os: "unknown" };
  const ua = (navigator.userAgent || "").toLowerCase();
  const nav = navigator as unknown as { userAgentData?: { platform?: string; architecture?: string } };
  const plat = (nav.userAgentData?.platform || navigator.platform || "").toLowerCase();

  if (plat.includes("win") || ua.includes("windows")) {
    return { os: "windows", arch: "x64" };
  }
  if (plat.includes("mac") || ua.includes("macintosh") || ua.includes("mac os")) {
    const isArm = ua.includes("arm") || ua.includes("apple silicon") || nav.userAgentData?.architecture === "arm";
    return { os: "macos", arch: isArm ? "arm64" : "x64" };
  }
  if (plat.includes("linux") || ua.includes("linux") || ua.includes("x11")) {
    return { os: "linux", arch: "x64" };
  }
  return { os: "unknown" };
}

export function pickInstallerFile(files: ReleaseFile[]): ReleaseFile | null {
  if (!Array.isArray(files) || files.length === 0) return null;
  const { os, arch } = detectPlatform();

  if (os === "windows") {
    return (
      files.find((f) => f.os === "windows" && (f.kind === "installer" || f.id === "windows-x64")) ||
      files.find((f) => f.os === "windows" && f.file?.endsWith(".exe")) ||
      files.find((f) => f.os === "windows") ||
      null
    );
  }

  if (os === "macos") {
    if (arch === "arm64") {
      const arm = files.find((f) => f.os === "macos" && (f.arch === "arm64" || f.id === "macos-arm64"));
      if (arm) return arm;
    } else if (arch === "x64") {
      const x64 = files.find((f) => f.os === "macos" && (f.arch === "x64" || f.id === "macos-x64"));
      if (x64) return x64;
    }
    return files.find((f) => f.os === "macos") || null;
  }

  if (os === "linux") {
    return (
      files.find((f) => f.os === "linux" && (f.kind === "self-contained" || f.file?.endsWith(".AppImage"))) ||
      files.find((f) => f.os === "linux" && (f.kind === "package" || f.file?.endsWith(".deb"))) ||
      files.find((f) => f.os === "linux") ||
      null
    );
  }

  return files.find((f) => f.kind === "installer") || files[0] || null;
}

/**
 * Triggers a direct installer download right in the app.
 */
export function startUpdateDownload(url: string, filename?: string) {
  if (!url) return;
  try {
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 1000);
  } catch {
    // ignore
  }

  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // ignore
  }
}

const NUMERIC = /^\d+(\.\d+)*([-+].*)?$/;

/**
 * Compare two version strings. Numeric when both look like dotted numbers, lexical otherwise.
 * Returns <0 when `a` is older, 0 when they are the same, >0 when `a` is newer.
 */
export function compareVersions(a: string, b: string): number {
  const x = String(a ?? "").trim();
  const y = String(b ?? "").trim();
  if (x === y) return 0;
  if (NUMERIC.test(x) && NUMERIC.test(y)) {
    const xs = x.split(/[-+]/)[0].split(".").map(Number);
    const ys = y.split(/[-+]/)[0].split(".").map(Number);
    for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
      const d = (xs[i] ?? 0) - (ys[i] ?? 0);
      if (d !== 0) return d < 0 ? -1 : 1;
    }
    // same numbers, different suffixes: a release outranks its own pre-releases, then compare lexically
    const sx = x.includes("-") ? x.split(/[-+]/).slice(1).join("-") : "";
    const sy = y.includes("-") ? y.split(/[-+]/).slice(1).join("-") : "";
    if (sx === sy) return 0;
    if (!sx) return 1;
    if (!sy) return -1;
    return sx < sy ? -1 : 1;
  }
  return x < y ? -1 : 1;
}

const baseOf = (feed: string) => {
  try {
    const u = new URL(feed, typeof location !== "undefined" ? location.href : "http://localhost/");
    return u.origin === "null" || u.protocol === "tauri:" ? feed.replace(/\/release\.json.*$/, "/") : `${u.protocol}//${u.host}/`;
  } catch {
    return feed;
  }
};

/**
 * Ask the feed what the current version is. `fetchImpl` exists so the QA suite can answer without a
 * network; the app never passes one.
 */
export async function checkForUpdate(opts: {
  current: string;
  feed?: string;
  fetchImpl?: typeof fetch;
  now?: number;
  timeoutMs?: number;
}): Promise<UpdateCheck> {
  const feed = (opts.feed || DEFAULT_FEED).trim();
  const now = opts.now ?? Date.now();
  const doFetch = opts.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  const base = {
    status: "unreachable" as UpdateStatus,
    latest: null,
    current: opts.current,
    href: null,
    downloadUrl: null,
    fileName: null,
    fileSize: null,
    platform: null,
    files: [] as ReleaseFile[],
    at: now,
  };

  if (!doFetch) return { ...base, reason: "this build has no fetch() to ask with" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  let doc: Record<string, unknown> | null = null;
  try {
    // cache-busted: a stale answer about versions is worse than no answer
    const res = await doFetch(`${feed}?t=${Math.floor(now / 60000)}`, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { ...base, reason: `the download feed answered ${res.status}` };
    doc = (await res.json()) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...base, reason: /abort/i.test(msg) ? "the download feed took too long to answer" : "the download feed could not be reached" };
  } finally {
    clearTimeout(timer);
  }

  if (!doc || typeof doc !== "object" || typeof doc.version !== "string" || !doc.version) {
    return { ...base, reason: "the download feed didn’t look like a release" };
  }
  const latest = doc.version;
  const preparing = doc.status === "preparing";
  const newer = compareVersions(latest, opts.current) > 0;
  const rawFiles = Array.isArray(doc.files) ? (doc.files as ReleaseFile[]) : [];
  const installer = pickInstallerFile(rawFiles);
  const plat = detectPlatform();
  const directUrl = installer?.url || null;
  const webHref = `${baseOf(feed)}#get`;
  const href = directUrl || (newer ? webHref : null);

  return {
    status: newer && !preparing ? "available" : "current",
    latest,
    current: opts.current,
    href,
    downloadUrl: directUrl,
    fileName: installer?.file || null,
    fileSize: typeof installer?.size === "number" ? installer.size : null,
    platform: plat.os !== "unknown" ? plat.os : null,
    files: rawFiles,
    at: now,
    reason: null,
  };
}

/** is it time to ask again on our own? */
export function dueForCheck(lastAt: number, now = Date.now(), hours = POLL_INTERVAL_HOURS): boolean {
  if (!Number.isFinite(lastAt) || lastAt <= 0) return true;
  return now - lastAt >= hours * 3600 * 1000;
}
