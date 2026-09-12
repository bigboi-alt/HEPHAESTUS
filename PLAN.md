# The plan, in plain English

> **Status: implemented in this branch, nothing deployed.** Every item below is in the tree and behind
> the QA gate (13/13, 545 assertions, 9 viewports). The "not testable in this sandbox" list at the
> bottom is still true: no `tauri build`, no wrangler deploy and no tag was run — read it as the plan
> for your first preflight run, then for the tag.

Nothing in this file is a promise of something already done — it is the review-first version of the
work. No GitHub Release, no tag, no Cloudflare deploy was created or touched while doing it.

## What is there now (inspected, not assumed)

| piece | today | the problem |
|---|---|---|
| `.github/workflows/release.yml` | `tauri-apps/tauri-action@v1`, matrix of 4 runners, creates a **draft GitHub release** `v__VERSION__`, uploads installers as release assets, refuses to overwrite a published one | installers end up inside GitHub; the repo is part of the delivery path |
| `.github/workflows/site.yml` | copies `site/`, **seds `github.repository` into the page**, deploys with wrangler, verifies the live URL | the page has to know a GitHub owner/repo at all |
| `site/index.html` | a release reader that calls `api.github.com/repos/…/releases` from every visitor's browser, two cards-rows and a release list | needs the repo public; needs GitHub up; needs GitHub to hand out the bytes |
| `src-tauri/tauri.conf.json` | Tauri **v2**, `bundle.targets: "all"`, `windows.nsis` (English), `linux.deb.depends`, `plugins: null`, no signing, no updater config | "all" per runner = NSIS + MSI on Windows, DMG (+ .app) on macOS, DEB + AppImage (+ RPM where tooling exists) — the pipeline below names those explicitly instead of trusting that |
| `tools/bump.mjs` | keeps `package.json` / `Cargo.toml` / `tauri.conf.json` in sync, prints a tag hint | fine, wording needs to change |
| `site/_headers` | CSP `connect-src 'self' https://api.github.com` | the outside call goes away, so the CSP gets tighter: `'self'` only |
| `qa-tools/` | 12 suites; `dl-qa` drives a stand-in `api.github.com`; `gh-stub.mjs` fakes GitHub for the page suites; `planes-qa` drives the Akmon planes panel | the GitHub-facing half of this is deleted, not adapted |
| `src/components/ForgeSplit.tsx` + `src/screens/Akmon.tsx` @ `96f5404` | the "surfaces are planes" redesign of Akmon | you asked for the previous Akmon back |

## Target shape

```
GitHub Actions = build factory          Cloudflare Pages = the shop window
──────────────────────────────          ──────────────────────────────────
tag v0.4.0  or  manual run               site/            ← the site, in the repo, as normal
   │                                       + downloads/   ← installers, written by the publish job
   ▼                                       + release.json   ← what's published, generated, static
4 native runners                         ──────────►  users download from your own hostname
build installers                                /downloads/Hephaestus_0.4.0_x64-setup.exe
   │
   ▼
temporary workflow artifacts (7-day retention, private to the run)
   │
   ▼
one publish job:  validate → assemble → verify on a preview deployment → promote to production
```

**The website never asks GitHub anything.** It reads `release.json` from its own origin. That is
the whole difference: the repo can be public or private, GitHub can be down, and the site and its
downloads are unaffected, because they were never depending on it.

## The rules the pipeline has to hold

1. **`release.yml` never creates a release.** No `tauri-action`, no `GITHUB_TOKEN` release calls,
   `permissions: contents: read`. Files go to artifacts, and artifacts are temporary.
2. **Real targets, not guesses.** Windows → `nsis` (the `.exe`) + `msi` as an extra; macOS → `dmg`
   per arch, built on the matching runner (`aarch64-apple-darwin` on an ARM runner,
   `x86_64-apple-darwin` on an Intel one); Linux → `deb` + `appimage`. The publish job requires a
   specific *slot table* to be filled — and the slot table is derived from the config, so if you
   change `bundle.targets`, `tools/release-manifest.mjs --print-required` shows what the pipeline
   then demands.
3. **Publish is a single final job** that needs every platform job, downloads all artifacts, and
   fails *before* touching the live site if anything is missing, empty, oversized-small, or carries
   a version that isn't the one in `package.json` / `Cargo.toml` / `tauri.conf.json`.
4. **Preflight by default.** `workflow_dispatch` builds and validates, writes nothing, deploys
   nothing. Publishing requires the `publish` checkbox to be ticked explicitly. A tag push is the
   only automatic publisher.
5. **One shared concurrency lock** (`hephaestus-release`) across `release.yml` and `site.yml`, so a
   site-only deploy can never interleave with a release deploy.
6. **Fail = leave the live site alone.** Missing secrets, cancelled build, no Actions minutes, a
   validation error: the deploy step is never reached. The last verified release stays live.
7. **Never delete published files.** The publish job carries the currently live `downloads/` and
   `release.json` into the new deployment (previous releases are kept, newest first, up to five),
   so an old link in an old blog post still resolves.
8. **Verified twice before it is trusted.** The assembled bundle is deployed to a *preview*
   deployment first, every `files[].url` is fetched from there and checked for status and byte
   length, and only then is the same bundle deployed to production and checked again.
9. **No signing claims.** Nothing is signed or notarised, so nothing says otherwise: the manifest
   carries `"signing": { "windows": "unsigned", "macos": "unsigned", "linux": "unsigned" }` and the
   site shows the honest macOS advisory (right-click → Open). No signing key, no Apple
   credentials, no updater key is invented, requested or faked. What *is* here is a version check —
   `src/lib/updates.ts` reads `release.json`, compares the number, and points at the download page;
   it downloads and installs nothing, which is precisely why it needs no key. A real in-app updater
   (Tauri's plugin, signing, an update endpoint) stays its own later job.

## What `release.json` looks like

```json
{
  "schema": 1, "status": "ready", "product": "Hephaestus", "version": "0.4.0",
  "publishedAt": "2026-09-11", "channel": "stable",
  "signing": { "windows": "unsigned", "macos": "unsigned", "linux": "unsigned" },
  "files": [{ "id": "windows-x64", "os": "windows", "arch": "x64", "kind": "installer",
              "label": "Windows installer", "file": "Hephaestus_0.4.0_x64-setup.exe",
              "url": "/downloads/Hephaestus_0.4.0_x64-setup.exe",
              "size": 15413248, "sha256": "…", "required": true }],
  "previous": [{ "version": "0.3.0", "publishedAt": "…", "files": [ … ] }]
}
```

Committed to the repo as `{"status":"preparing"}` so a fresh deploy has something truthful to read
and the site's fallback state is the *normal* state before the first release — not an error.

## What the site becomes

Product-first, same warmth, no repository talk in the download path. The hero portrait stays
(generated by `tools/ascii-art.py`, still byte-checked by the gate), the palette stays, no images,
no third-party requests, nothing that animates on its own.

- **Get Hephaestus** — five platform cards (Windows, macOS Apple Silicon, macOS Intel, Linux
  AppImage, Linux .deb), each showing real file name, size and a short `sha256`, filled from
  `release.json`. Your own platform is marked. No GitHub word anywhere in the journey.
- **Status, plainly**: `release 0.4.0 · published 11 Sep 2026 · 5 files · hosted here` — or
  `not published yet`, or `this copy couldn't read its release file`. Three states, all honest,
  all with the buttons staying `#get` when there is nothing confirmed.
- **Older versions**, from the same file, as a short list.
- **What it is**: a design forge — Akmon's colour science, Cedalion's rule-based critique, the
  trends library, the canvas — described by what the code does, with the measured numbers that
  come out of the app, and nothing invented.
- **What it isn't** / **the catch**: no AI, no account, no telemetry, no subscription, unsigned
  macOS builds, and the limits of a 0.x tool.
- **Details**: version, sizes, licence, how it's built, `release.json` documented.

## Akmon

`96f5404` replaced the labelled swatch grid with the "planes" panel. That is reverted: `Akmon.tsx`
back to its pre-`96f5404` content, `ForgeSplit.tsx` deleted, and `planes-qa.mjs` retired, because
the suite existed only to police a design that no longer exists. `akmon-qa.mjs` stays and must pass
against the restored screen.

## Also needed, and how it's checked

| addition | why | how it's verified here |
|---|---|---|
| `tools/release-manifest.mjs` | validate + assemble + write `release.json` | new `qa-tools/manifest-qa.mjs`: missing slot, empty file, tiny file, wrong version, `--check-only` writing nothing, carry-forward merge, filename-vs-config drift |
| `tools/verify-release.mjs` | fetch `release.json` from a deployed URL and check every file's status + byte length | the same suite runs it against a local server serving the real bytes |
| `dl-qa.mjs` rewritten | the page now reads its own metadata | drives ready / preparing / 404 / malformed / partial (one platform missing) / version-drift, and asserts **zero** off-origin requests and no `github.com` anywhere |
| `ascii-qa.mjs` updated | its rules changed | no `HEPH_REPO`, no `api.github.com`, CSP `connect-src 'self'`, `/downloads/*` gets `Content-Disposition: attachment`, art parity with the generator |
| `gh-stub.mjs` deleted | there is no GitHub to stub | — |
| `run-all.mjs` | gate list | drop `planes-qa`, add `manifest-qa` |

**Not testable in this sandbox, and I will not pretend otherwise:** the actual `tauri build` on
Windows/macOS/Linux runners, wrangler deploying, Cloudflare preview→production promotion, and
Actions minute limits. Those are exercised by the workflow itself on the first real run, and the
preflight mode exists precisely so the first one costs nothing but build minutes.


---

## Addendum, after the first real run

The plan held; one line of it was wrong in a way only a live deploy could show. "deploy → verify"
assumed a deployment is reachable the instant `wrangler` returns. It is stored first and pointed at a
few seconds later, so the first real `site` run verified the alias while the alias still served the
previous deployment, and reported a correct site as broken (three FAILs, all of them describing the
*old* page). The site was fine and is still fine; the check was reading the wrong URL at the wrong
moment, and its retry loop tested for the wrong thing.

So "verify" in this plan now means: the deployment's own immutable URL first, then the alias with a
budget and a byte comparison, with `--expect-version` on a release publish so a lagging alias cannot
pass as a verified one. Everything else above — the build factory, the static `release.json`, the
same two secrets, nothing published without validation — is unchanged by it, and no production state
was altered to find this out. `NOTES.md` (2026-09-12) has the fix and the tests that pin it.


## Files bigger than Pages — the 25 MiB wall

**The fact.** Cloudflare Pages refuses any single asset above 25 MiB, and there is no setting for it:
"the maximum file size for a single Cloudflare Pages site asset is 25 MiB… to serve larger files,
consider uploading them to R2 and utilizing the public bucket feature" (Cloudflare Pages limits). The
first real publish found this the expensive way: four platforms built and validated, then
`wrangler pages deploy` died on `downloads/Hephaestus_0.3.0_amd64.AppImage is 76.5 MiB` — after the
minutes were spent, which is exactly what the gate is supposed to prevent. It is prevented now:
`tools/release-manifest.mjs` refuses an over-ceiling file at validation, and `tools/prepare-site.mjs`
refuses to carry one (and measures what actually arrived, so an understated size in `release.json`
cannot smuggle it in).

**Why the AppImage is 76 MB and why that is not sloppiness.** The app's own payload is tiny — `src/`
is 1.1 MB and the built JS is ~500 KB — but a Tauri Linux AppImage carries its GTK/WebKit runtime
inside it (that is the entire point of an AppImage: it runs on a distro that has no
`libwebkit2gtk-4.1`). So there is nothing honest to shave: it is a runtime, not debug symbols. The
release profile is already the size-tuned one (`codegen-units = 1`, `lto = true`, `opt-level = "s"`,
`strip = true`).

**Why "just that one file" is not a one-off.** Every future site deploy has to carry the live release
forward, and carrying means putting those bytes back into the bundle — so a docs push would fail at
the same place, forever. Either the file shrinks below the ceiling or it stops living in Pages.

**Two ways out, and which is which**

1. **Today, no new infrastructure:** take `"appimage"` out of `src-tauri/tauri.conf.json`
   `bundle.targets`. The required-slot list is derived from that config, so nothing else needs
   editing: the release ships Windows (.exe/.msi), both macOS slices and the Linux `.deb`, and the
   site's AppImage card says "not in this release" instead of pointing at nothing. Linux users on
   Debian/Ubuntu lose nothing; Fedora/Arch users lose the no-install option. This is a *product*
   decision, not a build detail, which is why it is not something the pipeline decides silently.
2. **The durable fix: keep the URL, move the bytes.** The installers live in an R2 bucket; a Pages
   Function at `/downloads/*` streams the object when the file is not a static asset of the bundle.
   Worth doing *because* it bends no rule: `release.json` still says `url:
   "/downloads/Hephaestus_0.4.0_amd64.AppImage"`, still same-origin, so the page never gains an
   absolute URL, `connect-src 'self'` stays, and `tools/verify-release.mjs` still head-checks the real
   byte length through the same path a visitor uses. Carry-forward gets *stronger*: a Pages deploy
   replaces the bundle, but it does not touch R2, so an old release's installers cannot be deleted by
   a docs push even in principle.

   What it costs: the existing `CLOUDFLARE_API_TOKEN` gains an **R2:Edit** scope (no new secret), plus
   the R2 free tier (10 GB stored, no egress charges — four platforms × 5 releases is well under that).
   What it changes in the tools: each manifest entry gains `storage: "pages" | "r2"`; `prepare-site`
   skips `r2` files by design instead of erroring; the publish job does `wrangler r2 object put
   hephaestus-downloads/<file> --file … --content-type application/octet-stream` before deploying, and
   configures the bucket binding on the Pages project (same create-if-missing pattern the project
   already uses, via the API); the Function sets its own `Content-Disposition: attachment`, because
   `_headers` governs static assets, not function responses.
   Honest caveats: a function response is not CDN-cached by default, so each download is one function
   invocation (100k/day on the free plan, streaming costs no real CPU); and none of it is verifiable in
   this sandbox — no R2 bucket, no Cloudflare credentials here, and inventing them is out of the
   question. So it ships behind the same preflight discipline as everything else: build, dry-run, and
   let the verify step be the judge.
