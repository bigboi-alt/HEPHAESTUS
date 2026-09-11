/**
 * qa-tools/gh-stub.mjs — one fixed answer for the release reader, for the suites that are
 * measuring the page rather than the download logic.
 *
 * Without it, every layout/contrast run makes real calls to GitHub: slow, rate-limitable, and
 * different depending on what the repo happens to hold that day. The stub answers the way GitHub
 * answers for a public repo with nothing published — which is what site/ actually is right now —
 * so the page settles into the state its markup was written for, and dl-qa.mjs stays the one
 * suite that argues about releases.
 */
export const GH_REPO = "bigboi-alt/HEPHAESTUS";

const asset = (name, mb) => ({ name, size: Math.round(mb * 1048576), browser_download_url: `https://github.com/${GH_REPO}/releases/download/v0.3.0/${name}` });
const rel = (tag, date, assets, o = {}) => ({ tag_name: tag, name: o.name ?? tag, prerelease: !!o.pre, draft: false, published_at: `${date}T10:00:00Z`, html_url: `https://github.com/${GH_REPO}/releases/tag/${tag}`, assets });

/** What a repo with a few releases in it looks like, including the longest names a real
 *  Tauri build produces — because a layout gate that only ever sees the empty state is a gate
 *  that will approve an overflow the first time somebody publishes something. */
export const RELEASES = [
  rel("v0.4.0-rc1", "2026-09-08", [asset("Hephaestus_0.4.0-rc1_x64-setup.exe", 15.0)], { pre: true, name: "first look at block resizing, snapping and the ruler" }),
  rel("v0.3.0", "2026-09-02", [asset("Hephaestus_0.3.0_x64-setup.exe", 14.7), asset("Hephaestus_0.3.0_aarch64.dmg", 14.9), asset("hephaestus_0.3.0_amd64.deb", 13.4), asset("Hephaestus_0.3.0_amd64.AppImage", 21.8)]),
  rel("v0.2.0", "2026-08-05", []),
];

export async function stubGithub(page, mode = "empty") {
  await page.route("**/api.github.com/**", (route) => {
    const isList = new URL(route.request().url()).pathname.endsWith("/releases");
    return route.fulfill(isList
      ? { status: 200, contentType: "application/json", body: JSON.stringify(mode === "full" ? RELEASES : []) }
      : { status: 200, contentType: "application/json", body: JSON.stringify({ full_name: GH_REPO }) });
  });
}
