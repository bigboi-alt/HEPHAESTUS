#!/usr/bin/env node
/*
  tools/verify-release.mjs — checks a deployed site the way a visitor's browser would, and fails
  the pipeline if a single promise is broken.

  It is the difference between "the deploy step was green" and "the download works". Cloudflare Pages
  will happily deploy a bundle whose release.json points at a file nobody copied, and the first
  person to find out would be a stranger clicking a button on your site. So the publish job runs
  this twice: once against the throwaway preview deployment, and once against production after the
  promotion. Nothing is promoted until the first pass is clean.

      node tools/verify-release.mjs --base https://<hash>.<project>.pages.dev
      node tools/verify-release.mjs --base https://<project>.pages.dev [--allow-preparing]
                                    [--retry-for 120] [--json]

  What it insists on
    · /release.json answers 200 and parses, with schema 1
    · status "ready" implies every file it lists is really there, same-origin, under /downloads/,
      at the exact byte length the manifest claims
    · no url anywhere in the manifest points at another host — that is the "users download from my
      own hostname" requirement, enforced by a machine instead of by memory
    · sha256 is 64 hex, sizes are plausible
    · the deployed HTML is the page that reads this file (a stale or partial upload fails here)
    · older releases in previous[] still resolve — a warning if not, since losing an old installer
      is regrettable but is not a broken current release

  Two things exist because of a real failure, not as generality:

  · the page and the manifest are fetched with a cache-busting query string. Cloudflare caches /
    (max-age=600) and /release.json (max-age=60) deliberately, so a re-check that keeps asking the
    same URL keeps being handed the same cached answer and never notices the new deployment. The
    /downloads/* files are NOT busted: their names carry the version, they are cached forever, and
    the manifest's url must be verifiable exactly as written.

  · --retry-for <seconds> exists because a deploy is not instantly reachable at the production
    alias. `wrangler pages deploy` returns as soon as the bundle is stored; flipping
    <project>.pages.dev over to it takes a few more seconds, and during that window the alias still
    serves the PREVIOUS deployment. Verified against a live project, that window reads as:
    "/release.json is not JSON: Unexpected token '<'" plus "the page still talks to GitHub" — i.e.
    the exact symptoms of a stale, older site, not of a broken bundle. Retrying distinguishes the two;
    a genuine defect looks the same after 120 s as it did at second 1, and then fails for real.
    Against a deployment's own URL (immutable, already final) leave it off.
*/
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
// args[i+1] on a missing flag would return args[0] — i.e. the *other* flag's value. Guard it.
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const base = (val("--base") || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("usage: node tools/verify-release.mjs --base https://project.pages.dev [--allow-preparing] [--retry-for 120]");
  process.exit(2);
}
const retryFor = Math.max(0, Number(val("--retry-for") || 0) || 0);
const get = async (path, opts = {}) => {
  const r = await fetch(base + path, { redirect: "follow", signal: AbortSignal.timeout(opts.timeout ?? 30000), ...opts });
  return r;
};
// A fresh nonce per attempt, so each retry is a different URL and cannot be served from cache.
const live = (path, attempt, opts = {}) => {
  const sep = path.includes("?") ? "&" : "?";
  return get(`${path}${sep}_heph_check=${Date.now()}-${attempt}`, {
    ...opts,
    headers: { "cache-control": "no-cache", ...(opts.headers || {}) },
  });
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function attempt(n) {
  const problems = [];
  const notes = [];
  const checked = [];
  let staleVersion = false;
  const fail = (m) => problems.push(m);

  let doc;
  const res = await live("/release.json", n, { headers: { accept: "application/json" } });
  const contentType = String(res.headers.get("content-type") || "");
  if (!res.ok) fail(`/release.json answered ${res.status}`);
  else {
    try { doc = await res.json(); }
    catch (e) {
      fail(`/release.json is not JSON: ${e.message}`);
      if (/html/i.test(contentType))
        notes.push(`it answered as ${contentType || "an unknown type"} — that is a page, not our manifest: an older deployment, or a redirect over it`);
    }
  }

  const page = await live("/", n);
  const html = page.ok ? await page.text() : "";
  // "Ours" = the page has this design's shape. Its absence is the one symptom that can be explained
  // by time rather than by a bad bundle, so it is what the retry loop below waits on.
  const pageIsOurs = page.ok && /id="get"/.test(html) && /release\.json/.test(html)
    && !/api\.github\.com|releases\/latest|\/releases\/download\//.test(html);
  if (!page.ok) fail(`/ answered ${page.status}`);
  else {
    if (!/id="get"/.test(html)) fail("the deployed page has no #get section — is this an old build of the site?");
    if (!/release\.json/.test(html)) fail("the deployed page never mentions release.json — it would not read the manifest we just shipped");
    if (/api\.github\.com|releases\/latest|\/releases\/download\//.test(html)) fail("the deployed page still talks to GitHub directly; the download path must be this host only");
  }

  if (doc) {
    const want = val("--expect-version");
    if (want && String(doc.version) !== want) {
      fail(`the manifest on this host is version ${JSON.stringify(doc.version)}, not ${JSON.stringify(want)} — the deploy has not landed here yet`);
      staleVersion = true;
    }
    if (doc.schema !== 1) fail(`release.json schema is ${JSON.stringify(doc.schema)}, expected 1`);
    if (doc.status === "preparing") {
      if (!flag("--allow-preparing")) fail('status is "preparing" and this deploy was supposed to publish a release');
      else notes.push("status: preparing — no release published yet, so the site shows its honest empty state");
    } else if (doc.status !== "ready") fail(`unknown status ${JSON.stringify(doc.status)} — the site only understands "ready" and "preparing"`);

    const all = (doc.files || []).map((f) => ({ f, current: true })).concat(
      (doc.previous || []).flatMap((v) => (v.files || []).map((f) => ({ f, current: false }))));
    if (doc.status === "ready" && !(doc.files || []).length) fail("status is ready but files[] is empty — that is a release with no downloads");

    for (const { f, current } of all) {
      const url = String(f.url || "");
      const who = `${f.id || f.file || "?"}`;
      if (!url.startsWith("/downloads/")) { fail(`${who}: url is "${url}", which is not a path under /downloads/ on this host`); continue; }
      if (/^https?:\/\//i.test(url)) fail(`${who}: url is absolute (${url}) — downloads must come from this hostname`);
      if (!/^[a-f0-9]{64}$/.test(String(f.sha256 || ""))) fail(`${who}: sha256 is missing or not 64 hex`);
      if (!(Number(f.size) > 0)) fail(`${who}: size ${f.size} is not a positive byte count`);
      if (!/^[A-Za-z0-9._+-]+$/.test(String(f.file || ""))) fail(`${who}: file name "${f.file}" is not a plain file name`);
      let r;
      // Not cache-busted, on purpose: this is the exact URL a visitor gets, immutable and version-named.
      try { r = await get(url, { method: "HEAD", timeout: 60000 }); } catch (e) { fail(`${who}: ${url} could not be fetched (${e.message})`); continue; }
      if (!r.ok) { (current ? fail : (m) => notes.push(`note  ${m}`))(`${who}: ${url} answered ${r.status}`); continue; }
      const len = Number(r.headers.get("content-length") || -1);
      if (len !== -1 && len !== Number(f.size)) { fail(`${who}: ${url} is ${len} bytes but the manifest says ${f.size}`); continue; }
      const disp = String(r.headers.get("content-disposition") || "");
      if (!/attachment/i.test(disp)) notes.push(`note  ${who}: no Content-Disposition: attachment on ${url} (a browser may try to open it inline)`);
      checked.push({ who, url, bytes: len });
    }
    for (const f of doc.files || []) {
      if (/\bgithub\b/i.test(JSON.stringify(f))) fail(`${f.id}: the manifest carries a GitHub URL for a download — the site must not send visitors there`);
    }
  }

  // stale = "this host is not serving our bundle yet", which time can fix. Anything else is a defect
  // in what we built, and retrying it only delays the pipeline that is already right to fail.
  return { doc, problems, notes, checked, pageIsOurs, stale: !pageIsOurs || staleVersion };
}

// One pass, or as many as fit in the budget. A pass that fails is only worth repeating while the
// host could still be mid-swap; once we can prove the page is ours, the remaining problems are real.
const started = Date.now();
let out = await attempt(1);
let tries = 1;
// each retry costs a pass plus 8 s, so ask whether another one FITS, not just whether time is left
while (out.problems.length && out.stale && Date.now() - started + 8000 <= retryFor * 1000) {
  console.log(`  wait  ${out.problems.length} problem(s) and this host is not serving our bundle yet; retrying in 8s (budget ${retryFor}s)`);
  await sleep(8000);
  tries++;
  out = await attempt(tries);
}
const { doc, problems, notes, checked } = out;

if (flag("--json"))
  console.log(JSON.stringify({ base, ok: !problems.length, attempts: tries, problems, notes, checked }, null, 2));
else {
  for (const c of checked) console.log(`  ok    ${c.who.padEnd(20)} ${(c.bytes / 1048576).toFixed(1).padStart(7)} MB  ${c.url}`);
  for (const n of notes) console.log(`  ${n.startsWith("note") ? "" : "  note  "}${n}`);
  for (const p of problems) console.log(`  FAIL  ${p}`);
}
if (problems.length) {
  if (process.env.GITHUB_ACTIONS) for (const p of problems) console.log(`::error::${p}`);
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"} at ${base}${tries > 1 ? ` (after ${tries} attempts over ${Math.round((Date.now() - started) / 1000)}s)` : ""}`);
  if (out.stale)
    console.error("  the host is not serving this bundle yet. A deploy returns as soon as the bundle is\n"
      + "  stored, and a project alias (https://<project>.pages.dev) can keep serving the previous\n"
      + "  deployment for a few seconds after that — which reads exactly like a broken site. Check the\n"
      + "  deployment's own https://<hash>.<project>.pages.dev URL to see the bytes you uploaded, and\n"
      + "  give the alias a window with --retry-for <seconds> if this is the production check.");
  process.exit(1);
}
console.log(`${base}: release ${doc?.version ?? "(preparing)"}, ${checked.length} file${checked.length === 1 ? "" : "s"} verified${notes.length ? `, ${notes.length} note${notes.length === 1 ? "" : "s"}` : ""}`);
