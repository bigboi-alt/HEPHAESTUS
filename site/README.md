# the site

One page. No build step, no framework, no dependencies — Cloudflare Pages serves this
folder exactly as it is, and redeploys it whenever you push.

```
site/
  index.html     the whole site: markup, CSS and 15 lines of JS in one file
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

## the download cards fill themselves, and never lie

The three cards in `#get` are anchors. The page asks GitHub for the newest **published**
release of one repo and, if a file in it matches the visitor's system, links that file — so
clicking a card starts a download with nobody touching this folder:

```
api.github.com/repos/<owner>/<repo>/releases/latest   the files
api.github.com/repos/<owner>/<repo>                   whether the repo is readable at all
```

The only thing the page knows about the repo is `var HEPH_REPO` at the top of the file, which
ships as `window.__hephRepo || ""` and is rewritten to `"owner/repo"` by the deploy step in
`.github/workflows/site.yml`. That is the whole wiring. There is no config file to edit, no
owner name in the markup to keep in sync, and nothing to remember when a release goes out —
publish the release, and the cards change. The two requests fire once per load, 6 s timeout.

Why the second request is not padding: **a 404 from GitHub means two opposite things.** Nothing
published yet, or the repo is private. If the page guessed wrong it would hand a visitor a link
to a 404, and a dead link is the one failure this page is built to make impossible. So:

| what GitHub says | what a card does |
|---|---|
| release with a matching asset | links it: `↓ Hephaestus_0.3.0_aarch64.dmg · 14.9 MB` |
| release without one for this OS | links `<repo>/releases`, label says which system is missing |
| 404 release, repo readable | links `<repo>/releases`, status says nothing is published yet |
| 404 both — **the repo is private** | stays `#get`, status says so. GitHub will not give release files to strangers on a private repo, and no amount of config makes it |
| unreachable, 500, or a body that isn't JSON | stays `#get`, status says it couldn't read the answer |
| no JavaScript at all | stays `#get` exactly as the markup reads |

Two consequences worth knowing before you call it a bug. **Anonymous visitors cannot download
release assets from a private repo** — that is GitHub's rule, so with the repo private the cards
sit in their inert state and light up by themselves the moment the repo (or the builds, somewhere
public) is published. And the shipped page is not a wall of links: no `<img>`, no `<canvas>`, no
web fonts, no analytics, no cookies, and no GitHub URL in the markup — the reader builds its URL
at run time from the baked string, so `qa-tools/ascii-qa.mjs` can assert that an *unbaked* copy
asks GitHub for nothing at all, and `site/_headers` narrows `connect-src` to `'self'
https://api.github.com` so no other outside call is possible from this page even by accident.

Asset choice, if you ever need to widen it, is the `PAIR` table in the reader script: windows
wants `.exe/.msi` and prefers `setup`, macOS wants `.dmg` and prefers `aarch64`, Linux wants
`.AppImage` and takes `.deb` only if there is nothing else. `qa-tools/dl-qa.mjs` drives those
six rows against a stand-in GitHub, decoy assets included.

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

One catch, and it is only about the cards: a Pages build with an **empty** build command copies
`site` out as-is, so nothing rewrites `HEPH_REPO` and the page keeps its fallback wording ("this
copy wasn't built by the deploy step"). The page is complete and correct — the cards just don't
know which repo to ask. Route B below is what bakes the repo in, and it costs two secrets.

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
loads `https://hephaestus-app.pages.dev` and greps for our `<title>` before saying the
deploy worked. Override the name with an Actions variable `PAGES_PROJECT`.

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

- **One outside call, and only one.** The release reader talks to `api.github.com` and nothing
  else; `connect-src 'self' https://api.github.com` says so in the headers as well as
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
