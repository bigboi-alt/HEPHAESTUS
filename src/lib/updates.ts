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

export type UpdateCheck = {
  status: UpdateStatus;
  /** the version the feed advertises, when there was one to read */
  latest: string | null;
  /** what we are running */
  current: string;
  /** where to go for it — a page on the same host as the feed, never a redirect through a third party */
  href: string | null;
  /** epoch ms of the last attempt, successful or not */
  at: number;
  /** one honest line, only when status is "unreachable" */
  reason: string | null;
};

export const IDLE_CHECK: UpdateCheck = {
  status: "idle", latest: null, current: "", href: null, at: 0, reason: null,
};

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
  const base = { status: "unreachable" as UpdateStatus, latest: null, current: opts.current, href: null, at: now };

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
  return {
    status: newer && !preparing ? "available" : "current",
    latest,
    current: opts.current,
    href: newer ? `${baseOf(feed)}#get` : null,
    at: now,
    reason: null,
  };
}

/** is it time to ask again on our own? */
export function dueForCheck(lastAt: number, now = Date.now(), hours = POLL_INTERVAL_HOURS): boolean {
  if (!Number.isFinite(lastAt) || lastAt <= 0) return true;
  return now - lastAt >= hours * 3600 * 1000;
}
