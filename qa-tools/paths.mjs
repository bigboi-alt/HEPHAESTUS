/**
 * Where the suites live, in case this repo isn't at /home/user/hephaestus.
 * Everything is overridable: SHOTS=… APP=… SERVE=… PREVIEW=… node voice-qa.mjs
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SHOTS = process.env.SHOTS || join(ROOT, "qa-shots");
export const PREVIEW = process.env.PREVIEW || join(ROOT, "site-preview.html");
export const APP = process.env.APP || "http://127.0.0.1:5199/";
export const SITE = process.env.SERVE || "http://127.0.0.1:8099/index.html";
export const FILE_URL = "file://" + PREVIEW;
mkdirSync(SHOTS, { recursive: true });
