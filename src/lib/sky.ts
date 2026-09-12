/**
 * HEPHAESTUS · reading the sky
 *
 * The forge mark wants four things: where you are, what year it is, what time it is, and what the sky
 * is doing. This module is the only place any of that is touched, and it obeys three rules:
 *
 *   1. the clock is always read — it is free, offline and stays on this machine;
 *   2. place and sky are read **once**, only after the person says yes in the identity card, and they
 *      go to a keyless weather lookup that never sees an account, a name or an email address;
 *   3. if any of it fails — no permission, no network, a blocked geolocation prompt — this returns a
 *      clock-only reading and the mark says so in plain words. It never throws, and it never pretends
 *      to have read something it did not.
 */
import type { SkyReading } from "../engine/identity";

export type Consent = "unset" | "granted" | "declined";

const GEO_TIMEOUT_MS = 8000;
const SKY_TIMEOUT_MS = 8000;
const SKY_HOST = "https://api.open-meteo.com/v1/forecast";

const dayOfYear = (d: Date) =>
  Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);

export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  } catch {
    return "unknown";
  }
}

/** the part of the reading that costs nothing and never needs permission */
export function clockReading(d = new Date()): SkyReading {
  return {
    place: "clock",
    lat: 0,
    lon: 0,
    tz: localTimezone(),
    year: d.getFullYear(),
    dayOfYear: dayOfYear(d),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
    ms: d.getMilliseconds(),
    weatherCode: null,
    temperature: null,
    humidity: null,
    takenAt: d.getTime(),
  };
}

function locate(timeoutMs = GEO_TIMEOUT_MS): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    const g = typeof navigator !== "undefined" ? navigator.geolocation : null;
    if (!g?.getCurrentPosition) return resolve(null);
    let settled = false;
    const done = (v: { lat: number; lon: number } | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const timer = setTimeout(() => done(null), timeoutMs + 500);
    g.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        done({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        done(null);
      },
      { timeout: timeoutMs, maximumAge: 0, enableHighAccuracy: false },
    );
  });
}

/** one keyless HTTP GET: no account, no token, nothing that identifies a person */
async function skyAt(lat: number, lon: number, timeoutMs = SKY_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url =
      `${SKY_HOST}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as { current?: Record<string, number> };
    const c = j?.current;
    if (!c || typeof c.weather_code !== "number") return null;
    return {
      weatherCode: c.weather_code,
      temperature: typeof c.temperature_2m === "number" ? c.temperature_2m : null,
      humidity: typeof c.relative_humidity_2m === "number" ? c.relative_humidity_2m : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The whole reading, in one call. `consent: "granted"` is the only path that touches a location or a
 * network request; anything else yields a clock-only mark.
 */
export async function readSky(consent: Consent): Promise<SkyReading> {
  const base = clockReading();
  if (consent !== "granted") return base;
  const where = await locate();
  if (!where) return base;
  const sky = await skyAt(where.lat, where.lon);
  return {
    ...base,
    place: "coords",
    lat: Math.round(where.lat * 10000) / 10000,
    lon: Math.round(where.lon * 10000) / 10000,
    weatherCode: sky?.weatherCode ?? null,
    temperature: sky?.temperature ?? null,
    humidity: sky?.humidity ?? null,
  };
}
