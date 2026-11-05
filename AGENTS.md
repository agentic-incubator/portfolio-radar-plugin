# AGENTS.md: portfolio-radar-plugin

Rules for any agent working in this repo (the plugin marketplace and the `portfolio-radar` plugin).

- **The radar app stays read-only.** `scripts/app-manifest.mjs` must only ever ask for `read` permissions and no webhook. A test enforces it; never weaken that test.
- **No secrets, ever.** No private key, token or App ID of any real user in code, tests, docs or state. Scripts never print or save a private key. `state.mjs` refuses key-like fields.
- **Nothing deletes.** Commands, skills and agents never delete repos, branches, files or releases, except Ship it deleting the merged PR's branch. Uninstall is a checklist the person runs.
- **Yes before every write.** Any step that creates, installs, sets a secret or runs a workflow asks first.
- **Privacy.** Nothing from a real user's radar (owners, client names, repo names, reports) goes into this public repo. Examples use `octo-user`, `octo-org`, `acme-client`.
- **No dependencies.** Scripts are zero-dependency Node ES modules (Node 22+ to run them; the radar engine itself runs on 24+ in Actions).
- **Tests.** Run `node --test test/*.test.mjs` before pushing. New script logic gets a test.
- **Docs are part of done.** If a command, skill, agent, permission or setup step changes, update `README.md` and `docs/` in the same PR.
- **Versions.** Bump `version` in both `plugins/portfolio-radar/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` together.
- **Commits.** Conventional Commits; stage explicit paths only. No AI co-author trailer.
- **Merging.** Open the PR, get CI green, and stop. Don't merge until the owner says "ship it".
