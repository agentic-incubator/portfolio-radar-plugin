# Design notes

## Setup state

The wizard saves progress in `~/.config/portfolio-radar/state.json` (`%APPDATA%\portfolio-radar` on Windows): the radar repo, its clone path, the app's slug and ID, and which steps are done. Never a key or token. `scripts/state.mjs` refuses key-like fields.

## Scripts

| Script | Job | Writes |
|---|---|---|
| `detect.mjs` | Tools, versions, gh sign-in, package manager, steward | Nothing |
| `app-manifest.mjs` | GitHub App manifest flow on 127.0.0.1, then `gh secret set` | Two Actions secrets on the radar repo |
| `doctor.mjs` | Health checks via `gh` | Nothing |
| `state.mjs` | Read and write setup state | The state file |
| `build-dashboard.mjs` | One self-contained dashboard HTML file, data and settings inline | The output file you name |

## Releases

The template tags engine versions (`v0.1.0`, …). `engine.json` in the template lists the files it owns; `/radar-update` replaces only those in a user's copy.

## Dashboard

`dashboard/index.html` is one page for every tier. Personal settings live in `config.json` beside it (or inline in a built file), never in the page. At run time the page lights up what it has: a database for the button queue, the viewer's identity for owner-only actions, Ask Claude, and the Claude Code Remote connector to start the actions task. With none of those, buttons hand the person a `/radar-actions` line to paste. `dashboard/sample-data.json` is made-up data for previews and tests.
