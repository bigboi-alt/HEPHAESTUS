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
    shots/*.webp                          real screenshots of the running app
```

## connecting it (about 30 seconds of work)

```bash
node tools/connect.mjs <your-github-username>        # repo defaults to "hephaestus"
```

That writes `site/config.js`, points the fallback links in the page at your releases, and
rebuilds the offline preview. Commit `site/` and you're done. (Editing `config.js` by hand
does the same thing — the tool just saves you from missing a spot.)

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

While `owner` is still the placeholder, the page says so in one calm line and every link
still goes somewhere real. Nothing is ever a dead button here.

## deploying on Cloudflare

Pick one of these, not both.

**A. Git integration (recommended — nothing to maintain)**

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings — the part people get wrong:
   - Framework preset: **None**
   - Build command: **empty**
   - Build output directory: **`site`**
4. Save and Deploy → **https://hephaestus.pages.dev** in about a minute. Name the
   project `hephaestus` — that project name *is* the subdomain, and it matches what
   `site.yml` deploys to, so both routes land on the same URL.

Every later push that touches `site/**` redeploys automatically, and pull requests get
their own preview URL.

**B. The workflow already in the repo** — `.github/workflows/site.yml` does the same via
`wrangler`. It skips itself quietly until both secrets exist, so it can't fail a build:

| secret | where |
|---|---|
| `CLOUDFLARE_API_TOKEN` | dash.cloudflare.com → My Profile → API Tokens → Create (Custom: Account → Cloudflare Pages → Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | dash.cloudflare.com home → right column, the long hex id |

Then run the `site` workflow once by hand. It creates the Pages project `hephaestus`
with `main` as the production branch (a missing project can't be handled by
`pages deploy` alone — that path prompts interactively, and CI has no keyboard),
so you land on `https://hephaestus.pages.dev` rather than `main.hephaestus.pages.dev`.

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
that looks broken when the CDN doesn't answer.

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

## previewing

```bash
cd site && python3 -m http.server 8099      # normal, with network
node tools/site-preview.mjs                  # site-preview.html — one file, offline
```

The single-file copy inlines every asset as a data URI for sandboxes that block network
access. It's a viewing artifact — **deploy `site/`, never `site-preview.html`**, or you'll
ship one uncachable 550 KB page.

## refreshing the screenshots

```bash
node qa-tools/shot.mjs          # drives the app at :5173, writes PNG masters
# then resize → 1600 wide, save webp q80 into site/assets/shots/
```

Keep them current. A stale screenshot is the fastest way to make a good tool look abandoned.
