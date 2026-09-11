# qa-tools

The gates. Every file here drives the **real thing** — the app in a browser, the site in a
browser, the real engine modules imported into the page — and asserts numbers, not vibes.
Nothing here mocks the code under test, and no suite passes because a screenshot looked fine:
where a picture matters, the assertion recomputes what the picture should have said.

```bash
npm i && npx playwright install chromium

npm run dev -- --port 5199                       # terminal 1 — the app
python3 -m http.server 8099 --directory site     # terminal 2 — the site
node qa-tools/run-all.mjs                        # terminal 3 — the gate
node qa-tools/ascii-qa.mjs                       # or one suite on its own
```

Paths and ports come from `qa-tools/paths.mjs`, all overridable:
`APP=`, `SERVE=`, `SHOTS=` (screenshots land in `qa-shots/`, gitignored), `PREVIEW=`.

## what each one is for

| suite | what it refuses to let happen |
|---|---|
| `voice-qa` | the dashboard saying the same line every day, the display-name easter eggs misfiring, the two Claude skins being swapped or ignored |
| `akmon-qa` | the colour screen losing its labelled swatch cards, "ask cedalion" opening a window without asking anything |
| `planes-qa` | the surfaces panel printing a number that doesn't match what the engine measured — it recomputes every ΔE and verdict on screen |
| `merkhet-qa` | the reviewer claiming a fix it hasn't verified, or a "fixed" change that actually made the page worse |
| `imgsel-qa` | a block you can see but can't click, drag or resize |
| `imgcovered-qa` | an image inside a grid being swallowed by the card painted over it — including after you send it back |
| `studio-qa` | the site-wide switches being decoration in the editor that the export ignores |
| `sitebtn-qa` | the `⚙ site` shortcut not actually bringing the switches into view |
| `trends-qa` | a library that's numbers rather than buildable directions: paging, search, tags, an example per entry |
| `ascii-qa` | the site drifting from its own rules: the hero block must equal what `tools/ascii-art.py` prints, the art must have no caption and still have an `aria-label`, every line padded so the centring can't skew the face, no `<img>`/`<canvas>`/absolute URL in the shipped markup, all nine anchors resolving, `connect-src` narrowed to the one API the page is allowed to ask, and an unbaked copy that asks GitHub for nothing at all — one request per load, and it is the document |
| `dl-qa` | the download cards, against a stand-in `api.github.com`: the right file out of a release full of decoys (`setup.exe` over the `.msi`, `aarch64.dmg` over the Intel one, AppImage over `.deb`), a label that names the file and its size, and then every way it could lie — no owner baked in, nothing published, **a private repo**, only one OS built, GitHub refused, GitHub answering in HTML, GitHub too slow. In all seven the page must read as a page, must not link anything unconfirmed, and must throw nothing into the console |
| `site-qa` | the marketing page failing contrast, overflowing a phone, sitting flush against the screen edge, growing an image, or reaching off-box for a font — 7 viewports, including `file://` |

`run-all.mjs` prints `N assertions` per suite and exits non-zero on any failure, so it is
safe to hang a CI job on it (the suites that need servers will fail loudly rather than
silently skip if the servers aren't up).

## writing a new one

Copy the shape of `ascii-qa.mjs`: a local `ok(condition, message)` that counts, a message
that quotes the number it checked, and a final `process.exit(fail ? 1 : 0)`. The rule for
this repo: **assert what the user would notice**, not that a function was called. "the
overlay is cleared at rest" is worth having; "draw() was invoked" is not.
