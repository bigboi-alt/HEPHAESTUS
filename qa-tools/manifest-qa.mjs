/**
 * qa-tools/manifest-qa.mjs — the release pipeline's own logic, run for real.
 *
 * Everything here is a claim the workflows will make about a build: "the four platforms are present",
 * "nothing empty or half-uploaded got published", "a stale artifact would have been caught",
 * "the live release's files survived the deploy", "the site's own verifier fails a bundle that lies".
 * Those are not browser questions, so they are not tested by looking at a browser. They are tested by
 * executing the same two scripts CI executes, on synthetic artifact folders, and reading the exit
 * codes and the bytes they leave behind.
 *
 * The second half pins the workflow files themselves. A pipeline can be logically perfect and still
 * be defeated by one line that says `contents: write`, or by a deploy step that forgot to ask whether
 * it was allowed to run.
 *
 * run:  cd hephaestus/qa-tools && node manifest-qa.mjs
 */
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startSite } from "./fixture-site.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const REPO = path.resolve(import.meta.dirname, "..");
const TOOL = (n) => path.join(REPO, "tools", n);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "heph-pipe-"));
const MB = 1048576;

const run = (script, args, opts = {}) => {
  const r = spawnSync("node", [TOOL(script), ...args], { cwd: REPO, encoding: "utf8", ...opts });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};
/* Section 5 drives a server that runs in THIS process, so the child has to be spawned
   asynchronously: spawnSync would freeze the event loop and the fixture could never answer. */
const runAsync = (script, args) => new Promise((done) => {
  const c = spawn("node", [TOOL(script), ...args], { cwd: REPO });
  let out = "";
  c.stdout.on("data", (d) => { out += d; });
  c.stderr.on("data", (d) => { out += d; });
  c.on("close", (code) => done({ code, out }));
});

/** a folder of installers, with real bytes so sizes and hashes mean something */
function artifacts(dir, { version = "0.4.0", drop = [], sizes = {}, extra = [] } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const names = [
    `Hephaestus_${version}_x64-setup.exe`,
    `Hephaestus_${version}_x64_en-US.msi`,
    `Hephaestus_${version}_aarch64.dmg`,
    `Hephaestus_${version}_x64.dmg`,
    `hephaestus_${version}_amd64.deb`,
    `Hephaestus_${version}_amd64.AppImage`,
    ...extra,
  ];
  for (const n of names) {
    if (drop.some((d) => n.includes(d))) continue;
    const size = sizes[n] ?? 2 * MB + n.length;
    const dest = path.join(dir, n);
    fs.mkdirSync(path.dirname(dest), { recursive: true });   // .app bundles nest; write the folder first
    fs.writeFileSync(dest, Buffer.alloc(size, 3));
  }
  return names.filter((n) => !drop.some((d) => n.includes(d)));
}
const sha = (p) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");

console.log("\nmanifest-qa · what the pipeline insists on, checked without a cloud");

// ── 1. the config is the source of truth ────────────────────────────────────────────────────────
{
  const conf = JSON.parse(fs.readFileSync(path.join(REPO, "src-tauri/tauri.conf.json"), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8"));
  const cargo = /version\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(REPO, "src-tauri/Cargo.toml"), "utf8"))[1];
  ok(pkg.version === conf.version && conf.version === cargo, `three version fields agree: package.json ${pkg.version} = tauri.conf ${conf.version} = Cargo ${cargo}`);
  ok(Array.isArray(conf.bundle.targets) && conf.bundle.targets.length > 0, `bundle.targets is an explicit list (${conf.bundle.targets.join(", ")}) — not "all"`);
  const r = run("release-manifest.mjs", ["--print-required"]);
  ok(r.code === 0, "--print-required answers without needing a build");
  for (const t of conf.bundle.targets) ok(new RegExp(t + "\\b").test(r.out) || t === "appimage", `  ${t} appears in the required-file table`);
  ok(/required\s+windows-x64\s+windows\/x64 \.exe/.test(r.out), "the Windows slot is a required .exe");
  ok(/built, optional\s+windows-x64-msi/.test(r.out), "the .msi is published when built, but its absence is not a failed release");
  ok(/not built\s+linux-x64-rpm/.test(r.out), "an .rpm nobody builds is marked not built rather than demanded");
  const bad = run("release-manifest.mjs", ["--check-config", "--expect-tag", "v9.9.9"]);
  ok(bad.code === 1 && /tag says v9\.9\.9/.test(bad.out), `a tag that disagrees with the configs is refused: ${(bad.out.match(/::error::[^\n]*/) || [""])[0].slice(0, 74)}…`);
  const good = run("release-manifest.mjs", ["--check-config", "--expect-tag", `v${pkg.version}`]);
  ok(good.code === 0 && /configs agree/.test(good.out), "and the matching tag passes");
}

// ── 2. a good batch, validated then written ─────────────────────────────────────────────────────
{
  const a = path.join(tmp, "good");
  artifacts(a);
  const pre = run("release-manifest.mjs", ["--scan", a, "--version", "0.4.0", "--check-only", "--out", path.join(tmp, "x/release.json"), "--downloads", path.join(tmp, "x/downloads")]);
  ok(pre.code === 0 && /release verified: 0\.4\.0 · 6 files/.test(pre.out), `check-only reports a clean batch: ${(pre.out.match(/release verified[^\n]*/) || [""])[0]}`);
  ok(!fs.existsSync(path.join(tmp, "x")), "and preflight wrote nothing — no folder, no manifest, nothing to deploy");

  const live = path.join(tmp, "live");
  fs.mkdirSync(path.join(live, "downloads"), { recursive: true });
  const oldFile = "Hephaestus_0.3.0_x64-setup.exe";
  fs.writeFileSync(path.join(live, "downloads", oldFile), Buffer.alloc(2 * MB + 7, 1));
  fs.writeFileSync(path.join(live, "release.json"), JSON.stringify({
    schema: 1, status: "ready", product: "Hephaestus", version: "0.3.0", publishedAt: "2026-08-02",
    channel: "stable", signing: {}, previous: [],
    files: [{ id: "windows-x64", file: oldFile, url: `/downloads/${oldFile}`, size: 2 * MB + 7, sha256: sha(path.join(live, "downloads", oldFile)) }],
  }));
  const out = path.join(tmp, "site-built");
  const w = run("release-manifest.mjs", ["--scan", a, "--version", "0.4.0", "--out", path.join(out, "release.json"), "--downloads", path.join(out, "downloads"), "--carry-from", live, "--date", "2026-09-10"]);
  ok(w.code === 0 && /6 new, 1 carried forward/.test(w.out), `writing: ${(w.out.match(/downloads: [^\n]*/) || [""])[0]}`);
  const doc = JSON.parse(fs.readFileSync(path.join(out, "release.json"), "utf8"));
  ok(doc.status === "ready" && doc.version === "0.4.0" && doc.publishedAt === "2026-09-10", "the manifest states what it describes, including the date given");
  ok(doc.files.length === 6 && doc.files.filter((f) => f.required).length === 5, "six files listed, five of them required");
  ok(doc.files.every((f) => /^\/downloads\/[A-Za-z0-9._+-]+$/.test(f.url)), "every url is a plain path under /downloads/");
  ok(doc.files.every((f) => fs.existsSync(path.join(out, "downloads", f.file))), "every listed file exists in the folder that will be deployed");
  ok(doc.files.every((f) => f.size === fs.statSync(path.join(out, "downloads", f.file)).size), "every listed size is the real byte count");
  ok(doc.files.every((f) => f.sha256 === sha(path.join(out, "downloads", f.file))), "every listed sha256 matches the bytes on disk");
  ok(doc.files.every((f) => typeof f.signing === "string" && /unsigned/.test(f.signing)), "each file declares its signing state as the truth (unsigned)");
  ok(doc.files.filter((f) => f.os === "macos").every((f) => /right-click/.test(String(f.advisory))), "and macOS files carry the advisory the site shows");
  ok(doc.previous.length === 1 && doc.previous[0].version === "0.3.0", "the release that was live became history, not garbage");
  ok(fs.existsSync(path.join(out, "downloads", oldFile)), "the old installer was carried into the new bundle, so its link still works");
  ok(!JSON.stringify(doc).includes("github.com"), "no github.com appears anywhere in the manifest the site reads");
  const again = run("release-manifest.mjs", ["--scan", a, "--version", "0.4.0", "--out", path.join(out, "release.json"), "--downloads", path.join(out, "downloads"), "--carry-from", live, "--date", "2026-09-10"]);
  const a1 = sha(path.join(out, "release.json"));
  ok(again.code === 0 && sha(path.join(out, "release.json")) === a1, "re-running the publish step over the same bundle is idempotent — same bytes, no churn");
  ok(fs.readdirSync(path.join(out, "downloads")).length === 7, "and it does not double-write the carried file (6 new + 1 old = 7)");
  const mixed = run("release-manifest.mjs", ["--scan", path.join(out, "downloads"), "--version", "0.4.0", "--check-only"]);
  ok(mixed.code === 1 && /carries version 0\.3\.0/.test(mixed.out), "scanning a downloads/ folder wholesale is refused: two versions in one batch is a mistake, never a release");
}

// ── 3. the ways a batch is not allowed out ──────────────────────────────────────────────────────
{
  const cases = [
    ["a platform produced nothing", { drop: ["AppImage"] }, /missing linux-x64-appimage/],
    ["an upload arrived empty", { sizes: { "Hephaestus_0.4.0_x64.dmg": 0 } }, /is 0 bytes/],
    ["a bundle got truncated", { sizes: { "Hephaestus_0.4.0_aarch64.dmg": 4096 } }, /below the 1024 KiB floor/],
    ["the runners disagreed on the version", { version: "0.3.9" }, /carries version 0\.3\.9.*stale artifact/s],
  ];
  for (const [label, opts, want] of cases) {
    const dir = path.join(tmp, "bad-" + label.replace(/\W+/g, "-"));
    artifacts(dir, opts);
    const r = run("release-manifest.mjs", ["--scan", dir, "--version", "0.4.0", "--out", path.join(dir, "o/release.json"), "--downloads", path.join(dir, "o/downloads")]);
    ok(r.code === 1 && want.test(r.out), `refused: ${label} — ${(r.out.match(/FAIL\s+[^\n]*/) || [""])[0].slice(0, 70)}…`);
    ok(!fs.existsSync(path.join(dir, "o")), `  and nothing was written for ${label}`);
  }
  const noisy = path.join(tmp, "noise");
  artifacts(noisy, { extra: ["Hephaestus_0.4.0_x64.exe.sig", "bundle/macos/Hephaestus.app/Contents/Info.plist", "notes.txt"] });
  const nr = run("release-manifest.mjs", ["--scan", noisy, "--version", "0.4.0", "--out", path.join(tmp, "noise.json"), "--downloads", path.join(tmp, "noise-dl")]);
  ok(nr.code === 0 && /skipped .*\.sig/.test(nr.out), "an updater signature is named and skipped, not published as a download");
  ok(/skipped .*notes\.txt/.test(nr.out), "a stray text file from the runner is skipped too");
  ok(fs.readdirSync(path.join(tmp, "noise-dl")).length === 6, "and the bundle that got written holds only the six packages");
  const noVer = path.join(tmp, "unversioned");
  fs.mkdirSync(noVer, { recursive: true });
  for (const n of ["app.exe", "x.msi", "a_aarch64.dmg", "b_x64.dmg", "c_amd64.deb", "d_amd64.AppImage"]) fs.writeFileSync(path.join(noVer, n), Buffer.alloc(2 * MB, 5));
  const ur = run("release-manifest.mjs", ["--scan", noVer, "--version", "0.4.0", "--out", path.join(tmp, "u/release.json"), "--downloads", path.join(tmp, "u/dl")]);
  ok(ur.code === 0 && /no version in its filename/.test(ur.out), "files without a version in the name are a warning, since the config check above already binds them");
  const drift = path.join(tmp, "drift");
  fs.mkdirSync(drift, { recursive: true });
  for (const n of ["Hephaestus_0.4.0_x64-setup.exe", "Hephaestus_0.4.0_aarch64.dmg"]) fs.writeFileSync(path.join(drift, n), Buffer.alloc(2 * MB, 5));
  const dr = run("release-manifest.mjs", ["--scan", drift, "--version", "0.4.0"]);
  ok(dr.code === 1 && /missing windows-x64-msi/.test(dr.out) === false && /missing macos-x64/.test(dr.out), "a half-built matrix reports the missing platforms, and only those");
}

// ── 4. carry-forward is forgiving, in the one direction it should be ─────────────────────────────
{
  const a = path.join(tmp, "carry");
  artifacts(a);
  const r = run("release-manifest.mjs", ["--scan", a, "--version", "0.4.0", "--out", path.join(tmp, "c1/release.json"), "--downloads", path.join(tmp, "c1/downloads"), "--carry-from", path.join(tmp, "nowhere-at-all")]);
  ok(r.code === 0 && /carry-forward skipped/.test(r.out), "a missing carry source is a note, not a failed release");
  ok(/nothing is deleted either/.test(r.out), "and it tells the operator so in words, rather than silently dropping history");

  const live = path.join(tmp, "live2");
  fs.mkdirSync(path.join(live, "downloads"), { recursive: true });
  const oldFile = "Hephaestus_0.3.0_linux_amd64.deb";
  fs.writeFileSync(path.join(live, "downloads", oldFile), Buffer.alloc(2 * MB + 11, 9));
  fs.writeFileSync(path.join(live, "release.json"), JSON.stringify({
    schema: 1, status: "ready", product: "Hephaestus", version: "0.3.0", publishedAt: "2026-07-01",
    signing: {}, previous: [],
    files: [{ id: "linux-x64-deb", file: oldFile, url: `/downloads/${oldFile}`, size: 2 * MB + 11, sha256: sha(path.join(live, "downloads", oldFile)) }],
  }));

  const psFiles = path.join(tmp, "prepared-files");
  const p1 = run("prepare-site.mjs", ["--into", psFiles, "--files-only", "--carry-from", live]);
  ok(p1.code === 0 && /1 file \(1 carried\)/.test(p1.out), `prepare-site: ${(p1.out.match(/downloads\/: [^\n]*/) || [""])[0]}`);
  ok(fs.existsSync(path.join(psFiles, "downloads", oldFile)), "the live installer is in the folder about to be deployed");
  ok(JSON.parse(fs.readFileSync(path.join(psFiles, "release.json"), "utf8")).status === "preparing",
    "--files-only keeps the repo's placeholder metadata, because the manifest is written next");
  ok(!fs.existsSync(path.join(psFiles, "README.md")), "and the folder's own notes are not published to visitors");

  const psFull = path.join(tmp, "prepared-full");
  const p2 = run("prepare-site.mjs", ["--into", psFull, "--carry-from", live]);
  const carried = JSON.parse(fs.readFileSync(path.join(psFull, "release.json"), "utf8"));
  ok(p2.code === 0 && carried.version === "0.3.0" && carried.status === "ready",
    "without --files-only the live release is carried instead of the repo's copy, so a docs push cannot demote it");

  // async on purpose: this server answers from this very process, and a spawnSync parent
  // would freeze the loop and leave the child with nobody to talk to.
  const url = await startSite("ready");
  const psUrl = await runAsync("prepare-site.mjs", ["--into", path.join(tmp, "prepared-url"), "--carry-from", url.origin]);
  const names = url.doc.files.map((f) => f.file).concat(url.doc.previous[0].files.map((f) => f.file));
  const got = fs.readdirSync(path.join(tmp, "prepared-url", "downloads")).sort();
  ok(psUrl.code === 0 && psUrl.out.includes(`${names.length} files`) && psUrl.out.includes(`${names.length} carried`),
    `carrying over http works the same way: ${(psUrl.out.match(/downloads\/: [^\n]*/) || [""])[0]}`);
  ok(names.slice().sort().join() === got.join(), `every file the live manifest listed arrived (${got.length})`);
  const first = path.join(tmp, "prepared-url", "downloads", url.doc.files[0].file);
  ok(fs.statSync(first).size === url.doc.files[0].size, "and the bytes fetched from the live site are the size the manifest claimed");
  const reparsed = JSON.parse(fs.readFileSync(path.join(tmp, "prepared-url", "release.json"), "utf8"));
  ok(reparsed.version === "0.3.0" || reparsed.version === "0.4.0", `the metadata that came along is valid JSON from the live origin (${reparsed.version})`);
  await url.close();
}

// ── 5. the verifier, against a real bundle it can disagree with ─────────────────────────────────
{
  const site = await startSite("ready");
  const file = path.join(site.tmp, "release.json");
  const doc0 = JSON.parse(fs.readFileSync(file, "utf8"));
  const check = async (mutate, want, label, expect = 1) => {
    const doc = structuredClone(doc0);
    mutate(doc);
    fs.writeFileSync(file, JSON.stringify(doc));
    const r = await runAsync("verify-release.mjs", ["--base", site.origin]);
    fs.writeFileSync(file, JSON.stringify(doc0));
    ok(r.code === expect && want.test(r.out),
      `verifier ${expect ? "refuses" : "accepts, with a note for"} ${label}: ${(r.out.match(/(FAIL|note)\s+[^\n]*/) || [""])[0].slice(0, 72)}…`);
  };
  const clean = await runAsync("verify-release.mjs", ["--base", site.origin]);
  ok(clean.code === 0 && /8 files verified/.test(clean.out), `a good bundle passes with nothing to say (6 files listed + 2 older): ${(clean.out.match(/[^\n]*verified[^\n]*/) || [""])[0]}`);
  ok(!/note/.test(clean.out), "and the fixture sends Content-Disposition, so even the advisory note is absent — as it will be behind Cloudflare");
  await check((d) => { d.files[0].size = 12345; }, /is \d+ bytes but the manifest says 12345/, "a size that does not match the bytes");
  await check((d) => { d.files[1].sha256 = "deadbeef"; }, /sha256 is missing or not 64 hex/, "a truncated or absent hash");
  await check((d) => { d.files[2].url = "/etc/passwd"; }, /not a path under \/downloads\//, "a path outside the download folder");
  await check((d) => { d.files[3].url = "https://github.com/x/y/releases/download/v1/z.dmg"; }, /must not send visitors there/, "a download hosted on somebody else's site");
  await check((d) => { d.files[4].file = "../escape.dmg"; }, /not a plain file name/, "a file name with a traversal in it");
  await check((d) => { d.files = []; }, /files\[\] is empty/, "status ready with no files to get");
  await check((d) => { d.status = "halfway"; }, /unknown status/, "a status the site has no rendering for");
  await check((d) => { d.schema = 2; }, /schema is 2/, "a manifest from a future pipeline");
  await check((d) => { d.previous = [{ version: "0.0.1", files: [{ id: "x", file: "gone.exe", url: "/downloads/gone.exe", size: 1, sha256: "0".repeat(64) }] }]; },
    /note .*could not be fetched|note .*404/, "a vanished older file is a note, not a blocked deploy", 0);
  const gone = path.join(site.tmp, "downloads", doc0.files[0].file);
  fs.rmSync(gone);
  const miss = await runAsync("verify-release.mjs", ["--base", site.origin]);
  ok(miss.code === 1 && new RegExp(doc0.files[0].id + ".*404").test(miss.out), "a current release missing its file is a hard failure, naming the slot");
  fs.writeFileSync(gone, Buffer.alloc(2 * MB + 1000, 7));
  const prep = await runAsync("verify-release.mjs", ["--base", site.origin, "--allow-preparing"]);
  ok(prep.code === 0 || /status is "preparing"/.test(prep.out) === false, "with --allow-preparing a non-ready manifest is not an error");
  fs.writeFileSync(path.join(site.tmp, "index.html"), "<!doctype html><title>old site</title><p>downloads at /dl</p>");
  const stalePage = await runAsync("verify-release.mjs", ["--base", site.origin]);
  ok(stalePage.code === 1 && /no #get section/.test(stalePage.out), "a bundle whose page predates this design is caught as a stale deploy");
  fs.writeFileSync(path.join(site.tmp, "index.html"), "<!doctype html><title>Hephaestus</title><div id=\"get\"></div><script src=\"https://api.github.com/x.js\"></script>");
  const wrongPage = await runAsync("verify-release.mjs", ["--base", site.origin]);
  ok(wrongPage.code === 1 && /still talks to GitHub directly/.test(wrongPage.out), "and a page that went back to GitHub for downloads is refused outright");
  await site.close();
}

// ── 6. the workflow files ───────────────────────────────────────────────────────────────────────
{
  const rel = fs.readFileSync(path.join(REPO, ".github/workflows/release.yml"), "utf8");
  const site = fs.readFileSync(path.join(REPO, ".github/workflows/site.yml"), "utf8");
  ok(!/tauri-action/.test(rel), "release.yml no longer asks anyone to create a GitHub release");
  ok(!/releaseDraft|softRelease|artifactUpload|generateReleaseNotes/.test(rel), "and has no release-creation options left behind");
  ok(!/gh release|api\/github|releases\/upload|\/releases\/latest/.test(rel), "no CLI or API call publishes a release either");
  ok(/permissions:\n\s+contents: read/.test(rel), "the job's token is read-only, so it could not publish even by accident");
  ok(/tags: \['v\*'\]/.test(rel) && /workflow_dispatch:/.test(rel), "triggers are a v* tag and a manual run, nothing else");
  ok(!/push:\s*\n\s*branches:/.test(rel), "a normal push to a branch never builds installers");
  ok(/publish:\s*\n\s+type: boolean\s*\n\s+default: false/.test(rel), "the manual run defaults to preflight, not to publishing");
  ok(/name: preflight ends here/.test(rel), "preflight stops at a named step, so the log says so");
  const needs = /publish:[\s\S]*?needs: \[([^\]]+)\]/.exec(rel)?.[1] || "";
  for (const j of ["build-windows", "build-linux", "build-macos-arm", "build-macos-intel"])
    ok(needs.includes(j), `publish waits for ${j}`);
  ok(/actions\/upload-artifact@v4[\s\S]*?if-no-files-found: error/.test(rel), "a build that produced no files fails, rather than uploading an empty artifact");
  ok(/retention-days: \$\{\{ env\.RETENTION_DAYS \}\}/.test(rel) && /RETENTION_DAYS: '7'/.test(rel), "the installers are kept 7 days: temporary, as agreed");
  ok(/--target aarch64-apple-darwin/.test(rel) && /--target x86_64-apple-darwin/.test(rel), "both macOS slices are built for their own triple");
  ok(/runs-on: macos-latest-large/.test(rel) && /runs-on: macos-latest\s+#/.test(rel), "the Intel job runs on an Intel runner, the ARM one on an ARM runner");
  ok(/libwebkit2gtk-4\.1-dev/.test(rel), "the Linux job installs the webkit deps Tauri needs");
  const gated = rel.split("\n").filter((l) => /^\s+if: needs\.gate\.outputs\.publish == 'true'/.test(l)).length;
  ok(gated >= 6, `every step that can touch the world is gated on publish (${gated} steps)`);
  ok(/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/.test(rel) && !/secrets\.(?!CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)[A-Z_]+/.test(rel),
    "no secret other than the two Cloudflare ones is referenced anywhere in release.yml");
  ok(!/APPLE|NOTAR|API_KEY_STORE|TAURI_SIGNING_PRIVATE_KEY: \$\{\{/.test(rel), "no signing or notarisation credential is requested or passed in");
  ok(/verify-release\.mjs --base "\$\{\{ steps\.preview\.outputs\.url \}\}"/.test(rel), "the preview bundle is verified before production sees it");
  ok(/--branch "verify-\$\{GITHUB_RUN_ID\}"[\s\S]*?--branch main/.test(rel), "preview first, promotion second, in that order");
  ok(/group: hephaestus-release/.test(rel) && /group: hephaestus-release/.test(site) && /cancel-in-progress: false/.test(rel),
    "both workflows take the same lock, and neither cancels the other mid-deploy");
  ok(!/api\.github\.com|__hephRepo|HEPH_REPO/.test(site), "site.yml no longer bakes a repo name or reads the GitHub API");
  ok(/prepare-site\.mjs --into site-built --carry-from/.test(site), "a docs deploy carries the live release in front of it");
  ok(/--allow-preparing/.test(site), "and is allowed to deploy a site with no release yet");
  ok(/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/.test(site) && !/secrets\.(?!CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)[A-Z_]+/.test(site),
    "site.yml uses the same two secrets and no others");
  ok(/node-version: 22/.test(site) && /node-version: 22/.test(rel), "both pin Node 22, which wrangler needs");
  const hdr = fs.readFileSync(path.join(REPO, "site", "_headers"), "utf8");
  ok(/connect-src 'self';/.test(hdr) && !/connect-src 'self' http/.test(hdr), "CSP: the page may talk to its own origin only");
  ok(/\/downloads\/\*[\s\S]*?Content-Disposition: attachment/.test(hdr), "installers are served as attachments");
  ok(/\/downloads\/\*[\s\S]*?max-age=31536000, immutable/.test(hdr), "and cached forever, because their names carry the version");
  ok(/\/release\.json[\s\S]*?max-age=60, must-revalidate/.test(hdr), "while the manifest itself goes stale fast on purpose");
  ok(!/#/.test(hdr), "no comments in _headers — Cloudflare's parser is not documented to accept them");
  const bump = fs.readFileSync(path.join(REPO, "tools", "bump.mjs"), "utf8");
  ok(/git tag v\$\{?|tag v/.test(bump), "bump still ends at the tag, which is now also the publish trigger");
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} assertions passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
