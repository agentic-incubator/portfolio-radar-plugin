---
description: Turn on Dependabot alerts, secret scanning and CodeQL where the radar found them off, set Dependabot security updates to fit Renovate, using your own gh login, after you say yes.
argument-hint: "[--skip owner/repo,...]"
---

Turn GitHub's security features on where the radar found them off. These are repo settings that need admin rights. The radar's app is read-only and the Claude app that opens PRs has no admin rights, so this runs on the person's machine with their own `gh` login. Nothing here can run from a cloud session or a dashboard button directly.

What it sets, and why:

| Setting | Renovate repo | Repo without Renovate yet | Private repo |
|---|---|---|---|
| Dependabot alerts | On: Renovate reads them to open security PRs at once | On | On (free) |
| Dependabot security updates | Off: Renovate already raises those PRs, so these would be duplicates | On, until the repo moves to Renovate | Same as public |
| Secret scanning and push protection | On for public repos | On for public repos | Left off: needs GitHub Secret Protection (paid) |
| CodeQL default setup | On for public repos (runs in Actions on each push and PR; free on public repos) | Same | Left off: needs GitHub Code Security (paid) |

Org-wide "GitHub recommended" security configurations aren't used, because they also turn Dependabot security updates on, which duplicates Renovate. Per-repo calls keep the table above exact.

1. Check `gh auth status`. If it isn't signed in, stop and say `gh auth login`.
2. Get the radar repo from `node "${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs" get` (`repo`). Download its newest data into a temp file: `gh api "repos/<repo>/contents/data/dashboard.json" -H "Accept: application/vnd.github.raw" > <tmp>/dashboard.json`.
3. Steward-managed repos (the hand-off rules' list) are left out with `--skip`, along with anything the person names in `$ARGUMENTS`.
4. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/coverage.mjs" plan --data <tmp>/dashboard.json --skip <list>`. Show the summary (how many of each step), the repos for each, and what's held back and why. Ask once: "Apply these N changes with your gh login?"
5. On yes, run the same with `apply ... --yes`. Report how many were done, then each failure with its plain reason (for example "CodeQL supports none of this repo's languages" or "your gh login isn't an admin of this repo"), and what was held back. Don't retry failures.
6. Say the next daily radar run will show the new coverage, and that new alerts may appear once alerts and scanning are on.

It never deletes a repo, branch or alert. The only DELETE call turns Dependabot security updates off on Renovate repos.
