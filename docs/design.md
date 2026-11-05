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

## Releases

The template tags engine versions (`v0.1.0`, …). `engine.json` in the template lists the files it owns; `/radar-update` replaces only those in a user's copy.
