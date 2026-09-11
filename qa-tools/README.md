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
node qa-tools/pixel-qa.mjs                       # or one suite on its own
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
| `pixel-qa` | the scroll decoration hiding content — measures painted coverage at four scroll stops, twice, plus reduced-motion, no-JS and a 404'd asset |
| `ghlinks-qa` | **a link on the site being able to 404** — five states against a mocked GitHub API, including "no repo yet" and "no network" |
| `site-qa` | the marketing page failing contrast, overflowing a phone, stretching a screenshot, or reaching off-box for a font — 7 viewports, including `file://` |

`run-all.mjs` prints `N assertions` per suite and exits non-zero on any failure, so it is
safe to hang a CI job on it (the suites that need servers will fail loudly rather than
silently skip if the servers aren't up).

## writing a new one

Copy the shape of `pixel-qa.mjs`: a local `ok(condition, message)` that counts, a message
that quotes the number it checked, and a final `process.exit(fail ? 1 : 0)`. The rule for
this repo: **assert what the user would notice**, not that a function was called. "the
overlay is cleared at rest" is worth having; "draw() was invoked" is not.
