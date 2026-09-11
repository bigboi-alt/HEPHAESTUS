# the site

One page. No build step, no framework, no dependencies — Cloudflare Pages serves this
folder exactly as it is, and redeploys it whenever you push.

```
site/
  index.html     the whole site
  config.js      ← the only file you edit to connect it (owner, repo, contact)
  _headers       security + cache headers (Cloudflare Pages reads this file)
  _redirects     old /dl and /download links → the download section
  robots.txt
  assets/
    logo-ink-512.png · logo-ink-128.png   the mark, on transparency
    favicon.png · favicon.svg · logo-touch.png
    pixel/bust.png · bust-plate.png · bust-cream.png · og.png
                                          the hero art, quantised from the mark
    shots/*.webp                          real screenshots of the running app
```

Two things on this page are generated rather than placed by hand, and both generators are
in the repo so nobody has to guess how they were made:

| what | how |
|---|---|
| the pixel bust in the hero | `python3 tools/pixel-art.py` — grid, seven-tone ramp, 4×4 Bayer dither (needs Pillow) |
| every screenshot | `node tools/shots.mjs` — drives the running app, shoots at 1600 × 1000 from 2× |

## connecting it (about 30 seconds of work)

```bash
node tools/connect.mjs <your-github-username>        # repo defaults to "hephaestus"
```

That writes `site/config.js`, bakes your repo URL into the links that need one even with
JavaScript off, and rebuilds the offline preview. Commit `site/` and you're done. (Editing
`config.js` by hand does the same thing — the tool just saves you from missing a spot.)

Two more flags:

```bash
node tools/connect.mjs <owner> --check   # ask GitHub what the page will see: repo visible?
                                         # release tag? which assets matched each button?
node tools/connect.mjs --clear           # back to the unconnected state
```

The download section reads:

```
https://api.github.com/repos/<owner>/<repo>/releases/latest
```

…on every page load, then matches your release assets by filename — `*-setup.exe`,
`*.msi`, `*aarch64*.dmg`, `*x64*.dmg`, `*.AppImage`, `*.deb` — and writes the real file
sizes into the buttons. **So publishing a GitHub release updates the site by itself:**
no redeploy, no edit. This was verified against a live repo (buttons filled from
`neovim/neovim`'s release: `.msi 12.2 MB`, `.AppImage 10.8 MB`) and against Tauri's own
output names, which is what `release.yml` uploads.

### the one rule about links: they can't 404

This used to be a bug people hit: the buttons were hard-wired to
`github.com/your-github-username/hephaestus/releases/latest`, which is a 404 for anyone who
deployed the site before creating the repo. Now:

- the markup contains **no GitHub URL at all** — every download link starts as `#source`
  on this page, and the page has a "the code" section for it to land on;
- at runtime the page asks `GET /repos/<owner>/<repo>` first. **Only after that answers**
  does it write GitHub URLs into the links, and it prefers `<repo>/releases` over
  `/releases/latest`, because the first is a page that exists even with no releases;
- four states, all honest, all checked in `qa-tools/ghlinks-qa.mjs`:

  | state | what the buttons do |
  |---|---|
  | `owner` is the placeholder | stay on the page; the note shows the one command to connect |
  | repo public, release with installers | each card links its own asset and prints its real size |
  | repo public, no release yet | open `<repo>/releases`, and say so |
  | repo private / renamed / unreachable | stay on the page — never a link to a 404 |

  A network failure is reported as *"can't reach GitHub from here"* and the links are left
  exactly as they were written, because a missing wifi is not evidence that your repo is gone.

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

The palette comes off the mark itself. The bust is a warm carved-stone ramp, so the page
is coffee-and-cream: paper `#f4eee6`, ink `#2c1e15`, one brown accent `#6f4429` for
anything clickable. No pure black, no pure white, no gradients doing homework.

The mark ships **on transparency** in two inks — light marble for dark surfaces, brown for
light ones — because the same emblem has to survive the app's dark themes and this page's
cream. The app picks between them in CSS from `[data-theme]`; the desktop icon is the only
place with a tile behind it, and that tile is coffee brown, not black.

Type is serif (`ui-serif`, falls back to Georgia) for headlines and system sans for
everything else — no web fonts, because a site that needs a CDN to look right is a site
that looks broken when the CDN doesn't answer. Mono is for the labels, sizes and file names,
the parts that are measurements.

The shape of it is retro-modern rather than soft: 1 px borders, square corners with one
corner clipped (`clip-path`, no rounded-everything), hard offset shadows instead of blurs,
and everything sitting on a block grid — the same unit the pixel art uses, so the type and
the pictures agree. `inset` shadows give the icon tiles their chiselled edge.

**The pictures assemble out of pixels.** Each one carries a `<canvas>` overlay laid on top
of the `<img>`; the progress is how much of the picture is in the window, so scrolling away
dissolves it and scrolling back re-assembles it — in both directions, forever, not a
one-shot entrance. Blocks arrive from whichever edge is currently visible, which is why a
picture mid-scroll is never an empty box. It's decoration in the strict sense: at rest the
canvas is cleared and hidden and you see the real PNG/webp; with `prefers-reduced-motion`
the canvases are never created; with JavaScript off they don't exist; and the footer has a
`◆ pixel on` switch that writes `hephaestus.px` to localStorage for anyone who just
doesn't want it.

## house rules

- **No third-party requests.** No fonts, analytics, CDNs or cookies. The one network call
  on the page is the GitHub release fetch. Verified in QA: zero external asset references.
- **No build step.** If it needs a compiler, it doesn't belong here.
- **Text stays visible without JavaScript.** The scroll fade is layered on only once JS
  has confirmed it runs, and download links have real fallback `href`s — so a blocked
  script produces a plain page, never a blank one.
- **Small text clears WCAG AA** (≥4.5:1 on every surface it sits on) — checked by
  `qa-tools/site-qa.mjs`, which measures computed colour against effective background.
- **Real screenshots only**, captured from the running app.
- **A link must not be able to 404.** Same-page anchors in the markup, GitHub URLs only
  after the API has confirmed the repo, and a "the code" section for every fallback to
  land on. `qa-tools/ghlinks-qa.mjs` walks all four states against a mocked API.
- **Decoration never hides content.** The fades and the pixel assembly are additive: at
  rest the overlay is cleared, and no-JS / reduced-motion / a 404'd asset each leave the
  picture exactly as the markup says. Checked in `qa-tools/pixel-qa.mjs`.

## previewing

```bash
cd site && python3 -m http.server 8099      # normal, with network
node tools/site-preview.mjs                  # site-preview.html — one file, offline
```

The single-file copy inlines every asset as a data URI for sandboxes that block network
access. It's a viewing artifact — **deploy `site/`, never `site-preview.html`**, or you'll
ship one uncachable 550 KB page.

## refreshing the pictures

```bash
npm run dev -- --port 5199        # the app, in another terminal
node tools/shots.mjs              # all eight screens → site/assets/shots/*.webp
node tools/shots.mjs canvas review    # or just the ones you changed

python3 tools/pixel-art.py        # the hero art, the plate, the og card (needs Pillow)
python3 tools/pixel-art.py --icons    # prints the OS icons as inline SVG for index.html
```

Keep them current. A stale screenshot is the fastest way to make a good tool look abandoned —
which is why the script drives the real UI instead of anyone taking a screenshot by hand.
