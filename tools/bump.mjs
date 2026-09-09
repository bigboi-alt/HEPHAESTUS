// Bump the Hephaestus version in all three places it lives:
//   node tools/bump.mjs 0.2.0
// Keeps package.json + package-lock.json in sync (npm pkg set), then
// patches Cargo.toml and src-tauri/tauri.conf.json. Commit everything
// and push — the release workflow drafts v0.2.0 automatically.
"use strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next || "")) {
  console.error("usage: node tools/bump.mjs 0.2.0");
  process.exit(1);
}

// 1) package.json + package-lock.json
execFileSync("npm", ["pkg", "set", "version=" + next], { cwd: root, stdio: "inherit" });

// 2) Cargo.toml  (first version line = [package] version)
const cargo = path.join(root, "src-tauri", "Cargo.toml");
writeFileSync(
  cargo,
  readFileSync(cargo, "utf8").replace(/^(version\s*=\s*")[^"]+("\s*)$/m, `$1${next}$2`)
);

// 3) tauri.conf.json
const conf = path.join(root, "src-tauri", "tauri.conf.json");
const json = JSON.parse(readFileSync(conf, "utf8"));
json.version = next;
writeFileSync(conf, JSON.stringify(json, null, 2) + "\n");

console.log("bumped everything to " + next);
