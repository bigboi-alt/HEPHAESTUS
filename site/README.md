# the site

One page. No build step, no framework, no dependencies — Cloudflare Pages serves this
folder exactly as it is, and redeploys it whenever you push.

```
site/
  index.html     the whole site: markup, CSS and two small scripts in one file
  release.json   what is published — committed as a "preparing" placeholder, generated on deploy
  downloads/     the installers, written into the *deployed* bundle by the publish job (not in git)
  _headers       security + cache headers (Cloudflare Pages reads this file)
  _redirects     old /dl and /download links → the download section
  robots.txt
  assets/
    logo-ink-512.png · logo-ink-128.png   the mark, on transparency
    favicon.png · favicon.svg · logo-touch.png
    og.png        the share card, built from the same character block
```

One thing here is generated rather than placed by hand, and its generator is in the repo so
nobody has to guess how it was made:

| what | how |
|---|---|
| the portrait in the hero | `python3 tools/ascii-art.py --write` — the mark measured on a 72-cell grid, one character per cell (Pillow; `qa-tools/ascii-qa.mjs` fails the gate if the page and the generator ever disagree) |

## how the downloads work, and why nothing can lie

`#get` is five platform cards (Windows, Apple Silicon, Intel, AppImage, .deb), an extras row for
whatever else the release carries, a checksum table, and a list of earlier releases. They all read
one file, from the same origin, once:

```js
fetch("release.json", { cache: "no-store" })     // relative: any host, any port, no CORS, no token
```

`release.json` is **generated**, by `tools/release-manifest.mjs`, from installers that really exist —
it lists each one with its path under `/downloads/`, its byte size and its sha256, and it refuses to
be written at all unless every required platform is present, non-empty, and named for the version the
three config files agree on. The page never has to be edited when a release ships, which is the
whole point: there is no per-release hand-edit left to forget, and nothing on the page can go stale
relative to the files.

What the page does with what it reads, in words it shows you:

| the file says | a card says | its `href` |
|---|---|---|
| `status: "ready"` and my platform is listed | `↓ Hephaestus_0.4.0_x64-setup.exe` + size + `sha256 65faded6…` | that file, on this host |
| `status: "ready"`, my platform absent | `not in this release` | `#get` (stays in the page) |
| `status: "preparing"` | `not published yet` | `#get` |
| missing, 404, half-written JSON | the status band above the cards says it could not be read | `#get` |

Four rules hold that shape in place, each one checked in `qa-tools/`:

- **only `/downloads/<name>` is ever adopted.** A manifest entry whose url is absolute, off-host, or
  not a plain file name is ignored and the card stays inert. `dl-qa` drives a bundle whose manifest
  points at `github.com` precisely to prove the card refuses to follow it.
- **no link leaves the origin.** `ascii-qa` fails if the shipped markup contains a single absolute
  `href`/`src`, if the word "github" appears anywhere in the file, or if `_headers` grants
  `connect-src` anything beyond `'self'`.
- **the browser can't be the only check.** Two failure modes are invisible to the page — a file the
  manifest lists but the bundle lost, and a manifest whose size is wrong. `tools/verify-release.mjs`
  fetches every listed url and compares the byte length, and CI runs it twice on a release: against
  the throwaway preview deployment, then against production. A docs deploy runs it against the
  immutable URL wrangler printed and then against the alias, waiting for the alias to be serving those
  same bytes — a deploy is stored before it is pointed at, and reading the alias in between reports the
  *previous* site as broken. Same symptoms either way, which is why the order matters. That is also why
  a release is *deployed*, not merely *announced*.
- **history is carried, not deleted.** The publish job copies the live `downloads/` and
  `release.json` into the new bundle first, so the previous five versions keep resolving. An old blog
  link to `v0.3.0` still works after three more releases.

`#details` prints figures about the app — engine files and lines, the catalogue counts, the version.
Those are not decoration: `ascii-qa` recomputes each one from this repository and fails if the page
and the repo disagree, so the numbers cannot drift into marketing.

### `release.json`, field by field

```json
{
  "schema": 1,                       // the page refuses anything else, rather than guessing
  "status": "ready",                 // or "preparing": the state a fresh deploy is really in
  "product": "Hephaestus",
  "version": "0.4.0",
  "publishedAt": "2026-09-11",
  "channel": "stable",
  "signing": { "windows": "unsigned", "macos": "unsigned, not notarised", "linux": "unsigned" },
  "files": [{
    "id": "windows-x64",             // the card this fills in; the five ids are fixed by the tool
    "os": "windows", "arch": "x64", "kind": "installer", "required": true,
    "label": "Windows installer", "hint": "Windows 10 and 11, 64-bit",
    "file": "Hephaestus_0.4.0_x64-setup.exe",
    "url": "/downloads/Hephaestus_0.4.0_x64-setup.exe",
    "size": 15413248, "sha256": "…64 hex…",
    "advisory": null                 // set on the macOS entries: the right-click → Open warning
  }],
  "previous": [{ "version": "0.3.0", "publishedAt": "2026-08-21", "files": [ … ] }]
}
```

`signing` is there so the page can be honest without a human remembering to be: it is copied from the
slot table, which says what the build actually does (nothing is signed or notarised, because no
certificate exists in this project). Regenerate the whole file by hand with
`node tools/release-manifest.mjs --scan <dir-of-installers> --version 0.4.0` and read
`--print-required` / `--check-only` for what the gate demands.

### headers that make the downloads behave

| path | header | why |
|---|---|---|
| `/downloads/*` | `Cache-Control: public, max-age=31536000, immutable` | the file name carries the version, so a cached installer can never be a different installer |
| `/downloads/*` | `Content-Disposition: attachment` | a browser must not try to render an `.exe` inline; `verify-release` warns if the header is missing |
| `/downloads/*`, `/release.json` | `X-Robots-Tag: noindex` | a raw file should be reached from the page that explains it |
| `/release.json` | `max-age=60, must-revalidate` | the one file that must go stale fast: it is how a release appears, and how a bad one can be fixed within the hour |
| `/*` | `Content-Security-Policy: … connect-src 'self'` | the page has exactly one thing to fetch and cannot be given more by accident |

Those two cache windows are real, and they are read as well as written: every CI probe of `/` and
`/release.json` carries a throwaway query string (`?_heph_check=…`) so that a retry actually re-reads
the origin instead of asking Cloudflare for the same cached object a second time, and so a docs deploy
seconds after a release publish carries the release that is live rather than the one before it.
`/downloads/*` is deliberately *not* busted — the url in `release.json` has to be the url a visitor
gets, byte for byte. `manifest-qa` asserts both halves of that split against a real server.

`_headers` carries no comments and no `_headers`-style conditionals: Cloudflare's parser isn't
documented to accept `#` there, and a silently-ignored file would drop the CSP. This folder's notes
are the place for prose (`README.md` is deleted from the deployable bundle by `tools/prepare-site.mjs`).

## deploying on Cloudflare

Pick one of these, not both.

**A. Git integration (recommended — nothing to maintain)**

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings — the part people get wrong:
   - Framework preset: **None**
   - Build command: **empty**
   - Build output directory: **`site`**
4. Save and Deploy → **https://hephaestus-app.pages.dev** in about a minute. Name the
   project `hephaestus-app` — that project name *is* the subdomain, and it matches what
   `site.yml` deploys to, so both routes land on the same URL. Cloudflare cannot rename
   a `*.pages.dev` subdomain afterwards, so pick it once, properly.

Every later push that touches `site/**` redeploys automatically, and pull requests get
their own preview URL.

One catch, and it decides whether you can ship installers at all: a Git-integrated Pages build copies
`site/` out as-is, and `downloads/` is not in git. So route A serves the page with the repo's
`preparing` manifest — every card honestly reading *not published yet* — forever. Use route A to look
at the site; use route B to release, because the publish job is what puts files next to the page and
rewrites `release.json` to match them. (`site.yml` carries the live bundle forward so a docs push
through it can't demote a release; a docs push through *route A* would.)

**B. The workflow already in the repo** — `.github/workflows/site.yml` does the same via
`wrangler`. It skips itself quietly until both secrets exist, so it can't fail a build:

| secret | where |
|---|---|
| `CLOUDFLARE_API_TOKEN` | dash.cloudflare.com → My Profile → API Tokens → Create (Custom: Account → Cloudflare Pages → Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | dash.cloudflare.com home → right column, the long hex id |

Then run the `site` workflow once by hand. It checks the Pages API for ownership of
`hephaestus-app`, creates it with `main` as the production branch if it is free (a missing
project can't be handled by `pages deploy` alone — that path prompts interactively, and CI
has no keyboard), refuses to continue if the name belongs to somebody else, and finally
loads `https://hephaestus-app.pages.dev`, greps for our `<title>`, and reads `/release.json` back
through `tools/verify-release.mjs` before saying the deploy worked. Override the name with an Actions
variable `PAGES_PROJECT`.

**Custom domain:** Pages project → Custom domains → Set up a domain. Certificate is handled.
If you use a domain, consider making `og:image` absolute (it's relative today, which most
crawlers accept and a couple don't).

## the look, and why

The palette comes off the mark itself: coffee and cream. Paper `#f5efe7`, cards `#fcf9f4`,
ink `#2c1e15`, one brown `#6f4429` for anything clickable, and `#75604f` for the small print —
that last one is 5.2:1 on paper, chosen rather than inherited, because "muted" is where
contrast goes to die. No pure black, no pure white, no gradient doing homework.

Type is serif (`ui-serif`, falls back to Georgia) for headings, system sans for prose, and mono
for anything that is a measurement: counts, sizes, file names. No web fonts, because a page that
needs a CDN to look right looks broken when the CDN doesn't answer.

The shape is cosy, not engineered: 14px radii, 1px warm borders, two-layer soft shadows, dotted
leaders between a section title and its marker, and one paper tone throughout — there is no
dark panel on this page any more, and the portrait sits directly on it with nothing behind it.

**The portrait is text.** `tools/ascii-art.py` measures the mark on a grid, then gives each
cell one character out of ten (` .,:-=+*%#@`), darkest to densest. The page holds the result as
literal characters: about 3 KB, no file, no filter, and it looks the same in `curl` as in a
browser. Three consequences worth knowing before you edit it:

- it sizes itself to the column with a container query — `font-size: min(13.5px, calc(100cqi / 44))`,
  where 44 is 72 cells × a 0.6em monospace advance — so it fills half the hero at every width
  and physically cannot overflow it; a `clamp()` line precedes it for a browser without `cqi`;
- every line is **padded to the full grid width** before it is written. Rstripping trailing
  spaces, which is the obvious tidy-up, shifts each row right by half its missing tail and skews
  the face, because the block is centred;
- the bottom fades out on a rule (`fade=0.26`: Bayer threshold plus a cheap hash), because a
  bust's plinth is a slab of tone that says nothing at all in characters.

## house rules

- **No outside call at all.** The page fetches one file, `release.json`, from its own origin;
  `connect-src 'self'` says so in the headers as well as
  in the markup, and `site-qa` counts the requests a load actually makes (one: the document).
- **No build step.** If it needs a compiler, it doesn't belong here.
- **Text stays visible without JavaScript.** The soft entrance is added only once JS has
  confirmed it runs, so a blocked script gives you the whole page, not a blank one. Checked both
  with `javaScriptEnabled: false` and with reduced motion on.
- **Small text clears WCAG AA** (≥4.5:1 against the surface it actually sits on) at seven
  viewports, measured from computed colour against effective background.
- **Nothing sits flush against the screen.** `.wrap` owns the side padding, so a component that
  shares that class must never declare `padding: <y> 0` — the shorthand erases the sides and the
  text touches the glass. That is exactly how the footer used to break, and `site-qa` now measures
  the content's inset at every width instead of trusting the CSS.
- **No dead links.** Every card starts life as `#get`, an id in this same document, and is only
  ever repointed at something GitHub confirmed.
- **Decoration never hides content.** The art is a `role="img"` with a sentence of label, and it
  is the only element exempted from the 9px floor — its font size is a pixel size, not a line of copy.

## previewing

```bash
cd site && python3 -m http.server 8099      # normal, with the headers in play
node tools/site-preview.mjs                  # site-preview.html — one file, offline
```

The single-file copy exists for sandboxes that block network access; since the page has no
images left to inline, it is now barely bigger than `index.html`. It's a viewing artifact —
**deploy `site/`, never `site-preview.html`**.

## regenerating the portrait

```bash
python3 tools/ascii-art.py                          # print the block
python3 tools/ascii-art.py --write                  # splice it into site/index.html
python3 tools/ascii-art.py --og                     # the share card, same block on paper
python3 tools/ascii-art.py --preview /tmp/a.png     # paint it, to look at the result
python3 tools/ascii-art.py --cols 96 --gamma 1.3 --unsharp 0 --pad 0.01   # try a different grid
```

The defaults are the shipped picture, and `ascii-qa` regenerates them and diffs the result
against the page — so tuning the numbers means committing new art in the same change, never a
page that quietly no longer matches its generator.

The page carries no screenshots on purpose. What the app looks like is in the app; this page
describes it, and where it quotes a number (1,750 directions, 42 rows, the three forged
palettes under `§ 02`) the number came out of the engine, not out of a designer's file.
