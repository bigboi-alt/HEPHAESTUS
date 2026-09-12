# qa-tools

The gates. Every file here drives the **real thing** — the app in a browser, the site in a
browser, the real engine modules imported into the page — and asserts numbers, not vibes.
Nothing here mocks the code under test, and no suite passes because a screenshot looked fine:
where a picture matters, the assertion recomputes what the picture should have said.

```bash
npm i && npx playwright install chromium

npm run dev -- --port 5199                       # terminal 1 — the app (7 suites drive it)
node qa-tools/run-all.mjs                        # terminal 2 — the gate
node qa-tools/manifest-qa.mjs                    # or one suite on its own
```

Paths and ports come from `qa-tools/paths.mjs`, all overridable: `APP=`, `SERVE=`, `SHOTS=`
(screenshots land in `qa-shots/`, gitignored), `PREVIEW=`.

The four *site* suites no longer need a server of their own: `qa-tools/fixture-site.mjs` copies
`site/` into a temp folder, lays a chosen `release.json` and the matching `downloads/` files beside
it, and serves that on a port it picks. Every suite therefore measures a bundle as real as the one CI
deploys — and none of them can pass by looking at an empty page.

## what each one is for

| suite | what it refuses to let happen |
|---|---|
| `voice-qa` | the dashboard saying the same line every day, the display-name easter eggs misfiring, the two Claude skins being swapped or ignored |
| `akmon-qa` | the colour screen losing its two labelled swatch grids — eight cards, each lockable, copyable, editable by picker, annotated with its OKLab `L`/`C` and (for the seven that can be) its measured contrast and WCAG grade; a lock that doesn't survive a shake; a CVD simulation that repaints the wrong thing or won't repaint back; and the rejected "planes" experiment staying gone |
| `merkhet-qa` | the reviewer claiming a fix it hasn't verified, or a "fixed" change that actually made the page worse |
| `imgsel-qa` | a block you can see but can't click, drag or resize |
| `imgcovered-qa` | an image inside a grid being swallowed by the card painted over it — including after you send it back |
| `studio-qa` | the site-wide switches being decoration in the editor that the export ignores |
| `sitebtn-qa` | the `⚙ site` shortcut not actually bringing the switches into view |
| `trends-qa` | a library that's numbers rather than buildable directions: paging, search, tags, an example per entry |
| `ascii-qa` | the site drifting from its own rules: the hero block must equal what `tools/ascii-art.py` prints, the art must have no caption and still have an `aria-label`, every line padded so the centring can't skew the face, no `<img>`/`<canvas>`-class asset, no absolute `href`/`src` and no webfont, no `_headers` comment the parser might choke on, `connect-src` pinned to `'self'` alone, **zero** off-site requests with a release published, `site/release.json` a valid schema-1 document that says `preparing`, and every figure in `#details` recomputed from this repository so the page cannot invent a statistic |
| `dl-qa` | a button that promises a file it hasn't seen. Eight states of the same bundle — complete, `preparing`, one platform missing, a listed file that vanished, a manifest pointing at `github.com`, half-written JSON, `ready` with no files, and no JavaScript at all — each checked on the cards (`↓ <filename>`, size, short hash, the visitor's own platform marked, the macOS advisory where it belongs), in the extras row, in the history list, in the checksum table and in the status band; plus `tools/verify-release.mjs` run against every bundle, because a missing file and a lying byte count are invisible to a browser and are exactly what must not go live |
| `manifest-qa` | the pipeline itself: that a missing required platform, an empty upload, a truncated bundle, a stale version in a file name, or a half-built matrix each stop a release; that `--check-only` writes *nothing*; that carried-forward history keeps old links alive and a vanished old file is a note rather than a blocked deploy; and that `release.yml` still has no `tauri-action`, no write token, no secret beyond the two Cloudflare ones, and no deploy step that isn't gated on an explicit publish |
| `site-qa` | the marketing page failing contrast, overflowing a phone, sitting flush against the screen edge, growing an image, or reaching off-box for a font — 9 viewports including `file://`, measured **both** with a release on the page and in the empty state, because the time a long `Hephaestus_0.3.0_amd64.AppImage` chip pushed a 360 px screen 26 px sideways, the gate had only ever looked at the empty one |

`fixture-site.mjs` is the shared bundle builder: `startSite("ready" | "preparing" | "partial" |
"broken" | "offsite" | "malformed" | "empty")` returns `{ origin, url, doc, reqs, close }` over a temp
directory whose `release.json` and `downloads/` files agree with each other byte for byte (the two
fixtures where they deliberately *don't* agree exist to check the verifier). Nothing is hand-written
and nothing is mocked: the files have real lengths and real sha256 sums, and the request log is what
proves the page never left its own origin. There used to be a `gh-stub.mjs` here that faked
`api.github.com`; the page has no reason to talk to GitHub any more, so the stub went with it.

Two suites (`manifest-qa`, `dl-qa`) also spawn the *tools under test* as child processes against that
server. Spawning must be async there: the fixture answers from the parent's event loop, and a
`spawnSync` parent freezes it — the child then reports a failure that doesn't exist. It bit both
suites once each, which is why the calls are wrapped in a comment saying so.

`run-all.mjs` prints `N assertions` per suite and exits non-zero on any failure, so it is
safe to hang a CI job on it (the suites that need servers will fail loudly rather than
silently skip if the servers aren't up).

## writing a new one

Copy the shape of `ascii-qa.mjs`: a local `ok(condition, message)` that counts, a message
that quotes the number it checked, and a final `process.exit(fail ? 1 : 0)`. The rule for
this repo: **assert what the user would notice**, not that a function was called. "the
overlay is cleared at rest" is worth having; "draw() was invoked" is not.
