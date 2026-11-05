---
name: system-detect
description: Check the machine for git, gh (and its sign-in), Node 24+, workstation-steward and a package manager before setting up or repairing portfolio-radar. Use at the start of setup or when a radar command fails on a missing tool.
---

# System detect

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect.mjs"` for JSON, or add `--pretty` for a list to show people. It only reads versions and status; it never installs anything.

| Field | Meaning |
|---|---|
| `tools.git`, `tools.gh`, `tools.node` | `found`, `version`; node also `ok` (24 or newer) |
| `tools.gh.authed`, `login`, `scopes` | Whether `gh` is signed in to github.com, and as whom |
| `tools.steward.found` | workstation-steward's `steward` command is on the PATH |
| `packageManager` | `brew`, `winget`, `apt-get`, `dnf`, `pacman` or null |
| `missing`, `install` | Tools to install and the command to offer for each |
| `nextStep` | `install`, `gh auth login`, or `ready` |
| `surface` | `claude-code` when run inside Claude Code, else `unknown` |

## What to do with it

- **Missing tools:** offer each `install` command and run it only after a yes, through the `radar-installer` agent. Commands with `sudo`, and anything that opens a browser, go to the person to run.
- **gh not signed in:** the person runs `gh auth login` (browser sign-in). Then re-check. The setup needs the `repo` scope, plus `admin:org` read only if they want org repo counts (it still works without).
- **Node older than 24:** the radar runs in GitHub Actions, not locally, so an old local Node only matters for running tests. Say so, and offer the install anyway.
- **Steward found:** hand-offs will follow its rules (see the `handoff-rules` skill). Also look for a `workstation-steward-config` repo the person owns: `gh repo view <login>/workstation-steward-config`. If not found, ask whether they keep it under another name.
- **Can't run commands at all** (Cowork without a connected computer): say so and use the wizard's "No terminal" path.
