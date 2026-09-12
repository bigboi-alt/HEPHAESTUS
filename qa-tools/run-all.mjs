#!/usr/bin/env node
/*
  The whole gate in one command.

    npm run dev -- --port 5199        # terminal 1 — the app
    # the site suites serve their own bundles (qa-tools/fixture-site.mjs) — no second server
    cd qa-tools && npm i && npx playwright install chromium
    node run-all.mjs                  # terminal 3 — everything

  Each suite exits non-zero when it fails, so this is what CI would run.
  Pass names to run a few:  node run-all.mjs ascii-qa site-qa
*/
import { spawn } from "node:child_process";

const ALL = ["voice-qa", "akmon-qa", "merkhet-qa", "imgsel-qa", "imgcovered-qa",
             "studio-qa", "trends-qa", "identity-qa", "manifest-qa", "sitebtn-qa", "ascii-qa", "dl-qa", "site-qa"];
const pick = process.argv.slice(2);
const list = pick.length ? ALL.filter((n) => pick.includes(n)) : ALL;

async function up(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).status < 500; } catch { return false; }
}
const appUp = await up(process.env.APP || "http://127.0.0.1:5199/");
if (!appUp) console.log("!! the app dev server isn't answering on :5199 — 8 of these suites drive it");

const run = (name) => new Promise((res) => {
  const p = spawn(process.execPath, [`${name}.mjs`], { cwd: new URL(".", import.meta.url).pathname, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  p.on("exit", (code) => {
    let tally = out.match(/(\d+) passed, (\d+) failed/);
    if (!tally && name === "site-qa") {
      // one line per viewport: contrast ok | reveal:n/n | overflow:no | aspect:true | …
      const lines = out.split("\n").filter((l) => /contrast|reveal/.test(l));
      const bad = lines.filter((l) => !/contrast ok/.test(l) || /overflow:YES|STRETCHED|broken:[1-9]|media:[1-9]|edge:LOW|ext:[1-9]|ERRORS/.test(l));
      tally = [null, String(lines.length), String(bad.length)];
      if (bad.length) out = bad.join("\n") + "\n" + out;
    }
    const fails = tally ? +tally[2] : code ? 1 : 0;
    const checks = tally ? +tally[1] + fails : (out.match(/✓/g) || []).length;
    console.log(`${fails === 0 && code === 0 ? "  ok  " : " FAIL "} ${name.padEnd(15)} ${checks} ${name === "site-qa" ? "viewports clean" : "assertions"}${fails ? ` · ${fails} failing` : ""}`);
    if (fails || code) {
      const bad = out.split("\n").filter((l) => /✗|ERROR|Error:|error while/.test(l)).slice(0, 6);
      bad.forEach((l) => console.log("         " + l.trim().slice(0, 150)));
    }
    res(fails || code ? 1 : 0);
  });
});

let bad = 0;
for (const n of list) { const r = await run(n); if (r) bad++; }
console.log(`\n${list.length - bad}/${list.length} suites green`);
process.exit(bad ? 1 : 0);
