/* ─────────────────────────────────────────────────────────────────────────
   HEPHAESTUS · site config

   The ONLY file you edit to connect this site. Everything else reads from here.
   Or skip it entirely and run:  node tools/connect.mjs <your-github-username>
   ───────────────────────────────────────────────────────────────────────── */

window.HEPH = {
  // 1. your GitHub owner + repo. The download buttons read the newest release from
  //    https://api.github.com/repos/<owner>/<repo>/releases/latest
  //    While owner is still "your-github-username" the page says it isn't connected.
  owner: "your-github-username",
  repo: "hephaestus",

  // 2. set sourcePublic: true once the repo is public. While it's false the footer
  //    says "private repo" instead of pointing visitors at a 404.
  sourcePublic: false,

  // 3. contact email for the footer — leave blank to hide it
  contact: "",
};
